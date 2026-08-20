'use client';

import React from 'react';
import { useQuery, useMutation, useQueries, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { Role, ApplicationStatus } from '@/lib/types';
import RoleShell from '@/components/shared/RoleShell';
import Link from 'next/link';
import { Building2, Plus, ArrowUpRight, CheckCircle, Clock, AlertCircle, XCircle } from 'lucide-react';

export default function CompanyDashboard() {
  const queryClient = useQueryClient();

  // 1. Fetch company postings
  const { data: internshipsRes, isLoading: isInternshipsLoading } = useQuery({
    queryKey: ['company-internships'],
    queryFn: () => apiClient.company.getInternships(),
  });

  const internships = internshipsRes?.data || [];

  // 2. Fetch applicants for all postings in parallel using useQueries
  const applicantsQueries = useQueries({
    queries: internships.map(i => ({
      queryKey: ['company-applicants', i.id],
      queryFn: () => apiClient.company.getApplicants(i.id!),
      enabled: !!i.id,
    }))
  });

  const isApplicantsLoading = applicantsQueries.some(q => q.isLoading);
  const isLoading = isInternshipsLoading || isApplicantsLoading;

  // 3. Aggregate metrics
  const totalPostings = internships.length;
  const activePostings = internships.filter(i => i.status === 'open').length;

  const totalApplicants = applicantsQueries.reduce((acc, q) => {
    const list = q.data?.data || [];
    return acc + list.length;
  }, 0);

  const placedStates = [
    ApplicationStatus.ACCEPTED,
    ApplicationStatus.MENTOR_PENDING,
    ApplicationStatus.MENTOR_ASSIGNED,
    ApplicationStatus.IN_PROGRESS,
    ApplicationStatus.COMPLETED
  ];
  
  const totalPlaced = applicantsQueries.reduce((acc, q) => {
    const list = q.data?.data || [];
    return acc + list.filter(a => placedStates.includes(a.currentStatus)).length;
  }, 0);

  // 4. Mutations
  const closeMutation = useMutation({
    mutationFn: (id: string) => apiClient.company.closeInternship(id),
    onSuccess: (res) => {
      if (res.success) {
        queryClient.invalidateQueries({ queryKey: ['company-internships'] });
        alert('Internship posting closed successfully.');
      } else {
        alert(`Failed to close posting: ${res.error?.message}`);
      }
    }
  });

  const handleClose = (id: string) => {
    if (confirm('Are you sure you want to close this internship posting? This will stop accepting new applications.')) {
      closeMutation.mutate(id);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#DCFCE7] text-[#16A34A] border border-[#BBF7D0]">
            <CheckCircle className="w-3 h-3" /> Published
          </span>
        );
      case 'pendingApproval':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#FEF3C7] text-[#D97706] border border-[#FDE68A]">
            <Clock className="w-3 h-3" /> Pending Approval
          </span>
        );
      case 'closed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#F1F5F9] text-[#475569] border border-[#E2E8F0]">
            <XCircle className="w-3 h-3" /> Closed
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <RoleShell role={Role.COMPANY}>
      <div className="space-y-8">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-[#0F172A] flex items-center gap-2">
              <Building2 className="w-5 h-5 text-[#EA580C]" />
              Recruiter Dashboard
            </h2>
            <p className="text-xs text-[#64748B] mt-0.5">
              Manage corporate postings, track candidates, and evaluate student internship logs.
            </p>
          </div>

          <Link
            href="/company/postings/new"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-bold rounded-lg shadow-sm transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Create Posting
          </Link>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center min-h-[300px]">
            <span className="text-xs text-[#64748B] font-semibold animate-pulse">Loading recruiter console...</span>
          </div>
        ) : (
          <div className="space-y-8">
            
            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              
              <div className="bg-white border border-[#E2E8F0] p-5 rounded-lg shadow-sm">
                <span className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider block">Total Postings</span>
                <div className="flex items-baseline gap-2 mt-2">
                  <span className="text-2xl font-bold text-[#0F172A]">{totalPostings}</span>
                  <span className="text-xs text-[#94A3B8]">job(s)</span>
                </div>
              </div>

              <div className="bg-white border border-[#E2E8F0] p-5 rounded-lg shadow-sm">
                <span className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider block">Active / Open</span>
                <div className="flex items-baseline gap-2 mt-2">
                  <span className="text-2xl font-bold text-[#16A34A]">{activePostings}</span>
                  <span className="text-xs text-[#94A3B8]">published</span>
                </div>
              </div>

              <div className="bg-white border border-[#E2E8F0] p-5 rounded-lg shadow-sm">
                <span className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider block">Total Applicants</span>
                <div className="flex items-baseline gap-2 mt-2">
                  <span className="text-2xl font-bold text-[#5B21B6]">{totalApplicants}</span>
                  <span className="text-xs text-[#94A3B8]">students</span>
                </div>
              </div>

              <div className="bg-white border border-[#E2E8F0] p-5 rounded-lg shadow-sm">
                <span className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider block">Selected / Placed</span>
                <div className="flex items-baseline gap-2 mt-2">
                  <span className="text-2xl font-bold text-[#0284C7]">{totalPlaced}</span>
                  <span className="text-xs text-[#94A3B8]">mentees</span>
                </div>
              </div>

            </div>

            {/* Postings Registry */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-[#475569] uppercase tracking-wider">Internship Listings</h3>

              {internships.length === 0 ? (
                <div className="bg-white border border-[#E2E8F0] p-10 text-center rounded-lg text-xs text-[#64748B]">
                  No internship roles have been created yet. Click "Create Posting" to set up your first opening.
                </div>
              ) : (
                <div className="bg-white border border-[#E2E8F0] rounded-lg overflow-hidden shadow-sm">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[10px] font-bold text-[#475569] uppercase tracking-wider">
                        <th className="p-4">Criteria & Title</th>
                        <th className="p-4">Vacancies</th>
                        <th className="p-4">Status</th>
                        <th className="p-4">Applicants</th>
                        <th className="p-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F1F5F9] text-xs text-[#334155]">
                      {internships.map((job, idx) => {
                        const appList = applicantsQueries[idx]?.data?.data || [];
                        const isClosing = closeMutation.isPending;

                        return (
                          <tr key={job.id} className="hover:bg-[#F8FAFC] transition-colors">
                            <td className="p-4">
                              <div className="font-semibold text-[#0F172A]">CGPA &ge; {job.criteria.minCgpa}</div>
                              <div className="text-[10px] text-[#64748B] mt-0.5 font-mono">ID: {job.id}</div>
                            </td>
                            <td className="p-4 font-mono font-semibold">{job.vacancies} slot(s)</td>
                            <td className="p-4">{getStatusBadge(job.status)}</td>
                            <td className="p-4">
                              <span className="font-bold text-[#5B21B6]">{appList.length} applied</span>
                            </td>
                            <td className="p-4 text-right space-x-2">
                              <Link
                                href={`/company/postings/${job.id}/applicants`}
                                className="inline-flex items-center gap-0.5 text-xs font-bold text-[#EA580C] hover:underline"
                              >
                                View Applicants <ArrowUpRight className="w-3.5 h-3.5" />
                              </Link>
                              {job.status === 'open' && (
                                <button
                                  onClick={() => handleClose(job.id!)}
                                  disabled={isClosing}
                                  className="text-xs font-bold text-[#B91C1C] hover:underline cursor-pointer ml-4"
                                >
                                  Close
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>
        )}

      </div>
    </RoleShell>
  );
}
