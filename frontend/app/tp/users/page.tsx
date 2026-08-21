'use client';

import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { Role } from '@/lib/types';
import RoleShell from '@/components/shared/RoleShell';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { 
  Users2, 
  UserPlus, 
  Mail, 
  BookOpen, 
  UserCheck, 
  ShieldAlert,
  Plus
} from 'lucide-react';
import toast from 'react-hot-toast';

const userFormSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters.' }),
  email: z.string().email({ message: 'Must be a valid email address.' }),
  role: z.enum(['faculty', 'hod']),
  department: z.string().min(2, { message: 'Department name is required.' }),
});

type UserFormValues = z.infer<typeof userFormSchema>;

export default function TnpUsersPage() {
  const queryClient = useQueryClient();

  // 1. Fetch Users List
  const { data: usersRes, isLoading } = useQuery({
    queryKey: ['tnp-users'],
    queryFn: () => (apiClient.tnp as any).getUsers(),
  });

  const users = usersRes?.data || [];

  // 2. Form Setup
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      name: '',
      email: '',
      role: 'faculty',
      department: '',
    },
  });

  // 3. Create User Mutation
  const createUserMutation = useMutation({
    mutationFn: (body: UserFormValues) => apiClient.tnp.createUser(body),
    onSuccess: (res) => {
      if (res.success) {
        queryClient.invalidateQueries({ queryKey: ['tnp-users'] });
        reset();
        toast.success('Academic account created successfully!');
      } else {
        toast.error(`Failed to create account: ${res.error?.message || 'Conflict / Duplicate Email'}`);
      }
    },
  });

  const onUserSubmit = (data: UserFormValues) => {
    createUserMutation.mutate(data);
  };

  return (
    <RoleShell role={Role.TNP}>
      <div className="space-y-8">
        
        {/* Header */}
        <div>
          <h2 className="text-xl font-bold text-[#0F172A] flex items-center gap-2">
            <Users2 className="w-5 h-5 text-[#D97706]" />
            Academic Account Provisioning
          </h2>
          <p className="text-xs text-[#64748B] mt-0.5">
            Provision logins for Faculty Mentors and Heads of Department (HODs) to enable oversight.
          </p>
        </div>

        {/* Create and List sections */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          
          {/* Left Column: Account Form */}
          <div className="lg:col-span-1 bg-white border border-[#E2E8F0] rounded-lg p-5 space-y-4 shadow-sm">
            <h3 className="text-xs font-bold text-[#475569] uppercase tracking-wider flex items-center gap-1.5">
              <UserPlus className="w-4 h-4 text-[#D97706]" />
              Provision Account
            </h3>
            
            <form onSubmit={handleSubmit(onUserSubmit)} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-[#475569] uppercase tracking-wider mb-2">Full Name</label>
                <input
                  {...register('name')}
                  type="text"
                  placeholder="e.g. Dr. Vivek Kumar"
                  className="w-full text-xs p-3 border border-[#E2E8F0] bg-[#F8FAFC] rounded-md focus:outline-none focus:border-[#5B21B6] focus:bg-white"
                />
                {errors.name && (
                  <span className="text-[10px] text-[#DC2626] font-semibold mt-1 block">
                    {errors.name.message}
                  </span>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#475569] uppercase tracking-wider mb-2">Academic Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 w-4 h-4 text-[#94A3B8]" />
                  <input
                    {...register('email')}
                    type="text"
                    placeholder="e.g. vivek@kaushal.edu"
                    className="w-full text-xs pl-10 pr-3 py-3 border border-[#E2E8F0] bg-[#F8FAFC] rounded-md focus:outline-none focus:border-[#5B21B6] focus:bg-white font-mono"
                  />
                </div>
                {errors.email && (
                  <span className="text-[10px] text-[#DC2626] font-semibold mt-1 block">
                    {errors.email.message}
                  </span>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#475569] uppercase tracking-wider mb-2">Department</label>
                <div className="relative">
                  <BookOpen className="absolute left-3 top-3 w-4 h-4 text-[#94A3B8]" />
                  <input
                    {...register('department')}
                    type="text"
                    placeholder="e.g. Computer Science"
                    className="w-full text-xs pl-10 pr-3 py-3 border border-[#E2E8F0] bg-[#F8FAFC] rounded-md focus:outline-none focus:border-[#5B21B6] focus:bg-white"
                  />
                </div>
                {errors.department && (
                  <span className="text-[10px] text-[#DC2626] font-semibold mt-1 block">
                    {errors.department.message}
                  </span>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#475569] uppercase tracking-wider mb-2">System Role</label>
                <select
                  {...register('role')}
                  className="w-full text-xs p-3 border border-[#E2E8F0] bg-[#F8FAFC] rounded-md focus:outline-none focus:border-[#5B21B6] focus:bg-white"
                >
                  <option value="faculty">Faculty Mentor</option>
                  <option value="hod">Head of Department (HOD)</option>
                </select>
                {errors.role && (
                  <span className="text-[10px] text-[#DC2626] font-semibold mt-1 block">
                    {errors.role.message}
                  </span>
                )}
              </div>

              <button
                type="submit"
                disabled={createUserMutation.isPending}
                className="w-full py-2.5 bg-[#D97706] hover:bg-[#B45309] disabled:bg-[#FCD34D] text-white text-xs font-bold rounded shadow cursor-pointer transition-colors flex items-center justify-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                {createUserMutation.isPending ? 'Provisioning...' : 'Provision User Account'}
              </button>
            </form>
          </div>

          {/* Right Column: User Registry */}
          <div className="lg:col-span-2 space-y-4">
            <h3 className="text-xs font-bold text-[#475569] uppercase tracking-wider">Authorized Academic Users</h3>
            
            {isLoading ? (
              <div className="bg-white border border-[#E2E8F0] p-10 text-center rounded-lg">
                <span className="text-xs text-[#64748B] font-semibold animate-pulse">Loading directory...</span>
              </div>
            ) : (
              <div className="bg-white border border-[#E2E8F0] rounded-lg overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[10px] font-bold text-[#475569] uppercase tracking-wider">
                      <th className="p-4">User Name</th>
                      <th className="p-4">Academic Email</th>
                      <th className="p-4">Department Scope</th>
                      <th className="p-4">Authorized Role</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F1F5F9] text-xs text-[#334155]">
                    {users.map((user: any) => {
                      const isHod = user.role === 'hod';

                      return (
                        <tr key={user.email} className="hover:bg-[#F8FAFC] transition-colors">
                          <td className="p-4 font-bold">{user.name}</td>
                          <td className="p-4 font-mono text-xs">{user.email}</td>
                          <td className="p-4">{user.department}</td>
                          <td className="p-4">
                            {isHod ? (
                              <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#EDE9FE] text-[#5B21B6] border border-[#DDD6FE]">
                                HOD
                              </span>
                            ) : (
                              <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#F0F9FF] text-[#0284C7] border border-[#BAE6FD]">
                                FACULTY
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          
        </section>

      </div>
    </RoleShell>
  );
}
