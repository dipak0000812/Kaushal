'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { Role } from '@/lib/types';
import RoleShell from '@/components/shared/RoleShell';
import EvidenceCard from '@/components/shared/EvidenceCard';
import RiskBadge from '@/components/shared/RiskBadge';
import Link from 'next/link';
import { ArrowLeft, Info } from 'lucide-react';

interface Props {
  params: Promise<{ id: string }>;
}

export default function HodStudentDetailPage({ params }: Props) {
  const resolvedParams = React.use(params);
  const id = resolvedParams.id; // studentId

  const { data: studentRes, isLoading } = useQuery({
    queryKey: ['hod-student', id],
    queryFn: () => apiClient.hod.getStudentById(id),
  });

  const student = studentRes?.data;

  if (isLoading) {
    return (
      <RoleShell role={Role.HOD}>
        <div className="flex items-center justify-center min-h-[400px]">
          <span className="text-xs text-[#64748B] font-semibold animate-pulse">Loading student details...</span>
        </div>
      </RoleShell>
    );
  }

  if (!student) {
    return (
      <RoleShell role={Role.HOD}>
        <div className="space-y-4">
          <Link href="/hod" className="inline-flex items-center gap-1.5 text-xs text-[#5B21B6] hover:underline font-bold">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
          </Link>
          <div className="bg-white border border-[#E2E8F0] rounded-lg p-10 text-center text-xs text-[#64748B]">
            Student details not found.
          </div>
        </div>
      </RoleShell>
    );
  }

  const hasRisk = student.risk && student.risk !== 'none';
  const dismissal = student.dismissal;

  return (
    <RoleShell role={Role.HOD}>
      <div className="space-y-6">
        
        {/* Back Link */}
        <div>
          <Link 
            href="/hod" 
            className="inline-flex items-center gap-1.5 text-xs text-[#5B21B6] hover:underline font-bold"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
          </Link>
        </div>

        {/* Candidate Overview Header */}
        <div className="bg-white border border-[#E2E8F0] rounded-lg p-6 space-y-4 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-[10px] text-[#94A3B8] font-mono">Student Account: {student.studentId}</span>
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
          <h3 className="text-xs font-bold text-[#475569] uppercase tracking-wider">Weekly Log Registry</h3>
          
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
                  showActions={false} 
                />
              ))}
            </div>
          )}
        </section>

      </div>
    </RoleShell>
  );
}
