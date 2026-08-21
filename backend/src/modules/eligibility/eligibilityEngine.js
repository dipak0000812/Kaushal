/**
 * Evaluates a student's eligibility against a set of internship criteria.
 *
 * Every criterion is evaluated independently — no short-circuiting. All five
 * checks always appear in the returned `checks` array regardless of earlier
 * results. `eligible` is `true` only when every single check has `pass: true`.
 *
 * @param {{ cgpa: number, activeBacklogs: number, department: string, skills: string[], certifications: string[], passingYear?: number }} studentProfile
 * @param {{ minCgpa?: number|null, maxBacklogs?: number|null, departments?: string[], requiredSkills?: string[], requiredCerts?: string[] }} criteria
 * @returns {{ eligible: boolean, checks: Array<{criterion: string, required: any, actual: any, pass: boolean, reason: string|null}>, computedAt: Date }}
 */
export function evaluate(studentProfile, criteria) {
  const p = studentProfile ?? {};
  const c = criteria ?? {};
  const checks = [];

  // ── 1. CGPA ──────────────────────────────────────────────────────────────
  {
    const required = c.minCgpa ?? null;
    const actual = p.cgpa;
    if (required === null || required === undefined) {
      checks.push({ criterion: 'CGPA', required, actual: actual ?? null, pass: true, reason: null });
    } else if (actual === undefined || actual === null) {
      checks.push({ criterion: 'CGPA', required, actual, pass: false, reason: 'Student profile missing field: cgpa' });
    } else {
      const pass = actual >= required;
      checks.push({ criterion: 'CGPA', required, actual, pass, reason: pass ? null : `CGPA ${actual} is below minimum ${required}` });
    }
  }

  // ── 2. Active backlogs ────────────────────────────────────────────────────
  {
    const required = c.maxBacklogs ?? null;
    const actual = p.activeBacklogs;
    if (required === null || required === undefined) {
      checks.push({ criterion: 'BACKLOGS', required, actual: actual ?? null, pass: true, reason: null });
    } else if (actual === undefined || actual === null) {
      checks.push({ criterion: 'BACKLOGS', required, actual, pass: false, reason: 'Student profile missing field: activeBacklogs' });
    } else {
      const pass = actual <= required;
      checks.push({ criterion: 'BACKLOGS', required, actual, pass, reason: pass ? null : `Active backlogs ${actual} exceeds maximum ${required}` });
    }
  }

  // ── 3. Department ─────────────────────────────────────────────────────────
  {
    const required = Array.isArray(c.departments) ? c.departments : [];
    const actual = p.department;
    if (required.length === 0) {
      checks.push({ criterion: 'DEPARTMENT', required, actual: actual ?? null, pass: true, reason: null });
    } else if (actual === undefined || actual === null) {
      checks.push({ criterion: 'DEPARTMENT', required, actual, pass: false, reason: 'Student profile missing field: department' });
    } else {
      const pass = required.includes(actual);
      checks.push({
        criterion: 'DEPARTMENT',
        required,
        actual,
        pass,
        reason: pass ? null : `Department '${actual}' not in allowed departments: ${required.join(', ')}`,
      });
    }
  }

  // ── 4. Required skills ────────────────────────────────────────────────────
  {
    const required = Array.isArray(c.requiredSkills) ? c.requiredSkills : [];
    const actual = Array.isArray(p.skills) ? p.skills : [];
    if (required.length === 0) {
      checks.push({ criterion: 'SKILLS', required, actual, pass: true, reason: null });
    } else {
      const missing = required.filter((s) => !actual.includes(s));
      const pass = missing.length === 0;
      checks.push({ criterion: 'SKILLS', required, actual, pass, reason: pass ? null : `Missing: ${missing.join(', ')}` });
    }
  }

  // ── 5. Required certifications ────────────────────────────────────────────
  {
    const required = Array.isArray(c.requiredCerts) ? c.requiredCerts : [];
    const actual = Array.isArray(p.certifications) ? p.certifications : [];
    if (required.length === 0) {
      checks.push({ criterion: 'CERTIFICATIONS', required, actual, pass: true, reason: null });
    } else {
      const missing = required.filter((cert) => !actual.includes(cert));
      const pass = missing.length === 0;
      checks.push({ criterion: 'CERTIFICATIONS', required, actual, pass, reason: pass ? null : `Missing: ${missing.join(', ')}` });
    }
  }

  return {
    eligible: checks.every((ch) => ch.pass),
    checks,
    computedAt: new Date(),
  };
}
