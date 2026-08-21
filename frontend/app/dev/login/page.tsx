/* 
 * DEVELOPMENT-ONLY MOCK LOGIN UTILITY
 * 
 * NOTE: This page is scaffolding to unblock manual QA before Phase 6 (Public Lane / auth) is built.
 * Exclude this file from production builds or remove it during Phase 6 deployment.
 */

'use client';

import React from 'react';
import { ShieldCheck, User, Users, GraduationCap, Building2, UserCog, RotateCcw } from 'lucide-react';
import { resetMockState } from '@/lib/api/client';

const ROLES = [
  {
    name: 'Student',
    roleKey: 'student',
    redirectPath: '/student',
    icon: GraduationCap,
    bgColor: 'bg-[#EDE9FE] text-[#5B21B6]',
    hoverBg: 'hover:bg-[#DDD6FE]',
    email: 'student@ghr.edu',
    userId: 'user-student-1',
  },
  {
    name: 'T&P Officer',
    roleKey: 'tnp',
    redirectPath: '/tp',
    icon: ShieldCheck,
    bgColor: 'bg-[#F0F9FF] text-[#0284C7]',
    hoverBg: 'hover:bg-[#E0F2FE]',
    email: 'tnp@ghr.edu',
    userId: 'user-tnp-1',
  },
  {
    name: 'Faculty Mentor',
    roleKey: 'faculty',
    redirectPath: '/faculty',
    icon: Users,
    bgColor: 'bg-[#ECFDF5] text-[#059669]',
    hoverBg: 'hover:bg-[#D1FAE5]',
    email: 'faculty@ghr.edu',
    userId: 'user-faculty-1',
  },
  {
    name: 'Company HR',
    roleKey: 'company',
    redirectPath: '/company',
    icon: Building2,
    bgColor: 'bg-[#FFF7ED] text-[#EA580C]',
    hoverBg: 'hover:bg-[#FFEDD5]',
    email: 'hr@tcs.com',
    userId: 'user-company-1',
  },
  {
    name: 'Head of Department',
    roleKey: 'hod',
    redirectPath: '/hod',
    icon: UserCog,
    bgColor: 'bg-[#FFF5F5] text-[#E11D48]',
    hoverBg: 'hover:bg-[#FFE4E6]',
    email: 'hod@ghr.edu',
    userId: 'user-hod-1',
  },
];

export default function DevLoginPage() {
  const handleMockLogin = (roleKey: string, email: string, userId: string, redirectPath: string) => {
    // Generate a mock JWT structure: header.payload.signature
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payload = btoa(
      JSON.stringify({
        role: roleKey,
        userId: userId,
        email: email,
        name: `Mock ${roleKey.toUpperCase()} User`,
      })
    );
    const mockJwt = `${header}.${payload}.dummysignature`;

    // Set cookies matching middleware.ts expectation (kaushal_token and token)
    document.cookie = `kaushal_token=${mockJwt}; path=/; max-age=86400; SameSite=Lax`;
    document.cookie = `token=${mockJwt}; path=/; max-age=86400; SameSite=Lax`;

    // Also populate localStorage just in case client APIs read it
    localStorage.setItem('kaushal_token', mockJwt);

    // Redirect to the corresponding dashboard using window.location to force a full middleware reload
    window.location.href = redirectPath;
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-center items-center p-6">
      <div className="max-w-md w-full bg-white border border-[#E2E8F0] rounded-xl shadow-lg p-8 space-y-6">
        
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-lg bg-[#5B21B6] text-white flex items-center justify-center font-bold text-2xl mx-auto shadow-md">
            K
          </div>
          <h2 className="text-xl font-bold text-[#0F172A]">Dev Mock Login Console</h2>
          <p className="text-xs text-[#64748B]">
            Simulate role-based JWT claims to authorize routes gated by <code>middleware.ts</code>.
          </p>
        </div>

        {/* Warning Banner */}
        <div className="bg-[#FFF8F2] border border-[#FDE8D4] rounded-lg p-4 text-xs text-[#C2410C] space-y-1">
          <h4 className="font-bold">Scaffolding Active (QA Only)</h4>
          <p className="leading-relaxed">
            This is a mock authentication portal. Clicking any role will write a mock token to your browser's cookies and immediately redirect you.
          </p>
        </div>

        {/* Action Grid */}
        <div className="flex flex-col gap-3">
          {ROLES.map((r) => {
            const Icon = r.icon;
            return (
              <button
                key={r.roleKey}
                onClick={() => handleMockLogin(r.roleKey, r.email, r.userId, r.redirectPath)}
                className={`w-full flex items-center justify-between p-4 border border-[#E2E8F0] rounded-lg text-left transition-all ${r.hoverBg} cursor-pointer group`}
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
                  Login &rarr;
                </div>
              </button>
            );
          })}
        </div>

        {/* Reset Mock Database */}
        <div className="border-t border-[#E2E8F0] pt-4 mt-2">
          <button
            onClick={() => {
              resetMockState();
              alert('Mock database arrays and profiles have been reset to their initial seed state!');
            }}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#475569] hover:text-[#0F172A] rounded-lg text-xs font-bold transition-all border border-[#E2E8F0] cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Demo Data
          </button>
        </div>

      </div>
    </div>
  );
}
