'use client';

import React from 'react';
import { ShieldCheck, Users, GraduationCap, Building2, UserCog } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import toast, { Toaster } from 'react-hot-toast';

const SEED_USERS = [
  {
    name: 'Aarav Mehta (Student)',
    roleKey: 'student',
    redirectPath: '/student',
    icon: GraduationCap,
    bgColor: 'bg-[#EDE9FE] text-[#5B21B6]',
    hoverBg: 'hover:bg-[#DDD6FE]',
    email: 'aarav.mehta@student.demo',
    password: 'Password123!',
  },
  {
    name: 'Prof. S. K. Kulkarni (T&P Admin)',
    roleKey: 'tnp',
    redirectPath: '/tp',
    icon: ShieldCheck,
    bgColor: 'bg-[#F0F9FF] text-[#0284C7]',
    hoverBg: 'hover:bg-[#E0F2FE]',
    email: 'tnp@trackintern.demo',
    password: 'Password123!',
  },
  {
    name: 'Northbridge Systems (Company HR)',
    roleKey: 'company',
    redirectPath: '/company',
    icon: Building2,
    bgColor: 'bg-[#FFF7ED] text-[#EA580C]',
    hoverBg: 'hover:bg-[#FFEDD5]',
    email: 'contact@northbridge.demo',
    password: 'Password123!',
  },
  {
    name: 'Dr. Ramesh Sharma (Faculty Mentor)',
    roleKey: 'faculty',
    redirectPath: '/faculty',
    icon: Users,
    bgColor: 'bg-[#ECFDF5] text-[#059669]',
    hoverBg: 'hover:bg-[#D1FAE5]',
    email: 'faculty.cse@kaushal.demo',
    password: 'Password123!',
  },
  {
    name: 'Dr. Amit Deshmukh (HOD CSE)',
    roleKey: 'hod',
    redirectPath: '/hod',
    icon: UserCog,
    bgColor: 'bg-[#FFF5F5] text-[#E11D48]',
    hoverBg: 'hover:bg-[#FFE4E6]',
    email: 'hod.cse@kaushal.demo',
    password: 'Password123!',
  },
];

export default function DevLoginPage() {
  const [loadingRole, setLoadingRole] = React.useState<string | null>(null);

  const handleRealLogin = async (email: string, pass: string, redirectPath: string, roleKey: string) => {
    setLoadingRole(roleKey);
    try {
      const res = await apiClient.auth.login({ email, password: pass });
      if (res.success && res.data?.token) {
        const token = res.data.token;
        document.cookie = `kaushal_token=${token}; path=/; max-age=604800; SameSite=Lax`;
        document.cookie = `token=${token}; path=/; max-age=604800; SameSite=Lax`;
        localStorage.setItem('kaushal_token', token);
        toast.success(`Logged in as ${email}`);
        window.location.href = redirectPath;
      } else {
        toast.error(res.error?.message || 'Login failed');
        setLoadingRole(null);
      }
    } catch (e: any) {
      toast.error(e.message || 'Login failed');
      setLoadingRole(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-center items-center p-6">
      <Toaster position="top-center" />
      <div className="max-w-md w-full bg-white border border-[#E2E8F0] rounded-xl shadow-lg p-8 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-lg bg-[#5B21B6] text-white flex items-center justify-center font-bold text-2xl mx-auto shadow-md">
            K
          </div>
          <h2 className="text-xl font-bold text-[#0F172A]">Real API Quick Login</h2>
          <p className="text-xs text-[#64748B]">
            Authenticates directly against real Kaushal backend and MongoDB Atlas seed.
          </p>
        </div>

        {/* Action Grid */}
        <div className="flex flex-col gap-3">
          {SEED_USERS.map((r) => {
            const Icon = r.icon;
            const isLoading = loadingRole === r.roleKey;
            return (
              <button
                key={r.roleKey}
                disabled={!!loadingRole}
                onClick={() => handleRealLogin(r.email, r.password, r.redirectPath, r.roleKey)}
                className={`w-full flex items-center justify-between p-4 border border-[#E2E8F0] rounded-lg text-left transition-all ${r.hoverBg} cursor-pointer group disabled:opacity-50`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${r.bgColor} shadow-inner`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[#0F172A]">{r.name}</h4>
                    <p className="text-[10px] text-[#64748B] font-mono mt-0.5">{r.email}</p>
                  </div>
                </div>
                <div className="text-[10px] font-bold text-[#94A3B8] group-hover:text-[#0F172A] uppercase tracking-wider transition-colors flex items-center gap-1">
                  {isLoading ? 'Authenticating...' : 'Login →'}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
