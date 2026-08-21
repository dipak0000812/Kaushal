import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

import {
  ROLES,
  USER_STATUS,
  APPLICATION_STATUS,
  MENTOR_ASSIGNMENT_STATUS,
  EVIDENCE_TYPE,
} from '../../src/utils/constants.js';

import { User } from '../../src/modules/auth/models/User.js';
import { StudentProfile } from '../../src/modules/student/models/StudentProfile.js';
import { CompanyProfile } from '../../src/modules/company/models/CompanyProfile.js';
import { Internship } from '../../src/modules/company/models/Internship.js';
import { Application } from '../../src/modules/student/models/Application.js';
import { MentorAssignment } from '../../src/modules/faculty/models/MentorAssignment.js';
import { ProgressLog } from '../../src/modules/student/models/ProgressLog.js';
import { Dismissal } from '../../src/modules/risk/models/Dismissal.js';

import {
  getLiveRiskForApplication,
  getLiveRiskForApplications,
  dismissRiskFlag,
} from '../../src/modules/risk/services/risk.service.js';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

let replSet;

before(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const uri = replSet.getUri();
  await mongoose.connect(uri, { dbName: 'kaushal_risk_service_test' });
});

after(async () => {
  await mongoose.disconnect();
  await replSet.stop();
});

beforeEach(async () => {
  await Promise.all([
    User.deleteMany({}),
    StudentProfile.deleteMany({}),
    CompanyProfile.deleteMany({}),
    Internship.deleteMany({}),
    Application.deleteMany({}),
    MentorAssignment.deleteMany({}),
    ProgressLog.deleteMany({}),
    Dismissal.deleteMany({}),
  ]);
});

// ── Helpers to setup baseline entities ──────────────────────────────────────

async function createBaseEntities() {
  const facultyUser = await User.create({
    name: 'Prof. Ramesh Sharma',
    email: 'ramesh@faculty.demo',
    passwordHash: 'hashed_password_123',
    role: ROLES.FACULTY,
    status: USER_STATUS.ACTIVE,
  });

  const otherFacultyUser = await User.create({
    name: 'Prof. Anita Desai',
    email: 'anita@faculty.demo',
    passwordHash: 'hashed_password_123',
    role: ROLES.FACULTY,
    status: USER_STATUS.ACTIVE,
  });

  const studentUser = await User.create({
    name: 'Aarav Mehta',
    email: 'aarav@student.demo',
    passwordHash: 'hashed_password_123',
    role: ROLES.STUDENT,
    status: USER_STATUS.ACTIVE,
  });

  const studentProfile = await StudentProfile.create({
    userId: studentUser._id,
    department: 'Computer Science',
    year: 4,
    cgpa: 9.0,
  });

  const companyUser = await User.create({
    name: 'Northbridge Systems',
    email: 'contact@northbridge.demo',
    passwordHash: 'hashed_password_123',
    role: ROLES.COMPANY,
    status: USER_STATUS.VERIFIED,
  });

  const companyProfile = await CompanyProfile.create({
    userId: companyUser._id,
    companyName: 'Northbridge Systems',
    contactEmail: 'contact@northbridge.demo',
  });

  const internship = await Internship.create({
    companyId: companyProfile._id,
    title: 'Full Stack Engineer Intern',
    description: 'Node.js & React engineering',
    duration: '6 months',
    mode: 'remote',
    vacancies: 2,
    lastDate: new Date(Date.now() + 30 * MS_PER_DAY),
  });

  const application = await Application.create({
    studentId: studentProfile._id,
    internshipId: internship._id,
    currentStatus: APPLICATION_STATUS.IN_PROGRESS,
    eligibilitySnapshot: {
      eligible: true,
      checks: [{ criterion: 'DEPARTMENT', required: ['Computer Science'], actual: 'Computer Science', pass: true, reason: null }],
      computedAt: new Date(),
    },
  });

  return {
    facultyUser,
    otherFacultyUser,
    studentUser,
    studentProfile,
    companyUser,
    companyProfile,
    internship,
    application,
  };
}

