import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

import {
  ROLES,
  USER_STATUS,
  INTERNSHIP_SOURCE,
  OFF_CAMPUS_VERIFICATION_STATUS,
  INTERNSHIP_STATUS,
  APPLICATION_STATUS,
} from '../../src/utils/constants.js';

import { User } from '../../src/modules/auth/models/User.js';
import { StudentProfile } from '../../src/modules/student/models/StudentProfile.js';
import { Internship } from '../../src/modules/company/models/Internship.js';
import { Application } from '../../src/modules/student/models/Application.js';
import { MentorAssignment } from '../../src/modules/faculty/models/MentorAssignment.js';

import {
  submitOffCampusOpportunity,
  getStudentOffCampusOpportunities,
  getOffCampusVerificationQueue,
  verifyOffCampusOpportunity,
  rejectOffCampusOpportunity,
} from '../../src/modules/student/services/offCampus.service.js';

let replSet;

before(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const uri = replSet.getUri();
  await mongoose.connect(uri, { dbName: 'kaushal_offcampus_test' });
});

after(async () => {
  await mongoose.disconnect();
  await replSet.stop();
});

beforeEach(async () => {
  await Promise.all([
    User.deleteMany({}),
    StudentProfile.deleteMany({}),
    Internship.deleteMany({}),
    Application.deleteMany({}),
    MentorAssignment.deleteMany({}),
  ]);
});

async function createStudent(name = 'Test Student') {
  const user = await User.create({
    name,
    email: `student_${Date.now()}_${Math.random()}@test.demo`,
    passwordHash: 'hashed',
    role: ROLES.STUDENT,
    status: USER_STATUS.ACTIVE,
    department: 'Computer Science',
  });

  const profile = await StudentProfile.create({
    userId: user._id,
    department: 'Computer Science',
    year: 3,
    cgpa: 8.5,
    activeBacklogs: 0,
    skills: ['Node.js', 'React'],
    certifications: [],
  });

  return { user, profile };
}

async function createTnpAdmin() {
  return User.create({
    name: 'T&P Officer',
    email: `tnp_${Date.now()}_${Math.random()}@test.demo`,
    passwordHash: 'hashed',
    role: ROLES.TNP,
    status: USER_STATUS.ACTIVE,
  });
}

