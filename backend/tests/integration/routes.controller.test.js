import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

import { app } from '../../src/app.js';
import { env } from '../../src/config/env.js';
import {
  ROLES,
  USER_STATUS,
  APPLICATION_STATUS,
  INTERNSHIP_STATUS,
  MENTOR_ASSIGNMENT_STATUS,
} from '../../src/utils/constants.js';

import { User } from '../../src/modules/auth/models/User.js';
import { StudentProfile } from '../../src/modules/student/models/StudentProfile.js';
import { CompanyProfile } from '../../src/modules/company/models/CompanyProfile.js';
import { Internship } from '../../src/modules/company/models/Internship.js';
import { Application } from '../../src/modules/student/models/Application.js';
import { MentorAssignment } from '../../src/modules/faculty/models/MentorAssignment.js';
import { ProgressLog } from '../../src/modules/student/models/ProgressLog.js';
import { Dismissal } from '../../src/modules/risk/models/Dismissal.js';

let replSet;
let server;
let baseUrl;

function authHeader(user) {
  const token = jwt.sign({ userId: user._id.toString() }, env.JWT_SECRET, { expiresIn: '1h' });
  return { Authorization: `Bearer ${token}` };
}

before(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const uri = replSet.getUri();
  await mongoose.connect(uri, { dbName: 'kaushal_routes_test' });

  await new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://localhost:${port}`;
      resolve();
    });
  });
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
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

// ── Test Helpers ──────────────────────────────────────────────────────────

async function createTestUser(role, overrides = {}) {
  return User.create({
    name: overrides.name ?? `${role} User`,
    email: overrides.email ?? `${role}_${Date.now()}_${Math.random()}@test.demo`,
    passwordHash: 'hashed',
    role,
    status: overrides.status ?? USER_STATUS.ACTIVE,
    department: overrides.department ?? (role === ROLES.HOD || role === ROLES.FACULTY ? 'Computer Science' : undefined),
  });
}

// ──────────────────────────────────────────────────────────────────────────
// 1. RISK ROUTES & CONTROLLERS
// ──────────────────────────────────────────────────────────────────────────

