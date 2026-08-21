import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

import { app } from '../../src/app.js';
import { env } from '../../src/config/env.js';
import { User } from '../../src/modules/auth/models/User.js';
import { StudentProfile } from '../../src/modules/student/models/StudentProfile.js';
import { CompanyProfile } from '../../src/modules/company/models/CompanyProfile.js';
import { Internship } from '../../src/modules/company/models/Internship.js';
import { Application } from '../../src/modules/student/models/Application.js';
import { MentorAssignment } from '../../src/modules/faculty/models/MentorAssignment.js';
import { ProgressLog } from '../../src/modules/student/models/ProgressLog.js';
import {
  ROLES,
  APPLICATION_STATUS,
  INTERNSHIP_STATUS,
  INTERNSHIP_MODE,
  MENTOR_ASSIGNMENT_STATUS,
  EVIDENCE_TYPE,
} from '../../src/utils/constants.js';

let replSet;
let server;
let baseUrl;

function authHeader(user) {
  const token = jwt.sign({ userId: user._id.toString() }, env.JWT_SECRET, { expiresIn: '1h' });
  return { Authorization: `Bearer ${token}` };
}

describe('Security & Ownership Hardening Tests', () => {
  let studentAUser, studentBUser;
  let studentAProfile, studentBProfile;
  let companyAUser, companyBUser;
  let companyAProfile, companyBProfile;
  let facultyAUser, facultyBUser;

  let internshipA, internshipB;
  let applicationA, applicationB;
  let progressLogA;

  before(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    const uri = replSet.getUri();
    await mongoose.connect(uri, { dbName: 'kaushal_ownership_test' });

    server = http.createServer(app);
    await new Promise((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });

    // 1. Create Users
    studentAUser = await User.create({
      name: 'Student A',
      email: 'studentA@test-hardening.com',
      passwordHash: 'hash',
      role: ROLES.STUDENT,
      department: 'Computer Science',
    });
    studentBUser = await User.create({
      name: 'Student B',
      email: 'studentB@test-hardening.com',
      passwordHash: 'hash',
      role: ROLES.STUDENT,
      department: 'Information Technology',
    });

    studentAProfile = await StudentProfile.create({
      userId: studentAUser._id,
      department: 'Computer Science',
      year: 3,
      cgpa: 8.5,
    });
    studentBProfile = await StudentProfile.create({
      userId: studentBUser._id,
      department: 'Information Technology',
      year: 3,
      cgpa: 9.0,
    });

    companyAUser = await User.create({
      name: 'Company A User',
      email: 'compA@test-hardening.com',
      passwordHash: 'hash',
      role: ROLES.COMPANY,
      status: 'verified',
    });
    companyBUser = await User.create({
      name: 'Company B User',
      email: 'compB@test-hardening.com',
      passwordHash: 'hash',
      role: ROLES.COMPANY,
      status: 'verified',
    });

    companyAProfile = await CompanyProfile.create({
      userId: companyAUser._id,
      companyName: 'Company Alpha',
      contactEmail: 'contact@alpha.com',
    });
    companyBProfile = await CompanyProfile.create({
      userId: companyBUser._id,
      companyName: 'Company Beta',
      contactEmail: 'contact@beta.com',
    });

    facultyAUser = await User.create({
      name: 'Faculty A',
      email: 'facultyA@test-hardening.com',
      passwordHash: 'hash',
      role: ROLES.FACULTY,
      department: 'Computer Science',
    });
    facultyBUser = await User.create({
      name: 'Faculty B',
      email: 'facultyB@test-hardening.com',
      passwordHash: 'hash',
      role: ROLES.FACULTY,
      department: 'Computer Science',
    });

    // 2. Create Internships
    internshipA = await Internship.create({
      companyId: companyAProfile._id,
      title: 'Alpha Role',
      description: 'Alpha description',
      duration: '3 months',
      mode: INTERNSHIP_MODE.REMOTE,
      vacancies: 2,
      lastDate: new Date(Date.now() + 10000000),
      status: INTERNSHIP_STATUS.OPEN,
    });

    internshipB = await Internship.create({
      companyId: companyBProfile._id,
      title: 'Beta Role',
      description: 'Beta description',
      duration: '3 months',
      mode: INTERNSHIP_MODE.REMOTE,
      vacancies: 2,
      lastDate: new Date(Date.now() + 10000000),
      status: INTERNSHIP_STATUS.OPEN,
    });

    // 3. Create Applications
    applicationA = await Application.create({
      studentId: studentAProfile._id,
      internshipId: internshipA._id,
      currentStatus: APPLICATION_STATUS.OFFERED,
      eligibilitySnapshot: { eligible: true, checks: [], computedAt: new Date() },
    });

    applicationB = await Application.create({
      studentId: studentBProfile._id,
      internshipId: internshipB._id,
      currentStatus: APPLICATION_STATUS.APPLIED,
      eligibilitySnapshot: { eligible: true, checks: [], computedAt: new Date() },
    });

    // 4. Progress Log & Mentor Assignment
    await MentorAssignment.create({
      applicationId: applicationA._id,
      facultyId: facultyAUser._id,
      status: MENTOR_ASSIGNMENT_STATUS.ACCEPTED,
    });

    progressLogA = await ProgressLog.create({
      applicationId: applicationA._id,
      weekLabel: 'Week 1',
      description: 'Done task 1',
      evidence: { type: EVIDENCE_TYPE.LINK, value: 'https://github.com' },
      verified: false,
    });
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect();
    await replSet.stop();
  });

  it('Student B cannot accept Student A offer (IDOR protection)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/student/applications/${applicationA._id}/accept`, {
      method: 'PATCH',
      headers: authHeader(studentBUser),
    });

    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'FORBIDDEN');
  });

  it('Student B cannot decline Student A offer (IDOR protection)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/student/applications/${applicationA._id}/decline`, {
      method: 'PATCH',
      headers: authHeader(studentBUser),
    });

    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'FORBIDDEN');
  });

  it('Company A cannot shortlist Student B application from Company B posting (IDOR protection)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/company/applications/${applicationB._id}/shortlist`, {
      method: 'PATCH',
      headers: authHeader(companyAUser),
    });

    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'FORBIDDEN');
  });

  it('Company A cannot reject Student B application from Company B posting (IDOR protection)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/company/applications/${applicationB._id}/reject`, {
      method: 'PATCH',
      headers: {
        ...authHeader(companyAUser),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reason: 'Unauthorized rejection attempt' }),
    });

    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'FORBIDDEN');
  });

  it('Faculty B cannot verify progress log of student assigned to Faculty A (IDOR protection)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/faculty/progress-logs/${progressLogA._id}/verify`, {
      method: 'PATCH',
      headers: authHeader(facultyBUser),
    });

    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'FORBIDDEN');
  });

  it('Faculty A can verify progress log of student assigned to Faculty A', async () => {
    const res = await fetch(`${baseUrl}/api/v1/faculty/progress-logs/${progressLogA._id}/verify`, {
      method: 'PATCH',
      headers: authHeader(facultyAUser),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.verified, true);
  });
});
