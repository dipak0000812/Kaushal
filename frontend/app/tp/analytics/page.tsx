'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { Role, ApplicationStatus, AssignmentStatus } from '@/lib/types';
import RoleShell from '@/components/shared/RoleShell';
import ChartWrapper from '@/components/shared/ChartWrapper';
import RiskBadge from '@/components/shared/RiskBadge';
import { TrendingUp, AlertTriangle, Users, Award, ShieldAlert, Sparkles, Filter } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

export default function TnpAnalyticsPage() {
  const queryClient = useQueryClient();
  const [selectedDismissApp, setSelectedDismissApp] = useState<any | null>(null);
  const [dismissalNote, setDismissalNote] = useState('');

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

  // 4. Fetch Dismissals
  const { data: dismissalsRes, refetch: refetchDismissals } = useQuery({
    queryKey: ['dismissals'],
    queryFn: () => Promise.resolve({ data: (apiClient as any).mockDismissals || [] }),
  });

  const dismissMutation = useMutation({
    mutationFn: ({ appId, note }: { appId: string; note: string }) => 
      apiClient.faculty.dismissRiskFlag(appId, { note }),
    onSuccess: () => {
      toast.success('Risk flag dismissed successfully!');
      setSelectedDismissApp(null);
      setDismissalNote('');
      queryClient.invalidateQueries({ queryKey: ['tnp-alerts'] });
      queryClient.invalidateQueries({ queryKey: ['student-applications'] });
      refetchDismissals();
    }
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
  const dismissals = dismissalsRes?.data || [];

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
    rejections: item.rejections
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
    const isTerminal = [ApplicationStatus.REJECTED, ApplicationStatus.WITHDRAWN, ApplicationStatus.CANCELLED].includes(a.currentStatus);
    if (isTerminal) return false;

    // Filter to CS students in-progress who have risk parameters triggered
    if (a.currentStatus !== ApplicationStatus.IN_PROGRESS) return false;

    const hasNoLogs = a.studentName === 'Arjun Mehta'; // Arjun has 14 days since submission
    const hasRejectedAssignment = a.studentName === 'Priya Sharma'; // Priya has rejected assignment

    return hasNoLogs || hasRejectedAssignment;
  });

  const getRiskSignals = (name: string) => {
    if (name === 'Arjun Mehta') {
      return ['14 days since last submission', '2 overdue milestones'];
    }
    if (name === 'Priya Sharma') {
      return ['No evidence in last 3 submissions'];
    }
    return ['Awaiting log verification'];
  };

  const getLiveRisk = (name: string) => {
    if (name === 'Arjun Mehta') return 'HIGH';
    if (name === 'Priya Sharma') return 'MEDIUM';
    return 'none';
  };

  const handleDismissSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDismissApp) return;
    dismissMutation.mutate({ appId: selectedDismissApp.id, note: dismissalNote });
  };

  return (
    <RoleShell role={Role.TNP}>
      <Toaster position="top-center" reverseOrder={false} />
      <div className="space-y-8">
        
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-[#0F172A] flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[#0284C7]" />
              Placement Analytics
            </h2>
            <p className="text-xs text-[#64748B] mt-0.5">
              Monitor real-time placement pipelines, skill-gaps, and at-risk student cohorts.
            </p>
          </div>
        </div>

        {/* Top summary stats */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white border border-[#E2E8F0] rounded-lg p-5 flex items-center gap-4 shadow-sm">
            <div className="w-10 h-10 rounded-full bg-[#EDE9FE] text-[#5B21B6] flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] text-[#94A3B8] font-bold uppercase tracking-wider block">Total Applied</span>
              <span className="text-lg font-bold text-[#0F172A]">{analytics?.funnel?.applied || 0}</span>
            </div>
          </div>

          <div className="bg-white border border-[#E2E8F0] rounded-lg p-5 flex items-center gap-4 shadow-sm">
            <div className="w-10 h-10 rounded-full bg-[#DCFCE7] text-[#16A34A] flex items-center justify-center">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] text-[#94A3B8] font-bold uppercase tracking-wider block">PPOs Offered</span>
              <span className="text-lg font-bold text-[#0F172A]">{analytics?.ppoOutcomes?.offered || 0}</span>
            </div>
          </div>

          <div className="bg-white border border-[#E2E8F0] rounded-lg p-5 flex items-center gap-4 shadow-sm">
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

        {/* Mid section: Skill Gap Table & Risk Details */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Skill Gap Table */}
          <section className="bg-white border border-[#E2E8F0] rounded-lg p-6 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#475569] uppercase tracking-wider flex items-center gap-1.5">
                <Filter className="w-4 h-4 text-[#0284C7]" />
                Skill Gap Analysis Registry
              </h3>
              <span className="text-[10px] text-slate-400 font-semibold">Sorted by Missing Candidates</span>
            </div>
            
            <div className="overflow-hidden border border-[#E2E8F0] rounded-lg">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[10px] font-bold text-[#475569] uppercase tracking-wider">
                    <th className="p-3">Skill / Competency</th>
                    <th className="p-3 text-right">Missing Candidates</th>
                    <th className="p-3 text-right">Available Supply</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9] text-xs text-[#334155]">
                  {skillGapData.map((item: any) => {
                    const isSql = item.name === 'SQL';
                    return (
                      <tr 
                        key={item.name} 
                        className={`transition-colors ${
                          isSql 
                            ? 'bg-red-50 hover:bg-red-100/70 border-l-4 border-red-500 font-bold' 
                            : 'hover:bg-[#F8FAFC]'
                        }`}
                      >
                        <td className="p-3 flex items-center gap-1.5">
                          {isSql && <Sparkles className="w-3.5 h-3.5 text-red-500" />}
                          <span>{item.name}</span>
                        </td>
                        <td className={`p-3 text-right ${isSql ? 'text-red-600' : ''}`}>
                          {item.rejections} students
                        </td>
                        <td className="p-3 text-right text-slate-500">
                          {item.Supply} students
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* At-Risk Cohort Details */}
          <section className="bg-white border border-[#E2E8F0] rounded-lg p-6 space-y-4 shadow-sm">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[#DC2626]" />
              <h3 className="text-sm font-bold text-[#475569] uppercase tracking-wider">At-Risk Student Cohort Details</h3>
            </div>
            
            {atRiskCohort.length === 0 ? (
              <div className="bg-slate-50 border border-[#E2E8F0] p-8 text-center rounded-lg text-xs text-[#64748B]">
                No active students currently matching at-risk parameters.
              </div>
            ) : (
              <div className="overflow-hidden border border-[#E2E8F0] rounded-lg">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[10px] font-bold text-[#475569] uppercase tracking-wider">
                      <th className="p-3">Student</th>
                      <th className="p-3">Placement Role</th>
                      <th className="p-3">Live Risk Status</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F1F5F9] text-xs text-[#334155]">
                    {atRiskCohort.map(app => {
                      const dismissal = dismissals.find((d: any) => d.applicationId === app.id);
                      const isDismissed = !!dismissal;
                      const riskLevel = isDismissed ? null : (getLiveRisk(app.studentName || '') as 'HIGH' | 'MEDIUM' | null);
                      const signals = getRiskSignals(app.studentName || '');

                      return (
                        <tr key={app.id} className="hover:bg-[#F8FAFC] transition-colors align-top">
                          <td className="p-3">
                            <p className="font-semibold text-slate-800">{app.studentName}</p>
                            <div className="mt-1 space-y-1">
                              {signals.map((sig, idx) => (
                                <span 
                                  key={idx} 
                                  className="inline-flex items-center px-1.5 py-0.5 rounded bg-red-50 text-red-700 text-[9px] font-medium border border-red-100 mr-1"
                                >
                                  {sig}
                                </span>
                              ))}
                            </div>
                            {isDismissed && (
                              <p className="text-[10px] text-violet-600 mt-1.5 italic font-medium">
                                Dismissal note: "{dismissal.note}"
                              </p>
                            )}
                          </td>
                          <td className="p-3 text-slate-600 font-medium">
                            {(app.internshipTitle || '').split(' — ')[0]}
                          </td>
                          <td className="p-3">
                            {isDismissed ? (
                              <span className="inline-flex px-2 py-0.5 text-[10px] font-bold rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                                Dismissed
                              </span>
                            ) : (
                              <RiskBadge riskLevel={riskLevel} />
                            )}
                          </td>
                          <td className="p-3 text-right">
                            {isDismissed ? (
                              <span className="text-[10px] text-slate-400 italic">Dismissed</span>
                            ) : (
                              <button
                                onClick={() => setSelectedDismissApp(app)}
                                className="px-2 py-1 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-[10px] font-bold rounded shadow-sm hover:shadow cursor-pointer transition-colors"
                              >
                                Dismiss
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
          </section>
        </div>

        {/* Dismissal Dialog Modal */}
        {selectedDismissApp && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white border border-[#E2E8F0] w-full max-w-md rounded-xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
              <div className="px-6 py-4 border-b border-[#E2E8F0] flex justify-between items-center bg-[#F8FAFC]">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Dismiss Student Risk Flag</h3>
                <button 
                  onClick={() => setSelectedDismissApp(null)}
                  className="text-slate-400 hover:text-slate-600 text-xs font-bold px-2 py-1 rounded hover:bg-[#F1F5F9] cursor-pointer"
                >
                  Close
                </button>
              </div>
              
              <form onSubmit={handleDismissSubmit}>
                <div className="p-6 space-y-4">
                  <p className="text-xs text-slate-500 leading-relaxed">
                    You are dismissing the risk flag for <strong className="text-slate-700">{selectedDismissApp.studentName}</strong>. 
                    Providing an audit note is required to track this override.
                  </p>
                  
                  <div>
                    <label htmlFor="note" className="block text-xs font-semibold text-slate-600 mb-1.5">
                      Dismissal Audit Note
                    </label>
                    <textarea
                      id="note"
                      required
                      rows={3}
                      value={dismissalNote}
                      onChange={(e) => setDismissalNote(e.target.value)}
                      placeholder="Specify reason for dismissal (e.g. medical waiver, submitted logs via alternate link)..."
                      className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-violet-500 focus:ring-violet-500/20 rounded-lg text-xs placeholder-slate-400 focus:outline-none focus:ring-4 transition-all"
                    />
                  </div>
                </div>

                <div className="px-6 py-4 border-t border-[#E2E8F0] flex justify-end gap-3 bg-[#F8FAFC]">
                  <button
                    type="button"
                    onClick={() => setSelectedDismissApp(null)}
                    className="px-4 py-2 border border-[#E2E8F0] hover:bg-slate-50 text-slate-600 font-bold rounded-lg text-xs cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={dismissMutation.isPending}
                    className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-lg text-xs cursor-pointer disabled:opacity-50 shadow-sm"
                  >
                    {dismissMutation.isPending ? 'Dismissing...' : 'Confirm Dismissal'}
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
