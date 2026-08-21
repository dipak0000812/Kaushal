import mongoose from 'mongoose';
import { ROLES, MENTOR_ASSIGNMENT_STATUS } from '../../../utils/constants.js';
import { Application } from '../../student/models/Application.js';
import { ProgressLog } from '../../student/models/ProgressLog.js';
import { MentorAssignment } from '../../faculty/models/MentorAssignment.js';
import { Dismissal } from '../models/Dismissal.js';
import { score, getEffectiveRisk } from '../riskEngine.js';

function createError(message, code, status) {
  const err = new Error(message);
  err.code = code;
  err.status = status;
  err.statusCode = status;
  return err;
}

/**
 * Computes live, unpersisted risk intelligence for a single application.
 *
 * Invariant: Risk is never persisted on Application; only Dismissal records
 * are stored. This service derives live score and applies dismissal suppression
 * at read time using current progress and mentor logs.
 *
 * @param {string|mongoose.Types.ObjectId} applicationId
 * @param {object} [options]
 * @param {Date} [options.now=new Date()]
 * @param {import('mongoose').ClientSession} [options.session]
 * @returns {Promise<{
 *   applicationId: mongoose.Types.ObjectId,
 *   riskLevel: "low"|"medium"|"high",
 *   signals: string[],
 *   suppressed: boolean,
 *   rawScore: { riskLevel: string, signals: string[] },
 *   dismissal: object|null,
 *   lastMentorInteractionAt: Date|null,
 *   mostRecentProgressLogAt: Date|null,
 *   assignmentStartDate: Date,
 *   computedAt: Date
 * }>}
 * @throws {Error} .code="NOT_FOUND" .status=404 — application does not exist
 */
export async function getLiveRiskForApplication(applicationId, options = {}) {
  const now = options.now instanceof Date ? options.now : new Date();
  const queryOpts = {};
  if (options.session != null) queryOpts.session = options.session;

  const app = await Application.findById(applicationId, null, queryOpts);
  if (!app) {
    throw createError(`Application '${applicationId}' not found`, 'NOT_FOUND', 404);
  }

  // 1. Fetch active mentor assignment (if any)
  const assignment = await MentorAssignment.findOne(
    { applicationId: app._id, status: MENTOR_ASSIGNMENT_STATUS.ACCEPTED },
    null,
    queryOpts,
  );
  const assignmentStartDate = assignment?.createdAt ?? app.createdAt ?? now;

  // 2. Fetch progress logs in chronological order
  const logs = await ProgressLog.find(
    { applicationId: app._id },
    null,
    { ...queryOpts, sort: { createdAt: 1 } },
  );

  // 3. Fetch latest dismissal record
  const dismissal = await Dismissal.findOne(
    { applicationId: app._id },
    null,
    { ...queryOpts, sort: { dismissedAt: -1 } },
  );

  // 4. Derive timing and interaction properties
  const verifiedLogs = logs.filter((l) => l.verified && l.verifiedAt);
  const lastMentorInteractionAt =
    verifiedLogs.length > 0
      ? verifiedLogs.reduce(
          (latest, l) => (new Date(l.verifiedAt) > latest ? new Date(l.verifiedAt) : latest),
          new Date(verifiedLogs[0].verifiedAt),
        )
      : null;

  const transformedLogs = logs.map((l) => ({
    createdAt: l.createdAt,
    verified: l.verified,
    hasEvidence: Boolean(l.evidence && l.evidence.value),
  }));

  const mostRecentProgressLogAt =
    logs.length > 0
      ? logs.reduce(
          (latest, l) => (new Date(l.createdAt) > latest ? new Date(l.createdAt) : latest),
          new Date(logs[0].createdAt),
        )
      : null;

  // 5. Run deterministic pure engines
  const rawScore = score(transformedLogs, assignmentStartDate, lastMentorInteractionAt, now);
  const effectiveRisk = getEffectiveRisk(rawScore, dismissal, mostRecentProgressLogAt);

  return {
    applicationId: app._id,
    riskLevel: effectiveRisk.riskLevel,
    signals: effectiveRisk.signals,
    suppressed: effectiveRisk.suppressed,
    rawScore,
    dismissal: dismissal
      ? {
          _id: dismissal._id,
          dismissedBy: dismissal.dismissedBy,
          dismissedAt: dismissal.dismissedAt,
          note: dismissal.note,
        }
      : null,
    lastMentorInteractionAt,
    mostRecentProgressLogAt,
    assignmentStartDate,
    computedAt: now,
  };
}

/**
 * Computes live risk for multiple applications using consolidated queries to avoid N+1.
 *
 * @param {Array<string|mongoose.Types.ObjectId>} applicationIds
 * @param {object} [options]
 * @param {Date} [options.now=new Date()]
 * @param {import('mongoose').ClientSession} [options.session]
 * @returns {Promise<Array<object>>}
 */
