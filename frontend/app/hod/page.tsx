'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { Role } from '@/lib/types';
import RoleShell from '@/components/shared/RoleShell';
import StatCard from '@/components/shared/StatCard';
import ChartWrapper from '@/components/shared/ChartWrapper';
import RiskBadge from '@/components/shared/RiskBadge';
import Link from 'next/link';
import { GraduationCap, Award, CheckCircle, Clock, Users, ArrowRight } from 'lucide-react';

export default function HodDashboard() {
  const { data: dashboardRes, isLoading } = useQuery({
    queryKey: ['hod-dashboard'],
    queryFn: () => apiClient.hod.getDashboard(),
  });

  const data = dashboardRes?.data;
  const students = data?.students || [];

  // Map skill gap report data to ChartWrapper structure
  const skillGapData = (data?.skillGapReport || []).map((item: any) => ({
    name: item.skill,
    Demand: item.demand,
    Supply: item.supply,
  }));

  if (isLoading) {
    return (
      <RoleShell role={Role.HOD}>
        <div className="flex items-center justify-center min-h-[400px]">
          <span className="text-xs text-[#64748B] font-semibold animate-pulse">Loading department metrics...</span>
        </div>
      </RoleShell>
    );
  }

  return (
    <RoleShell role={Role.HOD}>
      <div className="space-y-8">
        
        {/* Header */}
        <div>
          <h2 className="text-xl font-bold text-[#0F172A] flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-[#5B21B6]" />
            Department Academic Overview
          </h2>
          <p className="text-xs text-[#64748B] mt-0.5">
            Monitor real-time cohort progression, corporate skill demand gaps, and student risk matrices.
          </p>
        </div>

        {/* Stats Grid */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard
            title="Active Mentees"
            value={data?.activeCount || 0}
            description="Students currently in corporate training"
            icon={<Clock className="w-5 h-5 text-[#5B21B6]" />}
          />
          <StatCard
            title="Completed Internships"
            value={data?.completedCount || 0}
            description="Students completed verification cycles"
            icon={<CheckCircle className="w-5 h-5 text-[#16A34A]" />}
          />
          <StatCard
            title="PPO Recommendations"
            value={data?.ppoCount || 0}
            description="Students recommended for pre-placement offers"
            icon={<Award className="w-5 h-5 text-[#EA580C]" />}
          />
        </section>

        {/* Charts Section */}
        <section className="grid grid-cols-1 gap-6">
          <ChartWrapper
            title="Departmental Skill-Gap Analysis"
            type="bar"
            data={skillGapData}
            xKey="name"
            series={[
              { key: 'Demand', label: 'Demand (Industry Rejections)', color: '#0284C7' },
              { key: 'Supply', label: 'Supply (Cohort Skills)', color: '#16A34A' },
            ]}
          />
        </section>

        {/* Cohort Registry Table */}
        <section className="space-y-4">
          <h3 className="text-xs font-bold text-[#475569] uppercase tracking-wider">Cohort Student Registry</h3>
          
          {students.length === 0 ? (
            <div className="bg-white border border-[#E2E8F0] p-10 text-center rounded-lg text-xs text-[#64748B]">
              No student records found in the department database.
            </div>
          ) : (
            <div className="bg-white border border-[#E2E8F0] rounded-lg overflow-hidden shadow-sm">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[10px] font-bold text-[#475569] uppercase tracking-wider">
                    <th className="p-4">Student</th>
                    <th className="p-4">Internship Role</th>
                    <th className="p-4">Placement Status</th>
                    <th className="p-4">Cohort Risk Status</th>
                    <th className="p-4 text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9] text-xs text-[#334155]">
                  {students.map((student: any) => (
                    <tr key={student.applicationId} className="hover:bg-[#F8FAFC] transition-colors">
                      <td className="p-4 font-semibold text-[#0F172A]">{student.studentName}</td>
                      <td className="p-4 text-[#475569]">{student.internshipTitle}</td>
                      <td className="p-4">
                        <span className="font-mono bg-[#F1F5F9] text-[#475569] px-2 py-0.5 rounded text-[10px] font-bold">
                          {student.currentStatus}
                        </span>
                      </td>
                      <td className="p-4">
                        <RiskBadge riskLevel={student.risk} dismissal={student.dismissal} />
                      </td>
                      <td className="p-4 text-right">
                        <Link
                          href={`/hod/students/${student.studentId}`}
                          className="inline-flex items-center gap-1 text-xs font-bold text-[#5B21B6] hover:underline"
                        >
                          Review Progress <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

      </div>
    </RoleShell>
  );
}
