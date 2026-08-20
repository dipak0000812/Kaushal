const MS_PER_DAY = 24 * 60 * 60 * 1000;

function floorDays(ms) {
  return Math.floor(ms / MS_PER_DAY);
}

/**
 * @param {Array<{createdAt: Date, verified: boolean, hasEvidence: boolean}>} progressLogs
 * @param {Date} assignmentStartDate
 * @param {Date|null} lastMentorInteractionAt
 * @param {Date} now
 * @returns {{ riskLevel: "low"|"medium"|"high", signals: string[] }}
 */
export function score(progressLogs, assignmentStartDate, lastMentorInteractionAt, now) {
  const logs = Array.isArray(progressLogs) ? progressLogs : [];
  const signals = [];

  const recentCutoff = new Date(now.getTime() - 7 * MS_PER_DAY);
  const priorCutoff  = new Date(now.getTime() - 14 * MS_PER_DAY);

  // ── Signal 1: Submission trend ────────────────────────────────────────────
  // Compare log count in [now-7d, now] vs [now-14d, now-7d).
  // Skip if prior window had zero logs — nothing to compare against.
  {
    const recentCount = logs.filter(
      (l) => new Date(l.createdAt) >= recentCutoff && new Date(l.createdAt) <= now,
    ).length;
    const priorCount = logs.filter(
      (l) => new Date(l.createdAt) >= priorCutoff && new Date(l.createdAt) < recentCutoff,
    ).length;

    if (priorCount > 0 && recentCount < priorCount * 0.7) {
      const dropPercent = Math.round(((priorCount - recentCount) / priorCount) * 100);
      signals.push(`Submission frequency down ${dropPercent}% over last 2 weeks`);
    }
  }

  // ── Signal 2: Overdue milestones ──────────────────────────────────────────
  // Gap between now and most recent log's createdAt.
  // If no logs exist, approximate using time since assignment start.
  {
    let gapDays;
    if (logs.length > 0) {
      const mostRecentAt = logs.reduce(
        (latest, l) => (new Date(l.createdAt) > latest ? new Date(l.createdAt) : latest),
        new Date(logs[0].createdAt),
      );
      gapDays = floorDays(now.getTime() - mostRecentAt.getTime());
    } else {
      gapDays = floorDays(now.getTime() - new Date(assignmentStartDate).getTime());
    }

    if (gapDays > 10) {
      signals.push(`No progress log submitted in ${gapDays} days`);
    }
  }

  // ── Signal 3: Mentor contact gap ──────────────────────────────────────────
  // Fires if lastMentorInteractionAt is null OR gap exceeds 14 days.
  {
    if (lastMentorInteractionAt === null || lastMentorInteractionAt === undefined) {
      const daysSinceStart = floorDays(now.getTime() - new Date(assignmentStartDate).getTime());
      signals.push(
        `${daysSinceStart} days since last mentor interaction (no interaction recorded; counting from assignment start)`,
      );
    } else {
      const daysSince = floorDays(now.getTime() - new Date(lastMentorInteractionAt).getTime());
      if (daysSince > 14) {
        signals.push(`${daysSince} days since last mentor interaction`);
      }
    }
  }

  // ── Signal 4: Evidence frequency ──────────────────────────────────────────
  // Skip if there are no logs — fraction is undefined.
  {
    if (logs.length > 0) {
      const withEvidence = logs.filter((l) => l.hasEvidence === true).length;
      const rate = withEvidence / logs.length;
      if (rate < 0.5) {
        const percent = Math.round(rate * 100);
        signals.push(`Low evidence submission frequency (${percent}% of logs)`);
      }
    }
  }

  // ── Risk level ────────────────────────────────────────────────────────────
  const riskLevel = signals.length === 0 ? 'low' : signals.length === 1 ? 'medium' : 'high';

  return { riskLevel, signals };
}

/**
 * Applies the dismissal-suppression rule.
 * @param {{riskLevel: string, signals: string[]}} liveScore
 * @param {{dismissedAt: Date}|null} dismissal
 * @param {Date|null} mostRecentProgressLogAt
 * @returns {{riskLevel: string, signals: string[], suppressed: boolean}}
 */
export function getEffectiveRisk(liveScore, dismissal, mostRecentProgressLogAt) {
  if (!dismissal) {
    return { ...liveScore, suppressed: false };
  }

  if (mostRecentProgressLogAt === null || mostRecentProgressLogAt === undefined) {
    return { riskLevel: 'low', signals: [], suppressed: true };
  }

  if (new Date(mostRecentProgressLogAt) > new Date(dismissal.dismissedAt)) {
    return { ...liveScore, suppressed: false };
  }

  return { riskLevel: 'low', signals: [], suppressed: true };
}
