'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Role } from '@/lib/types';
import { resetMockState } from '@/lib/api/client';
import { useQueryClient } from '@tanstack/react-query';
import toast, { Toaster } from 'react-hot-toast';
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
  ChevronDown,
  RefreshCw
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
  const queryClient = useQueryClient();

  const [userName, setUserName] = React.useState('');
  const [userInitials, setUserInitials] = React.useState('');
  const [dropdownOpen, setDropdownOpen] = React.useState(false);

  React.useEffect(() => {
    if (!dropdownOpen) return;
    const handleOutsideClick = () => setDropdownOpen(false);
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, [dropdownOpen]);

  const handleResetDemo = () => {
    resetMockState();
    queryClient.clear();
    toast.success('Demo state statefully reset to initial database snapshot!');
    router.refresh();
  };

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

      </aside>


      {/* Main Canvas Area */}
      <div className="pl-[240px] flex-1 flex flex-col min-h-screen">
        {/* Topbar */}
        <header className="h-16 bg-white border-b border-[#E2E8F0] px-8 flex items-center justify-between sticky top-0 z-10">
          <div className="flex flex-col justify-center">
            <span className="text-[11px] text-[#64748B] font-medium leading-none mb-1 font-sans">GH Raisoni College</span>
            <span className="text-sm font-bold text-[#0F172A] leading-none font-sans">
              {role === Role.STUDENT ? 'Student Workspace' : 
               role === Role.TNP ? 'T&P Portal' : 
               role === Role.FACULTY ? 'Faculty Workspace' : 
               role === Role.COMPANY ? 'Recruiter Portal' : 
               role === Role.HOD ? 'HOD Portal' : `${getRoleDisplayName(role)} Workspace`}
            </span>
          </div>
          <div className="flex items-center gap-4">
            {/* {role === Role.TNP && (
              <span className="bg-[#FEF3C7] text-[#D97706] text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wide">
                Admin Mode
              </span>
            )} */}
            
            <div className="flex items-center gap-3">
              <button className="text-[#64748B] hover:text-[#0F172A] relative transition-colors cursor-pointer p-1">
                <Bell className="w-4 h-4" />
              </button>
              
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDropdownOpen(!dropdownOpen);
                  }}
                  className="flex items-center gap-2 cursor-pointer select-none border border-[#E2E8F0] p-1 pr-3 rounded-lg bg-white hover:bg-[#F8FAFC] transition-colors text-left"
                >
                  <div className="w-7 h-7 rounded-full bg-[#EDE9FE] text-[#5B21B6] flex items-center justify-center font-bold text-xs shadow-inner shrink-0">
                    {currentUserInitials}
                  </div>
                  <span className="text-xs font-semibold text-[#334155] group-hover:text-[#0F172A] transition-colors max-w-[120px] truncate font-sans">
                    {currentUserName}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-[#64748B] group-hover:text-[#0F172A] transition-colors shrink-0" />
                </button>
                
                {/* Dropdown Menu */}
                {dropdownOpen && (
                  <div className="absolute right-0 top-full mt-1.5 w-48 bg-white border border-[#E2E8F0] rounded-xl shadow-lg py-1 z-30 overflow-hidden font-sans">
                    <button
                      onClick={() => {
                        setDropdownOpen(false);
                        toast.success('Profile editing is locked for the demo.');
                      }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-bold text-[#334155] hover:bg-[#F8FAFC] transition-colors text-left border-b border-[#E2E8F0] cursor-pointer animate-in fade-in slide-in-from-top-1 duration-100"
                    >
                      <UserIcon className="w-4 h-4 text-[#64748B]" />
                      Edit Profile
                    </button>
                    <button
                      onClick={() => {
                        setDropdownOpen(false);
                        handleLogout();
                      }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-bold text-[#B91C1C] hover:bg-[#FFF5F5] transition-colors text-left cursor-pointer animate-in fade-in slide-in-from-top-1 duration-100"
                    >
                      <LogOut className="w-4 h-4 text-[#B91C1C]" />
                      Log Out
                    </button>
                  </div>
                )}
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

      {/* Floating Demo Reset Button */}
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={handleResetDemo}
          title="Reset Mock State to Initial Seeds"
          className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-100 text-xs font-bold rounded-full shadow-2xl border border-slate-700 cursor-pointer transition-all hover:scale-105 active:scale-95 group"
        >
          <RefreshCw className="w-3.5 h-3.5 group-hover:rotate-180 transition-transform duration-500 text-violet-400" />
          <span>Reset Demo State</span>
        </button>
      </div>

      <Toaster position="top-center" reverseOrder={false} />
    </div>
  );
}
