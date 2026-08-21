'use client';

import React, { useState } from 'react';
import { Role, ApplicationStatus, AssignmentStatus } from '@/lib/types';
import RoleShell from '@/components/shared/RoleShell';
import StatusStepper from '@/components/shared/StatusStepper';
import RiskBadge from '@/components/shared/RiskBadge';
import EligibilityBreakdown from '@/components/shared/EligibilityBreakdown';
import AssignmentQueueCard from '@/components/shared/AssignmentQueueCard';
import WhatsNextPanel from '@/components/shared/WhatsNextPanel';
import StatCard from '@/components/shared/StatCard';
import EvidenceCard from '@/components/shared/EvidenceCard';
import ApprovalButtons from '@/components/shared/ApprovalButtons';
import ChartWrapper from '@/components/shared/ChartWrapper';
import { Users, FileCheck2, ShieldAlert } from 'lucide-react';

export default function DevComponentsPage() {
  const [selectedShellRole, setSelectedShellRole] = useState<Role>(Role.TNP);

  // Mock data for StatusStepper
  const activeTimeline = [
    { fromStatus: null, toStatus: ApplicationStatus.APPLIED, actorId: 'student-1', actorRole: Role.STUDENT, at: '2026-08-16T10:00:00Z' },
    { fromStatus: ApplicationStatus.APPLIED, toStatus: ApplicationStatus.SHORTLISTED, actorId: 'company-1', actorRole: Role.COMPANY, at: '2026-08-17T11:00:00Z' },
    { fromStatus: ApplicationStatus.SHORTLISTED, toStatus: ApplicationStatus.OFFERED, actorId: 'company-1', actorRole: Role.COMPANY, at: '2026-08-18T14:30:00Z' },
    { fromStatus: ApplicationStatus.OFFERED, toStatus: ApplicationStatus.ACCEPTED, actorId: 'student-1', actorRole: Role.STUDENT, at: '2026-08-19T09:00:00Z' },
    { fromStatus: ApplicationStatus.ACCEPTED, toStatus: ApplicationStatus.TNP_VERIFIED, actorId: 'tnp-1', actorRole: Role.TNP, at: '2026-08-19T10:15:00Z' },
    { fromStatus: ApplicationStatus.TNP_VERIFIED, toStatus: ApplicationStatus.MENTOR_PENDING, actorId: 'tnp-1', actorRole: Role.TNP, at: '2026-08-20T08:00:00Z' },
    { fromStatus: ApplicationStatus.MENTOR_PENDING, toStatus: ApplicationStatus.MENTOR_ASSIGNED, actorId: 'faculty-1', actorRole: Role.FACULTY, at: '2026-08-20T11:00:00Z' },
  ];

  const successTimeline = [
    ...activeTimeline,
    { fromStatus: ApplicationStatus.MENTOR_ASSIGNED, toStatus: ApplicationStatus.IN_PROGRESS, actorId: 'student-1', actorRole: Role.STUDENT, at: '2026-08-21T09:00:00Z' },
    { fromStatus: ApplicationStatus.IN_PROGRESS, toStatus: ApplicationStatus.COMPLETED, actorId: 'tnp-1', actorRole: Role.TNP, at: '2026-08-28T17:00:00Z' },
  ];

  const terminalNegativeTimeline = [
    { fromStatus: null, toStatus: ApplicationStatus.APPLIED, actorId: 'student-1', actorRole: Role.STUDENT, at: '2026-08-16T10:00:00Z' },
    { fromStatus: ApplicationStatus.APPLIED, toStatus: ApplicationStatus.SHORTLISTED, actorId: 'company-1', actorRole: Role.COMPANY, at: '2026-08-17T11:00:00Z' },
    { fromStatus: ApplicationStatus.SHORTLISTED, toStatus: ApplicationStatus.OFFERED, actorId: 'company-1', actorRole: Role.COMPANY, at: '2026-08-18T14:30:00Z' },
    { fromStatus: ApplicationStatus.OFFERED, toStatus: ApplicationStatus.WITHDRAWN, actorId: 'student-1', actorRole: Role.STUDENT, reason: 'Declined in favor of a higher stipend offer', at: '2026-08-18T16:00:00Z' },
  ];

  const cancelledTimeline = [
    { fromStatus: null, toStatus: ApplicationStatus.APPLIED, actorId: 'student-1', actorRole: Role.STUDENT, at: '2026-08-16T10:00:00Z' },
    { fromStatus: ApplicationStatus.APPLIED, toStatus: ApplicationStatus.SHORTLISTED, actorId: 'company-1', actorRole: Role.COMPANY, at: '2026-08-17T11:00:00Z' },
    { fromStatus: ApplicationStatus.SHORTLISTED, toStatus: ApplicationStatus.OFFERED, actorId: 'company-1', actorRole: Role.COMPANY, at: '2026-08-18T14:30:00Z' },
    { fromStatus: ApplicationStatus.OFFERED, toStatus: ApplicationStatus.ACCEPTED, actorId: 'student-1', actorRole: Role.STUDENT, at: '2026-08-19T09:00:00Z' },
    { fromStatus: ApplicationStatus.ACCEPTED, toStatus: ApplicationStatus.TNP_VERIFIED, actorId: 'tnp-1', actorRole: Role.TNP, at: '2026-08-19T10:15:00Z' },
    { fromStatus: ApplicationStatus.TNP_VERIFIED, toStatus: ApplicationStatus.MENTOR_PENDING, actorId: 'tnp-1', actorRole: Role.TNP, at: '2026-08-20T08:00:00Z' },
    { fromStatus: ApplicationStatus.MENTOR_PENDING, toStatus: ApplicationStatus.MENTOR_ASSIGNED, actorId: 'faculty-1', actorRole: Role.FACULTY, at: '2026-08-20T11:00:00Z' },
    { fromStatus: ApplicationStatus.MENTOR_ASSIGNED, toStatus: ApplicationStatus.CANCELLED, actorId: 'tnp-1', actorRole: Role.TNP, reason: 'Student took semester off', at: '2026-08-20T12:00:00Z' },
  ];

  // Mock data for EligibilityBreakdown
  const mockEligibilitySnapshot = {
    eligible: false,
    checks: [
      { criterion: 'minCgpa', passed: true, message: 'CGPA is 8.7 (required >= 7.5)', value: 8.7, required: 7.5 },
      { criterion: 'maxBacklogs', passed: true, message: 'Backlogs count is 0 (required <= 1)', value: 0, required: 1 },
      { criterion: 'department', passed: false, message: 'Department mismatch: Student is CS, required IT', value: 'Computer Science', required: 'Information Technology' },
      { criterion: 'year', passed: true, message: 'Academic year matches: 4', value: 4, required: 4 },
      { criterion: 'requiredSkills', passed: false, message: 'Missing required skills: Java, Spring Boot', value: ['React', 'TypeScript'], required: ['Java', 'Spring Boot'] },
      { criterion: 'requiredCerts', passed: true, message: 'No required certifications', value: [], required: [] },
    ],
    computedAt: '2026-08-20T10:00:00Z',
  };

  // Mock data for RiskBadge
  const mockDismissal = {
    applicationId: 'app-4',
    dismissedBy: 'user-faculty-1',
    dismissedAt: '2026-08-19T09:30:00Z',
    note: 'Student was sick and had informed beforehand. Will submit logs next week.',
  };

  // Mock data for ChartWrapper
  const skillGapData = [
    { skill: 'React', demand: 25, supply: 14 },
    { skill: 'Node.js', demand: 20, supply: 8 },
    { skill: 'TypeScript', demand: 18, supply: 12 },
    { skill: 'Java', demand: 15, supply: 17 },
    { skill: 'Python', demand: 10, supply: 15 },
  ];

  const trendData = [
    { name: 'Mon', riskCount: 1 },
    { name: 'Tue', riskCount: 3 },
    { name: 'Wed', riskCount: 2 },
    { name: 'Thu', riskCount: 4 },
    { name: 'Fri', riskCount: 2 },
  ];

  const handleActionApprove = () => alert('Approve trigger activated');
  const handleActionReject = (reason: string) => alert(`Reject trigger activated with reason: "${reason}"`);

  return (
    <RoleShell role={selectedShellRole}>
      <div className="space-y-10 pb-20">
        
        {/* Sandbox Controls */}
        <section className="bg-white border border-[#E2E8F0] rounded-lg p-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-[#0F172A]">Kaushal Component Sandbox</h2>
              <p className="text-xs text-[#64748B] mt-0.5">
                Interact with the component states and switch roles to verify navigation layouts.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-[#475569]">Switch Shell Role:</label>
              <select 
                value={selectedShellRole} 
                onChange={(e) => setSelectedShellRole(e.target.value as Role)}
                className="text-xs p-2 border border-[#E2E8F0] bg-white rounded-md font-semibold text-[#5B21B6] focus:outline-none focus:border-[#5B21B6]"
              >
                <option value={Role.TNP}>T&P Cell (tnp)</option>
                <option value={Role.STUDENT}>Student (student)</option>
                <option value={Role.FACULTY}>Faculty Mentor (faculty)</option>
                <option value={Role.COMPANY}>Company (company)</option>
                <option value={Role.HOD}>HOD (hod)</option>
              </select>
            </div>
          </div>
        </section>

        {/* 1. Stat Cards Grid */}
        <section className="space-y-4">
          <h3 className="text-sm font-bold text-[#475569] uppercase tracking-wider">1. StatCard Examples</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatCard 
              title="Verified Companies" 
              value={14} 
              description="+2 onboarded this week"
              icon={<Users className="w-5 h-5" />} 
            />
            <StatCard 
              title="Offer Verification Rate" 
              value="92.4%" 
              description="Target is 95% minimum"
              icon={<FileCheck2 className="w-5 h-5" />} 
            />
            <StatCard 
              title="Active At-Risk Interns" 
              value={3} 
              description="Needs mentor review"
              icon={<ShieldAlert className="w-5 h-5 text-[#B91C1C]" />} 
            />
          </div>
        </section>

        {/* 2. WhatsNextPanel Views */}
        <section className="space-y-4">
          <h3 className="text-sm font-bold text-[#475569] uppercase tracking-wider">2. WhatsNextPanel Views</h3>
          <div className="space-y-4">
            <div>
              <span className="text-xs font-semibold text-[#94A3B8] block mb-1">Student (Action Pending Offer)</span>
              <WhatsNextPanel role={Role.STUDENT} studentStatus="offered" />
            </div>
            <div>
              <span className="text-xs font-semibold text-[#94A3B8] block mb-1">Student (Action Pending Logs)</span>
              <WhatsNextPanel role={Role.STUDENT} studentStatus="inProgress" />
            </div>
            <div>
              <span className="text-xs font-semibold text-[#94A3B8] block mb-1">T&P Officer (Reads Alerts Endpoint)</span>
              <WhatsNextPanel 
                role={Role.TNP} 
                alerts={{
                  pendingVerifications: 4,
                  atRiskCount: 3,
                  zeroEligibleAlerts: 1,
                  unassignedMentorAlerts: 2
                }} 
              />
            </div>
          </div>
        </section>

        {/* 3. StatusStepper Scenarios */}
        <section className="space-y-4">
          <h3 className="text-sm font-bold text-[#475569] uppercase tracking-wider">3. StatusStepper Examples</h3>
          <div className="space-y-6">
            <div>
              <span className="text-xs font-semibold text-[#94A3B8] block mb-2">Scenario A: Main Active Path (Status: mentorAssigned)</span>
              <StatusStepper currentStatus={ApplicationStatus.MENTOR_ASSIGNED} timeline={activeTimeline} />
            </div>
            <div>
              <span className="text-xs font-semibold text-[#94A3B8] block mb-2">Scenario B: Completed Path (Status: completed)</span>
              <StatusStepper currentStatus={ApplicationStatus.COMPLETED} timeline={successTimeline} />
            </div>
            <div>
              <span className="text-xs font-semibold text-[#94A3B8] block mb-2">Scenario C: Branching Terminal Negative (Status: withdrawn)</span>
              <StatusStepper currentStatus={ApplicationStatus.WITHDRAWN} timeline={terminalNegativeTimeline} />
            </div>
            <div>
              <span className="text-xs font-semibold text-[#94A3B8] block mb-2">Scenario D: Branching Terminal Negative (Status: cancelled from mentorAssigned)</span>
              <StatusStepper currentStatus={ApplicationStatus.CANCELLED} timeline={cancelledTimeline} />
            </div>
            <div>
              <span className="text-xs font-semibold text-[#94A3B8] block mb-2">Scenario E: Fallback CANCELLED (Empty Timeline)</span>
              <StatusStepper currentStatus={ApplicationStatus.CANCELLED} timeline={[]} />
            </div>
            <div>
              <span className="text-xs font-semibold text-[#94A3B8] block mb-2">Scenario F: Fallback REJECTED (Empty Timeline)</span>
              <StatusStepper currentStatus={ApplicationStatus.REJECTED} timeline={[]} />
            </div>
            <div>
              <span className="text-xs font-semibold text-[#94A3B8] block mb-2">Scenario G: Fallback WITHDRAWN (Empty Timeline)</span>
              <StatusStepper currentStatus={ApplicationStatus.WITHDRAWN} timeline={[]} />
            </div>
          </div>
        </section>

        {/* 4. RiskBadge Varieties */}
        <section className="space-y-4">
          <h3 className="text-sm font-bold text-[#475569] uppercase tracking-wider">4. RiskBadge Variations</h3>
          <div className="bg-white border border-[#E2E8F0] rounded-lg p-6 flex flex-wrap gap-6 items-center">
            <div className="flex flex-col gap-1 items-center">
              <span className="text-[10px] text-[#94A3B8]">High Risk</span>
              <RiskBadge riskLevel="HIGH" />
            </div>
            <div className="flex flex-col gap-1 items-center">
              <span className="text-[10px] text-[#94A3B8]">Medium Risk</span>
              <RiskBadge riskLevel="MEDIUM" />
            </div>
            <div className="flex flex-col gap-1 items-center">
              <span className="text-[10px] text-[#94A3B8]">Dismissed Risk</span>
              <RiskBadge riskLevel="HIGH" dismissal={mockDismissal} />
            </div>
          </div>
        </section>

        {/* 5. Eligibility Breakdown Checklist */}
        <section className="space-y-4">
          <h3 className="text-sm font-bold text-[#475569] uppercase tracking-wider">5. EligibilityBreakdown Example</h3>
          <EligibilityBreakdown eligibility={mockEligibilitySnapshot} />
        </section>

        {/* 6. Assignment Queue Cards */}
        <section className="space-y-4">
          <h3 className="text-sm font-bold text-[#475569] uppercase tracking-wider">6. AssignmentQueueCard Examples</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <AssignmentQueueCard 
              assignment={{
                id: 'assign-2',
                applicationId: 'app-1',
                facultyId: 'user-faculty-1',
                status: AssignmentStatus.PENDING,
              }}
              studentName="Rahul Sharma"
              internshipTitle="Frontend Developer at TCS"
              role={Role.FACULTY}
              onAccept={() => alert('Faculty accepted assignment')}
              onReject={(id, reason) => alert(`Faculty rejected assignment ${id} for: "${reason}"`)}
            />
            <AssignmentQueueCard 
              assignment={{
                id: 'assign-3',
                applicationId: 'app-2',
                facultyId: 'user-faculty-1',
                status: AssignmentStatus.REJECTED,
                rejectReason: 'Mentor workload limit reached for this session.'
              }}
              studentName="Pooja Deshmukh"
              internshipTitle="ML Engineer at Google"
              role={Role.TNP}
            />
          </div>
        </section>

        {/* 7. Evidence Cards & Approval Buttons */}
        <section className="space-y-4">
          <h3 className="text-sm font-bold text-[#475569] uppercase tracking-wider">7. EvidenceCard & ApprovalButtons</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <span className="text-xs font-semibold text-[#94A3B8] block">Evidence Logs</span>
              <EvidenceCard 
                log={{
                  id: 'log-2',
                  applicationId: 'app-3',
                  weekLabel: 'Week 2',
                  description: 'Configured router paths, middleware authorization tests, and created the in-memory mock controllers.',
                  evidence: { type: 'link', value: 'https://github.com/nihar-ux18/Kaushal/commits/frontend' },
                  verified: false,
                  createdAt: '2026-08-20T09:15:00Z',
                }}
                onVerify={(id) => alert(`Log ${id} verified!`)}
                showActions={true}
              />
            </div>
            <div className="space-y-4">
              <span className="text-xs font-semibold text-[#94A3B8] block">Decisions Approval Panel</span>
              <div className="bg-white border border-[#E2E8F0] rounded-lg p-6 flex flex-col justify-center h-[202px]">
                <p className="text-xs text-[#64748B] mb-4 text-center">
                  Review applicant profile. Verify the offer letter legitimacy, or flag/reject it to request revision from the company.
                </p>
                <ApprovalButtons 
                  onApprove={handleActionApprove}
                  onReject={handleActionReject}
                  approveLabel="Verify Internship Offer"
                  rejectLabel="Flag Discrepancy"
                />
              </div>
            </div>
          </div>
        </section>

        {/* 8. Recharts ChartWrapper */}
        <section className="space-y-4">
          <h3 className="text-sm font-bold text-[#475569] uppercase tracking-wider">8. ChartWrapper Examples</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ChartWrapper 
              title="Placement Cell Skills Gap Report" 
              type="bar" 
              data={skillGapData} 
              xKey="skill"
              series={[
                { key: 'demand', label: 'Company Demand', color: '#5B21B6' },
                { key: 'supply', label: 'Student Supply', color: '#EA580C' }
              ]}
            />
            <ChartWrapper 
              title="At-Risk Student Trend" 
              type="line" 
              data={trendData} 
              xKey="name"
              series={[
                { key: 'riskCount', label: 'At-Risk Cohort Count', color: '#B91C1C' }
              ]}
            />
          </div>
        </section>

      </div>
    </RoleShell>
  );
}
