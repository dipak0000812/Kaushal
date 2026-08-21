'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { Role } from '@/lib/types';
import RoleShell from '@/components/shared/RoleShell';
import { useRouter } from 'next/navigation';
import { Building2, ArrowLeft, CheckCircle, Briefcase, IndianRupee } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

const postingSchema = z.object({
  title: z.string().min(3, 'Internship title must be at least 3 characters'),
  description: z.string().min(10, 'Please provide a detailed job description (at least 10 characters)'),
  duration: z.string().min(1, 'Duration is required'),
  mode: z.enum(['remote', 'onsite', 'hybrid']),
  stipend: z.coerce.number().min(0, 'Stipend cannot be negative').default(0),
  vacancies: z.coerce.number().int().min(1, 'At least 1 vacancy slot is required'),
  lastDate: z.string().min(1, 'Last date to apply is required'),
  minCgpa: z.coerce.number().min(0).max(10, 'CGPA must be between 0.0 and 10.0'),
  allowBacklogs: z.enum(['true', 'false']),
  branches: z.enum(['CS', 'IT', 'ALL']),
  requiredSkills: z.string().optional(),
});

type FormValues = z.infer<typeof postingSchema>;

export default function NewPostPage({ testSuccessInfo }: { testSuccessInfo?: { status: string } } = {}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [successInfo, setSuccessInfo] = useState<{ status: string } | null>(testSuccessInfo || null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(postingSchema) as any,
    defaultValues: {
      title: '',
      description: '',
      duration: '3 months',
      mode: 'remote',
      stipend: 25000,
      vacancies: 5,
      lastDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      minCgpa: 6.0,
      allowBacklogs: 'false',
      branches: 'ALL',
      requiredSkills: 'JavaScript, React, Node.js',
    },
  });

  const postMutation = useMutation({
    mutationFn: (values: FormValues) => {
      const skillsArray = (values.requiredSkills || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const deptList =
        values.branches === 'ALL'
          ? []
          : values.branches === 'CS'
          ? ['Computer Science']
          : ['Information Technology'];

      return apiClient.company.postInternship({
        title: values.title.trim(),
        description: values.description.trim(),
        duration: values.duration.trim(),
        mode: values.mode,
        stipend: values.stipend,
        vacancies: values.vacancies,
        lastDate: values.lastDate,
        criteria: {
          minCgpa: values.minCgpa,
          maxBacklogs: values.allowBacklogs === 'true' ? 2 : 0,
          departments: deptList,
          requiredSkills: skillsArray,
          requiredCerts: [],
        },
      });
    },
    onSuccess: (res) => {
      if (res.success && res.data) {
        queryClient.invalidateQueries({ queryKey: ['company-internships'] });
        setSuccessInfo({ status: res.data.status });
        toast.success('Internship posted successfully!');
      } else {
        toast.error(`Failed to post internship: ${res.error?.message || 'Validation error'}`);
      }
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to submit posting');
    },
  });

  const onSubmit = (data: FormValues) => {
    postMutation.mutate(data);
  };

  return (
    <RoleShell role={Role.COMPANY}>
      <Toaster position="top-center" />
      <div className="space-y-6 max-w-2xl mx-auto">
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
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-8 space-y-5 shadow-sm text-center">
            <div className="w-14 h-14 rounded-full bg-[#ECFDF5] text-[#059669] flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle className="w-7 h-7" />
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-bold text-[#0F172A]">Internship Created Successfully</h3>

              {successInfo.status === 'open' ? (
                <p id="success-message" className="text-xs text-[#059669] font-medium max-w-md mx-auto">
                  The internship opportunity was published immediately and is now live for eligible students to apply!
                </p>
              ) : (
                <p id="success-message" className="text-xs text-[#D97706] font-medium max-w-md mx-auto">
                  The internship was submitted successfully. It is awaiting T&P approval before going live to students.
                </p>
              )}
            </div>

            <button
              onClick={() => router.push('/company')}
              className="px-6 py-2.5 bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-bold rounded-lg cursor-pointer transition-colors"
            >
              Return to Company Dashboard
            </button>
          </div>
        ) : (
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 sm:p-8 space-y-6 shadow-sm">
            <div className="pb-4 border-b border-[#F1F5F9]">
              <h2 className="text-lg font-bold text-[#0F172A] flex items-center gap-2">
                <Building2 className="w-5 h-5 text-[#EA580C]" />
                Create New Internship Posting
              </h2>
              <p className="text-xs text-[#64748B] mt-1">
                Define the role details, placement eligibility criteria, and timeline for student applications.
              </p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              {/* Role Title */}
              <div>
                <label className="block text-xs font-bold text-[#475569] uppercase tracking-wider mb-1.5">
                  Internship Title <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Briefcase className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    placeholder="e.g. Full Stack Developer Intern"
                    {...register('title')}
                    className="w-full text-xs pl-9 p-2.5 border border-[#E2E8F0] rounded-lg bg-[#F8FAFC] focus:outline-none focus:border-[#EA580C] focus:bg-white"
                  />
                </div>
                {errors.title && <p className="text-[11px] text-[#B91C1C] mt-1">{errors.title.message}</p>}
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-[#475569] uppercase tracking-wider mb-1.5">
                  Job Description & Responsibilities <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={4}
                  placeholder="Describe the internship project, key responsibilities, and expected deliverables..."
                  {...register('description')}
                  className="w-full text-xs p-3 border border-[#E2E8F0] rounded-lg bg-[#F8FAFC] focus:outline-none focus:border-[#EA580C] focus:bg-white leading-relaxed"
                />
                {errors.description && <p className="text-[11px] text-[#B91C1C] mt-1">{errors.description.message}</p>}
              </div>

              {/* Grid 1: Duration, Mode, Stipend */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#475569] uppercase tracking-wider mb-1.5">
                    Duration <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 3 months"
                    {...register('duration')}
                    className="w-full text-xs p-2.5 border border-[#E2E8F0] rounded-lg bg-[#F8FAFC] focus:outline-none focus:border-[#EA580C] focus:bg-white"
                  />
                  {errors.duration && <p className="text-[11px] text-[#B91C1C] mt-1">{errors.duration.message}</p>}
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#475569] uppercase tracking-wider mb-1.5">
                    Work Mode <span className="text-rose-500">*</span>
                  </label>
                  <select
                    {...register('mode')}
                    className="w-full text-xs p-2.5 border border-[#E2E8F0] rounded-lg bg-[#F8FAFC] focus:outline-none focus:border-[#EA580C] focus:bg-white"
                  >
                    <option value="remote">Remote</option>
                    <option value="onsite">On-Site</option>
                    <option value="hybrid">Hybrid</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#475569] uppercase tracking-wider mb-1.5">
                    Monthly Stipend (₹)
                  </label>
                  <div className="relative">
                    <IndianRupee className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="number"
                      step="1000"
                      placeholder="25000"
                      {...register('stipend', { valueAsNumber: true })}
                      className="w-full text-xs pl-8 p-2.5 border border-[#E2E8F0] rounded-lg bg-[#F8FAFC] focus:outline-none focus:border-[#EA580C] focus:bg-white"
                    />
                  </div>
                  {errors.stipend && <p className="text-[11px] text-[#B91C1C] mt-1">{errors.stipend.message}</p>}
                </div>
              </div>

              {/* Grid 2: Vacancies, Last Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#475569] uppercase tracking-wider mb-1.5">
                    Total Vacancies <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    {...register('vacancies', { valueAsNumber: true })}
                    className="w-full text-xs p-2.5 border border-[#E2E8F0] rounded-lg bg-[#F8FAFC] focus:outline-none focus:border-[#EA580C] focus:bg-white"
                  />
                  {errors.vacancies && <p className="text-[11px] text-[#B91C1C] mt-1">{errors.vacancies.message}</p>}
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#475569] uppercase tracking-wider mb-1.5">
                    Application Deadline <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    {...register('lastDate')}
                    className="w-full text-xs p-2.5 border border-[#E2E8F0] rounded-lg bg-[#F8FAFC] focus:outline-none focus:border-[#EA580C] focus:bg-white"
                  />
                  {errors.lastDate && <p className="text-[11px] text-[#B91C1C] mt-1">{errors.lastDate.message}</p>}
                </div>
              </div>

              {/* Criteria Section */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Automated Eligibility Criteria
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#475569] mb-1">
                      Min CGPA
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="10"
                      {...register('minCgpa', { valueAsNumber: true })}
                      className="w-full text-xs p-2 border border-[#E2E8F0] rounded bg-white focus:outline-none focus:border-[#EA580C]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[#475569] mb-1">
                      Allow Active Backlogs?
                    </label>
                    <select
                      {...register('allowBacklogs')}
                      className="w-full text-xs p-2 border border-[#E2E8F0] rounded bg-white focus:outline-none focus:border-[#EA580C]"
                    >
                      <option value="false">No (0 Backlogs Only)</option>
                      <option value="true">Yes (Up to 2 Backlogs)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[#475569] mb-1">
                      Eligible Branches
                    </label>
                    <select
                      {...register('branches')}
                      className="w-full text-xs p-2 border border-[#E2E8F0] rounded bg-white focus:outline-none focus:border-[#EA580C]"
                    >
                      <option value="ALL">All Branches</option>
                      <option value="CS">Computer Science</option>
                      <option value="IT">Information Technology</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#475569] mb-1">
                    Required Skills (Comma-separated)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Python, React, PostgreSQL, Docker"
                    {...register('requiredSkills')}
                    className="w-full text-xs p-2 border border-[#E2E8F0] rounded bg-white focus:outline-none focus:border-[#EA580C]"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Students matching these skills will receive eligibility badges automatically.
                  </p>
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={postMutation.isPending}
                  className="w-full py-3 bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-bold rounded-lg shadow-sm transition-colors cursor-pointer disabled:bg-[#94A3B8]"
                >
                  {postMutation.isPending ? 'Publishing Posting...' : 'Publish Internship Opportunity'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </RoleShell>
  );
}
