'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { Role, ApplicationStatus } from '@/lib/types';
import RoleShell from '@/components/shared/RoleShell';
import EligibilityBreakdown from '@/components/shared/EligibilityBreakdown';
import AssignmentQueueCard from '@/components/shared/AssignmentQueueCard';
import { 
  Check, 
  X, 
  ShieldCheck, 
  ShieldAlert, 
  UserPlus, 
  HelpCircle, 
  Info,
  Layers,
  ChevronRight,
  Settings,
  Briefcase,
  ExternalLink
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

export default function VerificationQueuePage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'offers' | 'postings' | 'offcampus' | 'mentors' | 'overrides'>('offers');
  const [selectedAppForOverride, setSelectedAppForOverride] = useState<any | null>(null);
  const [overrideEligible, setOverrideEligible] = useState<boolean>(true);
  const [overrideReason, setOverrideReason] = useState<string>('');

  const [rejectAppId, setRejectAppId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('');

  const [rejectOffCampusId, setRejectOffCampusId] = useState<string | null>(null);
  const [rejectOffCampusReason, setRejectOffCampusReason] = useState<string>('');

  // 1. Fetch Queries
  const { data: appsRes, isLoading: isAppsLoading } = useQuery({
    queryKey: ['student-applications'],
    queryFn: () => apiClient.student.getApplications(),
  });

  const { data: pendingPostingsRes, isLoading: isPostingsLoading } = useQuery({
    queryKey: ['pending-internships'],
    queryFn: () => apiClient.tnp.getPendingInternships(),
  });

  const { data: usersRes } = useQuery({
    queryKey: ['tnp-users'],
    queryFn: () => apiClient.tnp.getUsers(),
  });

  const { data: offCampusRes, isLoading: isOffCampusLoading } = useQuery({
    queryKey: ['tnp-offcampus-queue'],
    queryFn: () => apiClient.tnp.getOffCampusQueue(),
  });

  const applications = appsRes?.data || [];
  const pendingPostings = pendingPostingsRes?.data || [];
  const users = usersRes?.data || [];
  const offCampusQueue = offCampusRes?.data || [];

  // Filter lists for different tabs
  const acceptedApps = applications.filter(a => a.currentStatus === ApplicationStatus.ACCEPTED);
  const unassignedApps = applications.filter(a => a.currentStatus === ApplicationStatus.TNP_VERIFIED);

  // 2. Mutations
  const verifyOfferMutation = useMutation({
    mutationFn: (id: string) => apiClient.tnp.verifyOffer(id),
    onSuccess: (res) => {
      if (res.success) {
        queryClient.invalidateQueries({ queryKey: ['student-applications'] });
        queryClient.invalidateQueries({ queryKey: ['tnp-alerts'] });
        toast.success('Offer verified and moved to TNP_VERIFIED status.');
      } else {
        toast.error(`Failed to verify offer: ${res.error?.message}`);
      }
    }
  });

  const rejectOfferMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => apiClient.tnp.rejectOffer(id, reason),
    onSuccess: (res) => {
      if (res.success) {
        queryClient.invalidateQueries({ queryKey: ['student-applications'] });
        queryClient.invalidateQueries({ queryKey: ['tnp-alerts'] });
        queryClient.invalidateQueries({ queryKey: ['tnp-analytics'] });
        setRejectAppId(null);
        setRejectReason('');
        toast.success('Offer rejected. Application returned to OFFERED status.');
      } else {
        toast.error(`Failed to reject offer: ${res.error?.message}`);
      }
    }
  });

  const approvePostingMutation = useMutation({
    mutationFn: (id: string) => apiClient.tnp.approveInternship(id),
    onSuccess: (res) => {
      if (res.success) {
        queryClient.invalidateQueries({ queryKey: ['pending-internships'] });
        queryClient.invalidateQueries({ queryKey: ['internships'] });
        queryClient.invalidateQueries({ queryKey: ['tnp-alerts'] });
        toast.success('Corporate internship posting approved and published.');
      } else {
        toast.error(`Failed to approve posting: ${res.error?.message}`);
      }
    }
  });

  const verifyOffCampusMutation = useMutation({
    mutationFn: (id: string) => apiClient.tnp.verifyOffCampusOpportunity(id),
    onSuccess: (res) => {
      if (res.success) {
        queryClient.invalidateQueries({ queryKey: ['tnp-offcampus-queue'] });
        queryClient.invalidateQueries({ queryKey: ['student-applications'] });
        queryClient.invalidateQueries({ queryKey: ['tnp-alerts'] });
        toast.success('Off-campus opportunity verified and moved to institutional workflow.');
      } else {
        toast.error(`Verification failed: ${res.error?.message}`);
      }
    }
  });

  const rejectOffCampusMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiClient.tnp.rejectOffCampusOpportunity(id, { reason }),
    onSuccess: (res) => {
      if (res.success) {
        queryClient.invalidateQueries({ queryKey: ['tnp-offcampus-queue'] });
        queryClient.invalidateQueries({ queryKey: ['tnp-alerts'] });
        setRejectOffCampusId(null);
        setRejectOffCampusReason('');
        toast.success('Off-campus submission rejected.');
      } else {
        toast.error(`Rejection failed: ${res.error?.message}`);
      }
    }
  });

  const overrideEligibilityMutation = useMutation({
    mutationFn: ({ id, eligible, reason }: { id: string; eligible: boolean; reason: string }) =>
      apiClient.tnp.overrideEligibility(id, { eligible, reason }),
    onSuccess: (res) => {
      if (res.success) {
        queryClient.invalidateQueries({ queryKey: ['student-applications'] });
        setSelectedAppForOverride(null);
        setOverrideReason('');
        toast.success('Eligibility audit override persisted successfully.');
      } else {
        toast.error(`Failed to save override: ${res.error?.message}`);
      }
    }
  });

  const assignMentorMutation = useMutation({
    mutationFn: ({ appId, facultyId }: { appId: string; facultyId: string }) =>
      apiClient.tnp.assignMentor({ applicationId: appId, facultyId }),
    onSuccess: (res) => {
      if (res.success) {
        queryClient.invalidateQueries({ queryKey: ['student-applications'] });
        queryClient.invalidateQueries({ queryKey: ['tnp-alerts'] });
        toast.success('Faculty mentor assigned successfully.');
      } else {
        toast.error(`Failed to assign mentor: ${res.error?.message}`);
      }
    }
  });

  const handleRejectOfferSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectAppId || !rejectReason.trim()) return;
    rejectOfferMutation.mutate({ id: rejectAppId, reason: rejectReason.trim() });
  };

  const handleRejectOffCampusSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectOffCampusId || !rejectOffCampusReason.trim()) return;
    rejectOffCampusMutation.mutate({ id: rejectOffCampusId, reason: rejectOffCampusReason.trim() });
  };

  const handleOverrideSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAppForOverride || !overrideReason.trim()) return;
    overrideEligibilityMutation.mutate({
      id: selectedAppForOverride.id,
      eligible: overrideEligible,
      reason: overrideReason.trim()
    });
  };

  // Find faculty members from fetched users for select dropdown
  const facultyUsers = users.filter((u: any) => u.role === 'faculty');

  return (
    <RoleShell role={Role.TNP}>
      <Toaster position="top-center" reverseOrder={false} />
      <div className="space-y-6">
        
        {/* Header */}
        <div>
          <h2 className="text-xl font-bold text-[#0F172A]">T&P Verification Console</h2>
          <p className="text-xs text-[#64748B] mt-0.5">
            Monitor, approve, and verify placements and off-campus corporate training across student cohorts.
          </p>
        </div>

        {/* Tab Selection */}
        <div className="border-b border-[#E2E8F0] flex gap-2 overflow-x-auto pb-px">
          <button
            onClick={() => setActiveTab('offers')}
            className={`text-xs px-3 py-2 border-b-2 font-medium transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'offers'
                ? 'border-[#5B21B6] text-[#5B21B6]'
                : 'border-transparent text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            Offer Verifications ({acceptedApps.length})
          </button>
          <button
            onClick={() => setActiveTab('offcampus')}
            className={`text-xs px-3 py-2 border-b-2 font-medium transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'offcampus'
                ? 'border-[#5B21B6] text-[#5B21B6]'
                : 'border-transparent text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            Off-Campus Submissions ({offCampusQueue.length})
          </button>
          <button
            onClick={() => setActiveTab('postings')}
            className={`text-xs px-3 py-2 border-b-2 font-medium transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'postings'
                ? 'border-[#5B21B6] text-[#5B21B6]'
                : 'border-transparent text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            Pending Postings ({pendingPostings.length})
          </button>
          <button
            onClick={() => setActiveTab('mentors')}
            className={`text-xs px-3 py-2 border-b-2 font-medium transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'mentors'
                ? 'border-[#5B21B6] text-[#5B21B6]'
                : 'border-transparent text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            Mentor Assignments ({unassignedApps.length})
          </button>
          <button
            onClick={() => setActiveTab('overrides')}
            className={`text-xs px-3 py-2 border-b-2 font-medium transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'overrides'
                ? 'border-[#5B21B6] text-[#5B21B6]'
                : 'border-transparent text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            Eligibility Overrides
          </button>
        </div>

        {/* Tab 1: Offer Verifications */}
        {activeTab === 'offers' && (
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-[#475569] uppercase tracking-wider">
              Student Accepted Offers Awaiting Institutional Approval
            </h3>

            {acceptedApps.length === 0 ? (
              <div className="bg-white border border-[#E2E8F0] rounded-xl p-10 text-center text-xs text-[#64748B] shadow-sm">
                No student accepted offers in the verification pipeline.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {acceptedApps.map((app: any) => (
                  <div key={app.id} className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-sm space-y-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="text-sm font-bold text-[#0F172A]">{app.studentName}</h4>
                        <p className="text-xs text-[#475569] mt-0.5">{app.internshipTitle}</p>
                      </div>
                      <span className="bg-[#EDE9FE] text-[#5B21B6] text-[10px] font-bold px-2 py-0.5 rounded border border-[#DDD6FE]">
                        {app.currentStatus}
                      </span>
                    </div>

                    {app.eligibilitySnapshot && (
                      <div className="border border-[#F1F5F9] rounded-lg p-3 bg-[#F8FAFC]">
                        <EligibilityBreakdown eligibility={app.eligibilitySnapshot} />
                      </div>
                    )}

                    <div className="flex justify-end gap-2 pt-2 border-t border-[#F1F5F9]">
                      <button
                        onClick={() => setRejectAppId(app.id)}
                        disabled={rejectOfferMutation.isPending || verifyOfferMutation.isPending}
                        className="px-3 py-1.5 border border-[#FECACA] hover:bg-[#FFF5F5] text-[#DC2626] rounded-lg text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                      >
                        Reject Offer
                      </button>
                      <button
                        onClick={() => verifyOfferMutation.mutate(app.id)}
                        disabled={verifyOfferMutation.isPending || rejectOfferMutation.isPending}
                        className="px-3 py-1.5 bg-[#5B21B6] hover:bg-[#4C1D95] text-white rounded-lg text-xs font-bold transition-colors shadow-sm cursor-pointer disabled:opacity-50"
                      >
                        {verifyOfferMutation.isPending ? 'Verifying...' : 'Verify Offer'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Off-Campus Submissions Queue */}
        {activeTab === 'offcampus' && (
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-[#475569] uppercase tracking-wider flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-violet-600" />
              Off-Campus Internship Submissions Awaiting Institutional Verification
            </h3>

            {offCampusQueue.length === 0 ? (
              <div className="bg-white border border-[#E2E8F0] rounded-xl p-10 text-center text-xs text-[#64748B] shadow-sm">
                No off-campus opportunities awaiting verification.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {offCampusQueue.map((item: any) => {
                  const student = item.student || {};
                  return (
                    <div key={item.id || item._id} className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-sm space-y-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                            {item.externalCompanyName}
                          </span>
                          <h4 className="text-sm font-bold text-slate-900 mt-0.5">{item.title}</h4>
                        </div>
                        <span className="bg-amber-50 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-200">
                          pendingVerification
                        </span>
                      </div>

                      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs space-y-1">
                        <p className="font-semibold text-slate-800">
                          Student: {student.name || 'Student'} ({student.email || 'N/A'})
                        </p>
                        <p className="text-[11px] text-slate-500">
                          Department: {student.department} &bull; Year {student.year} &bull; CGPA: {(student.cgpa || 0).toFixed(2)} &bull; Backlogs: {student.activeBacklogs || 0}
                        </p>
                      </div>

                      <p className="text-xs text-slate-600 line-clamp-3">{item.description}</p>

                      <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100 gap-2">
                        <span>Duration: {item.duration} &bull; Mode: {item.mode}</span>
                        {item.evidenceUrl && (
                          <a
                            href={item.evidenceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-violet-600 font-semibold hover:underline"
                          >
                            View Evidence / Offer Letter <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>

                      <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                        <button
                          onClick={() => setRejectOffCampusId(item.id || item._id)}
                          disabled={verifyOffCampusMutation.isPending || rejectOffCampusMutation.isPending}
                          className="px-3 py-1.5 border border-rose-200 hover:bg-rose-50 text-rose-700 rounded-lg text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                        >
                          Reject Submission
                        </button>
                        <button
                          onClick={() => verifyOffCampusMutation.mutate(item.id || item._id)}
                          disabled={verifyOffCampusMutation.isPending || rejectOffCampusMutation.isPending}
                          className="px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-xs font-bold transition-colors shadow-sm cursor-pointer disabled:opacity-50"
                        >
                          {verifyOffCampusMutation.isPending ? 'Verifying...' : 'Verify & Approve'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Pending Postings */}
        {activeTab === 'postings' && (
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-[#475569] uppercase tracking-wider">
              Pending Corporate Postings from Unverified Entities
            </h3>

            {pendingPostings.length === 0 ? (
              <div className="bg-white border border-[#E2E8F0] rounded-xl p-10 text-center text-xs text-[#64748B] shadow-sm">
                No corporate internship postings pending manual approval.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pendingPostings.map((posting: any) => (
                  <div key={posting.id} className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-sm space-y-4">
                    <div>
                      <span className="text-[10px] text-[#94A3B8] font-bold uppercase tracking-wider">
                        {posting.companyName || 'Corporate Partner'}
                      </span>
                      <h4 className="text-sm font-bold text-[#0F172A] mt-0.5">{posting.title}</h4>
                      <p className="text-xs text-[#64748B] mt-1">{posting.description}</p>
                    </div>

                    <div className="text-xs text-[#475569] bg-[#F8FAFC] border border-[#E2E8F0] p-3 rounded-lg space-y-1">
                      <p><strong>Min CGPA:</strong> {posting.criteria?.minCgpa}</p>
                      <p><strong>Departments:</strong> {(posting.criteria?.departments || [posting.criteria?.department]).join(', ')}</p>
                      <p><strong>Vacancies:</strong> {posting.vacancies}</p>
                    </div>

                    <div className="flex justify-end gap-2 pt-2 border-t border-[#F1F5F9]">
                      <button
                        onClick={() => approvePostingMutation.mutate(posting.id)}
                        disabled={approvePostingMutation.isPending}
                        className="px-3 py-1.5 bg-[#5B21B6] hover:bg-[#4C1D95] text-white rounded-lg text-xs font-bold transition-colors shadow-sm cursor-pointer disabled:opacity-50"
                      >
                        {approvePostingMutation.isPending ? 'Publishing...' : 'Approve & Publish'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Mentor Assignments */}
        {activeTab === 'mentors' && (
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-[#475569] uppercase tracking-wider">
              Assign Faculty Mentors to Verified Students
            </h3>

            {unassignedApps.length === 0 ? (
              <div className="bg-white border border-[#E2E8F0] rounded-xl p-10 text-center text-xs text-[#64748B] shadow-sm">
                No verified applications waiting in the unassigned mentor queue.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {unassignedApps.map((app: any) => {
                  return (
                    <div key={app.id} className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-sm space-y-4">
                      <div>
                        <h4 className="text-sm font-bold text-[#0F172A]">{app.studentName}</h4>
                        <p className="text-xs text-[#475569] mt-0.5">{app.internshipTitle}</p>
                      </div>

                      <div className="pt-2 border-t border-[#F1F5F9]">
                        <label className="block text-[11px] font-bold text-[#475569] mb-1">
                          Select Faculty Mentor:
                        </label>
                        <select
                          className="w-full text-xs p-2 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#5B21B6]"
                          defaultValue=""
                          onChange={(e) => {
                            const facultyId = e.target.value;
                            if (facultyId) {
                              assignMentorMutation.mutate({ appId: app.id, facultyId });
                            }
                          }}
                        >
                          <option value="" disabled>Choose Faculty...</option>
                          {facultyUsers.map((f: any) => (
                            <option key={f.id || f._id} value={f.id || f._id}>
                              {f.name} ({f.department || 'Faculty'})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab 5: Overrides */}
        {activeTab === 'overrides' && (
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-[#475569] uppercase tracking-wider">
              Live Applications Eligibility Audit & Override Console
            </h3>

            <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[10px] font-bold text-[#475569] uppercase tracking-wider">
                    <th className="p-4">Student</th>
                    <th className="p-4">Internship Role</th>
                    <th className="p-4">Placement Status</th>
                    <th className="p-4">Snapshot Decision</th>
                    <th className="p-4">Active Override</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9] text-xs text-[#334155]">
                  {applications.map((app: any) => (
                    <tr key={app.id} className="hover:bg-[#F8FAFC] transition-colors">
                      <td className="p-4 font-semibold text-[#0F172A]">{app.studentName}</td>
                      <td className="p-4 text-[#475569]">{app.internshipTitle}</td>
                      <td className="p-4">
                        <span className="font-mono bg-[#F1F5F9] text-[#475569] px-2 py-0.5 rounded text-[10px] font-bold">
                          {app.currentStatus}
                        </span>
                      </td>
                      <td className="p-4">
                        {app.eligibilitySnapshot?.eligible ? (
                          <span className="text-[#16A34A] font-bold text-[10px]">ELIGIBLE</span>
                        ) : (
                          <span className="text-[#DC2626] font-bold text-[10px]">NOT ELIGIBLE</span>
                        )}
                      </td>
                      <td className="p-4">
                        {app.override ? (
                          <span className="text-[#5B21B6] font-bold text-[10px] bg-[#EDE9FE] px-2 py-0.5 rounded border border-[#DDD6FE]">
                            OVERRIDDEN ({app.override.eligible ? 'Approved' : 'Disallowed'})
                          </span>
                        ) : (
                          <span className="text-[#94A3B8] text-[10px]">None</span>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => {
                            setSelectedAppForOverride(app);
                            setOverrideEligible(app.override ? app.override.eligible : true);
                            setOverrideReason(app.override ? app.override.reason : '');
                          }}
                          className="px-2.5 py-1 border border-[#E2E8F0] hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                        >
                          Audit / Override
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Reject Offer Modal */}
        {rejectAppId && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white border border-[#E2E8F0] w-full max-w-md rounded-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
              <div className="px-6 py-4 border-b border-[#E2E8F0] flex justify-between items-center bg-[#F8FAFC]">
                <h3 className="text-sm font-bold text-[#DC2626]">Reject Offer Verification</h3>
                <button 
                  onClick={() => setRejectAppId(null)}
                  className="text-slate-400 hover:text-slate-600 text-xs font-bold px-2 py-1 rounded hover:bg-[#F1F5F9] cursor-pointer"
                >
                  Close
                </button>
              </div>

              <form onSubmit={handleRejectOfferSubmit}>
                <div className="p-6 space-y-4">
                  <p className="text-xs text-[#475569] leading-relaxed">
                    Please provide an explicit audit reason for rejecting this offer. The application will transition back to the <strong>OFFERED</strong> status.
                  </p>
                  <div>
                    <label className="block text-xs font-bold text-[#334155] mb-1">
                      Rejection Reason:
                    </label>
                    <textarea
                      required
                      rows={3}
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="e.g. Unverified offer letter, conflicting placement policy..."
                      className="w-full text-xs p-2.5 border border-[#CBD5E1] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#DC2626]"
                    />
                  </div>
                </div>

                <div className="px-6 py-4 border-t border-[#E2E8F0] flex justify-end gap-3 bg-[#F8FAFC]">
                  <button
                    type="button"
                    onClick={() => setRejectAppId(null)}
                    className="px-4 py-2 border border-[#E2E8F0] hover:bg-slate-50 text-slate-600 font-bold rounded-lg text-xs cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={rejectOfferMutation.isPending}
                    className="px-4 py-2 bg-[#DC2626] hover:bg-[#B91C1C] text-white font-bold rounded-lg text-xs shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    {rejectOfferMutation.isPending ? 'Submitting...' : 'Confirm Rejection'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Reject Off-Campus Modal */}
        {rejectOffCampusId && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white border border-[#E2E8F0] w-full max-w-md rounded-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
              <div className="px-6 py-4 border-b border-[#E2E8F0] flex justify-between items-center bg-[#F8FAFC]">
                <h3 className="text-sm font-bold text-rose-600">Reject Off-Campus Opportunity</h3>
                <button 
                  onClick={() => setRejectOffCampusId(null)}
                  className="text-slate-400 hover:text-slate-600 text-xs font-bold px-2 py-1 rounded hover:bg-[#F1F5F9] cursor-pointer"
                >
                  Close
                </button>
              </div>

              <form onSubmit={handleRejectOffCampusSubmit}>
                <div className="p-6 space-y-4">
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Provide the reason for rejecting this student's off-campus registration. The student will see this note in their dashboard.
                  </p>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Audit Reason *
                    </label>
                    <textarea
                      required
                      rows={3}
                      value={rejectOffCampusReason}
                      onChange={(e) => setRejectOffCampusReason(e.target.value)}
                      placeholder="e.g. Unaccredited company, stipend below institutional guidelines..."
                      className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
                    />
                  </div>
                </div>

                <div className="px-6 py-4 border-t border-[#E2E8F0] flex justify-end gap-3 bg-[#F8FAFC]">
                  <button
                    type="button"
                    onClick={() => setRejectOffCampusId(null)}
                    className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-600 font-bold rounded-lg text-xs cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={rejectOffCampusMutation.isPending}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-xs shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    {rejectOffCampusMutation.isPending ? 'Rejecting...' : 'Confirm Rejection'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Audit / Override Modal */}
        {selectedAppForOverride && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white border border-[#E2E8F0] w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
              <div className="px-6 py-4 border-b border-[#E2E8F0] flex justify-between items-center bg-[#F8FAFC]">
                <div>
                  <h3 className="text-sm font-bold text-[#0F172A]">Institutional Eligibility Override</h3>
                  <p className="text-[10px] text-[#64748B] mt-0.5">
                    Target: {selectedAppForOverride.studentName} &bull; {selectedAppForOverride.internshipTitle}
                  </p>
                </div>
                <button 
                  onClick={() => setSelectedAppForOverride(null)}
                  className="text-slate-400 hover:text-slate-600 text-xs font-bold px-2 py-1 rounded hover:bg-[#F1F5F9] cursor-pointer"
                >
                  Close
                </button>
              </div>

              <form onSubmit={handleOverrideSubmit}>
                <div className="p-6 space-y-4">
                  {selectedAppForOverride.eligibilitySnapshot && (
                    <div className="border border-[#F1F5F9] rounded-lg p-3 bg-[#F8FAFC] max-h-48 overflow-y-auto">
                      <EligibilityBreakdown eligibility={selectedAppForOverride.eligibilitySnapshot} />
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-[#334155]">
                      Override Decision:
                    </label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-1.5 text-xs font-semibold text-[#16A34A] cursor-pointer">
                        <input
                          type="radio"
                          name="override_choice"
                          checked={overrideEligible === true}
                          onChange={() => setOverrideEligible(true)}
                        />
                        Grant Waiver (Force Eligible)
                      </label>
                      <label className="flex items-center gap-1.5 text-xs font-semibold text-[#DC2626] cursor-pointer">
                        <input
                          type="radio"
                          name="override_choice"
                          checked={overrideEligible === false}
                          onChange={() => setOverrideEligible(false)}
                        />
                        Disallow Application (Force Ineligible)
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#334155] mb-1">
                      Audit Reason & Justification:
                    </label>
                    <textarea
                      required
                      rows={3}
                      value={overrideReason}
                      onChange={(e) => setOverrideReason(e.target.value)}
                      placeholder="e.g. Special academic committee exception approved by Dean..."
                      className="w-full text-xs p-2.5 border border-[#CBD5E1] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B21B6]"
                    />
                  </div>
                </div>

                <div className="px-6 py-4 border-t border-[#E2E8F0] flex justify-end gap-3 bg-[#F8FAFC]">
                  <button
                    type="button"
                    onClick={() => setSelectedAppForOverride(null)}
                    className="px-4 py-2 border border-[#E2E8F0] hover:bg-slate-50 text-slate-600 font-bold rounded-lg text-xs cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={overrideEligibilityMutation.isPending}
                    className="px-4 py-2 bg-[#5B21B6] hover:bg-[#4C1D95] text-white font-bold rounded-lg text-xs shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    {overrideEligibilityMutation.isPending ? 'Saving...' : 'Save Audit Override'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </RoleShell>
  );
}
