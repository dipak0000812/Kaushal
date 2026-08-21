import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { ROLES, USER_STATUS } from '../../utils/constants.js';
import { User } from './models/User.js';
import { StudentProfile } from '../student/models/StudentProfile.js';
import { CompanyProfile } from '../company/models/CompanyProfile.js';
import { InviteToken } from '../onboarding/models/InviteToken.js';
import {
  ValidationError,
  ConflictError,
  UnauthorizedError,
  NotFoundError,
  ForbiddenError,
} from '../../core/errors.js';

const BCRYPT_ROUNDS = 12;
const INVITE_EXPIRY_HOURS = 72;

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function issueJwt(userId, role) {
  return jwt.sign(
    { userId: userId.toString(), role },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN },
  );
}

function sanitizeUser(user) {
  const obj = user.toObject ? user.toObject() : { ...user };
  delete obj.passwordHash;
  delete obj.__v;
  return obj;
}

// ─────────────────────────────────────────────────────────────
// POST /api/v1/auth/register  (student self-registration)
// ─────────────────────────────────────────────────────────────

/**
 * Registers a new student. Creates User + StudentProfile atomically.
 * Role is ALWAYS set to 'student' server-side — never trusted from body.
 * Status is always 'active' for students.
 *
 * Required body: { name, email, password, department, year, cgpa }
 * Optional body: { activeBacklogs, skills, certifications, resumeUrl }
 */
export async function registerStudent(body) {
  const {
    name,
    email,
    password,
    department,
    year,
    cgpa,
    activeBacklogs = 0,
    skills = [],
    certifications = [],
    resumeUrl = null,
  } = body ?? {};

  // Input validation
  if (!name || typeof name !== 'string' || !name.trim()) {
    throw new ValidationError('Name is required');
  }
  if (!email || typeof email !== 'string') {
    throw new ValidationError('Email is required');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.toLowerCase())) {
    throw new ValidationError('Invalid email format');
  }
  if (!password || typeof password !== 'string' || password.length < 8) {
    throw new ValidationError('Password must be at least 8 characters');
  }
  if (!department || typeof department !== 'string' || !department.trim()) {
    throw new ValidationError('Department is required');
  }
  if (year === undefined || year === null) {
    throw new ValidationError('Year is required');
  }
  const yearNum = Number(year);
  if (!Number.isInteger(yearNum) || yearNum < 1 || yearNum > 6) {
    throw new ValidationError('Year must be an integer between 1 and 6');
  }
  if (cgpa === undefined || cgpa === null) {
    throw new ValidationError('CGPA is required');
  }
  const cgpaNum = Number(cgpa);
  if (isNaN(cgpaNum) || cgpaNum < 0 || cgpaNum > 10) {
    throw new ValidationError('CGPA must be between 0 and 10');
  }

  // Duplicate email check
  const existing = await User.findOne({ email: email.toLowerCase().trim() });
  if (existing) {
    throw new ConflictError('An account with this email already exists');
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const session = await mongoose.startSession();
  let createdUser;
  let createdProfile;

  try {
    await session.withTransaction(async () => {
      [createdUser] = await User.create(
        [
          {
            name: name.trim(),
            email: email.toLowerCase().trim(),
            passwordHash,
            role: ROLES.STUDENT,          // always server-set
            status: USER_STATUS.ACTIVE,   // students are always active
            department: department.trim(),
            createdBy: null,
          },
        ],
        { session },
      );

      [createdProfile] = await StudentProfile.create(
        [
          {
            userId: createdUser._id,
            department: department.trim(),
            year: yearNum,
            cgpa: cgpaNum,
            activeBacklogs: Math.max(0, Number(activeBacklogs) || 0),
            skills: Array.isArray(skills) ? skills.map(String) : [],
            certifications: Array.isArray(certifications) ? certifications.map(String) : [],
            resumeUrl: resumeUrl ? String(resumeUrl).trim() : null,
          },
        ],
        { session },
      );
    });
  } finally {
    await session.endSession();
  }

  const token = issueJwt(createdUser._id, ROLES.STUDENT);

  return {
    token,
    user: sanitizeUser(createdUser),
    profile: createdProfile.toObject ? createdProfile.toObject() : createdProfile,
  };
}

