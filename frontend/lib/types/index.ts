/**
 * Kaushal — Frontend Type Definitions
 * Directly ported from docs/api/API_Contract.md and docs/database/Data_Model.md
 */

// Role Enum
export enum Role {
  STUDENT = 'student',
  COMPANY = 'company',
  FACULTY = 'faculty',
  TNP = 'tnp',
  HOD = 'hod',
}

// Application Status Enum (all 12 states)
export enum ApplicationStatus {
  APPLIED = 'applied',
  SHORTLISTED = 'shortlisted',
  REJECTED = 'rejected',
  OFFERED = 'offered',
  ACCEPTED = 'accepted',
  WITHDRAWN = 'withdrawn',
  TNP_VERIFIED = 'tnpVerified',
  MENTOR_PENDING = 'mentorPending',
  MENTOR_ASSIGNED = 'mentorAssigned',
  IN_PROGRESS = 'inProgress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

// Off-Campus Verification Status Enum
export enum OffCampusVerificationStatus {
  PENDING = 'pendingVerification',
  VERIFIED = 'verified',
  REJECTED = 'rejected',
}

// Allowed transitions lookup table
export const ALLOWED_TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  [ApplicationStatus.APPLIED]: [
    ApplicationStatus.SHORTLISTED,
    ApplicationStatus.REJECTED,
    ApplicationStatus.CANCELLED,
  ],
  [ApplicationStatus.SHORTLISTED]: [
    ApplicationStatus.OFFERED,
    ApplicationStatus.REJECTED,
    ApplicationStatus.CANCELLED,
  ],
  [ApplicationStatus.OFFERED]: [
    ApplicationStatus.ACCEPTED,
    ApplicationStatus.WITHDRAWN,
    ApplicationStatus.CANCELLED,
  ],
  [ApplicationStatus.ACCEPTED]: [
    ApplicationStatus.TNP_VERIFIED,
    ApplicationStatus.OFFERED,
    ApplicationStatus.CANCELLED,
  ],
  [ApplicationStatus.TNP_VERIFIED]: [
    ApplicationStatus.MENTOR_PENDING,
    ApplicationStatus.CANCELLED,
  ],
  [ApplicationStatus.MENTOR_PENDING]: [
    ApplicationStatus.MENTOR_ASSIGNED,
    ApplicationStatus.TNP_VERIFIED,
    ApplicationStatus.CANCELLED,
  ],
  [ApplicationStatus.MENTOR_ASSIGNED]: [
    ApplicationStatus.IN_PROGRESS,
    ApplicationStatus.CANCELLED,
  ],
  [ApplicationStatus.IN_PROGRESS]: [
    ApplicationStatus.COMPLETED,
    ApplicationStatus.CANCELLED,
  ],
  [ApplicationStatus.COMPLETED]: [],
  [ApplicationStatus.REJECTED]: [],
  [ApplicationStatus.WITHDRAWN]: [],
  [ApplicationStatus.CANCELLED]: [],
};

export const ALLOWED_ACTIONS: Record<ApplicationStatus, string[]> = {
  [ApplicationStatus.APPLIED]: ['shortlist', 'reject', 'cancel'],
  [ApplicationStatus.SHORTLISTED]: ['offer', 'reject', 'cancel'],
  [ApplicationStatus.OFFERED]: ['accept', 'decline', 'cancel'],
  [ApplicationStatus.ACCEPTED]: ['verify-offer', 'reject-offer', 'cancel'],
  [ApplicationStatus.TNP_VERIFIED]: ['assign', 'cancel'],
  [ApplicationStatus.MENTOR_PENDING]: ['accept-assignment', 'reject-assignment', 'cancel'],
  [ApplicationStatus.MENTOR_ASSIGNED]: ['submit-progress', 'cancel'],
  [ApplicationStatus.IN_PROGRESS]: ['submit-progress', 'cancel'],
  [ApplicationStatus.COMPLETED]: ['evaluate'],
  [ApplicationStatus.REJECTED]: [],
  [ApplicationStatus.WITHDRAWN]: [],
  [ApplicationStatus.CANCELLED]: [],
};

export type CriterionValue = number | string | string[];

export interface EligibilityCheck {
  criterion: string;
  passed: boolean;
  message?: string;
  value?: CriterionValue;
  required?: CriterionValue;
}

