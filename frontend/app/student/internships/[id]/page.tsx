'use client';

import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { Role, ApplicationStatus } from '@/lib/types';
import RoleShell from '@/components/shared/RoleShell';
import EligibilityBreakdown from '@/components/shared/EligibilityBreakdown';
import Link from 'next/link';
import { ArrowLeft, Users, Calendar, Award, CheckCircle, ShieldAlert } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
  params: Promise<{ id: string }>;
}

export default function InternshipDetailPage({ params }: Props) {
  const resolvedParams = React.use(params);
  const id = resolvedParams.id;
  const queryClient = useQueryClient();

  // 1. Fetch Internship Details
  const { data: internshipRes, isLoading: isInternshipLoading } = useQuery({
    queryKey: ['internship', id],
    queryFn: () => apiClient.student.getInternshipById(id),
  });

  // 2. Fetch Applications to see if already applied
  const { data: applicationsRes, isLoading: isApplicationsLoading } = useQuery({
    queryKey: ['student-applications'],
    queryFn: () => apiClient.student.getApplications(),
  });

  // 3. Mutation for applying
  const applyMutation = useMutation({
    mutationFn: () => apiClient.student.applyToInternship({ internshipId: id }),
    onSuccess: (res) => {
      if (res.success) {
        queryClient.invalidateQueries({ queryKey: ['student-applications'] });
        queryClient.invalidateQueries({ queryKey: ['internships'] });
        toast.success('Application submitted successfully!');
      } else {
        toast.error(`Failed to apply: ${res.error?.message || 'Unknown error'}`);
      }
    },
  });

  const isLoading = isInternshipLoading || isApplicationsLoading;

  if (isLoading) {
    return (
      <RoleShell role={Role.STUDENT}>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-sm font-semibold text-[#64748B] animate-pulse">
            Loading internship details...
          </div>
        </div>
      </RoleShell>
    );
  }

  const resData: any = internshipRes?.data;
  const internship: any = resData?.internship || resData;
  const applications = applicationsRes?.data || [];

  if (!internship) {
    return (
      <RoleShell role={Role.STUDENT}>
        <div className="space-y-4">
          <Link href="/student" className="inline-flex items-center gap-1.5 text-xs text-[#5B21B6] hover:underline font-semibold">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
          </Link>
          <div className="bg-white border border-[#E2E8F0] rounded-lg p-10 text-center text-xs text-[#64748B]">
            Internship not found or closed.
          </div>
        </div>
      </RoleShell>
    );
  }

  const eligibility = resData?.eligibility || internship.eligibilitySnapshot;
  const isEligible = eligibility?.eligible;
  const hasApplied = applications.some((a: any) => (a.internshipId?._id || a.internshipId?.id || a.internshipId) === id);

  const handleApply = () => {
    if (hasApplied || !isEligible) return;
    applyMutation.mutate();
  };

  return (
    <RoleShell role={Role.STUDENT}>
      <div className="space-y-6">
        
        {/* Back Link */}
        <div>
          <Link 
            href="/student" 
            className="inline-flex items-center gap-1.5 text-xs text-[#5B21B6] hover:underline font-semibold"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
          </Link>
        </div>

        {/* Details Card */}
        <div className="bg-white border border-[#E2E8F0] rounded-lg p-6 space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-[#F1F5F9]">
            <div>
              <span className="text-[10px] text-[#94A3B8] font-bold uppercase tracking-wider">
                Posting ID: {internship.id}
              </span>
              <h2 className="text-lg font-bold text-[#0F172A] mt-0.5">
                Frontend Developer Internship
              </h2>
              <p className="text-xs text-[#475569] mt-0.5">
                Company: <strong className="text-[#0F172A]">{internship.companyName}</strong>
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              {hasApplied ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#DCFCE7] text-[#16A34A] text-xs font-bold rounded border border-[#BBF7D0]">
                  <CheckCircle className="w-3.5 h-3.5" />
                  APPLIED
                </span>
              ) : isEligible ? (
                <button
                  onClick={handleApply}
                  disabled={applyMutation.isPending}
                  className="px-4 py-2 bg-[#5B21B6] hover:bg-[#4C1D95] disabled:bg-[#C084FC] text-white text-xs font-bold rounded-md shadow transition-colors cursor-pointer"
                >
                  {applyMutation.isPending ? 'Submitting...' : 'Apply Now'}
                </button>
              ) : (
                <div className="flex flex-col items-end">
                  <button
                    disabled
                    className="px-4 py-2 bg-[#E2E8F0] text-[#94A3B8] text-xs font-bold rounded-md border border-[#CBD5E1] cursor-not-allowed inline-flex items-center gap-1.5"
                  >
                    <ShieldAlert className="w-3.5 h-3.5" />
                    Ineligible to Apply
                  </button>
                  <span className="text-[10px] text-[#DC2626] font-semibold mt-1">
                    Failed criteria checks
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-md">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] block">Vacancies</span>
              <div className="flex items-center gap-2 mt-1">
                <Users className="w-4 h-4 text-[#5B21B6]" />
                <span className="text-sm font-bold text-[#334155]">{internship.vacancies} open roles</span>
              </div>
            </div>
            
            <div className="p-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-md">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] block">CGPA Requirement</span>
              <div className="flex items-center gap-2 mt-1">
                <Award className="w-4 h-4 text-[#5B21B6]" />
                <span className="text-sm font-bold text-[#334155]">Minimum {internship.criteria.minCgpa} CGPA</span>
              </div>
            </div>

            <div className="p-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-md">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] block">Application Deadline</span>
              <div className="flex items-center gap-2 mt-1">
                <Calendar className="w-4 h-4 text-[#5B21B6]" />
                <span className="text-sm font-bold text-[#334155]">{internship.lastDate}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Detailed Eligibility Checklist */}
        {eligibility && (
          <section className="space-y-3">
            <h3 className="text-sm font-bold text-[#475569] uppercase tracking-wider">Verification Snapshot</h3>
            <EligibilityBreakdown eligibility={eligibility} />
          </section>
        )}

      </div>
    </RoleShell>
  );
}
