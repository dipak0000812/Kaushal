'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient, mockProgressLogs, mockApplications, mockAssignments } from '@/lib/api/client';
import { Role, ApplicationStatus, AssignmentStatus } from '@/lib/types';
import RoleShell from '@/components/shared/RoleShell';
import ChartWrapper from '@/components/shared/ChartWrapper';
import RiskBadge from '@/components/shared/RiskBadge';
import { TrendingUp, AlertTriangle, Users, Award, ShieldAlert } from 'lucide-react';

export default function TnpAnalyticsPage() {
  // 1. Fetch Analytics Dashboard
  const { data: analyticsRes, isLoading: isAnalyticsLoading } = useQuery({
    queryKey: ['tnp-analytics'],
    queryFn: () => apiClient.tnp.getAnalyticsDashboard(),
  });

  // 2. Fetch Alerts to get atRiskCount
  const { data: alertsRes, isLoading: isAlertsLoading } = useQuery({
    queryKey: ['tnp-alerts'],
    queryFn: () => apiClient.tnp.getAlerts(),
  });

  // 3. Fetch applications to display at-risk cohort details
  const { data: appsRes, isLoading: isAppsLoading } = useQuery({
    queryKey: ['student-applications'],
    queryFn: () => apiClient.student.getApplications(),
  });

  const isLoading = isAnalyticsLoading || isAlertsLoading || isAppsLoading;

  if (isLoading) {
    return (
      <RoleShell role={Role.TNP}>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-sm font-semibold text-[#64748B] animate-pulse">
            Loading analytics dashboard...
          </div>
        </div>
      </RoleShell>
    );
  }

  const analytics = analyticsRes?.data;
  const alerts = alertsRes?.data;
  const applications = appsRes?.data || [];

  // Map funnel data
  const funnelData = [
    { name: 'Applied', Count: analytics?.funnel?.applied || 0 },
    { name: 'Shortlisted', Count: analytics?.funnel?.shortlisted || 0 },
    { name: 'Offered', Count: analytics?.funnel?.offered || 0 },
    { name: 'Completed', Count: analytics?.funnel?.completed || 0 },
  ];

  // Map skill-gap data
  const skillGapData = (analytics?.skillGapReport || []).map((item: any) => ({
    name: item.skill,
    Demand: item.demand,
    Supply: item.supply,
  }));

  // Construct At-Risk cohort trend data using the live count from alerts
  const liveAtRiskCount = alerts?.atRiskCount || 0;
  const atRiskTrendData = [
    { name: 'Week 1', Count: 1 },
    { name: 'Week 2', Count: 2 },
    { name: 'Week 3 (Live)', Count: liveAtRiskCount },
  ];

  // Derive the list of students in the at-risk cohort from applications list
  const atRiskCohort = applications.filter(a => {
    // An application is at risk if:
    // 1. Status is IN_PROGRESS but has no logs or logs are > 7 days old
    // 2. Has a rejected assignment
    // And is not in a terminal state
    const isTerminal = [ApplicationStatus.REJECTED, ApplicationStatus.WITHDRAWN, ApplicationStatus.CANCELLED].includes(a.currentStatus);
    if (isTerminal) return false;

    const logs = mockProgressLogs.filter(l => l.applicationId === a.id);
    const hasNoLogs = a.currentStatus === ApplicationStatus.IN_PROGRESS && logs.length === 0;
    const hasRejectedAssignment = mockAssignments.some(as => as.applicationId === a.id && as.status === AssignmentStatus.REJECTED);

    return hasNoLogs || hasRejectedAssignment;
  });

  return (
    <RoleShell role={Role.TNP}>
      <div className="space-y-8">
        
        {/* Header */}
        <div>
          <h2 className="text-xl font-bold text-[#0F172A] flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-[#0284C7]" />
            Placement Analytics
          </h2>
          <p className="text-xs text-[#64748B] mt-0.5">
            Monitor real-time placement pipelines, skill-gaps, and at-risk student cohorts.
          </p>
        </div>

        {/* Top summary stats */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white border border-[#E2E8F0] rounded-lg p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-[#EDE9FE] text-[#5B21B6] flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] text-[#94A3B8] font-bold uppercase tracking-wider block">Total Applied</span>
              <span className="text-lg font-bold text-[#0F172A]">{analytics?.funnel?.applied || 0}</span>
            </div>
          </div>

          <div className="bg-white border border-[#E2E8F0] rounded-lg p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-[#DCFCE7] text-[#16A34A] flex items-center justify-center">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] text-[#94A3B8] font-bold uppercase tracking-wider block">PPOs Offered</span>
              <span className="text-lg font-bold text-[#0F172A]">{analytics?.ppoOutcomes?.offered || 0}</span>
            </div>
          </div>

          <div className="bg-white border border-[#E2E8F0] rounded-lg p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-[#FEE2E2] text-[#DC2626] flex items-center justify-center">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] text-[#94A3B8] font-bold uppercase tracking-wider block">Cohort At Risk</span>
              <span className={`text-lg font-bold ${liveAtRiskCount > 0 ? 'text-[#DC2626]' : 'text-[#0F172A]'}`}>
                {liveAtRiskCount}
              </span>
            </div>
          </div>
        </section>

        {/* Charts Grid */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Chart 1: Funnel */}
          <ChartWrapper
            title="Placement Funnel Breakdown"
            type="bar"
            data={funnelData}
            xKey="name"
            series={[{ key: 'Count', label: 'Students', color: '#5B21B6' }]}
          />

          {/* Chart 2: Skill Gap */}
          <ChartWrapper
            title="Academic Skill-Gap Analysis"
            type="bar"
            data={skillGapData}
            xKey="name"
            series={[
              { key: 'Demand', label: 'Demand (Industry)', color: '#0284C7' },
              { key: 'Supply', label: 'Supply (Students)', color: '#16A34A' },
            ]}
          />

          {/* Chart 3: At-Risk Cohort Trend */}
          <ChartWrapper
            title="At-Risk Cohort Trend"
            type="line"
            data={atRiskTrendData}
            xKey="name"
            series={[{ key: 'Count', label: 'At-Risk Count', color: '#DC2626' }]}
          />
        </section>

        {/* At-Risk Cohort Details */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-[#DC2626]" />
            <h3 className="text-sm font-bold text-[#475569] uppercase tracking-wider">At-Risk Student Cohort Details</h3>
          </div>
          
          {atRiskCohort.length === 0 ? (
            <div className="bg-white border border-[#E2E8F0] p-8 text-center rounded-lg text-xs text-[#64748B]">
              No active students currently matching at-risk parameters.
            </div>
          ) : (
            <div className="bg-white border border-[#E2E8F0] rounded-lg overflow-hidden shadow-sm">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[10px] font-bold text-[#475569] uppercase tracking-wider">
                    <th className="p-4">Student</th>
                    <th className="p-4">Placement Role</th>
                    <th className="p-4">Pipeline Status</th>
                    <th className="p-4">Live Risk Level</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9] text-xs text-[#334155]">
                  {atRiskCohort.map(app => {
                    const logs = mockProgressLogs.filter(l => l.applicationId === app.id);
                    const isHigh = app.currentStatus === ApplicationStatus.IN_PROGRESS && logs.length === 0;

                    return (
                      <tr key={app.id} className="hover:bg-[#F8FAFC] transition-colors">
                        <td className="p-4 font-semibold">{app.studentName}</td>
                        <td className="p-4">{app.internshipTitle}</td>
                        <td className="p-4">
                          <span className="px-2 py-0.5 rounded-full bg-[#EDE9FE] text-[#5B21B6] border border-[#DDD6FE] font-medium text-[10px]">
                            {app.currentStatus}
                          </span>
                        </td>
                        <td className="p-4">
                          <RiskBadge riskLevel={isHigh ? 'HIGH' : 'MEDIUM'} />
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
    </RoleShell>
  );
}
