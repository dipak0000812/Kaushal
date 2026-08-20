import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { verifyCompany } from '../../src/modules/onboarding/services/companyVerification.service.js';
import { User } from '../../src/modules/auth/models/User.js';
import { CompanyProfile } from '../../src/modules/company/models/CompanyProfile.js';
import { Internship } from '../../src/modules/company/models/Internship.js';
import { ROLES, USER_STATUS, INTERNSHIP_STATUS, INTERNSHIP_MODE } from '../../src/utils/constants.js';

// ─── Infrastructure ───────────────────────────────────────────────────────

let replSet;

before(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replSet.getUri(), { dbName: 'kaushal_verification_test' });
});

after(async () => {
  await mongoose.disconnect();
  await replSet.stop();
});

beforeEach(async () => {
  await Promise.all([
    User.deleteMany({}),
    CompanyProfile.deleteMany({}),
    Internship.deleteMany({}),
  ]);
});

// ─── Fixtures ─────────────────────────────────────────────────────────────

async function createCompanyUser(status = USER_STATUS.PENDING) {
  const user = await User.create({
    name: 'Tech Corp Admin',
    email: `tech_${new mongoose.Types.ObjectId()}@example.com`,
    passwordHash: 'hashed_password_placeholder',
    role: ROLES.COMPANY,
    status,
  });

  const profile = await CompanyProfile.create({
    userId: user._id,
    companyName: 'Tech Corp',
    contactEmail: user.email,
  });

  return { user, profile };
}

async function createInternship(companyProfileId, status = INTERNSHIP_STATUS.PENDING_APPROVAL) {
  return Internship.create({
    companyId: companyProfileId,
    title: 'Software Engineering Intern',
    description: 'Build robust backend services',
    duration: '6 months',
    mode: INTERNSHIP_MODE.HYBRID,
    vacancies: 2,
    lastDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    status,
  });
}

