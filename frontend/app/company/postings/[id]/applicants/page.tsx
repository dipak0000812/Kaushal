'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { Role, ApplicationStatus, ALLOWED_TRANSITIONS } from '@/lib/types';
import RoleShell from '@/components/shared/RoleShell';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, UserCheck, UserX, Award, ClipboardCopy, Star, AlertTriangle, ExternalLink } from 'lucide-react';

interface Props {
  params: Promise<{ id: string }>;
}

export default function ApplicantsPage({ params }: Props) {
  const resolvedParams = React.use(params);
  const id = resolvedParams.id; // internshipId
  const router = useRouter();
  const queryClient = useQueryClient();

  const [evalOpen, setEvalOpen] = useState(false);
  const [evalAppId, setEvalAppId] = useState<string | null>(null);
  const [rating, setRating] = useState(5);
  const [ppoRecommended, setPpoRecommended] = useState('false');

  // 1. Fetch internship details
  const { data: internshipsRes } = useQuery({
    queryKey: ['company-internships'],
    queryFn: () => apiClient.company.getInternships(),
  });

  const internship = (internshipsRes?.data || []).find(i => i.id === id);

  // 2. Fetch applicants list
  const { data: applicantsRes, isLoading } = useQuery({
    queryKey: ['company-applicants', id],
    queryFn: () => apiClient.company.getApplicants(id),
  });

  const applicants = applicantsRes?.data || [];

  // 3. Action Mutations
  const shortlistMutation = useMutation({
    mutationFn: (appId: string) => apiClient.company.shortlistApplicant(appId),
    onSuccess: (res) => {
      if (res.success) {
        queryClient.invalidateQueries({ queryKey: ['company-applicants', id] });
        queryClient.invalidateQueries({ queryKey: ['student-applications'] });
        alert('Applicant shortlisted successfully.');
      } else {
        alert(`Failed to shortlist: ${res.error?.message}`);
      }
    }
  });

  const rejectMutation = useMutation({
    mutationFn: ({ appId, reason }: { appId: string; reason: string }) => 
      apiClient.company.rejectApplicant(appId, reason),
    onSuccess: (res) => {
      if (res.success) {
        queryClient.invalidateQueries({ queryKey: ['company-applicants', id] });
        queryClient.invalidateQueries({ queryKey: ['student-applications'] });
        // Killer moment: Invalidate analytics query cache key
        queryClient.invalidateQueries({ queryKey: ['tnp-analytics'] });
        alert('Applicant rejected.');
      } else {
        alert(`Failed to reject: ${res.error?.message}`);
      }
    }
  });

  const offerMutation = useMutation({
    mutationFn: (appId: string) => apiClient.company.offerInternship(appId),
    onSuccess: (res) => {
      if (res.success) {
        queryClient.invalidateQueries({ queryKey: ['company-applicants', id] });
        queryClient.invalidateQueries({ queryKey: ['student-applications'] });
        queryClient.invalidateQueries({ queryKey: ['tnp-analytics'] });
        alert('Internship offer sent successfully.');
      } else {
        alert(`Failed to send offer: ${res.error?.message}`);
      }
    }
  });

  const evaluateMutation = useMutation({
    mutationFn: ({ appId, ratingVal, ppoVal }: { appId: string; ratingVal: number; ppoVal: boolean }) =>
      apiClient.company.evaluateApplication(appId, { rating: ratingVal, ppoRecommended: ppoVal }),
    onSuccess: (res) => {
      if (res.success) {
        queryClient.invalidateQueries({ queryKey: ['company-applicants', id] });
        queryClient.invalidateQueries({ queryKey: ['student-applications'] });
        setEvalOpen(false);
        setEvalAppId(null);
        alert('Evaluation submitted successfully.');
      } else {
        alert(`Failed to submit evaluation: ${res.error?.message}`);
      }
    }
  });

  const handleShortlist = (appId: string) => {
    shortlistMutation.mutate(appId);
  };

  const handleReject = (appId: string) => {
    const reason = prompt('Enter reason for rejection (e.g. Missing React skills):');
    if (reason === null) return;
    if (!reason.trim()) {
      alert('Rejection reason is required.');
      return;
    }
    rejectMutation.mutate({ appId, reason });
  };

  const handleOffer = (appId: string) => {
    if (confirm('Are you sure you want to make an official internship offer to this applicant?')) {
      offerMutation.mutate(appId);
    }
  };

  const handleEvaluateClick = (appId: string) => {
    setEvalAppId(appId);
    setRating(5);
    setPpoRecommended('false');
    setEvalOpen(true);
  };

  const handleEvaluateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!evalAppId) return;
    evaluateMutation.mutate({
      appId: evalAppId,
      ratingVal: Number(rating),
      ppoVal: ppoRecommended === 'true',
    });
  };

  if (isLoading) {
    return (
      <RoleShell role={Role.COMPANY}>
        <div className="flex items-center justify-center min-h-[400px]">
          <span className="text-xs text-[#64748B] font-semibold animate-pulse">Loading applicants list...</span>
        </div>
      </RoleShell>
    );
  }

  if (!internship) {
    return (
      <RoleShell role={Role.COMPANY}>
        <div className="space-y-4">
          <button onClick={() => router.push('/company')} className="text-xs font-semibold text-[#EA580C] hover:underline flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
          </button>
          <div className="bg-white border border-[#E2E8F0] p-10 text-center rounded-lg text-xs text-[#64748B]">
            Internship listing not found.
          </div>
        </div>
      </RoleShell>
    );
  }

  return (
    <RoleShell role={Role.COMPANY}>
      <div className="space-y-6">
        
        {/* Back navigation */}
        <div>
          <button
            onClick={() => router.push('/company')}
            className="inline-flex items-center gap-1.5 text-xs text-[#EA580C] hover:underline font-semibold cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
          </button>
        </div>

        {/* Listing Header */}
        <div className="bg-white border border-[#E2E8F0] rounded-lg p-6 space-y-4 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-[10px] text-[#94A3B8] font-mono">Job Code: {internship.id}</span>
              <h2 className="text-base font-bold text-[#0F172A] mt-1">Internship Criteria requirements</h2>
              <p className="text-xs text-[#64748B] mt-0.5">
                Minimum CGPA Required: <strong>{internship.criteria.minCgpa}</strong> | 
                Max Backlogs: <strong>{internship.criteria.maxBacklogs}</strong> |
                Branch / Dept: <strong>{internship.criteria.department}</strong>
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs px-2.5 py-1 rounded bg-[#F8FAFC] border border-[#E2E8F0] text-[#475569] font-bold uppercase tracking-wider">
                Status: {internship.status}
              </span>
            </div>
          </div>
        </div>

        {/* Applicants Registry */}
        <section className="space-y-4">
          <h3 className="text-xs font-bold text-[#475569] uppercase tracking-wider">Registered Applicants ({applicants.length})</h3>

          {applicants.length === 0 ? (
            <div className="bg-white border border-[#E2E8F0] p-10 text-center rounded-lg text-xs text-[#64748B]">
              No student candidates have applied to this posting yet.
            </div>
          ) : (
            <div className="bg-white border border-[#E2E8F0] rounded-lg overflow-hidden shadow-sm">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[10px] font-bold text-[#475569] uppercase tracking-wider">
                    <th className="p-4">Student</th>
                    <th className="p-4">Eligibility Status</th>
                    <th className="p-4">Placement Status</th>
                    <th className="p-4">Matched Skills</th>
                    <th className="p-4">Resume</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9] text-xs text-[#334155]">
                  {applicants.map((applicant: any) => {
                    const status = applicant.currentStatus as ApplicationStatus;
                    const transitions = ALLOWED_TRANSITIONS[status] || [];

                    const canShortlist = transitions.includes(ApplicationStatus.SHORTLISTED);
                    const canReject = transitions.includes(ApplicationStatus.REJECTED);
                    const canOffer = transitions.includes(ApplicationStatus.OFFERED);
                    const canEvaluate = status === ApplicationStatus.COMPLETED;

                    // Tiered checks: Verify property presence dynamically
                    const hasMatchedSkills = 'matchedSkills' in applicant && applicant.matchedSkills !== undefined;
                    const hasResumeUrl = 'resumeUrl' in applicant && applicant.resumeUrl !== undefined;

                    return (
                      <tr key={applicant.applicationId} className="hover:bg-[#F8FAFC] transition-colors">
                        <td className="p-4 font-semibold">{applicant.studentName}</td>
                        <td className="p-4">
                          {applicant.eligible ? (
                            <span className="bg-[#DCFCE7] text-[#16A34A] text-[10px] font-bold px-2 py-0.5 rounded border border-[#BBF7D0]">
                              ELIGIBLE
                            </span>
                          ) : (
                            <span className="bg-[#FEE2E2] text-[#B91C1C] text-[10px] font-bold px-2 py-0.5 rounded border border-[#FCA5A5]">
                              INELIGIBLE
                            </span>
                          )}
                        </td>
                        <td className="p-4">
                          <span className="font-mono bg-[#EDE9FE] text-[#5B21B6] px-2 py-0.5 rounded text-[10px] font-bold">
                            {applicant.currentStatus}
                          </span>
                        </td>
                        
                        {/* Matched Skills Column (Tiered) */}
                        <td className="p-4">
                          {hasMatchedSkills ? (
                            <div className="flex flex-wrap gap-1">
                              {applicant.matchedSkills.map((s: string) => (
                                <span key={s} className="bg-[#F0F9FF] text-[#0284C7] text-[10px] px-1.5 py-0.5 rounded font-medium border border-[#BAE6FD]">
                                  {s}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-[#94A3B8] italic font-mono">&mdash;</span>
                          )}
                        </td>

                        {/* Resume Column (Tiered) */}
                        <td className="p-4">
                          {hasResumeUrl ? (
                            <a
                              href={applicant.resumeUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[#5B21B6] hover:underline font-medium"
                            >
                              Resume <ExternalLink className="w-3 h-3" />
                            </a>
                          ) : (
                            <span className="text-[#94A3B8] italic font-mono">&mdash;</span>
                          )}
                        </td>

                        {/* Action buttons gated by ALLOWED_TRANSITIONS */}
                        <td className="p-4 text-right space-x-1.5">
                          {canShortlist && (
                            <button
                              onClick={() => handleShortlist(applicant.applicationId)}
                              className="px-2 py-1 bg-[#EA580C] hover:bg-[#C2410C] text-white text-[10px] font-bold rounded cursor-pointer transition-colors inline-flex items-center gap-1"
                            >
                              <UserCheck className="w-3 h-3" /> Shortlist
                            </button>
                          )}
                          {canOffer && (
                            <button
                              onClick={() => handleOffer(applicant.applicationId)}
                              className="px-2 py-1 bg-[#059669] hover:bg-[#047857] text-white text-[10px] font-bold rounded cursor-pointer transition-colors inline-flex items-center gap-1"
                            >
                              <Award className="w-3 h-3" /> Make Offer
                            </button>
                          )}
                          {canEvaluate && (
                            <button
                              onClick={() => handleEvaluateClick(applicant.applicationId)}
                              className="px-2 py-1 bg-[#0284C7] hover:bg-[#0369A1] text-white text-[10px] font-bold rounded cursor-pointer transition-colors inline-flex items-center gap-1"
                            >
                              <ClipboardCopy className="w-3 h-3" /> Evaluate
                            </button>
                          )}
                          {canReject && (
                            <button
                              onClick={() => handleReject(applicant.applicationId)}
                              className="px-2 py-1 border border-[#E2E8F0] hover:bg-[#FEE2E2] hover:border-[#FCA5A5] text-[#B91C1C] text-[10px] font-bold rounded cursor-pointer transition-colors inline-flex items-center gap-1"
                            >
                              <UserX className="w-3 h-3" /> Reject
                            </button>
                          )}
                          {!canShortlist && !canOffer && !canEvaluate && !canReject && (
                            <span className="text-[10px] text-[#94A3B8] italic">No actions available</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

      </div>

      {/* Evaluation Modal Form */}
      {evalOpen && (
        <div className="fixed inset-0 bg-[#0F172A]/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#E2E8F0] rounded-lg shadow-xl max-w-sm w-full p-6 space-y-4">
            
            <div className="pb-2 border-b border-[#F1F5F9]">
              <h3 className="text-sm font-bold text-[#0F172A] flex items-center gap-1.5">
                <Star className="w-4 h-4 text-[#D97706]" />
                Internship Performance Evaluation
              </h3>
            </div>

            <form onSubmit={handleEvaluateSubmit} className="space-y-4">
              
              {/* Rating */}
              <div>
                <label className="block text-xs font-bold text-[#475569] uppercase tracking-wider mb-2">
                  Performance Rating (1-5 Stars)
                </label>
                <select
                  value={rating}
                  onChange={(e) => setRating(Number(e.target.value))}
                  className="w-full text-xs p-2.5 border border-[#E2E8F0] bg-[#F8FAFC] rounded-md focus:outline-none focus:border-[#EA580C] focus:bg-white font-semibold"
                >
                  <option value="5">5 - Excellent (Highly Productive)</option>
                  <option value="4">4 - Good (Met Expectations)</option>
                  <option value="3">3 - Average (Needs Improvement)</option>
                  <option value="2">2 - Poor (Below Bar)</option>
                  <option value="1">1 - Unsatisfactory</option>
                </select>
              </div>

              {/* PPO */}
              <div>
                <label className="block text-xs font-bold text-[#475569] uppercase tracking-wider mb-2">
                  Recommend for Pre-Placement Offer (PPO)?
                </label>
                <select
                  value={ppoRecommended}
                  onChange={(e) => setPpoRecommended(e.target.value)}
                  className="w-full text-xs p-2.5 border border-[#E2E8F0] bg-[#F8FAFC] rounded-md focus:outline-none focus:border-[#EA580C] focus:bg-white font-semibold"
                >
                  <option value="false">No Recommendation</option>
                  <option value="true">Yes, Recommend for PPO</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 border-t border-[#F1F5F9] pt-3">
                <button
                  type="button"
                  onClick={() => { setEvalOpen(false); setEvalAppId(null); }}
                  className="px-3 py-1.5 border border-[#E2E8F0] bg-white hover:bg-[#F8FAFC] text-xs font-bold rounded cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={evaluateMutation.isPending}
                  className="px-3 py-1.5 bg-[#EA580C] text-white hover:bg-[#C2410C] text-xs font-bold rounded shadow cursor-pointer transition-colors"
                >
                  {evaluateMutation.isPending ? 'Submitting...' : 'Submit Evaluation'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </RoleShell>
  );
}
