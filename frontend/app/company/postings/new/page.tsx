'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { Role } from '@/lib/types';
import RoleShell from '@/components/shared/RoleShell';
import { useRouter } from 'next/navigation';
import { Building2, ArrowLeft, CheckCircle, Clock } from 'lucide-react';
import toast from 'react-hot-toast';

const criteriaSchema = z.object({
  minCgpa: z.number().min(0).max(10, 'CGPA must be between 0 and 10'),
  allowBacklogs: z.enum(['true', 'false']),
  branches: z.enum(['CS', 'IT', 'ALL']),
  vacancies: z.number().min(1, 'At least 1 vacancy slot is required'),
  lastDate: z.string().min(1, 'Last date is required'),
});

type FormValues = z.infer<typeof criteriaSchema>;

export default function NewPostPage({ testSuccessInfo }: { testSuccessInfo?: { status: string } } = {}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [successInfo, setSuccessInfo] = useState<{ status: string } | null>(testSuccessInfo || null);

  // 1. Fetch company profile to check verification status for description help
  const { data: profileRes } = useQuery({
    queryKey: ['company-profile'],
    queryFn: () => apiClient.company.getInternships(), // baseline trigger
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(criteriaSchema),
    defaultValues: {
      minCgpa: 6.0,
      allowBacklogs: 'false',
      branches: 'ALL',
      vacancies: 5,
      lastDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    },
  });

  const postMutation = useMutation({
    mutationFn: (values: FormValues) =>
      apiClient.company.postInternship({
        criteria: {
          minCgpa: values.minCgpa,
          maxBacklogs: values.allowBacklogs === 'true' ? 2 : 0,
          department: values.branches === 'ALL' ? 'All' : values.branches === 'CS' ? 'Computer Science' : 'Information Technology',
          year: 4,
          requiredSkills: [],
          requiredCerts: [],
        },
        vacancies: values.vacancies,
        lastDate: values.lastDate,
      }),
    onSuccess: (res) => {
      if (res.success && res.data) {
        queryClient.invalidateQueries({ queryKey: ['company-internships'] });
        setSuccessInfo({ status: res.data.status });
      } else {
        toast.error(`Failed to post internship: ${res.error?.message}`);
      }
    },
  });

  const onSubmit = (data: FormValues) => {
    postMutation.mutate(data);
  };

  return (
    <RoleShell role={Role.COMPANY}>
      <div className="space-y-6 max-w-lg mx-auto">
        
        {/* Back link */}
        <div>
          <button
            onClick={() => router.push('/company')}
            className="inline-flex items-center gap-1.5 text-xs text-[#EA580C] hover:underline font-semibold cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
          </button>
        </div>

        {successInfo ? (
          /* Submission success user-facing message card */
          <div className="bg-white border border-[#E2E8F0] rounded-lg p-6 space-y-4 shadow-md text-center">
            <div className="w-12 h-12 rounded-full bg-[#ECFDF5] text-[#059669] flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle className="w-6 h-6" />
            </div>
            
            <div className="space-y-2">
              <h3 className="text-base font-bold text-[#0F172A]">Internship Created Successfully</h3>
              
              {successInfo.status === 'open' ? (
                <p id="success-message" className="text-xs text-[#059669] font-medium">
                  The internship opportunity was posted and published successfully!
                </p>
              ) : (
                <p id="success-message" className="text-xs text-[#D97706] font-medium">
                  The internship was posted successfully. It is pending T&P approval since your company status is unverified.
                </p>
              )}
            </div>

            <button
              onClick={() => router.push('/company')}
              className="w-full py-2 bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-bold rounded-lg cursor-pointer transition-colors mt-2"
            >
              Return to Dashboard
            </button>
          </div>
        ) : (
          <div className="bg-white border border-[#E2E8F0] rounded-lg p-6 space-y-6 shadow-md">
            
            <div className="pb-2 border-b border-[#F1F5F9]">
              <h2 className="text-base font-bold text-[#0F172A] flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[#EA580C]" />
                New Internship Posting
              </h2>
              <p className="text-[11px] text-[#64748B] mt-0.5">
                Declare placement criteria. Postings are audited before being made active for student applications.
              </p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              
              {/* Vacancies */}
              <div>
                <label className="block text-xs font-bold text-[#475569] uppercase tracking-wider mb-1">
                  Vacancy Count
                </label>
                <input
                  type="number"
                  {...register('vacancies', { valueAsNumber: true })}
                  className="w-full text-xs p-2.5 border border-[#E2E8F0] rounded bg-[#F8FAFC] focus:outline-none focus:border-[#EA580C] focus:bg-white"
                />
                {errors.vacancies && (
                  <p className="text-[10px] text-[#B91C1C] mt-1">{errors.vacancies.message}</p>
                )}
              </div>

              {/* CGPA */}
              <div>
                <label className="block text-xs font-bold text-[#475569] uppercase tracking-wider mb-1">
                  Minimum CGPA Required
                </label>
                <input
                  type="number"
                  step="0.1"
                  {...register('minCgpa', { valueAsNumber: true })}
                  className="w-full text-xs p-2.5 border border-[#E2E8F0] rounded bg-[#F8FAFC] focus:outline-none focus:border-[#EA580C] focus:bg-white"
                />
                {errors.minCgpa && (
                  <p className="text-[10px] text-[#B91C1C] mt-1">{errors.minCgpa.message}</p>
                )}
              </div>

              {/* Backlogs */}
              <div>
                <label className="block text-xs font-bold text-[#475569] uppercase tracking-wider mb-1">
                  Allow Active Backlogs?
                </label>
                <select
                  {...register('allowBacklogs')}
                  className="w-full text-xs p-2.5 border border-[#E2E8F0] rounded bg-[#F8FAFC] focus:outline-none focus:border-[#EA580C] focus:bg-white"
                >
                  <option value="false">No (0 Backlogs Only)</option>
                  <option value="true">Yes</option>
                </select>
              </div>

              {/* Branch */}
              <div>
                <label className="block text-xs font-bold text-[#475569] uppercase tracking-wider mb-1">
                  Eligible Branches
                </label>
                <select
                  {...register('branches')}
                  className="w-full text-xs p-2.5 border border-[#E2E8F0] rounded bg-[#F8FAFC] focus:outline-none focus:border-[#EA580C] focus:bg-white"
                >
                  <option value="ALL">All Branches</option>
                  <option value="CS">Computer Science</option>
                  <option value="IT">Information Technology</option>
                </select>
              </div>

              {/* Last Date */}
              <div>
                <label className="block text-xs font-bold text-[#475569] uppercase tracking-wider mb-1">
                  Last Date to Apply
                </label>
                <input
                  type="date"
                  {...register('lastDate')}
                  className="w-full text-xs p-2.5 border border-[#E2E8F0] rounded bg-[#F8FAFC] focus:outline-none focus:border-[#EA580C] focus:bg-white"
                />
                {errors.lastDate && (
                  <p className="text-[10px] text-[#B91C1C] mt-1">{errors.lastDate.message}</p>
                )}
              </div>

              {/* Action Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={postMutation.isPending}
                  className="w-full py-2.5 bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-bold rounded-lg shadow-sm transition-colors cursor-pointer disabled:bg-[#94A3B8]"
                >
                  {postMutation.isPending ? 'Submitting...' : 'Post Internship'}
                </button>
              </div>

            </form>
          </div>
        )}

      </div>
    </RoleShell>
  );
}