describe('risk.service — getLiveRiskForApplication()', () => {
  it('throws 404 NOT_FOUND if application does not exist', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    await assert.rejects(
      async () => {
        await getLiveRiskForApplication(fakeId);
      },
      (err) => {
        assert.equal(err.code, 'NOT_FOUND');
        assert.equal(err.status, 404);
        return true;
      },
    );
  });

  it('computes high risk when no progress logs exist and time has passed', async () => {
    const { application, facultyUser } = await createBaseEntities();
    const now = new Date('2026-08-20T12:00:00Z');
    const assignmentStart = new Date(now.getTime() - 20 * MS_PER_DAY);

    await MentorAssignment.create({
      applicationId: application._id,
      facultyId: facultyUser._id,
      status: MENTOR_ASSIGNMENT_STATUS.ACCEPTED,
      createdAt: assignmentStart,
    });

    const result = await getLiveRiskForApplication(application._id, { now });
    assert.equal(result.riskLevel, 'high');
    assert.equal(result.suppressed, false);
    assert.ok(result.signals.length >= 2);
    assert.ok(result.signals.some((s) => s.includes('No progress log submitted in 20 days')));
    assert.ok(result.signals.some((s) => s.includes('20 days since last mentor interaction')));
  });

  it('computes low risk for healthy progress logs with evidence and verified interaction', async () => {
    const { application, facultyUser } = await createBaseEntities();
    const now = new Date('2026-08-20T12:00:00Z');
    const assignmentStart = new Date(now.getTime() - 21 * MS_PER_DAY);

    await MentorAssignment.create({
      applicationId: application._id,
      facultyId: facultyUser._id,
      status: MENTOR_ASSIGNMENT_STATUS.ACCEPTED,
      createdAt: assignmentStart,
    });

    // Create 3 logs in prior window, 3 logs in recent window with evidence & mentor verification
    await ProgressLog.create([
      {
        applicationId: application._id,
        weekLabel: 'Week 1',
        description: 'Setup and repo onboarding',
        evidence: { type: EVIDENCE_TYPE.LINK, value: 'https://github.com/org/repo/pull/1' },
        verified: true,
        verifiedBy: facultyUser._id,
        verifiedAt: new Date(now.getTime() - 10 * MS_PER_DAY),
        createdAt: new Date(now.getTime() - 10 * MS_PER_DAY),
      },
      {
        applicationId: application._id,
        weekLabel: 'Week 2',
        description: 'API endpoints implemented',
        evidence: { type: EVIDENCE_TYPE.LINK, value: 'https://github.com/org/repo/pull/2' },
        verified: true,
        verifiedBy: facultyUser._id,
        verifiedAt: new Date(now.getTime() - 4 * MS_PER_DAY),
        createdAt: new Date(now.getTime() - 4 * MS_PER_DAY),
      },
      {
        applicationId: application._id,
        weekLabel: 'Week 3',
        description: 'Unit testing and verification',
        evidence: { type: EVIDENCE_TYPE.TEXT, value: 'https://docs.google.com/doc/1' },
        verified: true,
        verifiedBy: facultyUser._id,
        verifiedAt: new Date(now.getTime() - 1 * MS_PER_DAY),
        createdAt: new Date(now.getTime() - 1 * MS_PER_DAY),
      },
    ]);

    const result = await getLiveRiskForApplication(application._id, { now });
    assert.equal(result.riskLevel, 'low');
    assert.equal(result.signals.length, 0);
    assert.equal(result.suppressed, false);
  });

  it('triggers medium risk when only mentor interaction gap fires (> 14 days)', async () => {
    const { application, facultyUser } = await createBaseEntities();
    const now = new Date('2026-08-20T12:00:00Z');
    const assignmentStart = new Date(now.getTime() - 25 * MS_PER_DAY);

    await MentorAssignment.create({
      applicationId: application._id,
      facultyId: facultyUser._id,
      status: MENTOR_ASSIGNMENT_STATUS.ACCEPTED,
      createdAt: assignmentStart,
    });

    // Recent progress logs exist (submitted 2 days ago with evidence), but mentor last verified 18 days ago
    await ProgressLog.create([
      {
        applicationId: application._id,
        weekLabel: 'Week 1',
        description: 'Initial log',
        evidence: { type: EVIDENCE_TYPE.LINK, value: 'https://github.com/pr/1' },
        verified: true,
        verifiedBy: facultyUser._id,
        verifiedAt: new Date(now.getTime() - 18 * MS_PER_DAY),
        createdAt: new Date(now.getTime() - 18 * MS_PER_DAY),
      },
      {
        applicationId: application._id,
        weekLabel: 'Week 3',
        description: 'Recent log',
        evidence: { type: EVIDENCE_TYPE.LINK, value: 'https://github.com/pr/3' },
        verified: false,
        createdAt: new Date(now.getTime() - 2 * MS_PER_DAY),
      },
    ]);

    const result = await getLiveRiskForApplication(application._id, { now });
    assert.equal(result.riskLevel, 'medium');
    assert.equal(result.signals.length, 1);
    assert.ok(result.signals[0].includes('18 days since last mentor interaction'));
  });

  it('suppresses risk when active Dismissal exists and no new log was created after dismissal', async () => {
    const { application, facultyUser } = await createBaseEntities();
    const now = new Date('2026-08-20T12:00:00Z');
    const assignmentStart = new Date(now.getTime() - 20 * MS_PER_DAY);

    await MentorAssignment.create({
      applicationId: application._id,
      facultyId: facultyUser._id,
      status: MENTOR_ASSIGNMENT_STATUS.ACCEPTED,
      createdAt: assignmentStart,
    });

    // Dismissal created 2 days ago
    await Dismissal.create({
      applicationId: application._id,
      dismissedBy: facultyUser._id,
      dismissedAt: new Date(now.getTime() - 2 * MS_PER_DAY),
      note: 'Student on approved medical leave',
    });

    const result = await getLiveRiskForApplication(application._id, { now });
    assert.equal(result.riskLevel, 'low');
    assert.equal(result.suppressed, true);
    assert.equal(result.signals.length, 0);
    assert.ok(result.rawScore.signals.length >= 2, 'rawScore should still contain unsuppressed signals');
    assert.equal(result.dismissal.note, 'Student on approved medical leave');
  });

  it('un-suppresses risk when a new progress log is created after dismissal date', async () => {
    const { application, facultyUser } = await createBaseEntities();
    const now = new Date('2026-08-20T12:00:00Z');
    const assignmentStart = new Date(now.getTime() - 20 * MS_PER_DAY);

    await MentorAssignment.create({
      applicationId: application._id,
      facultyId: facultyUser._id,
      status: MENTOR_ASSIGNMENT_STATUS.ACCEPTED,
      createdAt: assignmentStart,
    });

    // Dismissal created 5 days ago
    await Dismissal.create({
      applicationId: application._id,
      dismissedBy: facultyUser._id,
      dismissedAt: new Date(now.getTime() - 5 * MS_PER_DAY),
      note: 'Medical leave',
    });

    // Student submitted a new log 2 days ago (after dismissal), but without evidence and mentor has not verified (15+ days)
    await ProgressLog.create({
      applicationId: application._id,
      weekLabel: 'Week 3',
      description: 'Back from leave, started task',
      evidence: null,
      verified: false,
      createdAt: new Date(now.getTime() - 2 * MS_PER_DAY),
    });

    const result = await getLiveRiskForApplication(application._id, { now });
    assert.equal(result.suppressed, false, 'Risk must be un-suppressed because log created > dismissedAt');
    assert.notEqual(result.riskLevel, 'low');
    assert.ok(result.signals.length > 0);
  });
});

