'use client';

import React from 'react';
import { ApplicationStatus, TimelineEvent } from '@/lib/types';
import { Check, X, AlertCircle, Play, HelpCircle } from 'lucide-react';

interface StatusStepperProps {
  currentStatus: ApplicationStatus;
  timeline?: TimelineEvent[];
}

interface StepConfig {
  status: ApplicationStatus;
  label: string;
  description: string;
}

const SUCCESS_STEPS: StepConfig[] = [
  { status: ApplicationStatus.APPLIED, label: 'Applied', description: 'Application submitted by student' },
  { status: ApplicationStatus.SHORTLISTED, label: 'Shortlisted', description: 'Company shortlisted candidate' },
  { status: ApplicationStatus.OFFERED, label: 'Offered', description: 'Internship offer extended by company' },
  { status: ApplicationStatus.ACCEPTED, label: 'Accepted', description: 'Offer accepted by student' },
  { status: ApplicationStatus.TNP_VERIFIED, label: 'T&P Verified', description: 'Offer verified by T&P cell' },
  { status: ApplicationStatus.MENTOR_PENDING, label: 'Mentor Assignment', description: 'Mentor assignment pending' },
  { status: ApplicationStatus.MENTOR_ASSIGNED, label: 'Mentor Assigned', description: 'Faculty mentor assigned' },
  { status: ApplicationStatus.IN_PROGRESS, label: 'In Progress', description: 'Weekly progress reports active' },
  { status: ApplicationStatus.COMPLETED, label: 'Completed', description: 'Internship successfully completed' },
];

export default function StatusStepper({ currentStatus, timeline = [] }: StatusStepperProps) {
  // Determine if application is in a terminal negative state
  const isTerminalNegative = [
    ApplicationStatus.REJECTED,
    ApplicationStatus.WITHDRAWN,
    ApplicationStatus.CANCELLED
  ].includes(currentStatus);

  // If in a terminal negative state, we find where the success path broke
  const getFailingIndex = () => {
    if (!isTerminalNegative) return -1;
    // Fallback if timeline is missing/short — don't guess a specific step;
    // assume failure happened late rather than misleadingly early
    if (!timeline || timeline.length < 2) {
      return SUCCESS_STEPS.length - 1;
    }
    // Derive from timeline: the state immediately preceding the terminal transition
    const priorState = timeline[timeline.length - 2]?.toStatus;
    if (priorState) {
      const idx = SUCCESS_STEPS.findIndex(s => s.status === priorState);
      if (idx !== -1) return idx;
    }
    return SUCCESS_STEPS.length - 1;
  };

  const failingIndex = getFailingIndex();

  const getStepState = (index: number, stepStatus: ApplicationStatus) => {
    if (isTerminalNegative) {
      if (index < failingIndex) {
        return 'success';
      }
      if (index === failingIndex) {
        return 'terminal-negative';
      }
      return 'open';
    }

    const currentIndex = SUCCESS_STEPS.findIndex(s => s.status === currentStatus);
    if (index < currentIndex) {
      return 'success';
    }
    if (index === currentIndex) {
      return 'active';
    }
    return 'open';
  };

  // Get matching terminal-negative label
  const getTerminalLabel = () => {
    if (currentStatus === ApplicationStatus.REJECTED) return 'Rejected by Company';
    if (currentStatus === ApplicationStatus.WITHDRAWN) return 'Offer Declined / Withdrawn';
    if (currentStatus === ApplicationStatus.CANCELLED) return 'Application Cancelled';
    return 'Cancelled';
  };

  // Build the list of steps to render
  const stepsToRender = SUCCESS_STEPS.map((step, index) => {
    const state = getStepState(index, step.status);
    
    // Inject the terminal negative status replacement at the branch index
    if (isTerminalNegative && index === failingIndex) {
      return {
        label: getTerminalLabel(),
        description: timeline.find(t => t.toStatus === currentStatus)?.reason || 'Application halted at this stage',
        state: 'terminal-negative' as const,
        status: currentStatus
      };
    }

    return {
      label: step.label,
      description: step.description,
      state: state as 'success' | 'active' | 'open' | 'terminal-negative',
      status: step.status
    };
  });

  return (
    <div className="w-full bg-white border border-[#E2E8F0] rounded-lg p-6">
      <h3 className="text-sm font-semibold text-[#0F172A] mb-6 flex items-center gap-2">
        <span>Application Progress Lifecycle</span>
        <span className="text-xs px-2 py-0.5 rounded bg-[#F1F5F9] text-[#475569] font-mono capitalize">
          {currentStatus}
        </span>
      </h3>

      {/* Timeline flow */}
      <div className="relative border-l border-[#CBD5E1] ml-4 pl-8 space-y-8 py-2">
        {stepsToRender.map((step, idx) => {
          const timestamp = timeline.find(t => t.toStatus === step.status)?.at;

          // Determine class styles matching design token names
          let iconBg = 'bg-[#F1F5F9]'; // stepper-node-open
          let iconText = 'text-[#64748B]';
          let borderStyle = 'border-2 border-[#E2E8F0]';
          let titleColor = 'text-[#64748B]';

          if (step.state === 'success') {
            iconBg = 'bg-[#DCFCE7]'; // stepper-node-success
            iconText = 'text-[#16A34A]';
            borderStyle = 'border-2 border-[#16A34A]';
            titleColor = 'text-[#16A34A] font-semibold';
          } else if (step.state === 'active') {
            iconBg = 'bg-[#EDE9FE]'; // stepper-node-active
            iconText = 'text-[#5B21B6]';
            borderStyle = 'border-2 border-[#5B21B6] ring-4 ring-[#EDE9FE]';
            titleColor = 'text-[#5B21B6] font-bold';
          } else if (step.state === 'terminal-negative') {
            iconBg = 'bg-[#F1F5F9]'; // stepper-node-terminal-negative (gray, not red!)
            iconText = 'text-[#94A3B8]';
            borderStyle = 'border-2 border-[#94A3B8]';
            titleColor = 'text-[#94A3B8] font-bold';
          }

          return (
            <div key={idx} className="relative group">
              {/* Connector line overlay indicator */}
              {idx < stepsToRender.length - 1 && (
                <div 
                  className={`absolute left-[-33px] top-7 bottom-[-37px] w-0.5 ${
                    step.state === 'success' ? 'bg-[#16A34A]' : 'bg-[#CBD5E1]'
                  }`}
                />
              )}

              {/* Status Circle Node Icon */}
              <div 
                className={`absolute left-[-46px] top-0 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${iconBg} ${iconText} ${borderStyle}`}
              >
                {step.state === 'success' && <Check className="w-4 h-4 stroke-[3]" />}
                {step.state === 'active' && <Play className="w-3.5 h-3.5 fill-current" />}
                {step.state === 'terminal-negative' && <X className="w-4 h-4 stroke-[3]" />}
                {step.state === 'open' && <HelpCircle className="w-4 h-4 opacity-50" />}
              </div>

              {/* Text metadata */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-1">
                <div>
                  <h4 className={`text-sm ${titleColor}`}>{step.label}</h4>
                  <p className="text-xs text-[#475569] mt-0.5">{step.description}</p>
                </div>
                {timestamp && (
                  <span className="text-[10px] font-mono text-[#94A3B8] bg-[#F8FAFC] border border-[#E2E8F0] px-2 py-0.5 rounded mt-1 md:mt-0">
                    {new Date(timestamp).toLocaleDateString()} {new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
