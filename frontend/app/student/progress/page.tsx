'use client';

import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, mockProgressLogs } from '@/lib/api/client';
import { Role, ApplicationStatus } from '@/lib/types';
import RoleShell from '@/components/shared/RoleShell';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { CalendarCheck, ShieldAlert, Sparkles, CheckCircle2 } from 'lucide-react';

const progressFormSchema = z.object({
  description: z.string().min(10, { message: 'Description must be at least 10 characters long.' }),
  evidenceUrl: z.string().url({ message: 'Evidence must be a valid link URL (e.g. https://github.com/...).' }),
});

type ProgressFormValues = z.infer<typeof progressFormSchema>;

export default function StudentProgressPage() {
  const queryClient = useQueryClient();

  // 1. Fetch Applications to find the one IN_PROGRESS
  const { data: appsRes, isLoading: isAppsLoading } = useQuery({
    queryKey: ['student-applications'],
    queryFn: () => apiClient.student.getApplications(),
  });

  const inProgressApp = appsRes?.data?.find(a => a.currentStatus === ApplicationStatus.IN_PROGRESS || a.currentStatus === ApplicationStatus.MENTOR_ASSIGNED);

  // 2. Fetch already submitted progress logs for this application to show count
  const { data: profileRes } = useQuery({
    queryKey: ['student-profile'],
    queryFn: () => apiClient.student.getProfile(),
  });

  // Log submission mutation
  const submitLogMutation = useMutation({
    mutationFn: (values: ProgressFormValues) => {
      if (!inProgressApp) throw new Error('No in-progress application found');
      return apiClient.student.submitProgressLog(inProgressApp.id, {
        description: values.description,
        evidence: {
          type: 'link',
          value: values.evidenceUrl,
        },
      });
    },
    onSuccess: (res) => {
      if (res.success) {
        queryClient.invalidateQueries({ queryKey: ['student-applications'] });
        reset();
        alert('Weekly progress log submitted successfully!');
      } else {
        alert(`Failed to submit: ${res.error?.message || 'Unknown error'}`);
      }
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProgressFormValues>({
    resolver: zodResolver(progressFormSchema),
    defaultValues: {
      description: '',
      evidenceUrl: '',
    },
  });

  const onSubmit = (data: ProgressFormValues) => {
    submitLogMutation.mutate(data);
  };

  if (isAppsLoading) {
    return (
      <RoleShell role={Role.STUDENT}>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-sm font-semibold text-[#64748B] animate-pulse">
            Loading progress page...
          </div>
        </div>
      </RoleShell>
    );
  }

  // Gate access: No active internship in progress
  if (!inProgressApp) {
    return (
      <RoleShell role={Role.STUDENT}>
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-bold text-[#0F172A]">Submit Progress Logs</h2>
            <p className="text-xs text-[#64748B] mt-0.5">Weekly evidence submissions gate.</p>
          </div>
          <div className="bg-white border border-[#FEE2E2] rounded-lg p-8 max-w-2xl flex flex-col items-center justify-center text-center space-y-4">
            <ShieldAlert className="w-12 h-12 text-[#DC2626]" />
            <h3 className="text-base font-bold text-[#0F172A]">Access Gated</h3>
            <p className="text-xs text-[#64748B] max-w-md leading-relaxed">
              You do not have an active internship currently in the <strong>In Progress</strong> or <strong>Mentor Assigned</strong> stage. You can only submit progress logs once your mentor assignment has been approved.
            </p>
          </div>
        </div>
      </RoleShell>
    );
  }

  return (
    <RoleShell role={Role.STUDENT}>
      <div className="space-y-6">
        
        {/* Header */}
        <div>
          <h2 className="text-xl font-bold text-[#0F172A]">Submit Weekly Progress Logs</h2>
          <p className="text-xs text-[#64748B] mt-0.5">
            Active Internship: <strong className="text-[#0F172A]">{inProgressApp.internshipTitle}</strong>
          </p>
        </div>

        {/* Instructions banner */}
        <div className="bg-[#F0F9FF] border border-[#BAE6FD] rounded-lg p-5 flex gap-3">
          <CalendarCheck className="w-5 h-5 text-[#0284C7] shrink-0 mt-0.5" />
          <div className="text-xs text-[#0369A1] space-y-1">
            <h4 className="font-bold">Weekly Log Instructions</h4>
            <p className="leading-relaxed">
              Weekly progress reports are evaluated by your assigned Faculty Mentor. Ensure you provide a detailed summary of your activities (tasks completed, skills utilized) and attach a valid URL link (such as a GitHub commit, project deploy link, or shared Drive folder) as evidence.
            </p>
          </div>
        </div>

        {/* Form panel */}
        <div className="bg-white border border-[#E2E8F0] rounded-lg p-6 max-w-2xl">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Description */}
            <div>
              <label className="block text-xs font-bold text-[#334155] uppercase tracking-wider mb-2">
                Log Description (Task Summary)
              </label>
              <textarea
                {...register('description')}
                placeholder="Describe your progress and tasks completed this week..."
                className="w-full text-xs p-3 border border-[#E2E8F0] rounded-md bg-[#F8FAFC] focus:outline-none focus:border-[#5B21B6] focus:bg-white min-h-[120px]"
              />
              {errors.description && (
                <span className="text-[10px] text-[#DC2626] font-semibold mt-1 block">
                  {errors.description.message}
                </span>
              )}
            </div>

            {/* Evidence URL */}
            <div>
              <label className="block text-xs font-bold text-[#334155] uppercase tracking-wider mb-2">
                Evidence URL Link
              </label>
              <input
                {...register('evidenceUrl')}
                type="text"
                placeholder="e.g. https://github.com/my-project/commit/xyz"
                className="w-full text-xs p-3 border border-[#E2E8F0] rounded-md bg-[#F8FAFC] focus:outline-none focus:border-[#5B21B6] focus:bg-white"
              />
              {errors.evidenceUrl && (
                <span className="text-[10px] text-[#DC2626] font-semibold mt-1 block">
                  {errors.evidenceUrl.message}
                </span>
              )}
            </div>

            {/* Submit button */}
            <div className="pt-2 border-t border-[#F1F5F9] flex justify-end">
              <button
                type="submit"
                disabled={submitLogMutation.isPending}
                className="px-4 py-2 bg-[#5B21B6] hover:bg-[#4C1D95] disabled:bg-[#C084FC] text-white text-xs font-bold rounded-md shadow cursor-pointer transition-colors"
              >
                {submitLogMutation.isPending ? 'Submitting log...' : 'Submit Progress Log'}
              </button>
            </div>
          </form>
        </div>

      </div>
    </RoleShell>
  );
}
