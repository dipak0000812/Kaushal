'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { Role, ApplicationStatus } from '@/lib/types';
import RoleShell from '@/components/shared/RoleShell';
import WhatsNextPanel from '@/components/shared/WhatsNextPanel';
import { Calendar, Users, Award, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

export default function StudentDashboard() {
  const queryClient = useQueryClient();
  const [selectedInternship, setSelectedInternship] = useState<any | null>(null);

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

  // Apply mutation
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

  const isLoading = isProfileLoading || isInternshipsLoading || isApplicationsLoading;

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

  // Determine what status instruction to pass to WhatsNextPanel
  let studentStatus: 'offered' | 'inProgress' | undefined = undefined;
  if (applications.some(a => a.currentStatus === ApplicationStatus.OFFERED)) {
    studentStatus = 'offered';
  } else if (applications.some(a => a.currentStatus === ApplicationStatus.IN_PROGRESS)) {
    studentStatus = 'inProgress';
  }

  const openInternships = internships.filter(i => i.status === 'open');

  const checkEligibility = (internship: any) => {
    if (internship.eligibility?.checks && internship.eligibility.checks.length > 0) {
      return {
        eligible: !!internship.eligibility.eligible,
        checks: internship.eligibility.checks.map((c: any) => ({
          criterion: c.criterion,
          passed: c.pass !== undefined ? c.pass : (c.passed !== undefined ? c.passed : true),
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
      : internship.criteria?.department ? [internship.criteria.department] : [];
    const deptPassed = depts.length === 0 || depts.includes(profile.department);
    
    const requiredSkills = internship.criteria?.requiredSkills ?? [];
    const studentSkills = profile.skills ?? [];
    const missingSkills = requiredSkills.filter(
      (s: string) => !studentSkills.includes(s)
    );
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
      }
    ];

    const eligible = cgpaPassed && backlogPassed && deptPassed && skillsPassed;
    return { eligible, checks };
  };

  return (
    <RoleShell role={Role.STUDENT}>
      <Toaster position="top-center" reverseOrder={false} />
      <div className="space-y-8">
        
        {/* Header Block */}
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-xl font-bold text-[#0F172A]">Welcome back, {profile?.name || 'Student'}!</h2>
            <p className="text-xs text-[#64748B] mt-0.5">
              Monitor your eligibility status and track active internship selections.
            </p>
          </div>
        </div>

        {/* Action Alerts Block */}
        <WhatsNextPanel role={Role.STUDENT} studentStatus={studentStatus} />

        {/* Profile Snapshot Stats */}
        <section className="bg-white border border-[#E2E8F0] rounded-lg p-5 flex flex-wrap justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#EDE9FE] text-[#5B21B6] flex items-center justify-center font-bold text-sm">
              {profile?.cgpa.toFixed(2)}
            </div>
            <div>
              <span className="text-[10px] text-[#94A3B8] uppercase font-bold tracking-wider font-semibold">Academic Record</span>
              <p className="text-xs text-[#334155] font-semibold mt-0.5">
                {profile?.department} &bull; Year {profile?.year}
              </p>
            </div>
          </div>
          <div className="flex gap-6">
            <div className="text-center md:text-left">
              <span className="text-[10px] text-[#94A3B8] uppercase font-bold tracking-wider font-semibold block">Active Applications</span>
              <span className="text-sm font-bold text-[#0F172A] mt-0.5 block">{applications.length} submitted</span>
            </div>
            <div className="text-center md:text-left border-l border-[#E2E8F0] pl-6">
              <span className="text-[10px] text-[#94A3B8] uppercase font-bold tracking-wider font-semibold block">Pending Backlogs</span>
              <span className={`text-sm font-bold mt-0.5 block ${profile?.backlogs ? 'text-[#DC2626]' : 'text-[#16A34A]'}`}>
                {profile?.backlogs || 0} active
              </span>
            </div>
          </div>
        </section>

        {/* Internships List */}
        <section className="space-y-4">
          <h3 className="text-sm font-bold text-[#475569] uppercase tracking-wider">Available Internship Opportunities</h3>
          {openInternships.length === 0 ? (
            <div className="bg-white border border-[#E2E8F0] rounded-lg p-10 text-center text-xs text-[#64748B]">
              No active internship postings available at this time. Check back later.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {openInternships.map((internship) => {
                const { eligible } = checkEligibility(internship);
                const hasApplied = applications.some(a => a.internshipId === internship.id);

                return (
                  <div 
                    key={internship.id} 
                    className="bg-white border border-[#E2E8F0] rounded-lg p-5 flex flex-col justify-between gap-4 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden"
                  >
                    <div>
                      {/* Top Row with Company & Eligibility Badge */}
                      <div className="flex justify-between items-start gap-4">
                        <div>
                          <span className="text-[10px] text-[#94A3B8] font-bold uppercase tracking-wide">
                            {internship.companyName}
                          </span>
                          <h4 className="text-sm font-bold text-[#0F172A] mt-0.5">
                            {internship.title}
                          </h4>
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
                          <span>{internship.vacancies} vacancies</span>
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-[#64748B]">
                          <Award className="w-3.5 h-3.5 text-[#94A3B8] shrink-0" />
                          <span>Min {internship.criteria.minCgpa} CGPA</span>
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-[#64748B]">
                          <Calendar className="w-3.5 h-3.5 text-[#94A3B8] shrink-0" />
                          <span className="truncate">Last date: {internship.lastDate}</span>
                        </div>
                      </div>
                    </div>

                    {/* Actions block */}
                    <div className="flex items-center justify-between border-t border-[#F1F5F9] pt-3">
                      {hasApplied ? (
                        <span className="text-[11px] text-[#16A34A] font-semibold">
                          &bull; Already Applied
                        </span>
                      ) : (
                        <span className="text-[11px] text-[#64748B]">
                          Requires {internship.criteria.department} department
                        </span>
                      )}
                      
                      {hasApplied ? (
                        <button
                          disabled
                          className="px-3 py-1.5 bg-[#F1F5F9] text-[#94A3B8] text-xs font-bold rounded cursor-not-allowed border border-[#E2E8F0]"
                        >
                          Applied
                        </button>
                      ) : (
                        <button
                          onClick={() => setSelectedInternship(internship)}
                          className={`px-3 py-1.5 text-xs font-bold rounded border cursor-pointer transition-colors ${
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
              <div className="bg-white border border-[#E2E8F0] w-full max-w-lg rounded-xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
                <div className="px-6 py-4 border-b border-[#E2E8F0] flex justify-between items-center bg-[#F8FAFC]">
                  <div>
                    <h3 className="text-sm font-bold text-[#0F172A]">{selectedInternship.title}</h3>
                    <p className="text-[10px] text-[#64748B] mt-0.5">Verification checklist for {selectedInternship.companyName}</p>
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
                          <p className={`text-[11px] mt-0.5 ${check.passed ? 'text-[#64748B]' : 'text-[#B91C1C] font-medium'}`}>
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

      </div>
    </RoleShell>
  );
}
