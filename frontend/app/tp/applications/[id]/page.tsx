'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { Role, ApplicationStatus } from '@/lib/types';
import RoleShell from '@/components/shared/RoleShell';
import StatusStepper from '@/components/shared/StatusStepper';
import Link from 'next/link';
import { ArrowLeft, Trash2, ShieldAlert, X } from 'lucide-react';

interface Props {
  params: Promise<{ id: string }>;
}

export default function TnpApplicationDetailPage({ params }: Props) {
  const resolvedParams = React.use(params);
  const id = resolvedParams.id;
  const queryClient = useQueryClient();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  // 1. Fetch Applications list to find this specific application
  const { data: appsRes, isLoading } = useQuery({
    queryKey: ['student-applications'],
    queryFn: () => apiClient.student.getApplications(),
  });

  const app = appsRes?.data?.find(a => a.id === id);

  // 2. Cancellation Mutation
  const cancelMutation = useMutation({
    mutationFn: (reason: string) => apiClient.tnp.cancelApplication(id, { reason }),
    onSuccess: (res) => {
      if (res.success) {
        queryClient.invalidateQueries({ queryKey: ['student-applications'] });
        queryClient.invalidateQueries({ queryKey: ['tnp-alerts'] });
        setCancelOpen(false);
        setCancelReason('');
        alert('Application cancelled successfully.');
      } else {
        alert(`Failed to cancel application: ${res.error?.message}`);
      }
    }
  });

  if (isLoading) {
    return (
      <RoleShell role={Role.TNP}>
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
      <RoleShell role={Role.TNP}>
        <div className="space-y-4">
          <Link href="/tp" className="inline-flex items-center gap-1.5 text-xs text-[#5B21B6] hover:underline font-semibold">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
          </Link>
          <div className="bg-white border border-[#E2E8F0] rounded-lg p-10 text-center text-xs text-[#64748B]">
            Application not found.
          </div>
        </div>
      </RoleShell>
    );
  }

  const isTerminal = [
    ApplicationStatus.REJECTED,
    ApplicationStatus.WITHDRAWN,
    ApplicationStatus.CANCELLED,
    ApplicationStatus.COMPLETED
  ].includes(app.currentStatus);

  const handleCancelSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelReason.trim()) return;
    cancelMutation.mutate(cancelReason);
  };

  return (
    <RoleShell role={Role.TNP}>
      <div className="space-y-6">
        
        {/* Back Link */}
        <div>
          <Link 
            href="/tp" 
            className="inline-flex items-center gap-1.5 text-xs text-[#5B21B6] hover:underline font-semibold"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
          </Link>
        </div>

        {/* Overview Header Card */}
        <div className="bg-white border border-[#E2E8F0] rounded-lg p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="text-[10px] text-[#94A3B8] font-mono">Application: {app.id}</span>
            <h2 className="text-base font-bold text-[#0F172A] mt-1">{app.internshipTitle}</h2>
            <p className="text-xs text-[#64748B] mt-0.5">
              Candidate: <strong className="text-[#334155]">{app.studentName}</strong>
            </p>
          </div>
          
          <div>
            {!isTerminal ? (
              <button
                onClick={() => setCancelOpen(true)}
                className="px-3 py-2 border border-[#FCA5A5] text-[#DC2626] bg-white hover:bg-[#FEE2E2] hover:border-[#EF4444] text-xs font-bold rounded shadow-sm inline-flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Cancel Application
              </button>
            ) : (
              <span className="text-xs text-[#94A3B8] font-semibold italic">
                &bull; Application in terminal state ({app.currentStatus})
              </span>
            )}
          </div>
        </div>

        {/* Stepper Lifecycle */}
        <StatusStepper currentStatus={app.currentStatus} timeline={app.timeline} />

      </div>

      {/* Cancellation Reason Modal */}
      {cancelOpen && (
        <div className="fixed inset-0 bg-[#0F172A]/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#E2E8F0] rounded-lg shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-[#DC2626]" />
              Administrative Cancellation
            </h3>
            
            <form onSubmit={handleCancelSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#475569] uppercase tracking-wider mb-2">
                  Reason for Cancellation
                </label>
                <textarea
                  required
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Explain the reason for this administrative cancellation..."
                  className="w-full text-xs p-3 border border-[#E2E8F0] bg-[#F8FAFC] rounded-md focus:outline-none focus:border-[#5B21B6] focus:bg-white min-h-[100px]"
                />
              </div>

              <div className="flex justify-end gap-2 border-t border-[#F1F5F9] pt-3">
                <button
                  type="button"
                  onClick={() => { setCancelOpen(false); setCancelReason(''); }}
                  className="px-3 py-1.5 border border-[#E2E8F0] bg-white hover:bg-[#F8FAFC] text-xs font-bold rounded cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={cancelMutation.isPending}
                  className="px-3 py-1.5 bg-[#DC2626] text-white hover:bg-[#B91C1C] text-xs font-bold rounded shadow cursor-pointer transition-colors"
                >
                  Confirm Cancellation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </RoleShell>
  );
}
