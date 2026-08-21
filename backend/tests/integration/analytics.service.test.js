import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

import { ROLES, USER_STATUS, APPLICATION_STATUS, ACTIVE_STATUSES, INTERNSHIP_STATUS, MENTOR_ASSIGNMENT_STATUS, EVIDENCE_TYPE } from '../../src/utils/constants.js';
import { User } from '../../src/modules/auth/models/User.js';
import { StudentProfile } from '../../src/modules/student/models/StudentProfile.js';
import { CompanyProfile } from '../../src/modules/company/models/CompanyProfile.js';
import { Internship } from '../../src/modules/company/models/Internship.js';
import { Application } from '../../src/modules/student/models/Application.js';
import { MentorAssignment } from '../../src/modules/faculty/models/MentorAssignment.js';
import { ProgressLog } from '../../src/modules/student/models/ProgressLog.js';
import { Dismissal } from '../../src/modules/risk/models/Dismissal.js';

import {
  getApplicationFunnel,
  getSkillGapReport,
  getDepartmentAnalytics,
  getPpoOutcomes,
  getTnpAlerts,
  getTnpDashboard,
  getCompanyStats,
  getHodDepartmentDashboard,
} from '../../src/modules/analytics/analytics.service.js';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

let replSet;

before(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const uri = replSet.getUri();
  await mongoose.connect(uri, { dbName: 'kaushal_analytics_test' });
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

// ── Fixture helpers ──────────────────────────────────────────────────────────

async function createCompany(overrides = {}) {
  const user = await User.create({
    name: overrides.name ?? 'Acme Corp',
    email: overrides.email ?? `acme_${Date.now()}@corp.demo`,
    passwordHash: 'hashed',
    role: ROLES.COMPANY,
    status: USER_STATUS.VERIFIED,
  });
  const profile = await CompanyProfile.create({
    userId: user._id,
    companyName: overrides.name ?? 'Acme Corp',
    contactEmail: user.email,
  });
  return { user, profile };
}

async function createInternship(companyProfileId, overrides = {}) {
  return Internship.create({
    companyId: companyProfileId,
    title: overrides.title ?? 'Software Intern',
    description: 'Write code',
    duration: '3 months',
    mode: 'remote',
    vacancies: overrides.vacancies ?? 2,
    lastDate: new Date(Date.now() + 30 * MS_PER_DAY),
    status: overrides.status ?? INTERNSHIP_STATUS.OPEN,
    criteria: overrides.criteria ?? {},
  });
}

async function createStudent(overrides = {}) {
  const user = await User.create({
    name: overrides.name ?? 'Test Student',
    email: overrides.email ?? `student_${Date.now()}@s.demo`,
    passwordHash: 'hashed',
    role: ROLES.STUDENT,
    status: USER_STATUS.ACTIVE,
  });
  const profile = await StudentProfile.create({
    userId: user._id,
    department: overrides.department ?? 'Computer Science',
    year: overrides.year ?? 4,
    cgpa: overrides.cgpa ?? 8.5,
    activeBacklogs: overrides.activeBacklogs ?? 0,
    skills: overrides.skills ?? ['JavaScript'],
    certifications: overrides.certifications ?? [],
  });
  return { user, profile };
}

async function createApplication(studentProfileId, internshipId, overrides = {}) {
  return Application.create({
    studentId: studentProfileId,
    internshipId,
    currentStatus: overrides.status ?? APPLICATION_STATUS.APPLIED,
    ppoOffered: overrides.ppoOffered ?? false,
    eligibilitySnapshot: overrides.eligibilitySnapshot ?? {
      eligible: true,
      checks: [],
      computedAt: new Date(),
    },
    override: overrides.override ?? null,
  });
}

// ──────────────────────────────────────────────────────────────────────────────
// getApplicationFunnel()
// ──────────────────────────────────────────────────────────────────────────────

describe('analytics.service — getApplicationFunnel()', () => {
  it('returns zero counts and no NaN when no applications exist', async () => {
    const result = await getApplicationFunnel();
    assert.equal(result.total, 0);
    assert.equal(result.funnelStages.length > 0, true);
    for (const stage of result.funnelStages) {
      assert.equal(typeof stage.conversionFromTotal, 'number');
      assert.equal(Number.isNaN(stage.conversionFromTotal), false);
      assert.equal(Number.isFinite(stage.conversionFromTotal), true);
    }
  });

  it('correctly counts applications per status', async () => {
    const { profile: s1 } = await createStudent({ email: 'sa@s.demo' });
    const { profile: s2 } = await createStudent({ email: 'sb@s.demo' });
    const { profile: company } = await createCompany({ email: 'ca@c.demo' });
    const internship = await createInternship(company._id);

    await createApplication(s1._id, internship._id, { status: APPLICATION_STATUS.APPLIED });
    await createApplication(s2._id, internship._id, { status: APPLICATION_STATUS.SHORTLISTED });

    const result = await getApplicationFunnel();
    assert.equal(result.total, 2);
    assert.equal(result.byStatus[APPLICATION_STATUS.APPLIED], 1);
    assert.equal(result.byStatus[APPLICATION_STATUS.SHORTLISTED], 1);
    assert.equal(result.byStatus[APPLICATION_STATUS.COMPLETED], 0);
  });

  it('calculates correct conversion percentages', async () => {
    const { profile: s1 } = await createStudent({ email: 'x1@s.demo' });
    const { profile: s2 } = await createStudent({ email: 'x2@s.demo' });
    const { profile: s3 } = await createStudent({ email: 'x3@s.demo' });
    const { profile: s4 } = await createStudent({ email: 'x4@s.demo' });
    const { profile: cp } = await createCompany({ email: 'cx@c.demo' });
    const i = await createInternship(cp._id);

    // 4 total: 2 applied, 1 shortlisted, 1 completed
    await createApplication(s1._id, i._id, { status: APPLICATION_STATUS.APPLIED });
    await createApplication(s2._id, i._id, { status: APPLICATION_STATUS.APPLIED });
    await createApplication(s3._id, i._id, { status: APPLICATION_STATUS.SHORTLISTED });
    await createApplication(s4._id, i._id, { status: APPLICATION_STATUS.COMPLETED });

    const result = await getApplicationFunnel();
    assert.equal(result.total, 4);
    const appliedStage = result.funnelStages.find((s) => s.stage === APPLICATION_STATUS.APPLIED);
    assert.equal(appliedStage.conversionFromTotal, 50);
    const completedStage = result.funnelStages.find((s) => s.stage === APPLICATION_STATUS.COMPLETED);
    assert.equal(completedStage.conversionFromTotal, 25);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// getSkillGapReport()
// ──────────────────────────────────────────────────────────────────────────────

describe('analytics.service — getSkillGapReport()', () => {
  it('returns empty array when no applications exist', async () => {
    const result = await getSkillGapReport();
    assert.deepEqual(result, []);
  });

  it('aggregates missing skills from failed SKILLS checks', async () => {
    const { profile: s1 } = await createStudent({ email: 'gs1@s.demo', skills: ['JavaScript'] });
    const { profile: cp } = await createCompany({ email: 'gc@c.demo' });
    const i = await createInternship(cp._id, {
      criteria: { requiredSkills: ['JavaScript', 'Python', 'SQL'] },
    });

    await createApplication(s1._id, i._id, {
      eligibilitySnapshot: {
        eligible: false,
        checks: [
          {
            criterion: 'SKILLS',
            required: ['JavaScript', 'Python', 'SQL'],
            actual: ['JavaScript'],
            pass: false,
            reason: 'Missing: Python, SQL',
          },
        ],
        computedAt: new Date(),
      },
    });

    const result = await getSkillGapReport();
    const skills = result.map((r) => r.skill);
    assert.ok(skills.includes('Python'), 'Python should be in gap report');
    assert.ok(skills.includes('SQL'), 'SQL should be in gap report');
    assert.ok(!skills.includes('JavaScript'), 'JavaScript (present) should NOT be in gap report');
  });

  it('returns skills sorted by frequency descending then alphabetically for ties', async () => {
    const { profile: s1 } = await createStudent({ email: 'gs2@s.demo', skills: [] });
    const { profile: s2 } = await createStudent({ email: 'gs3@s.demo', skills: [] });
    const { profile: cp } = await createCompany({ email: 'gc2@c.demo' });
    const i = await createInternship(cp._id);

    // s1 missing Python, SQL; s2 missing only Python
    await createApplication(s1._id, i._id, {
      eligibilitySnapshot: {
        eligible: false,
        checks: [{ criterion: 'SKILLS', required: ['Python', 'SQL'], actual: [], pass: false, reason: 'Missing: Python, SQL' }],
        computedAt: new Date(),
      },
    });
    await createApplication(s2._id, i._id, {
      eligibilitySnapshot: {
        eligible: false,
        checks: [{ criterion: 'SKILLS', required: ['Python'], actual: [], pass: false, reason: 'Missing: Python' }],
        computedAt: new Date(),
      },
    });

    const result = await getSkillGapReport();
    assert.equal(result[0].skill, 'Python'); // frequency 2
    assert.equal(result[1].skill, 'SQL');    // frequency 1
    assert.equal(result[0].missingCount, 2);
    assert.equal(result[1].missingCount, 1);
  });

  it('does not count skills that were present (pass: true checks ignored)', async () => {
    const { profile: s1 } = await createStudent({ email: 'gs4@s.demo', skills: ['JavaScript'] });
    const { profile: cp } = await createCompany({ email: 'gc3@c.demo' });
    const i = await createInternship(cp._id);

    await createApplication(s1._id, i._id, {
      eligibilitySnapshot: {
        eligible: true,
        checks: [{ criterion: 'SKILLS', required: ['JavaScript'], actual: ['JavaScript'], pass: true, reason: null }],
        computedAt: new Date(),
      },
    });

    const result = await getSkillGapReport();
    assert.deepEqual(result, []);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// getDepartmentAnalytics()
// ──────────────────────────────────────────────────────────────────────────────

describe('analytics.service — getDepartmentAnalytics()', () => {
  it('returns empty array when no applications', async () => {
    const result = await getDepartmentAnalytics();
    assert.deepEqual(result, []);
  });

  it('groups applications by department and counts correctly', async () => {
    const { profile: cse1 } = await createStudent({ email: 'd1@s.demo', department: 'Computer Science' });
    const { profile: cse2 } = await createStudent({ email: 'd2@s.demo', department: 'Computer Science' });
    const { profile: ece1 } = await createStudent({ email: 'd3@s.demo', department: 'Electronics' });
    const { profile: cp } = await createCompany({ email: 'dc@c.demo' });
    const i = await createInternship(cp._id);

    await createApplication(cse1._id, i._id, { status: APPLICATION_STATUS.COMPLETED, ppoOffered: true });
    await createApplication(cse2._id, i._id, { status: APPLICATION_STATUS.IN_PROGRESS });
    await createApplication(ece1._id, i._id, { status: APPLICATION_STATUS.APPLIED });

    const result = await getDepartmentAnalytics();
    const cse = result.find((r) => r.department === 'Computer Science');
    const ece = result.find((r) => r.department === 'Electronics');

    assert.ok(cse);
    assert.equal(cse.totalApplications, 2);
    assert.equal(cse.distinctStudents, 2);
    assert.equal(cse.completed, 1);
    assert.equal(cse.inProgress, 1);
    assert.equal(cse.ppoCount, 1);

    assert.ok(ece);
    assert.equal(ece.totalApplications, 1);
    assert.equal(ece.completed, 0);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// getPpoOutcomes()
// ──────────────────────────────────────────────────────────────────────────────

describe('analytics.service — getPpoOutcomes()', () => {
  it('returns zeros when no completed applications exist', async () => {
    const result = await getPpoOutcomes();
    assert.equal(result.totalCompleted, 0);
    assert.equal(result.ppoOffered, 0);
    assert.equal(result.ppoRate, 0);
    assert.equal(Number.isNaN(result.ppoRate), false);
  });

  it('calculates PPO rate correctly', async () => {
    const { profile: s1 } = await createStudent({ email: 'p1@s.demo' });
    const { profile: s2 } = await createStudent({ email: 'p2@s.demo' });
    const { profile: s3 } = await createStudent({ email: 'p3@s.demo' });
    const { profile: cp } = await createCompany({ email: 'pc@c.demo' });
    const i = await createInternship(cp._id);

    await createApplication(s1._id, i._id, { status: APPLICATION_STATUS.COMPLETED, ppoOffered: true });
    await createApplication(s2._id, i._id, { status: APPLICATION_STATUS.COMPLETED, ppoOffered: false });
    await createApplication(s3._id, i._id, { status: APPLICATION_STATUS.IN_PROGRESS });

    const result = await getPpoOutcomes();
    assert.equal(result.totalCompleted, 2);
    assert.equal(result.ppoOffered, 1);
    assert.equal(result.ppoRate, 50);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// getTnpAlerts()
// ──────────────────────────────────────────────────────────────────────────────

describe('analytics.service — getTnpAlerts()', () => {
  it('returns all zeros when database is empty', async () => {
    const result = await getTnpAlerts();
    assert.equal(result.zeroEligibleApplicants, 0);
    assert.equal(result.unassignedMentorCount, 0);
    assert.equal(result.pendingOfferVerification, 0);
    assert.equal(result.atRiskCount, 0);
  });

  it('counts pending offer verifications correctly', async () => {
    const { profile: s1 } = await createStudent({ email: 'a1@s.demo' });
    const { profile: s2 } = await createStudent({ email: 'a2@s.demo' });
    const { profile: cp } = await createCompany({ email: 'ac@c.demo' });
    const i = await createInternship(cp._id);

    await createApplication(s1._id, i._id, { status: APPLICATION_STATUS.ACCEPTED });
    await createApplication(s2._id, i._id, { status: APPLICATION_STATUS.APPLIED });

    const result = await getTnpAlerts();
    assert.equal(result.pendingOfferVerification, 1);
  });

  it('counts unassigned tnpVerified applications', async () => {
    const { profile: s1 } = await createStudent({ email: 'u1@s.demo' });
    const { profile: s2 } = await createStudent({ email: 'u2@s.demo' });
    const { profile: cp } = await createCompany({ email: 'uc@c.demo' });
    const i = await createInternship(cp._id);
    const f = await User.create({ name: 'F', email: 'f@f.demo', passwordHash: 'h', role: ROLES.FACULTY, status: USER_STATUS.ACTIVE });

    const app1 = await createApplication(s1._id, i._id, { status: APPLICATION_STATUS.TNP_VERIFIED });
    const app2 = await createApplication(s2._id, i._id, { status: APPLICATION_STATUS.TNP_VERIFIED });

    // Assign faculty to app1 only
    await MentorAssignment.create({
      applicationId: app1._id,
      facultyId: f._id,
      status: MENTOR_ASSIGNMENT_STATUS.PENDING,
    });

    const result = await getTnpAlerts();
    assert.equal(result.unassignedMentorCount, 1);
  });

  it('counts open postings with zero effectively-eligible applicants', async () => {
    const { profile: s1 } = await createStudent({ email: 'z1@s.demo', skills: [] });
    const { profile: cp } = await createCompany({ email: 'zc@c.demo' });
    const i = await createInternship(cp._id, {
      status: INTERNSHIP_STATUS.OPEN,
      criteria: { requiredSkills: ['Kubernetes'] },
    });

    // Application exists but eligible: false
    await createApplication(s1._id, i._id, {
      eligibilitySnapshot: {
        eligible: false,
        checks: [{ criterion: 'SKILLS', required: ['Kubernetes'], actual: [], pass: false, reason: 'Missing: Kubernetes' }],
        computedAt: new Date(),
      },
    });

    const result = await getTnpAlerts();
    assert.equal(result.zeroEligibleApplicants, 1);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// getHodDepartmentDashboard()
// ──────────────────────────────────────────────────────────────────────────────

describe('analytics.service — getHodDepartmentDashboard()', () => {
  it('throws validation error when no department provided', async () => {
    await assert.rejects(
      async () => { await getHodDepartmentDashboard(null); },
      (err) => {
        assert.equal(err.code, 'VALIDATION_ERROR');
        return true;
      },
    );
  });

  it('returns zero counts for a department with no students', async () => {
    const result = await getHodDepartmentDashboard('Mechanical');
    assert.equal(result.totalStudents, 0);
    assert.equal(result.activeApplications, 0);
    assert.equal(result.atRiskCount, 0);
  });

  it('correctly counts statistics for a department', async () => {
    const { profile: s1 } = await createStudent({ email: 'h1@s.demo', department: 'Electrical' });
    const { profile: s2 } = await createStudent({ email: 'h2@s.demo', department: 'Electrical' });
    const { profile: s3 } = await createStudent({ email: 'h3@s.demo', department: 'Civil' }); // different dept
    const { profile: cp } = await createCompany({ email: 'hc@c.demo' });
    const i = await createInternship(cp._id);

    await createApplication(s1._id, i._id, { status: APPLICATION_STATUS.COMPLETED, ppoOffered: true });
    await createApplication(s2._id, i._id, { status: APPLICATION_STATUS.IN_PROGRESS });
    await createApplication(s3._id, i._id, { status: APPLICATION_STATUS.APPLIED }); // different dept, should not appear

    const result = await getHodDepartmentDashboard('Electrical');
    assert.equal(result.totalStudents, 2);
    assert.equal(result.completed, 1);
    assert.equal(result.inProgress, 1);
    assert.equal(result.ppoCount, 1);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// getTnpDashboard() — integration
// ──────────────────────────────────────────────────────────────────────────────

describe('analytics.service — getTnpDashboard()', () => {
  it('returns all required dashboard sections even with empty database', async () => {
    const result = await getTnpDashboard();
    assert.ok('applicationFunnel' in result);
    assert.ok('skillGapReport' in result);
    assert.ok('departmentStats' in result);
    assert.ok('ppoOutcomes' in result);
    assert.ok('companyStats' in result);
    assert.equal(Array.isArray(result.skillGapReport), true);
    assert.equal(Array.isArray(result.departmentStats), true);
    assert.equal(Array.isArray(result.companyStats), true);
  });
});
