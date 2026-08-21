'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Building2, Sparkles, KeyRound, Mail, Globe, Lock, Shield } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { apiClient } from '@/lib/api/client';

const companyRegisterSchema = z.object({
  inviteToken: z.string().min(1, { message: 'Invite token is required' }),
  companyName: z.string().min(2, { message: 'Company name is required' }),
  contactEmail: z.string().email({ message: 'Valid corporate contact email is required' }),
  password: z.string().min(8, { message: 'Password must be at least 8 characters' }),
  website: z.string().url({ message: 'Must be a valid URL' }).optional().or(z.literal('')),
});

type CompanyRegisterFormValues = z.infer<typeof companyRegisterSchema>;

function CompanyRegisterForm() {
  const searchParams = useSearchParams();
  const initialToken = searchParams.get('token') || '';
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CompanyRegisterFormValues>({
    resolver: zodResolver(companyRegisterSchema) as any,
    defaultValues: {
      inviteToken: initialToken,
      companyName: '',
      contactEmail: '',
      password: '',
      website: '',
    },
  });

  const onSubmit = async (data: CompanyRegisterFormValues) => {
    setIsSubmitting(true);
    try {
      const payload = {
        inviteToken: data.inviteToken.trim(),
        companyName: data.companyName.trim(),
        contactEmail: data.contactEmail.toLowerCase().trim(),
        password: data.password,
        website: data.website ? data.website.trim() : undefined,
      };

      const response = await apiClient.auth.registerCompany(payload);

      if (response.success) {
        toast.success('Company account registered! Awaiting T&P administrator verification.');
        setTimeout(() => {
          window.location.href = '/login';
        }, 1200);
      } else {
        toast.error(response.error?.message || 'Registration failed. Please verify your invite token.');
        setIsSubmitting(false);
      }
    } catch (err: any) {
      toast.error(err.message || 'Registration request failed.');
      setIsSubmitting(false);
    }
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
      {/* Invite Token */}
      <div>
        <label className="block text-xs font-semibold text-slate-300">Invite Token *</label>
        <div className="mt-1.5 relative rounded-md shadow-sm">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <KeyRound className="h-4 h-4 text-slate-500" />
          </div>
          <input
            type="text"
            placeholder="Paste your 64-char invite token"
            className="block w-full pl-10 pr-3 py-2 bg-slate-950/70 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 font-mono"
            {...register('inviteToken')}
          />
        </div>
        {errors.inviteToken && <p className="mt-1 text-[11px] text-red-400">{errors.inviteToken.message}</p>}
      </div>

      {/* Company Name & Email */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-300">Company Legal Name *</label>
          <div className="mt-1.5 relative rounded-md shadow-sm">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Building2 className="h-4 h-4 text-slate-500" />
            </div>
            <input
              type="text"
              placeholder="Northbridge Systems Ltd."
              className="block w-full pl-10 pr-3 py-2 bg-slate-950/70 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
              {...register('companyName')}
            />
          </div>
          {errors.companyName && <p className="mt-1 text-[11px] text-red-400">{errors.companyName.message}</p>}
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300">Official HR Email *</label>
          <div className="mt-1.5 relative rounded-md shadow-sm">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Mail className="h-4 h-4 text-slate-500" />
            </div>
            <input
              type="email"
              placeholder="hr@northbridge.com"
              className="block w-full pl-10 pr-3 py-2 bg-slate-950/70 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
              {...register('contactEmail')}
            />
          </div>
          {errors.contactEmail && <p className="mt-1 text-[11px] text-red-400">{errors.contactEmail.message}</p>}
        </div>
      </div>

      {/* Password & Website */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-300">Account Password *</label>
          <div className="mt-1.5 relative rounded-md shadow-sm">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Lock className="h-4 h-4 text-slate-500" />
            </div>
            <input
              type="password"
              placeholder="••••••••"
              className="block w-full pl-10 pr-3 py-2 bg-slate-950/70 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
              {...register('password')}
            />
          </div>
          {errors.password && <p className="mt-1 text-[11px] text-red-400">{errors.password.message}</p>}
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300">Company Website</label>
          <div className="mt-1.5 relative rounded-md shadow-sm">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Globe className="h-4 h-4 text-slate-500" />
            </div>
            <input
              type="url"
              placeholder="https://northbridge.com"
              className="block w-full pl-10 pr-3 py-2 bg-slate-950/70 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
              {...register('website')}
            />
          </div>
          {errors.website && <p className="mt-1 text-[11px] text-red-400">{errors.website.message}</p>}
        </div>
      </div>

      {/* Notice */}
      <div className="bg-slate-950/50 border border-slate-800 rounded-lg p-3 text-[11px] text-slate-400">
        <p>
          <strong>Note:</strong> Corporate onboarding is institutional invite-gated. Once registered, your company profile will be verified by the T&P department before postings are automatically published.
        </p>
      </div>

      {/* Submit Button */}
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
              Register Corporate Account
              <Sparkles className="w-3.5 h-3.5" />
            </>
          )}
        </button>
      </div>
    </form>
  );
}

export default function CompanyRegisterPage() {
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
          Company Invite Registration
        </h2>
        <p className="mt-1 text-center text-xs text-slate-400">
          Redeem your T&P institutional invitation token to create your corporate account
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-xl relative z-10">
        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 py-8 px-6 shadow-2xl rounded-2xl sm:px-10">
          <Suspense fallback={<div className="text-xs text-slate-400 text-center animate-pulse">Loading invite registration form...</div>}>
            <CompanyRegisterForm />
          </Suspense>

          {/* Links */}
          <div className="mt-6 border-t border-slate-800 pt-4 flex justify-between items-center text-xs text-slate-400">
            <Link href="/login" className="hover:text-white font-semibold transition-colors">
              &larr; Back to Sign In
            </Link>
            <Link href="/register" className="text-violet-400 hover:text-violet-300 font-semibold transition-colors">
              Student Registration &rarr;
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
