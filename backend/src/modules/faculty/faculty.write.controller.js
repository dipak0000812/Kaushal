import { MentorAssignment } from './models/MentorAssignment.js';
import { Application } from '../student/models/Application.js';
import { ProgressLog } from '../student/models/ProgressLog.js';
import { applyTransition } from '../student/services/applicationTransition.service.js';
import {
  MENTOR_ASSIGNMENT_STATUS,
  APPLICATION_STATUS,
} from '../../utils/constants.js';
import {
  ValidationError,
  NotFoundError,
  ForbiddenError,
  ConflictError,
} from '../../core/errors.js';

/**
 * GET /api/v1/faculty/assignments
 * Returns all mentor assignments for the authenticated faculty member.
 */
export async function getMyAssignments(req, res, next) {
  try {
    const assignments = await MentorAssignment.find({
      facultyId: req.user.userId,
    })
      .populate({
        path: 'applicationId',
        populate: [
          { path: 'studentId', populate: { path: 'userId', select: 'name email' } },
          { path: 'internshipId', select: 'title companyId' },
        ],
      })
      .lean();

    return res.status(200).json({ success: true, data: assignments });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/v1/faculty/assignments/:id/accept
 * Faculty accepts mentor assignment (pending -> accepted).
 * Application transitions mentorPending -> mentorAssigned.
 */
export async function acceptAssignment(req, res, next) {
  try {
    const assignmentId = req.params.id;
    const assignment = await MentorAssignment.findById(assignmentId);

    if (!assignment) {
      throw new NotFoundError('Mentor assignment not found');
    }

    if (assignment.facultyId.toString() !== req.user.userId) {
      throw new ForbiddenError('You can only accept your own assignments');
    }

    if (assignment.status !== MENTOR_ASSIGNMENT_STATUS.PENDING) {
      throw new ConflictError(`Cannot accept assignment in '${assignment.status}' state`);
    }

    assignment.status = MENTOR_ASSIGNMENT_STATUS.ACCEPTED;
    await assignment.save();

    const actor = { id: req.user.userId, role: req.user.role };
    const updatedApp = await applyTransition(
      assignment.applicationId.toString(),
      APPLICATION_STATUS.MENTOR_ASSIGNED,
      actor,
      'Faculty accepted mentor assignment',
    );

    return res.status(200).json({
      success: true,
      data: {
        assignment,
        application: updatedApp,
      },
    });
  } catch (err) {
    if (err.code === 'NOT_FOUND') err.statusCode = 404;
    if (err.code === 'INVALID_TRANSITION' || err.code === 'TRANSITION_CONFLICT') err.statusCode = 409;
    next(err);
  }
}

/**
 * PATCH /api/v1/faculty/assignments/:id/reject
 * Faculty rejects mentor assignment with reason (pending -> rejected).
 * Application transitions mentorPending -> tnpVerified (returned to unassigned queue).
 */
export async function rejectAssignment(req, res, next) {
  try {
    const assignmentId = req.params.id;
    const { reason } = req.body ?? {};

    if (!reason || typeof reason !== 'string' || !reason.trim()) {
      throw new ValidationError('Rejection reason is required');
    }

    const assignment = await MentorAssignment.findById(assignmentId);
    if (!assignment) {
      throw new NotFoundError('Mentor assignment not found');
    }

    if (assignment.facultyId.toString() !== req.user.userId) {
      throw new ForbiddenError('You can only reject your own assignments');
    }

    if (assignment.status !== MENTOR_ASSIGNMENT_STATUS.PENDING) {
      throw new ConflictError(`Cannot reject assignment in '${assignment.status}' state`);
    }

    assignment.status = MENTOR_ASSIGNMENT_STATUS.REJECTED;
    assignment.rejectReason = reason.trim();
    await assignment.save();

    const actor = { id: req.user.userId, role: req.user.role };
    const updatedApp = await applyTransition(
      assignment.applicationId.toString(),
      APPLICATION_STATUS.TNP_VERIFIED,
      actor,
      `Faculty rejected assignment: ${reason.trim()}`,
    );

    return res.status(200).json({
      success: true,
      data: {
        assignment,
        application: updatedApp,
      },
    });
  } catch (err) {
    if (err.code === 'NOT_FOUND') err.statusCode = 404;
    if (err.code === 'INVALID_TRANSITION' || err.code === 'TRANSITION_CONFLICT') err.statusCode = 409;
    next(err);
  }
}

/**
 * PATCH /api/v1/faculty/progress-logs/:id/verify
 * Faculty verifies student progress log.
 */
export async function verifyProgressLog(req, res, next) {
  try {
    const logId = req.params.id;
    const log = await ProgressLog.findById(logId);

    if (!log) {
      throw new NotFoundError('Progress log not found');
    }

    const assignment = await MentorAssignment.findOne({
      applicationId: log.applicationId,
      facultyId: req.user.userId,
      status: MENTOR_ASSIGNMENT_STATUS.ACCEPTED,
    });

    if (!assignment) {
      throw new ForbiddenError('Access denied: you are not the assigned mentor for this student');
    }

    log.verified = true;
    log.verifiedBy = req.user.userId;
    log.verifiedAt = new Date();
    await log.save();

    return res.status(200).json({ success: true, data: log });
  } catch (err) {
    next(err);
  }
}
