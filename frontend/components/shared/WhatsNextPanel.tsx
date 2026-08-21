'use client';

import React from 'react';
import { Role } from '@/lib/types';
import { 
  ArrowRight, 
  BellRing, 
  CheckSquare, 
  AlertTriangle, 
  ShieldCheck, 
  Sparkles,
  Award
} from 'lucide-react';
import Link from 'next/link';

interface AlertsData {
  pendingVerifications: number;
  atRiskCount: number;
  zeroEligibleAlerts: number;
  unassignedMentorAlerts: number;
}

interface WhatsNextPanelProps {
  role: Role;
  alerts?: AlertsData;
  studentStatus?: string;
}

export default function WhatsNextPanel({ role, alerts, studentStatus }: WhatsNextPanelProps) {
  // Render Student Variant
  const renderStudentView = () => {
    if (studentStatus === 'offered') {
      return (
        <div className="bg-[#EDE9FE] border border-[#DDD6FE] rounded-lg p-5 shadow-sm">
          <div className="flex gap-3">
            <BellRing className="w-5 h-5 text-[#5B21B6] shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold text-[#5B21B6]">Offer Received!</h4>
              <p className="text-xs text-[#4C1D95] mt-1">
                You have an active internship offer. You must accept or decline this offer to proceed. Accepting this will auto-withdraw other pending offers.
              </p>
              <Link
                href="/student/applications"
                className="inline-flex items-center gap-1.5 mt-3 text-xs font-bold text-[#5B21B6] hover:underline"
              >
                Go to Applications <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      );
    }

    if (studentStatus === 'inProgress') {
      return (
        <div className="bg-[#DCFCE7] border border-[#BBF7D0] rounded-lg p-5 shadow-sm">
          <div className="flex gap-3">
            <CheckSquare className="w-5 h-5 text-[#16A34A] shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold text-[#16A34A]">Weekly Submission Due</h4>
              <p className="text-xs text-[#14532D] mt-1">
                Your internship is active. Don't forget to upload your weekly progress log and attach evidence for your faculty mentor to verify.
              </p>
              <Link
                href="/student/progress"
                className="inline-flex items-center gap-1.5 mt-3 text-xs font-bold text-[#16A34A] hover:underline"
              >
                Submit Log <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      );
    }

    // Default student view
    return (
      <div className="bg-[#EDE9FE] border border-[#DDD6FE] rounded-lg p-5 shadow-sm">
        <div className="flex gap-3">
          <Sparkles className="w-5 h-5 text-[#5B21B6] shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-bold text-[#5B21B6]">What's Next?</h4>
            <p className="text-xs text-[#4C1D95] mt-1">
              You're eligible for 2 internships. Best match: Frontend Intern
            </p>
            <Link
              href="/student"
              className="inline-flex items-center gap-1.5 mt-3 text-xs font-bold text-[#5B21B6] hover:underline"
            >
              Explore Internships <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    );
  };

  // Render T&P Variant (Reads live alerts)
  const renderTnpView = () => {
    const activeAlerts = alerts || {
      pendingVerifications: 0,
      atRiskCount: 0,
      zeroEligibleAlerts: 0,
      unassignedMentorAlerts: 0
    };

    return (
      <div className="space-y-4">
        <div className="bg-[#F0F9FF] border border-[#BAE6FD] rounded-lg p-4 text-xs text-[#0369A1] font-semibold flex items-center gap-2">
          <BellRing className="w-4 h-4 text-[#0284C7] shrink-0" />
          <span>17 offers need verification. 3 students at risk.</span>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-lg p-5 shadow-sm">
          <h4 className="text-sm font-bold text-[#0F172A] mb-3 flex items-center gap-2">
            <BellRing className="w-4 h-4 text-[#EA580C]" />
            T&P Action Alerts
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link href="/tp/verification-queue" className="p-3 bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#E2E8F0] rounded-md transition-colors block">
              <div className="flex justify-between items-start">
                <span className="text-[11px] font-bold text-[#64748B] uppercase">Offer Verifications</span>
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-[#EDE9FE] text-[#5B21B6]">{activeAlerts.pendingVerifications}</span>
              </div>
              <p className="text-xs text-[#475569] mt-2">Offers awaiting verification</p>
            </Link>

            <Link href="/tp/analytics" className="p-3 bg-[#FFF5F5] hover:bg-[#FFEAEB] border border-[#FEE2E2] rounded-md transition-colors block">
              <div className="flex justify-between items-start">
                <span className="text-[11px] font-bold text-[#B91C1C] uppercase">Students At Risk</span>
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-[#FEE2E2] text-[#B91C1C]">{activeAlerts.atRiskCount}</span>
              </div>
              <p className="text-xs text-[#475569] mt-2">Unsubmitted logs &gt; 7 days</p>
            </Link>

            <Link href="/tp/verification-queue" className="p-3 bg-[#FEF3C7] hover:bg-[#FDF2C2] border border-[#FDE68A] rounded-md transition-colors block">
              <div className="flex justify-between items-start">
                <span className="text-[11px] font-bold text-[#B45309] uppercase">Zero Eligible</span>
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-[#FEF3C7] text-[#B45309]">{activeAlerts.zeroEligibleAlerts}</span>
              </div>
              <p className="text-xs text-[#475569] mt-2">Postings with no eligible applicants</p>
            </Link>

            <Link href="/tp/verification-queue" className="p-3 bg-[#F0F9FF] hover:bg-[#E0F2FE] border border-[#BAE6FD] rounded-md transition-colors block">
              <div className="flex justify-between items-start">
                <span className="text-[11px] font-bold text-[#0284C7] uppercase">Unassigned Mentors</span>
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-[#E0F2FE] text-[#0284C7]">{activeAlerts.unassignedMentorAlerts}</span>
              </div>
              <p className="text-xs text-[#475569] mt-2">Verified offers needing mentor</p>
            </Link>
          </div>
        </div>
      </div>
    );
  };

  // Render Faculty Variant
  const renderFacultyView = () => {
    return (
      <div className="bg-[#FEF3C7] border border-[#FDE68A] rounded-lg p-5 shadow-sm">
        <div className="flex gap-3">
          <AlertTriangle className="w-5 h-5 text-[#B45309] shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-bold text-[#B45309]">Pending Log Review</h4>
            <p className="text-xs text-[#78350F] mt-1">
              2 students need attention. 1 log pending verification.
            </p>
            <Link
              href="/faculty"
              className="inline-flex items-center gap-1.5 mt-3 text-xs font-bold text-[#B45309] hover:underline"
            >
              Go to Mentor Console <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    );
  };

  // Render Company Variant
  const renderCompanyView = () => {
    return (
      <div className="bg-[#F0F9FF] border border-[#BAE6FD] rounded-lg p-5 shadow-sm">
        <div className="flex gap-3">
          <Sparkles className="w-5 h-5 text-[#0284C7] shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-bold text-[#0284C7]">Recommended Action</h4>
            <p className="text-xs text-[#0369A1] mt-1">
              23 eligible applicants waiting for review.
            </p>
            <Link
              href="/company"
              className="inline-flex items-center gap-1.5 mt-3 text-xs font-bold text-[#0284C7] hover:underline"
            >
              Go to Postings <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    );
  };

  // Render HOD Variant
  const renderHodView = () => {
    return (
      <div className="bg-[#EDE9FE] border border-[#DDD6FE] rounded-lg p-5 shadow-sm">
        <div className="flex gap-3">
          <ShieldCheck className="w-5 h-5 text-[#5B21B6] shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-bold text-[#5B21B6]">Department Oversight</h4>
            <p className="text-xs text-[#4C1D95] mt-1">
              SQL is your department's most common skill gap.
            </p>
            <Link
              href="/hod"
              className="inline-flex items-center gap-1.5 mt-3 text-xs font-bold text-[#5B21B6] hover:underline"
            >
              Explore Skill Gaps <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    );
  };

  switch (role) {
    case Role.STUDENT: return renderStudentView();
    case Role.TNP: return renderTnpView();
    case Role.FACULTY: return renderFacultyView();
    case Role.COMPANY: return renderCompanyView();
    case Role.HOD: return renderHodView();
    default: return null;
  }
}
