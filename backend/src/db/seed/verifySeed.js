import { connectDB, disconnectDB } from '../../config/database.js';
import {
  ROLES,
  USER_STATUS,
  APPLICATION_STATUS,
  MENTOR_ASSIGNMENT_STATUS,
} from '../../utils/constants.js';

import { User } from '../../modules/auth/models/User.js';
import { StudentProfile } from '../../modules/student/models/StudentProfile.js';
import { Internship } from '../../modules/company/models/Internship.js';
import { Application } from '../../modules/student/models/Application.js';
import { MentorAssignment } from '../../modules/faculty/models/MentorAssignment.js';
import { ProgressLog } from '../../modules/student/models/ProgressLog.js';
import { Dismissal } from '../../modules/risk/models/Dismissal.js';

import { evaluate } from '../../modules/eligibility/eligibilityEngine.js';
import { score, getEffectiveRisk } from '../../modules/risk/riskEngine.js';

async function verifySeed() {
  console.log('🔍 Starting Kaushal Seed Verification...\n');

  await connectDB();

  const checks = [];

  function recordCheck(name, pass, actual, expected, extra = '') {
    checks.push({ name, pass, actual, expected, extra });
    const symbol = pass ? '✅' : '❌';
    console.log(`${symbol} ${name}`);
    if (!pass) {
      console.error(`   Expected: ${JSON.stringify(expected)}`);
      console.error(`   Actual:   ${JSON.stringify(actual)}`);
      if (extra) console.error(`   Note:     ${extra}`);
    }
  }

  try {
    // ── 1. Role counts ──────────────────────────────────────────────────────
    const [tnpCount, facultyCount, hodCount] = await Promise.all([
      User.countDocuments({ role: ROLES.TNP }),
      User.countDocuments({ role: ROLES.FACULTY }),
      User.countDocuments({ role: ROLES.HOD }),
    ]);

    recordCheck(
      'Role counts: exactly 1 TNP, 2 Faculty, 1 HOD',
      tnpCount === 1 && facultyCount === 2 && hodCount === 1,
      { tnp: tnpCount, faculty: facultyCount, hod: hodCount },
      { tnp: 1, faculty: 2, hod: 1 },
    );

    // ── 2. Company accounts & status split ──────────────────────────────────
    const [compTotal, compVerified, compPending] = await Promise.all([
      User.countDocuments({ role: ROLES.COMPANY }),
      User.countDocuments({ role: ROLES.COMPANY, status: USER_STATUS.VERIFIED }),
      User.countDocuments({ role: ROLES.COMPANY, status: USER_STATUS.PENDING }),
    ]);

    recordCheck(
      'Company accounts: 6 total with 5 verified and 1 pending',
      compTotal === 6 && compVerified === 5 && compPending === 1,
      { total: compTotal, verified: compVerified, pending: compPending },
      { total: 6, verified: 5, pending: 1 },
    );

    // ── 3. Student profiles & CGPA range ─────────────────────────────────────
    const studentProfiles = await StudentProfile.find({});
    const cgpas = studentProfiles.map((s) => s.cgpa);
    const minCgpa = Math.min(...cgpas);
    const maxCgpa = Math.max(...cgpas);
    const cgpaRange = maxCgpa - minCgpa;

    recordCheck(
      'Student profiles: 12 profiles with CGPA spread spanning >= 3.0 range',
      studentProfiles.length === 12 && cgpaRange >= 3.0,
      { count: studentProfiles.length, minCgpa, maxCgpa, range: Number(cgpaRange.toFixed(2)) },
      { count: 12, minRange: 3.0 },
    );

    // ── 4. Zero-eligible applicant posting check ─────────────────────────────
    const allInternships = await Internship.find({});
    let zeroEligibleFound = false;
    let impossiblePostingTitle = '';

    for (const internship of allInternships) {
      const eligibleCount = studentProfiles.filter((sp) => {
        const result = evaluate(sp.toObject(), internship.criteria);
        return result.eligible;
      }).length;

      if (eligibleCount === 0) {
        zeroEligibleFound = true;
        impossiblePostingTitle = internship.title;
        break;
      }
    }

    recordCheck(
      'Zero-eligible applicant posting: at least 1 posting where 0 of 12 students are eligible',
      zeroEligibleFound,
      { zeroEligibleFound, posting: impossiblePostingTitle },
      { zeroEligibleFound: true },
    );

    // ── 5. Multi-offer student: 1 accepted + 2 withdrawn ────────────────────
    const multiOfferStudentUser = await User.findOne({ email: 'neha.roy@student.demo' });
    let multiOfferCheckPass = false;
    let studentStatusSummary = {};

    if (multiOfferStudentUser) {
      const sProfile = await StudentProfile.findOne({ userId: multiOfferStudentUser._id });
      if (sProfile) {
        const studentApps = await Application.find({ studentId: sProfile._id });
        const acceptedCount = studentApps.filter((a) => a.currentStatus === APPLICATION_STATUS.ACCEPTED).length;
        const withdrawnCount = studentApps.filter((a) => a.currentStatus === APPLICATION_STATUS.WITHDRAWN).length;
        studentStatusSummary = { total: studentApps.length, accepted: acceptedCount, withdrawn: withdrawnCount };
        multiOfferCheckPass = acceptedCount === 1 && withdrawnCount === 2;
      }
    }

    recordCheck(
      'Multi-offer resolution: student has exactly 1 accepted and 2 withdrawn applications',
      multiOfferCheckPass,
      studentStatusSummary,
      { accepted: 1, withdrawn: 2 },
    );

    // ── 6. T&P manual override presence ──────────────────────────────────────
    const overrideApp = await Application.findOne({ 'override.eligible': true });
    recordCheck(
      'T&P manual override: at least 1 Application has non-null override field',
      Boolean(overrideApp),
      { found: Boolean(overrideApp), appId: overrideApp?._id },
      { found: true },
    );

    // ── 7. Rejected MentorAssignment presence ────────────────────────────────
    const rejectedAssignment = await MentorAssignment.findOne({ status: MENTOR_ASSIGNMENT_STATUS.REJECTED });
    recordCheck(
      'Mentor assignment rejection: at least 1 MentorAssignment has status "rejected"',
      Boolean(rejectedAssignment),
      { found: Boolean(rejectedAssignment), assignmentId: rejectedAssignment?._id },
      { found: true },
    );

    // ── 8. High-risk application un-suppression check ────────────────────────
    const highRiskApp = await Application.findOne({
      currentStatus: APPLICATION_STATUS.IN_PROGRESS,
    }).populate('internshipId');

    let highRiskCheckPass = false;
    let riskEvaluationResult = {};

    // Find the application that has a Dismissal attached
    const dismissalDoc = await Dismissal.findOne({});
    if (dismissalDoc) {
      const targetApp = await Application.findById(dismissalDoc.applicationId);
      const logs = await ProgressLog.find({ applicationId: dismissalDoc.applicationId }).sort({ createdAt: 1 });
      const assignment = await MentorAssignment.findOne({ applicationId: dismissalDoc.applicationId, status: MENTOR_ASSIGNMENT_STATUS.ACCEPTED });

      if (targetApp && logs.length > 0 && assignment) {
        const assignmentStartDate = assignment.createdAt;
        const verifiedLogs = logs.filter((l) => l.verified && l.verifiedAt);
        const lastMentorInteractionAt = verifiedLogs.length > 0
          ? verifiedLogs.reduce((latest, l) => (new Date(l.verifiedAt) > latest ? new Date(l.verifiedAt) : latest), new Date(verifiedLogs[0].verifiedAt))
          : null;

        const liveLogs = logs.map((l) => ({
          createdAt: l.createdAt,
          verified: l.verified,
          hasEvidence: Boolean(l.evidence && l.evidence.value),
        }));

        const now = new Date();
        const liveScore = score(liveLogs, assignmentStartDate, lastMentorInteractionAt, now);
        const mostRecentLogAt = logs.reduce((latest, l) => (new Date(l.createdAt) > latest ? new Date(l.createdAt) : latest), new Date(logs[0].createdAt));
        const effectiveRisk = getEffectiveRisk(liveScore, dismissalDoc, mostRecentLogAt);

        riskEvaluationResult = {
          riskLevel: effectiveRisk.riskLevel,
          suppressed: effectiveRisk.suppressed,
          signalsCount: effectiveRisk.signals.length,
          signals: effectiveRisk.signals,
        };

        highRiskCheckPass = effectiveRisk.suppressed === false && ['medium', 'high'].includes(effectiveRisk.riskLevel);
      }
    }

    recordCheck(
      'High-risk engine & un-suppression: score() and getEffectiveRisk() return suppressed: false and high/medium risk',
      highRiskCheckPass,
      riskEvaluationResult,
      { suppressed: false, riskLevel: 'high (or medium)' },
    );

    // ── 9. Completed with PPO Offered ────────────────────────────────────────
    const completedPPOApp = await Application.findOne({
      currentStatus: APPLICATION_STATUS.COMPLETED,
      ppoOffered: true,
    });

    recordCheck(
      'PPO Completion: at least 1 Application has currentStatus "completed" and ppoOffered: true',
      Boolean(completedPPOApp),
      { found: Boolean(completedPPOApp), appId: completedPPOApp?._id },
      { found: true },
    );

    // ── 10. Cancelled Application ────────────────────────────────────────────
    const cancelledApp = await Application.findOne({
      currentStatus: APPLICATION_STATUS.CANCELLED,
    });

    recordCheck(
      'Application Cancellation: at least 1 Application has currentStatus "cancelled"',
      Boolean(cancelledApp),
      { found: Boolean(cancelledApp), appId: cancelledApp?._id },
      { found: true },
    );

    // ── Final Outcome ────────────────────────────────────────────────────────
    const allPassed = checks.every((c) => c.pass);
    console.log('\n----------------------------------------------------------------');
    if (allPassed) {
      console.log(`🎉 ALL ${checks.length}/${checks.length} SEED VERIFICATION CHECKS PASSED!\n`);
      await disconnectDB();
      process.exit(0);
    } else {
      const failedCount = checks.filter((c) => !c.pass).length;
      console.error(`❌ ${failedCount}/${checks.length} SEED VERIFICATION CHECKS FAILED!\n`);
      await disconnectDB();
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Verification script encountered an unhandled error:', error);
    await disconnectDB();
    process.exit(1);
  }
}

verifySeed();
