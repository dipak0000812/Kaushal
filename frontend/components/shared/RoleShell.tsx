'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Role } from '@/lib/types';
import { 
  LayoutDashboard, 
  Briefcase, 
  FileText, 
  Sparkles, 
  PlusCircle, 
  Users, 
  CheckSquare, 
  LineChart, 
  LogOut, 
  User as UserIcon,
  ShieldCheck,
  Building2,
  Bell,
  ChevronDown
} from 'lucide-react';

const getRoleDisplayName = (role: Role) => {
  switch (role) {
    case Role.TNP: return 'T&P Officer';
    case Role.HOD: return 'HOD (CS)';
    case Role.FACULTY: return 'Faculty Mentor';
    default: return role.toUpperCase();
  }
};

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

interface RoleShellProps {
  role: Role;
  children: React.ReactNode;
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<any>;
}

export default function RoleShell({ role, children }: RoleShellProps) {
  const pathname = usePathname();
  const router = useRouter();

  const [userName, setUserName] = React.useState('');
  const [userInitials, setUserInitials] = React.useState('');

  React.useEffect(() => {
    const getCookie = (name: string) => {
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) return parts.pop()?.split(';').shift();
      return null;
    };
    const token = getCookie('kaushal_token') || getCookie('token');
    if (token) {
      const decoded = decodeJwt(token);
      if (decoded && decoded.name) {
        setUserName(decoded.name);
        const nameParts = decoded.name.split(' ');
        const initials = nameParts.map((n: string) => n[0]).join('').toUpperCase();
        setUserInitials(initials.slice(0, 2));
      }
    }
  }, []);

  const defaultName = getRoleDisplayName(role);
  const defaultInitials = role.slice(0, 2).toUpperCase();

  const currentUserName = userName || defaultName;
  const currentUserInitials = userInitials || defaultInitials;

  // Define nav items for each role
  const getNavItems = (): NavItem[] => {
    switch (role) {
      case Role.STUDENT:
        return [
          { label: 'Dashboard', href: '/student', icon: LayoutDashboard },
          { label: 'Applications', href: '/student/applications', icon: FileText },
          { label: 'Recommendations', href: '/student/recommendations', icon: Sparkles },
          { label: 'Progress log', href: '/student/progress', icon: CheckSquare },
          { label: 'Documents', href: '/student/documents', icon: FileText },
        ];
      case Role.COMPANY:
        return [
          { label: 'Dashboard', href: '/company', icon: LayoutDashboard },
          { label: 'Post Internship', href: '/company/postings/new', icon: PlusCircle },
        ];
      case Role.FACULTY:
        return [
          { label: 'Dashboard', href: '/faculty', icon: LayoutDashboard },
        ];
      case Role.TNP:
        return [
          { label: 'Dashboard', href: '/tp', icon: LayoutDashboard },
          { label: 'Verification Queue', href: '/tp/verification-queue', icon: ShieldCheck },
          { label: 'Companies', href: '/tp/companies', icon: Building2 },
          { label: 'Users Manager', href: '/tp/users', icon: Users },
          { label: 'Analytics', href: '/tp/analytics', icon: LineChart },
        ];
      case Role.HOD:
        return [
          { label: 'Dashboard', href: '/hod', icon: LayoutDashboard },
        ];
      default:
        return [];
    }
  };

  const navItems = getNavItems();

  const handleLogout = () => {
    // Clear token from cookie
    document.cookie = 'kaushal_token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT';
    document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT';
    // Clear localStorage
    localStorage.removeItem('kaushal_token');
    router.push('/login');
  };



  return (
    <div className="min-h-screen bg-[#F8FAFC] flex text-[#0F172A]">
      {/* Sidebar - Fixed 240px */}
      <aside className="w-[240px] bg-white border-r border-[#E2E8F0] flex flex-col fixed inset-y-0 left-0 z-20">
        {/* Brand Header */}
        <div className="h-16 px-6 border-b border-[#E2E8F0] flex items-center gap-2">
          <div className="w-8 h-8 rounded-md bg-[#5B21B6] flex items-center justify-center text-white font-bold text-lg">
            K
          </div>
          <div>
            <h1 className="font-semibold text-base leading-tight">Kaushal</h1>
            <span className="text-xs text-[#EA580C] font-semibold tracking-wider uppercase">Verified Portal</span>
          </div>
        </div>

        {/* Nav Items */}
        <nav className="flex-1 px-4 py-6 space-y-1">
          {navItems.map((item) => {
            const isDashboard = ['/student', '/company', '/faculty', '/tp', '/hod'].includes(item.href);
            const isActive = isDashboard ? pathname === item.href : (pathname === item.href || pathname.startsWith(item.href + '/'));
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-[#EDE9FE] text-[#5B21B6]'
                    : 'text-[#475569] hover:bg-[#F1F5F9] hover:text-[#0F172A]'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-[#5B21B6]' : 'text-[#94A3B8]'}`} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User profile footer */}
        <div className="p-4 border-t border-[#E2E8F0] bg-[#F8FAFC] flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#EDE9FE] text-[#5B21B6] flex items-center justify-center font-bold text-xs shadow-inner">
              {currentUserInitials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-[#475569] truncate">
                {currentUserName}
              </p>
              <p className="text-[11px] text-[#94A3B8] truncate leading-tight">
                {role}@ghr.edu
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 mt-2 px-3 py-2 border border-[#E2E8F0] bg-white rounded-md text-xs font-semibold text-[#B91C1C] hover:bg-[#FEE2E2] hover:border-[#FCA5A5] transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Logout
          </button>
          <Link
            href="/dev/login"
            className="w-full flex items-center justify-center gap-2 mt-1.5 px-3 py-2 border border-[#E2E8F0] bg-white rounded-md text-xs font-semibold text-[#5B21B6] hover:bg-[#EDE9FE] hover:border-[#DDD6FE] transition-colors"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Switch Role (Dev)
          </Link>
        </div>
      </aside>

      {/* Main Canvas Area */}
      <div className="pl-[240px] flex-1 flex flex-col min-h-screen">
        {/* Topbar */}
        <header className="h-16 bg-white border-b border-[#E2E8F0] px-8 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-[#475569]">Workspace</span>
            <span className="text-xs text-[#94A3B8]">/</span>
            <span className="text-sm font-semibold text-[#0F172A] capitalize">{role} Portal</span>
          </div>
          <div className="flex items-center gap-4">
            {role === Role.TNP && (
              <span className="bg-[#FEF3C7] text-[#D97706] text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wide">
                Admin Mode
              </span>
            )}
            <span className="text-xs font-medium text-[#64748B]">GHR COE Nagpur</span>
            <div className="w-px h-6 bg-[#E2E8F0]"></div>
            
            {/* Grouped control container on the right edge */}
            <div className="flex items-center gap-3">
              <button className="text-[#64748B] hover:text-[#0F172A] relative transition-colors cursor-pointer p-1">
                <Bell className="w-4 h-4" />
                <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-[#EA580C] rounded-full"></span>
              </button>
              <div className="flex items-center gap-2 cursor-pointer select-none group">
                <div className="w-8 h-8 rounded-full bg-[#EDE9FE] text-[#5B21B6] flex items-center justify-center font-bold text-xs shadow-inner">
                  {currentUserInitials}
                </div>
                <span className="text-xs font-semibold text-[#334155] group-hover:text-[#0F172A] transition-colors max-w-[120px] truncate font-sans">
                  {currentUserName}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-[#64748B] group-hover:text-[#0F172A] transition-colors" />
              </div>
            </div>
          </div>
        </header>

        {/* Content Canvas */}
        <main className="flex-1 p-8">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