export interface EligibilitySnapshot {
  eligible: boolean;
  checks: EligibilityCheck[];
  computedAt: string;
}

// Override object (embedded in Application, written by T&P)
export interface EligibilityOverride {
  eligible: boolean;
  reason: string;
  byUserId: string;
  at: string;
}

// Dismissal shape (for computed live risk flags)
export interface Dismissal {
  applicationId: string;
  dismissedBy: string; // faculty User ID
  dismissedAt: string; // ISO Date string
  note?: string;
}

// Mentor Assignment status and interface
export enum AssignmentStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
}

export interface MentorAssignment {
  id?: string; // MongoDB _id
  applicationId: string;
  facultyId: string;
  status: AssignmentStatus;
  rejectReason?: string | null;
}

// Response envelope
export interface ApiResponseError {
  code: string;
  message: string;
  details?: any;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiResponseError;
}

// User representation
export interface User {
  id: string;
  email: string;
  role: Role;
  status: 'active' | 'pending' | 'verified';
  department?: string;
  name?: string;
}

// Student Profile
export interface StudentProfile {
  id?: string;
  _id?: string;
  userId?: string | any;
  name?: string;
  department: string;
  year: number;
  cgpa: number;
  backlogs?: number;
  activeBacklogs?: number;
  skills: string[];
  certifications: string[];
  resumeUrl?: string;
}

// Company Profile
export interface CompanyProfile {
  id?: string;
  _id?: string;
  userId: string;
  companyName: string;
  contactEmail: string;
  website?: string;
  status?: 'pending' | 'verified';
}

// Internship Criteria
export interface InternshipCriteria {
  minCgpa: number;
  maxBacklogs: number;
  department?: string;
  departments?: string[];
  year?: number;
  requiredSkills: string[];
  requiredCerts: string[];
}

// Internship Posting status and interface
export type InternshipStatus = 'pendingApproval' | 'open' | 'closed' | 'cancelled';

export interface Internship {
  id: string;
  _id?: string;
  companyId?: string | any;
  title: string;
  description?: string;
  duration?: string;
  mode?: string;
  companyName?: string; // Derived/populated field
  externalCompanyName?: string;
  source?: 'campus' | 'off_campus';
  criteria?: InternshipCriteria;
  status: InternshipStatus;
  vacancies?: number;
  lastDate?: string;
  createdAt?: string;
  offCampusVerification?: {
    status: OffCampusVerificationStatus;
    submittedBy?: any;
    submittedAt?: string;
    evidenceUrl?: string | null;
    verifiedBy?: string | null;
    verifiedAt?: string | null;
    rejectReason?: string | null;
  };
}

// Off-Campus Opportunity registered by student
export interface OffCampusOpportunity extends Internship {
  application?: {
    _id: string;
    id?: string;
    currentStatus: ApplicationStatus;
    ppoOffered?: boolean;
    createdAt?: string;
  } | null;
}

// Application Timeline Event
export interface TimelineEvent {
  fromStatus: ApplicationStatus | null;
  toStatus: ApplicationStatus;
  actorId: string;
  actorRole: Role;
  reason?: string;
  at: string;
}

// Application Entity
export interface Application {
  id: string;
  _id?: string;
  studentId: string | any;
  studentName?: string; // Derived/populated
  studentDept?: string;
  internshipId: string | any;
  internshipTitle?: string; // Derived/populated
  companyName?: string;
  currentStatus: ApplicationStatus;
  timeline: TimelineEvent[];
  eligibilitySnapshot?: EligibilitySnapshot;
  override?: EligibilityOverride | null;
  ppoOffered?: boolean;
}

// Progress Log Evidence
export interface ProgressEvidence {
  type: string; // e.g. "file" | "link" | "github_pr" | "report_pdf"
  value: string; // e.g. URL or text
}

// Progress Log Entity
export interface ProgressLog {
  id: string;
  _id?: string;
  applicationId: string;
  weekLabel: string;
  description: string;
  evidence: ProgressEvidence;
  verified: boolean;
  verifiedBy?: string | null;
  verifiedAt?: string | null;
  createdAt: string;
}

// Onboarding related types
export interface InviteToken {
  companyName: string;
  contactEmail: string;
  inviteToken: string;
  expiresAt: string;
  usedAt?: string;
}
