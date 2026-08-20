import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { connectDB, disconnectDB } from '../../config/database.js';
import {
  ROLES,
  USER_STATUS,
  INTERNSHIP_STATUS,
  INTERNSHIP_MODE,
  APPLICATION_STATUS,
  MENTOR_ASSIGNMENT_STATUS,
  EVIDENCE_TYPE,
} from '../../utils/constants.js';

import { User } from '../../modules/auth/models/User.js';
import { InviteToken } from '../../modules/onboarding/models/InviteToken.js';
import { StudentProfile } from '../../modules/student/models/StudentProfile.js';
import { CompanyProfile } from '../../modules/company/models/CompanyProfile.js';
import { Internship } from '../../modules/company/models/Internship.js';
import { Application } from '../../modules/student/models/Application.js';
import { MentorAssignment } from '../../modules/faculty/models/MentorAssignment.js';
import { ProgressLog } from '../../modules/student/models/ProgressLog.js';
import { Dismissal } from '../../modules/risk/models/Dismissal.js';

import { evaluate } from '../../modules/eligibility/eligibilityEngine.js';
import { applyTransition } from '../../modules/student/services/applicationTransition.service.js';
import { acceptOffer } from '../../modules/student/services/applicationLifecycle.service.js';
import { verifyCompany } from '../../modules/onboarding/services/companyVerification.service.js';

const DEFAULT_PASSWORD = 'Password123!';