describe('Off-Campus Internship Service (offCampus.service.js)', () => {
  describe('submitOffCampusOpportunity', () => {
    it('creates an off-campus internship with pending verification and NO initial application', async () => {
      const { user, profile } = await createStudent('Alice');

      const payload = {
        companyName: 'Stripe India',
        title: 'Backend Engineering Intern',
        description: 'Building payment integration services',
        duration: '6 months',
        mode: 'remote',
        stipend: 50000,
        evidenceUrl: 'https://storage.example.com/offers/alice-stripe.pdf',
      };

      const internship = await submitOffCampusOpportunity(user._id.toString(), payload);

      assert.ok(internship._id);
      assert.equal(internship.source, INTERNSHIP_SOURCE.OFF_CAMPUS);
      assert.equal(internship.companyId, null);
      assert.equal(internship.externalCompanyName, 'Stripe India');
      assert.equal(internship.title, 'Backend Engineering Intern');
      assert.equal(internship.status, INTERNSHIP_STATUS.PENDING_APPROVAL);
      assert.equal(internship.offCampusVerification.status, OFF_CAMPUS_VERIFICATION_STATUS.PENDING);
      assert.equal(internship.offCampusVerification.submittedBy.toString(), profile._id.toString());
      assert.equal(internship.offCampusVerification.evidenceUrl, 'https://storage.example.com/offers/alice-stripe.pdf');

      // Verify that NO application was created yet
      const appCount = await Application.countDocuments({ studentId: profile._id });
      assert.equal(appCount, 0, 'No application should be created prior to institutional verification');
    });

    it('rejects submission with missing required fields', async () => {
      const { user } = await createStudent('Bob');

      await assert.rejects(
        () => submitOffCampusOpportunity(user._id.toString(), { companyName: 'Corp' }),
        { code: 'VALIDATION_ERROR' },
      );
    });

    it('rejects duplicate pending submission for same student and company', async () => {
      const { user } = await createStudent('Charlie');

      const payload = {
        companyName: 'Microsoft',
        title: 'SWE Intern',
        description: 'Core OS team',
        duration: '3 months',
        mode: 'hybrid',
      };

      await submitOffCampusOpportunity(user._id.toString(), payload);

      await assert.rejects(
        () => submitOffCampusOpportunity(user._id.toString(), payload),
        { code: 'CONFLICT' },
      );
    });
  });

  describe('getStudentOffCampusOpportunities', () => {
    it('returns only the requesting student\'s own off-campus opportunities', async () => {
      const student1 = await createStudent('Diana');
      const student2 = await createStudent('Evan');

      await submitOffCampusOpportunity(student1.user._id.toString(), {
        companyName: 'Company A',
        title: 'Role A',
        description: 'Desc A',
        duration: '3m',
        mode: 'onsite',
      });

      await submitOffCampusOpportunity(student2.user._id.toString(), {
        companyName: 'Company B',
        title: 'Role B',
        description: 'Desc B',
        duration: '6m',
        mode: 'remote',
      });

      const list1 = await getStudentOffCampusOpportunities(student1.user._id.toString());
      assert.equal(list1.length, 1);
      assert.equal(list1[0].externalCompanyName, 'Company A');
      assert.equal(list1[0].application, null);

      const list2 = await getStudentOffCampusOpportunities(student2.user._id.toString());
      assert.equal(list2.length, 1);
      assert.equal(list2[0].externalCompanyName, 'Company B');
    });
  });

  describe('getOffCampusVerificationQueue', () => {
    it('returns all pending submissions sorted oldest first with populated student info', async () => {
      const student = await createStudent('Fiona');

      await submitOffCampusOpportunity(student.user._id.toString(), {
        companyName: 'Alpha Tech',
        title: 'Frontend Intern',
        description: 'UI Dev',
        duration: '4m',
        mode: 'remote',
      });

      const queue = await getOffCampusVerificationQueue();
      assert.equal(queue.length, 1);
      assert.equal(queue[0].companyName, 'Alpha Tech');
      assert.equal(queue[0].student.name, 'Fiona');
      assert.equal(queue[0].student.department, 'Computer Science');
    });
  });

  describe('verifyOffCampusOpportunity', () => {
    it('allows T&P to verify opportunity and activates downstream Application in tnpVerified status', async () => {
      const student = await createStudent('George');
      const tnp = await createTnpAdmin();

      const created = await submitOffCampusOpportunity(student.user._id.toString(), {
        companyName: 'Meta',
        title: 'Infrastructure Intern',
        description: 'Distributed systems',
        duration: '6 months',
        mode: 'onsite',
        evidenceUrl: 'https://meta.com/offers/george.pdf',
      });

      const result = await verifyOffCampusOpportunity(created._id.toString(), {
        id: tnp._id.toString(),
        role: tnp.role,
      });

      // Verify Internship status updated
      assert.equal(result.internship.status, INTERNSHIP_STATUS.OPEN);
      assert.equal(result.internship.offCampusVerification.status, OFF_CAMPUS_VERIFICATION_STATUS.VERIFIED);
      assert.equal(result.internship.offCampusVerification.verifiedBy.toString(), tnp._id.toString());
      assert.ok(result.internship.offCampusVerification.verifiedAt);

      // Verify Application created directly in tnpVerified
      assert.ok(result.application);
      assert.equal(result.application.studentId.toString(), student.profile._id.toString());
      assert.equal(result.application.internshipId.toString(), created._id.toString());
      assert.equal(result.application.currentStatus, APPLICATION_STATUS.TNP_VERIFIED);
      assert.equal(result.application.eligibilitySnapshot.eligible, true);
      assert.equal(result.application.timeline.length, 2);
      assert.equal(result.application.timeline[1].toStatus, APPLICATION_STATUS.TNP_VERIFIED);

      // Verify student's opportunities list now includes the active application
      const studentList = await getStudentOffCampusOpportunities(student.user._id.toString());
      assert.equal(studentList.length, 1);
      assert.ok(studentList[0].application);
      assert.equal(studentList[0].application.currentStatus, APPLICATION_STATUS.TNP_VERIFIED);
    });

    it('rejects verification attempt by unauthorized role (student)', async () => {
      const student = await createStudent('Hannah');

      const created = await submitOffCampusOpportunity(student.user._id.toString(), {
        companyName: 'Startup XYZ',
        title: 'Dev Intern',
        description: 'Coding',
        duration: '2m',
        mode: 'remote',
      });

      await assert.rejects(
        () =>
          verifyOffCampusOpportunity(created._id.toString(), {
            id: student.user._id.toString(),
            role: ROLES.STUDENT,
          }),
        { code: 'FORBIDDEN' },
      );
    });
  });

  describe('rejectOffCampusOpportunity', () => {
    it('allows T&P to reject opportunity with mandatory reason without creating Application', async () => {
      const student = await createStudent('Ian');
      const tnp = await createTnpAdmin();

      const created = await submitOffCampusOpportunity(student.user._id.toString(), {
        companyName: 'Dubious Firm',
        title: 'Data Entry',
        description: 'Unrelated tasks',
        duration: '1m',
        mode: 'remote',
      });

      const rejected = await rejectOffCampusOpportunity(
        created._id.toString(),
        { id: tnp._id.toString(), role: tnp.role },
        'Offer documentation is incomplete and firm is unverified',
      );

      assert.equal(rejected.status, INTERNSHIP_STATUS.CANCELLED);
      assert.equal(rejected.offCampusVerification.status, OFF_CAMPUS_VERIFICATION_STATUS.REJECTED);
      assert.equal(
        rejected.offCampusVerification.rejectionReason,
        'Offer documentation is incomplete and firm is unverified',
      );
      assert.equal(rejected.offCampusVerification.verifiedBy.toString(), tnp._id.toString());

      // No application should exist
      const appCount = await Application.countDocuments({ studentId: student.profile._id });
      assert.equal(appCount, 0);
    });
  });
});