describe('risk.service — getLiveRiskForApplications() batch computation', () => {
  it('returns empty array when given empty input', async () => {
    const result = await getLiveRiskForApplications([]);
    assert.deepEqual(result, []);
  });

  it('consolidates queries and calculates risk across multiple applications without N+1', async () => {
    const { facultyUser, studentProfile, internship } = await createBaseEntities();

    // Create 3 applications
    const app1 = await Application.create({
      studentId: studentProfile._id,
      internshipId: internship._id,
      currentStatus: APPLICATION_STATUS.IN_PROGRESS,
      eligibilitySnapshot: { eligible: true, checks: [], computedAt: new Date() },
    });
    const app2 = await Application.create({
      studentId: studentProfile._id,
      internshipId: internship._id,
      currentStatus: APPLICATION_STATUS.IN_PROGRESS,
      eligibilitySnapshot: { eligible: true, checks: [], computedAt: new Date() },
    });

    const now = new Date();
    await MentorAssignment.create({
      applicationId: app1._id,
      facultyId: facultyUser._id,
      status: MENTOR_ASSIGNMENT_STATUS.ACCEPTED,
      createdAt: new Date(now.getTime() - 5 * MS_PER_DAY),
    });

    const results = await getLiveRiskForApplications([app1._id, app2._id], { now });
    assert.equal(results.length, 2);
    assert.equal(results[0].applicationId.toString(), app1._id.toString());
    assert.equal(results[1].applicationId.toString(), app2._id.toString());
  });
});