// ─────────────────────────────────────────────────────────────
// POST /api/v1/auth/register/company  (company self-registration via invite)
// ─────────────────────────────────────────────────────────────

/**
 * Registers a company account using a valid T&P invite token.
 * Creates User + CompanyProfile atomically, marks token as used.
 * Company starts with status 'pending' until T&P verifies.
 *
 * Required body: { inviteToken, password, companyName, contactEmail }
 * Optional body: { website }
 */
export async function registerCompany(body) {
  const {
    inviteToken,
    password,
    companyName,
    contactEmail,
    website = null,
  } = body ?? {};

  if (!inviteToken || typeof inviteToken !== 'string') {
    throw new ValidationError('Invite token is required');
  }
  if (!password || typeof password !== 'string' || password.length < 8) {
    throw new ValidationError('Password must be at least 8 characters');
  }
  if (!companyName || typeof companyName !== 'string' || !companyName.trim()) {
    throw new ValidationError('Company name is required');
  }
  if (!contactEmail || typeof contactEmail !== 'string') {
    throw new ValidationError('Contact email is required');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail.toLowerCase())) {
    throw new ValidationError('Invalid contact email format');
  }

  // Validate invite token
  const invite = await InviteToken.findOne({ token: inviteToken });
  if (!invite) {
    throw new ValidationError('Invalid invite token');
  }
  if (invite.usedAt !== null) {
    throw new ConflictError('This invite token has already been used');
  }
  if (invite.expiresAt < new Date()) {
    throw new ValidationError('This invite token has expired');
  }

  // Email uniqueness: use the contactEmail as the login email
  const loginEmail = contactEmail.toLowerCase().trim();
  const existing = await User.findOne({ email: loginEmail });
  if (existing) {
    throw new ConflictError('An account with this email already exists');
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const session = await mongoose.startSession();
  let createdUser;
  let createdProfile;

  try {
    await session.withTransaction(async () => {
      // Mark token as used atomically
      await InviteToken.findByIdAndUpdate(
        invite._id,
        { $set: { usedAt: new Date() } },
        { session },
      );

      [createdUser] = await User.create(
        [
          {
            name: companyName.trim(),
            email: loginEmail,
            passwordHash,
            role: ROLES.COMPANY,
            status: USER_STATUS.PENDING,  // always pending until T&P verifies
            createdBy: null,
          },
        ],
        { session },
      );

      [createdProfile] = await CompanyProfile.create(
        [
          {
            userId: createdUser._id,
            companyName: companyName.trim(),
            contactEmail: loginEmail,
            website: website ? String(website).trim() : null,
          },
        ],
        { session },
      );
    });
  } finally {
    await session.endSession();
  }

  // Don't issue a JWT yet — company must be verified by T&P before full access
  return {
    user: sanitizeUser(createdUser),
    profile: createdProfile.toObject ? createdProfile.toObject() : createdProfile,
    message: 'Registration complete. Your account is pending T&P verification.',
  };
}

// ─────────────────────────────────────────────────────────────
// POST /api/v1/auth/login
// ─────────────────────────────────────────────────────────────

/**
 * Authenticates any user. Returns a JWT.
 * Never leaks whether the email exists or whether the password was wrong.
 * Company accounts: token is issued regardless of verification status;
 * individual routes enforce verified status through the RBAC layer or service.
 */
