/**
 * Model layer unit tests.
 *
 * These tests verify:
 *   - all model files import without errors
 *   - no duplicate Mongoose model registration
 *   - schema structure (required fields, defaults, enums)
 *   - Mongoose validation behavior (using Model.validate() — no live DB needed)
 *   - index definitions
 *   - constant correctness
 *   - ALLOWED_TRANSITIONS completeness
 *
 * None of these tests require a live MongoDB instance.
 * Integration tests (actual DB writes) are deferred until MongoDB is available.
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';

// ── Domain constants ──────────────────────────────────────────────────────
import {
  ROLES,
  USER_STATUS,
  INTERNSHIP_STATUS,
  INTERNSHIP_MODE,
  INTERNSHIP_SOURCE,
  OFF_CAMPUS_VERIFICATION_STATUS,
  APPLICATION_STATUS,
  TERMINAL_STATUSES,
  ACTIVE_STATUSES,
  ALLOWED_TRANSITIONS,
  MENTOR_ASSIGNMENT_STATUS,
  EVIDENCE_TYPE,
} from '../../src/utils/constants.js';

// ── Models ────────────────────────────────────────────────────────────────
import { User } from '../../src/modules/auth/models/User.js';
import { InviteToken } from '../../src/modules/onboarding/models/InviteToken.js';
import { StudentProfile } from '../../src/modules/student/models/StudentProfile.js';
import { CompanyProfile } from '../../src/modules/company/models/CompanyProfile.js';
import { Internship } from '../../src/modules/company/models/Internship.js';
import { Application } from '../../src/modules/student/models/Application.js';
import { MentorAssignment } from '../../src/modules/faculty/models/MentorAssignment.js';
import { ProgressLog } from '../../src/modules/student/models/ProgressLog.js';
import { Dismissal } from '../../src/modules/risk/models/Dismissal.js';

// ── Helpers ───────────────────────────────────────────────────────────────
function fakeId() {
  return new mongoose.Types.ObjectId();
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('Domain constants (utils/constants.js)', () => {
  describe('ROLES', () => {
    it('exports all 5 roles', () => {
      assert.equal(ROLES.STUDENT, 'student');
      assert.equal(ROLES.COMPANY, 'company');
      assert.equal(ROLES.FACULTY, 'faculty');
      assert.equal(ROLES.HOD, 'hod');
      assert.equal(ROLES.TNP, 'tnp');
      assert.equal(Object.keys(ROLES).length, 5);
    });

    it('is frozen (immutable)', () => {
      assert.ok(Object.isFrozen(ROLES));
    });
  });

  describe('USER_STATUS', () => {
    it('has active, pending, verified', () => {
      assert.equal(USER_STATUS.ACTIVE, 'active');
      assert.equal(USER_STATUS.PENDING, 'pending');
      assert.equal(USER_STATUS.VERIFIED, 'verified');
    });
  });

  describe('INTERNSHIP_SOURCE', () => {
    it('has campus and off_campus', () => {
      assert.equal(INTERNSHIP_SOURCE.CAMPUS, 'campus');
      assert.equal(INTERNSHIP_SOURCE.OFF_CAMPUS, 'off_campus');
    });
  });

  describe('OFF_CAMPUS_VERIFICATION_STATUS', () => {
    it('has pendingVerification, verified, rejected', () => {
      assert.equal(OFF_CAMPUS_VERIFICATION_STATUS.PENDING, 'pendingVerification');
      assert.equal(OFF_CAMPUS_VERIFICATION_STATUS.VERIFIED, 'verified');
      assert.equal(OFF_CAMPUS_VERIFICATION_STATUS.REJECTED, 'rejected');
    });
  });

  describe('APPLICATION_STATUS', () => {
    it('has all 12 documented statuses', () => {
      const expected = [
        'applied', 'shortlisted', 'offered', 'accepted', 'tnpVerified',
        'mentorPending', 'mentorAssigned', 'inProgress', 'completed',
        'rejected', 'withdrawn', 'cancelled',
      ];
      assert.equal(Object.values(APPLICATION_STATUS).length, expected.length);
      for (const s of expected) {
        assert.ok(Object.values(APPLICATION_STATUS).includes(s), `Missing status: ${s}`);
      }
    });
  });

  describe('TERMINAL_STATUSES', () => {
    it('contains exactly 4 terminal statuses', () => {
      assert.deepEqual(
        [...TERMINAL_STATUSES].sort(),
        ['cancelled', 'completed', 'rejected', 'withdrawn'],
      );
    });
  });

  describe('ACTIVE_STATUSES', () => {
    it('does not include applied or shortlisted (terminal-negative states for vacancy count)', () => {
      // API Contract Section 2: "Filled" = applications in {offered, accepted, tnpVerified,
      // mentorPending, mentorAssigned, inProgress, completed}
      // 'completed' IS in ACTIVE_STATUSES intentionally — a completed internship still counts
      // against vacancies for fill purposes. Only terminal-negative states are excluded.
      assert.ok(!ACTIVE_STATUSES.includes('applied'));
      assert.ok(!ACTIVE_STATUSES.includes('shortlisted'));
      assert.ok(!ACTIVE_STATUSES.includes('rejected'));
      assert.ok(!ACTIVE_STATUSES.includes('withdrawn'));
      assert.ok(!ACTIVE_STATUSES.includes('cancelled'));
    });

    it('includes completed (API Contract: filled = non-terminal-negative applications)', () => {
      // API Contract Section 2 explicitly includes 'completed' in the filled-count set.
      assert.ok(ACTIVE_STATUSES.includes('completed'));
    });
  });

  describe('ALLOWED_TRANSITIONS', () => {
    it('has an entry for every APPLICATION_STATUS value', () => {
      for (const status of Object.values(APPLICATION_STATUS)) {
        assert.ok(
          status in ALLOWED_TRANSITIONS,
          `ALLOWED_TRANSITIONS missing entry for: ${status}`,
        );
      }
    });

    it('terminal statuses have empty transition arrays', () => {
      for (const s of TERMINAL_STATUSES) {
        assert.deepEqual(ALLOWED_TRANSITIONS[s], [], `${s} should have no transitions`);
      }
    });

    it('applied can transition to shortlisted, rejected, cancelled', () => {
      assert.deepEqual(
        [...ALLOWED_TRANSITIONS.applied].sort(),
        ['cancelled', 'rejected', 'shortlisted'],
      );
    });

    it('offered can transition to accepted, withdrawn, cancelled', () => {
      assert.deepEqual(
        [...ALLOWED_TRANSITIONS.offered].sort(),
        ['accepted', 'cancelled', 'withdrawn'],
      );
    });

    it('accepted can revert to offered (T&P reject-offer, fix #1)', () => {
      assert.ok(ALLOWED_TRANSITIONS.accepted.includes('offered'));
    });

    it('mentorPending can revert to tnpVerified (faculty reject, fix #2)', () => {
      assert.ok(ALLOWED_TRANSITIONS.mentorPending.includes('tnpVerified'));
    });

    it('completed is terminal (no transitions out)', () => {
      assert.deepEqual(ALLOWED_TRANSITIONS.completed, []);
    });
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('Model imports — no duplicate registration, no circular deps', () => {
  it('all 9 models load without throwing', () => {
    const models = [User, InviteToken, StudentProfile, CompanyProfile,
      Internship, Application, MentorAssignment, ProgressLog, Dismissal];
    for (const m of models) {
      assert.ok(m, `Model is falsy: ${m}`);
      assert.ok(typeof m.modelName === 'string', `Missing modelName on: ${m}`);
    }
  });

  it('Mongoose model registry has exactly 9 models', () => {
    const registered = Object.keys(mongoose.models);
    assert.equal(registered.length, 9, `Expected 9 models, got: ${registered.join(', ')}`);
  });

  it('model names match expected values', () => {
    const expected = [
      'User', 'InviteToken', 'StudentProfile', 'CompanyProfile',
      'Internship', 'Application', 'MentorAssignment', 'ProgressLog', 'Dismissal',
    ];
    for (const name of expected) {
      assert.ok(name in mongoose.models, `Mongoose.models missing: ${name}`);
    }
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('User model', () => {
  it('rejects missing required fields', async () => {
    const u = new User({});
    const err = await u.validate().catch((e) => e);
    assert.ok(err instanceof mongoose.Error.ValidationError);
    assert.ok(err.errors.name, 'name should be required');
    assert.ok(err.errors.email, 'email should be required');
    assert.ok(err.errors.passwordHash, 'passwordHash should be required');
    assert.ok(err.errors.role, 'role should be required');
  });

  it('rejects invalid role', async () => {
    const u = new User({ name: 'A', email: 'a@b.com', passwordHash: 'x', role: 'admin' });
    const err = await u.validate().catch((e) => e);
    assert.ok(err.errors.role);
  });

  it('accepts all valid roles', async () => {
    for (const role of Object.values(ROLES)) {
      const u = new User({ name: 'A', email: `${role}@b.com`, passwordHash: 'x', role });
      const err = await u.validate().catch((e) => e);
      if (err) {
        // Only fail if the error is on 'role'
        assert.ok(!err.errors?.role, `Role '${role}' should be valid`);
      }
    }
  });

  it('defaults status to active', () => {
    const u = new User({ name: 'A', email: 'a@b.com', passwordHash: 'x', role: ROLES.STUDENT });
    assert.equal(u.status, USER_STATUS.ACTIVE);
  });

  it('rejects invalid email format', async () => {
    const u = new User({ name: 'A', email: 'not-an-email', passwordHash: 'x', role: ROLES.STUDENT });
    const err = await u.validate().catch((e) => e);
    assert.ok(err?.errors?.email, 'Should reject malformed email');
  });

  it('passwordHash has select:false in schema', () => {
    const pwPaths = User.schema.paths.passwordHash;
    assert.equal(pwPaths.options.select, false);
  });

  it('role is immutable in schema', () => {
    const rolePath = User.schema.paths.role;
    assert.equal(rolePath.options.immutable, true);
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('InviteToken model', () => {
  it('requires companyName, contactEmail, token, expiresAt', async () => {
    const t = new InviteToken({});
    const err = await t.validate().catch((e) => e);
    assert.ok(err.errors.companyName);
    assert.ok(err.errors.contactEmail);
    assert.ok(err.errors.token);
    assert.ok(err.errors.expiresAt);
  });

  it('defaults usedAt to null', () => {
    const t = new InviteToken({ companyName: 'X', contactEmail: 'a@b.com', token: 'abc', expiresAt: new Date() });
    assert.equal(t.usedAt, null);
  });

  it('token field has unique index in schema', () => {
    const tokenPath = InviteToken.schema.paths.token;
    assert.equal(tokenPath.options.unique, true);
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('StudentProfile model', () => {
  it('requires userId, department, year, cgpa', async () => {
    const s = new StudentProfile({});
    const err = await s.validate().catch((e) => e);
    assert.ok(err.errors.userId);
    assert.ok(err.errors.department);
    assert.ok(err.errors.year);
    assert.ok(err.errors.cgpa);
  });

  it('defaults activeBacklogs to 0, skills/certs to empty arrays', () => {
    const s = new StudentProfile({
      userId: fakeId(), department: 'CSE', year: 2, cgpa: 7.5,
    });
    assert.equal(s.activeBacklogs, 0);
    assert.deepEqual(s.skills, []);
    assert.deepEqual(s.certifications, []);
  });

  it('rejects cgpa > 10', async () => {
    const s = new StudentProfile({ userId: fakeId(), department: 'CSE', year: 2, cgpa: 11 });
    const err = await s.validate().catch((e) => e);
    assert.ok(err?.errors?.cgpa, 'Should reject cgpa > 10');
  });

  it('rejects negative activeBacklogs', async () => {
    const s = new StudentProfile({ userId: fakeId(), department: 'CSE', year: 2, cgpa: 7, activeBacklogs: -1 });
    const err = await s.validate().catch((e) => e);
    assert.ok(err?.errors?.activeBacklogs);
  });

  it('userId has unique index', () => {
    const path = StudentProfile.schema.paths.userId;
    assert.equal(path.options.unique, true);
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('CompanyProfile model', () => {
  it('requires userId, companyName, contactEmail', async () => {
    const c = new CompanyProfile({});
    const err = await c.validate().catch((e) => e);
    assert.ok(err.errors.userId);
    assert.ok(err.errors.companyName);
    assert.ok(err.errors.contactEmail);
  });

  it('userId has unique index', () => {
    const path = CompanyProfile.schema.paths.userId;
    assert.equal(path.options.unique, true);
  });

  it('verification state is NOT on CompanyProfile (lives on User.status)', () => {
    // CompanyProfile must NOT have a 'status' or 'verified' field
    assert.ok(!CompanyProfile.schema.paths.status, 'CompanyProfile should not have status field');
    assert.ok(!CompanyProfile.schema.paths.verified, 'CompanyProfile should not have verified field');
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('Internship model', () => {
  it('requires title, description, duration, mode, vacancies, lastDate', async () => {
    const i = new Internship({});
    const err = await i.validate().catch((e) => e);
    assert.ok(err.errors.title);
    assert.ok(err.errors.description);
    assert.ok(err.errors.duration);
    assert.ok(err.errors.mode);
    assert.ok(err.errors.vacancies);
    assert.ok(err.errors.lastDate);
  });

  it('defaults status to pendingApproval and source to campus', () => {
    const i = new Internship({
      companyId: fakeId(), title: 'T', description: 'D',
      duration: '2mo', mode: 'remote', vacancies: 1, lastDate: new Date(),
    });
    assert.equal(i.status, INTERNSHIP_STATUS.PENDING_APPROVAL);
    assert.equal(i.source, INTERNSHIP_SOURCE.CAMPUS);
  });

  it('accepts valid off_campus internship with externalCompanyName and offCampusVerification', async () => {
    const studentProfileId = fakeId();
    const i = new Internship({
      source: INTERNSHIP_SOURCE.OFF_CAMPUS,
      externalCompanyName: 'Acme External Corp',
      title: 'Off-campus Software Engineer Intern',
      description: 'Full stack development',
      duration: '6 months',
      mode: 'remote',
      vacancies: 1,
      lastDate: new Date(),
      offCampusVerification: {
        status: OFF_CAMPUS_VERIFICATION_STATUS.PENDING,
        submittedBy: studentProfileId,
        submittedAt: new Date(),
        evidenceUrl: 'https://docs.google.com/offer-letter.pdf',
      },
    });
    const err = await i.validate().catch((e) => e);
    assert.equal(err, undefined, 'Off-campus internship should pass schema validation');
    assert.equal(i.source, 'off_campus');
    assert.equal(i.externalCompanyName, 'Acme External Corp');
    assert.equal(i.offCampusVerification.status, 'pendingVerification');
  });

  it('rejects invalid source enum value', async () => {
    const i = new Internship({
      source: 'invalid_source',
      title: 'T', description: 'D',
      duration: '2mo', mode: 'remote', vacancies: 1, lastDate: new Date(),
    });
    const err = await i.validate().catch((e) => e);
    assert.ok(err?.errors?.source, 'Should reject invalid source');
  });

  it('rejects invalid mode', async () => {
    const i = new Internship({
      companyId: fakeId(), title: 'T', description: 'D',
      duration: '2mo', mode: 'flying', vacancies: 1, lastDate: new Date(),
    });
    const err = await i.validate().catch((e) => e);
    assert.ok(err?.errors?.mode);
  });

  it('criteria is an embedded object with no _id', () => {
    const i = new Internship({
      companyId: fakeId(), title: 'T', description: 'D',
      duration: '2mo', mode: 'remote', vacancies: 1, lastDate: new Date(),
    });
    assert.equal(typeof i.criteria, 'object');
    assert.ok(!i.criteria._id, 'criteria should not have _id');
  });

  it('criteria defaults to empty arrays for skills/certs/departments', () => {
    const i = new Internship({
      companyId: fakeId(), title: 'T', description: 'D',
      duration: '2mo', mode: 'remote', vacancies: 1, lastDate: new Date(),
    });
    assert.deepEqual(i.criteria.requiredSkills, []);
    assert.deepEqual(i.criteria.requiredCerts, []);
    assert.deepEqual(i.criteria.departments, []);
  });

  it('does NOT have a filledAt or isFilled field (computed not stored)', () => {
    assert.ok(!Internship.schema.paths.filledAt, 'Internship should not have filledAt');
    assert.ok(!Internship.schema.paths.isFilled, 'Internship should not have isFilled');
  });

  it('has compound index on {companyId, status}', () => {
    const indexes = Internship.schema.indexes();
    const hasCompound = indexes.some(([spec]) =>
      spec.companyId === 1 && spec.status === 1,
    );
    assert.ok(hasCompound, 'Missing compound index on {companyId, status}');
  });

  it('has index on source and offCampusVerification.status', () => {
    const indexes = Internship.schema.indexes();
    const hasSource = indexes.some(([spec]) => spec.source === 1);
    const hasStatus = indexes.some(([spec]) => spec['offCampusVerification.status'] === 1);
    assert.ok(hasSource, 'Missing index on source');
    assert.ok(hasStatus, 'Missing index on offCampusVerification.status');
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('Application model', () => {
  function validSnapshot() {
    return {
      eligible: true,
      checks: [{ criterion: 'CGPA', required: 7, actual: 8, pass: true, reason: null }],
      computedAt: new Date(),
    };
  }

  it('requires studentId, internshipId, eligibilitySnapshot', async () => {
    const a = new Application({});
    const err = await a.validate().catch((e) => e);
    assert.ok(err.errors.studentId);
    assert.ok(err.errors.internshipId);
    assert.ok(err.errors['eligibilitySnapshot.eligible'] || err.errors.eligibilitySnapshot);
  });

  it('defaults currentStatus to applied', () => {
    const a = new Application({
      studentId: fakeId(), internshipId: fakeId(),
      eligibilitySnapshot: validSnapshot(),
    });
    assert.equal(a.currentStatus, APPLICATION_STATUS.APPLIED);
  });

  it('defaults ppoOffered to false', () => {
    const a = new Application({
      studentId: fakeId(), internshipId: fakeId(),
      eligibilitySnapshot: validSnapshot(),
    });
    assert.equal(a.ppoOffered, false);
  });

  it('defaults override to null', () => {
    const a = new Application({
      studentId: fakeId(), internshipId: fakeId(),
      eligibilitySnapshot: validSnapshot(),
    });
    assert.equal(a.override, null);
  });

  it('defaults timeline to empty array', () => {
    const a = new Application({
      studentId: fakeId(), internshipId: fakeId(),
      eligibilitySnapshot: validSnapshot(),
    });
    assert.deepEqual(a.timeline, []);
  });

  it('rejects invalid currentStatus', async () => {
    const a = new Application({
      studentId: fakeId(), internshipId: fakeId(),
      eligibilitySnapshot: validSnapshot(),
      currentStatus: 'flying',
    });
    const err = await a.validate().catch((e) => e);
    assert.ok(err?.errors?.currentStatus);
  });

  it('stores eligibilitySnapshot with eligible:false (submission never server-blocked, fix #2)', () => {
    const a = new Application({
      studentId: fakeId(), internshipId: fakeId(),
      eligibilitySnapshot: { eligible: false, checks: [], computedAt: new Date() },
    });
    assert.equal(a.eligibilitySnapshot.eligible, false);
  });

  it('does NOT have riskLevel or riskScore fields (risk is computed live)', () => {
    assert.ok(!Application.schema.paths.riskLevel, 'Application should not have riskLevel');
    assert.ok(!Application.schema.paths.riskScore, 'Application should not have riskScore');
  });

  it('has partial unique index on {studentId, internshipId}', () => {
    const indexes = Application.schema.indexes();
    const hasPartialUnique = indexes.some(([spec, opts]) =>
      spec.studentId === 1 &&
      spec.internshipId === 1 &&
      opts.unique === true &&
      opts.partialFilterExpression !== undefined,
    );
    assert.ok(hasPartialUnique, 'Missing partial unique index on {studentId, internshipId}');
  });

  it('has index on {internshipId, currentStatus} for vacancy fill count', () => {
    const indexes = Application.schema.indexes();
    const hasIndex = indexes.some(([spec]) =>
      spec.internshipId === 1 && spec.currentStatus === 1,
    );
    assert.ok(hasIndex, 'Missing index on {internshipId, currentStatus}');
  });

  it('has index on {studentId, currentStatus}', () => {
    const indexes = Application.schema.indexes();
    const hasIndex = indexes.some(([spec]) =>
      spec.studentId === 1 && spec.currentStatus === 1,
    );
    assert.ok(hasIndex, 'Missing index on {studentId, currentStatus}');
  });

  it('timeline entries do not have _id', () => {
    const a = new Application({
      studentId: fakeId(), internshipId: fakeId(),
      eligibilitySnapshot: validSnapshot(),
      timeline: [{
        fromStatus: null, toStatus: 'applied',
        actorId: fakeId(), actorRole: 'student', at: new Date(),
      }],
    });
    assert.ok(!a.timeline[0]._id, 'timeline entries should not have _id');
  });

  it('eligibilitySnapshot checks do not have _id', () => {
    const a = new Application({
      studentId: fakeId(), internshipId: fakeId(),
      eligibilitySnapshot: {
        eligible: true,
        checks: [{ criterion: 'CGPA', required: 7, actual: 8, pass: true, reason: null }],
        computedAt: new Date(),
      },
    });
    assert.ok(!a.eligibilitySnapshot.checks[0]._id, 'checks should not have _id');
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('MentorAssignment model', () => {
  it('requires applicationId and facultyId', async () => {
    const m = new MentorAssignment({});
    const err = await m.validate().catch((e) => e);
    assert.ok(err.errors.applicationId);
    assert.ok(err.errors.facultyId);
  });

  it('defaults status to pending', () => {
    const m = new MentorAssignment({ applicationId: fakeId(), facultyId: fakeId() });
    assert.equal(m.status, MENTOR_ASSIGNMENT_STATUS.PENDING);
  });

  it('rejects invalid status', async () => {
    const m = new MentorAssignment({ applicationId: fakeId(), facultyId: fakeId(), status: 'flying' });
    const err = await m.validate().catch((e) => e);
    assert.ok(err?.errors?.status);
  });

  it('defaults rejectReason to null', () => {
    const m = new MentorAssignment({ applicationId: fakeId(), facultyId: fakeId() });
    assert.equal(m.rejectReason, null);
  });

  it('has partial unique index on {applicationId} where status IN {pending, accepted}', () => {
    const indexes = MentorAssignment.schema.indexes();
    const hasPartialUnique = indexes.some(([spec, opts]) =>
      spec.applicationId === 1 &&
      opts.unique === true &&
      opts.partialFilterExpression !== undefined,
    );
    assert.ok(hasPartialUnique, 'Missing partial unique index on applicationId');
  });

  it('has compound index on {facultyId, status}', () => {
    const indexes = MentorAssignment.schema.indexes();
    const hasIndex = indexes.some(([spec]) =>
      spec.facultyId === 1 && spec.status === 1,
    );
    assert.ok(hasIndex, 'Missing index on {facultyId, status}');
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('ProgressLog model', () => {
  it('requires applicationId, weekLabel, description', async () => {
    const p = new ProgressLog({});
    const err = await p.validate().catch((e) => e);
    assert.ok(err.errors.applicationId);
    assert.ok(err.errors.weekLabel);
    assert.ok(err.errors.description);
  });

  it('defaults verified to false', () => {
    const p = new ProgressLog({ applicationId: fakeId(), weekLabel: 'Week 1', description: 'Did work' });
    assert.equal(p.verified, false);
  });

  it('defaults verifiedBy and verifiedAt to null', () => {
    const p = new ProgressLog({ applicationId: fakeId(), weekLabel: 'Week 1', description: 'Did work' });
    assert.equal(p.verifiedBy, null);
    assert.equal(p.verifiedAt, null);
  });

  it('rejects invalid evidence type', async () => {
    const p = new ProgressLog({
      applicationId: fakeId(), weekLabel: 'W1', description: 'D',
      evidence: { type: 'video', value: 'url' },
    });
    const err = await p.validate().catch((e) => e);
    assert.ok(err?.errors?.['evidence.type']);
  });

  it('accepts valid evidence types', async () => {
    for (const type of Object.values(EVIDENCE_TYPE)) {
      const p = new ProgressLog({
        applicationId: fakeId(), weekLabel: 'W1', description: 'D',
        evidence: { type, value: 'some-value' },
      });
      const err = await p.validate().catch((e) => e);
      assert.ok(!err?.errors?.['evidence.type'], `Type '${type}' should be valid`);
    }
  });

  it('has index on {applicationId, createdAt}', () => {
    const indexes = ProgressLog.schema.indexes();
    const hasIndex = indexes.some(([spec]) =>
      spec.applicationId === 1 && spec.createdAt === 1,
    );
    assert.ok(hasIndex, 'Missing index on {applicationId, createdAt}');
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('Dismissal model', () => {
  it('requires applicationId and dismissedBy', async () => {
    const d = new Dismissal({});
    const err = await d.validate().catch((e) => e);
    assert.ok(err.errors.applicationId);
    assert.ok(err.errors.dismissedBy);
  });

  it('defaults note to null', () => {
    const d = new Dismissal({ applicationId: fakeId(), dismissedBy: fakeId() });
    assert.equal(d.note, null);
  });

  it('does NOT have riskLevel or signals fields (risk is never persisted)', () => {
    assert.ok(!Dismissal.schema.paths.riskLevel, 'Dismissal should not have riskLevel');
    assert.ok(!Dismissal.schema.paths.signals, 'Dismissal should not have signals');
  });

  it('has index on {applicationId, dismissedAt}', () => {
    const indexes = Dismissal.schema.indexes();
    const hasIndex = indexes.some(([spec]) =>
      spec.applicationId === 1 && spec.dismissedAt !== undefined,
    );
    assert.ok(hasIndex, 'Missing index on {applicationId, dismissedAt}');
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('Foundation tests still pass (regression)', () => {
  it('API_PREFIX is still /api/v1', async () => {
    const { API_PREFIX } = await import('../../src/core/constants.js');
    assert.equal(API_PREFIX, '/api/v1');
  });
});
