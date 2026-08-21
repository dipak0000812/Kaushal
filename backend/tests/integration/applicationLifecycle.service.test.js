import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { acceptOffer } from '../../src/modules/student/services/applicationLifecycle.service.js';
import { Application } from '../../src/modules/student/models/Application.js';
import { APPLICATION_STATUS } from '../../src/utils/constants.js';

// ─── Infrastructure ───────────────────────────────────────────────────────

let replSet;

before(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replSet.getUri(), { dbName: 'kaushal_lifecycle_test' });
});

after(async () => {
  await mongoose.disconnect();
  await replSet.stop();
});

beforeEach(async () => {
  await Application.deleteMany({});
});

// ─── Fixtures ─────────────────────────────────────────────────────────────

function makeStudentId() {
  return new mongoose.Types.ObjectId();
}

async function makeApp(studentId, status = APPLICATION_STATUS.OFFERED) {
  return Application.create({
    studentId,
    internshipId: new mongoose.Types.ObjectId(),
    currentStatus: status,
    eligibilitySnapshot: { eligible: true, checks: [], computedAt: new Date() },
  });
}

function studentActor(studentId) {
  return { id: studentId.toString(), role: 'student' };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('applicationLifecycle.service — acceptOffer()', () => {

  // ── Test 1: Single offer, no siblings ─────────────────────────────────────
  describe('single offered application, no other applications by this student', () => {
    it('returns accepted document with correct currentStatus', async () => {
      const studentId = makeStudentId();
      const app = await makeApp(studentId, APPLICATION_STATUS.OFFERED);

      const { accepted } = await acceptOffer(app._id.toString(), studentActor(studentId));

      assert.equal(accepted.currentStatus, APPLICATION_STATUS.ACCEPTED);
    });

    it('returns withdrawnCount: 0', async () => {
      const studentId = makeStudentId();
      const app = await makeApp(studentId, APPLICATION_STATUS.OFFERED);

      const { withdrawnCount } = await acceptOffer(app._id.toString(), studentActor(studentId));

      assert.equal(withdrawnCount, 0);
    });

    it('DB confirms the application is now "accepted"', async () => {
      const studentId = makeStudentId();
      const app = await makeApp(studentId, APPLICATION_STATUS.OFFERED);

      await acceptOffer(app._id.toString(), studentActor(studentId));

      const fromDb = await Application.findById(app._id);
      assert.equal(fromDb.currentStatus, APPLICATION_STATUS.ACCEPTED);
    });

    it('DB timeline has one entry: offered → accepted', async () => {
      const studentId = makeStudentId();
      const app = await makeApp(studentId, APPLICATION_STATUS.OFFERED);

      await acceptOffer(app._id.toString(), studentActor(studentId));

      const fromDb = await Application.findById(app._id);
      assert.equal(fromDb.timeline.length, 1);
      assert.equal(fromDb.timeline[0].fromStatus, APPLICATION_STATUS.OFFERED);
      assert.equal(fromDb.timeline[0].toStatus, APPLICATION_STATUS.ACCEPTED);
    });
  });

  // ── Test 2: Student has 3 offered apps, accepts one → 2 auto-withdrawn ────
  describe('student has 3 offered applications, accepts one', () => {
    it('returns withdrawnCount: 2', async () => {
      const studentId = makeStudentId();
      const [appA, , ] = await Promise.all([
        makeApp(studentId, APPLICATION_STATUS.OFFERED),
        makeApp(studentId, APPLICATION_STATUS.OFFERED),
        makeApp(studentId, APPLICATION_STATUS.OFFERED),
      ]);

      const { withdrawnCount } = await acceptOffer(appA._id.toString(), studentActor(studentId));

      assert.equal(withdrawnCount, 2);
    });

    it('target application is "accepted" in the DB (not just in return value)', async () => {
      const studentId = makeStudentId();
      const [appA, appB, appC] = await Promise.all([
        makeApp(studentId, APPLICATION_STATUS.OFFERED),
        makeApp(studentId, APPLICATION_STATUS.OFFERED),
        makeApp(studentId, APPLICATION_STATUS.OFFERED),
      ]);

      await acceptOffer(appA._id.toString(), studentActor(studentId));

      const fromDb = await Application.findById(appA._id);
      assert.equal(fromDb.currentStatus, APPLICATION_STATUS.ACCEPTED,
        'Accepted application must be "accepted" in DB');

      // Suppress unused variable warnings by checking siblings below
      void [appB, appC]; // checked in next tests
    });

    it('the other two sibling applications are "withdrawn" in the DB', async () => {
      const studentId = makeStudentId();
      const [appA, appB, appC] = await Promise.all([
        makeApp(studentId, APPLICATION_STATUS.OFFERED),
        makeApp(studentId, APPLICATION_STATUS.OFFERED),
        makeApp(studentId, APPLICATION_STATUS.OFFERED),
      ]);

      await acceptOffer(appA._id.toString(), studentActor(studentId));

      const [fromDbB, fromDbC] = await Promise.all([
        Application.findById(appB._id),
        Application.findById(appC._id),
      ]);

      assert.equal(fromDbB.currentStatus, APPLICATION_STATUS.WITHDRAWN,
        'Sibling B must be "withdrawn" in DB');
      assert.equal(fromDbC.currentStatus, APPLICATION_STATUS.WITHDRAWN,
        'Sibling C must be "withdrawn" in DB');
    });

    it('each sibling has an auto-withdrawal timeline entry with reason', async () => {
      const studentId = makeStudentId();
      const [appA, appB, appC] = await Promise.all([
        makeApp(studentId, APPLICATION_STATUS.OFFERED),
        makeApp(studentId, APPLICATION_STATUS.OFFERED),
        makeApp(studentId, APPLICATION_STATUS.OFFERED),
      ]);

      await acceptOffer(appA._id.toString(), studentActor(studentId));

      for (const siblingId of [appB._id, appC._id]) {
        const fromDb = await Application.findById(siblingId);
        assert.equal(fromDb.timeline.length, 1);
        assert.equal(fromDb.timeline[0].toStatus, APPLICATION_STATUS.WITHDRAWN);
        assert.equal(fromDb.timeline[0].actorRole, 'system');
        assert.ok(
          fromDb.timeline[0].reason.includes('Auto-withdrawn'),
          'Withdrawal reason must mention auto-withdrawal',
        );
      }
    });

    it('no application ends up in "offered" status after the operation', async () => {
      const studentId = makeStudentId();
      await Promise.all([
        makeApp(studentId, APPLICATION_STATUS.OFFERED),
        makeApp(studentId, APPLICATION_STATUS.OFFERED),
        makeApp(studentId, APPLICATION_STATUS.OFFERED),
      ]);

      const [first] = await Application.find({ studentId }).sort({ _id: 1 });
      await acceptOffer(first._id.toString(), studentActor(studentId));

      const stillOffered = await Application.countDocuments({
        studentId,
        currentStatus: APPLICATION_STATUS.OFFERED,
      });
      assert.equal(stillOffered, 0, 'No applications for this student should remain "offered"');
    });
  });

  // ── Test 3: Scope leak — other students' applications are NOT touched ──────
  // This is the most important correctness test in the file. The studentId
  // filter in the siblings query must be precise — it must never touch
  // applications belonging to a different student.
  describe('scope isolation: other students offered applications are not touched', () => {
    it('other student applications remain "offered" after the operation', async () => {
      const studentA = makeStudentId();
      const studentB = makeStudentId();

      const appA = await makeApp(studentA, APPLICATION_STATUS.OFFERED);
      const appB1 = await makeApp(studentB, APPLICATION_STATUS.OFFERED);
      const appB2 = await makeApp(studentB, APPLICATION_STATUS.OFFERED);

      await acceptOffer(appA._id.toString(), studentActor(studentA));

      const [fromDbB1, fromDbB2] = await Promise.all([
        Application.findById(appB1._id),
        Application.findById(appB2._id),
      ]);

      assert.equal(fromDbB1.currentStatus, APPLICATION_STATUS.OFFERED,
        'Student B\'s first application must not be touched');
      assert.equal(fromDbB2.currentStatus, APPLICATION_STATUS.OFFERED,
        'Student B\'s second application must not be touched');
    });

    it('other student applications have an empty timeline (no spurious entries)', async () => {
      const studentA = makeStudentId();
      const studentB = makeStudentId();

      const appA = await makeApp(studentA, APPLICATION_STATUS.OFFERED);
      const appB = await makeApp(studentB, APPLICATION_STATUS.OFFERED);

      await acceptOffer(appA._id.toString(), studentActor(studentA));

      const fromDbB = await Application.findById(appB._id);
      assert.equal(fromDbB.timeline.length, 0,
        'Other student\'s application must have no timeline entries added');
    });

    it('withdrawnCount only reflects THIS student\'s siblings', async () => {
      const studentA = makeStudentId();
      const studentB = makeStudentId();

      const appA = await makeApp(studentA, APPLICATION_STATUS.OFFERED);
      // student B has 5 offered apps — none should count in studentA's withdrawnCount
      await Promise.all(Array.from({ length: 5 }, () => makeApp(studentB)));

      const { withdrawnCount } = await acceptOffer(appA._id.toString(), studentActor(studentA));

      assert.equal(withdrawnCount, 0,
        'withdrawnCount must only reflect student A\'s siblings, not student B\'s applications');
    });
  });

  // ── Test 4: Target not in 'offered' status → INVALID_TRANSITION + rollback ─
  describe('target application is already "accepted" (not offered)', () => {
    it('throws an error with code INVALID_TRANSITION', async () => {
      const studentId = makeStudentId();
      const app = await makeApp(studentId, APPLICATION_STATUS.ACCEPTED);

      await assert.rejects(
        () => acceptOffer(app._id.toString(), studentActor(studentId)),
        (err) => {
          assert.equal(err.code, 'INVALID_TRANSITION');
          return true;
        },
      );
    });

    it('error has status 409', async () => {
      const studentId = makeStudentId();
      const app = await makeApp(studentId, APPLICATION_STATUS.ACCEPTED);

      await assert.rejects(
        () => acceptOffer(app._id.toString(), studentActor(studentId)),
        (err) => {
          assert.equal(err.status, 409);
          return true;
        },
      );
    });

    it('sibling offered applications are NOT withdrawn (transaction rolled back)', async () => {
      const studentId = makeStudentId();
      const target = await makeApp(studentId, APPLICATION_STATUS.ACCEPTED); // wrong status
      const sibling = await makeApp(studentId, APPLICATION_STATUS.OFFERED);

      await assert.rejects(
        () => acceptOffer(target._id.toString(), studentActor(studentId)),
      );

      const fromDbSibling = await Application.findById(sibling._id);
      assert.equal(
        fromDbSibling.currentStatus,
        APPLICATION_STATUS.OFFERED,
        'Sibling must still be "offered" — transaction must have rolled back',
      );
    });

    it('sibling timeline is empty after the failed operation (no partial write)', async () => {
      const studentId = makeStudentId();
      const target = await makeApp(studentId, APPLICATION_STATUS.ACCEPTED);
      const sibling = await makeApp(studentId, APPLICATION_STATUS.OFFERED);

      await assert.rejects(
        () => acceptOffer(target._id.toString(), studentActor(studentId)),
      );

      const fromDbSibling = await Application.findById(sibling._id);
      assert.equal(fromDbSibling.timeline.length, 0,
        'Sibling timeline must be empty — no partial write committed');
    });
  });

  // ── Test 5: Nonexistent applicationId → NOT_FOUND ─────────────────────────
  describe('nonexistent applicationId', () => {
    it('throws an error with code NOT_FOUND', async () => {
      const ghostId = new mongoose.Types.ObjectId().toString();
      const actor = { id: new mongoose.Types.ObjectId().toString(), role: 'student' };

      await assert.rejects(
        () => acceptOffer(ghostId, actor),
        (err) => {
          assert.equal(err.code, 'NOT_FOUND');
          return true;
        },
      );
    });

    it('error has status 404', async () => {
      const ghostId = new mongoose.Types.ObjectId().toString();
      const actor = { id: new mongoose.Types.ObjectId().toString(), role: 'student' };

      await assert.rejects(
        () => acceptOffer(ghostId, actor),
        (err) => {
          assert.equal(err.status, 404);
          return true;
        },
      );
    });

    it('no other applications are affected', async () => {
      const studentId = makeStudentId();
      const bystander = await makeApp(studentId, APPLICATION_STATUS.OFFERED);
      const ghostId = new mongoose.Types.ObjectId().toString();

      await assert.rejects(() => acceptOffer(ghostId, studentActor(studentId)));

      const fromDb = await Application.findById(bystander._id);
      assert.equal(fromDb.currentStatus, APPLICATION_STATUS.OFFERED,
        'Bystander application must be untouched');
      assert.equal(fromDb.timeline.length, 0);
    });
  });

  // ── Test 6: Concurrency — two concurrent acceptOffer calls, same student ───
  // Both applications belong to the same student and are both in 'offered'.
  // Both acceptOffer calls fire simultaneously via Promise.allSettled.
  //
  // The compare-and-swap in applyTransition (currentStatus in filter) and
  // MongoDB's document-level atomicity guarantee that:
  //   - At most one call can commit 'accepted' for any given application.
  //   - The final DB state must be exactly one 'accepted' and one 'withdrawn',
  //     never two 'accepted'.
  //
  // The exact error on the losing call depends on which operation loses the
  // race (TRANSITION_CONFLICT if the CAS fires, or INVALID_TRANSITION if the
  // transaction retries after the sibling is already withdrawn). We assert the
  // FINAL STATE, not the specific error code of the loser.
  describe('concurrency: two simultaneous acceptOffer calls for the same student', () => {
    it('final state has exactly one "accepted" and one "withdrawn" application', async () => {
      const studentId = makeStudentId();
      const actor = studentActor(studentId);
      const appA = await makeApp(studentId, APPLICATION_STATUS.OFFERED);
      const appB = await makeApp(studentId, APPLICATION_STATUS.OFFERED);

      await Promise.allSettled([
        acceptOffer(appA._id.toString(), actor),
        acceptOffer(appB._id.toString(), actor),
      ]);

      const [finalA, finalB] = await Promise.all([
        Application.findById(appA._id),
        Application.findById(appB._id),
      ]);

      const statuses = [finalA.currentStatus, finalB.currentStatus].sort();
      assert.deepEqual(
        statuses,
        [APPLICATION_STATUS.ACCEPTED, APPLICATION_STATUS.WITHDRAWN].sort(),
        `Expected one accepted and one withdrawn, got: ${statuses.join(', ')}`,
      );
    });

    it('never results in two "accepted" applications for the same student', async () => {
      const studentId = makeStudentId();
      const actor = studentActor(studentId);
      const appA = await makeApp(studentId, APPLICATION_STATUS.OFFERED);
      const appB = await makeApp(studentId, APPLICATION_STATUS.OFFERED);

      await Promise.allSettled([
        acceptOffer(appA._id.toString(), actor),
        acceptOffer(appB._id.toString(), actor),
      ]);

      const acceptedCount = await Application.countDocuments({
        studentId,
        currentStatus: APPLICATION_STATUS.ACCEPTED,
      });

      assert.equal(acceptedCount, 1,
        'Exactly one application must end up "accepted" — never two');
    });

    it('at least one acceptOffer call succeeds', async () => {
      const studentId = makeStudentId();
      const actor = studentActor(studentId);
      const appA = await makeApp(studentId, APPLICATION_STATUS.OFFERED);
      const appB = await makeApp(studentId, APPLICATION_STATUS.OFFERED);

      const results = await Promise.allSettled([
        acceptOffer(appA._id.toString(), actor),
        acceptOffer(appB._id.toString(), actor),
      ]);

      const succeeded = results.filter((r) => r.status === 'fulfilled');
      assert.ok(succeeded.length >= 1, 'At least one acceptOffer call must succeed');
    });

    it('no application remains in "offered" status after both calls settle', async () => {
      const studentId = makeStudentId();
      const actor = studentActor(studentId);
      const appA = await makeApp(studentId, APPLICATION_STATUS.OFFERED);
      const appB = await makeApp(studentId, APPLICATION_STATUS.OFFERED);

      await Promise.allSettled([
        acceptOffer(appA._id.toString(), actor),
        acceptOffer(appB._id.toString(), actor),
      ]);

      const stillOffered = await Application.countDocuments({
        studentId,
        currentStatus: APPLICATION_STATUS.OFFERED,
      });

      assert.equal(stillOffered, 0,
        'No application should remain in "offered" status after concurrent accepts settle');
    });
  });
});