export async function login(body) {
  const { email, password } = body ?? {};

  if (!email || typeof email !== 'string') {
    throw new ValidationError('Email is required');
  }
  if (!password || typeof password !== 'string') {
    throw new ValidationError('Password is required');
  }

  // Load user WITH passwordHash (select: false field — must project explicitly)
  const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+passwordHash');
  if (!user) {
    // Constant-time: still run compare to prevent timing attacks
    await bcrypt.compare(password, '$2a$12$invalidhashpadding00000000000000000000000000000000000');
    throw new UnauthorizedError('Invalid email or password');
  }

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const token = issueJwt(user._id, user.role);

  return {
    token,
    user: sanitizeUser(user),
  };
}

// ─────────────────────────────────────────────────────────────
// GET /api/v1/auth/me
// ─────────────────────────────────────────────────────────────

/**
 * Returns the authenticated user's identity plus their associated profile.
 * Never returns passwordHash. Profile is resolved by role.
 */
export async function getMe(userId) {
  const user = await User.findById(userId).lean();
  if (!user) {
    throw new NotFoundError('User not found');
  }

  let profile = null;
  if (user.role === ROLES.STUDENT) {
    profile = await StudentProfile.findOne({ userId: user._id }).lean();
  } else if (user.role === ROLES.COMPANY) {
    profile = await CompanyProfile.findOne({ userId: user._id }).lean();
  }

  const safeUser = { ...user };
  delete safeUser.passwordHash;

  return { user: safeUser, profile };
}

// ─────────────────────────────────────────────────────────────
// POST /api/v1/tnp/invites  (generate company invite token)
// ─────────────────────────────────────────────────────────────

/**
 * T&P generates an invite token for a company.
 * Required body: { companyName, contactEmail }
 */
export async function createInvite(body, tnpUserId) {
  const { companyName, contactEmail } = body ?? {};

  if (!companyName || typeof companyName !== 'string' || !companyName.trim()) {
    throw new ValidationError('Company name is required');
  }
  if (!contactEmail || typeof contactEmail !== 'string') {
    throw new ValidationError('Contact email is required');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail.toLowerCase())) {
    throw new ValidationError('Invalid contact email format');
  }

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + INVITE_EXPIRY_HOURS * 60 * 60 * 1000);

  const invite = await InviteToken.create({
    companyName: companyName.trim(),
    contactEmail: contactEmail.toLowerCase().trim(),
    token,
    expiresAt,
    usedAt: null,
  });

  return {
    inviteToken: invite.token,
    companyName: invite.companyName,
    contactEmail: invite.contactEmail,
    expiresAt: invite.expiresAt,
  };
}

// ─────────────────────────────────────────────────────────────
// POST /api/v1/tnp/users/faculty
// ─────────────────────────────────────────────────────────────

/**
 * T&P provisions a faculty account. Department is mandatory.
 * Required body: { name, email, password, department }
 */
export async function provisionFaculty(body, tnpUserId) {
  const { name, email, password, department } = body ?? {};

  if (!name || typeof name !== 'string' || !name.trim()) {
    throw new ValidationError('Name is required');
  }
  if (!email || typeof email !== 'string') {
    throw new ValidationError('Email is required');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.toLowerCase())) {
    throw new ValidationError('Invalid email format');
  }
  if (!password || typeof password !== 'string' || password.length < 8) {
    throw new ValidationError('Password must be at least 8 characters');
  }
  if (!department || typeof department !== 'string' || !department.trim()) {
    throw new ValidationError('Department is required for faculty');
  }

  const existing = await User.findOne({ email: email.toLowerCase().trim() });
  if (existing) {
    throw new ConflictError('An account with this email already exists');
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const user = await User.create({
    name: name.trim(),
    email: email.toLowerCase().trim(),
    passwordHash,
    role: ROLES.FACULTY,
    status: USER_STATUS.ACTIVE,
    department: department.trim(),
    createdBy: tnpUserId,
  });

  return sanitizeUser(user);
}

// ─────────────────────────────────────────────────────────────
// POST /api/v1/tnp/users/hod
// ─────────────────────────────────────────────────────────────

/**
 * T&P provisions an HOD account. Department is mandatory and server-controlled.
 * Required body: { name, email, password, department }
 */
