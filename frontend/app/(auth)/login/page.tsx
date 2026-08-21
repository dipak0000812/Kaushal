'use client';

import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { KeyRound, Mail, Shield, Sparkles } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { apiClient } from '@/lib/api/client';

const loginSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email address' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters' }),
});

type LoginFormValues = z.infer<typeof loginSchema>;

const SEED_CREDENTIALS = [
  {
    role: 'student',
    email: 'aarav.mehta@student.demo',
    password: 'Password123!',
    name: 'Aarav Mehta',
    redirect: '/student',
    label: 'Student',
  },
  {
    role: 'tnp',
    email: 'tnp@trackintern.demo',
    password: 'Password123!',
    name: 'Prof. S. K. Kulkarni (T&P)',
    redirect: '/tp',
    label: 'T&P Admin',
  },
  {
    role: 'company',
    email: 'contact@northbridge.demo',
    password: 'Password123!',
    name: 'Northbridge Systems',
    redirect: '/company',
    label: 'Company HR',
  },
  {
    role: 'faculty',
    email: 'faculty.cse@kaushal.demo',
    password: 'Password123!',
    name: 'Dr. Ramesh Sharma',
    redirect: '/faculty',
    label: 'Faculty Mentor',
  },
  {
    role: 'hod',
    email: 'hod.cse@kaushal.demo',
    password: 'Password123!',
    name: 'Dr. Amit Deshmukh',
    redirect: '/hod',
    label: 'HOD CSE',
  },
];

const ROLE_REDIRECT_MAP: Record<string, string> = {
  student: '/student',
  tnp: '/tp',
  company: '/company',
  faculty: '/faculty',
  hod: '/hod',
};

export default function LoginPage() {
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: LoginFormValues) => {
    setIsSubmitting(true);
    try {
      const response = await apiClient.auth.login({
        email: data.email.trim(),
        password: data.password,
      });

      if (response.success && response.data?.token) {
        const { token, user } = response.data;
        const role = user?.role || (response.data as any).role;
        const name = user?.name || (response.data as any).name || 'User';

        // Store JWT in cookies for Next.js middleware and SSR
        document.cookie = `kaushal_token=${token}; path=/; max-age=604800; SameSite=Lax`;
        document.cookie = `token=${token}; path=/; max-age=604800; SameSite=Lax`;

        // Store in localStorage for client-side API requests
        localStorage.setItem('kaushal_token', token);

        toast.success(`Success! Welcome, ${name}`);

        const targetUrl = ROLE_REDIRECT_MAP[role] || '/';
        setTimeout(() => {
          window.location.href = targetUrl;
        }, 500);
      } else {
        toast.error(response.error?.message || 'Invalid credentials. Please verify your email and password.');
        setIsSubmitting(false);
      }
    } catch (err: any) {
      toast.error(err.message || 'Authentication request failed. Please check network connection.');
      setIsSubmitting(false);
    }
  };

  const handleQuickFill = (cred: typeof SEED_CREDENTIALS[0]) => {
    setValue('email', cred.email);
    setValue('password', cred.password);
    toast.success(`${cred.label} credentials pre-filled!`);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      <Toaster position="top-center" reverseOrder={false} />

      {/* Background modern graphics */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-violet-900/10 blur-[120px]" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-sky-900/10 blur-[120px]" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="flex justify-center items-center gap-2">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-tr from-violet-600 to-sky-500 flex items-center justify-center shadow-lg shadow-violet-500/20">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight text-white bg-gradient-to-r from-violet-400 to-sky-400 bg-clip-text text-transparent">
            Kaushal Portal
          </span>
        </div>
        <h2 className="mt-6 text-center text-2xl font-bold tracking-tight text-white">
          Sign in to your dashboard
        </h2>
        <p className="mt-2 text-center text-xs text-slate-400">
          Connected to live backend & MongoDB database
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 py-8 px-4 shadow-2xl rounded-2xl sm:px-10">
          <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
            {/* Email field */}
            <div>
              <label htmlFor="email" className="block text-xs font-semibold text-slate-300">
                Email address
              </label>
              <div className="mt-1.5 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-4 h-4 text-slate-500" />
                </div>
                <input
                  id="email"
                  type="email"
                  className={`block w-full pl-10 pr-3 py-2 bg-slate-950/70 border ${
                    errors.email ? 'border-red-500 focus:ring-red-500/20 focus:border-red-500' : 'border-slate-800 focus:ring-violet-500/20 focus:border-violet-500'
                  } rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-4 transition-all`}
                  placeholder="name@kaushal.demo"
                  {...register('email')}
                />
              </div>
              {errors.email && (
                <p className="mt-1 text-xs text-red-500 font-medium">{errors.email.message}</p>
              )}
            </div>

            {/* Password field */}
            <div>
              <label htmlFor="password" className="block text-xs font-semibold text-slate-300">
                Password
              </label>
              <div className="mt-1.5 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <KeyRound className="h-4 h-4 text-slate-500" />
                </div>
                <input
                  id="password"
                  type="password"
                  className={`block w-full pl-10 pr-3 py-2 bg-slate-950/70 border ${
                    errors.password ? 'border-red-500 focus:ring-red-500/20 focus:border-red-500' : 'border-slate-800 focus:ring-violet-500/20 focus:border-violet-500'
                  } rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-4 transition-all`}
                  placeholder="••••••••"
                  {...register('password')}
                />
              </div>
              {errors.password && (
                <p className="mt-1 text-xs text-red-500 font-medium">{errors.password.message}</p>
              )}
            </div>

            {/* Submit button */}
            <div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg text-xs font-bold text-white bg-gradient-to-r from-violet-600 to-sky-500 hover:from-violet-500 hover:to-sky-400 disabled:opacity-50 shadow-lg shadow-violet-600/20 hover:shadow-violet-600/30 transition-all cursor-pointer items-center gap-1.5"
              >
                {isSubmitting ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    Sign In with Real API
                    <Sparkles className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Quick Click credentials helper */}
          <div className="mt-8 border-t border-slate-800 pt-6">
            <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-3 text-center">
              Quick-Fill Seed Database Credentials
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {SEED_CREDENTIALS.map((cred) => (
                <button
                  key={cred.role}
                  onClick={() => handleQuickFill(cred)}
                  className="px-2 py-1.5 bg-slate-950/40 hover:bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-lg text-[10px] font-semibold text-slate-300 hover:text-white transition-all text-left cursor-pointer flex flex-col justify-between"
                >
                  <span className="text-slate-400 font-bold">{cred.label}</span>
                  <span className="truncate text-[9px] mt-0.5 text-slate-500">{cred.email.split('@')[0]}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
