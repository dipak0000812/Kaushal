import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { evaluate } from '../../src/modules/eligibility/eligibilityEngine.js';

// ─── Fixtures ──────────────────────────────────────────────────────────────

const FULL_PROFILE = {
  cgpa: 8.5,
  activeBacklogs: 0,
  department: 'CSE',
  skills: ['JavaScript', 'Node.js', 'SQL'],
  certifications: ['AWS-CCP', 'Docker'],
  passingYear: 2025,
};

const FULL_CRITERIA = {
  minCgpa: 7.0,
  maxBacklogs: 2,
  departments: ['CSE'],
  requiredSkills: ['JavaScript', 'Node.js', 'SQL'],
  requiredCerts: ['AWS-CCP', 'Docker'],
};

// ─── Helpers ──────────────────────────────────────────────────────────────

function findCheck(checks, criterion) {
  return checks.find((c) => c.criterion === criterion);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('eligibilityEngine.evaluate()', () => {

  // ── Test 1: All criteria pass ─────────────────────────────────────────────
  describe('all criteria pass', () => {
    it('returns eligible: true', () => {
      const result = evaluate(FULL_PROFILE, FULL_CRITERIA);
      assert.equal(result.eligible, true);
    });

    it('returns exactly 5 checks', () => {
      const result = evaluate(FULL_PROFILE, FULL_CRITERIA);
      assert.equal(result.checks.length, 5);
    });

    it('every check has pass: true', () => {
      const { checks } = evaluate(FULL_PROFILE, FULL_CRITERIA);
      for (const check of checks) {
        assert.equal(check.pass, true, `Expected ${check.criterion} to pass`);
      }
    });

    it('every check has reason: null on pass', () => {
      const { checks } = evaluate(FULL_PROFILE, FULL_CRITERIA);
      for (const check of checks) {
        assert.equal(check.reason, null, `Expected ${check.criterion} reason to be null`);
      }
    });

    it('returns a computedAt Date', () => {
      const result = evaluate(FULL_PROFILE, FULL_CRITERIA);
      assert.ok(result.computedAt instanceof Date);
    });
  });

  // ── Test 2: CGPA fails, everything else passes ────────────────────────────
  describe('CGPA fails, all other criteria pass', () => {
    const profile = { ...FULL_PROFILE, cgpa: 5.9 };
    const criteria = { ...FULL_CRITERIA, minCgpa: 7.0 };

    it('returns eligible: false', () => {
      const result = evaluate(profile, criteria);
      assert.equal(result.eligible, false);
    });

    it('returns exactly 5 checks', () => {
      const result = evaluate(profile, criteria);
      assert.equal(result.checks.length, 5);
    });

    it('CGPA check has pass: false', () => {
      const { checks } = evaluate(profile, criteria);
      const cgpaCheck = findCheck(checks, 'CGPA');
      assert.ok(cgpaCheck, 'CGPA check must exist');
      assert.equal(cgpaCheck.pass, false);
    });

    it('CGPA check has a non-null reason', () => {
      const { checks } = evaluate(profile, criteria);
      const cgpaCheck = findCheck(checks, 'CGPA');
      assert.ok(cgpaCheck.reason !== null && cgpaCheck.reason.length > 0);
    });

    it('all other 4 checks still pass', () => {
      const { checks } = evaluate(profile, criteria);
      const others = checks.filter((c) => c.criterion !== 'CGPA');
      assert.equal(others.length, 4);
      for (const check of others) {
        assert.equal(check.pass, true, `Expected ${check.criterion} to pass`);
      }
    });

    it('all other 4 checks have reason: null', () => {
      const { checks } = evaluate(profile, criteria);
      const others = checks.filter((c) => c.criterion !== 'CGPA');
      for (const check of others) {
        assert.equal(check.reason, null, `Expected ${check.criterion} reason to be null`);
      }
    });
  });

  // ── Test 3: Multiple simultaneous failures (the short-circuit regression test) ─
  describe('CGPA AND backlogs AND skills all fail simultaneously', () => {
    const profile = {
      ...FULL_PROFILE,
      cgpa: 5.0,           // fails: below 7.0
      activeBacklogs: 5,   // fails: exceeds max 2
      skills: ['JavaScript'], // fails: missing Node.js and SQL
    };
    const criteria = {
      ...FULL_CRITERIA,
      minCgpa: 7.0,
      maxBacklogs: 2,
      departments: ['CSE'],
      requiredSkills: ['JavaScript', 'Node.js', 'SQL'],
    };

    it('returns eligible: false', () => {
      assert.equal(evaluate(profile, criteria).eligible, false);
    });

    it('returns exactly 5 checks', () => {
      assert.equal(evaluate(profile, criteria).checks.length, 5);
    });

    it('CGPA check fails', () => {
      const cgpaCheck = findCheck(evaluate(profile, criteria).checks, 'CGPA');
      assert.ok(cgpaCheck, 'CGPA check must be present');
      assert.equal(cgpaCheck.pass, false, 'CGPA should fail');
    });

    it('BACKLOGS check fails', () => {
      const backlogsCheck = findCheck(evaluate(profile, criteria).checks, 'BACKLOGS');
      assert.ok(backlogsCheck, 'BACKLOGS check must be present');
      assert.equal(backlogsCheck.pass, false, 'BACKLOGS should fail');
    });

    it('SKILLS check fails', () => {
      const skillsCheck = findCheck(evaluate(profile, criteria).checks, 'SKILLS');
      assert.ok(skillsCheck, 'SKILLS check must be present');
      assert.equal(skillsCheck.pass, false, 'SKILLS should fail');
    });

    it('DEPARTMENT and CERTIFICATIONS checks still pass', () => {
      const { checks } = evaluate(profile, criteria);
      const deptCheck = findCheck(checks, 'DEPARTMENT');
      const certCheck = findCheck(checks, 'CERTIFICATIONS');
      assert.equal(deptCheck.pass, true, 'DEPARTMENT should still pass');
      assert.equal(certCheck.pass, true, 'CERTIFICATIONS should still pass');
    });

    it('each failing check has a non-null reason', () => {
      const { checks } = evaluate(profile, criteria);
      const failing = checks.filter((c) => !c.pass);
      assert.equal(failing.length, 3, 'Exactly 3 checks should fail');
      for (const check of failing) {
        assert.ok(check.reason !== null && check.reason.length > 0,
          `${check.criterion} should have a reason`);
      }
    });
  });

  // ── Test 4: Partial skill match — 2 of 3 required skills present ──────────
  describe('partial skill match (student has 2 of 3 required skills)', () => {
    const profile = { ...FULL_PROFILE, skills: ['JavaScript', 'Node.js'] }; // missing SQL
    const criteria = { ...FULL_CRITERIA, requiredSkills: ['JavaScript', 'Node.js', 'SQL'] };

    it('returns eligible: false', () => {
      assert.equal(evaluate(profile, criteria).eligible, false);
    });

    it('SKILLS check has pass: false', () => {
      const skillsCheck = findCheck(evaluate(profile, criteria).checks, 'SKILLS');
      assert.equal(skillsCheck.pass, false);
    });

    it('reason names only the missing skill (SQL), not the present ones', () => {
      const skillsCheck = findCheck(evaluate(profile, criteria).checks, 'SKILLS');
      assert.ok(skillsCheck.reason.includes('SQL'), 'reason must mention missing skill SQL');
      assert.ok(!skillsCheck.reason.includes('JavaScript'), 'reason must not mention present skills');
      assert.ok(!skillsCheck.reason.includes('Node.js'), 'reason must not mention present skills');
    });

    it('reason starts with "Missing:"', () => {
      const skillsCheck = findCheck(evaluate(profile, criteria).checks, 'SKILLS');
      assert.ok(skillsCheck.reason.startsWith('Missing:'));
    });
  });

  // ── Test 5: Empty requiredSkills / requiredCerts array → auto-pass ─────────
  describe('criteria.requiredSkills is an empty array', () => {
    const criteria = { ...FULL_CRITERIA, requiredSkills: [] };

    it('SKILLS check has pass: true', () => {
      const skillsCheck = findCheck(evaluate(FULL_PROFILE, criteria).checks, 'SKILLS');
      assert.equal(skillsCheck.pass, true);
    });

    it('SKILLS check has reason: null', () => {
      const skillsCheck = findCheck(evaluate(FULL_PROFILE, criteria).checks, 'SKILLS');
      assert.equal(skillsCheck.reason, null);
    });

    it('does not affect eligible — still true when all else passes', () => {
      assert.equal(evaluate(FULL_PROFILE, criteria).eligible, true);
    });

    it('empty requiredCerts also auto-passes', () => {
      const certsCriteria = { ...FULL_CRITERIA, requiredSkills: [], requiredCerts: [] };
      const certCheck = findCheck(evaluate(FULL_PROFILE, certsCriteria).checks, 'CERTIFICATIONS');
      assert.equal(certCheck.pass, true);
      assert.equal(certCheck.reason, null);
    });
  });

  // ── Test 6: Department array checks ───────────────────────────────────────
  describe('criteria.departments array checks', () => {
    it('empty departments array auto-passes with reason null', () => {
      const criteria = { ...FULL_CRITERIA, departments: [] };
      const profileWithDifferentDept = { ...FULL_PROFILE, department: 'Mechanical' };
      const deptCheck = findCheck(evaluate(profileWithDifferentDept, criteria).checks, 'DEPARTMENT');
      assert.equal(deptCheck.pass, true);
      assert.equal(deptCheck.reason, null);
    });

    it('undefined departments property auto-passes', () => {
      const criteriaWithoutDept = { ...FULL_CRITERIA };
      delete criteriaWithoutDept.departments;
      const deptCheck = findCheck(evaluate(FULL_PROFILE, criteriaWithoutDept).checks, 'DEPARTMENT');
      assert.equal(deptCheck.pass, true);
      assert.equal(deptCheck.reason, null);
    });

    it('student department IS in multi-department array → passes', () => {
      const criteria = { ...FULL_CRITERIA, departments: ['Computer Science', 'Information Technology'] };
      const itProfile = { ...FULL_PROFILE, department: 'Information Technology' };
      const deptCheck = findCheck(evaluate(itProfile, criteria).checks, 'DEPARTMENT');
      assert.equal(deptCheck.pass, true);
      assert.equal(deptCheck.reason, null);
    });

    it('student department is NOT in multi-department array → fails with allowed departments reason', () => {
      const criteria = { ...FULL_CRITERIA, departments: ['Computer Science', 'Information Technology'] };
      const mechProfile = { ...FULL_PROFILE, department: 'Mechanical' };
      const deptCheck = findCheck(evaluate(mechProfile, criteria).checks, 'DEPARTMENT');
      assert.equal(deptCheck.pass, false);
      assert.ok(deptCheck.reason.includes('Mechanical'));
      assert.ok(deptCheck.reason.includes('Computer Science'));
      assert.ok(deptCheck.reason.includes('Information Technology'));
    });
  });

  // ── Test 7: Missing field on studentProfile — graceful failure ────────────
  describe('studentProfile is missing fields', () => {
    const profileWithoutCgpa = {
      activeBacklogs: 0,
      department: 'CSE',
      skills: ['JavaScript', 'Node.js', 'SQL'],
      certifications: ['AWS-CCP', 'Docker'],
    };

    it('does not throw when cgpa is missing', () => {
      assert.doesNotThrow(() => evaluate(profileWithoutCgpa, FULL_CRITERIA));
    });

    it('CGPA check has pass: false', () => {
      const cgpaCheck = findCheck(evaluate(profileWithoutCgpa, FULL_CRITERIA).checks, 'CGPA');
      assert.equal(cgpaCheck.pass, false);
    });

    it('CGPA check reason mentions missing field', () => {
      const cgpaCheck = findCheck(evaluate(profileWithoutCgpa, FULL_CRITERIA).checks, 'CGPA');
      assert.ok(cgpaCheck.reason.includes('cgpa'), 'reason should name the missing field');
    });

    it('department check fails gracefully when department is missing from profile', () => {
      const profileWithoutDept = {
        cgpa: 8.5,
        activeBacklogs: 0,
        skills: ['JavaScript', 'Node.js', 'SQL'],
        certifications: ['AWS-CCP', 'Docker'],
      };
      const deptCheck = findCheck(evaluate(profileWithoutDept, FULL_CRITERIA).checks, 'DEPARTMENT');
      assert.equal(deptCheck.pass, false);
      assert.ok(deptCheck.reason.includes('department'));
    });

    it('still returns exactly 5 checks', () => {
      assert.equal(evaluate(profileWithoutCgpa, FULL_CRITERIA).checks.length, 5);
    });

    it('all other checks evaluate normally', () => {
      const { checks } = evaluate(profileWithoutCgpa, FULL_CRITERIA);
      const others = checks.filter((c) => c.criterion !== 'CGPA');
      assert.equal(others.length, 4);
      for (const check of others) {
        assert.equal(check.pass, true, `${check.criterion} should still evaluate normally and pass`);
      }
    });

    it('returns eligible: false because one check failed', () => {
      assert.equal(evaluate(profileWithoutCgpa, FULL_CRITERIA).eligible, false);
    });
  });

  // ── Additional correctness checks ─────────────────────────────────────────
  describe('correctness: reason is always null when pass is true', () => {
    it('never populates reason on a passing check', () => {
      const variations = [
        evaluate(FULL_PROFILE, FULL_CRITERIA),
        evaluate(FULL_PROFILE, { minCgpa: null, maxBacklogs: null, departments: [], requiredSkills: [], requiredCerts: [] }),
        evaluate(FULL_PROFILE, { ...FULL_CRITERIA, departments: [], requiredSkills: [] }),
      ];
      for (const result of variations) {
        for (const check of result.checks) {
          if (check.pass) {
            assert.equal(check.reason, null, `${check.criterion} passes but reason is not null`);
          }
        }
      }
    });
  });

  describe('multiple missing skills listed in reason', () => {
    it('reason lists all missing skills separated by comma', () => {
      const profile = { ...FULL_PROFILE, skills: [] };
      const criteria = { ...FULL_CRITERIA, requiredSkills: ['SQL', 'Docker', 'Redis'] };
      const skillsCheck = findCheck(evaluate(profile, criteria).checks, 'SKILLS');
      assert.equal(skillsCheck.pass, false);
      assert.ok(skillsCheck.reason.includes('SQL'), 'SQL should appear in reason');
      assert.ok(skillsCheck.reason.includes('Docker'), 'Docker should appear in reason');
      assert.ok(skillsCheck.reason.includes('Redis'), 'Redis should appear in reason');
    });
  });

  describe('CGPA boundary: exactly equal to minimum', () => {
    it('passes when cgpa === minCgpa', () => {
      const profile = { ...FULL_PROFILE, cgpa: 7.0 };
      const criteria = { ...FULL_CRITERIA, minCgpa: 7.0 };
      const cgpaCheck = findCheck(evaluate(profile, criteria).checks, 'CGPA');
      assert.equal(cgpaCheck.pass, true);
    });
  });

  describe('backlogs boundary: exactly equal to maximum', () => {
    it('passes when activeBacklogs === maxBacklogs', () => {
      const profile = { ...FULL_PROFILE, activeBacklogs: 2 };
      const criteria = { ...FULL_CRITERIA, maxBacklogs: 2 };
      const backlogsCheck = findCheck(evaluate(profile, criteria).checks, 'BACKLOGS');
      assert.equal(backlogsCheck.pass, true);
    });
  });
});
