'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Shield, Sparkles, User, Mail, Lock, GraduationCap, Award, BookOpen } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { apiClient } from '@/lib/api/client';

const registerSchema = z.object({
  name: z.string().min(2, { message: 'Full name is required' }),
  email: z.string().email({ message: 'Valid institutional email is required' }),
  password: z.string().min(8, { message: 'Password must be at least 8 characters' }),
  department: z.string().min(2, { message: 'Department is required' }),
  year: z.coerce.number().int().min(1).max(6, { message: 'Year must be between 1 and 6' }),
  cgpa: z.coerce.number().min(0).max(10, { message: 'CGPA must be between 0.0 and 10.0' }),
  activeBacklogs: z.coerce.number().int().min(0, { message: 'Backlogs cannot be negative' }).default(0),
  skills: z.string().optional(),
  certifications: z.string().optional(),
  resumeUrl: z.string().url({ message: 'Must be a valid URL' }).optional().or(z.literal('')),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function StudentRegisterPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema) as any,
    defaultValues: {
      name: '',
      email: '',
      password: '',
      department: 'Computer Science and Engineering',
      year: 3,
      cgpa: 8.5,
      activeBacklogs: 0,
      skills: '',
      certifications: '',
      resumeUrl: '',
    },
  });

  const onSubmit = async (data: RegisterFormValues) => {
    setIsSubmitting(true);
    try {
      const skillsArray = data.skills
        ? data.skills.split(',').map((s) => s.trim()).filter(Boolean)
        : [];
      const certsArray = data.certifications
        ? data.certifications.split(',').map((c) => c.trim()).filter(Boolean)
        : [];

      const payload = {
        name: data.name.trim(),
        email: data.email.toLowerCase().trim(),
        password: data.password,
        department: data.department.trim(),
        year: Number(data.year),
        cgpa: Number(data.cgpa),
        activeBacklogs: Number(data.activeBacklogs || 0),
        skills: skillsArray,
        certifications: certsArray,
        resumeUrl: data.resumeUrl ? data.resumeUrl.trim() : undefined,
      };

      const response = await apiClient.auth.registerStudent(payload);

      if (response.success && response.data?.token) {
        const { token, user } = response.data;

        // Store JWT in cookies and localStorage
        document.cookie = `kaushal_token=${token}; path=/; max-age=604800; SameSite=Lax`;
        document.cookie = `token=${token}; path=/; max-age=604800; SameSite=Lax`;
        localStorage.setItem('kaushal_token', token);

        toast.success(`Account created! Welcome, ${user?.name || 'Student'}`);

        setTimeout(() => {
          window.location.href = '/student';
        }, 600);
      } else {
        toast.error(response.error?.message || 'Registration failed. Please check inputs.');
        setIsSubmitting(false);
      }
    } catch (err: any) {
      toast.error(err.message || 'Registration request failed.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      <Toaster position="top-center" reverseOrder={false} />

      {/* Background ambient lighting */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-violet-900/10 blur-[120px]" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-sky-900/10 blur-[120px]" />

      <div className="sm:mx-auto sm:w-full sm:max-w-xl relative z-10">
        <div className="flex justify-center items-center gap-2">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-tr from-violet-600 to-sky-500 flex items-center justify-center shadow-lg shadow-violet-500/20">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight text-white bg-gradient-to-r from-violet-400 to-sky-400 bg-clip-text text-transparent">
            Kaushal Portal
          </span>
        </div>
        <h2 className="mt-4 text-center text-2xl font-bold tracking-tight text-white">
          Student Self-Registration
        </h2>
        <p className="mt-1 text-center text-xs text-slate-400">
          Create your verified institutional student account and academic profile
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-xl relative z-10">
        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 py-8 px-6 shadow-2xl rounded-2xl sm:px-10">
          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
            {/* Name & Email */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300">Full Name *</label>
                <input
                  type="text"
                  placeholder="Aarav Sharma"
                  className="mt-1.5 block w-full px-3 py-2 bg-slate-950/70 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
                  {...register('name')}
                />
                {errors.name && <p className="mt-1 text-[11px] text-red-400">{errors.name.message}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300">Institutional Email *</label>
                <input
                  type="email"
                  placeholder="aarav@student.demo"
                  className="mt-1.5 block w-full px-3 py-2 bg-slate-950/70 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
                  {...register('email')}
                />
                {errors.email && <p className="mt-1 text-[11px] text-red-400">{errors.email.message}</p>}
              </div>
            </div>

            {/* Password & Department */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300">Password (min 8 chars) *</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  className="mt-1.5 block w-full px-3 py-2 bg-slate-950/70 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
                  {...register('password')}
                />
                {errors.password && <p className="mt-1 text-[11px] text-red-400">{errors.password.message}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300">Academic Department *</label>
                <input
                  type="text"
                  placeholder="Computer Science and Engineering"
                  className="mt-1.5 block w-full px-3 py-2 bg-slate-950/70 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
                  {...register('department')}
                />
                {errors.department && <p className="mt-1 text-[11px] text-red-400">{errors.department.message}</p>}
              </div>
            </div>

            {/* Year, CGPA, Backlogs */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300">Year (1-6) *</label>
                <input
                  type="number"
                  min="1"
                  max="6"
                  className="mt-1.5 block w-full px-3 py-2 bg-slate-950/70 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
                  {...register('year')}
                />
                {errors.year && <p className="mt-1 text-[11px] text-red-400">{errors.year.message}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300">CGPA (0-10) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="10"
                  className="mt-1.5 block w-full px-3 py-2 bg-slate-950/70 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
                  {...register('cgpa')}
                />
                {errors.cgpa && <p className="mt-1 text-[11px] text-red-400">{errors.cgpa.message}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300">Active Backlogs</label>
                <input
                  type="number"
                  min="0"
                  className="mt-1.5 block w-full px-3 py-2 bg-slate-950/70 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
                  {...register('activeBacklogs')}
                />
                {errors.activeBacklogs && <p className="mt-1 text-[11px] text-red-400">{errors.activeBacklogs.message}</p>}
              </div>
            </div>

            {/* Skills & Certifications */}
            <div>
              <label className="block text-xs font-semibold text-slate-300">Technical Skills (Comma-separated)</label>
              <input
                type="text"
                placeholder="React, TypeScript, Python, Docker, MongoDB"
                className="mt-1.5 block w-full px-3 py-2 bg-slate-950/70 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
                {...register('skills')}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300">Certifications (Comma-separated)</label>
              <input
                type="text"
                placeholder="AWS Certified Developer, Google Cloud Associate"
                className="mt-1.5 block w-full px-3 py-2 bg-slate-950/70 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
                {...register('certifications')}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300">Resume / Portfolio Link</label>
              <input
                type="url"
                placeholder="https://drive.google.com/..."
                className="mt-1.5 block w-full px-3 py-2 bg-slate-950/70 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
                {...register('resumeUrl')}
              />
              {errors.resumeUrl && <p className="mt-1 text-[11px] text-red-400">{errors.resumeUrl.message}</p>}
            </div>

            {/* Submit */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg text-xs font-bold text-white bg-gradient-to-r from-violet-600 to-sky-500 hover:from-violet-500 hover:to-sky-400 disabled:opacity-50 shadow-lg shadow-violet-600/20 transition-all cursor-pointer items-center gap-1.5"
              >
                {isSubmitting ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    Create Student Account
                    <Sparkles className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Links */}
          <div className="mt-6 border-t border-slate-800 pt-4 flex flex-col sm:flex-row justify-between items-center text-xs text-slate-400 gap-2">
            <Link href="/login" className="hover:text-white font-semibold transition-colors">
              Already have an account? Sign In &rarr;
            </Link>
            <Link href="/register/company" className="text-violet-400 hover:text-violet-300 font-semibold transition-colors">
              Company with Invite Token? &rarr;
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
