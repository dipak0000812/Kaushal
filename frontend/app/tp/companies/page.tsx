'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { Role } from '@/lib/types';
import RoleShell from '@/components/shared/RoleShell';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { 
  Building2, 
  Mail, 
  Send, 
  CheckCircle, 
  Clock, 
  KeyRound, 
  Copy,
  Plus
} from 'lucide-react';
import toast from 'react-hot-toast';

const inviteSchema = z.object({
  companyName: z.string().min(2, { message: 'Company name must be at least 2 characters.' }),
  contactEmail: z.string().email({ message: 'Must be a valid email address.' }),
});

type InviteFormValues = z.infer<typeof inviteSchema>;

export default function TnpCompaniesPage() {
  const queryClient = useQueryClient();
  const [inviteResult, setInviteResult] = useState<{ token: string; expiresAt: string } | null>(null);

  // 1. Fetch Companies
  const { data: companiesRes, isLoading } = useQuery({
    queryKey: ['tnp-companies'],
    queryFn: () => (apiClient.tnp as any).getCompanies(),
  });

  const companies = companiesRes?.data || [];

  // 2. Form Setup
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<InviteFormValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      companyName: '',
      contactEmail: '',
    },
  });

  // 3. Invite Mutation
  const inviteMutation = useMutation({
    mutationFn: (body: InviteFormValues) => apiClient.tnp.createInvite(body),
    onSuccess: (res) => {
      if (res.success && res.data) {
        setInviteResult({
          token: res.data.inviteToken,
          expiresAt: res.data.expiresAt,
        });
        reset();
      } else {
        toast.error(`Failed to create invite: ${res.error?.message}`);
      }
    },
  });

  // 4. Verify Mutation
  const verifyCompanyMutation = useMutation({
    mutationFn: (id: string) => apiClient.tnp.verifyCompany(id),
    onSuccess: (res) => {
      if (res.success) {
        queryClient.invalidateQueries({ queryKey: ['tnp-companies'] });
        queryClient.invalidateQueries({ queryKey: ['pending-internships'] });
        queryClient.invalidateQueries({ queryKey: ['tnp-alerts'] });
        toast.success('Company verified successfully! All pending postings for this company are auto-published.');
      } else {
        toast.error(`Failed to verify company: ${res.error?.message}`);
      }
    },
  });

  const onInviteSubmit = (data: InviteFormValues) => {
    inviteMutation.mutate(data);
  };

  const handleCopyToken = () => {
    if (!inviteResult) return;
    navigator.clipboard.writeText(inviteResult.token);
    toast.success('Invite token copied to clipboard!');
  };

  return (
    <RoleShell role={Role.TNP}>
      <div className="space-y-8">
        
        {/* Header */}
        <div>
          <h2 className="text-xl font-bold text-[#0F172A] flex items-center gap-2">
            <Building2 className="w-5 h-5 text-[#16A34A]" />
            Corporate Partner Directory
          </h2>
          <p className="text-xs text-[#64748B] mt-0.5">
            Authorize recruiter accounts and generate placement registration tokens.
          </p>
        </div>

        {/* Inviterecruiter section */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          
          {/* Left Column: Invite Form */}
          <div className="lg:col-span-1 bg-white border border-[#E2E8F0] rounded-lg p-5 space-y-4">
            <h3 className="text-xs font-bold text-[#475569] uppercase tracking-wider flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-[#16A34A]" />
              Invite Recruiter
            </h3>
            
            <form onSubmit={handleSubmit(onInviteSubmit)} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-[#475569] uppercase tracking-wider mb-2">Company Name</label>
                <input
                  {...register('companyName')}
                  type="text"
                  placeholder="e.g. Google India"
                  className="w-full text-xs p-3 border border-[#E2E8F0] bg-[#F8FAFC] rounded-md focus:outline-none focus:border-[#5B21B6] focus:bg-white"
                />
                {errors.companyName && (
                  <span className="text-[10px] text-[#DC2626] font-semibold mt-1 block">
                    {errors.companyName.message}
                  </span>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#475569] uppercase tracking-wider mb-2">Contact Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 w-4 h-4 text-[#94A3B8]" />
                  <input
                    {...register('contactEmail')}
                    type="text"
                    placeholder="e.g. hr@google.com"
                    className="w-full text-xs pl-10 pr-3 py-3 border border-[#E2E8F0] bg-[#F8FAFC] rounded-md focus:outline-none focus:border-[#5B21B6] focus:bg-white"
                  />
                </div>
                {errors.contactEmail && (
                  <span className="text-[10px] text-[#DC2626] font-semibold mt-1 block">
                    {errors.contactEmail.message}
                  </span>
                )}
              </div>

              <button
                type="submit"
                disabled={inviteMutation.isPending}
                className="w-full py-2.5 bg-[#16A34A] hover:bg-[#15803D] disabled:bg-[#86EFAC] text-white text-xs font-bold rounded shadow cursor-pointer transition-colors flex items-center justify-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                {inviteMutation.isPending ? 'Generating invite...' : 'Generate Invite Token'}
              </button>
            </form>

            {/* Invite Token result panel */}
            {inviteResult && (
              <div className="bg-[#F0F9FF] border border-[#BAE6FD] rounded-md p-4 space-y-3">
                <div className="flex gap-2 text-xs text-[#0369A1] font-bold items-center">
                  <KeyRound className="w-4 h-4 text-[#0284C7]" />
                  <span>Invite Token Generated</span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={inviteResult.token}
                    className="w-full text-xs font-mono p-2 bg-white border border-[#BAE6FD] rounded focus:outline-none select-all"
                  />
                  <button
                    onClick={handleCopyToken}
                    className="p-2 border border-[#BAE6FD] bg-white hover:bg-[#E0F2FE] rounded cursor-pointer transition-colors"
                    title="Copy token"
                  >
                    <Copy className="w-4 h-4 text-[#0284C7]" />
                  </button>
                </div>
                <p className="text-[10px] text-[#0284C7] leading-relaxed">
                  Send this token to the recruiter. It expires on {new Date(inviteResult.expiresAt).toLocaleDateString()}.
                </p>
              </div>
            )}
          </div>

          {/* Right Column: Corporate Registry Table */}
          <div className="lg:col-span-2 space-y-4">
            <h3 className="text-xs font-bold text-[#475569] uppercase tracking-wider">Corporate Partners Registry</h3>
            
            {isLoading ? (
              <div className="bg-white border border-[#E2E8F0] p-10 text-center rounded-lg">
                <span className="text-xs text-[#64748B] font-semibold animate-pulse">Loading directory...</span>
              </div>
            ) : (
              <div className="bg-white border border-[#E2E8F0] rounded-lg overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[10px] font-bold text-[#475569] uppercase tracking-wider">
                      <th className="p-4">Recruiter Profile</th>
                      <th className="p-4">Contact Email</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F1F5F9] text-xs text-[#334155]">
                    {companies.map((company: any) => {
                      const isVerified = company.status === 'verified';

                      return (
                        <tr key={company.id} className="hover:bg-[#F8FAFC] transition-colors">
                          <td className="p-4">
                            <span className="text-[10px] font-mono text-[#94A3B8] block">ID: {company.id}</span>
                            <span className="font-bold block mt-0.5">{company.companyName}</span>
                          </td>
                          <td className="p-4 font-mono text-xs">{company.contactEmail}</td>
                          <td className="p-4">
                            {isVerified ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#DCFCE7] text-[#16A34A] border border-[#BBF7D0]">
                                <CheckCircle className="w-3 h-3" /> verified
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FEF3C7] text-[#D97706] border border-[#FDE68A]">
                                <Clock className="w-3 h-3 animate-pulse" /> pending
                              </span>
                            )}
                          </td>
                          <td className="p-4 text-right">
                            {!isVerified && (
                              <button
                                onClick={() => verifyCompanyMutation.mutate(company.id)}
                                disabled={verifyCompanyMutation.isPending}
                                className="px-3 py-1.5 bg-[#5B21B6] hover:bg-[#4C1D95] text-white text-xs font-bold rounded shadow-sm cursor-pointer transition-colors"
                              >
                                Verify Corporate
                              </button>
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
