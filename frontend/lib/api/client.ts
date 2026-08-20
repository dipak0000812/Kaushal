import {
  ApiResponse,
  Role,
  ApplicationStatus,
  EligibilitySnapshot,
  Dismissal,
  MentorAssignment,
  AssignmentStatus,
  Internship,
  Application,
  StudentProfile,
  CompanyProfile,
  ProgressLog,
  InternshipCriteria,
  InternshipStatus,
  ALLOWED_TRANSITIONS,
  EligibilityCheck
} from '../types';

export const USE_MOCKS = true;

// Helper to retrieve auth token
function getToken(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('kaushal_token');
  }
  return null;
}

// Fetch helper wrapper with Bearer JWT injection
async function request<T>(
  path: string,
  method: string = 'GET',
  body?: any,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`/api/v1${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      ...options,
    });

    if (!response.ok) {
      const errorJson = await response.json().catch(() => ({}));
      return {
        success: false,
        error: {
          code: errorJson.error?.code || 'HTTP_ERROR',
          message: errorJson.error?.message || `HTTP ${response.status} Error`,
          details: errorJson.error?.details,
        },
      };
    }

    const json = await response.json();
    return json;
  } catch (err: any) {
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: err.message || 'Network request failed',
      },
    };
  }
}

// Helper to wrap success responses
function mockResponse<T>(data: T): ApiResponse<T> {
  return {
    success: true,
    data,
  };
}

// ==========================================
// IN-MEMORY MOCK DATABASE
// ==========================================

export let mockStudentProfile: StudentProfile = {
  id: 'student-1',
  userId: 'user-student-1',
  name: 'Rahul Sharma',
  department: 'Computer Science',
  year: 4,
  cgpa: 8.7,
  backlogs: 0,
  skills: ['React', 'TypeScript', 'Node.js', 'MongoDB'],
  certifications: ['AWS Cloud Practitioner'],
  resumeUrl: 'https://example.com/resume.pdf',
};

export let mockCompanyProfile: CompanyProfile = {
  id: 'company-1',
  userId: 'user-company-1',
  companyName: 'TCS',
  contactEmail: 'hr@tcs.com',
  status: 'pending',
};

export let mockCompanies: CompanyProfile[] = [
  mockCompanyProfile,
  { id: 'company-2', userId: 'user-company-2', companyName: 'Infosys', contactEmail: 'hr@infosys.com', status: 'pending' },
  { id: 'company-3', userId: 'user-company-3', companyName: 'Google', contactEmail: 'hr@google.com', status: 'verified' }
];

export let mockInternships: Internship[] = [
  {
    id: 'internship-1',
    companyId: 'company-1',
    companyName: 'TCS',
    criteria: {
      minCgpa: 7.5,
      maxBacklogs: 1,
      department: 'Computer Science',
      year: 4,
      requiredSkills: ['React', 'Node.js'],
      requiredCerts: [],
    },
    status: 'open',
    vacancies: 3,
    lastDate: '2026-09-30',
  },
  {
    id: 'internship-2',
    companyId: 'company-2',
    companyName: 'Infosys',
    criteria: {
      minCgpa: 8.0,
      maxBacklogs: 0,
      department: 'Information Technology',
      year: 4,
      requiredSkills: ['Java', 'Spring Boot'],
      requiredCerts: [],
    },
    status: 'pendingApproval',
    vacancies: 5,
    lastDate: '2026-08-25',
  },
  {
    id: 'internship-3',
    companyId: 'company-3',
    companyName: 'Google',
    criteria: {
      minCgpa: 9.0,
      maxBacklogs: 0,
      department: 'Computer Science',
      year: 4,
      requiredSkills: ['C++', 'Algorithms'],
      requiredCerts: [],
    },
    status: 'closed',
    vacancies: 1,
    lastDate: '2026-08-10',
  },
];

export let mockApplications: Application[] = [
  {
    id: 'app-1',
    studentId: 'student-1',
    studentName: 'Rahul Sharma',
    internshipId: 'internship-1',
    internshipTitle: 'Frontend Developer at TCS',
    currentStatus: ApplicationStatus.APPLIED,
    timeline: [
      { fromStatus: null, toStatus: ApplicationStatus.APPLIED, actorId: 'user-student-1', actorRole: Role.STUDENT, at: '2026-08-16T10:00:00Z' }
    ],
    eligibilitySnapshot: {
      eligible: true,
      checks: [
        { criterion: 'minCgpa', passed: true, message: 'CGPA is 8.7 (required >= 7.5)', value: 8.7, required: 7.5 },
        { criterion: 'maxBacklogs', passed: true, message: 'Backlogs count is 0 (required <= 1)', value: 0, required: 1 },
        { criterion: 'department', passed: true, message: 'Department is Computer Science', value: 'Computer Science', required: 'Computer Science' },
        { criterion: 'year', passed: true, message: 'Year is 4', value: 4, required: 4 },
        { criterion: 'requiredSkills', passed: true, message: 'Skills overlap: React, Node.js', value: ['React', 'Node.js'], required: ['React', 'Node.js'] },
        { criterion: 'requiredCerts', passed: true, message: 'No required certifications', value: [], required: [] },
      ],
      computedAt: '2026-08-16T10:00:00Z',
    },
    override: null,
    ppoOffered: false,
  },
  {
    id: 'app-2',
    studentId: 'student-1',
    studentName: 'Rahul Sharma',
    internshipId: 'internship-3',
    internshipTitle: 'Software Engineer at Google',
    currentStatus: ApplicationStatus.REJECTED,
    timeline: [
      { fromStatus: null, toStatus: ApplicationStatus.APPLIED, actorId: 'user-student-1', actorRole: Role.STUDENT, at: '2026-08-02T10:00:00Z' },
      { fromStatus: ApplicationStatus.APPLIED, toStatus: ApplicationStatus.SHORTLISTED, actorId: 'company-3', actorRole: Role.COMPANY, at: '2026-08-03T11:00:00Z' },
      { fromStatus: ApplicationStatus.SHORTLISTED, toStatus: ApplicationStatus.REJECTED, actorId: 'company-3', actorRole: Role.COMPANY, at: '2026-08-04T12:00:00Z' }
    ],
    eligibilitySnapshot: {
      eligible: false,
      checks: [
        { criterion: 'minCgpa', passed: false, message: 'CGPA is 8.7 (required >= 9.0)', value: 8.7, required: 9.0 },
        { criterion: 'maxBacklogs', passed: true, message: 'Backlogs count is 0 (required <= 0)', value: 0, required: 0 },
        { criterion: 'department', passed: true, message: 'Department is Computer Science', value: 'Computer Science', required: 'Computer Science' },
      ],
      computedAt: '2026-08-02T10:00:00Z',
    },
    override: null,
    ppoOffered: false,
  },
  {
    id: 'app-3',
    studentId: 'student-2',
    studentName: 'Amit Patel',
    internshipId: 'internship-1',
    internshipTitle: 'Frontend Developer at TCS',
    currentStatus: ApplicationStatus.COMPLETED,
    timeline: [
      { fromStatus: null, toStatus: ApplicationStatus.APPLIED, actorId: 'user-student-2', actorRole: Role.STUDENT, at: '2026-08-10T10:00:00Z' },
      { fromStatus: ApplicationStatus.APPLIED, toStatus: ApplicationStatus.SHORTLISTED, actorId: 'company-1', actorRole: Role.COMPANY, at: '2026-08-11T10:00:00Z' },
      { fromStatus: ApplicationStatus.SHORTLISTED, toStatus: ApplicationStatus.OFFERED, actorId: 'company-1', actorRole: Role.COMPANY, at: '2026-08-12T10:00:00Z' },
      { fromStatus: ApplicationStatus.OFFERED, toStatus: ApplicationStatus.ACCEPTED, actorId: 'user-student-2', actorRole: Role.STUDENT, at: '2026-08-13T10:00:00Z' },
      { fromStatus: ApplicationStatus.ACCEPTED, toStatus: ApplicationStatus.TNP_VERIFIED, actorId: 'user-tnp-1', actorRole: Role.TNP, at: '2026-08-14T10:00:00Z' },
      { fromStatus: ApplicationStatus.TNP_VERIFIED, toStatus: ApplicationStatus.MENTOR_PENDING, actorId: 'user-tnp-1', actorRole: Role.TNP, at: '2026-08-14T12:00:00Z' },
      { fromStatus: ApplicationStatus.MENTOR_PENDING, toStatus: ApplicationStatus.MENTOR_ASSIGNED, actorId: 'user-faculty-1', actorRole: Role.FACULTY, at: '2026-08-15T10:00:00Z' },
      { fromStatus: ApplicationStatus.MENTOR_ASSIGNED, toStatus: ApplicationStatus.IN_PROGRESS, actorId: 'user-student-2', actorRole: Role.STUDENT, at: '2026-08-15T11:00:00Z' },
      { fromStatus: ApplicationStatus.IN_PROGRESS, toStatus: ApplicationStatus.COMPLETED, actorId: 'user-tnp-1', actorRole: Role.TNP, at: '2026-08-19T10:00:00Z' },
    ],
    eligibilitySnapshot: {
      eligible: true,
      checks: [
        { criterion: 'minCgpa', passed: true, message: 'CGPA is 8.0 (required >= 7.5)', value: 8.0, required: 7.5 }
      ],
      computedAt: '2026-08-10T10:00:00Z',
    },
    override: null,
    ppoOffered: false,
  }
];

export let mockAssignments: MentorAssignment[] = [
  {
    id: 'assign-1',
    applicationId: 'app-3',
    facultyId: 'user-faculty-1',
    status: AssignmentStatus.ACCEPTED,
  }
];

export let mockProgressLogs: ProgressLog[] = [
  {
    id: 'log-1',
    applicationId: 'app-3',
    weekLabel: 'Week 1',
    description: 'Scaffolded the frontend project and set up types.',
    evidence: { type: 'link', value: 'https://github.com/nihar-ux18/Kaushal' },
    verified: true,
    verifiedBy: 'user-faculty-1',
    verifiedAt: '2026-08-18T10:00:00Z',
    createdAt: '2026-08-17T09:00:00Z',
  }
];

export let mockDismissals: Dismissal[] = [];

export let mockTnpUsers: { name: string; email: string; role: 'faculty' | 'hod'; department: string }[] = [
  { name: 'Dr. Vivek Kumar', email: 'vivek@kaushal.edu', role: 'faculty', department: 'Computer Science' },
  { name: 'Dr. Neha Shah', email: 'neha@kaushal.edu', role: 'faculty', department: 'Information Technology' }
];

// ==========================================
// ELIGIBILITY COMPUTATION ENGINE (SHARED)
// ==========================================

export function computeEligibility(
  student: StudentProfile,
  criteria: InternshipCriteria
): EligibilitySnapshot {
  const checks: EligibilityCheck[] = [];

  // 1. Min CGPA
  const cgpaPassed = student.cgpa >= criteria.minCgpa;
  checks.push({
    criterion: 'minCgpa',
    passed: cgpaPassed,
    message: cgpaPassed
      ? `CGPA of ${student.cgpa} meets minimum ${criteria.minCgpa}`
      : `CGPA of ${student.cgpa} is below minimum ${criteria.minCgpa}`,
    value: student.cgpa,
    required: criteria.minCgpa,
  });

  // 2. Max Backlogs
  const backlogsPassed = student.backlogs <= criteria.maxBacklogs;
  checks.push({
    criterion: 'maxBacklogs',
    passed: backlogsPassed,
    message: backlogsPassed
      ? `Backlogs of ${student.backlogs} is within limit of ${criteria.maxBacklogs}`
      : `Backlogs of ${student.backlogs} exceeds limit of ${criteria.maxBacklogs}`,
    value: student.backlogs,
    required: criteria.maxBacklogs,
  });

  // 3. Department
  const deptPassed = student.department.toLowerCase() === criteria.department.toLowerCase();
  checks.push({
    criterion: 'department',
    passed: deptPassed,
    message: deptPassed
      ? `Department matches: ${student.department}`
      : `Department mismatch: student is ${student.department}, required ${criteria.department}`,
    value: student.department,
    required: criteria.department,
  });

  // 4. Year
  const yearPassed = student.year === criteria.year;
  checks.push({
    criterion: 'year',
    passed: yearPassed,
    message: yearPassed
      ? `Academic year matches: ${student.year}`
      : `Academic year mismatch: student is ${student.year}, required ${criteria.year}`,
    value: student.year,
    required: criteria.year,
  });

  // 5. Required Skills
  const missingSkills = criteria.requiredSkills.filter(s => !student.skills.includes(s));
  const skillsPassed = missingSkills.length === 0;
  checks.push({
    criterion: 'requiredSkills',
    passed: skillsPassed,
    message: skillsPassed
      ? `Has all required skills: ${criteria.requiredSkills.join(', ')}`
      : `Missing required skills: ${missingSkills.join(', ')}`,
    value: student.skills,
    required: criteria.requiredSkills,
  });

  // 6. Required Certs
  const missingCerts = criteria.requiredCerts.filter(c => !student.certifications.includes(c));
  const certsPassed = missingCerts.length === 0;
  checks.push({
    criterion: 'requiredCerts',
    passed: certsPassed,
    message: certsPassed
      ? `Has all required certifications`
      : `Missing required certifications: ${missingCerts.join(', ')}`,
    value: student.certifications,
    required: criteria.requiredCerts,
  });

  const eligible = checks.every(c => c.passed);

  return {
    eligible,
    checks,
    computedAt: new Date().toISOString(),
  };
}

// ==========================================
// MOCK CONTROLLERS & TRANSITION STATE MUTATORS
// ==========================================

// GHR-Purple Accent & Orange Accent Role-Based Login Simulation
function mockLogin(email: string) {
  let role = Role.STUDENT;
  let userId = 'student-1';
  
  if (email.includes('tnp') || email.includes('tp')) {
    role = Role.TNP;
    userId = 'user-tnp-1';
  } else if (email.includes('company')) {
    role = Role.COMPANY;
    userId = 'company-1';
  } else if (email.includes('faculty') || email.includes('mentor')) {
    role = Role.FACULTY;
    userId = 'user-faculty-1';
  } else if (email.includes('hod')) {
    role = Role.HOD;
    userId = 'user-hod-1';
  }
  return { token: 'mock-jwt-token', role, userId };
}

// Enforce ALLOWED_TRANSITIONS in every application state change (Fix #1, Fix #6)
function applyTransition(
  app: Application,
  toStatus: ApplicationStatus,
  actorId: string,
  actorRole: Role,
  reason?: string
): ApiResponse<Application> {
  if (!ALLOWED_TRANSITIONS[app.currentStatus].includes(toStatus)) {
    return {
      success: false,
      error: {
        code: 'invalid_transition',
        message: `Cannot transition from ${app.currentStatus} to ${toStatus}`,
      },
    };
  }

  const fromStatus = app.currentStatus;
  app.currentStatus = toStatus;
  app.timeline.push({
    fromStatus,
    toStatus,
    actorId,
    actorRole,
    reason,
    at: new Date().toISOString(),
  });

  return mockResponse(app);
}

// Enforce MentorAssignment status transitions
function applyAssignmentTransition(
  assignment: MentorAssignment,
  toStatus: AssignmentStatus
): boolean {
  const transitions: Record<AssignmentStatus, AssignmentStatus[]> = {
    [AssignmentStatus.PENDING]: [AssignmentStatus.ACCEPTED, AssignmentStatus.REJECTED],
    [AssignmentStatus.ACCEPTED]: [],
    [AssignmentStatus.REJECTED]: [],
  };

  if (!transitions[assignment.status].includes(toStatus)) {
    return false;
  }
  assignment.status = toStatus;
  return true;
}

function mockVerifyCompany(companyId: string) {
  const company = mockCompanies.find(c => c.id === companyId);
  if (company) {
    company.status = 'verified';
  }
  if (mockCompanyProfile.id === companyId) {
    mockCompanyProfile.status = 'verified';
  }
  mockInternships.forEach(i => {
    if (i.companyId === companyId && i.status === 'pendingApproval') {
      i.status = 'open';
    }
  });
  return mockResponse({ success: true });
}

function mockApproveInternship(id: string): ApiResponse<Internship> {
  const internship = mockInternships.find(i => i.id === id);
  if (!internship) {
    return { success: false, error: { code: 'NOT_FOUND', message: 'Internship not found' } };
  }
  internship.status = 'open';
  return mockResponse(internship);
}

function mockOverrideEligibility(applicationId: string, eligible: boolean, reason: string) {
  const app = mockApplications.find(a => a.id === applicationId);
  if (!app) {
    return { success: false, error: { code: 'NOT_FOUND', message: 'Application not found' } };
  }
  app.override = {
    eligible,
    reason,
    byUserId: 'user-tnp-1',
    at: new Date().toISOString(),
  };
  return mockResponse(app);
}

function mockAssignMentor(applicationId: string, facultyId: string) {
  const app = mockApplications.find(a => a.id === applicationId);
  if (!app) {
    return { success: false, error: { code: 'NOT_FOUND', message: 'Application not found' } };
  }
  
  // Enforce mentor uniqueness (Invariant #11, Fix #5)
  if (hasActiveAssignment(applicationId)) {
    return {
      success: false,
      error: {
        code: 'CONFLICT',
        message: 'Active mentor assignment already exists for this application.',
      },
    };
  }

  const transitionRes = applyTransition(app, ApplicationStatus.MENTOR_PENDING, 'user-tnp-1', Role.TNP);
  if (!transitionRes.success) {
    return transitionRes;
  }

  const newAssignment: MentorAssignment = {
    id: `assign-${mockAssignments.length + 1}`,
    applicationId,
    facultyId,
    status: AssignmentStatus.PENDING,
  };
  mockAssignments.push(newAssignment);
  return mockResponse({ success: true });
}

function mockTransitionAssignment(assignmentId: string, toStatus: AssignmentStatus, reason?: string) {
  const assignment = mockAssignments.find(a => a.id === assignmentId);
  if (!assignment) {
    return { success: false, error: { code: 'NOT_FOUND', message: 'Assignment not found' } };
  }

  const ok = applyAssignmentTransition(assignment, toStatus);
  if (!ok) {
    return {
      success: false,
      error: {
        code: 'invalid_transition',
        message: `Cannot transition assignment from ${assignment.status} to ${toStatus}`,
      },
    };
  }

  assignment.rejectReason = reason || null;

  const app = mockApplications.find(a => a.id === assignment.applicationId);
  if (app) {
    if (toStatus === AssignmentStatus.ACCEPTED) {
      applyTransition(app, ApplicationStatus.MENTOR_ASSIGNED, assignment.facultyId, Role.FACULTY);
    } else if (toStatus === AssignmentStatus.REJECTED) {
      applyTransition(app, ApplicationStatus.TNP_VERIFIED, assignment.facultyId, Role.FACULTY, `Faculty rejected assignment: ${reason}`);
    }
  }

  return mockResponse({ success: true });
}

function mockDismissRiskFlag(applicationId: string, note?: string) {
  const dismissal: Dismissal = {
    applicationId,
    dismissedBy: 'user-faculty-1',
    dismissedAt: new Date().toISOString(),
    note,
  };
  mockDismissals.push(dismissal);
  return mockResponse(dismissal);
}

function mockUpdateStudentProfile(body: Partial<StudentProfile>) {
  mockStudentProfile = {
    ...mockStudentProfile,
    ...body,
  };
  return mockResponse(mockStudentProfile);
}

function mockApplyToInternship(internshipId: string): ApiResponse<Application> {
  const internship = mockInternships.find(i => i.id === internshipId);
  if (!internship) {
    return { success: false, error: { code: 'NOT_FOUND', message: 'Internship not found' } };
  }

  // 1. Enforce internship status is open (Fix #3, Invariant #10)
  if (internship.status !== 'open') {
    return {
      success: false,
      error: {
        code: 'CLOSED_POSTING',
        message: `Internship is currently ${internship.status}, cannot accept applications.`,
      },
    };
  }

  // 2. Enforce vacancy limits (Fix #3, Invariant #10)
  const FILLED_STATES = [
    ApplicationStatus.OFFERED,
    ApplicationStatus.ACCEPTED,
    ApplicationStatus.TNP_VERIFIED,
    ApplicationStatus.MENTOR_PENDING,
    ApplicationStatus.MENTOR_ASSIGNED,
    ApplicationStatus.IN_PROGRESS,
    ApplicationStatus.COMPLETED
  ];
  const filledCount = mockApplications.filter(
    a => a.internshipId === internshipId && FILLED_STATES.includes(a.currentStatus)
  ).length;

  if (filledCount >= internship.vacancies) {
    return {
      success: false,
      error: {
        code: 'FILLED_POSTING',
        message: 'This internship position has already been filled.',
      },
    };
  }

  // 3. Enforce duplicate-application prevention (Fix #3, Invariant #8)
  const TERMINAL_STATES = [
    ApplicationStatus.REJECTED,
    ApplicationStatus.WITHDRAWN,
    ApplicationStatus.CANCELLED
  ];
  const existingApp = mockApplications.find(
    a => a.studentId === mockStudentProfile.id && a.internshipId === internshipId && !TERMINAL_STATES.includes(a.currentStatus)
  );

  if (existingApp) {
    return {
      success: false,
      error: {
        code: 'DUPLICATE_APPLICATION',
        message: 'A non-terminal application already exists for this student and internship.',
      },
    };
  }

  // Compute eligibility using the single shared computeEligibility function (Fix #2)
  const isEligible = computeEligibility(mockStudentProfile, internship.criteria);

  const newApp: Application = {
    id: `app-${mockApplications.length + 1}`,
    studentId: mockStudentProfile.id,
    studentName: mockStudentProfile.name,
    internshipId,
    internshipTitle: `Frontend Developer at ${internship.companyName}`,
    currentStatus: ApplicationStatus.APPLIED,
    timeline: [
      { fromStatus: null, toStatus: ApplicationStatus.APPLIED, actorId: mockStudentProfile.userId, actorRole: Role.STUDENT, at: new Date().toISOString() }
    ],
    eligibilitySnapshot: isEligible,
    override: null,
    ppoOffered: false,
  };
  mockApplications.push(newApp);
  return mockResponse(newApp);
}

function mockAcceptOffer(applicationId: string) {
  const targetApp = mockApplications.find(a => a.id === applicationId);
  if (!targetApp) {
    return { success: false, error: { code: 'NOT_FOUND', message: 'Application not found' } };
  }

  // Accept target application via standard applyTransition (Fix #1, Fix #6)
  const res = applyTransition(targetApp, ApplicationStatus.ACCEPTED, mockStudentProfile.userId, Role.STUDENT);
  if (!res.success) {
    return res;
  }

  // Multi-offer withdrawal side effect (atomic in mock database too!)
  mockApplications.forEach(a => {
    if (a.studentId === targetApp.studentId && a.id !== targetApp.id && a.currentStatus === ApplicationStatus.OFFERED) {
      applyTransition(a, ApplicationStatus.WITHDRAWN, mockStudentProfile.userId, Role.STUDENT, 'Auto-withdrawn after student accepted another offer');
    }
  });
  
  return mockResponse({ success: true });
}

function mockSubmitProgressLog(applicationId: string, description: string, evidence: { type: string; value: string }) {
  const app = mockApplications.find(a => a.id === applicationId);
  if (!app) {
    return { success: false, error: { code: 'NOT_FOUND', message: 'Application not found' } };
  }

  // If status is mentorAssigned, first progress log moves it to inProgress (Fix #1, Fix #6)
  if (app.currentStatus === ApplicationStatus.MENTOR_ASSIGNED) {
    const res = applyTransition(app, ApplicationStatus.IN_PROGRESS, mockStudentProfile.userId, Role.STUDENT);
    if (!res.success) {
      return res;
    }
  }

  const newLog: ProgressLog = {
    id: `log-${mockProgressLogs.length + 1}`,
    applicationId,
    weekLabel: `Week ${mockProgressLogs.filter(l => l.applicationId === applicationId).length + 1}`,
    description,
    evidence,
    verified: false,
    createdAt: new Date().toISOString(),
  };
  mockProgressLogs.push(newLog);
  return mockResponse({ success: true });
}

function mockPostInternship(body: any) {
  // Fix #4: auto-publish (status: 'open') only if company profile status is verified
  const status: InternshipStatus = mockCompanyProfile.status === 'verified' ? 'open' : 'pendingApproval';
  const newInt: Internship = {
    id: `internship-${mockInternships.length + 1}`,
    companyId: mockCompanyProfile.id,
    companyName: mockCompanyProfile.companyName,
    criteria: body.criteria,
    status,
    vacancies: body.vacancies,
    lastDate: body.lastDate,
  };
  mockInternships.push(newInt);
  return mockResponse(newInt);
}

function mockUpdateInternshipCriteria(id: string, body: Partial<InternshipCriteria>) {
  const internship = mockInternships.find(i => i.id === id);
  if (!internship) {
    return { success: false, error: { code: 'NOT_FOUND', message: 'Internship not found' } };
  }
  internship.criteria = {
    ...internship.criteria,
    ...body,
  };
  return mockResponse(internship);
}

function mockTransitionInternship(id: string, toStatus: InternshipStatus) {
  const internship = mockInternships.find(i => i.id === id);
  if (!internship) {
    return { success: false, error: { code: 'NOT_FOUND', message: 'Internship not found' } };
  }
  internship.status = toStatus;
  return mockResponse(internship);
}

function mockGetApplicants(internshipId: string) {
  const apps = mockApplications.filter(a => a.internshipId === internshipId);
  
  const mappedApps = apps.map(a => {
    const effectiveEligible = a.override?.eligible ?? a.eligibilitySnapshot.eligible;
    const isPostShortlist = [
      ApplicationStatus.SHORTLISTED,
      ApplicationStatus.OFFERED,
      ApplicationStatus.ACCEPTED,
      ApplicationStatus.TNP_VERIFIED,
      ApplicationStatus.MENTOR_PENDING,
      ApplicationStatus.MENTOR_ASSIGNED,
      ApplicationStatus.IN_PROGRESS,
      ApplicationStatus.COMPLETED
    ].includes(a.currentStatus);

    if (!isPostShortlist) {
      return {
        applicationId: a.id,
        eligible: effectiveEligible,
        matchedCriteriaCount: a.eligibilitySnapshot.checks.filter(c => c.passed).length,
        currentStatus: a.currentStatus,
        studentName: a.studentName,
      };
    } else {
      return {
        applicationId: a.id,
        eligible: effectiveEligible,
        matchedCriteriaCount: a.eligibilitySnapshot.checks.filter(c => c.passed).length,
        currentStatus: a.currentStatus,
        studentName: a.studentName,
        matchedSkills: ['React', 'Node.js'],
        resumeUrl: 'https://example.com/resume.pdf',
      };
    }
  });

  return mockResponse(mappedApps);
}

// Fix #7: Evaluate Application is only valid when currentStatus === COMPLETED
function mockEvaluateApplication(applicationId: string, rating: number, ppoRecommended: boolean) {
  const app = mockApplications.find(a => a.id === applicationId);
  if (!app) {
    return { success: false, error: { code: 'NOT_FOUND', message: 'Application not found' } };
  }
  if (app.currentStatus !== ApplicationStatus.COMPLETED) {
    return {
      success: false,
      error: {
        code: 'invalid_status',
        message: `Evaluate action is only valid from completed state. Current: ${app.currentStatus}`,
      },
    };
  }
  app.ppoOffered = ppoRecommended;
  return mockResponse({ success: true });
}

function mockVerifyProgressLog(logId: string) {
  const log = mockProgressLogs.find(l => l.id === logId);
  if (!log) {
    return { success: false, error: { code: 'NOT_FOUND', message: 'Progress log not found' } };
  }
  log.verified = true;
  log.verifiedBy = 'user-faculty-1';
  log.verifiedAt = new Date().toISOString();
  return mockResponse({ success: true });
}

function hasActiveAssignment(applicationId: string): boolean {
  return mockAssignments.some(
    a => a.applicationId === applicationId && (a.status === AssignmentStatus.PENDING || a.status === AssignmentStatus.ACCEPTED)
  );
}

function getActiveDismissal(applicationId: string): Dismissal | null {
  const dismissal = mockDismissals.find(d => d.applicationId === applicationId);
  if (!dismissal) return null;

  const logs = mockProgressLogs.filter(l => l.applicationId === applicationId);
  if (logs.length > 0) {
    const latestLog = logs.reduce((latest, current) => 
      new Date(current.createdAt).getTime() > new Date(latest.createdAt).getTime() ? current : latest
    );
    if (new Date(latestLog.createdAt).getTime() >= new Date(dismissal.dismissedAt).getTime()) {
      return null;
    }
  }

  return dismissal;
}

// Compute live risk
function computeLiveRisk(applicationId: string): 'HIGH' | 'MEDIUM' | 'none' {
  const app = mockApplications.find(a => a.id === applicationId);
  if (!app) return 'none';

  const logs = mockProgressLogs.filter(l => l.applicationId === applicationId);
  if (app.currentStatus === ApplicationStatus.IN_PROGRESS) {
    if (logs.length === 0) return 'HIGH';
    const lastLog = logs[logs.length - 1];
    const daysSinceLastLog = (Date.now() - new Date(lastLog.createdAt).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceLastLog > 7) {
      return 'HIGH';
    }
  }

  const hasRejectedAssignment = mockAssignments.some(
    a => a.applicationId === applicationId && a.status === AssignmentStatus.REJECTED
  );
  if (hasRejectedAssignment) {
    return 'MEDIUM';
  }

  return 'none';
}

function mockGetAlerts() {
  const pendingVerifications = mockApplications.filter(a => a.currentStatus === ApplicationStatus.ACCEPTED).length;
  const unassignedMentorAlerts = mockApplications.filter(
    a => a.currentStatus === ApplicationStatus.TNP_VERIFIED && !hasActiveAssignment(a.id)
  ).length;
  
  let atRiskCount = 0;
  mockApplications.forEach(a => {
    const risk = computeLiveRisk(a.id);
    const activeDismissal = getActiveDismissal(a.id);
    if ((risk === 'HIGH' || risk === 'MEDIUM') && !activeDismissal) {
      atRiskCount++;
    }
  });

  return {
    pendingVerifications,
    atRiskCount,
    zeroEligibleAlerts: mockInternships.filter(i => {
      const applicants = mockApplications.filter(a => i.id === a.internshipId);
      return applicants.length > 0 && !applicants.some(a => a.override?.eligible ?? a.eligibilitySnapshot.eligible);
    }).length,
    unassignedMentorAlerts,
  };
}

function mockGetAnalytics() {
  const skillsList = ['React', 'Node.js', 'Java', 'SQL', 'Go', 'TypeScript'];
  const baseDemand: Record<string, number> = { 'React': 10, 'Node.js': 8, 'Java': 5, 'SQL': 4, 'Go': 3, 'TypeScript': 4 };
  const baseSupply: Record<string, number> = { 'React': 6, 'Node.js': 4, 'Java': 5, 'SQL': 3, 'Go': 2, 'TypeScript': 3 };

  const skillGapReport = skillsList.map(skill => {
    const rejections = mockApplications.filter(a => {
      const lastEvent = a.timeline[a.timeline.length - 1];
      return lastEvent && lastEvent.reason && lastEvent.reason.toLowerCase().includes(skill.toLowerCase());
    }).length;

    return {
      skill,
      demand: (baseDemand[skill] || 5) + rejections,
      supply: Math.max(0, (baseSupply[skill] || 5) - rejections)
    };
  });

  return {
    funnel: {
      applied: mockApplications.length,
      shortlisted: mockApplications.filter(a => a.currentStatus !== ApplicationStatus.APPLIED && a.currentStatus !== ApplicationStatus.REJECTED).length,
      offered: mockApplications.filter(a => [ApplicationStatus.OFFERED, ApplicationStatus.ACCEPTED, ApplicationStatus.TNP_VERIFIED, ApplicationStatus.MENTOR_PENDING, ApplicationStatus.MENTOR_ASSIGNED, ApplicationStatus.IN_PROGRESS, ApplicationStatus.COMPLETED].includes(a.currentStatus)).length,
      completed: mockApplications.filter(a => a.currentStatus === ApplicationStatus.COMPLETED).length,
    },
    departmentStats: [
      { department: 'Computer Science', count: mockApplications.filter(a => a.studentName?.includes('Rahul') || a.studentName?.includes('Amit')).length },
      { department: 'Information Technology', count: 0 },
    ],
    companyStats: [
      { company: 'TCS', count: mockApplications.filter(a => a.internshipTitle?.includes('TCS')).length },
      { company: 'Google', count: mockApplications.filter(a => a.internshipTitle?.includes('Google')).length },
    ],
    skillGapReport,
    ppoOutcomes: {
      offered: mockApplications.filter(a => a.ppoOffered).length,
      completed: mockApplications.filter(a => a.currentStatus === ApplicationStatus.COMPLETED).length,
    }
  };
}

// Fix #8: Returns a NOT_FOUND error response if the internship is missing
function mockGetStudentInternshipDetail(id: string): ApiResponse<any> {
  const internship = mockInternships.find(i => i.id === id);
  if (!internship) {
    return {
      success: false,
      error: { code: 'NOT_FOUND', message: `Internship with ID ${id} not found` },
    };
  }

  // Compute eligibility using the single shared computeEligibility function (Fix #2)
  const snapshot = computeEligibility(mockStudentProfile, internship.criteria);
  return mockResponse({
    ...internship,
    eligibilitySnapshot: snapshot,
  });
}

function mockGetFacultyStudents() {
  return mockApplications
    .filter(a => mockAssignments.some(assign => assign.applicationId === a.id && assign.facultyId === 'user-faculty-1' && assign.status === AssignmentStatus.ACCEPTED))
    .map(a => {
      const activeDismissal = getActiveDismissal(a.id);
      const risk = activeDismissal ? null : computeLiveRisk(a.id);
      return {
        applicationId: a.id,
        studentName: a.studentName,
        internshipTitle: a.internshipTitle,
        currentStatus: a.currentStatus,
        risk,
        dismissal: activeDismissal,
        logs: mockProgressLogs.filter(l => l.applicationId === a.id),
      };
    });
}

function mockGetStudentsNoSubmission() {
  return mockGetFacultyStudents().filter(s => s.logs.length === 0);
}

function mockGetHodDashboard() {
  return {
    activeCount: mockApplications.filter(a => a.currentStatus === ApplicationStatus.IN_PROGRESS).length,
    completedCount: mockApplications.filter(a => a.currentStatus === ApplicationStatus.COMPLETED).length,
    ppoCount: mockApplications.filter(a => a.ppoOffered).length,
    skillGapReport: [
      { skill: 'React', demand: 10, supply: 6 },
      { skill: 'Node.js', demand: 8, supply: 4 },
    ]
  };
}

// Fix #8: Returns a NOT_FOUND error response if the student is missing
function mockGetHodStudentById(studentId: string): ApiResponse<any> {
  const app = mockApplications.find(a => a.studentId === studentId);
  if (!app) {
    return {
      success: false,
      error: { code: 'NOT_FOUND', message: `Student with ID ${studentId} not found` },
    };
  }
  return mockResponse({
    studentId,
    studentName: app.studentName,
    internshipTitle: app.internshipTitle,
    currentStatus: app.currentStatus,
    logs: mockProgressLogs.filter(l => l.applicationId === app.id),
  });
}

// ==========================================
// TYPED API CLIENT EXPORT
// ==========================================

export const apiClient = {
  auth: {
    registerStudent: (body: any) =>
      USE_MOCKS
        ? Promise.resolve(mockResponse(mockLogin(body.email)))
        : request<{ token: string; role: Role; userId: string }>('/auth/register/student', 'POST', body),
    registerCompany: (body: any) =>
      USE_MOCKS
        ? Promise.resolve(mockResponse(mockLogin(body.email)))
        : request<{ token: string; role: Role; userId: string }>('/auth/register/company', 'POST', body),
    login: (body: any) =>
      USE_MOCKS
        ? Promise.resolve(mockResponse(mockLogin(body.email)))
        : request<{ token: string; role: Role; userId: string }>('/auth/login', 'POST', body),
  },
  tnp: {
    createInvite: (body: { companyName: string; contactEmail: string }) =>
      USE_MOCKS
        ? Promise.resolve(mockResponse({ inviteToken: 'mock-invite-token', expiresAt: new Date(Date.now() + 86400000).toISOString() }))
        : request<any>('/tnp/invites', 'POST', body),
    createUser: (body: { name: string; email: string; role: 'faculty' | 'hod'; department: string }): Promise<ApiResponse<any>> => {
      if (USE_MOCKS) {
        const lowerEmail = body.email.toLowerCase();
        const exists = mockTnpUsers.some(u => u.email.toLowerCase() === lowerEmail);
        if (exists) {
          return Promise.resolve({
            success: false,
            error: {
              code: 'CONFLICT',
              message: `User with email ${body.email} already exists.`,
            },
          });
        }
        mockTnpUsers.push(body);
        return Promise.resolve(mockResponse({ success: true }));
      }
      return request<any>('/tnp/users', 'POST', body);
    },
    verifyCompany: (companyId: string) =>
      USE_MOCKS
        ? Promise.resolve(mockVerifyCompany(companyId))
        : request<any>(`/tnp/companies/${companyId}/verify`, 'PATCH'),
    getCompanies: () =>
      USE_MOCKS
        ? Promise.resolve(mockResponse(mockCompanies))
        : request<CompanyProfile[]>('/tnp/companies', 'GET'),
    getUsers: () =>
      USE_MOCKS
        ? Promise.resolve(mockResponse(mockTnpUsers))
        : request<any[]>('/tnp/users', 'GET'),
    getPendingInternships: () =>
      USE_MOCKS
        ? Promise.resolve(mockResponse(mockInternships.filter(i => i.status === 'pendingApproval')))
        : request<Internship[]>('/tnp/internships/pending-approval', 'GET'),
    approveInternship: (id: string) =>
      USE_MOCKS
        ? Promise.resolve(mockApproveInternship(id))
        : request<Internship>(`/tnp/internships/${id}/approve`, 'PATCH'),
    verifyOffer: (applicationId: string): Promise<ApiResponse<Application>> => {
      const app = mockApplications.find(a => a.id === applicationId);
      if (!app) return Promise.resolve({ success: false, error: { code: 'NOT_FOUND', message: 'Application not found' } });
      return Promise.resolve(applyTransition(app, ApplicationStatus.TNP_VERIFIED, 'user-tnp-1', Role.TNP));
    },
    rejectOffer: (applicationId: string, reason: string): Promise<ApiResponse<Application>> => {
      const app = mockApplications.find(a => a.id === applicationId);
      if (!app) return Promise.resolve({ success: false, error: { code: 'NOT_FOUND', message: 'Application not found' } });
      return Promise.resolve(applyTransition(app, ApplicationStatus.OFFERED, 'user-tnp-1', Role.TNP, reason));
    },
    overrideEligibility: (applicationId: string, body: { eligible: boolean; reason: string }) =>
      USE_MOCKS
        ? Promise.resolve(mockOverrideEligibility(applicationId, body.eligible, body.reason))
        : request<any>(`/tnp/applications/${applicationId}/override`, 'PATCH', body),
    assignMentor: (body: { applicationId: string; facultyId: string }) =>
      USE_MOCKS
        ? Promise.resolve(mockAssignMentor(body.applicationId, body.facultyId))
        : request<any>('/tnp/assignments', 'POST', body),
    getUnassignedApplications: () =>
      USE_MOCKS
        ? Promise.resolve(mockResponse(mockApplications.filter(a => a.currentStatus === ApplicationStatus.TNP_VERIFIED && !hasActiveAssignment(a.id))))
        : request<Application[]>('/tnp/assignments/unassigned', 'GET'),
    cancelApplication: (applicationId: string, body: { reason: string }) => {
      const app = mockApplications.find(a => a.id === applicationId);
      if (!app) return Promise.resolve({ success: false, error: { code: 'NOT_FOUND', message: 'Application not found' } });
      return Promise.resolve(applyTransition(app, ApplicationStatus.CANCELLED, 'user-tnp-1', Role.TNP, body.reason));
    },
    getAlerts: () =>
      USE_MOCKS
        ? Promise.resolve(mockResponse(mockGetAlerts()))
        : request<any>('/tnp/alerts', 'GET'),
    getAnalyticsDashboard: () =>
      USE_MOCKS
        ? Promise.resolve(mockResponse(mockGetAnalytics()))
        : request<any>('/tnp/analytics/dashboard', 'GET'),
  },
  student: {
    getProfile: () =>
      USE_MOCKS
        ? Promise.resolve(mockResponse(mockStudentProfile))
        : request<StudentProfile>('/student/profile', 'GET'),
    updateProfile: (body: Partial<StudentProfile>) =>
      USE_MOCKS
        ? Promise.resolve(mockUpdateStudentProfile(body))
        : request<StudentProfile>('/student/profile', 'PATCH', body),
    getInternships: () =>
      USE_MOCKS
        ? Promise.resolve(mockResponse(mockInternships.map(i => {
            const eligibility = computeEligibility(mockStudentProfile, i.criteria);
            return {
              ...i,
              eligibility: { eligible: eligibility.eligible }
            };
          })))
        : request<any[]>('/student/internships', 'GET'),
    getInternshipById: (id: string) =>
      USE_MOCKS
        ? Promise.resolve(mockGetStudentInternshipDetail(id))
        : request<any>(`/student/internships/${id}`, 'GET'),
    applyToInternship: (body: { internshipId: string }) =>
      USE_MOCKS
        ? Promise.resolve(mockApplyToInternship(body.internshipId))
        : request<Application>('/student/applications', 'POST', body),
    getApplications: (status?: ApplicationStatus) =>
      USE_MOCKS
        ? Promise.resolve(mockResponse(mockApplications.filter(a => a.studentId === mockStudentProfile.id && (!status || a.currentStatus === status))))
        : request<Application[]>(`/student/applications${status ? `?status=${status}` : ''}`, 'GET'),
    acceptOffer: (applicationId: string) =>
      USE_MOCKS
        ? Promise.resolve(mockAcceptOffer(applicationId))
        : request<any>(`/student/applications/${applicationId}/accept`, 'PATCH'),
    declineOffer: (applicationId: string): Promise<ApiResponse<Application>> => {
      const app = mockApplications.find(a => a.id === applicationId);
      if (!app) return Promise.resolve({ success: false, error: { code: 'NOT_FOUND', message: 'Application not found' } });
      return Promise.resolve(applyTransition(app, ApplicationStatus.WITHDRAWN, mockStudentProfile.userId, Role.STUDENT));
    },
    submitProgressLog: (applicationId: string, body: { description: string; evidence: { type: string; value: string } }) =>
      USE_MOCKS
        ? Promise.resolve(mockSubmitProgressLog(applicationId, body.description, body.evidence))
        : request<any>(`/student/applications/${applicationId}/progress-logs`, 'POST', body),
    getRecommendations: () =>
      USE_MOCKS
        ? Promise.resolve(mockResponse({
            method: 'deterministic-skill-overlap',
            recommendations: mockInternships.filter(i => i.status === 'open')
          }))
        : request<any>('/student/recommendations', 'GET'),
  },
  company: {
    postInternship: (body: any) =>
      USE_MOCKS
        ? Promise.resolve(mockPostInternship(body))
        : request<Internship>('/company/internships', 'POST', body),
    getInternships: () =>
      USE_MOCKS
        ? Promise.resolve(mockResponse(mockInternships.filter(i => i.companyId === mockCompanyProfile.id)))
        : request<Internship[]>('/company/internships', 'GET'),
    updateInternshipCriteria: (id: string, body: Partial<InternshipCriteria>) =>
      USE_MOCKS
        ? Promise.resolve(mockUpdateInternshipCriteria(id, body))
        : request<Internship>(`/company/internships/${id}`, 'PATCH', body),
    closeInternship: (id: string) =>
      USE_MOCKS
        ? Promise.resolve(mockTransitionInternship(id, 'closed'))
        : request<Internship>(`/company/internships/${id}/close`, 'PATCH'),
    getApplicants: (internshipId: string) =>
      USE_MOCKS
        ? Promise.resolve(mockGetApplicants(internshipId))
        : request<any[]>(`/company/internships/${internshipId}/applicants`, 'GET'),
    shortlistApplicant: (applicationId: string) => {
      const app = mockApplications.find(a => a.id === applicationId);
      if (!app) return Promise.resolve({ success: false, error: { code: 'NOT_FOUND', message: 'Application not found' } });
      return Promise.resolve(applyTransition(app, ApplicationStatus.SHORTLISTED, mockCompanyProfile.id, Role.COMPANY));
    },
    rejectApplicant: (applicationId: string, reason?: string) => {
      const app = mockApplications.find(a => a.id === applicationId);
      if (!app) return Promise.resolve({ success: false, error: { code: 'NOT_FOUND', message: 'Application not found' } });
      return Promise.resolve(applyTransition(app, ApplicationStatus.REJECTED, mockCompanyProfile.id, Role.COMPANY, reason));
    },
    offerInternship: (applicationId: string) => {
      const app = mockApplications.find(a => a.id === applicationId);
      if (!app) return Promise.resolve({ success: false, error: { code: 'NOT_FOUND', message: 'Application not found' } });
      return Promise.resolve(applyTransition(app, ApplicationStatus.OFFERED, mockCompanyProfile.id, Role.COMPANY));
    },
    evaluateApplication: (applicationId: string, body: { rating: number; ppoRecommended: boolean }) =>
      USE_MOCKS
        ? Promise.resolve(mockEvaluateApplication(applicationId, body.rating, body.ppoRecommended))
        : request<any>(`/company/applications/${applicationId}/evaluate`, 'POST', body),
  },
  faculty: {
    getAssignments: () =>
      USE_MOCKS
        ? Promise.resolve(mockResponse(mockAssignments.filter(a => a.facultyId === 'user-faculty-1')))
        : request<MentorAssignment[]>('/faculty/assignments', 'GET'),
    acceptAssignment: (assignmentId: string) =>
      USE_MOCKS
        ? Promise.resolve(mockTransitionAssignment(assignmentId, AssignmentStatus.ACCEPTED))
        : request<any>(`/faculty/assignments/${assignmentId}/accept`, 'PATCH'),
    rejectAssignment: (assignmentId: string, body: { reason: string }) =>
      USE_MOCKS
        ? Promise.resolve(mockTransitionAssignment(assignmentId, AssignmentStatus.REJECTED, body.reason))
        : request<any>(`/faculty/assignments/${assignmentId}/reject`, 'PATCH', body),
    getStudents: () =>
      USE_MOCKS
        ? Promise.resolve(mockResponse(mockGetFacultyStudents()))
        : request<any[]>('/faculty/students', 'GET'),
    verifyProgressLog: (logId: string) =>
      USE_MOCKS
        ? Promise.resolve(mockVerifyProgressLog(logId))
        : request<any>(`/faculty/progress-logs/${logId}/verify`, 'PATCH'),
    getStudentsNoSubmission: () =>
      USE_MOCKS
        ? Promise.resolve(mockResponse(mockGetStudentsNoSubmission()))
        : request<any[]>('/faculty/students/no-submission', 'GET'),
    dismissRiskFlag: (applicationId: string, body: { note?: string }) =>
      USE_MOCKS
        ? Promise.resolve(mockDismissRiskFlag(applicationId, body.note))
        : request<any>(`/faculty/risk-flags/${applicationId}/dismiss`, 'PATCH', body),
  },
  hod: {
    getDashboard: () =>
      USE_MOCKS
        ? Promise.resolve(mockResponse(mockGetHodDashboard()))
        : request<any>('/hod/dashboard', 'GET'),
    getStudentById: (studentId: string) =>
      USE_MOCKS
        ? Promise.resolve(mockGetHodStudentById(studentId))
        : request<any>(`/hod/students/${studentId}`, 'GET'),
  }
};