function tnpActor() {
  return { id: new mongoose.Types.ObjectId().toString(), role: ROLES.TNP };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('companyVerification.service — verifyCompany()', () => {

  // ── Test 1: 3 pendingApproval and 1 open posting ─────────────────────────
  describe('company with 3 pendingApproval postings and 1 already-open posting', () => {
    it('verifies the user and transitions all 3 pending postings to open with publishedCount: 3', async () => {
      const { user, profile } = await createCompanyUser(USER_STATUS.PENDING);

      const [p1, p2, p3] = await Promise.all([
        createInternship(profile._id, INTERNSHIP_STATUS.PENDING_APPROVAL),
        createInternship(profile._id, INTERNSHIP_STATUS.PENDING_APPROVAL),
        createInternship(profile._id, INTERNSHIP_STATUS.PENDING_APPROVAL),
      ]);
      const pOpen = await createInternship(profile._id, INTERNSHIP_STATUS.OPEN);

      const result = await verifyCompany(user._id.toString(), tnpActor());

      assert.equal(result.user.status, USER_STATUS.VERIFIED);
      assert.equal(result.publishedCount, 3);

      // Re-fetch all postings to verify DB persistence
      const [dbP1, dbP2, dbP3, dbPOpen, dbUser] = await Promise.all([
        Internship.findById(p1._id),
        Internship.findById(p2._id),
        Internship.findById(p3._id),
        Internship.findById(pOpen._id),
        User.findById(user._id),
      ]);

      assert.equal(dbUser.status, USER_STATUS.VERIFIED);
      assert.equal(dbP1.status, INTERNSHIP_STATUS.OPEN);
      assert.equal(dbP2.status, INTERNSHIP_STATUS.OPEN);
      assert.equal(dbP3.status, INTERNSHIP_STATUS.OPEN);
      assert.equal(dbPOpen.status, INTERNSHIP_STATUS.OPEN);
    });
  });

  // ── Test 2: Zero postings at all ─────────────────────────────────────────
  describe('company with zero postings at all', () => {
    it('verifies cleanly with publishedCount: 0', async () => {
      const { user } = await createCompanyUser(USER_STATUS.PENDING);

      const result = await verifyCompany(user._id.toString(), tnpActor());

      assert.equal(result.user.status, USER_STATUS.VERIFIED);
      assert.equal(result.publishedCount, 0);

      const dbUser = await User.findById(user._id);
      assert.equal(dbUser.status, USER_STATUS.VERIFIED);
    });
  });

  // ── Test 3: Already verified company ─────────────────────────────────────
  describe('company is already verified', () => {
    it('throws CONFLICT / 409 and leaves postings untouched', async () => {
      const { user, profile } = await createCompanyUser(USER_STATUS.VERIFIED);
      const pendingPost = await createInternship(profile._id, INTERNSHIP_STATUS.PENDING_APPROVAL);

      await assert.rejects(
        () => verifyCompany(user._id.toString(), tnpActor()),
        (err) => {
          assert.equal(err.code, 'CONFLICT');
          assert.equal(err.status, 409);
          assert.match(err.message, /already verified/i);
          return true;
        },
      );

      // Verify no changes were committed
      const [dbUser, dbPost] = await Promise.all([
        User.findById(user._id),
        Internship.findById(pendingPost._id),
      ]);
      assert.equal(dbUser.status, USER_STATUS.VERIFIED);
      assert.equal(dbPost.status, INTERNSHIP_STATUS.PENDING_APPROVAL);
    });
  });

  // ── Test 4: User exists but role is 'student' ────────────────────────────
  describe('user exists but role is not company', () => {
    it('throws NOT_FOUND / 404 without leaking user existence', async () => {
      const studentUser = await User.create({
        name: 'John Student',
        email: 'john_student@example.com',
        passwordHash: 'hashed_pw',
        role: ROLES.STUDENT,
        status: USER_STATUS.ACTIVE,
      });

      await assert.rejects(
        () => verifyCompany(studentUser._id.toString(), tnpActor()),
        (err) => {
          assert.equal(err.code, 'NOT_FOUND');
          assert.equal(err.status, 404);
          assert.equal(err.message, 'Company account not found');
          return true;
        },
      );

      const dbStudent = await User.findById(studentUser._id);
      assert.equal(dbStudent.status, USER_STATUS.ACTIVE);
    });
  });

  // ── Test 5: Nonexistent userId ───────────────────────────────────────────
  describe('nonexistent userId', () => {
    it('throws NOT_FOUND / 404', async () => {
      const nonExistentId = new mongoose.Types.ObjectId().toString();

      await assert.rejects(
        () => verifyCompany(nonExistentId, tnpActor()),
        (err) => {
          assert.equal(err.code, 'NOT_FOUND');
          assert.equal(err.status, 404);
          assert.equal(err.message, 'Company account not found');
          return true;
        },
      );
    });
  });

  // ── Test 6: Scope leak test — postings for other companies ───────────────
  describe('scope isolation: other companies postings are not modified', () => {
    it('only auto-publishes postings belonging to the target company', async () => {
      const { user: compA, profile: profA } = await createCompanyUser(USER_STATUS.PENDING);
      const { user: compB, profile: profB } = await createCompanyUser(USER_STATUS.PENDING);

      const postA = await createInternship(profA._id, INTERNSHIP_STATUS.PENDING_APPROVAL);
      const postB1 = await createInternship(profB._id, INTERNSHIP_STATUS.PENDING_APPROVAL);
      const postB2 = await createInternship(profB._id, INTERNSHIP_STATUS.PENDING_APPROVAL);

      const result = await verifyCompany(compA._id.toString(), tnpActor());

      assert.equal(result.publishedCount, 1);

      const [dbCompA, dbCompB, dbPostA, dbPostB1, dbPostB2] = await Promise.all([
        User.findById(compA._id),
        User.findById(compB._id),
        Internship.findById(postA._id),
        Internship.findById(postB1._id),
        Internship.findById(postB2._id),
      ]);

      assert.equal(dbCompA.status, USER_STATUS.VERIFIED);
      assert.equal(dbPostA.status, INTERNSHIP_STATUS.OPEN);

      // Company B must remain untouched
      assert.equal(dbCompB.status, USER_STATUS.PENDING);
      assert.equal(dbPostB1.status, INTERNSHIP_STATUS.PENDING_APPROVAL);
      assert.equal(dbPostB2.status, INTERNSHIP_STATUS.PENDING_APPROVAL);
    });
  });

  // ── Test 7: Transaction rollback ─────────────────────────────────────────
  describe('transaction rollback on mid-operation failure', () => {
    it('rolls back the User status update if Internship update fails', async () => {
      const { user, profile } = await createCompanyUser(USER_STATUS.PENDING);
      const post = await createInternship(profile._id, INTERNSHIP_STATUS.PENDING_APPROVAL);

      // Temporarily mock Internship.updateMany to throw an error
      const originalUpdateMany = Internship.updateMany;
      Internship.updateMany = async () => {
        throw new Error('Simulated database write error during internship update');
      };

      try {
        await assert.rejects(
          () => verifyCompany(user._id.toString(), tnpActor()),
          (err) => {
            assert.match(err.message, /Simulated database write error/);
            return true;
          },
        );

        // Verify that User.status was rolled back to PENDING and posting remains PENDING_APPROVAL
        const [dbUser, dbPost] = await Promise.all([
          User.findById(user._id),
          Internship.findById(post._id),
        ]);

        assert.equal(
          dbUser.status,
          USER_STATUS.PENDING,
          'User status must be rolled back to pending if transaction aborts',
        );
        assert.equal(
          dbPost.status,
          INTERNSHIP_STATUS.PENDING_APPROVAL,
          'Posting status must remain pendingApproval',
        );
      } finally {
        Internship.updateMany = originalUpdateMany;
      }
    });
  });

  // ── Edge Case: Company User without Profile ──────────────────────────────
  describe('edge case: company user without a profile document', () => {
    it('verifies the user account successfully and returns publishedCount: 0', async () => {
      const userWithoutProfile = await User.create({
        name: 'Orphan Company Admin',
        email: 'orphan@example.com',
        passwordHash: 'hashed_pw',
        role: ROLES.COMPANY,
        status: USER_STATUS.PENDING,
      });

      const result = await verifyCompany(userWithoutProfile._id.toString(), tnpActor());

      assert.equal(result.user.status, USER_STATUS.VERIFIED);
      assert.equal(result.publishedCount, 0);

      const dbUser = await User.findById(userWithoutProfile._id);
      assert.equal(dbUser.status, USER_STATUS.VERIFIED);
    });
  });
});
