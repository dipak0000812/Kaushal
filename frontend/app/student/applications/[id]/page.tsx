'use client';

import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { Role, ApplicationStatus } from '@/lib/types';
import RoleShell from '@/components/shared/RoleShell';
import StatusStepper from '@/components/shared/StatusStepper';
import Link from 'next/link';
import { ArrowLeft, CheckCircle, XCircle, BellRing } from 'lucide-react';

interface Props {
  params: Promise<{ id: string }>;
}

export default function ApplicationDetailPage({ params }: Props) {
  const resolvedParams = React.use(params);
  const id = resolvedParams.id;
  const queryClient = useQueryClient();

  // Fetch all applications to find this specific one
  const { data: appsRes, isLoading } = useQuery({
    queryKey: ['student-applications'],
    queryFn: () => apiClient.student.getApplications(),
  });

  const app = appsRes?.data?.find(a => a.id === id);

  // Accept Offer Mutation
  const acceptMutation = useMutation({
    mutationFn: () => apiClient.student.acceptOffer(id),
    onSuccess: (res) => {
      if (res.success) {
        queryClient.invalidateQueries({ queryKey: ['student-applications'] });
        queryClient.invalidateQueries({ queryKey: ['internships'] });
        alert('Offer accepted successfully! All other offered applications are auto-withdrawn.');
      } else {
        alert(`Failed to accept offer: ${res.error?.message || 'Unknown error'}`);
      }
    },
  });

  // Decline Offer Mutation
  const declineMutation = useMutation({
    mutationFn: () => apiClient.student.declineOffer(id),
    onSuccess: (res) => {
      if (res.success) {
        queryClient.invalidateQueries({ queryKey: ['student-applications'] });
        alert('Offer declined and application withdrawn.');
      } else {
        alert(`Failed to decline offer: ${res.error?.message || 'Unknown error'}`);
      }
    },
  });

  if (isLoading) {
    return (
      <RoleShell role={Role.STUDENT}>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-sm font-semibold text-[#64748B] animate-pulse">
            Loading application details...
          </div>
        </div>
      </RoleShell>
    );
  }

  if (!app) {
    return (
      <RoleShell role={Role.STUDENT}>
        <div className="space-y-4">
          <Link href="/student/applications" className="inline-flex items-center gap-1.5 text-xs text-[#5B21B6] hover:underline font-semibold">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Applications
          </Link>
          <div className="bg-white border border-[#E2E8F0] rounded-lg p-10 text-center text-xs text-[#64748B]">
            Application not found.
          </div>
        </div>
      </RoleShell>
    );
  }

  const isOffered = app.currentStatus === ApplicationStatus.OFFERED;

  return (
    <RoleShell role={Role.STUDENT}>
      <div className="space-y-6">
        
        {/* Back Link */}
        <div>
          <Link 
            href="/student/applications" 
            className="inline-flex items-center gap-1.5 text-xs text-[#5B21B6] hover:underline font-semibold"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Applications
          </Link>
        </div>

        {/* Title details */}
        <div className="bg-white border border-[#E2E8F0] rounded-lg p-5">
          <span className="text-[10px] text-[#94A3B8] font-bold uppercase tracking-wider">
            Application Detail Row
          </span>
          <h2 className="text-base font-bold text-[#0F172A] mt-1">{app.internshipTitle}</h2>
          <p className="text-xs text-[#64748B] mt-0.5">
            Student: <strong className="text-[#334155]">{app.studentName}</strong>
          </p>
        </div>

        {/* Action Panel for Offered Applications */}
        {isOffered && (
          <div className="bg-[#EDE9FE] border border-[#DDD6FE] rounded-lg p-6 space-y-4">
            <div className="flex gap-3">
              <BellRing className="w-5 h-5 text-[#5B21B6] shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold text-[#5B21B6]">Internship Offer Extended!</h4>
                <p className="text-xs text-[#4C1D95] mt-1 leading-relaxed">
                  Congratulations! You have received an internship offer for this role. Accepting this offer will automatically verify your placement with T&P and automatically decline/withdraw all other pending offers in the system.
                </p>
              </div>
            </div>
            
            <div className="flex gap-3 pt-2 justify-end">
              <button
                onClick={() => acceptMutation.mutate()}
                disabled={acceptMutation.isPending || declineMutation.isPending}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#5B21B6] hover:bg-[#4C1D95] text-white text-xs font-bold rounded-md shadow cursor-pointer transition-colors"
                id="btn-accept-offer"
              >
                <CheckCircle className="w-4 h-4" />
                Accept Internship Offer
              </button>
              <button
                onClick={() => declineMutation.mutate()}
                disabled={acceptMutation.isPending || declineMutation.isPending}
                className="inline-flex items-center gap-2 px-4 py-2 border border-[#DDD6FE] bg-white hover:bg-[#FEE2E2] hover:text-[#B91C1C] hover:border-[#FCA5A5] text-[#4C1D95] text-xs font-bold rounded-md shadow-sm cursor-pointer transition-colors"
                id="btn-decline-offer"
              >
                <XCircle className="w-4 h-4" />
                Decline Offer
              </button>
            </div>
          </div>
        )}

        {/* Stepper Lifecycle */}
        <StatusStepper currentStatus={app.currentStatus} timeline={app.timeline} />

      </div>
    </RoleShell>
  );
}