describe('risk.service — dismissRiskFlag()', () => {
  it('rejects if actor is not faculty (403 FORBIDDEN)', async () => {
    const { application } = await createBaseEntities();
    const nonFacultyActor = { id: new mongoose.Types.ObjectId().toString(), role: ROLES.STUDENT };

    await assert.rejects(
      async () => {
        await dismissRiskFlag(application._id, nonFacultyActor, 'Note');
      },
      (err) => {
        assert.equal(err.code, 'FORBIDDEN');
        assert.equal(err.status, 403);
        return true;
      },
    );
  });

  it('rejects if faculty is not the assigned mentor for this application (403 FORBIDDEN)', async () => {
    const { application, facultyUser, otherFacultyUser } = await createBaseEntities();

    await MentorAssignment.create({
      applicationId: application._id,
      facultyId: facultyUser._id,
      status: MENTOR_ASSIGNMENT_STATUS.ACCEPTED,
    });

    const unassignedActor = { id: otherFacultyUser._id.toString(), role: ROLES.FACULTY };

    await assert.rejects(
      async () => {
        await dismissRiskFlag(application._id, unassignedActor, 'Attempted dismissal');
      },
      (err) => {
        assert.equal(err.code, 'FORBIDDEN');
        assert.equal(err.status, 403);
        assert.ok(err.message.includes('Only the assigned faculty mentor'));
        return true;
      },
    );
  });

  it('persists a Dismissal record and returns suppressed effective risk when assigned mentor dismisses', async () => {
    const { application, facultyUser } = await createBaseEntities();

    await MentorAssignment.create({
      applicationId: application._id,
      facultyId: facultyUser._id,
      status: MENTOR_ASSIGNMENT_STATUS.ACCEPTED,
      createdAt: new Date(Date.now() - 25 * MS_PER_DAY),
    });

    const actor = { id: facultyUser._id.toString(), role: ROLES.FACULTY };
    const note = 'Reviewed offline with student; milestone extended';

    const { dismissal, effectiveRisk } = await dismissRiskFlag(application._id, actor, note);

    assert.ok(dismissal._id);
    assert.equal(dismissal.applicationId.toString(), application._id.toString());
    assert.equal(dismissal.dismissedBy.toString(), facultyUser._id.toString());
    assert.equal(dismissal.note, note);

    // Verify DB persistence
    const saved = await Dismissal.findById(dismissal._id);
    assert.ok(saved);
    assert.equal(saved.note, note);

    // Verify updated effective risk is now suppressed
    assert.equal(effectiveRisk.suppressed, true);
    assert.equal(effectiveRisk.riskLevel, 'low');
  });
});
