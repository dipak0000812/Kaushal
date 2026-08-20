import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { applyTransition } from '../../src/modules/student/services/applicationTransition.service.js';
import { Application } from '../../src/modules/student/models/Application.js';
import { APPLICATION_STATUS } from '../../src/utils/constants.js';

// ─── Infrastructure ───────────────────────────────────────────────────────

let replSet;

before(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const uri = replSet.getUri();
  await mongoose.connect(uri, { dbName: 'kaushal_test' });
});

after(async () => {
  await mongoose.disconnect();
  await replSet.stop();
});

beforeEach(async () => {
  await Application.deleteMany({});
});

// ─── Fixtures ─────────────────────────────────────────────────────────────

function makeApp(currentStatus = APPLICATION_STATUS.APPLIED) {
  return Application.create({
    studentId: new mongoose.Types.ObjectId(),
    internshipId: new mongoose.Types.ObjectId(),
    currentStatus,
    eligibilitySnapshot: {
      eligible: true,
      checks: [],
      computedAt: new Date(),
    },
  });
}

function makeActor(role = 'company') {
  return { id: new mongoose.Types.ObjectId().toString(), role };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('applicationTransition.service — applyTransition()', () => {

  // ── Test 1: Valid transition succeeds ─────────────────────────────────────
  describe('valid transition: applied → shortlisted', () => {
    it('returns the updated document with the new currentStatus', async () => {
      const app = await makeApp(APPLICATION_STATUS.APPLIED);
      const actor = makeActor('company');

      const updated = await applyTransition(
        app._id.toString(),
        APPLICATION_STATUS.SHORTLISTED,
        actor,
      );

      assert.equal(updated.currentStatus, APPLICATION_STATUS.SHORTLISTED);
    });

    it('appends exactly one timeline entry', async () => {
      const app = await makeApp(APPLICATION_STATUS.APPLIED);
      const actor = makeActor('company');

      const updated = await applyTransition(
        app._id.toString(),
        APPLICATION_STATUS.SHORTLISTED,
        actor,
      );

      assert.equal(updated.timeline.length, 1);
    });

    it('timeline entry has correct fromStatus and toStatus', async () => {
      const app = await makeApp(APPLICATION_STATUS.APPLIED);
      const actor = makeActor('company');

      const updated = await applyTransition(
        app._id.toString(),
        APPLICATION_STATUS.SHORTLISTED,
        actor,
      );

      const entry = updated.timeline[0];
      assert.equal(entry.fromStatus, APPLICATION_STATUS.APPLIED);
      assert.equal(entry.toStatus, APPLICATION_STATUS.SHORTLISTED);
    });

    it('timeline entry records the correct actorId', async () => {
      const app = await makeApp(APPLICATION_STATUS.APPLIED);
      const actor = makeActor('company');

      const updated = await applyTransition(
        app._id.toString(),
        APPLICATION_STATUS.SHORTLISTED,
        actor,
      );

      assert.equal(updated.timeline[0].actorId.toString(), actor.id);
    });

    it('timeline entry records the correct actorRole', async () => {
      const app = await makeApp(APPLICATION_STATUS.APPLIED);
      const actor = makeActor('company');

      const updated = await applyTransition(
        app._id.toString(),
        APPLICATION_STATUS.SHORTLISTED,
        actor,
      );

      assert.equal(updated.timeline[0].actorRole, 'company');
    });

    it('timeline entry has an `at` timestamp that is a Date', async () => {
      const app = await makeApp(APPLICATION_STATUS.APPLIED);
      const beforeWrite = new Date();

      const updated = await applyTransition(
        app._id.toString(),
        APPLICATION_STATUS.SHORTLISTED,
        makeActor(),
      );

      const entry = updated.timeline[0];
      assert.ok(entry.at instanceof Date);
      assert.ok(entry.at >= beforeWrite, '`at` must be >= the time before the write');
    });

    it('timeline entry reason defaults to null when not supplied', async () => {
      const app = await makeApp(APPLICATION_STATUS.APPLIED);

      const updated = await applyTransition(
        app._id.toString(),
        APPLICATION_STATUS.SHORTLISTED,
        makeActor(),
        undefined,
      );

      assert.equal(updated.timeline[0].reason, null);
    });

    it('timeline entry records an explicit reason when supplied', async () => {
      const app = await makeApp(APPLICATION_STATUS.APPLIED);

      const updated = await applyTransition(
        app._id.toString(),
        APPLICATION_STATUS.SHORTLISTED,
        makeActor(),
        'Strong candidate',
      );

      assert.equal(updated.timeline[0].reason, 'Strong candidate');
    });

    it('re-fetched document from DB also reflects the changes (not just the return value)', async () => {
      const app = await makeApp(APPLICATION_STATUS.APPLIED);

      await applyTransition(
        app._id.toString(),
        APPLICATION_STATUS.SHORTLISTED,
        makeActor(),
      );

      const fromDb = await Application.findById(app._id);
      assert.equal(fromDb.currentStatus, APPLICATION_STATUS.SHORTLISTED);
      assert.equal(fromDb.timeline.length, 1);
    });
  });

  // ── Test 2: Invalid transition — DB untouched ─────────────────────────────
  describe('invalid transition: applied → mentorAssigned (skips intermediate states)', () => {
    it('throws an error with code INVALID_TRANSITION', async () => {
      const app = await makeApp(APPLICATION_STATUS.APPLIED);

      await assert.rejects(
        () => applyTransition(app._id.toString(), APPLICATION_STATUS.MENTOR_ASSIGNED, makeActor()),
        (err) => {
          assert.equal(err.code, 'INVALID_TRANSITION');
          return true;
        },
      );
    });

    it('error has status 409', async () => {
      const app = await makeApp(APPLICATION_STATUS.APPLIED);

      await assert.rejects(
        () => applyTransition(app._id.toString(), APPLICATION_STATUS.MENTOR_ASSIGNED, makeActor()),
        (err) => {
          assert.equal(err.status, 409);
          return true;
        },
      );
    });

    it('document currentStatus is unchanged after the failed call', async () => {
      const app = await makeApp(APPLICATION_STATUS.APPLIED);

      await assert.rejects(
        () => applyTransition(app._id.toString(), APPLICATION_STATUS.MENTOR_ASSIGNED, makeActor()),
      );

      const unchanged = await Application.findById(app._id);
      assert.equal(unchanged.currentStatus, APPLICATION_STATUS.APPLIED,
        'currentStatus must still be "applied" after a failed transition');
    });

    it('timeline length is still 0 after the failed call', async () => {
      const app = await makeApp(APPLICATION_STATUS.APPLIED);

      await assert.rejects(
        () => applyTransition(app._id.toString(), APPLICATION_STATUS.MENTOR_ASSIGNED, makeActor()),
      );

      const unchanged = await Application.findById(app._id);
      assert.equal(unchanged.timeline.length, 0,
        'timeline must be empty — no partial write occurred');
    });
  });

  // ── Test 3: Nonexistent applicationId → NOT_FOUND / 404 ──────────────────
  describe('nonexistent applicationId', () => {
    it('throws an error with code NOT_FOUND', async () => {
      const ghostId = new mongoose.Types.ObjectId().toString();

      await assert.rejects(
        () => applyTransition(ghostId, APPLICATION_STATUS.SHORTLISTED, makeActor()),
        (err) => {
          assert.equal(err.code, 'NOT_FOUND');
          return true;
        },
      );
    });

    it('error has status 404', async () => {
      const ghostId = new mongoose.Types.ObjectId().toString();

      await assert.rejects(
        () => applyTransition(ghostId, APPLICATION_STATUS.SHORTLISTED, makeActor()),
        (err) => {
          assert.equal(err.status, 404);
          return true;
        },
      );
    });
  });

  // ── Test 4: Terminal status → every possible toStatus is rejected ─────────
  describe('transition FROM a terminal status', () => {
    it('rejects every possible toStatus when currentStatus is "completed"', async () => {
      const app = await makeApp(APPLICATION_STATUS.COMPLETED);
      const actor = makeActor('tnp');

      for (const targetStatus of Object.values(APPLICATION_STATUS)) {
        await assert.rejects(
          () => applyTransition(app._id.toString(), targetStatus, actor),
          (err) => {
            assert.equal(
              err.code,
              'INVALID_TRANSITION',
              `Expected INVALID_TRANSITION when attempting completed → ${targetStatus}`,
            );
            assert.equal(err.status, 409);
            return true;
          },
        );
      }

      const stillCompleted = await Application.findById(app._id);
      assert.equal(stillCompleted.currentStatus, APPLICATION_STATUS.COMPLETED);
      assert.equal(stillCompleted.timeline.length, 0);
    });

    it('rejects every possible toStatus when currentStatus is "rejected"', async () => {
      const app = await makeApp(APPLICATION_STATUS.REJECTED);
      const actor = makeActor('tnp');

      for (const targetStatus of Object.values(APPLICATION_STATUS)) {
        await assert.rejects(
          () => applyTransition(app._id.toString(), targetStatus, actor),
          (err) => {
            assert.equal(err.code, 'INVALID_TRANSITION');
            return true;
          },
        );
      }
    });
  });

  // ── Test 5: Sequential calls — second call reads fresh state ──────────────
  describe('sequential calls (simulating rapid transitions)', () => {
    it('second call reads the updated currentStatus produced by the first call', async () => {
      const app = await makeApp(APPLICATION_STATUS.APPLIED);
      const actor = makeActor('company');

      await applyTransition(app._id.toString(), APPLICATION_STATUS.SHORTLISTED, actor);
      const finalDoc = await applyTransition(app._id.toString(), APPLICATION_STATUS.OFFERED, actor);

      assert.equal(finalDoc.currentStatus, APPLICATION_STATUS.OFFERED,
        'Final status should be "offered" after two sequential valid transitions');
    });

    it('final document has 2 timeline entries after two transitions', async () => {
      const app = await makeApp(APPLICATION_STATUS.APPLIED);
      const actor = makeActor('company');

      await applyTransition(app._id.toString(), APPLICATION_STATUS.SHORTLISTED, actor);
      const finalDoc = await applyTransition(app._id.toString(), APPLICATION_STATUS.OFFERED, actor);

      assert.equal(finalDoc.timeline.length, 2);
    });

    it('first timeline entry records applied → shortlisted', async () => {
      const app = await makeApp(APPLICATION_STATUS.APPLIED);
      const actor = makeActor('company');

      await applyTransition(app._id.toString(), APPLICATION_STATUS.SHORTLISTED, actor);
      const finalDoc = await applyTransition(app._id.toString(), APPLICATION_STATUS.OFFERED, actor);

      assert.equal(finalDoc.timeline[0].fromStatus, APPLICATION_STATUS.APPLIED);
      assert.equal(finalDoc.timeline[0].toStatus, APPLICATION_STATUS.SHORTLISTED);
    });

    it('second timeline entry records shortlisted → offered', async () => {
      const app = await makeApp(APPLICATION_STATUS.APPLIED);
      const actor = makeActor('company');

      await applyTransition(app._id.toString(), APPLICATION_STATUS.SHORTLISTED, actor);
      const finalDoc = await applyTransition(app._id.toString(), APPLICATION_STATUS.OFFERED, actor);

      assert.equal(finalDoc.timeline[1].fromStatus, APPLICATION_STATUS.SHORTLISTED);
      assert.equal(finalDoc.timeline[1].toStatus, APPLICATION_STATUS.OFFERED);
    });

    it('a third call attempting the now-stale original transition fails correctly', async () => {
      const app = await makeApp(APPLICATION_STATUS.APPLIED);
      const actor = makeActor('company');

      await applyTransition(app._id.toString(), APPLICATION_STATUS.SHORTLISTED, actor);
      await applyTransition(app._id.toString(), APPLICATION_STATUS.OFFERED, actor);

      await assert.rejects(
        () => applyTransition(app._id.toString(), APPLICATION_STATUS.APPLIED, actor),
        (err) => {
          assert.equal(err.code, 'INVALID_TRANSITION',
            'offered → applied is not a valid transition; must read current state, not stale');
          return true;
        },
      );
    });
  });

  // ── Test 6: Field isolation ────────────────────────────────────────────────
  describe('field isolation: eligibilitySnapshot and override are untouched', () => {
    it('eligibilitySnapshot is identical before and after a valid transition', async () => {
      const app = await makeApp(APPLICATION_STATUS.APPLIED);
      const snapshotBefore = JSON.stringify(app.eligibilitySnapshot);

      await applyTransition(
        app._id.toString(),
        APPLICATION_STATUS.SHORTLISTED,
        makeActor(),
      );

      const fromDb = await Application.findById(app._id);
      assert.equal(
        JSON.stringify(fromDb.eligibilitySnapshot),
        snapshotBefore,
        'eligibilitySnapshot must not be modified by applyTransition',
      );
    });
  });

  // ── Test 7: Concurrency — two DIFFERENT valid transitions race ────────────
  // Both calls read currentStatus:'applied', both pass ALLOWED_TRANSITIONS
  // validation, then both race to write. The compare-and-swap filter
  // (currentStatus: 'applied' in the update filter) means exactly one
  // write lands; the other sees no match and throws TRANSITION_CONFLICT.
  describe('concurrency: two different valid transitions from the same source status', () => {
    it('exactly one call succeeds and one throws TRANSITION_CONFLICT', async () => {
      const app = await makeApp(APPLICATION_STATUS.APPLIED);
      const actor = makeActor('company');

      // applied → shortlisted and applied → rejected are both valid.
      // Fire both concurrently — only one can win the CAS write.
      const results = await Promise.allSettled([
        applyTransition(app._id.toString(), APPLICATION_STATUS.SHORTLISTED, actor),
        applyTransition(app._id.toString(), APPLICATION_STATUS.REJECTED, actor),
      ]);

      const succeeded = results.filter((r) => r.status === 'fulfilled');
      const failed    = results.filter((r) => r.status === 'rejected');

      assert.equal(succeeded.length, 1, 'Exactly one call must succeed');
      assert.equal(failed.length,    1, 'Exactly one call must fail');
      assert.equal(failed[0].reason.code,   'TRANSITION_CONFLICT');
      assert.equal(failed[0].reason.status, 409);
    });

    it('the losing call has code TRANSITION_CONFLICT, not INVALID_TRANSITION', async () => {
      const app = await makeApp(APPLICATION_STATUS.APPLIED);
      const actor = makeActor('company');

      const results = await Promise.allSettled([
        applyTransition(app._id.toString(), APPLICATION_STATUS.SHORTLISTED, actor),
        applyTransition(app._id.toString(), APPLICATION_STATUS.REJECTED, actor),
      ]);

      const failed = results.filter((r) => r.status === 'rejected');
      // INVALID_TRANSITION means the static state-machine check failed.
      // TRANSITION_CONFLICT means the CAS missed — a concurrency catch, not a logic error.
      assert.equal(failed[0].reason.code, 'TRANSITION_CONFLICT',
        'Loser must be TRANSITION_CONFLICT, not INVALID_TRANSITION');
    });

    it('DB has exactly one new timeline entry after both calls settle', async () => {
      const app = await makeApp(APPLICATION_STATUS.APPLIED);
      const actor = makeActor('company');

      await Promise.allSettled([
        applyTransition(app._id.toString(), APPLICATION_STATUS.SHORTLISTED, actor),
        applyTransition(app._id.toString(), APPLICATION_STATUS.REJECTED, actor),
      ]);

      const fromDb = await Application.findById(app._id);
      assert.equal(fromDb.timeline.length, 1,
        'Timeline must have exactly one entry — only one transition can have committed');
    });

    it('currentStatus matches the winning transition target', async () => {
      const app = await makeApp(APPLICATION_STATUS.APPLIED);
      const actor = makeActor('company');

      const results = await Promise.allSettled([
        applyTransition(app._id.toString(), APPLICATION_STATUS.SHORTLISTED, actor),
        applyTransition(app._id.toString(), APPLICATION_STATUS.REJECTED, actor),
      ]);

      const winner = results.find((r) => r.status === 'fulfilled').value;
      const fromDb = await Application.findById(app._id);

      assert.equal(fromDb.currentStatus, winner.currentStatus,
        'DB currentStatus must equal the winning call\'s returned currentStatus');
      assert.ok(
        fromDb.currentStatus === APPLICATION_STATUS.SHORTLISTED ||
        fromDb.currentStatus === APPLICATION_STATUS.REJECTED,
        `currentStatus must be one of the two attempted targets, got: ${fromDb.currentStatus}`,
      );
    });
  });

  // ── Test 8: Concurrency — two IDENTICAL valid transitions race ────────────
  // Without CAS, two identical transitions would both succeed and insert
  // two duplicate timeline entries while setting the same currentStatus.
  // With CAS, exactly one write lands; the second sees no match (currentStatus
  // already changed from 'offered' to 'accepted') and gets TRANSITION_CONFLICT.
  describe('concurrency: two identical transitions from the same source status', () => {
    it('exactly one call succeeds and one throws TRANSITION_CONFLICT', async () => {
      const app = await makeApp(APPLICATION_STATUS.OFFERED);
      const actor = makeActor('tnp');

      const results = await Promise.allSettled([
        applyTransition(app._id.toString(), APPLICATION_STATUS.ACCEPTED, actor),
        applyTransition(app._id.toString(), APPLICATION_STATUS.ACCEPTED, actor),
      ]);

      const succeeded = results.filter((r) => r.status === 'fulfilled');
      const failed    = results.filter((r) => r.status === 'rejected');

      assert.equal(succeeded.length, 1, 'Exactly one call must succeed');
      assert.equal(failed.length,    1, 'Exactly one call must fail');
      assert.equal(failed[0].reason.code, 'TRANSITION_CONFLICT');
    });

    it('DB has exactly one timeline entry — no duplicate identical entries', async () => {
      const app = await makeApp(APPLICATION_STATUS.OFFERED);
      const actor = makeActor('tnp');

      await Promise.allSettled([
        applyTransition(app._id.toString(), APPLICATION_STATUS.ACCEPTED, actor),
        applyTransition(app._id.toString(), APPLICATION_STATUS.ACCEPTED, actor),
      ]);

      const fromDb = await Application.findById(app._id);
      assert.equal(fromDb.timeline.length, 1,
        'Without CAS, two identical transitions would insert two duplicate timeline entries');
    });

    it('currentStatus is "accepted" after both calls settle', async () => {
      const app = await makeApp(APPLICATION_STATUS.OFFERED);
      const actor = makeActor('tnp');

      await Promise.allSettled([
        applyTransition(app._id.toString(), APPLICATION_STATUS.ACCEPTED, actor),
        applyTransition(app._id.toString(), APPLICATION_STATUS.ACCEPTED, actor),
      ]);

      const fromDb = await Application.findById(app._id);
      assert.equal(fromDb.currentStatus, APPLICATION_STATUS.ACCEPTED);
    });
  });
});
