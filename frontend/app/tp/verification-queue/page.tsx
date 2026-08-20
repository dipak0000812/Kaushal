'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, mockTnpUsers } from '@/lib/api/client';
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
  Settings
} from 'lucide-react';

export default function VerificationQueuePage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'offers' | 'postings' | 'mentors' | 'overrides'>('offers');
  const [selectedAppForOverride, setSelectedAppForOverride] = useState<any | null>(null);
  const [overrideEligible, setOverrideEligible] = useState<boolean>(true);
  const [overrideReason, setOverrideReason] = useState<string>('');

  const [rejectAppId, setRejectAppId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('');

  // 1. Fetch Queries
  const { data: appsRes, isLoading: isAppsLoading } = useQuery({
    queryKey: ['student-applications'],
    queryFn: () => apiClient.student.getApplications(),
  });

  const { data: pendingPostingsRes, isLoading: isPostingsLoading } = useQuery({
    queryKey: ['pending-internships'],
    queryFn: () => apiClient.tnp.getPendingInternships(),
  });

  const applications = appsRes?.data || [];
  const pendingPostings = pendingPostingsRes?.data || [];

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
        alert('Offer verified and moved to TNP_VERIFIED status.');
      } else {
        alert(`Failed to verify offer: ${res.error?.message}`);
      }
    }
  });

  const rejectOfferMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => apiClient.tnp.rejectOffer(id, reason),
    onSuccess: (res) => {
      if (res.success) {
        queryClient.invalidateQueries({ queryKey: ['student-applications'] });
        queryClient.invalidateQueries({ queryKey: ['tnp-alerts'] });
        // The killer moment: invalidating analytics query key on rejection
        queryClient.invalidateQueries({ queryKey: ['tnp-analytics'] });
        setRejectAppId(null);
        setRejectReason('');
        alert('Offer rejected. Application returned to OFFERED status.');
      } else {
        alert(`Failed to reject offer: ${res.error?.message}`);
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
        alert('Corporate internship posting approved and published.');
      } else {
        alert(`Failed to approve posting: ${res.error?.message}`);
      }
    }
  });

  const assignMentorMutation = useMutation({
    mutationFn: (body: { applicationId: string; facultyId: string }) => apiClient.tnp.assignMentor(body),
    onSuccess: (res) => {
      if (res.success) {
        queryClient.invalidateQueries({ queryKey: ['student-applications'] });
        queryClient.invalidateQueries({ queryKey: ['tnp-alerts'] });
        alert('Faculty mentor assigned successfully.');
      } else {
        alert(`Failed to assign mentor: ${res.error?.message}`);
      }
    }
  });

  const overrideEligibilityMutation = useMutation({
    mutationFn: (body: { id: string; eligible: boolean; reason: string }) => 
      apiClient.tnp.overrideEligibility(body.id, { eligible: body.eligible, reason: body.reason }),
    onSuccess: (res) => {
      if (res.success) {
        queryClient.invalidateQueries({ queryKey: ['student-applications'] });
        queryClient.invalidateQueries({ queryKey: ['tnp-alerts'] });
        queryClient.invalidateQueries({ queryKey: ['internships'] });
        setSelectedAppForOverride(null);
        setOverrideReason('');
        alert('Eligibility override saved successfully.');
      } else {
        alert(`Failed to save override: ${res.error?.message}`);
      }
    }
  });

  const handleVerify = (id: string) => {
    verifyOfferMutation.mutate(id);
  };

  const handleRejectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectAppId || !rejectReason.trim()) return;
    rejectOfferMutation.mutate({ id: rejectAppId, reason: rejectReason });
  };

  const handleOverrideSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAppForOverride || !overrideReason.trim()) return;
    overrideEligibilityMutation.mutate({
      id: selectedAppForOverride.id,
      eligible: overrideEligible,
      reason: overrideReason
    });
  };

  // Find CSE/IT faculty members from mock users for select dropdown
  const facultyUsers = mockTnpUsers.filter(u => u.role === 'faculty');

  return (
    <RoleShell role={Role.TNP}>
      <div className="space-y-6">
        
        {/* Header */}
        <div>
          <h2 className="text-xl font-bold text-[#0F172A]">T&P Verification Console</h2>
          <p className="text-xs text-[#64748B] mt-0.5">
            Monitor, approve, and override placement metrics across student cohorts.
          </p>
        </div>

        {/* Tab Selection */}
        <div className="border-b border-[#E2E8F0] flex gap-2">
          <button
            onClick={() => setActiveTab('offers')}
            className={`text-xs px-3 py-2 border-b-2 font-medium transition-all cursor-pointer ${
              activeTab === 'offers'
                ? 'border-[#5B21B6] text-[#5B21B6]'
                : 'border-transparent text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            Offer Verifications ({acceptedApps.length})
          </button>
          <button
            onClick={() => setActiveTab('postings')}
            className={`text-xs px-3 py-2 border-b-2 font-medium transition-all cursor-pointer ${
              activeTab === 'postings'
                ? 'border-[#5B21B6] text-[#5B21B6]'
                : 'border-transparent text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            Pending Postings ({pendingPostings.length})
          </button>
          <button
            onClick={() => setActiveTab('mentors')}
            className={`text-xs px-3 py-2 border-b-2 font-medium transition-all cursor-pointer ${
              activeTab === 'mentors'
                ? 'border-[#5B21B6] text-[#5B21B6]'
                : 'border-transparent text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            Mentor Assignments ({unassignedApps.length})
          </button>
          <button
            onClick={() => setActiveTab('overrides')}
            className={`text-xs px-3 py-2 border-b-2 font-medium transition-all cursor-pointer ${
              activeTab === 'overrides'
                ? 'border-[#5B21B6] text-[#5B21B6]'
                : 'border-transparent text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            Manual Overrides
          </button>
        </div>

        {/* Workspace Panels */}
        
        {/* Tab A: Offers */}
        {activeTab === 'offers' && (
          <div className="space-y-4">
            {acceptedApps.length === 0 ? (
              <div className="bg-white border border-[#E2E8F0] p-10 text-center rounded-lg text-xs text-[#64748B]">
                No student application offers pending T&P verification.
              </div>
            ) : (
              <div className="space-y-4">
                {acceptedApps.map(app => (
                  <div key={app.id} className="bg-white border border-[#E2E8F0] rounded-lg p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <span className="text-[10px] text-[#94A3B8] font-mono">App ID: {app.id}</span>
                      <h4 className="text-sm font-bold text-[#0F172A] mt-0.5">{app.internshipTitle}</h4>
                      <p className="text-xs text-[#475569] mt-0.5">Student: {app.studentName}</p>
                    </div>

                    <div className="flex gap-2 items-center">
                      <button
                        onClick={() => handleVerify(app.id)}
                        disabled={verifyOfferMutation.isPending}
                        className="px-3 py-1.5 bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-bold rounded shadow-sm inline-flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Verify Offer
                      </button>
                      <button
                        onClick={() => setRejectAppId(app.id)}
                        className="px-3 py-1.5 border border-[#FCA5A5] text-[#DC2626] bg-white hover:bg-[#FEE2E2] text-xs font-bold rounded shadow-sm inline-flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                        Reject Offer
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab B: Postings */}
        {activeTab === 'postings' && (
          <div className="space-y-4">
            {pendingPostings.length === 0 ? (
              <div className="bg-white border border-[#E2E8F0] p-10 text-center rounded-lg text-xs text-[#64748B]">
                No corporate internship listings awaiting manual T&P approval.
              </div>
            ) : (
              <div className="space-y-4">
                {pendingPostings.map(post => (
                  <div key={post.id} className="bg-white border border-[#E2E8F0] rounded-lg p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <span className="text-[10px] text-[#94A3B8] font-bold uppercase tracking-wider">{post.companyName}</span>
                      <h4 className="text-sm font-bold text-[#0F172A] mt-0.5">Frontend Developer Posting</h4>
                      <p className="text-xs text-[#475569] mt-0.5">
                        Min CGPA: {post.criteria.minCgpa} &bull; Vacancies: {post.vacancies}
                      </p>
                    </div>
                    <div>
                      <button
                        onClick={() => approvePostingMutation.mutate(post.id)}
                        disabled={approvePostingMutation.isPending}
                        className="px-4 py-2 bg-[#5B21B6] hover:bg-[#4C1D95] text-white text-xs font-bold rounded shadow cursor-pointer transition-colors"
                      >
                        Approve & Publish
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab C: Mentors */}
        {activeTab === 'mentors' && (
          <div className="space-y-4">
            {unassignedApps.length === 0 ? (
              <div className="bg-white border border-[#E2E8F0] p-10 text-center rounded-lg text-xs text-[#64748B]">
                No verified applications awaiting faculty mentor assignment.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {unassignedApps.map(app => {
                  const handleAssign = (facultyId: string) => {
                    assignMentorMutation.mutate({ applicationId: app.id, facultyId });
                  };

                  return (
                    <div key={app.id} className="bg-white border border-[#E2E8F0] rounded-lg p-5 space-y-4 flex flex-col justify-between">
                      <div>
                        <span className="text-[10px] text-[#94A3B8] font-mono">App: {app.id}</span>
                        <h4 className="text-sm font-bold text-[#0F172A] mt-0.5">{app.internshipTitle}</h4>
                        <p className="text-xs text-[#64748B] mt-0.5">Student: {app.studentName}</p>
                      </div>
                      
                      {/* Mentor Selection List */}
                      <div className="pt-3 border-t border-[#F1F5F9] space-y-2">
                        <span className="text-[10px] font-bold text-[#475569] uppercase tracking-wider block">Assign Faculty Mentor</span>
                        <div className="flex flex-col gap-1.5">
                          {facultyUsers.map(fac => (
                            <button
                              key={fac.email}
                              onClick={() => handleAssign(fac.email)}
                              className="text-left px-3 py-2 bg-[#F8FAFC] hover:bg-[#EDE9FE] hover:text-[#5B21B6] border border-[#E2E8F0] hover:border-[#DDD6FE] rounded text-xs font-semibold transition-all cursor-pointer flex justify-between items-center"
                            >
                              <span>{fac.name}</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab D: Overrides */}
        {activeTab === 'overrides' && (
          <div className="space-y-4">
            <div className="bg-[#FFF8F2] border border-[#FDE8D4] rounded-lg p-5 flex gap-3 text-xs text-[#C2410C]">
              <Settings className="w-5 h-5 text-[#EA580C] shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold">Administrative Override Panel</h4>
                <p className="leading-relaxed mt-1">
                  Manual eligibility overrides allow T&P officials to bypass standard checklist rules (CGPA, backlogs, or department mismatches). Overrides create an audit trail and do NOT modify the student's original eligibility checklist snapshot.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {applications.map(app => {
                const hasOverride = !!app.override;
                const isCurrentlyEligible = app.override?.eligible ?? app.eligibilitySnapshot.eligible;

                return (
                  <div key={app.id} className="bg-white border border-[#E2E8F0] rounded-lg p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-[#94A3B8] font-mono">{app.id}</span>
                        {isCurrentlyEligible ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#DCFCE7] text-[#16A34A] border border-[#BBF7D0]">
                            <ShieldCheck className="w-3 h-3" /> Eligible
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#FEE2E2] text-[#DC2626] border border-[#FECACA]">
                            <ShieldAlert className="w-3 h-3" /> Ineligible
                          </span>
                        )}
                        {hasOverride && (
                          <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#EDE9FE] text-[#5B21B6] border border-[#DDD6FE]">
                            Overridden
                          </span>
                        )}
                      </div>
                      <h4 className="text-sm font-bold text-[#0F172A] mt-1.5">{app.internshipTitle}</h4>
                      <p className="text-xs text-[#64748B] mt-0.5">Student: {app.studentName}</p>
                    </div>

                    <div>
                      <button
                        onClick={() => setSelectedAppForOverride(app)}
                        className="px-3 py-1.5 border border-[#E2E8F0] hover:bg-[#F8FAFC] text-[#5B21B6] hover:text-[#4C1D95] text-xs font-bold rounded shadow-sm cursor-pointer transition-colors"
                      >
                        Adjust Override
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>

      {/* Reject Offer Reason Modal */}
      {rejectAppId && (
        <div className="fixed inset-0 bg-[#0F172A]/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#E2E8F0] rounded-lg shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
              <X className="w-4 h-4 text-[#DC2626]" />
              Reject Offer Verification
            </h3>
            
            <form onSubmit={handleRejectSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#475569] uppercase tracking-wider mb-2">Rejection Reason</label>
                <textarea
                  required
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Provide details on why this offer is being rejected..."
                  className="w-full text-xs p-3 border border-[#E2E8F0] bg-[#F8FAFC] rounded-md focus:outline-none focus:border-[#5B21B6] focus:bg-white min-h-[80px]"
                />
              </div>

              <div className="flex justify-end gap-2 border-t border-[#F1F5F9] pt-3">
                <button
                  type="button"
                  onClick={() => { setRejectAppId(null); setRejectReason(''); }}
                  className="px-3 py-1.5 border border-[#E2E8F0] bg-white hover:bg-[#F8FAFC] text-xs font-bold rounded cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={rejectOfferMutation.isPending}
                  className="px-3 py-1.5 bg-[#DC2626] text-white hover:bg-[#B91C1C] text-xs font-bold rounded shadow cursor-pointer transition-colors"
                >
                  Confirm Rejection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Side-by-Side Override Modal */}
      {selectedAppForOverride && (
        <div className="fixed inset-0 bg-[#0F172A]/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#E2E8F0] rounded-lg shadow-xl max-w-4xl w-full p-6 space-y-6 max-h-[90vh] overflow-y-auto">
            
            <div className="flex justify-between items-start border-b border-[#F1F5F9] pb-3">
              <div>
                <h3 className="text-sm font-bold text-[#0F172A]">Manual Eligibility Override Panel</h3>
                <p className="text-[11px] text-[#64748B] mt-0.5">
                  Application: {selectedAppForOverride.internshipTitle} &bull; Student: {selectedAppForOverride.studentName}
                </p>
              </div>
              <button
                onClick={() => setSelectedAppForOverride(null)}
                className="text-[#94A3B8] hover:text-[#0F172A] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Side by Side layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              
              {/* Left Column: Original Eligibility Checklist */}
              <div className="space-y-3">
                <span className="text-[10px] font-bold text-[#475569] uppercase tracking-wider block">
                  Original Verification Snapshot
                </span>
                <div className="border border-[#E2E8F0] rounded-lg p-4 bg-[#F8FAFC]">
                  <EligibilityBreakdown eligibility={selectedAppForOverride.eligibilitySnapshot} />
                </div>
              </div>

              {/* Right Column: Override Form */}
              <div className="space-y-4">
                <span className="text-[10px] font-bold text-[#475569] uppercase tracking-wider block">
                  Override Decision Settings
                </span>
                
                <form onSubmit={handleOverrideSubmit} className="space-y-4 border border-[#E2E8F0] rounded-lg p-5 bg-white">
                  {/* Select eligibility */}
                  <div>
                    <label className="block text-xs font-bold text-[#475569] uppercase tracking-wider mb-2">Override Status</label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                        <input
                          type="radio"
                          name="override_eligibility"
                          checked={overrideEligible === true}
                          onChange={() => setOverrideEligible(true)}
                          className="w-4 h-4 accent-[#5B21B6]"
                        />
                        <span>Force Eligible (PASS)</span>
                      </label>
                      <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                        <input
                          type="radio"
                          name="override_eligibility"
                          checked={overrideEligible === false}
                          onChange={() => setOverrideEligible(false)}
                          className="w-4 h-4 accent-[#5B21B6]"
                        />
                        <span>Force Ineligible (FAIL)</span>
                      </label>
                    </div>
                  </div>

                  {/* Override Reason */}
                  <div>
                    <label className="block text-xs font-bold text-[#475569] uppercase tracking-wider mb-2">Reason for Override</label>
                    <textarea
                      required
                      value={overrideReason}
                      onChange={(e) => setOverrideReason(e.target.value)}
                      placeholder="Explain the reason for this administrative override (e.g. verified CGPA correction, backlog cleared, special exception approval)..."
                      className="w-full text-xs p-3 border border-[#E2E8F0] bg-[#F8FAFC] rounded-md focus:outline-none focus:border-[#5B21B6] focus:bg-white min-h-[100px]"
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex justify-end gap-2 border-t border-[#F1F5F9] pt-3">
                    <button
                      type="button"
                      onClick={() => setSelectedAppForOverride(null)}
                      className="px-3 py-1.5 border border-[#E2E8F0] bg-white hover:bg-[#F8FAFC] text-xs font-bold rounded cursor-pointer transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={overrideEligibilityMutation.isPending}
                      className="px-3 py-1.5 bg-[#5B21B6] hover:bg-[#4C1D95] text-white text-xs font-bold rounded shadow cursor-pointer transition-colors"
                    >
                      Save Override
                    </button>
                  </div>
                </form>
              </div>

            </div>

          </div>
        </div>
      )}

    </RoleShell>
  );
}
