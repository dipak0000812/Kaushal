'use client';

import React from 'react';
import { Dismissal } from '@/lib/types';
import { ShieldAlert, ShieldCheck } from 'lucide-react';

interface RiskBadgeProps {
  riskLevel: 'HIGH' | 'MEDIUM' | null;
  dismissal?: Dismissal | null;
}

export default function RiskBadge({ riskLevel, dismissal }: RiskBadgeProps) {
  // If no risk and no dismissal, render nothing
  if (!riskLevel && !dismissal) {
    return null;
  }

  // If there's an active dismissal, render the dismissed state
  if (dismissal) {
    return (
      <span 
        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-sm bg-[#F1F5F9] text-[#64748B] border border-[#CBD5E1] tracking-wide"
        title={`Dismissed by Faculty on ${new Date(dismissal.dismissedAt).toLocaleDateString()}: "${dismissal.note || 'No note provided'}"`}
      >
        <ShieldCheck className="w-3.5 h-3.5" />
        RISK DISMISSED
      </span>
    );
  }

  // Otherwise, render matching risk levels
  if (riskLevel === 'HIGH') {
    return (
      <span 
        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-sm bg-[#FEE2E2] text-[#B91C1C] border border-[#FCA5A5] tracking-wider animate-pulse"
        title="Immediate attention required: No progress logs submitted in over 7 days."
      >
        <ShieldAlert className="w-3.5 h-3.5 stroke-[2.5]" />
        HIGH RISK
      </span>
    );
  }

  if (riskLevel === 'MEDIUM') {
    return (
      <span 
        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-sm bg-[#FEF3C7] text-[#B45309] border border-[#FDE68A] tracking-wider"
        title="Caution advised: Student has a historically rejected mentor assignment."
      >
        <ShieldAlert className="w-3.5 h-3.5" />
        MEDIUM RISK
      </span>
    );
  }

  return null;
}
