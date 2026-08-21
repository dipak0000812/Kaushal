'use client';

import React from 'react';
import { EligibilitySnapshot } from '@/lib/types';
import { CheckCircle2, XCircle, AlertCircle } from 'lucide-react';

interface EligibilityBreakdownProps {
  eligibility: EligibilitySnapshot;
}

export default function EligibilityBreakdown({ eligibility }: EligibilityBreakdownProps) {
  const getCriterionLabel = (key: string) => {
    switch (key) {
      case 'minCgpa': return 'Minimum CGPA Requirement';
      case 'maxBacklogs': return 'Maximum Active Backlogs';
      case 'department': return 'Department Alignment';
      case 'year': return 'Academic Year Eligibility';
      case 'requiredSkills': return 'Required Skills Matches';
      case 'requiredCerts': return 'Required Certifications';
      default: return key;
    }
  };

  return (
    <div className="bg-white border border-[#E2E8F0] rounded-lg p-6">
      <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-4 mb-4">
        <div>
          <h3 className="text-sm font-semibold text-[#0F172A]">Eligibility Criteria Checklist</h3>
          <p className="text-xs text-[#94A3B8] mt-0.5">
            Computed on {new Date(eligibility.computedAt).toLocaleDateString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-[#475569]">Overall Status:</span>
          {eligibility.eligible ? (
            <span className="bg-[#DCFCE7] text-[#16A34A] text-xs font-bold px-2.5 py-1 rounded-full border border-[#BBF7D0]">
              ELIGIBLE
            </span>
          ) : (
            <span className="bg-[#FEE2E2] text-[#DC2626] text-xs font-bold px-2.5 py-1 rounded-full border border-[#FECACA]">
              NOT ELIGIBLE
            </span>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {eligibility.checks.map((check, index) => {
          return (
            <div 
              key={index} 
              className={`flex items-start gap-3 p-3 rounded-md border ${
                check.passed 
                  ? 'bg-[#F8FAFC] border-[#E2E8F0]' 
                  : 'bg-[#FFF5F5] border-[#FEE2E2]'
              }`}
            >
              {check.passed ? (
                <CheckCircle2 className="w-5 h-5 text-[#16A34A] shrink-0 mt-0.5" />
              ) : (
                <XCircle className="w-5 h-5 text-[#DC2626] shrink-0 mt-0.5" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-[#334155]">
                  {getCriterionLabel(check.criterion)}
                </p>
                <p className={`text-xs mt-0.5 ${check.passed ? 'text-[#64748B]' : 'text-[#B91C1C]'}`}>
                  {check.message || (check.passed ? 'Requirement satisfied.' : 'Criterion check failed.')}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {!eligibility.eligible && (
        <div className="mt-4 p-3 bg-[#FEF3C7] border border-[#FDE68A] rounded-md flex gap-2">
          <AlertCircle className="w-4 h-4 text-[#D97706] shrink-0 mt-0.5" />
          <p className="text-xs text-[#B45309]">
            <strong>T&P Override Note:</strong> If this student is ineligible but has special authorization, T&P officials can apply a manual override on the verification queue.
          </p>
        </div>
      )}
    </div>
  );
}
