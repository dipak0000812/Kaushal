'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { Role } from '@/lib/types';
import RoleShell from '@/components/shared/RoleShell';
import EvidenceCard from '@/components/shared/EvidenceCard';
import { FileUp, Info } from 'lucide-react';
import toast from 'react-hot-toast';

export default function StudentDocumentsPage() {
  // 1. Fetch applications
  const { data: appsRes, isLoading: isAppsLoading } = useQuery({
    queryKey: ['student-applications'],
    queryFn: () => apiClient.student.getApplications(),
  });

  const studentApps = appsRes?.data || [];
  const studentLogs: any[] = [];

  const handleUploadClick = () => {
    toast.error('Document Upload Gated: Upload action is disabled pending backend decision regarding secure file storage policies.');
  };

  return (
    <RoleShell role={Role.STUDENT}>
      <div className="space-y-6">
        
        {/* Header with Upload Stub */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-xl font-bold text-[#0F172A]">My Internship Documents</h2>
            <p className="text-xs text-[#64748B] mt-0.5">
              Access your submitted weekly progress logs and attached evidence files.
            </p>
          </div>
          <div>
            <div className="flex flex-col items-end">
              <button
                onClick={handleUploadClick}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#F1F5F9] border border-[#CBD5E1] text-[#94A3B8] text-xs font-bold rounded-md cursor-pointer transition-colors hover:bg-[#FFEAEB] hover:border-[#FCA5A5] hover:text-[#B91C1C]"
              >
                <FileUp className="w-4 h-4 shrink-0" />
                Upload Document
              </button>
              <span className="text-[10px] text-[#DC2626] font-bold mt-1.5 uppercase tracking-wide bg-[#FEE2E2] px-2 py-0.5 rounded border border-[#FECACA] animate-pulse">
                Pending backend decision
              </span>
            </div>
          </div>
        </div>

        {/* Info banner */}
        <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-5 flex gap-3">
          <Info className="w-5 h-5 text-[#64748B] shrink-0 mt-0.5" />
          <div className="text-xs text-[#475569] space-y-1">
            <h4 className="font-bold text-[#334155]">Verification Documents List</h4>
            <p className="leading-relaxed">
              Every weekly progress log submission containing valid evidence is mapped below as a verification document. Your assigned faculty mentor will inspect these files to verify your attendance and milestone completions.
            </p>
          </div>
        </div>

        {/* Evidence List */}
        {isAppsLoading ? (
          <div className="flex items-center justify-center min-h-[250px]">
            <div className="text-sm font-semibold text-[#64748B] animate-pulse">
              Loading documents...
            </div>
          </div>
        ) : studentLogs.length === 0 ? (
          <div className="bg-white border border-[#E2E8F0] rounded-lg p-12 text-center text-xs text-[#64748B]">
            No documents or weekly evidence logs submitted yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {studentLogs.map((log) => {
              const app = studentApps.find(a => a.id === log.applicationId);
              return (
                <div key={log.id} className="space-y-1.5">
                  <span className="text-[10px] font-bold text-[#94A3B8] uppercase block tracking-wider pl-1">
                    {app?.internshipTitle || 'Internship Log'}
                  </span>
                  <EvidenceCard log={log} />
                </div>
              );
            })}
          </div>
        )}

      </div>
    </RoleShell>
  );
}
