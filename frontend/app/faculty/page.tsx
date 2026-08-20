'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { Role, AssignmentStatus } from '@/lib/types';
import RoleShell from '@/components/shared/RoleShell';
import AssignmentQueueCard from '@/components/shared/AssignmentQueueCard';
import RiskBadge from '@/components/shared/RiskBadge';
import Link from 'next/link';
import { Users, FileWarning, ClipboardList, ChevronRight } from 'lucide-react';

export default function FacultyDashboard() {
  const queryClient = useQueryClient();
  const [showNoSubmissionOnly, setShowNoSubmissionOnly] = useState(false);

  // 1. Fetch pending assignments
  const { data: assignmentsRes, isLoading: isAssignmentsLoading } = useQuery({
    queryKey: ['faculty-assignments'],
    queryFn: () => apiClient.faculty.getAssignments(),
  });

  const assignments = assignmentsRes?.data || [];
  const pendingAssignments = assignments.filter(a => a.status === AssignmentStatus.PENDING);

  // 2. Fetch all applications to resolve student/internship details for pending assignments
  const { data: appsRes, isLoading: isAppsLoading } = useQuery({
    queryKey: ['student-applications'],
    queryFn: () => apiClient.student.getApplications(),
  });

  const applications = appsRes?.data || [];

  // 3. Fetch assigned students
  const { data: studentsRes, isLoading: isStudentsLoading } = useQuery({
    queryKey: ['faculty-students', showNoSubmissionOnly],
    queryFn: () => 
      showNoSubmissionOnly 
        ? apiClient.faculty.getStudentsNoSubmission() 
        : apiClient.faculty.getStudents(),
  });

  const students = studentsRes?.data || [];

  const isLoading = isAssignmentsLoading || isAppsLoading || isStudentsLoading;

  // 4. Mutations
  const acceptMutation = useMutation({
    mutationFn: (id: string) => apiClient.faculty.acceptAssignment(id),
    onSuccess: (res) => {
      if (res.success) {
        queryClient.invalidateQueries({ queryKey: ['faculty-assignments'] });
        queryClient.invalidateQueries({ queryKey: ['faculty-students'] });
        queryClient.invalidateQueries({ queryKey: ['student-applications'] });
        queryClient.invalidateQueries({ queryKey: ['tnp-alerts'] });
        alert('Assignment accepted successfully.');
      } else {
        alert(`Failed to accept assignment: ${res.error?.message}`);
      }
    }
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => 
      apiClient.faculty.rejectAssignment(id, { reason }),
    onSuccess: (res) => {
      if (res.success) {
        queryClient.invalidateQueries({ queryKey: ['faculty-assignments'] });
        queryClient.invalidateQueries({ queryKey: ['faculty-students'] });
        queryClient.invalidateQueries({ queryKey: ['student-applications'] });
        queryClient.invalidateQueries({ queryKey: ['tnp-alerts'] });
        // Also invalidate T&P queue keys since this goes back to unassigned list
        queryClient.invalidateQueries({ queryKey: ['tnp-analytics'] });
        alert('Assignment declined. Student returned to T&P queue.');
      } else {
        alert(`Failed to decline assignment: ${res.error?.message}`);
      }
    }
  });

  const handleAccept = (id: string) => {
    acceptMutation.mutate(id);
  };

  const handleReject = (id: string, reason: string) => {
    rejectMutation.mutate({ id, reason });
  };

  return (
    <RoleShell role={Role.FACULTY}>
      <div className="space-y-8">
        
        {/* Header */}
        <div>
          <h2 className="text-xl font-bold text-[#0F172A] flex items-center gap-2">
            <Users className="w-5 h-5 text-[#059669]" />
            Faculty Mentor Console
          </h2>
          <p className="text-xs text-[#64748B] mt-0.5">
            Accept pending student assignments, verify weekly logs, and manage cohort progress flags.
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center min-h-[200px]">
            <span className="text-xs text-[#64748B] font-semibold animate-pulse">Loading dashboard workspaces...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            
            {/* Left Column: Queue & Controls (2/3 width) */}
            <div className="lg:col-span-2 space-y-8">
              
              {/* Assignment Queue */}
              <section className="space-y-4">
                <h3 className="text-xs font-bold text-[#475569] uppercase tracking-wider flex items-center gap-1.5">
                  <ClipboardList className="w-4 h-4 text-[#5B21B6]" />
                  Pending Assignment Queue ({pendingAssignments.length})
                </h3>

                {pendingAssignments.length === 0 ? (
                  <div className="bg-white border border-[#E2E8F0] p-8 text-center rounded-lg text-xs text-[#64748B]">
                    No pending student mentorship requests in your queue.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4">
                    {pendingAssignments.map(assign => {
                      const app = applications.find(a => a.id === assign.applicationId);
                      return (
                        <AssignmentQueueCard
                          key={assign.id}
                          assignment={assign}
                          studentName={app?.studentName || 'Unknown Student'}
                          internshipTitle={app?.internshipTitle || 'Internship Details Pending'}
                          role={Role.FACULTY}
                          onAccept={handleAccept}
                          onReject={handleReject}
                        />
                      );
                    })}
                  </div>
                )}
              </section>

              {/* Assigned Students Registry */}
              <section className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[#E2E8F0]">
                  <h3 className="text-xs font-bold text-[#475569] uppercase tracking-wider flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-[#059669]" />
                    Assigned Student Cohort ({students.length})
                  </h3>
                  
                  {/* Filter checkbox */}
                  <label className="flex items-center gap-2 text-xs font-semibold text-[#475569] cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={showNoSubmissionOnly}
                      onChange={(e) => setShowNoSubmissionOnly(e.target.checked)}
                      className="w-4 h-4 rounded border-[#E2E8F0] text-[#059669] focus:ring-[#059669]"
                    />
                    <span>Show No Submissions Only</span>
                  </label>
                </div>

                {students.length === 0 ? (
                  <div className="bg-white border border-[#E2E8F0] p-10 text-center rounded-lg text-xs text-[#64748B]">
                    {showNoSubmissionOnly 
                      ? 'No assigned students are currently missing logs.' 
                      : 'You do not have any accepted student mentorships at this time.'}
                  </div>
                ) : (
                  <div className="bg-white border border-[#E2E8F0] rounded-lg overflow-hidden shadow-sm">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[10px] font-bold text-[#475569] uppercase tracking-wider">
                          <th className="p-4">Student</th>
                          <th className="p-4">Internship Posting</th>
                          <th className="p-4">Logs Submitted</th>
                          <th className="p-4">Risk Flag</th>
                          <th className="p-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F1F5F9] text-xs text-[#334155]">
                        {students.map((student: any) => {
                          const hasRisk = student.risk && student.risk !== 'none';
                          return (
                            <tr key={student.applicationId} className="hover:bg-[#F8FAFC] transition-colors">
                              <td className="p-4 font-semibold">{student.studentName}</td>
                              <td className="p-4">{student.internshipTitle}</td>
                              <td className="p-4 font-mono text-[#475569]">
                                {student.logs.length} log(s)
                              </td>
                              <td className="p-4">
                                {hasRisk ? (
                                  <RiskBadge riskLevel={student.risk} />
                                ) : (
                                  <span className="text-[10px] font-semibold text-[#94A3B8] italic">
                                    {student.dismissal ? 'Dismissed' : 'None'}
                                  </span>
                                )}
                              </td>
                              <td className="p-4 text-right">
                                <Link
                                  href={`/faculty/students/${student.applicationId}`}
                                  className="inline-flex items-center gap-1 text-xs font-bold text-[#059669] hover:underline"
                                >
                                  Open Profile <ChevronRight className="w-3.5 h-3.5" />
                                </Link>
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

            {/* Right Column: Faculty Guidelines (1/3 width) */}
            <div className="bg-white border border-[#E2E8F0] rounded-lg p-5 space-y-4 shadow-sm">
              <h3 className="text-xs font-bold text-[#475569] uppercase tracking-wider flex items-center gap-1.5">
                <FileWarning className="w-4 h-4 text-[#D97706]" />
                Mentorship Directives
              </h3>
              <ul className="text-xs text-[#64748B] space-y-3 list-disc pl-4 leading-relaxed">
                <li>Review student applications in your queue. Declining an assignment returns the student to the T&P verified pool for re-routing.</li>
                <li>Track weekly log submissions. Students in active state missing logs for more than 7 days will automatically trigger a **HIGH** risk badge.</li>
                <li>Review evidence links before verifying logs. Verifying logs confirms student activity is approved.</li>
                <li>Administrative dismissals can be applied to risk flags with a mandatory audit note. Dismissals automatically expire once the student uploads new log evidence.</li>
              </ul>
            </div>

          </div>
        )}

      </div>
    </RoleShell>
  );
}
