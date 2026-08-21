'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { Role, ApplicationStatus, OffCampusVerificationStatus, StudentProfile } from '@/lib/types';
import RoleShell from '@/components/shared/RoleShell';
import WhatsNextPanel from '@/components/shared/WhatsNextPanel';
import {
  Calendar,
  Users,
  Award,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Building2,
  ExternalLink,
  PlusCircle,
  Edit3,
  Clock,
  Briefcase,
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

export default function StudentDashboard() {
  const queryClient = useQueryClient();
  const [selectedInternship, setSelectedInternship] = useState<any | null>(null);
  const [isOffCampusModalOpen, setIsOffCampusModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  // Off-campus form state
  const [offCampusForm, setOffCampusForm] = useState({
    companyName: '',
    title: '',
    description: '',
    duration: '3 months',
    mode: 'remote',
    stipend: 0,
    evidenceUrl: '',
  });

  // Profile edit form state
  const [profileForm, setProfileForm] = useState<{
    skills: string;
    certifications: string;
    resumeUrl: string;
  }>({
    skills: '',
    certifications: '',
    resumeUrl: '',
  });

  // 1. Fetch Student Profile
  const { data: profileRes, isLoading: isProfileLoading } = useQuery({
    queryKey: ['student-profile'],
    queryFn: () => apiClient.student.getProfile(),
  });

  // 2. Fetch Available Internships
  const { data: internshipsRes, isLoading: isInternshipsLoading } = useQuery({
    queryKey: ['internships'],
    queryFn: () => apiClient.student.getInternships(),
  });

  // 3. Fetch Applications
  const { data: applicationsRes, isLoading: isApplicationsLoading } = useQuery({
    queryKey: ['student-applications'],
    queryFn: () => apiClient.student.getApplications(),
  });

  // 4. Fetch Student Off-Campus Opportunities
  const { data: offCampusRes, isLoading: isOffCampusLoading } = useQuery({
    queryKey: ['student-offcampus'],
    queryFn: () => apiClient.student.getOffCampusOpportunities(),
  });

  // Apply mutation for campus internships
  const applyMutation = useMutation({
    mutationFn: (internshipId: string) => apiClient.student.applyToInternship({ internshipId }),
    onSuccess: (res) => {
      if (res.success) {
        queryClient.invalidateQueries({ queryKey: ['student-applications'] });
        queryClient.invalidateQueries({ queryKey: ['internships'] });
        toast.success('Application submitted successfully!');
        setSelectedInternship(null);
      } else {
        toast.error(`Failed to apply: ${res.error?.message || 'Unknown error'}`);
      }
    },
  });

  // Off-Campus registration mutation
  const offCampusMutation = useMutation({
    mutationFn: (payload: typeof offCampusForm) =>
      apiClient.student.submitOffCampusOpportunity({
        companyName: payload.companyName.trim(),
        title: payload.title.trim(),
        description: payload.description.trim(),
        duration: payload.duration.trim(),
        mode: payload.mode,
        stipend: Number(payload.stipend) || 0,
        evidenceUrl: payload.evidenceUrl ? payload.evidenceUrl.trim() : undefined,
      }),
    onSuccess: (res) => {
      if (res.success) {
        queryClient.invalidateQueries({ queryKey: ['student-offcampus'] });
        toast.success('Off-campus opportunity registered! Awaiting T&P verification.');
        setIsOffCampusModalOpen(false);
        setOffCampusForm({
          companyName: '',
          title: '',
          description: '',
          duration: '3 months',
          mode: 'remote',
          stipend: 0,
          evidenceUrl: '',
        });
      } else {
        toast.error(`Registration failed: ${res.error?.message || 'Unknown error'}`);
      }
    },
  });

  // Profile update mutation
  const profileMutation = useMutation({
    mutationFn: (payload: { skills: string[]; certifications: string[]; resumeUrl?: string }) =>
      apiClient.student.updateProfile(payload),
    onSuccess: (res) => {
      if (res.success) {
        queryClient.invalidateQueries({ queryKey: ['student-profile'] });
        toast.success('Profile updated successfully!');
        setIsProfileModalOpen(false);
      } else {
        toast.error(`Failed to update profile: ${res.error?.message || 'Unknown error'}`);
      }
    },
  });

  const isLoading = isProfileLoading || isInternshipsLoading || isApplicationsLoading || isOffCampusLoading;

  if (isLoading) {
    return (
      <RoleShell role={Role.STUDENT}>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-sm font-semibold text-[#64748B] animate-pulse">
            Loading student dashboard...
          </div>
        </div>
      </RoleShell>
    );
  }

  const profile = profileRes?.data;
  const internships = internshipsRes?.data || [];
  const applications = applicationsRes?.data || [];
  const offCampusOpportunities = offCampusRes?.data || [];

  // Determine what status instruction to pass to WhatsNextPanel
  let studentStatus: 'offered' | 'inProgress' | undefined = undefined;
  if (applications.some((a) => a.currentStatus === ApplicationStatus.OFFERED)) {
    studentStatus = 'offered';
  } else if (applications.some((a) => a.currentStatus === ApplicationStatus.IN_PROGRESS)) {
    studentStatus = 'inProgress';
  }

  const openInternships = internships.filter((i) => i.status === 'open');

  const checkEligibility = (internship: any) => {
    if (internship.eligibility?.checks && internship.eligibility.checks.length > 0) {
      return {
        eligible: !!internship.eligibility.eligible,
        checks: internship.eligibility.checks.map((c: any) => ({
          criterion: c.criterion,
          passed: c.pass !== undefined ? c.pass : c.passed !== undefined ? c.passed : true,
          message: c.reason || c.message || `${c.criterion}: ${c.pass ? 'Passed' : 'Not met'}`,
        })),
      };
    }
    if (internship.eligibility?.eligible !== undefined) {
      return {
        eligible: !!internship.eligibility.eligible,
        checks: [],
      };
    }
    if (!profile) return { eligible: false, checks: [] };

    const cgpaPassed = (profile.cgpa ?? 0) >= (internship.criteria?.minCgpa ?? 0);
    const backlogs = profile.activeBacklogs ?? profile.backlogs ?? 0;
    const backlogPassed = backlogs <= (internship.criteria?.maxBacklogs ?? 0);
    const depts = Array.isArray(internship.criteria?.departments)
      ? internship.criteria.departments
      : internship.criteria?.department
      ? [internship.criteria.department]
      : [];
    const deptPassed = depts.length === 0 || depts.includes(profile.department);

    const requiredSkills = internship.criteria?.requiredSkills ?? [];
    const studentSkills = profile.skills ?? [];
    const missingSkills = requiredSkills.filter((s: string) => !studentSkills.includes(s));
    const skillsPassed = missingSkills.length === 0;

    const checks = [
      {
        criterion: 'CGPA Requirement',
        passed: cgpaPassed,
        message: `CGPA is ${(profile.cgpa ?? 0).toFixed(2)} (required >= ${internship.criteria?.minCgpa ?? 0})`,
      },
      {
        criterion: 'Backlog Check',
        passed: backlogPassed,
        message: `Backlogs count is ${backlogs} (limit <= ${internship.criteria?.maxBacklogs ?? 0})`,
      },
      {
        criterion: 'Department Alignment',
        passed: deptPassed,
        message: `Department is ${profile.department}`,
      },
      {
        criterion: 'Skills Criteria',
        passed: skillsPassed,
        message: skillsPassed
          ? `All skills matched: ${requiredSkills.join(', ')}`
          : `Missing skills: ${missingSkills.join(', ')}`,
      },
    ];

    const eligible = cgpaPassed && backlogPassed && deptPassed && skillsPassed;
    return { eligible, checks };
  };

  const handleOpenProfileModal = () => {
    if (profile) {
      setProfileForm({
        skills: (profile.skills || []).join(', '),
        certifications: (profile.certifications || []).join(', '),
        resumeUrl: profile.resumeUrl || '',
      });
    }
    setIsProfileModalOpen(true);
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const skillsArray = profileForm.skills
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const certsArray = profileForm.certifications
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean);

    profileMutation.mutate({
      skills: skillsArray,
      certifications: certsArray,
      resumeUrl: profileForm.resumeUrl.trim() || undefined,
    });
  };

  const handleRegisterOffCampus = (e: React.FormEvent) => {
    e.preventDefault();
    if (!offCampusForm.companyName.trim() || !offCampusForm.title.trim() || !offCampusForm.description.trim()) {
      toast.error('Please fill in all mandatory fields.');
      return;
    }
    offCampusMutation.mutate(offCampusForm);
  };

  return (
    <RoleShell role={Role.STUDENT}>
      <Toaster position="top-center" reverseOrder={false} />
      <div className="space-y-8">
        {/* Header Block */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-xl font-bold text-[#0F172A]">Welcome back, {profile?.name || 'Student'}!</h2>
            <p className="text-xs text-[#64748B] mt-0.5">
              Monitor your eligibility status, track applications, and register secured off-campus opportunities.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleOpenProfileModal}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-[#E2E8F0] hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-lg transition-colors cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5 text-violet-600" />
              Edit Profile
            </button>
            <button
              onClick={() => setIsOffCampusModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-violet-600 to-sky-600 hover:from-violet-500 hover:to-sky-500 text-white text-xs font-bold rounded-lg shadow-sm transition-all cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              Register Off-Campus
            </button>
          </div>
        </div>

        {/* Action Alerts Block */}
        <WhatsNextPanel role={Role.STUDENT} studentStatus={studentStatus} />

        {/* Profile Snapshot Stats */}
        <section className="bg-white border border-[#E2E8F0] rounded-xl p-5 flex flex-wrap justify-between items-center gap-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-[#EDE9FE] text-[#5B21B6] flex items-center justify-center font-bold text-sm">
              {(profile?.cgpa || 0).toFixed(2)}
            </div>
            <div>
              <span className="text-[10px] text-[#94A3B8] uppercase font-bold tracking-wider">Academic Record</span>
              <p className="text-xs text-[#334155] font-semibold mt-0.5">
                {profile?.department} &bull; Year {profile?.year}
              </p>
            </div>
          </div>
          <div className="flex gap-6">
            <div className="text-center md:text-left">
              <span className="text-[10px] text-[#94A3B8] uppercase font-bold tracking-wider block">Active Applications</span>
              <span className="text-sm font-bold text-[#0F172A] mt-0.5 block">{applications.length} submitted</span>
            </div>
            <div className="text-center md:text-left border-l border-[#E2E8F0] pl-6">
              <span className="text-[10px] text-[#94A3B8] uppercase font-bold tracking-wider block">Active Backlogs</span>
              <span className={`text-sm font-bold mt-0.5 block ${profile?.activeBacklogs || profile?.backlogs ? 'text-[#DC2626]' : 'text-[#16A34A]'}`}>
                {profile?.activeBacklogs ?? profile?.backlogs ?? 0} active
              </span>
            </div>
            <div className="text-center md:text-left border-l border-[#E2E8F0] pl-6">
              <span className="text-[10px] text-[#94A3B8] uppercase font-bold tracking-wider block">Skills & Certs</span>
              <span className="text-sm font-bold text-[#5B21B6] mt-0.5 block">
                {(profile?.skills || []).length} skills &bull; {(profile?.certifications || []).length} certs
              </span>
            </div>
          </div>
        </section>

        {/* Off-Campus Registered Opportunities Section */}
        {offCampusOpportunities.length > 0 && (
          <section className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-[#475569] uppercase tracking-wider flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-violet-600" />
                My Off-Campus Registrations ({offCampusOpportunities.length})
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {offCampusOpportunities.map((item: any) => {
                const status = item.offCampusVerification?.status || 'pendingVerification';
                const isVerified = status === OffCampusVerificationStatus.VERIFIED || status === 'verified';
                const isRejected = status === OffCampusVerificationStatus.REJECTED || status === 'rejected';

                return (
                  <div key={item.id || item._id} className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-sm space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                          {item.externalCompanyName}
                        </span>
                        <h4 className="text-sm font-bold text-slate-900 mt-0.5">{item.title}</h4>
                      </div>
                      <div>
                        {isVerified && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" /> Verified by T&P
                          </span>
                        )}
                        {isRejected && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                            <XCircle className="w-3 h-3" /> Rejected
                          </span>
                        )}
                        {!isVerified && !isRejected && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock className="w-3 h-3" /> Awaiting T&P Review
                          </span>
                        )}
                      </div>
                    </div>

                    <p className="text-xs text-slate-600 line-clamp-2">{item.description}</p>

                    <div className="flex items-center gap-4 text-[11px] text-slate-500 pt-2 border-t border-slate-100">
                      <span>Duration: {item.duration}</span>
                      <span>Mode: {item.mode}</span>
                      {item.stipend ? <span>Stipend: ₹{item.stipend}/mo</span> : null}
                    </div>

                    {isRejected && (item.offCampusVerification?.rejectionReason || item.offCampusVerification?.rejectReason) && (
                      <div className="bg-rose-50 border border-rose-100 rounded-lg p-2 text-[11px] text-rose-700 font-medium">
                        <strong>Reason:</strong> {item.offCampusVerification.rejectionReason || item.offCampusVerification.rejectReason}
                      </div>
                    )}

                    {isVerified && item.application && (
                      <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-2 text-[11px] text-emerald-800 font-medium flex justify-between items-center">
                        <span>Application Status: <strong>{item.application.currentStatus}</strong></span>
                        {item.application.ppoOffered && <span className="font-bold text-amber-600">PPO Offered</span>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Campus Internships List */}
        <section className="space-y-4">
          <h3 className="text-sm font-bold text-[#475569] uppercase tracking-wider">Available Campus Internships</h3>
          {openInternships.length === 0 ? (
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-10 text-center text-xs text-[#64748B] shadow-sm">
              No active campus internship postings available at this time. Check back later.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {openInternships.map((internship) => {
                const { eligible } = checkEligibility(internship);
                const hasApplied = applications.some((a) => (a.internshipId?._id || a.internshipId?.id || a.internshipId) === internship.id);

                return (
                  <div
                    key={internship.id}
                    className="bg-white border border-[#E2E8F0] rounded-xl p-5 flex flex-col justify-between gap-4 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden"
                  >
                    <div>
                      {/* Top Row with Company & Eligibility Badge */}
                      <div className="flex justify-between items-start gap-4">
                        <div>
                          <span className="text-[10px] text-[#94A3B8] font-bold uppercase tracking-wide">
                            {internship.companyName || 'Company'}
                          </span>
                          <h4 className="text-sm font-bold text-[#0F172A] mt-0.5">{internship.title}</h4>
                        </div>
                        <div>
                          {eligible ? (
                            <span className="inline-flex px-2 py-0.5 text-[10px] font-bold rounded bg-[#DCFCE7] text-[#16A34A] border border-[#BBF7D0]">
                              Eligible
                            </span>
                          ) : (
                            <span className="inline-flex px-2 py-0.5 text-[10px] font-bold rounded bg-[#FEE2E2] text-[#DC2626] border border-[#FECACA]">
                              Ineligible
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Internship metrics */}
                      <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-[#F1F5F9]">
                        <div className="flex items-center gap-1 text-[11px] text-[#64748B]">
                          <Users className="w-3.5 h-3.5 text-[#94A3B8] shrink-0" />
                          <span>{internship.vacancies} seats</span>
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-[#64748B]">
                          <Award className="w-3.5 h-3.5 text-[#94A3B8] shrink-0" />
                          <span>Min {internship.criteria?.minCgpa ?? 0} CGPA</span>
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-[#64748B]">
                          <Calendar className="w-3.5 h-3.5 text-[#94A3B8] shrink-0" />
                          <span className="truncate">{internship.duration || '3 mo'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Actions block */}
                    <div className="flex items-center justify-between border-t border-[#F1F5F9] pt-3">
                      {hasApplied ? (
                        <span className="text-[11px] text-[#16A34A] font-semibold">&bull; Already Applied</span>
                      ) : (
                        <span className="text-[11px] text-[#64748B]">Mode: {internship.mode || 'Remote'}</span>
                      )}

                      {hasApplied ? (
                        <button
                          disabled
                          className="px-3 py-1.5 bg-[#F1F5F9] text-[#94A3B8] text-xs font-bold rounded-lg cursor-not-allowed border border-[#E2E8F0]"
                        >
                          Applied
                        </button>
                      ) : (
                        <button
                          onClick={() => setSelectedInternship(internship)}
                          className={`px-3 py-1.5 text-xs font-bold rounded-lg border cursor-pointer transition-colors ${
                            eligible
                              ? 'bg-[#5B21B6] hover:bg-[#4C1D95] text-white border-transparent'
                              : 'bg-white hover:bg-slate-50 text-[#DC2626] border-[#FECACA]'
                          }`}
                        >
                          {eligible ? 'Apply Now' : 'Check Eligibility'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Eligibility Checklist Dialog Modal */}
        {selectedInternship && (() => {
          const { eligible, checks } = checkEligibility(selectedInternship);
          return (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white border border-[#E2E8F0] w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
                <div className="px-6 py-4 border-b border-[#E2E8F0] flex justify-between items-center bg-[#F8FAFC]">
                  <div>
                    <h3 className="text-sm font-bold text-[#0F172A]">{selectedInternship.title}</h3>
                    <p className="text-[10px] text-[#64748B] mt-0.5">
                      Verification checklist for {selectedInternship.companyName || 'Campus Partner'}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedInternship(null)}
                    className="text-slate-400 hover:text-slate-600 text-xs font-bold px-2 py-1 rounded hover:bg-[#F1F5F9] cursor-pointer"
                  >
                    Close
                  </button>
                </div>

                <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                  <div className="flex items-center justify-between bg-slate-50 border border-slate-200 p-3 rounded-lg">
                    <span className="text-xs font-semibold text-[#475569]">Overall Status:</span>
                    {eligible ? (
                      <span className="bg-[#DCFCE7] text-[#16A34A] text-[10px] font-bold px-2.5 py-1 rounded border border-[#BBF7D0]">
                        ELIGIBLE
                      </span>
                    ) : (
                      <span className="bg-[#FEE2E2] text-[#DC2626] text-[10px] font-bold px-2.5 py-1 rounded border border-[#FECACA]">
                        NOT ELIGIBLE
                      </span>
                    )}
                  </div>

                  <div className="space-y-3">
                    {checks.map((check: any, index: number) => (
                      <div
                        key={index}
                        className={`flex items-start gap-3 p-3 rounded-lg border ${
                          check.passed ? 'bg-[#F8FAFC] border-[#E2E8F0]' : 'bg-[#FFF5F5] border-[#FEE2E2]'
                        }`}
                      >
                        {check.passed ? (
                          <CheckCircle2 className="w-4 h-4 text-[#16A34A] shrink-0 mt-0.5" />
                        ) : (
                          <XCircle className="w-4 h-4 text-[#DC2626] shrink-0 mt-0.5" />
                        )}
                        <div>
                          <p className="text-xs font-bold text-[#334155]">{check.criterion}</p>
                          <p
                            className={`text-[11px] mt-0.5 ${
                              check.passed ? 'text-[#64748B]' : 'text-[#B91C1C] font-medium'
                            }`}
                          >
                            {check.message}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {!eligible && (
                    <div className="p-3 bg-[#FEF3C7] border border-[#FDE68A] rounded-lg flex gap-2">
                      <AlertTriangle className="w-4 h-4 text-[#D97706] shrink-0 mt-0.5" />
                      <p className="text-[11px] text-[#B45309] leading-relaxed">
                        <strong>Ineligible:</strong> You cannot apply to this role because you do not meet the minimum criteria checks. Contact the T&P officer if you require a waiver override.
                      </p>
                    </div>
                  )}
                </div>

                <div className="px-6 py-4 border-t border-[#E2E8F0] flex justify-end gap-3 bg-[#F8FAFC]">
                  <button
                    onClick={() => setSelectedInternship(null)}
                    className="px-4 py-2 border border-[#E2E8F0] hover:bg-slate-50 text-slate-600 font-bold rounded-lg text-xs cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={!eligible || applyMutation.isPending}
                    onClick={() => applyMutation.mutate(selectedInternship.id)}
                    className={`px-4 py-2 text-xs font-bold rounded-lg shadow cursor-pointer transition-colors ${
                      eligible
                        ? 'bg-[#5B21B6] hover:bg-[#4C1D95] text-white disabled:bg-[#C084FC]'
                        : 'bg-[#E2E8F0] text-[#94A3B8] border border-[#CBD5E1] cursor-not-allowed shadow-none'
                    }`}
                  >
                    {applyMutation.isPending ? 'Submitting...' : 'Submit Application'}
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Off-Campus Registration Modal */}
        {isOffCampusModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white border border-[#E2E8F0] w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
              <div className="px-6 py-4 border-b border-[#E2E8F0] flex justify-between items-center bg-[#F8FAFC]">
                <div>
                  <h3 className="text-sm font-bold text-[#0F172A]">Register Off-Campus Internship</h3>
                  <p className="text-[10px] text-[#64748B] mt-0.5">
                    Submit external offer details for institutional credit and T&P approval.
                  </p>
                </div>
                <button
                  onClick={() => setIsOffCampusModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 text-xs font-bold px-2 py-1 rounded hover:bg-[#F1F5F9] cursor-pointer"
                >
                  Close
                </button>
              </div>

              <form onSubmit={handleRegisterOffCampus}>
                <div className="p-6 space-y-4 max-h-[65vh] overflow-y-auto">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Company Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Google India, Infosys, Startup Inc."
                      value={offCampusForm.companyName}
                      onChange={(e) => setOffCampusForm({ ...offCampusForm, companyName: e.target.value })}
                      className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Internship Role / Title *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Backend Engineering Intern"
                      value={offCampusForm.title}
                      onChange={(e) => setOffCampusForm({ ...offCampusForm, title: e.target.value })}
                      className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Job Description & Responsibilities *</label>
                    <textarea
                      required
                      rows={3}
                      placeholder="Describe the tasks, technologies, and project scope..."
                      value={offCampusForm.description}
                      onChange={(e) => setOffCampusForm({ ...offCampusForm, description: e.target.value })}
                      className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">Duration *</label>
                      <select
                        value={offCampusForm.duration}
                        onChange={(e) => setOffCampusForm({ ...offCampusForm, duration: e.target.value })}
                        className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500"
                      >
                        <option value="1 month">1 month</option>
                        <option value="2 months">2 months</option>
                        <option value="3 months">3 months</option>
                        <option value="6 months">6 months</option>
                        <option value="12 months">12 months</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700">Work Mode *</label>
                      <select
                        value={offCampusForm.mode}
                        onChange={(e) => setOffCampusForm({ ...offCampusForm, mode: e.target.value })}
                        className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500"
                      >
                        <option value="remote">Remote</option>
                        <option value="onsite">On-Site</option>
                        <option value="hybrid">Hybrid</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">Monthly Stipend (₹)</label>
                      <input
                        type="number"
                        min="0"
                        placeholder="e.g. 25000"
                        value={offCampusForm.stipend}
                        onChange={(e) => setOffCampusForm({ ...offCampusForm, stipend: Number(e.target.value) })}
                        className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700">Offer Letter / Evidence URL</label>
                      <input
                        type="url"
                        placeholder="https://drive.google.com/..."
                        value={offCampusForm.evidenceUrl}
                        onChange={(e) => setOffCampusForm({ ...offCampusForm, evidenceUrl: e.target.value })}
                        className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="px-6 py-4 border-t border-[#E2E8F0] flex justify-end gap-3 bg-[#F8FAFC]">
                  <button
                    type="button"
                    onClick={() => setIsOffCampusModalOpen(false)}
                    className="px-4 py-2 border border-[#E2E8F0] hover:bg-slate-50 text-slate-600 font-bold rounded-lg text-xs cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={offCampusMutation.isPending}
                    className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-lg text-xs shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    {offCampusMutation.isPending ? 'Registering...' : 'Register Opportunity'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Profile Edit Modal */}
        {isProfileModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white border border-[#E2E8F0] w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
              <div className="px-6 py-4 border-b border-[#E2E8F0] flex justify-between items-center bg-[#F8FAFC]">
                <div>
                  <h3 className="text-sm font-bold text-[#0F172A]">Edit Student Profile</h3>
                  <p className="text-[10px] text-[#64748B] mt-0.5">
                    Update your technical skills, professional certifications, and resume link.
                  </p>
                </div>
                <button
                  onClick={() => setIsProfileModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 text-xs font-bold px-2 py-1 rounded hover:bg-[#F1F5F9] cursor-pointer"
                >
                  Close
                </button>
              </div>

              <form onSubmit={handleSaveProfile}>
                <div className="p-6 space-y-4 max-h-[65vh] overflow-y-auto">
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 space-y-1">
                    <p className="font-semibold text-slate-800">Academic Snapshot (Institutional Authority)</p>
                    <p className="text-[11px] text-slate-500">
                      Department: <strong>{profile?.department}</strong> &bull; Year: <strong>{profile?.year}</strong> &bull; CGPA: <strong>{(profile?.cgpa || 0).toFixed(2)}</strong>
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Skills (Comma-separated)</label>
                    <input
                      type="text"
                      placeholder="React, TypeScript, Node.js, Python, MongoDB"
                      value={profileForm.skills}
                      onChange={(e) => setProfileForm({ ...profileForm, skills: e.target.value })}
                      className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">These skills are matched live against internship eligibility requirements.</p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Certifications (Comma-separated)</label>
                    <input
                      type="text"
                      placeholder="AWS Cloud Practitioner, Certified Kubernetes App Developer"
                      value={profileForm.certifications}
                      onChange={(e) => setProfileForm({ ...profileForm, certifications: e.target.value })}
                      className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Resume / Portfolio URL</label>
                    <input
                      type="url"
                      placeholder="https://drive.google.com/... or https://github.com/..."
                      value={profileForm.resumeUrl}
                      onChange={(e) => setProfileForm({ ...profileForm, resumeUrl: e.target.value })}
                      className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500"
                    />
                  </div>
                </div>

                <div className="px-6 py-4 border-t border-[#E2E8F0] flex justify-end gap-3 bg-[#F8FAFC]">
                  <button
                    type="button"
                    onClick={() => setIsProfileModalOpen(false)}
                    className="px-4 py-2 border border-[#E2E8F0] hover:bg-slate-50 text-slate-600 font-bold rounded-lg text-xs cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={profileMutation.isPending}
                    className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-lg text-xs shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    {profileMutation.isPending ? 'Saving...' : 'Save Changes'}
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
