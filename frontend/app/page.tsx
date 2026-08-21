'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getToken } from '@/lib/api/client';

function decodeJwt(token: string): any {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(payload);
  } catch (e) {
    return null;
  }
}

const ROLE_REDIRECT_MAP: Record<string, string> = {
  student: '/student',
  tnp: '/tp',
  company: '/company',
  faculty: '/faculty',
  hod: '/hod',
};

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const token = getToken();
    if (token) {
      const decoded = decodeJwt(token);
      const target = (decoded?.role && ROLE_REDIRECT_MAP[decoded.role]) || '/login';
      router.replace(target);
    } else {
      router.replace('/login');
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="text-sm font-semibold text-slate-400 animate-pulse">
        Redirecting to Kaushal Portal...
      </div>
    </div>
  );
}