export async function getLiveRiskForApplications(applicationIds, options = {}) {
  if (!Array.isArray(applicationIds) || applicationIds.length === 0) {
    return [];
  }

  const now = options.now instanceof Date ? options.now : new Date();
  const queryOpts = {};
  if (options.session != null) queryOpts.session = options.session;

  const apps = await Application.find(
    { _id: { $in: applicationIds } },
    null,
    queryOpts,
  );
  if (apps.length === 0) {
    return [];
  }

  const validAppIds = apps.map((a) => a._id);

  // Consolidated parallel batch queries
  const [assignments, allLogs, allDismissals] = await Promise.all([
    MentorAssignment.find(
      { applicationId: { $in: validAppIds }, status: MENTOR_ASSIGNMENT_STATUS.ACCEPTED },
      null,
      queryOpts,
    ),
    ProgressLog.find(
      { applicationId: { $in: validAppIds } },
      null,
      { ...queryOpts, sort: { createdAt: 1 } },
    ),
    Dismissal.find(
      { applicationId: { $in: validAppIds } },
      null,
      { ...queryOpts, sort: { dismissedAt: -1 } },
    ),
  ]);

  // Index related documents by applicationId string
  const assignmentMap = new Map();
  for (const a of assignments) {
    assignmentMap.set(a.applicationId.toString(), a);
  }

  const logsMap = new Map();
  for (const log of allLogs) {
    const key = log.applicationId.toString();
    if (!logsMap.has(key)) logsMap.set(key, []);
    logsMap.get(key).push(log);
  }

  const latestDismissalMap = new Map();
  for (const d of allDismissals) {
    const key = d.applicationId.toString();
    // Since allDismissals is sorted by dismissedAt:-1, the first one encountered is latest
    if (!latestDismissalMap.has(key)) {
      latestDismissalMap.set(key, d);
    }
  }

  // Compute live risk for each application
  return apps.map((app) => {
    const appIdStr = app._id.toString();
    const assignment = assignmentMap.get(appIdStr);
    const assignmentStartDate = assignment?.createdAt ?? app.createdAt ?? now;
    const logs = logsMap.get(appIdStr) ?? [];
    const dismissal = latestDismissalMap.get(appIdStr) ?? null;

    const verifiedLogs = logs.filter((l) => l.verified && l.verifiedAt);
    const lastMentorInteractionAt =
      verifiedLogs.length > 0
        ? verifiedLogs.reduce(
            (latest, l) => (new Date(l.verifiedAt) > latest ? new Date(l.verifiedAt) : latest),
            new Date(verifiedLogs[0].verifiedAt),
          )
        : null;

    const transformedLogs = logs.map((l) => ({
      createdAt: l.createdAt,
      verified: l.verified,
      hasEvidence: Boolean(l.evidence && l.evidence.value),
    }));

    const mostRecentProgressLogAt =
      logs.length > 0
        ? logs.reduce(
            (latest, l) => (new Date(l.createdAt) > latest ? new Date(l.createdAt) : latest),
            new Date(logs[0].createdAt),
          )
        : null;

    const rawScore = score(transformedLogs, assignmentStartDate, lastMentorInteractionAt, now);
    const effectiveRisk = getEffectiveRisk(rawScore, dismissal, mostRecentProgressLogAt);

    return {
      applicationId: app._id,
      riskLevel: effectiveRisk.riskLevel,
      signals: effectiveRisk.signals,
      suppressed: effectiveRisk.suppressed,
      rawScore,
      dismissal: dismissal
        ? {
            _id: dismissal._id,
            dismissedBy: dismissal.dismissedBy,
            dismissedAt: dismissal.dismissedAt,
            note: dismissal.note,
          }
        : null,
      lastMentorInteractionAt,
      mostRecentProgressLogAt,
      assignmentStartDate,
      computedAt: now,
    };
  });
}

/**
 * Persists a dismissal record for a risk flag on an application.
 *
 * Enforces API Contract rule: Only the assigned faculty mentor
 * (with MentorAssignment.status === 'accepted') is permitted to dismiss.
 *
 * @param {string|mongoose.Types.ObjectId} applicationId
 * @param {{ id: string, role: string }} actor - must be faculty role
 * @param {string} [note] - optional note explaining dismissal
 * @param {object} [options]
 * @param {import('mongoose').ClientSession} [options.session]
 * @returns {Promise<{
 *   dismissal: object,
 *   effectiveRisk: object
 * }>}
 * @throws {Error} .code="FORBIDDEN" .status=403 — actor not faculty or not assigned mentor
 * @throws {Error} .code="NOT_FOUND" .status=404 — application not found
 */
export async function dismissRiskFlag(applicationId, actor, note, options = {}) {
  const queryOpts = {};
  if (options.session != null) queryOpts.session = options.session;

  if (!actor || !actor.id || actor.role !== ROLES.FACULTY) {
    throw createError('Only faculty mentors can dismiss risk flags', 'FORBIDDEN', 403);
  }

  const app = await Application.findById(applicationId, null, queryOpts);
  if (!app) {
    throw createError(`Application '${applicationId}' not found`, 'NOT_FOUND', 404);
  }

  // Verify mentor assignment ownership
  const assignment = await MentorAssignment.findOne(
    { applicationId: app._id, status: MENTOR_ASSIGNMENT_STATUS.ACCEPTED },
    null,
    queryOpts,
  );

  if (!assignment || assignment.facultyId.toString() !== actor.id.toString()) {
    throw createError(
      'Only the assigned faculty mentor can dismiss a risk flag for this application',
      'FORBIDDEN',
      403,
    );
  }

  // Persist dismissal record
  const [dismissal] = await Dismissal.create(
    [
      {
        applicationId: app._id,
        dismissedBy: actor.id,
        dismissedAt: new Date(),
        note: note ? String(note).trim() : null,
      },
    ],
    queryOpts,
  );

  // Derive updated effective risk post-dismissal
  const effectiveRisk = await getLiveRiskForApplication(app._id, options);

  return {
    dismissal,
    effectiveRisk,
  };
}