async function seed() {
  console.log('🌱 Starting Kaushal dev/demo database seed...\n');

  await connectDB();

  // ── 0. Clear all relevant collections ──────────────────────────────────────
  console.log('🧹 Clearing existing collections...');
  await Promise.all([
    User.deleteMany({}),
    StudentProfile.deleteMany({}),
    CompanyProfile.deleteMany({}),
    Internship.deleteMany({}),
    Application.deleteMany({}),
    MentorAssignment.deleteMany({}),
    ProgressLog.deleteMany({}),
    Dismissal.deleteMany({}),
    InviteToken.deleteMany({}),
  ]);
  console.log('✅ Collections cleared.\n');

  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  // ── 1. TNP Root Account (1) ───────────────────────────────────────────────
  console.log('👤 Creating T&P Admin...');
  const tnpUser = await User.create({
    name: 'Prof. S. K. Kulkarni (T&P Head)',
    email: 'tnp@trackintern.demo',
    passwordHash,
    role: ROLES.TNP,
    status: USER_STATUS.ACTIVE,
  });

  // ── 2. Faculty (2) & HOD (1) Accounts ─────────────────────────────────────
  console.log('🎓 Creating Faculty and HOD accounts...');
  const faculty1 = await User.create({
    name: 'Dr. Ramesh Sharma',
    email: 'faculty.cse@kaushal.demo',
    passwordHash,
    role: ROLES.FACULTY,
    department: 'Computer Science',
    status: USER_STATUS.ACTIVE,
    createdBy: tnpUser._id,
  });

  const faculty2 = await User.create({
    name: 'Dr. Priya Patel',
    email: 'faculty.ece@kaushal.demo',
    passwordHash,
    role: ROLES.FACULTY,
    department: 'Electronics',
    status: USER_STATUS.ACTIVE,
    createdBy: tnpUser._id,
  });

  const hodCse = await User.create({
    name: 'Dr. Amit Deshmukh',
    email: 'hod.cse@kaushal.demo',
    passwordHash,
    role: ROLES.HOD,
    department: 'Computer Science',
    status: USER_STATUS.ACTIVE,
    createdBy: tnpUser._id,
  });

  // ── 3. Company Accounts (6 total: 4 verified, 2 pending) ─────────────────
  console.log('🏢 Creating Company accounts and profiles...');
  // 4 already-verified companies
  const companyData = [
    { name: 'Northbridge Systems', email: 'contact@northbridge.demo', website: 'https://northbridge.example.com' },
    { name: 'Cascade Analytics', email: 'contact@cascade.demo', website: 'https://cascade.example.com' },
    { name: 'Apex Cloud Solutions', email: 'contact@apexcloud.demo', website: 'https://apexcloud.example.com' },
    { name: 'Veridian Dynamics', email: 'contact@veridian.demo', website: 'https://veridian.example.com' },
  ];

  const verifiedCompanyProfiles = [];
  for (const c of companyData) {
    const user = await User.create({
      name: `${c.name} Admin`,
      email: c.email,
      passwordHash,
      role: ROLES.COMPANY,
      status: USER_STATUS.VERIFIED,
    });
    const profile = await CompanyProfile.create({
      userId: user._id,
      companyName: c.name,
      contactEmail: c.email,
      website: c.website,
    });
    verifiedCompanyProfiles.push({ user, profile });
  }

  // Company 5: Created pending, then verified via verifyCompany() service
  const comp5User = await User.create({
    name: 'Nexus AI Labs Admin',
    email: 'contact@nexusai.demo',
    passwordHash,
    role: ROLES.COMPANY,
    status: USER_STATUS.PENDING,
  });
  const comp5Profile = await CompanyProfile.create({
    userId: comp5User._id,
    companyName: 'Nexus AI Labs',
    contactEmail: 'contact@nexusai.demo',
    website: 'https://nexusai.example.com',
  });

  // Postings created pendingApproval for Company 5
  const comp5Postings = await Internship.create([
    {
      companyId: comp5Profile._id,
      title: 'AI / Deep Learning Research Intern',
      description: 'Train deep learning models for NLP and multimodal analysis.',
      duration: '6 months',
      mode: INTERNSHIP_MODE.HYBRID,
      vacancies: 2,
      lastDate: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000),
      status: INTERNSHIP_STATUS.PENDING_APPROVAL,
      criteria: {
        minCgpa: 8.5,
        maxBacklogs: 0,
        departments: ['Computer Science'],
        requiredSkills: ['Machine Learning', 'Python'],
        requiredCerts: [],
      },
    },
    {
      companyId: comp5Profile._id,
      title: 'Full Stack AI Product Intern',
      description: 'Build user-facing web applications integrated with LLM pipelines.',
      duration: '6 months',
      mode: INTERNSHIP_MODE.REMOTE,
      vacancies: 3,
      lastDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
      status: INTERNSHIP_STATUS.PENDING_APPROVAL,
      criteria: {
        minCgpa: 7.5,
        maxBacklogs: 1,
        departments: ['Computer Science', 'Information Technology'],
        requiredSkills: ['React', 'Python'],
        requiredCerts: [],
      },
    },
  ]);

  // Execute verifyCompany service for Company 5 — auto-publishes postings
  console.log('⚡ Calling verifyCompany() service on Nexus AI Labs...');
  const verifyResult = await verifyCompany(comp5User._id.toString(), {
    id: tnpUser._id.toString(),
    role: ROLES.TNP,
  });
  console.log(`   Nexus AI Labs verified, auto-published ${verifyResult.publishedCount} postings.`);

  // Company 6: Remains pending with pendingApproval postings
  const comp6User = await User.create({
    name: 'Solaris Robotics Admin',
    email: 'contact@solaris.demo',
    passwordHash,
    role: ROLES.COMPANY,
    status: USER_STATUS.PENDING,
  });
  const comp6Profile = await CompanyProfile.create({
    userId: comp6User._id,
    companyName: 'Solaris Robotics',
    contactEmail: 'contact@solaris.demo',
    website: 'https://solaris.example.com',
  });

  await Internship.create([
    {
      companyId: comp6Profile._id,
      title: 'Robotics Control Systems Intern',
      description: 'Design real-time ROS control nodes for autonomous rovers.',
      duration: '3 months',
      mode: INTERNSHIP_MODE.ONSITE,
      vacancies: 1,
      lastDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
      status: INTERNSHIP_STATUS.PENDING_APPROVAL,
      criteria: { minCgpa: 7.0, maxBacklogs: 0, departments: ['Electronics', 'Mechanical'] },
    },
    {
      companyId: comp6Profile._id,
      title: 'Hardware Simulation Intern',
      description: 'Simulate mechanical and electronics components in Gazebo.',
      duration: '3 months',
      mode: INTERNSHIP_MODE.ONSITE,
      vacancies: 2,
      lastDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
      status: INTERNSHIP_STATUS.PENDING_APPROVAL,
      criteria: { minCgpa: 6.5, maxBacklogs: 1, departments: ['Mechanical'] },
    },
  ]);

  // Invite Token fixture (unconsumed)
  await InviteToken.create({
    companyName: 'Zephyr Quantum Inc',
    contactEmail: 'invite@zephyr.example.com',
    token: 'zephyr-invite-token-secure-2026',
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  // ── 4. Student Accounts & Profiles (12 Students) ──────────────────────────
  console.log('📚 Creating 12 student accounts and profiles with realistic variance...');
  const studentRaw = [
    { name: 'Aarav Mehta', email: 'aarav.mehta@student.demo', dept: 'Computer Science', year: 4, cgpa: 9.6, backlogs: 0, skills: ['Node.js', 'React', 'MongoDB', 'TypeScript', 'Docker', 'SQL'], certs: ['AWS Certified Developer'] },
    { name: 'Ananya Sen', email: 'ananya.sen@student.demo', dept: 'Computer Science', year: 4, cgpa: 9.1, backlogs: 0, skills: ['Python', 'Django', 'PostgreSQL', 'Machine Learning', 'SQL'], certs: ['TensorFlow Developer'] },
    { name: 'Rohan Gupta', email: 'rohan.gupta@student.demo', dept: 'Computer Science', year: 3, cgpa: 8.5, backlogs: 0, skills: ['Java', 'Spring Boot', 'MySQL', 'Docker'], certs: [] },
    { name: 'Ishaan Verma', email: 'ishaan.verma@student.demo', dept: 'Electronics', year: 4, cgpa: 8.2, backlogs: 0, skills: ['C++', 'Embedded C', 'IoT', 'Python', 'Linux'], certs: ['Embedded Systems Certificate'] },
    { name: 'Meera Nair', email: 'meera.nair@student.demo', dept: 'Information Technology', year: 4, cgpa: 7.8, backlogs: 0, skills: ['React', 'JavaScript', 'HTML/CSS', 'Tailwind', 'Node.js'], certs: [] },
    { name: 'Aditya Joshi', email: 'aditya.joshi@student.demo', dept: 'Computer Science', year: 3, cgpa: 7.5, backlogs: 1, skills: ['Python', 'Flask', 'SQL', 'Git'], certs: [] },
    { name: 'Tanvi Kulkarni', email: 'tanvi.kulkarni@student.demo', dept: 'Electronics', year: 3, cgpa: 7.2, backlogs: 1, skills: ['MATLAB', 'VLSI', 'C++', 'Python'], certs: [] },
    { name: 'Siddharth Rao', email: 'siddharth.rao@student.demo', dept: 'Information Technology', year: 4, cgpa: 6.9, backlogs: 2, skills: ['PHP', 'MySQL', 'JavaScript', 'HTML/CSS'], certs: [] },
    { name: 'Pooja Hegde', email: 'pooja.hegde@student.demo', dept: 'Mechanical', year: 4, cgpa: 6.5, backlogs: 2, skills: ['AutoCAD', 'SolidWorks', 'Python Basics'], certs: [] },
    { name: 'Vikram Malhotra', email: 'vikram.malhotra@student.demo', dept: 'Computer Science', year: 3, cgpa: 6.1, backlogs: 3, skills: ['C', 'Java Basics', 'HTML'], certs: [] },
    // Multi-offer student:
    { name: 'Neha Roy', email: 'neha.roy@student.demo', dept: 'Computer Science', year: 4, cgpa: 8.8, backlogs: 0, skills: ['React', 'Node.js', 'SQL', 'GraphQL', 'TypeScript', 'AWS'], certs: ['AWS Certified Solutions Architect'] },
    { name: 'Kabir Khan', email: 'kabir.khan@student.demo', dept: 'Information Technology', year: 4, cgpa: 7.1, backlogs: 0, skills: ['Java', 'Android', 'Kotlin', 'Firebase'], certs: ['Google Associate Android Developer'] },
  ];

  const students = [];
  for (const s of studentRaw) {
    const user = await User.create({
      name: s.name,
      email: s.email,
      passwordHash,
      role: ROLES.STUDENT,
      department: s.dept,
      status: USER_STATUS.ACTIVE,
    });
    const profile = await StudentProfile.create({
      userId: user._id,
      department: s.dept,
      year: s.year,
      cgpa: s.cgpa,
      activeBacklogs: s.backlogs,
      skills: s.skills,
      certifications: s.certs,
      resumeUrl: `https://storage.kaushal.demo/resumes/${user._id}.pdf`,
    });
    students.push({ user, profile });
  }

  // ── 5. Internship Postings across Verified Companies (10 Postings) ────────
  console.log('📋 Creating 10 Internship postings with criteria variation...');
  const pNorthbridge = verifiedCompanyProfiles[0].profile;
  const pCascade = verifiedCompanyProfiles[1].profile;
  const pApex = verifiedCompanyProfiles[2].profile;
  const pVeridian = verifiedCompanyProfiles[3].profile;

  const postings = await Internship.create([
    // Posting 0: IMPOSSIBLE criteria — minCgpa 9.8 (max seeded is 9.6) + Rust / Kubernetes
    // Guaranteed 0 eligible applicants across all 12 seeded students.
    {
      companyId: pNorthbridge._id,
      title: 'Principal Systems Architecture Intern',
      description: 'Design distributed storage engines in Rust for mission-critical infrastructure.',
      duration: '6 months',
      mode: INTERNSHIP_MODE.REMOTE,
      vacancies: 1,
      lastDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: INTERNSHIP_STATUS.OPEN,
      criteria: {
        minCgpa: 9.8,
        maxBacklogs: 0,
        departments: ['Computer Science'],
        requiredSkills: ['Rust', 'Kubernetes', 'Distributed Systems'],
        requiredCerts: ['Certified Kubernetes Administrator'],
      },
    },
    // Posting 1: Lenient criteria (SQL, minCgpa 6.0)
    {
      companyId: pCascade._id,
      title: 'Junior Data Analyst Intern',
      description: 'Analyze operational telemetry and build business intelligence dashboards.',
      duration: '3 months',
      mode: INTERNSHIP_MODE.HYBRID,
      vacancies: 4,
      lastDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
      status: INTERNSHIP_STATUS.OPEN,
      criteria: {
        minCgpa: 6.0,
        maxBacklogs: 3,
        departments: ['Computer Science', 'Information Technology', 'Electronics'],
        requiredSkills: ['SQL'],
        requiredCerts: [],
      },
    },
    // Posting 2: Lenient frontend criteria (React, minCgpa 6.5)
    {
      companyId: pApex._id,
      title: 'Frontend Web Developer Intern',
      description: 'Develop responsive client dashboards with modern React and component libraries.',
      duration: '6 months',
      mode: INTERNSHIP_MODE.REMOTE,
      vacancies: 3,
      lastDate: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000),
      status: INTERNSHIP_STATUS.OPEN,
      criteria: {
        minCgpa: 6.5,
        maxBacklogs: 2,
        departments: ['Computer Science', 'Information Technology'],
        requiredSkills: ['React'],
        requiredCerts: [],
      },
    },
    // Posting 3: General software engineering criteria (Python, minCgpa 6.5)
    {
      companyId: pVeridian._id,
      title: 'General Software Engineering Intern',
      description: 'Work across backend microservices, automation scripts, and test pipelines.',
      duration: '6 months',
      mode: INTERNSHIP_MODE.HYBRID,
      vacancies: 3,
      lastDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: INTERNSHIP_STATUS.OPEN,
      criteria: {
        minCgpa: 6.5,
        maxBacklogs: 1,
        departments: ['Computer Science', 'Information Technology', 'Electronics'],
        requiredSkills: ['Python'],
        requiredCerts: [],
      },
    },
    // Posting 4: Tight-fit criteria — matches ONLY Ishaan Verma (S4, ECE, CGPA 8.2, Embedded C, IoT)
    {
      companyId: pNorthbridge._id,
      title: 'Embedded IoT Firmware Intern',
      description: 'Develop low-power firmware for ARM microcontrollers and edge sensors.',
      duration: '6 months',
      mode: INTERNSHIP_MODE.ONSITE,
      vacancies: 1,
      lastDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
      status: INTERNSHIP_STATUS.OPEN,
      criteria: {
        minCgpa: 8.0,
        maxBacklogs: 0,
        departments: ['Electronics'],
        requiredSkills: ['Embedded C', 'IoT'],
        requiredCerts: [],
      },
    },
    // Posting 5: Backend Node.js
    {
      companyId: pCascade._id,
      title: 'Backend Systems Intern (Node.js)',
      description: 'Build high-throughput REST APIs and transactional services.',
      duration: '6 months',
      mode: INTERNSHIP_MODE.HYBRID,
      vacancies: 2,
      lastDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
      status: INTERNSHIP_STATUS.OPEN,
      criteria: {
        minCgpa: 7.5,
        maxBacklogs: 0,
        departments: ['Computer Science', 'Information Technology'],
        requiredSkills: ['Node.js', 'SQL'],
        requiredCerts: [],
      },
    },
    // Posting 6: Cloud DevOps
    {
      companyId: pApex._id,
      title: 'Cloud Infrastructure & DevOps Intern',
      description: 'Manage AWS infrastructure, Docker containerization, and CI/CD pipelines.',
      duration: '6 months',
      mode: INTERNSHIP_MODE.REMOTE,
      vacancies: 1,
      lastDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: INTERNSHIP_STATUS.OPEN,
      criteria: {
        minCgpa: 8.0,
        maxBacklogs: 0,
        departments: ['Computer Science'],
        requiredSkills: ['Docker', 'AWS'],
        requiredCerts: [],
      },
    },
    // Posting 7: Mobile Android
    {
      companyId: pVeridian._id,
      title: 'Android Mobile Application Intern',
      description: 'Develop Android applications using Kotlin and modern architecture components.',
      duration: '4 months',
      mode: INTERNSHIP_MODE.REMOTE,
      vacancies: 1,
      lastDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
      status: INTERNSHIP_STATUS.OPEN,
      criteria: {
        minCgpa: 7.0,
        maxBacklogs: 1,
        departments: ['Information Technology'],
        requiredSkills: ['Kotlin'],
        requiredCerts: [],
      },
    },
    // Include the 2 postings from Nexus AI Labs (already open via verifyCompany)
    comp5Postings[0],
    comp5Postings[1],
  ]);

  // ── 6. Applications with State Machine Transitions ─────────────────────────
  console.log('🔄 Seeding Application lifecycles via service layer...');

  const notableDemos = {};

  // Helper to create an initial application doc with computed eligibility
  async function createInitialApp(studentIdx, postingIdx) {
    const student = students[studentIdx];
    const posting = postings[postingIdx];
    const snapshot = evaluate(student.profile.toObject(), posting.criteria);

    return Application.create({
      studentId: student.profile._id,
      internshipId: posting._id,
      currentStatus: APPLICATION_STATUS.APPLIED,
      eligibilitySnapshot: snapshot,
      timeline: [
        {
          fromStatus: null,
          toStatus: APPLICATION_STATUS.APPLIED,
          actorId: student.user._id,
          actorRole: ROLES.STUDENT,
          reason: 'Application submitted',
          at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
      ],
    });
  }

  // ── 6a. 2 applications left at 'applied' ──────────────────────────────────
  const appApplied1 = await createInitialApp(4, 1); // S5 Meera Nair -> Junior Data Analyst
  const appApplied2 = await createInitialApp(5, 1); // S6 Aditya Joshi -> Junior Data Analyst

  // ── 6b. 2 applications at 'shortlisted' ────────────────────────────────────
  const appShortlisted1 = await createInitialApp(2, 5); // S3 Rohan Gupta -> Backend Node
  await applyTransition(appShortlisted1._id.toString(), APPLICATION_STATUS.SHORTLISTED, {
    id: verifiedCompanyProfiles[1].user._id.toString(),
    role: ROLES.COMPANY,
  }, 'Selected for technical interview');

  const appShortlisted2 = await createInitialApp(11, 7); // S12 Kabir Khan -> Android
  await applyTransition(appShortlisted2._id.toString(), APPLICATION_STATUS.SHORTLISTED, {
    id: verifiedCompanyProfiles[3].user._id.toString(),
    role: ROLES.COMPANY,
  }, 'Strong Android portfolio');

  // ── 6c. 1 application at 'rejected' ───────────────────────────────────────
  const appRejected = await createInitialApp(7, 2); // S8 Siddharth Rao -> Frontend Web
  await applyTransition(appRejected._id.toString(), APPLICATION_STATUS.REJECTED, {
    id: verifiedCompanyProfiles[2].user._id.toString(),
    role: ROLES.COMPANY,
  }, 'Did not meet requirements for senior stack');

  // ── 6d. Multi-offer: 3 applications for S11 (Neha Roy), acceptOffer on 1 ──
  // S11 applied to Posting 1, 2, 5
  const s11 = students[10]; // Neha Roy
  const appMulti1 = await createInitialApp(10, 1); // Posting 1
  const appMulti2 = await createInitialApp(10, 2); // Posting 2
  const appMulti3 = await createInitialApp(10, 5); // Posting 5 (Backend Node)

  // Move all 3 to 'offered' via applyTransition
  for (const [app, compIdx] of [[appMulti1, 1], [appMulti2, 2], [appMulti3, 1]]) {
    await applyTransition(app._id.toString(), APPLICATION_STATUS.SHORTLISTED, {
      id: verifiedCompanyProfiles[compIdx].user._id.toString(),
      role: ROLES.COMPANY,
    });
    await applyTransition(app._id.toString(), APPLICATION_STATUS.OFFERED, {
      id: verifiedCompanyProfiles[compIdx].user._id.toString(),
      role: ROLES.COMPANY,
    }, 'Offer letter extended');
  }

  // Accept AppMulti3 via real acceptOffer() service -> auto-withdraws AppMulti1 and AppMulti2
  console.log('⚡ Calling acceptOffer() service for student Neha Roy...');
  const acceptResult = await acceptOffer(appMulti3._id.toString(), {
    id: s11.user._id.toString(),
    role: ROLES.STUDENT,
  });
  console.log(`   Offer accepted! Sibling auto-withdrawn count: ${acceptResult.withdrawnCount}`);
  notableDemos.multiOffer = {
    studentEmail: s11.user.email,
    acceptedAppId: appMulti3._id.toString(),
    withdrawnAppIds: [appMulti1._id.toString(), appMulti2._id.toString()],
  };

  // ── 6e. Mentor Reject & Requeue ───────────────────────────────────────────
  // S1 -> Posting 6 (Cloud DevOps)
  const appMentorReject = await createInitialApp(0, 6);
  const s1User = students[0].user;
  const compApexUser = verifiedCompanyProfiles[2].user;

  await applyTransition(appMentorReject._id.toString(), APPLICATION_STATUS.SHORTLISTED, { id: compApexUser._id.toString(), role: ROLES.COMPANY });
  await applyTransition(appMentorReject._id.toString(), APPLICATION_STATUS.OFFERED, { id: compApexUser._id.toString(), role: ROLES.COMPANY });
  await applyTransition(appMentorReject._id.toString(), APPLICATION_STATUS.ACCEPTED, { id: s1User._id.toString(), role: ROLES.STUDENT });
  await applyTransition(appMentorReject._id.toString(), APPLICATION_STATUS.TNP_VERIFIED, { id: tnpUser._id.toString(), role: ROLES.TNP }, 'Offer verified by T&P');
  await applyTransition(appMentorReject._id.toString(), APPLICATION_STATUS.MENTOR_PENDING, { id: tnpUser._id.toString(), role: ROLES.TNP }, 'Assigned to Dr. Ramesh Sharma');

  // Create MentorAssignment in pending
  const assignmentReject = await MentorAssignment.create({
    applicationId: appMentorReject._id,
    facultyId: faculty1._id,
    status: MENTOR_ASSIGNMENT_STATUS.PENDING,
  });

  // Faculty rejects -> status updated to rejected, transition application back to tnpVerified
  assignmentReject.status = MENTOR_ASSIGNMENT_STATUS.REJECTED;
  assignmentReject.rejectReason = 'Faculty mentorship quota exceeded for current semester';
  await assignmentReject.save();

  await applyTransition(
    appMentorReject._id.toString(),
    APPLICATION_STATUS.TNP_VERIFIED,
    { id: faculty1._id.toString(), role: ROLES.FACULTY },
    'Faculty rejected assignment — returned to T&P queue',
  );
  notableDemos.mentorReject = {
    applicationId: appMentorReject._id.toString(),
    rejectedAssignmentId: assignmentReject._id.toString(),
  };

  // ── 6f. Healthy In-Progress Application ───────────────────────────────────
  // S2 (Ananya Sen) -> Posting 8 (Nexus AI Deep Learning)
  const appHealthy = await createInitialApp(1, 8);
  const s2User = students[1].user;
  const compNexusUser = comp5User;

  await applyTransition(appHealthy._id.toString(), APPLICATION_STATUS.SHORTLISTED, { id: compNexusUser._id.toString(), role: ROLES.COMPANY });
  await applyTransition(appHealthy._id.toString(), APPLICATION_STATUS.OFFERED, { id: compNexusUser._id.toString(), role: ROLES.COMPANY });
  await applyTransition(appHealthy._id.toString(), APPLICATION_STATUS.ACCEPTED, { id: s2User._id.toString(), role: ROLES.STUDENT });
  await applyTransition(appHealthy._id.toString(), APPLICATION_STATUS.TNP_VERIFIED, { id: tnpUser._id.toString(), role: ROLES.TNP });
  await applyTransition(appHealthy._id.toString(), APPLICATION_STATUS.MENTOR_PENDING, { id: tnpUser._id.toString(), role: ROLES.TNP });

  await MentorAssignment.create({
    applicationId: appHealthy._id,
    facultyId: faculty1._id,
    status: MENTOR_ASSIGNMENT_STATUS.ACCEPTED,
  });

  await applyTransition(appHealthy._id.toString(), APPLICATION_STATUS.MENTOR_ASSIGNED, { id: faculty1._id.toString(), role: ROLES.FACULTY });
  await applyTransition(appHealthy._id.toString(), APPLICATION_STATUS.IN_PROGRESS, { id: s2User._id.toString(), role: ROLES.STUDENT }, 'First progress log submitted');

  // Staggered healthy progress logs across past 3 weeks
  const nowMs = Date.now();
  const DAY_MS = 24 * 60 * 60 * 1000;
  await ProgressLog.create([
    {
      applicationId: appHealthy._id,
      weekLabel: 'Week 1',
      description: 'Completed repository setup, dataset download, and EDA baseline.',
      evidence: { type: EVIDENCE_TYPE.LINK, value: 'https://github.com/kaushal-demo/ai-pipeline/pull/1' },
      verified: true,
      verifiedBy: faculty1._id,
      verifiedAt: new Date(nowMs - 18 * DAY_MS),
      createdAt: new Date(nowMs - 20 * DAY_MS),
    },
    {
      applicationId: appHealthy._id,
      weekLabel: 'Week 2',
      description: 'Implemented PyTorch DataLoader and feature tokenization modules.',
      evidence: { type: EVIDENCE_TYPE.LINK, value: 'https://github.com/kaushal-demo/ai-pipeline/pull/2' },
      verified: true,
      verifiedBy: faculty1._id,
      verifiedAt: new Date(nowMs - 11 * DAY_MS),
      createdAt: new Date(nowMs - 13 * DAY_MS),
    },
    {
      applicationId: appHealthy._id,
      weekLabel: 'Week 3',
      description: 'Trained baseline transformer models on GPU cluster.',
      evidence: { type: EVIDENCE_TYPE.TEXT, value: 'Validation accuracy reached 92.4% with cross-entropy loss 0.23' },
      verified: true,
      verifiedBy: faculty1._id,
      verifiedAt: new Date(nowMs - 4 * DAY_MS),
      createdAt: new Date(nowMs - 6 * DAY_MS),
    },
    {
      applicationId: appHealthy._id,
      weekLabel: 'Week 4',
      description: 'Hyperparameter tuning with Optuna and latency profiling.',
      evidence: { type: EVIDENCE_TYPE.LINK, value: 'https://github.com/kaushal-demo/ai-pipeline/pull/4' },
      verified: false,
      createdAt: new Date(nowMs - 2 * DAY_MS),
    },
  ]);
  notableDemos.healthyInProgress = {
    applicationId: appHealthy._id.toString(),
  };

  // ── 6g. High-Risk Application with Un-Suppression ─────────────────────────
  // S4 (Ishaan Verma) -> Posting 4 (Embedded IoT Firmware)
  //
  // Designed Risk Profile:
  // - Signal 1 (Trend Drop): 4 logs submitted 18-20 days ago, 0 in recent 7 days -> 100% drop > 30% triggers
  // - Signal 2 (Overdue Gap): Most recent log submitted 12 days ago (> 10 days) -> triggers
  // - Signal 3 (Mentor Gap): Last mentor interaction was 19 days ago (> 14 days) -> triggers
  // - Signal 4 (Evidence Rate): 1 of 4 logs has evidence = 25% (< 50%) -> triggers
  // Result: 4 signals -> riskLevel: 'high'.
  //
  // Un-suppression Scenario:
  // - Faculty issued a Dismissal 15 days ago.
  // - Student submitted a new ProgressLog 12 days ago (createdAt > dismissedAt).
  // - getEffectiveRisk() returns suppressed: false, keeping riskLevel: 'high'!
  const appHighRisk = await createInitialApp(3, 4);
  const s4User = students[3].user;
  const compNorthUser = verifiedCompanyProfiles[0].user;

  await applyTransition(appHighRisk._id.toString(), APPLICATION_STATUS.SHORTLISTED, { id: compNorthUser._id.toString(), role: ROLES.COMPANY });
  await applyTransition(appHighRisk._id.toString(), APPLICATION_STATUS.OFFERED, { id: compNorthUser._id.toString(), role: ROLES.COMPANY });
  await applyTransition(appHighRisk._id.toString(), APPLICATION_STATUS.ACCEPTED, { id: s4User._id.toString(), role: ROLES.STUDENT });
  await applyTransition(appHighRisk._id.toString(), APPLICATION_STATUS.TNP_VERIFIED, { id: tnpUser._id.toString(), role: ROLES.TNP });
  await applyTransition(appHighRisk._id.toString(), APPLICATION_STATUS.MENTOR_PENDING, { id: tnpUser._id.toString(), role: ROLES.TNP });

  await MentorAssignment.create({
    applicationId: appHighRisk._id,
    facultyId: faculty2._id,
    status: MENTOR_ASSIGNMENT_STATUS.ACCEPTED,
  });

  await applyTransition(appHighRisk._id.toString(), APPLICATION_STATUS.MENTOR_ASSIGNED, { id: faculty2._id.toString(), role: ROLES.FACULTY });
  await applyTransition(appHighRisk._id.toString(), APPLICATION_STATUS.IN_PROGRESS, { id: s4User._id.toString(), role: ROLES.STUDENT });

  // Stale progress logs
  await ProgressLog.create([
    {
      applicationId: appHighRisk._id,
      weekLabel: 'Week 1',
      description: 'Setup ARM toolchain and hardware boards.',
      evidence: null,
      verified: true,
      verifiedBy: faculty2._id,
      verifiedAt: new Date(nowMs - 19 * DAY_MS),
      createdAt: new Date(nowMs - 20 * DAY_MS),
    },
    {
      applicationId: appHighRisk._id,
      weekLabel: 'Week 2',
      description: 'Debugging UART communication bugs.',
      evidence: null,
      verified: false,
      createdAt: new Date(nowMs - 18 * DAY_MS),
    },
    {
      applicationId: appHighRisk._id,
      weekLabel: 'Week 3',
      description: 'Sensor reading issues on I2C bus.',
      evidence: null,
      verified: false,
      createdAt: new Date(nowMs - 18 * DAY_MS),
    },
    // New progress log submitted AFTER dismissal (12 days ago > 15 days ago)
    {
      applicationId: appHighRisk._id,
      weekLabel: 'Week 4',
      description: 'Sensor driver partially working.',
      evidence: { type: EVIDENCE_TYPE.TEXT, value: 'Oscilloscope trace readings' },
      verified: false,
      createdAt: new Date(nowMs - 12 * DAY_MS),
    },
  ]);

  // Dismissal record dated 15 days ago (before the 12-day-old log)
  await Dismissal.create({
    applicationId: appHighRisk._id,
    dismissedBy: faculty2._id,
    dismissedAt: new Date(nowMs - 15 * DAY_MS),
    note: 'Student explained lab equipment delay on phone; acknowledged.',
  });

  notableDemos.highRisk = {
    applicationId: appHighRisk._id.toString(),
  };

  // ── 6h. Completed Application with PPO ────────────────────────────────────
  // S1 (Aarav Mehta) -> Posting 5 (Cascade Backend Node)
  const appCompleted = await createInitialApp(0, 5);
  const compCascadeUser = verifiedCompanyProfiles[1].user;

  await applyTransition(appCompleted._id.toString(), APPLICATION_STATUS.SHORTLISTED, { id: compCascadeUser._id.toString(), role: ROLES.COMPANY });
  await applyTransition(appCompleted._id.toString(), APPLICATION_STATUS.OFFERED, { id: compCascadeUser._id.toString(), role: ROLES.COMPANY });
  await applyTransition(appCompleted._id.toString(), APPLICATION_STATUS.ACCEPTED, { id: s1User._id.toString(), role: ROLES.STUDENT });
  await applyTransition(appCompleted._id.toString(), APPLICATION_STATUS.TNP_VERIFIED, { id: tnpUser._id.toString(), role: ROLES.TNP });
  await applyTransition(appCompleted._id.toString(), APPLICATION_STATUS.MENTOR_PENDING, { id: tnpUser._id.toString(), role: ROLES.TNP });

  await MentorAssignment.create({
    applicationId: appCompleted._id,
    facultyId: faculty1._id,
    status: MENTOR_ASSIGNMENT_STATUS.ACCEPTED,
  });

  await applyTransition(appCompleted._id.toString(), APPLICATION_STATUS.MENTOR_ASSIGNED, { id: faculty1._id.toString(), role: ROLES.FACULTY });
  await applyTransition(appCompleted._id.toString(), APPLICATION_STATUS.IN_PROGRESS, { id: s1User._id.toString(), role: ROLES.STUDENT });

  await ProgressLog.create([
    {
      applicationId: appCompleted._id,
      weekLabel: 'Final Week',
      description: 'Shipped production API endpoints and completed final internship presentation.',
      evidence: { type: EVIDENCE_TYPE.LINK, value: 'https://github.com/cascade/backend/releases/v1.0' },
      verified: true,
      verifiedBy: faculty1._id,
      verifiedAt: new Date(nowMs - 5 * DAY_MS),
      createdAt: new Date(nowMs - 6 * DAY_MS),
    },
  ]);

  // Complete application and set PPO
  await applyTransition(appCompleted._id.toString(), APPLICATION_STATUS.COMPLETED, { id: tnpUser._id.toString(), role: ROLES.TNP }, 'Internship duration successfully fulfilled');
  appCompleted.ppoOffered = true;
  await appCompleted.save();

  notableDemos.completedWithPPO = {
    applicationId: appCompleted._id.toString(),
  };

  // ── 6i. Cancelled Application mid-chain ───────────────────────────────────
  // S7 (Tanvi Kulkarni) -> Posting 3 (Veridian General SWE)
  const appCancelled = await createInitialApp(6, 3);
  const compVeridianUser = verifiedCompanyProfiles[3].user;

  await applyTransition(appCancelled._id.toString(), APPLICATION_STATUS.SHORTLISTED, { id: compVeridianUser._id.toString(), role: ROLES.COMPANY });
  await applyTransition(
    appCancelled._id.toString(),
    APPLICATION_STATUS.CANCELLED,
    { id: compVeridianUser._id.toString(), role: ROLES.COMPANY },
    'Company withdrew posting due to internal project realignment',
  );

  notableDemos.cancelled = {
    applicationId: appCancelled._id.toString(),
  };

  // ── 6j. T&P Override Application ──────────────────────────────────────────
  // S10 (Vikram Malhotra - CGPA 6.1, 3 backlogs) -> Posting 5 (requires CGPA 7.5, 0 backlogs)
  // Snapshot has eligible: false, manual override sets eligible: true
  const appOverride = await createInitialApp(9, 5);
  appOverride.override = {
    eligible: true,
    reason: 'Manual review by T&P: strong open source contribution portfolio despite CGPA gap',
    byUserId: tnpUser._id,
    at: new Date(),
  };
  await appOverride.save();

  notableDemos.tnpOverride = {
    applicationId: appOverride._id.toString(),
  };

  // ── 7. Console Summary ───────────────────────────────────────────────────
  console.log('\n================================================================');
  console.log('🎉 KAUSHAL DATABASE SEED COMPLETE');
  console.log('================================================================\n');

  console.log('🔑 ALL ACCOUNTS PASSWORD:', DEFAULT_PASSWORD);
  console.log('\n👤 T&P ROOT ACCOUNT:');
  console.log(`   - [TNP]     ${tnpUser.email}`);

  console.log('\n🎓 FACULTY & HOD ACCOUNTS:');
  console.log(`   - [FACULTY] ${faculty1.email} (${faculty1.department})`);
  console.log(`   - [FACULTY] ${faculty2.email} (${faculty2.department})`);
  console.log(`   - [HOD]     ${hodCse.email} (${hodCse.department})`);

  console.log('\n🏢 COMPANY ACCOUNTS:');
  for (const c of verifiedCompanyProfiles) {
    console.log(`   - [VERIFIED] ${c.user.email} -> ${c.profile.companyName}`);
  }
  console.log(`   - [VERIFIED] ${comp5User.email} -> Nexus AI Labs (auto-published via service)`);
  console.log(`   - [PENDING]  ${comp6User.email} -> Solaris Robotics (pending approval queue)`);

  console.log('\n📚 STUDENT ACCOUNTS:');
  for (const s of students) {
    console.log(`   - [STUDENT]  ${s.user.email} (CGPA: ${s.profile.cgpa}, Backlogs: ${s.profile.activeBacklogs}, Dept: ${s.profile.department})`);
  }

  console.log('\n🌟 NOTABLE DEMO SCENARIOS & APPLICATION IDS:');
  console.log(`   1. Multi-Offer Acceptance (Auto-Withdrawal):`);
  console.log(`      Accepted Application: ${notableDemos.multiOffer.acceptedAppId}`);
  console.log(`      Withdrawn Siblings:   ${notableDemos.multiOffer.withdrawnAppIds.join(', ')}`);
  console.log(`   2. Mentor Reject & Requeue (Back to tnpVerified):`);
  console.log(`      Application:          ${notableDemos.mentorReject.applicationId}`);
  console.log(`   3. Healthy In-Progress (Low Risk):`);
  console.log(`      Application:          ${notableDemos.healthyInProgress.applicationId}`);
  console.log(`   4. High-Risk with Un-Suppression (Risk Shows Again):`);
  console.log(`      Application:          ${notableDemos.highRisk.applicationId}`);
  console.log(`   5. Completed with PPO Offered:`);
  console.log(`      Application:          ${notableDemos.completedWithPPO.applicationId}`);
  console.log(`   6. Cancelled Mid-Chain:`);
  console.log(`      Application:          ${notableDemos.cancelled.applicationId}`);
  console.log(`   7. T&P Eligibility Override:`);
  console.log(`      Application:          ${notableDemos.tnpOverride.applicationId}`);
  console.log('\n================================================================\n');

  await disconnectDB();
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