describe('Risk Routes (/api/risk & /api/v1/risk)', () => {
  it('GET /api/risk/:id rejects unauthenticated request with 401', async () => {
    const res = await fetch(`${baseUrl}/api/risk/507f1f77bcf86cd799439011`);
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.ok(body.error);
  });

  it('GET /api/risk/:id rejects unauthorized role (student) with 403', async () => {
    const student = await createTestUser(ROLES.STUDENT);
    const res = await fetch(`${baseUrl}/api/risk/507f1f77bcf86cd799439011`, {
      headers: authHeader(student),
    });
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.ok(body.error);
  });

  it('GET /api/risk/:id returns 404 if application not found', async () => {
    const faculty = await createTestUser(ROLES.FACULTY);
    const res = await fetch(`${baseUrl}/api/risk/507f1f77bcf86cd799439011`, {
      headers: authHeader(faculty),
    });
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.ok(body.error);
  });

  it('GET /api/risk/:id returns 200 with live risk data for tnp and faculty', async () => {
    const faculty = await createTestUser(ROLES.FACULTY);
    const studentUser = await createTestUser(ROLES.STUDENT);
    const studentProfile = await StudentProfile.create({
      userId: studentUser._id,
      department: 'Computer Science',
      year: 4,
      cgpa: 8.0,
    });
    const companyUser = await createTestUser(ROLES.COMPANY, { status: USER_STATUS.VERIFIED });
    const companyProfile = await CompanyProfile.create({
      userId: companyUser._id,
      companyName: 'Tech Corp',
      contactEmail: companyUser.email,
    });
    const internship = await Internship.create({
      companyId: companyProfile._id,
      title: 'Dev Intern',
      description: 'Code',
      duration: '3m',
      mode: 'remote',
      vacancies: 2,
      lastDate: new Date(Date.now() + 86400000),
      status: INTERNSHIP_STATUS.OPEN,
    });

    const application = await Application.create({
      studentId: studentProfile._id,
      internshipId: internship._id,
      currentStatus: APPLICATION_STATUS.IN_PROGRESS,
      eligibilitySnapshot: { eligible: true, checks: [], computedAt: new Date() },
    });

    const res = await fetch(`${baseUrl}/api/risk/${application._id}`, {
      headers: authHeader(faculty),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    const data = body.data ?? body;
    assert.equal(data.applicationId, application._id.toString());
    assert.ok('riskLevel' in data);
    assert.ok(Array.isArray(data.signals));
  });

  it('PATCH /api/risk/:id/dismiss requires note (400 if missing)', async () => {
    const faculty = await createTestUser(ROLES.FACULTY);
    const res = await fetch(`${baseUrl}/api/risk/507f1f77bcf86cd799439011/dismiss`, {
      method: 'PATCH',
      headers: {
        ...authHeader(faculty),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.error?.message || body.error, 'Dismissal note is required');
  });

  it('PATCH /api/risk/:id/dismiss returns 403 if faculty is not assigned mentor', async () => {
    const faculty = await createTestUser(ROLES.FACULTY);
    const studentUser = await createTestUser(ROLES.STUDENT);
    const studentProfile = await StudentProfile.create({
      userId: studentUser._id,
      department: 'Computer Science',
      year: 4,
      cgpa: 8.0,
    });
    const companyUser = await createTestUser(ROLES.COMPANY);
    const companyProfile = await CompanyProfile.create({
      userId: companyUser._id,
      companyName: 'Tech Corp',
      contactEmail: companyUser.email,
    });
    const internship = await Internship.create({
      companyId: companyProfile._id,
      title: 'Dev Intern',
      description: 'Code',
      duration: '3m',
      mode: 'remote',
      vacancies: 2,
      lastDate: new Date(Date.now() + 86400000),
      status: INTERNSHIP_STATUS.OPEN,
    });
    const application = await Application.create({
      studentId: studentProfile._id,
      internshipId: internship._id,
      currentStatus: APPLICATION_STATUS.IN_PROGRESS,
      eligibilitySnapshot: { eligible: true, checks: [], computedAt: new Date() },
    });

    const res = await fetch(`${baseUrl}/api/risk/${application._id}/dismiss`, {
      method: 'PATCH',
      headers: {
        ...authHeader(faculty),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ note: 'Reviewed student progress' }),
    });
    assert.equal(res.status, 403);
  });

  it('PATCH /api/risk/:id/dismiss succeeds with 201 for assigned mentor', async () => {
    const faculty = await createTestUser(ROLES.FACULTY);
    const studentUser = await createTestUser(ROLES.STUDENT);
    const studentProfile = await StudentProfile.create({
      userId: studentUser._id,
      department: 'Computer Science',
      year: 4,
      cgpa: 8.0,
    });
    const companyUser = await createTestUser(ROLES.COMPANY);
    const companyProfile = await CompanyProfile.create({
      userId: companyUser._id,
      companyName: 'Tech Corp',
      contactEmail: companyUser.email,
    });
    const internship = await Internship.create({
      companyId: companyProfile._id,
      title: 'Dev Intern',
      description: 'Code',
      duration: '3m',
      mode: 'remote',
      vacancies: 2,
      lastDate: new Date(Date.now() + 86400000),
      status: INTERNSHIP_STATUS.OPEN,
    });
    const application = await Application.create({
      studentId: studentProfile._id,
      internshipId: internship._id,
      currentStatus: APPLICATION_STATUS.IN_PROGRESS,
      eligibilitySnapshot: { eligible: true, checks: [], computedAt: new Date() },
    });

    await MentorAssignment.create({
      applicationId: application._id,
      facultyId: faculty._id,
      status: MENTOR_ASSIGNMENT_STATUS.ACCEPTED,
    });

    const res = await fetch(`${baseUrl}/api/risk/${application._id}/dismiss`, {
      method: 'PATCH',
      headers: {
        ...authHeader(faculty),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ note: 'Reviewed student work in 1-on-1' }),
    });
    assert.equal(res.status, 201);
    const body = await res.json();
    const data = body.data ?? body;
    assert.ok(data.dismissal);
    assert.equal(data.effectiveRisk.suppressed, true);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// 2. ANALYTICS ROUTES & CONTROLLERS
// ──────────────────────────────────────────────────────────────────────────

describe('Analytics Routes (/api/analytics)', () => {
  it('GET /api/analytics/dashboard allows tnp and returns full metrics', async () => {
    const tnp = await createTestUser(ROLES.TNP);
    const res = await fetch(`${baseUrl}/api/analytics/dashboard`, {
      headers: authHeader(tnp),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    const data = body.data ?? body;
    assert.ok('applicationFunnel' in data);
    assert.ok('skillGapReport' in data);
    assert.ok('departmentStats' in data);
    assert.ok('ppoOutcomes' in data);
    assert.ok('companyStats' in data);
  });

  it('GET /api/analytics/dashboard rejects non-tnp roles with 403', async () => {
    const student = await createTestUser(ROLES.STUDENT);
    const res = await fetch(`${baseUrl}/api/analytics/dashboard`, {
      headers: authHeader(student),
    });
    assert.equal(res.status, 403);
  });

  it('GET /api/analytics/alerts allows tnp and returns alert counts', async () => {
    const tnp = await createTestUser(ROLES.TNP);
    const res = await fetch(`${baseUrl}/api/analytics/alerts`, {
      headers: authHeader(tnp),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    const data = body.data ?? body;
    assert.ok('zeroEligibleApplicants' in data);
    assert.ok('unassignedMentorCount' in data);
    assert.ok('pendingOfferVerification' in data);
    assert.ok('atRiskCount' in data);
  });

  it('GET /api/analytics/hod returns 400 if department missing on user', async () => {
    const hod = await createTestUser(ROLES.HOD, { department: '' });
    await User.updateOne({ _id: hod._id }, { $unset: { department: 1 } });

    const res = await fetch(`${baseUrl}/api/analytics/hod`, {
      headers: authHeader(hod),
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.ok(body.error);
  });

  it('GET /api/analytics/hod returns 200 with dept stats for hod role', async () => {
    const hod = await createTestUser(ROLES.HOD, { department: 'Mechanical' });
    const res = await fetch(`${baseUrl}/api/analytics/hod`, {
      headers: authHeader(hod),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    const data = body.data ?? body;
    assert.equal(data.department, 'Mechanical');
    assert.equal(data.totalStudents, 0);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// 3. STUDENT READ ROUTES & CONTROLLERS
// ──────────────────────────────────────────────────────────────────────────

describe('Student Read Routes (/api/student)', () => {
  it('GET /api/student/internships returns open postings with live eligibility', async () => {
    const studentUser = await createTestUser(ROLES.STUDENT);
    await StudentProfile.create({
      userId: studentUser._id,
      department: 'Computer Science',
      year: 4,
      cgpa: 9.0,
      skills: ['Node.js', 'React'],
    });

    const companyUser = await createTestUser(ROLES.COMPANY);
    const companyProfile = await CompanyProfile.create({
      userId: companyUser._id,
      companyName: 'Acme',
      contactEmail: companyUser.email,
    });

    await Internship.create({
      companyId: companyProfile._id,
      title: 'Fullstack Intern',
      description: 'Build apps',
      duration: '6m',
      mode: 'remote',
      vacancies: 3,
      lastDate: new Date(Date.now() + 86400000),
      status: INTERNSHIP_STATUS.OPEN,
      criteria: {
        minCgpa: 7.5,
        departments: ['Computer Science'],
        requiredSkills: ['Node.js'],
      },
    });

    const res = await fetch(`${baseUrl}/api/student/internships`, {
      headers: authHeader(studentUser),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    const data = body.data ?? body;
    assert.equal(Array.isArray(data), true);
    assert.equal(data.length, 1);
    assert.equal(data[0].eligibility.eligible, true);
    assert.equal(data[0].title, 'Fullstack Intern');
  });

  it('GET /api/student/internships/:id returns full eligibility breakdown', async () => {
    const studentUser = await createTestUser(ROLES.STUDENT);
    await StudentProfile.create({
      userId: studentUser._id,
      department: 'Computer Science',
      year: 4,
      cgpa: 6.0,
    });

    const companyUser = await createTestUser(ROLES.COMPANY);
    const companyProfile = await CompanyProfile.create({
      userId: companyUser._id,
      companyName: 'Acme',
      contactEmail: companyUser.email,
    });

    const internship = await Internship.create({
      companyId: companyProfile._id,
      title: 'AI Intern',
      description: 'ML',
      duration: '3m',
      mode: 'remote',
      vacancies: 1,
      lastDate: new Date(Date.now() + 86400000),
      status: INTERNSHIP_STATUS.OPEN,
      criteria: { minCgpa: 8.0 },
    });

    const res = await fetch(`${baseUrl}/api/student/internships/${internship._id}`, {
      headers: authHeader(studentUser),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    const data = body.data ?? body;
    assert.equal(data.internship.title, 'AI Intern');
    assert.equal(data.eligibility.eligible, false);
    assert.equal(data.eligibility.checks.length, 5);
  });

  it('GET /api/student/applications returns student own applications', async () => {
    const studentUser = await createTestUser(ROLES.STUDENT);
    const studentProfile = await StudentProfile.create({
      userId: studentUser._id,
      department: 'IT',
      year: 3,
      cgpa: 8.2,
    });

    const companyUser = await createTestUser(ROLES.COMPANY);
    const companyProfile = await CompanyProfile.create({
      userId: companyUser._id,
      companyName: 'Acme',
      contactEmail: companyUser.email,
    });

    const internship = await Internship.create({
      companyId: companyProfile._id,
      title: 'QA Intern',
      description: 'Test',
      duration: '3m',
      mode: 'remote',
      vacancies: 1,
      lastDate: new Date(Date.now() + 86400000),
      status: INTERNSHIP_STATUS.OPEN,
    });

    await Application.create({
      studentId: studentProfile._id,
      internshipId: internship._id,
      currentStatus: APPLICATION_STATUS.APPLIED,
      eligibilitySnapshot: { eligible: true, checks: [], computedAt: new Date() },
    });

    const res = await fetch(`${baseUrl}/api/student/applications`, {
      headers: authHeader(studentUser),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    const data = body.data ?? body;
    assert.equal(data.length, 1);
  });

  it('GET /api/student/whats-next returns prompt and counts', async () => {
    const studentUser = await createTestUser(ROLES.STUDENT);
    await StudentProfile.create({
      userId: studentUser._id,
      department: 'IT',
      year: 3,
      cgpa: 8.2,
      skills: ['Python'],
    });

    const res = await fetch(`${baseUrl}/api/student/whats-next`, {
      headers: authHeader(studentUser),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    const data = body.data ?? body;
    assert.ok('action' in data);
    assert.ok('counts' in data);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// 4. COMPANY READ ROUTES & CONTROLLERS
// ──────────────────────────────────────────────────────────────────────────

describe('Company Read Routes (/api/company)', () => {
  it('GET /api/company/internships returns postings owned by company', async () => {
    const companyUser = await createTestUser(ROLES.COMPANY);
    const companyProfile = await CompanyProfile.create({
      userId: companyUser._id,
      companyName: 'Beta Corp',
      contactEmail: companyUser.email,
    });

    await Internship.create({
      companyId: companyProfile._id,
      title: 'Backend Intern',
      description: 'Node',
      duration: '3m',
      mode: 'remote',
      vacancies: 5,
      lastDate: new Date(Date.now() + 86400000),
      status: INTERNSHIP_STATUS.OPEN,
    });

    const res = await fetch(`${baseUrl}/api/company/internships`, {
      headers: authHeader(companyUser),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    const data = body.data ?? body;
    assert.equal(data.length, 1);
    assert.equal(data[0].title, 'Backend Intern');
    assert.equal(data[0].applicationCount, 0);
  });

  it('GET /api/company/internships/:id/applicants enforces ownership & privacy tier', async () => {
    const companyUser = await createTestUser(ROLES.COMPANY);
    const companyProfile = await CompanyProfile.create({
      userId: companyUser._id,
      companyName: 'Beta Corp',
      contactEmail: companyUser.email,
    });

    const internship = await Internship.create({
      companyId: companyProfile._id,
      title: 'Dev Intern',
      description: 'Dev',
      duration: '3m',
      mode: 'remote',
      vacancies: 2,
      lastDate: new Date(Date.now() + 86400000),
      status: INTERNSHIP_STATUS.OPEN,
    });

    const studentUser = await createTestUser(ROLES.STUDENT, { name: 'Alice Smith' });
    const studentProfile = await StudentProfile.create({
      userId: studentUser._id,
      department: 'CS',
      year: 4,
      cgpa: 9.5,
    });

    await Application.create({
      studentId: studentProfile._id,
      internshipId: internship._id,
      currentStatus: APPLICATION_STATUS.APPLIED,
      eligibilitySnapshot: { eligible: true, checks: [], computedAt: new Date() },
    });

    const res = await fetch(`${baseUrl}/api/company/internships/${internship._id}/applicants`, {
      headers: authHeader(companyUser),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    const data = body.data ?? body;
    assert.equal(data.length, 1);
    // Pre-shortlist: NO name, NO cgpa
    assert.equal(data[0].stage, 'applied');
    assert.equal(data[0].eligible, true);
    assert.equal(data[0].name, undefined);
    assert.equal(data[0].cgpa, undefined);
  });

  it('GET /api/company/whats-next & analytics return 200', async () => {
    const companyUser = await createTestUser(ROLES.COMPANY);
    await CompanyProfile.create({
      userId: companyUser._id,
      companyName: 'Gamma Corp',
      contactEmail: companyUser.email,
    });

    const [res1, res2] = await Promise.all([
      fetch(`${baseUrl}/api/company/whats-next`, { headers: authHeader(companyUser) }),
      fetch(`${baseUrl}/api/company/analytics`, { headers: authHeader(companyUser) }),
    ]);
    assert.equal(res1.status, 200);
    assert.equal(res2.status, 200);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// 5. FACULTY READ ROUTES & CONTROLLERS
// ──────────────────────────────────────────────────────────────────────────

describe('Faculty Read Routes (/api/faculty)', () => {
  it('GET /api/faculty/assigned-students returns assigned students with live risk', async () => {
    const faculty = await createTestUser(ROLES.FACULTY);
    const res = await fetch(`${baseUrl}/api/faculty/assigned-students`, {
      headers: authHeader(faculty),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    const data = body.data ?? body;
    assert.equal(Array.isArray(data), true);
  });

  it('GET /api/faculty/applications/:id/progress returns 403 if not assigned', async () => {
    const faculty = await createTestUser(ROLES.FACULTY);
    const res = await fetch(`${baseUrl}/api/faculty/applications/507f1f77bcf86cd799439011/progress`, {
      headers: authHeader(faculty),
    });
    assert.equal(res.status, 403);
  });

  it('GET /api/faculty/whats-next returns action and counts', async () => {
    const faculty = await createTestUser(ROLES.FACULTY);
    const res = await fetch(`${baseUrl}/api/faculty/whats-next`, {
      headers: authHeader(faculty),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    const data = body.data ?? body;
    assert.ok('action' in data);
    assert.ok('counts' in data);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// 6. TNP READ ROUTES & CONTROLLERS
// ──────────────────────────────────────────────────────────────────────────

describe('T&P Read Routes (/api/tnp)', () => {
  it('GET /api/tnp/verification-queue returns offers for tnp', async () => {
    const tnp = await createTestUser(ROLES.TNP);
    const res = await fetch(`${baseUrl}/api/tnp/verification-queue`, {
      headers: authHeader(tnp),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    const data = body.data ?? body;
    assert.equal(Array.isArray(data), true);
  });

  it('GET /api/tnp/unassigned-queue returns unassigned apps for tnp', async () => {
    const tnp = await createTestUser(ROLES.TNP);
    const res = await fetch(`${baseUrl}/api/tnp/unassigned-queue`, {
      headers: authHeader(tnp),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    const data = body.data ?? body;
    assert.equal(Array.isArray(data), true);
  });

  it('GET /api/tnp/whats-next returns alert action prompt', async () => {
    const tnp = await createTestUser(ROLES.TNP);
    const res = await fetch(`${baseUrl}/api/tnp/whats-next`, {
      headers: authHeader(tnp),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    const data = body.data ?? body;
    assert.ok('action' in data);
    assert.ok(Array.isArray(data.alerts));
  });

  it('GET /api/tnp/students returns list of students', async () => {
    const tnp = await createTestUser(ROLES.TNP);
    const res = await fetch(`${baseUrl}/api/tnp/students`, {
      headers: authHeader(tnp),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    const data = body.data ?? body;
    assert.equal(Array.isArray(data), true);
  });

  it('GET /api/tnp/internships returns list of internships', async () => {
    const tnp = await createTestUser(ROLES.TNP);
    const res = await fetch(`${baseUrl}/api/tnp/internships`, {
      headers: authHeader(tnp),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    const data = body.data ?? body;
    assert.equal(Array.isArray(data), true);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// 7. HOD ROUTES & CONTROLLERS
// ──────────────────────────────────────────────────────────────────────────

describe('HOD Routes (/api/hod)', () => {
  it('GET /api/hod/dashboard returns dept dashboard for authenticated HOD', async () => {
    const hod = await createTestUser(ROLES.HOD, { department: 'Information Technology' });
    const res = await fetch(`${baseUrl}/api/hod/dashboard`, {
      headers: authHeader(hod),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    const data = body.data ?? body;
    assert.equal(data.department, 'Information Technology');
  });

  it('GET /api/hod/dashboard rejects non-HOD with 403', async () => {
    const student = await createTestUser(ROLES.STUDENT);
    const res = await fetch(`${baseUrl}/api/hod/dashboard`, {
      headers: authHeader(student),
    });
    assert.equal(res.status, 403);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// 8. OFF-CAMPUS INTERNSHIP ROUTES & CONTROLLERS
// ──────────────────────────────────────────────────────────────────────────

describe('Off-Campus Internship Routes (/api/v1/student/off-campus-opportunities & /api/v1/tnp/off-campus)', () => {
  it('POST /api/v1/student/off-campus-opportunities rejects unauthenticated with 401', async () => {
    const res = await fetch(`${baseUrl}/api/v1/student/off-campus-opportunities`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyName: 'Acme' }),
    });
    assert.equal(res.status, 401);
  });

  it('POST /api/v1/student/off-campus-opportunities rejects non-student with 403', async () => {
    const faculty = await createTestUser(ROLES.FACULTY);
    const res = await fetch(`${baseUrl}/api/v1/student/off-campus-opportunities`, {
      method: 'POST',
      headers: {
        ...authHeader(faculty),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ companyName: 'Acme' }),
    });
    assert.equal(res.status, 403);
  });

  it('POST /api/v1/student/off-campus-opportunities creates opportunity in pending verification state', async () => {
    const student = await createTestUser(ROLES.STUDENT);
    await StudentProfile.create({
      userId: student._id,
      department: 'Computer Science',
      year: 4,
      cgpa: 8.9,
    });

    const res = await fetch(`${baseUrl}/api/v1/student/off-campus-opportunities`, {
      method: 'POST',
      headers: {
        ...authHeader(student),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        companyName: 'Amazon Development Centre',
        title: 'SDE Intern',
        description: 'AWS Cloud Services',
        duration: '6 months',
        mode: 'hybrid',
        stipend: 80000,
        evidenceUrl: 'https://docs.aws.amazon.com/offer.pdf',
      }),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.source, 'off_campus');
    assert.equal(body.data.externalCompanyName, 'Amazon Development Centre');
    assert.equal(body.data.offCampusVerification.status, 'pendingVerification');
  });

  it('GET /api/v1/student/off-campus-opportunities returns student\'s own submissions', async () => {
    const student = await createTestUser(ROLES.STUDENT);
    const profile = await StudentProfile.create({
      userId: student._id,
      department: 'Computer Science',
      year: 3,
      cgpa: 7.8,
    });

    await Internship.create({
      source: 'off_campus',
      externalCompanyName: 'Red Hat',
      title: 'OpenShift Intern',
      description: 'Kubernetes tooling',
      duration: '4 months',
      mode: 'remote',
      vacancies: 1,
      lastDate: new Date(),
      offCampusVerification: {
        status: 'pendingVerification',
        submittedBy: profile._id,
        submittedAt: new Date(),
      },
    });

    const res = await fetch(`${baseUrl}/api/v1/student/off-campus-opportunities`, {
      headers: authHeader(student),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(Array.isArray(body.data), true);
    assert.equal(body.data.length, 1);
    assert.equal(body.data[0].externalCompanyName, 'Red Hat');
  });

  it('GET /api/v1/tnp/off-campus/verification-queue returns queue for T&P', async () => {
    const tnp = await createTestUser(ROLES.TNP);
    const res = await fetch(`${baseUrl}/api/v1/tnp/off-campus/verification-queue`, {
      headers: authHeader(tnp),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(Array.isArray(body.data), true);
  });

  it('PATCH /api/v1/tnp/off-campus-opportunities/:id/verify verifies opportunity and creates Application', async () => {
    const tnp = await createTestUser(ROLES.TNP);
    const student = await createTestUser(ROLES.STUDENT);
    const profile = await StudentProfile.create({
      userId: student._id,
      department: 'Computer Science',
      year: 4,
      cgpa: 8.5,
    });

    const internship = await Internship.create({
      source: 'off_campus',
      externalCompanyName: 'Goldman Sachs',
      title: 'Summer Analyst',
      description: 'Fintech engineering',
      duration: '2 months',
      mode: 'onsite',
      vacancies: 1,
      lastDate: new Date(),
      offCampusVerification: {
        status: 'pendingVerification',
        submittedBy: profile._id,
        submittedAt: new Date(),
        evidenceUrl: 'https://goldman.com/offer.pdf',
      },
    });

    const res = await fetch(`${baseUrl}/api/v1/tnp/off-campus-opportunities/${internship._id}/verify`, {
      method: 'PATCH',
      headers: authHeader(tnp),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.internship.status, 'open');
    assert.equal(body.data.internship.offCampusVerification.status, 'verified');
    assert.ok(body.data.application);
    assert.equal(body.data.application.currentStatus, 'tnpVerified');
  });

  it('GET /api/v1/analytics/dashboard includes offCampusStats', async () => {
    const tnp = await createTestUser(ROLES.TNP);
    const res = await fetch(`${baseUrl}/api/v1/analytics/dashboard`, {
      headers: authHeader(tnp),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.data.offCampusStats);
    assert.equal(typeof body.data.offCampusStats.total, 'number');
    assert.equal(typeof body.data.offCampusStats.campusCount, 'number');
    assert.equal(typeof body.data.offCampusStats.offCampusCount, 'number');
  });
});

