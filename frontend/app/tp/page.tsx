'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { Role } from '@/lib/types';
import RoleShell from '@/components/shared/RoleShell';
import WhatsNextPanel from '@/components/shared/WhatsNextPanel';
import Link from 'next/link';
import { 
  CheckSquare, 
  TrendingUp, 
  Building2, 
  Users2, 
  ChevronRight, 
  ShieldCheck 
} from 'lucide-react';

export default function TnpDashboard() {
  // Fetch live Alerts counts for WhatsNextPanel
  const { data: alertsRes, isLoading } = useQuery({
    queryKey: ['tnp-alerts'],
    queryFn: () => apiClient.tnp.getAlerts(),
  });

  const alerts = alertsRes?.data;

  return (
    <RoleShell role={Role.TNP}>
      <div className="space-y-8">
        
        {/* Header Block */}
        <div>
          <h2 className="text-xl font-bold text-[#0F172A]">T&P Administration Console</h2>
          <p className="text-xs text-[#64748B] mt-0.5">
            Manage corporate listings, verify student offers, assign faculty mentors, and review skill-gap analytics.
          </p>
        </div>

        {/* Dynamic Action Alerts */}
        {isLoading ? (
          <div className="bg-white border border-[#E2E8F0] rounded-lg p-6 flex items-center justify-center">
            <span className="text-xs text-[#64748B] font-semibold animate-pulse">Loading alerts...</span>
          </div>
        ) : (
          <WhatsNextPanel role={Role.TNP} alerts={alerts} />
        )}

        {/* Console Sections Grid */}
        <section className="space-y-4">
          <h3 className="text-sm font-bold text-[#475569] uppercase tracking-wider">Console Workspace</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Verification Queue Section */}
            <div className="bg-white border border-[#E2E8F0] rounded-lg p-5 flex flex-col justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-[#5B21B6]">
                  <CheckSquare className="w-5 h-5" />
                  <h4 className="text-sm font-bold text-[#0F172A]">Verification & Assignment</h4>
                </div>
                <p className="text-xs text-[#64748B] leading-relaxed">
                  Monitor accepted offers awaiting verification, approve unverified corporate internship listings, and trigger faculty mentor assignments.
                </p>
              </div>
              <div className="border-t border-[#F1F5F9] pt-3 flex justify-between items-center">
                <span className="text-[10px] font-mono text-[#94A3B8]">
                  Pending verification: {alerts?.pendingVerifications || 0}
                </span>
                <Link
                  href="/tp/verification-queue"
                  className="inline-flex items-center gap-1 text-xs font-bold text-[#5B21B6] hover:underline"
                >
                  Open Queue <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            {/* Analytics Section */}
            <div className="bg-white border border-[#E2E8F0] rounded-lg p-5 flex flex-col justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-[#0284C7]">
                  <TrendingUp className="w-5 h-5" />
                  <h4 className="text-sm font-bold text-[#0F172A]">Placement & Skill Analytics</h4>
                </div>
                <p className="text-xs text-[#64748B] leading-relaxed">
                  Inspect placement funnels, department metrics, corporate success graphs, and evaluate skill-gap reports to address curriculum alignment.
                </p>
              </div>
              <div className="border-t border-[#F1F5F9] pt-3 flex justify-between items-center">
                <span className="text-[10px] font-mono text-[#94A3B8]">
                  At risk cohort: {alerts?.atRiskCount || 0}
                </span>
                <Link
                  href="/tp/analytics"
                  className="inline-flex items-center gap-1 text-xs font-bold text-[#0284C7] hover:underline"
                >
                  View Analytics <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            {/* Companies Section */}
            <div className="bg-white border border-[#E2E8F0] rounded-lg p-5 flex flex-col justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-[#16A34A]">
                  <Building2 className="w-5 h-5" />
                  <h4 className="text-sm font-bold text-[#0F172A]">Company Dashboard</h4>
                </div>
                <p className="text-xs text-[#64748B] leading-relaxed">
                  Invite new company recruiters to register. Verify company profiles to automatically publish and approve their pending internship criteria.
                </p>
              </div>
              <div className="border-t border-[#F1F5F9] pt-3 flex justify-between items-center">
                <span className="text-[10px] font-mono text-[#94A3B8]">
                  Zero eligible postings: {alerts?.zeroEligibleAlerts || 0}
                </span>
                <Link
                  href="/tp/companies"
                  className="inline-flex items-center gap-1 text-xs font-bold text-[#16A34A] hover:underline"
                >
                  Manage Companies <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            {/* Users Section */}
            <div className="bg-white border border-[#E2E8F0] rounded-lg p-5 flex flex-col justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-[#D97706]">
                  <Users2 className="w-5 h-5" />
                  <h4 className="text-sm font-bold text-[#0F172A]">Accounts Oversight</h4>
                </div>
                <p className="text-xs text-[#64748B] leading-relaxed">
                  Provision faculty mentor and Head of Department (HOD) accounts. Track departments and roles authorized within the application.
                </p>
              </div>
              <div className="border-t border-[#F1F5F9] pt-3 flex justify-between items-center">
                <span className="text-[10px] font-mono text-[#94A3B8]">
                  Roles: Faculty & HOD
                </span>
                <Link
                  href="/tp/users"
                  className="inline-flex items-center gap-1 text-xs font-bold text-[#D97706] hover:underline"
                >
                  Manage Accounts <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

          </div>
        </section>

      </div>
    </RoleShell>
  );
}
