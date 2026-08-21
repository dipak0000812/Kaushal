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
  INTERNSHIP_STATUS,
  APPLICATION_STATUS,
} from '../../src/utils/constants.js';

import { User } from '../../src/modules/auth/models/User.js';
import { StudentProfile } from '../../src/modules/student/models/StudentProfile.js';
import { CompanyProfile } from '../../src/modules/company/models/CompanyProfile.js';
import { InviteToken } from '../../src/modules/onboarding/models/InviteToken.js';
import { Internship } from '../../src/modules/company/models/Internship.js';
import { Application } from '../../src/modules/student/models/Application.js';

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
  await mongoose.connect(uri, { dbName: 'kaushal_onboarding_test' });

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
    InviteToken.deleteMany({}),
    Internship.deleteMany({}),
    Application.deleteMany({}),
  ]);
});

describe('HTTP Onboarding & Authentication Layer', () => {
  describe('Student Registration — POST /api/v1/auth/register', () => {
    it('registers student and creates profile with JWT returned', async () => {
      const res = await fetch(`${baseUrl}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Aarav Sharma',
          email: 'aarav@univ.edu',
          password: 'Password123!',
          department: 'Computer Science',
          year: 3,
          cgpa: 8.5,
          skills: ['Python', 'Node.js'],
        }),
      });

      assert.equal(res.status, 201);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.ok(json.data.token);
      assert.equal(json.data.user.email, 'aarav@univ.edu');
      assert.equal(json.data.user.role, ROLES.STUDENT);
      assert.equal(json.data.user.status, USER_STATUS.ACTIVE);
      assert.equal(json.data.user.passwordHash, undefined);
      assert.equal(json.data.profile.department, 'Computer Science');
      assert.equal(json.data.profile.cgpa, 8.5);

      // Verify DB records
      const userInDb = await User.findOne({ email: 'aarav@univ.edu' });
      assert.ok(userInDb);
      const profileInDb = await StudentProfile.findOne({ userId: userInDb._id });
      assert.ok(profileInDb);
    });

    it('rejects duplicate email with 409 Conflict', async () => {
      await fetch(`${baseUrl}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'User 1',
          email: 'dup@univ.edu',
          password: 'Password123!',
          department: 'IT',
          year: 2,
          cgpa: 7.5,
        }),
      });

      const res = await fetch(`${baseUrl}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'User 2',
          email: 'dup@univ.edu',
          password: 'Password123!',
          department: 'IT',
          year: 2,
          cgpa: 7.5,
        }),
      });

      assert.equal(res.status, 409);
    });

    it('rejects invalid inputs with 400 Validation Error', async () => {
      const res = await fetch(`${baseUrl}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: '',
          email: 'bad-email',
          password: 'short',
        }),
      });

      assert.equal(res.status, 400);
    });
  });

  describe('Company Registration — POST /api/v1/auth/register/company', () => {
    it('registers company with invite token and starts in pending state', async () => {
      const invite = await InviteToken.create({
        companyName: 'Acme Corp',
        contactEmail: 'hr@acme.com',
        token: 'valid-token-12345678901234567890123456789012',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      const res = await fetch(`${baseUrl}/api/v1/auth/register/company`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inviteToken: invite.token,
          password: 'CompanySecret123!',
          companyName: 'Acme Corp',
          contactEmail: 'hr@acme.com',
          website: 'https://acme.com',
        }),
      });

      assert.equal(res.status, 201);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.equal(json.data.user.role, ROLES.COMPANY);
      assert.equal(json.data.user.status, USER_STATUS.PENDING);
      assert.equal(json.data.profile.companyName, 'Acme Corp');

      // Check invite token is marked used
      const updatedInvite = await InviteToken.findById(invite._id);
      assert.ok(updatedInvite.usedAt);
    });

    it('rejects already used invite token with 409', async () => {
      const invite = await InviteToken.create({
        companyName: 'Acme Corp',
        contactEmail: 'hr@acme.com',
        token: 'already-used-token-12345678901234567890',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        usedAt: new Date(),
      });

      const res = await fetch(`${baseUrl}/api/v1/auth/register/company`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inviteToken: invite.token,
          password: 'CompanySecret123!',
          companyName: 'Acme Corp',
          contactEmail: 'hr2@acme.com',
        }),
      });

      assert.equal(res.status, 409);
    });
  });

  describe('Universal Login & /me — POST /api/v1/auth/login and GET /api/v1/auth/me', () => {
    it('authenticates valid credentials and allows GET /me', async () => {
      await fetch(`${baseUrl}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Login Test',
          email: 'login@univ.edu',
          password: 'MyPassword123!',
          department: 'ECE',
          year: 4,
          cgpa: 9.0,
        }),
      });

      const loginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'login@univ.edu',
          password: 'MyPassword123!',
        }),
      });

      assert.equal(loginRes.status, 200);
      const loginJson = await loginRes.json();
      assert.ok(loginJson.data.token);

      const meRes = await fetch(`${baseUrl}/api/v1/auth/me`, {
        headers: { Authorization: `Bearer ${loginJson.data.token}` },
      });

      assert.equal(meRes.status, 200);
      const meJson = await meRes.json();
      assert.equal(meJson.data.user.email, 'login@univ.edu');
      assert.equal(meJson.data.profile.department, 'ECE');
    });

    it('rejects incorrect password with 401 Unauthorized', async () => {
      const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'nonexistent@univ.edu',
          password: 'WrongPassword!',
        }),
      });

      assert.equal(res.status, 401);
    });
  });

  describe('Student Profile Update — PATCH /api/v1/student/profile', () => {
    it('allows updating profile before any application is submitted', async () => {
      const regRes = await fetch(`${baseUrl}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Priya Patel',
          email: 'priya@univ.edu',
          password: 'Password123!',
          department: 'CSE',
          year: 3,
          cgpa: 8.0,
        }),
      });
      const regJson = await regRes.json();
      const token = regJson.data.token;

      const patchRes = await fetch(`${baseUrl}/api/v1/student/profile`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          cgpa: 8.8,
          skills: ['React', 'TypeScript'],
        }),
      });

      assert.equal(patchRes.status, 200);
      const patchJson = await patchRes.json();
      assert.equal(patchJson.data.cgpa, 8.8);
      assert.deepEqual(patchJson.data.skills, ['React', 'TypeScript']);
    });

    it('locks profile (409) once an application has been submitted', async () => {
      const regRes = await fetch(`${baseUrl}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Locked Student',
          email: 'locked@univ.edu',
          password: 'Password123!',
          department: 'CSE',
          year: 3,
          cgpa: 8.0,
        }),
      });
      const regJson = await regRes.json();
      const token = regJson.data.token;
      const profile = regJson.data.profile;

      // Simulate an application in the DB
      const dummyCompanyUser = await User.create({
        name: 'Co',
        email: 'co@corp.com',
        passwordHash: 'hash',
        role: ROLES.COMPANY,
        status: USER_STATUS.VERIFIED,
      });
      const companyProf = await CompanyProfile.create({
        userId: dummyCompanyUser._id,
        companyName: 'Co',
        contactEmail: 'co@corp.com',
      });
      const internship = await Internship.create({
        companyId: companyProf._id,
        title: 'SWE Intern',
        description: 'Desc',
        duration: 3,
        mode: 'remote',
        vacancies: 2,
        lastDate: new Date(Date.now() + 1000000),
        status: INTERNSHIP_STATUS.OPEN,
      });

      await Application.create({
        studentId: profile._id,
        internshipId: internship._id,
        eligibilitySnapshot: {
          eligible: true,
          checks: [{ criterion: 'DEPARTMENT', pass: true, reason: 'Matched' }],
          computedAt: new Date(),
        },
        currentStatus: APPLICATION_STATUS.APPLIED,
      });

      const patchRes = await fetch(`${baseUrl}/api/v1/student/profile`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ cgpa: 9.5 }),
      });

      assert.equal(patchRes.status, 409);
    });
  });

  describe('T&P Operations — /api/v1/tnp/*', () => {
    let tnpUser;

    beforeEach(async () => {
      tnpUser = await User.create({
        name: 'T&P Officer',
        email: 'tnp@univ.edu',
        passwordHash: 'hash',
        role: ROLES.TNP,
        status: USER_STATUS.ACTIVE,
      });
    });

    it('generates company invite tokens (POST /api/v1/tnp/invites)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/tnp/invites`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader(tnpUser),
        },
        body: JSON.stringify({
          companyName: 'Google',
          contactEmail: 'recruiting@google.com',
        }),
      });

      assert.equal(res.status, 201);
      const json = await res.json();
      assert.ok(json.data.inviteToken);
      assert.equal(json.data.companyName, 'Google');
    });

    it('provisions faculty accounts (POST /api/v1/tnp/users/faculty)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/tnp/users/faculty`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader(tnpUser),
        },
        body: JSON.stringify({
          name: 'Prof. Alan Turing',
          email: 'turing@univ.edu',
          password: 'FacultySecret123!',
          department: 'Computer Science',
        }),
      });

      assert.equal(res.status, 201);
      const json = await res.json();
      assert.equal(json.data.role, ROLES.FACULTY);
      assert.equal(json.data.department, 'Computer Science');
      assert.equal(json.data.createdBy, tnpUser._id.toString());
    });

    it('provisions HOD accounts (POST /api/v1/tnp/users/hod)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/tnp/users/hod`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader(tnpUser),
        },
        body: JSON.stringify({
          name: 'Dr. Ada Lovelace',
          email: 'ada@univ.edu',
          password: 'HodSecret123!',
          department: 'Mathematics',
        }),
      });

      assert.equal(res.status, 201);
      const json = await res.json();
      assert.equal(json.data.role, ROLES.HOD);
      assert.equal(json.data.department, 'Mathematics');
    });

    it('verifies pending company via PATCH /api/v1/tnp/companies/:id/verify', async () => {
      const companyUser = await User.create({
        name: 'Pending Tech Inc',
        email: 'hr@pendingtech.com',
        passwordHash: 'hash',
        role: ROLES.COMPANY,
        status: USER_STATUS.PENDING,
      });

      const companyProf = await CompanyProfile.create({
        userId: companyUser._id,
        companyName: 'Pending Tech Inc',
        contactEmail: 'hr@pendingtech.com',
      });

      // Add a pendingApproval internship
      await Internship.create({
        companyId: companyProf._id,
        title: 'Backend Intern',
        description: 'Node.js',
        duration: 6,
        mode: 'remote',
        vacancies: 3,
        lastDate: new Date(Date.now() + 1000000),
        status: INTERNSHIP_STATUS.PENDING_APPROVAL,
      });

      const res = await fetch(`${baseUrl}/api/v1/tnp/companies/${companyUser._id}/verify`, {
        method: 'PATCH',
        headers: {
          ...authHeader(tnpUser),
        },
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.data.status, USER_STATUS.VERIFIED);
      assert.equal(json.data.publishedCount, 1);

      // Verify DB updates
      const updatedUser = await User.findById(companyUser._id);
      assert.equal(updatedUser.status, USER_STATUS.VERIFIED);
      const publishedInternship = await Internship.findOne({ companyId: companyProf._id });
      assert.equal(publishedInternship.status, INTERNSHIP_STATUS.OPEN);
    });

    it('enforces RBAC — non-T&P cannot call T&P endpoints', async () => {
      const studentUser = await User.create({
        name: 'Student Regular',
        email: 'student@univ.edu',
        passwordHash: 'hash',
        role: ROLES.STUDENT,
        status: USER_STATUS.ACTIVE,
      });

      const res = await fetch(`${baseUrl}/api/v1/tnp/invites`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader(studentUser),
        },
        body: JSON.stringify({
          companyName: 'Google',
          contactEmail: 'recruiting@google.com',
        }),
      });

      assert.equal(res.status, 403);
    });
  });
});
