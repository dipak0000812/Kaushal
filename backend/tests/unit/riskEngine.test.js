import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { score, getEffectiveRisk } from '../../src/modules/risk/riskEngine.js';

// ─── Fixed reference time ─────────────────────────────────────────────────
// All tests pin to this single constant. Never call new Date() inside a test.
const NOW = new Date('2024-06-15T12:00:00.000Z');

// Helper: returns a Date exactly `n` whole days before NOW.
const daysAgo = (n) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000);

// Key window boundaries (all relative to NOW = 2024-06-15 12:00 UTC)
// Recent window : [2024-06-08 12:00, 2024-06-15 12:00]  (last 7 days)
// Prior  window : [2024-06-01 12:00, 2024-06-08 12:00)  (7–14 days ago)

// ─── Log factories ────────────────────────────────────────────────────────

function log(daysBeforeNow, { hasEvidence = true } = {}) {
  return { createdAt: daysAgo(daysBeforeNow), verified: hasEvidence, hasEvidence };
}

// 4 logs in recent window (1–6 days ago), 4 in prior window (8–13 days ago)
function healthyLogs() {
  return [
    log(6, { hasEvidence: true }),   // 2024-06-09 — recent
    log(5, { hasEvidence: true }),   // 2024-06-10 — recent
    log(4, { hasEvidence: true }),   // 2024-06-11 — recent
    log(3, { hasEvidence: true }),   // 2024-06-12 — recent
    log(13, { hasEvidence: true }),  // 2024-06-02 — prior
    log(12, { hasEvidence: true }),  // 2024-06-03 — prior
    log(11, { hasEvidence: true }),  // 2024-06-04 — prior
    log(10, { hasEvidence: true }),  // 2024-06-05 — prior
  ];
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('riskEngine.score()', () => {

  // ── Test 1: No progress logs at all ──────────────────────────────────────
  describe('no progress logs at all', () => {
    // assignmentStartDate 15 days ago → gap-based signals should fire:
    //   Signal 2: 15 days since last log (using assignmentStartDate as proxy) > 10 → fires
    //   Signal 3: lastMentorInteractionAt is null → fires (counting from assignment start)
    //   Signal 1: prior=0, skipped
    //   Signal 4: 0 logs, skipped
    const ASSIGNMENT_START = daysAgo(15);

    it('does not throw', () => {
      assert.doesNotThrow(() => score([], ASSIGNMENT_START, null, NOW));
    });

    it('returns a valid riskLevel string', () => {
      const { riskLevel } = score([], ASSIGNMENT_START, null, NOW);
      assert.ok(['low', 'medium', 'high'].includes(riskLevel));
    });

    it('returns a signals array', () => {
      const { signals } = score([], ASSIGNMENT_START, null, NOW);
      assert.ok(Array.isArray(signals));
    });

    it('signal 2 fires — overdue milestone approximated from assignmentStartDate', () => {
      const { signals } = score([], ASSIGNMENT_START, null, NOW);
      const s2 = signals.find((s) => s.includes('No progress log submitted'));
      assert.ok(s2, 'Signal 2 (overdue milestone) must fire when no logs and 15 days have passed');
      assert.ok(s2.includes('15'), 'Signal 2 must report 15 days');
    });

    it('signal 3 fires — mentor gap null triggers immediately', () => {
      const { signals } = score([], ASSIGNMENT_START, null, NOW);
      const s3 = signals.find((s) => s.includes('mentor interaction'));
      assert.ok(s3, 'Signal 3 (mentor gap) must fire when lastMentorInteractionAt is null');
      assert.ok(
        s3.includes('assignment start'),
        'Signal 3 message must note it is counting from assignment start',
      );
    });

    it('riskLevel is high because 2 signals fired', () => {
      const { riskLevel } = score([], ASSIGNMENT_START, null, NOW);
      assert.equal(riskLevel, 'high');
    });
  });

  // ── Test 2: Healthy case — all signals should stay silent ────────────────
  describe('healthy case: frequent logs, recent mentor contact, high evidence', () => {
    // recent=4, prior=4 → no trend drop
    // most recent log 3 days ago → no overdue
    // lastMentorInteractionAt 5 days ago → no mentor gap (< 14)
    // 8/8 evidence → no evidence signal
    const ASSIGNMENT_START = daysAgo(20);
    const LAST_INTERACTION = daysAgo(5);  // 5 days ago < 14

    it('returns riskLevel: "low"', () => {
      const { riskLevel } = score(healthyLogs(), ASSIGNMENT_START, LAST_INTERACTION, NOW);
      assert.equal(riskLevel, 'low');
    });

    it('returns an empty signals array', () => {
      const { signals } = score(healthyLogs(), ASSIGNMENT_START, LAST_INTERACTION, NOW);
      assert.deepEqual(signals, []);
    });
  });

  // ── Test 3: Exactly one signal triggered (mentor contact gap only) ────────
  describe('exactly one signal: mentor-contact gap fires, rest silent', () => {
    // Logs: 4 recent, 4 prior → no trend drop
    // most recent log: 3 days ago → no overdue
    // lastMentorInteractionAt: 20 days ago → 20 > 14 → signal 3 fires
    // evidence: 4 of 8 = exactly 50% → NOT < 50%, no signal 4
    const ASSIGNMENT_START = daysAgo(25);
    const STALE_INTERACTION = daysAgo(20);  // 20 days ago > 14

    const logsWithHalfEvidence = [
      log(6, { hasEvidence: true }),
      log(5, { hasEvidence: true }),
      log(4, { hasEvidence: false }),
      log(3, { hasEvidence: false }),
      log(13, { hasEvidence: true }),
      log(12, { hasEvidence: true }),
      log(11, { hasEvidence: false }),
      log(10, { hasEvidence: false }),
    ];

    it('returns riskLevel: "medium"', () => {
      const { riskLevel } = score(logsWithHalfEvidence, ASSIGNMENT_START, STALE_INTERACTION, NOW);
      assert.equal(riskLevel, 'medium');
    });

    it('returns exactly 1 signal', () => {
      const { signals } = score(logsWithHalfEvidence, ASSIGNMENT_START, STALE_INTERACTION, NOW);
      assert.equal(signals.length, 1, `Expected 1 signal, got: ${JSON.stringify(signals)}`);
    });

    it('the one signal is the mentor contact gap', () => {
      const { signals } = score(logsWithHalfEvidence, ASSIGNMENT_START, STALE_INTERACTION, NOW);
      assert.ok(
        signals[0].includes('mentor interaction'),
        `Signal should be about mentor interaction, got: "${signals[0]}"`,
      );
    });

    it('signal reports 20 days', () => {
      const { signals } = score(logsWithHalfEvidence, ASSIGNMENT_START, STALE_INTERACTION, NOW);
      assert.ok(signals[0].includes('20'));
    });
  });

  // ── Test 4: Multiple signals simultaneously (short-circuit regression) ────
  describe('multiple signals triggered simultaneously', () => {
    // Designed to trigger all 4 signals at once:
    //   Signal 1: prior=10, recent=0 → 100% drop > 30% → fires
    //   Signal 2: most recent log is 11 days ago → gap 11 > 10 → fires
    //   Signal 3: lastMentorInteractionAt null → fires
    //   Signal 4: 1 of 10 logs has evidence = 10% < 50% → fires
    //
    // All 10 logs placed at daysAgo(11) = 2024-06-04 → inside prior window (June 1-8).
    const ASSIGNMENT_START = daysAgo(20);
    const logs = [
      log(11, { hasEvidence: true }),   // only 1 with evidence
      log(11, { hasEvidence: false }),
      log(11, { hasEvidence: false }),
      log(11, { hasEvidence: false }),
      log(11, { hasEvidence: false }),
      log(11, { hasEvidence: false }),
      log(11, { hasEvidence: false }),
      log(11, { hasEvidence: false }),
      log(11, { hasEvidence: false }),
      log(11, { hasEvidence: false }),
    ];

    it('returns riskLevel: "high"', () => {
      const { riskLevel } = score(logs, ASSIGNMENT_START, null, NOW);
      assert.equal(riskLevel, 'high');
    });

    it('returns 4 signals', () => {
      const { signals } = score(logs, ASSIGNMENT_START, null, NOW);
      assert.equal(signals.length, 4, `Expected 4 signals, got: ${JSON.stringify(signals)}`);
    });

    it('signal 1 (submission trend drop) is present', () => {
      const { signals } = score(logs, ASSIGNMENT_START, null, NOW);
      const s1 = signals.find((s) => s.includes('Submission frequency down'));
      assert.ok(s1, 'Signal 1 must be present');
      assert.ok(s1.includes('100%'), 'Signal 1 should report 100% drop');
    });

    it('signal 2 (overdue milestone) is present', () => {
      const { signals } = score(logs, ASSIGNMENT_START, null, NOW);
      const s2 = signals.find((s) => s.includes('No progress log submitted'));
      assert.ok(s2, 'Signal 2 must be present');
      assert.ok(s2.includes('11'), 'Signal 2 should report 11 days');
    });

    it('signal 3 (mentor contact gap) is present', () => {
      const { signals } = score(logs, ASSIGNMENT_START, null, NOW);
      const s3 = signals.find((s) => s.includes('mentor interaction'));
      assert.ok(s3, 'Signal 3 must be present');
    });

    it('signal 4 (low evidence frequency) is present', () => {
      const { signals } = score(logs, ASSIGNMENT_START, null, NOW);
      const s4 = signals.find((s) => s.includes('Low evidence'));
      assert.ok(s4, 'Signal 4 must be present');
      assert.ok(s4.includes('10%'), 'Signal 4 should report 10%');
    });
  });

  // ── Signal 1 boundary: exactly 30% drop does NOT trigger ─────────────────
  describe('submission trend: exactly 30% drop does not trigger', () => {
    // prior=10, recent=7 → 30% drop → NOT > 30% → no trigger
    const ASSIGNMENT_START = daysAgo(20);
    const logs = [
      log(6), log(5), log(4), log(3), log(2), log(1), log(0),         // 7 recent
      log(13), log(12), log(11), log(10), log(9), log(8), log(7), log(7), log(7), // 10 prior
    ];

    it('signal 1 does not fire at exactly 30% drop', () => {
      // prior=10 (using only 10 logs from prior window), recent=7
      const tenPrior = [
        log(13), log(12), log(11), log(10), log(9), log(8),
        log(13), log(12), log(11), log(10),
      ];
      const sevenRecent = [log(6), log(5), log(4), log(3), log(2), log(1), log(0)];
      const LAST_INTERACTION = daysAgo(1);
      const { signals } = score(
        [...sevenRecent, ...tenPrior],
        ASSIGNMENT_START,
        LAST_INTERACTION,
        NOW,
      );
      const s1 = signals.find((s) => s.includes('Submission frequency down'));
      assert.equal(s1, undefined, 'Exactly 30% drop must NOT trigger signal 1');
    });
  });

  // ── Signal 4: evidence rate exactly 50% does NOT trigger ─────────────────
  describe('evidence frequency: exactly 50% does not trigger', () => {
    const ASSIGNMENT_START = daysAgo(20);
    const LAST_INTERACTION = daysAgo(5);
    const evenLogs = [
      log(6, { hasEvidence: true }),
      log(5, { hasEvidence: false }),
    ];

    it('signal 4 does not fire at exactly 50% evidence rate', () => {
      const { signals } = score(evenLogs, ASSIGNMENT_START, LAST_INTERACTION, NOW);
      const s4 = signals.find((s) => s.includes('Low evidence'));
      assert.equal(s4, undefined, '50% evidence rate must NOT trigger signal 4');
    });
  });

  // ── Signal 1: prior window had zero logs → signal must be skipped ─────────
  describe('submission trend: prior window empty → no trend signal', () => {
    // All logs are in the recent window; prior window has zero logs → skip signal 1
    const ASSIGNMENT_START = daysAgo(10);
    const LAST_INTERACTION = daysAgo(5);
    const onlyRecentLogs = [log(6), log(5), log(4), log(3)];

    it('signal 1 does not fire when prior window is empty', () => {
      const { signals } = score(onlyRecentLogs, ASSIGNMENT_START, LAST_INTERACTION, NOW);
      const s1 = signals.find((s) => s.includes('Submission frequency down'));
      assert.equal(s1, undefined, 'Signal 1 must be skipped when prior window has 0 logs');
    });
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('riskEngine.getEffectiveRisk()', () => {

  const HIGH_SCORE = { riskLevel: 'high', signals: ['Signal A', 'Signal B'] };
  const MEDIUM_SCORE = { riskLevel: 'medium', signals: ['Signal A'] };

  // ── Test 5: No dismissal → pass through unchanged ─────────────────────────
  describe('no dismissal', () => {
    it('returns riskLevel unchanged', () => {
      const result = getEffectiveRisk(HIGH_SCORE, null, daysAgo(1));
      assert.equal(result.riskLevel, 'high');
    });

    it('returns signals unchanged', () => {
      const result = getEffectiveRisk(HIGH_SCORE, null, daysAgo(1));
      assert.deepEqual(result.signals, ['Signal A', 'Signal B']);
    });

    it('returns suppressed: false', () => {
      const result = getEffectiveRisk(HIGH_SCORE, null, daysAgo(1));
      assert.equal(result.suppressed, false);
    });

    it('does not mutate the original liveScore object', () => {
      const original = { riskLevel: 'high', signals: ['Signal A'] };
      getEffectiveRisk(original, null, daysAgo(1));
      assert.equal(original.suppressed, undefined, 'liveScore must not be mutated');
    });
  });

  // ── Test 6: Dismissed, no new logs since → suppressed ────────────────────
  describe('dismissal exists, mostRecentProgressLogAt before dismissedAt → suppressed', () => {
    // Dismissed on June 10; most recent log was June 8 (before dismissal)
    const DISMISSAL = { dismissedAt: daysAgo(5) }; // June 10
    const LOG_BEFORE_DISMISSAL = daysAgo(7);       // June 8 < June 10

    it('returns suppressed: true', () => {
      const result = getEffectiveRisk(HIGH_SCORE, DISMISSAL, LOG_BEFORE_DISMISSAL);
      assert.equal(result.suppressed, true);
    });

    it('forces riskLevel to "low"', () => {
      const result = getEffectiveRisk(HIGH_SCORE, DISMISSAL, LOG_BEFORE_DISMISSAL);
      assert.equal(result.riskLevel, 'low');
    });

    it('returns empty signals array', () => {
      const result = getEffectiveRisk(HIGH_SCORE, DISMISSAL, LOG_BEFORE_DISMISSAL);
      assert.deepEqual(result.signals, []);
    });
  });

  // ── Test 6b: Dismissed, no progress logs at all (null) → suppressed ───────
  describe('dismissal exists, mostRecentProgressLogAt is null → suppressed', () => {
    const DISMISSAL = { dismissedAt: daysAgo(5) };

    it('returns suppressed: true', () => {
      assert.equal(getEffectiveRisk(HIGH_SCORE, DISMISSAL, null).suppressed, true);
    });

    it('forces riskLevel to "low"', () => {
      assert.equal(getEffectiveRisk(HIGH_SCORE, DISMISSAL, null).riskLevel, 'low');
    });

    it('returns empty signals array', () => {
      assert.deepEqual(getEffectiveRisk(HIGH_SCORE, DISMISSAL, null).signals, []);
    });
  });

  // ── Test 7: Dismissed but new log arrived after dismissedAt → not suppressed
  describe('dismissal exists, new log submitted after dismissedAt → not suppressed', () => {
    // Dismissed June 10 (5 days ago); new log on June 13 (2 days ago) — after dismissal
    const DISMISSAL = { dismissedAt: daysAgo(5) };  // June 10
    const LOG_AFTER_DISMISSAL = daysAgo(2);           // June 13 > June 10

    it('returns suppressed: false', () => {
      const result = getEffectiveRisk(HIGH_SCORE, DISMISSAL, LOG_AFTER_DISMISSAL);
      assert.equal(result.suppressed, false);
    });

    it('returns original riskLevel unchanged', () => {
      const result = getEffectiveRisk(HIGH_SCORE, DISMISSAL, LOG_AFTER_DISMISSAL);
      assert.equal(result.riskLevel, 'high');
    });

    it('returns original signals unchanged', () => {
      const result = getEffectiveRisk(HIGH_SCORE, DISMISSAL, LOG_AFTER_DISMISSAL);
      assert.deepEqual(result.signals, ['Signal A', 'Signal B']);
    });

    it('also works when original score is medium', () => {
      const result = getEffectiveRisk(MEDIUM_SCORE, DISMISSAL, LOG_AFTER_DISMISSAL);
      assert.equal(result.riskLevel, 'medium');
      assert.equal(result.suppressed, false);
    });
  });

  // ── Test: Log submitted exactly at dismissedAt → suppressed ───────────────
  describe('mostRecentProgressLogAt exactly equals dismissedAt → suppressed', () => {
    const TIMESTAMP = daysAgo(5);
    const DISMISSAL = { dismissedAt: TIMESTAMP };

    it('treats equal timestamps as suppressed (not > dismissedAt)', () => {
      const result = getEffectiveRisk(HIGH_SCORE, DISMISSAL, TIMESTAMP);
      assert.equal(result.suppressed, true);
      assert.equal(result.riskLevel, 'low');
    });
  });
});
