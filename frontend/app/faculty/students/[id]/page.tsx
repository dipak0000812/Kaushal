'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { Role } from '@/lib/types';
import RoleShell from '@/components/shared/RoleShell';
import EvidenceCard from '@/components/shared/EvidenceCard';
import RiskBadge from '@/components/shared/RiskBadge';
import Link from 'next/link';
import { ArrowLeft, CheckCircle, Info, ShieldAlert, AlertTriangle, X } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

interface Props {
  params: Promise<{ id: string }>;
}

export default function StudentDetailPage({ params }: Props) {
  const resolvedParams = React.use(params);
  const id = resolvedParams.id; // applicationId
  const queryClient = useQueryClient();
  const [dismissOpen, setDismissOpen] = useState(false);
  const [dismissNote, setDismissNote] = useState('');

  // 1. Fetch assigned students list to locate details for the current student
  const { data: studentsRes, isLoading } = useQuery({
    queryKey: ['faculty-students'],
    queryFn: () => apiClient.faculty.getStudents(),
  });

  const studentList = studentsRes?.data || [];
  const student = studentList.find(s => s.applicationId === id);

  // 2. Log Verification Mutation
  const verifyMutation = useMutation({
    mutationFn: (logId: string) => apiClient.faculty.verifyProgressLog(logId),
    onSuccess: (res) => {
      if (res.success) {
        queryClient.invalidateQueries({ queryKey: ['faculty-students'] });
        queryClient.invalidateQueries({ queryKey: ['student-applications'] });
        toast.success('Weekly progress log verified successfully.');
      } else {
        toast.error(`Failed to verify log: ${res.error?.message}`);
      }
    }
  });

  // 3. Risk Flag Dismissal Mutation
  const dismissMutation = useMutation({
    mutationFn: (note: string) => apiClient.faculty.dismissRiskFlag(id, { note }),
    onSuccess: (res) => {
      if (res.success) {
        queryClient.invalidateQueries({ queryKey: ['faculty-students'] });
        queryClient.invalidateQueries({ queryKey: ['tnp-alerts'] });
        queryClient.invalidateQueries({ queryKey: ['student-applications'] });
        setDismissOpen(false);
        setDismissNote('');
        toast.success('Risk flag dismissed successfully.');
      } else {
        toast.error(`Failed to dismiss risk flag: ${res.error?.message}`);
      }
    }
  });

  const handleVerify = (logId: string) => {
    verifyMutation.mutate(logId);
  };

  const handleDismissSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dismissNote.trim()) return;
    dismissMutation.mutate(dismissNote);
  };

  if (isLoading) {
    return (
      <RoleShell role={Role.FACULTY}>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-sm font-semibold text-[#64748B] animate-pulse">
            Loading student details...
          </div>
        </div>
      </RoleShell>
    );
  }

  if (!student) {
    return (
      <RoleShell role={Role.FACULTY}>
        <div className="space-y-4">
          <Link href="/faculty" className="inline-flex items-center gap-1.5 text-xs text-[#059669] hover:underline font-semibold">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
          </Link>
          <div className="bg-white border border-[#E2E8F0] rounded-lg p-10 text-center text-xs text-[#64748B]">
            Student mentorship details not found or not assigned to you.
          </div>
        </div>
      </RoleShell>
    );
  }

  const hasRisk = student.risk && student.risk !== 'none';
  const dismissal = student.dismissal;

  return (
    <RoleShell role={Role.FACULTY}>
      <Toaster position="top-center" />
      <div className="space-y-6">
        
        {/* Back Link */}
        <div>
          <Link 
            href="/faculty" 
            className="inline-flex items-center gap-1.5 text-xs text-[#059669] hover:underline font-semibold"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
          </Link>
        </div>

        {/* Candidate Overview Header */}
        <div className="bg-white border border-[#E2E8F0] rounded-lg p-6 space-y-4 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-[10px] text-[#94A3B8] font-mono">Application Reference: {student.applicationId}</span>
              <h2 className="text-base font-bold text-[#0F172A] mt-1">{student.studentName}</h2>
              <p className="text-xs text-[#64748B] mt-0.5">{student.internshipTitle}</p>
            </div>
            
            <div className="flex items-center gap-3">
              <span className="text-xs px-2.5 py-1 rounded bg-[#EDE9FE] text-[#5B21B6] border border-[#DDD6FE] font-bold uppercase tracking-wider">
                {student.currentStatus}
              </span>
            </div>
          </div>

          {/* Risk Flag Panel */}
          <div className="border-t border-[#F1F5F9] pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[#475569] uppercase tracking-wider">Risk Assessment:</span>
              {hasRisk ? (
                <div className="flex items-center gap-2">
                  <RiskBadge riskLevel={student.risk} />
                  <span className="text-xs text-[#94A3B8] italic">(Active Risk Flag)</span>
                </div>
              ) : dismissal ? (
                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-[#F0F9FF] border border-[#BAE6FD] text-xs text-[#0284C7]">
                  <Info className="w-3.5 h-3.5 shrink-0" />
                  Risk Dismissed
                </span>
              ) : (
                <span className="text-xs text-[#16A34A] font-semibold">Clear</span>
              )}
            </div>

            {hasRisk && (
              <button
                onClick={() => setDismissOpen(true)}
                className="px-3 py-1.5 bg-[#059669] hover:bg-[#047857] text-white text-xs font-bold rounded shadow-sm inline-flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                Dismiss Risk Flag
              </button>
            )}
          </div>

          {/* Dismissal Audit History Banner */}
          {!hasRisk && dismissal && (
            <div className="bg-[#F0F9FF] border border-[#BAE6FD] rounded-md p-4 flex gap-3 text-xs text-[#0284C7]">
              <Info className="w-5 h-5 shrink-0 mt-0.5 text-[#0284C7]" />
              <div>
                <h4 className="font-bold">Risk Flag Suppressed (Audit Trail Active)</h4>
                <p className="mt-1 leading-relaxed">
                  Flag was manually bypassed by <strong>{dismissal.dismissedBy}</strong> on {new Date(dismissal.dismissedAt).toLocaleDateString()} {new Date(dismissal.dismissedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.
                </p>
                {dismissal.note && (
                  <p className="mt-2 text-[#0369A1] bg-white border border-[#E0F2FE] rounded p-2 italic">
                    &ldquo;{dismissal.note}&rdquo;
                  </p>
                )}
                <p className="mt-2 text-[10px] text-[#94A3B8] leading-normal italic">
                  Note: This suppression will automatically expire once the student uploads a new progress log.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Weekly Logs List */}
        <section className="space-y-4">
          <h3 className="text-xs font-bold text-[#475569] uppercase tracking-wider">Weekly Log Auditing</h3>
          
          {student.logs.length === 0 ? (
            <div className="bg-white border border-[#E2E8F0] p-10 text-center rounded-lg text-xs text-[#64748B]">
              No weekly progress logs have been submitted by this candidate yet.
            </div>
          ) : (
            <div className="space-y-4">
              {student.logs.map((log: any) => (
                <EvidenceCard 
                  key={log.id} 
                  log={log} 
                  showActions={true} 
                  onVerify={handleVerify} 
                />
              ))}
            </div>
          )}
        </section>

      </div>

      {/* Dismissal Note Modal */}
      {dismissOpen && (
        <div className="fixed inset-0 bg-[#0F172A]/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#E2E8F0] rounded-lg shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[#D97706]" />
              Dismiss Risk Flag
            </h3>
            
            <form onSubmit={handleDismissSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#475569] uppercase tracking-wider mb-2">
                  Override Justification Note
                </label>
                <textarea
                  required
                  value={dismissNote}
                  onChange={(e) => setDismissNote(e.target.value)}
                  placeholder="Provide an audit note justifying this override (e.g. verified log upload delay due to exam, temporary offline submission)..."
                  className="w-full text-xs p-3 border border-[#E2E8F0] bg-[#F8FAFC] rounded-md focus:outline-none focus:border-[#5B21B6] focus:bg-white min-h-[100px]"
                />
              </div>

              <div className="flex justify-end gap-2 border-t border-[#F1F5F9] pt-3">
                <button
                  type="button"
                  onClick={() => { setDismissOpen(false); setDismissNote(''); }}
                  className="px-3 py-1.5 border border-[#E2E8F0] bg-white hover:bg-[#F8FAFC] text-xs font-bold rounded cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={dismissMutation.isPending}
                  className="px-3 py-1.5 bg-[#059669] text-white hover:bg-[#047857] text-xs font-bold rounded shadow cursor-pointer transition-colors"
                >
                  Confirm Dismissal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </RoleShell>
  );
}
