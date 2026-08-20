'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { Role, ApplicationStatus } from '@/lib/types';
import RoleShell from '@/components/shared/RoleShell';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { FileText, ChevronRight, Calendar, Info } from 'lucide-react';

interface PageProps {
  searchParams: Promise<{ status?: string }>;
}

export default function ApplicationsPage({ searchParams }: PageProps) {
  const resolvedSearchParams = React.use(searchParams);
  const statusFilter = resolvedSearchParams.status;

  // Fetch applications based on status filter
  const { data: appsRes, isLoading } = useQuery({
    queryKey: ['student-applications', statusFilter],
    queryFn: () => apiClient.student.getApplications(statusFilter as ApplicationStatus),
  });

  const applications = appsRes?.data || [];

  const tabs = [
    { label: 'All', value: '' },
    { label: 'Applied', value: ApplicationStatus.APPLIED },
    { label: 'Shortlisted', value: ApplicationStatus.SHORTLISTED },
    { label: 'Offered', value: ApplicationStatus.OFFERED },
    { label: 'Accepted', value: ApplicationStatus.ACCEPTED },
    { label: 'In Progress', value: ApplicationStatus.IN_PROGRESS },
    { label: 'Completed', value: ApplicationStatus.COMPLETED },
    { label: 'Withdrawn/Declined', value: ApplicationStatus.WITHDRAWN },
  ];

  const getStatusBadgeStyle = (status: ApplicationStatus) => {
    switch (status) {
      case ApplicationStatus.COMPLETED:
        return 'bg-[#DCFCE7] text-[#16A34A] border-[#BBF7D0]';
      case ApplicationStatus.OFFERED:
      case ApplicationStatus.ACCEPTED:
      case ApplicationStatus.MENTOR_ASSIGNED:
      case ApplicationStatus.IN_PROGRESS:
        return 'bg-[#EDE9FE] text-[#5B21B6] border-[#DDD6FE]';
      case ApplicationStatus.REJECTED:
      case ApplicationStatus.WITHDRAWN:
      case ApplicationStatus.CANCELLED:
        return 'bg-[#F1F5F9] text-[#94A3B8] border-[#E2E8F0]';
      default:
        return 'bg-[#F1F5F9] text-[#64748B] border-[#E2E8F0]';
    }
  };

  return (
    <RoleShell role={Role.STUDENT}>
      <div className="space-y-6">
        
        {/* Header */}
        <div>
          <h2 className="text-xl font-bold text-[#0F172A]">My Internship Applications</h2>
          <p className="text-xs text-[#64748B] mt-0.5">
            Track status updates, respond to offers, and upload progress logs.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-[#E2E8F0] overflow-x-auto flex gap-2 pb-px scrollbar-none">
          {tabs.map((tab) => {
            const isActive = (!statusFilter && !tab.value) || statusFilter === tab.value;
            const queryParam = tab.value ? `?status=${tab.value}` : '';
            return (
              <Link
                key={tab.value}
                href={`/student/applications${queryParam}`}
                className={`text-xs px-3 py-2 border-b-2 font-medium whitespace-nowrap transition-all ${
                  isActive
                    ? 'border-[#5B21B6] text-[#5B21B6]'
                    : 'border-transparent text-[#64748B] hover:text-[#0F172A] hover:border-[#CBD5E1]'
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>

        {/* Loading / List Content */}
        {isLoading ? (
          <div className="flex items-center justify-center min-h-[250px]">
            <div className="text-sm font-semibold text-[#64748B] animate-pulse">
              Loading applications...
            </div>
          </div>
        ) : applications.length === 0 ? (
          <div className="bg-white border border-[#E2E8F0] rounded-lg p-12 text-center space-y-2">
            <Info className="w-8 h-8 text-[#94A3B8] mx-auto" />
            <p className="text-xs text-[#64748B] font-semibold">No applications found matching this status.</p>
            <p className="text-[11px] text-[#94A3B8]">
              Browse the dashboard to find open roles and submit new applications.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {applications.map((app) => {
              const appliedEvent = app.timeline.find(t => t.toStatus === ApplicationStatus.APPLIED);
              const appliedDate = appliedEvent ? new Date(appliedEvent.at).toLocaleDateString() : 'N/A';

              return (
                <div 
                  key={app.id} 
                  className="bg-white border border-[#E2E8F0] rounded-lg p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm hover:shadow-md transition-all"
                >
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] text-[#94A3B8] font-mono">ID: {app.id}</span>
                      <span className={`inline-flex px-2 py-0.5 text-[10px] font-bold rounded-full border ${getStatusBadgeStyle(app.currentStatus)}`}>
                        {app.currentStatus}
                      </span>
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-[#0F172A]">{app.internshipTitle}</h4>
                      <div className="flex items-center gap-1.5 text-[11px] text-[#64748B] mt-1">
                        <Calendar className="w-3.5 h-3.5 text-[#94A3B8] shrink-0" />
                        <span>Submitted on {appliedDate}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end">
                    <Link
                      href={`/student/applications/${app.id}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[#E2E8F0] hover:bg-[#F8FAFC] text-[#5B21B6] text-xs font-bold rounded-md transition-colors"
                    >
                      View Details & Stepper
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>
    </RoleShell>
  );
}