export async function provisionHod(body, tnpUserId) {
  const { name, email, password, department } = body ?? {};

  if (!name || typeof name !== 'string' || !name.trim()) {
    throw new ValidationError('Name is required');
  }
  if (!email || typeof email !== 'string') {
    throw new ValidationError('Email is required');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.toLowerCase())) {
    throw new ValidationError('Invalid email format');
  }
  if (!password || typeof password !== 'string' || password.length < 8) {
    throw new ValidationError('Password must be at least 8 characters');
  }
  if (!department || typeof department !== 'string' || !department.trim()) {
    throw new ValidationError('Department is required for HOD');
  }

  const existing = await User.findOne({ email: email.toLowerCase().trim() });
  if (existing) {
    throw new ConflictError('An account with this email already exists');
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const user = await User.create({
    name: name.trim(),
    email: email.toLowerCase().trim(),
    passwordHash,
    role: ROLES.HOD,
    status: USER_STATUS.ACTIVE,
    department: department.trim(),
    createdBy: tnpUserId,
  });

  return sanitizeUser(user);
}

// ─────────────────────────────────────────────────────────────
// PATCH /api/v1/student/profile
// ─────────────────────────────────────────────────────────────

/**
 * Updates the authenticated student's own profile.
 * Write-locked after the student has any non-draft application on record.
 * Ownership enforced: identity derived from req.user, not body.
 *
 * Allowed fields: department, year, cgpa, activeBacklogs, skills, certifications, resumeUrl
 * Forbidden fields: userId, role, email, status, createdBy
 */
export async function updateStudentProfile(userId, body) {
  const studentProfile = await StudentProfile.findOne({ userId });
  if (!studentProfile) {
    throw new NotFoundError('Student profile not found');
  }

  // Write-lock: if student has any non-draft application, profile is locked
  const { Application } = await import('../student/models/Application.js');
  const appCount = await Application.countDocuments({ studentId: studentProfile._id });
  if (appCount > 0) {
    throw new ConflictError(
      'Profile cannot be updated after submitting an application',
      'PROFILE_LOCKED',
    );
  }

  // Allowed fields — whitelist approach
  const allowed = ['department', 'year', 'cgpa', 'activeBacklogs', 'skills', 'certifications', 'resumeUrl'];
  const updates = {};

  for (const field of allowed) {
    if (body[field] !== undefined) {
      updates[field] = body[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    throw new ValidationError('No updatable fields provided');
  }

  // Validate individual fields
  if (updates.year !== undefined) {
    const y = Number(updates.year);
    if (!Number.isInteger(y) || y < 1 || y > 6) {
      throw new ValidationError('Year must be an integer between 1 and 6');
    }
    updates.year = y;
  }
  if (updates.cgpa !== undefined) {
    const c = Number(updates.cgpa);
    if (isNaN(c) || c < 0 || c > 10) {
      throw new ValidationError('CGPA must be between 0 and 10');
    }
    updates.cgpa = c;
  }
  if (updates.activeBacklogs !== undefined) {
    const b = Number(updates.activeBacklogs);
    if (!Number.isInteger(b) || b < 0) {
      throw new ValidationError('Active backlogs must be a non-negative integer');
    }
    updates.activeBacklogs = b;
  }
  if (updates.skills !== undefined && !Array.isArray(updates.skills)) {
    throw new ValidationError('Skills must be an array');
  }
  if (updates.certifications !== undefined && !Array.isArray(updates.certifications)) {
    throw new ValidationError('Certifications must be an array');
  }
  if (updates.department !== undefined) {
    if (typeof updates.department !== 'string' || !updates.department.trim()) {
      throw new ValidationError('Department must be a non-empty string');
    }
    updates.department = updates.department.trim();
  }

  // Apply updates preserving fields not supplied
  Object.assign(studentProfile, updates);
  await studentProfile.save();

  return studentProfile.toObject ? studentProfile.toObject() : studentProfile;
}
