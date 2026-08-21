'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueries, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { Role, ApplicationStatus, Internship } from '@/lib/types';
import RoleShell from '@/components/shared/RoleShell';
import Link from 'next/link';
import WhatsNextPanel from '@/components/shared/WhatsNextPanel';
import toast, { Toaster } from 'react-hot-toast';
import { Building2, Plus, ArrowUpRight, CheckCircle, Clock, AlertCircle, XCircle, Edit, AlertTriangle } from 'lucide-react';

export default function CompanyDashboard() {
  const queryClient = useQueryClient();
  const [editingInternship, setEditingInternship] = useState<Internship | null>(null);
  const [closingInternshipId, setClosingInternshipId] = useState<string | null>(null);

  // Edit form state
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    duration: '',
    mode: 'remote',
    vacancies: 1,
    lastDate: '',
    minCgpa: 6.0,
    maxBacklogs: 0,
    departments: 'Computer Science and Engineering',
    requiredSkills: '',
    requiredCerts: '',
  });

  // 1. Fetch company postings
  const { data: internshipsRes, isLoading: isInternshipsLoading } = useQuery({
    queryKey: ['company-internships'],
    queryFn: () => apiClient.company.getInternships(),
  });

  const internships = internshipsRes?.data || [];

  // 2. Fetch applicants for all postings in parallel using useQueries
  const applicantsQueries = useQueries({
    queries: internships.map((i) => ({
      queryKey: ['company-applicants', i.id],
      queryFn: () => apiClient.company.getApplicants(i.id!),
      enabled: !!i.id,
    })),
  });

  const isApplicantsLoading = applicantsQueries.some((q) => q.isLoading);
  const isLoading = isInternshipsLoading || isApplicantsLoading;

  // 3. Aggregate metrics
  const totalPostings = internships.length;
  const activePostings = internships.filter((i) => i.status === 'open').length;

  const totalApplicants = applicantsQueries.reduce((acc, q) => {
    const list = q.data?.data || [];
    return acc + list.length;
  }, 0);

  const placedStates = [
    ApplicationStatus.ACCEPTED,
    ApplicationStatus.MENTOR_PENDING,
    ApplicationStatus.MENTOR_ASSIGNED,
    ApplicationStatus.IN_PROGRESS,
    ApplicationStatus.COMPLETED,
  ];

  const totalPlaced = applicantsQueries.reduce((acc, q) => {
    const list = q.data?.data || [];
    return acc + list.filter((a) => placedStates.includes(a.currentStatus)).length;
  }, 0);

  // 4. Mutations
  const closeMutation = useMutation({
    mutationFn: (id: string) => apiClient.company.closeInternship(id),
    onSuccess: (res) => {
      if (res.success) {
        queryClient.invalidateQueries({ queryKey: ['company-internships'] });
        queryClient.invalidateQueries({ queryKey: ['internships'] });
        toast.success('Internship posting closed successfully.');
        setClosingInternshipId(null);
      } else {
        toast.error(`Failed to close posting: ${res.error?.message}`);
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) =>
      apiClient.company.updateInternshipCriteria(id, payload),
    onSuccess: (res) => {
      if (res.success) {
        queryClient.invalidateQueries({ queryKey: ['company-internships'] });
        queryClient.invalidateQueries({ queryKey: ['internships'] });
        toast.success('Posting and criteria updated successfully!');
        setEditingInternship(null);
      } else {
        toast.error(`Update failed: ${res.error?.message}`);
      }
    },
  });

  const handleOpenEdit = (job: Internship) => {
    setEditingInternship(job);
    const criteria = job.criteria || ({} as any);
    const depts = Array.isArray(criteria.departments)
      ? criteria.departments.join(', ')
      : criteria.department || '';

    setEditForm({
      title: job.title || '',
      description: job.description || '',
      duration: job.duration || '3 months',
      mode: job.mode || 'remote',
      vacancies: job.vacancies || 1,
      lastDate: job.lastDate ? new Date(job.lastDate).toISOString().split('T')[0] : '',
      minCgpa: criteria.minCgpa ?? 6.0,
      maxBacklogs: criteria.maxBacklogs ?? 0,
      departments: depts,
      requiredSkills: (criteria.requiredSkills || []).join(', '),
      requiredCerts: (criteria.requiredCerts || []).join(', '),
    });
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingInternship) return;

    const deptsArray = editForm.departments
      .split(',')
      .map((d) => d.trim())
      .filter(Boolean);
    const skillsArray = editForm.requiredSkills
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const certsArray = editForm.requiredCerts
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean);

    const payload = {
      title: editForm.title.trim(),
      description: editForm.description.trim(),
      duration: editForm.duration.trim(),
      mode: editForm.mode,
      vacancies: Number(editForm.vacancies),
      lastDate: editForm.lastDate ? new Date(editForm.lastDate).toISOString() : undefined,
      criteria: {
        minCgpa: Number(editForm.minCgpa),
        maxBacklogs: Number(editForm.maxBacklogs),
        departments: deptsArray,
        requiredSkills: skillsArray,
        requiredCerts: certsArray,
      },
    };

    updateMutation.mutate({ id: editingInternship.id, payload });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#DCFCE7] text-[#16A34A] border border-[#BBF7D0]">
            <CheckCircle className="w-3 h-3" /> Published
          </span>
        );
      case 'pendingApproval':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#FEF3C7] text-[#D97706] border border-[#FDE68A]">
            <Clock className="w-3 h-3" /> Pending Approval
          </span>
        );
      case 'closed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#F1F5F9] text-[#475569] border border-[#E2E8F0]">
            <XCircle className="w-3 h-3" /> Closed
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <RoleShell role={Role.COMPANY}>
      <Toaster position="top-center" />
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-[#0F172A] flex items-center gap-2">
              <Building2 className="w-5 h-5 text-[#EA580C]" />
              Recruiter Dashboard
            </h2>
            <p className="text-xs text-[#64748B] mt-0.5">
              Manage corporate postings, update eligibility criteria, and evaluate candidate pipelines.
            </p>
          </div>

          <Link
            href="/company/postings/new"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-bold rounded-lg shadow-sm transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Create Posting
          </Link>
        </div>

        {/* WhatsNextPanel action indicator */}
        <WhatsNextPanel role={Role.COMPANY} />

        {isLoading ? (
          <div className="flex items-center justify-center min-h-[300px]">
            <span className="text-xs text-[#64748B] font-semibold animate-pulse">Loading recruiter console...</span>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <div className="bg-white border border-[#E2E8F0] p-5 rounded-xl shadow-sm">
                <span className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider block">Total Postings</span>
                <div className="flex items-baseline gap-2 mt-2">
                  <span className="text-2xl font-bold text-[#0F172A]">{totalPostings}</span>
                  <span className="text-xs text-[#94A3B8]">job(s)</span>
                </div>
              </div>

              <div className="bg-white border border-[#E2E8F0] p-5 rounded-xl shadow-sm">
                <span className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider block">Active / Open</span>
                <div className="flex items-baseline gap-2 mt-2">
                  <span className="text-2xl font-bold text-[#16A34A]">{activePostings}</span>
                  <span className="text-xs text-[#94A3B8]">published</span>
                </div>
              </div>

              <div className="bg-white border border-[#E2E8F0] p-5 rounded-xl shadow-sm">
                <span className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider block">Total Applicants</span>
                <div className="flex items-baseline gap-2 mt-2">
                  <span className="text-2xl font-bold text-[#5B21B6]">{totalApplicants}</span>
                  <span className="text-xs text-[#94A3B8]">students</span>
                </div>
              </div>

              <div className="bg-white border border-[#E2E8F0] p-5 rounded-xl shadow-sm">
                <span className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider block">Selected / Placed</span>
                <div className="flex items-baseline gap-2 mt-2">
                  <span className="text-2xl font-bold text-[#0284C7]">{totalPlaced}</span>
                  <span className="text-xs text-[#94A3B8]">mentees</span>
                </div>
              </div>
            </div>

            {/* Postings Registry */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-[#475569] uppercase tracking-wider">Internship Listings</h3>

              {internships.length === 0 ? (
                <div className="bg-white border border-[#E2E8F0] p-10 text-center rounded-xl text-xs text-[#64748B] shadow-sm">
                  No internship roles have been created yet. Click "Create Posting" to set up your first opening.
                </div>
              ) : (
                <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden shadow-sm">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[10px] font-bold text-[#475569] uppercase tracking-wider">
                        <th className="p-4">Internship Role & Criteria</th>
                        <th className="p-4">Vacancies</th>
                        <th className="p-4">Status</th>
                        <th className="p-4">Applicants</th>
                        <th className="p-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F1F5F9] text-xs text-[#334155]">
                      {internships.map((job, idx) => {
                        const appList = applicantsQueries[idx]?.data?.data || [];

                        return (
                          <tr key={job.id} className="hover:bg-[#F8FAFC] transition-colors">
                            <td className="p-4">
                              <div className="font-bold text-[#0F172A]">{job.title || 'Internship'}</div>
                              <div className="text-[11px] text-slate-500 mt-0.5">
                                Min CGPA: {job.criteria?.minCgpa ?? 0} &bull; Max Backlogs: {job.criteria?.maxBacklogs ?? 0}
                              </div>
                            </td>
                            <td className="p-4 font-mono font-semibold">{job.vacancies} slot(s)</td>
                            <td className="p-4">{getStatusBadge(job.status)}</td>
                            <td className="p-4">
                              <span className="font-bold text-[#5B21B6]">{appList.length} applied</span>
                            </td>
                            <td className="p-4 text-right space-x-3">
                              <Link
                                href={`/company/postings/${job.id}/applicants`}
                                className="inline-flex items-center gap-0.5 text-xs font-bold text-[#EA580C] hover:underline"
                              >
                                Applicants ({appList.length}) <ArrowUpRight className="w-3.5 h-3.5" />
                              </Link>
                              <button
                                onClick={() => handleOpenEdit(job)}
                                className="text-xs font-bold text-violet-700 hover:underline cursor-pointer"
                              >
                                Edit Criteria
                              </button>
                              {job.status === 'open' && (
                                <button
                                  onClick={() => setClosingInternshipId(job.id)}
                                  className="text-xs font-bold text-rose-600 hover:underline cursor-pointer"
                                >
                                  Close
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
          </div>
        )}

        {/* Edit Criteria Modal */}
        {editingInternship && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white border border-[#E2E8F0] w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
              <div className="px-6 py-4 border-b border-[#E2E8F0] flex justify-between items-center bg-[#F8FAFC]">
                <div>
                  <h3 className="text-sm font-bold text-[#0F172A]">Edit Internship Details & Criteria</h3>
                  <p className="text-[10px] text-[#64748B] mt-0.5">Posting ID: {editingInternship.id}</p>
                </div>
                <button
                  onClick={() => setEditingInternship(null)}
                  className="text-slate-400 hover:text-slate-600 text-xs font-bold px-2 py-1 rounded hover:bg-[#F1F5F9] cursor-pointer"
                >
                  Close
                </button>
              </div>

              <form onSubmit={handleSaveEdit}>
                <div className="p-6 space-y-4 max-h-[65vh] overflow-y-auto">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Role Title *</label>
                    <input
                      type="text"
                      required
                      value={editForm.title}
                      onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                      className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Job Description</label>
                    <textarea
                      rows={3}
                      value={editForm.description}
                      onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                      className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">Minimum CGPA (0-10)</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="10"
                        value={editForm.minCgpa}
                        onChange={(e) => setEditForm({ ...editForm, minCgpa: Number(e.target.value) })}
                        className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">Max Active Backlogs</label>
                      <input
                        type="number"
                        min="0"
                        value={editForm.maxBacklogs}
                        onChange={(e) => setEditForm({ ...editForm, maxBacklogs: Number(e.target.value) })}
                        className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">Vacancies</label>
                      <input
                        type="number"
                        min="1"
                        value={editForm.vacancies}
                        onChange={(e) => setEditForm({ ...editForm, vacancies: Number(e.target.value) })}
                        className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">Work Mode</label>
                      <select
                        value={editForm.mode}
                        onChange={(e) => setEditForm({ ...editForm, mode: e.target.value })}
                        className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500"
                      >
                        <option value="remote">Remote</option>
                        <option value="onsite">On-Site</option>
                        <option value="hybrid">Hybrid</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">Duration</label>
                      <input
                        type="text"
                        value={editForm.duration}
                        onChange={(e) => setEditForm({ ...editForm, duration: e.target.value })}
                        placeholder="e.g. 6 months"
                        className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Allowed Departments (Comma-separated)</label>
                    <input
                      type="text"
                      value={editForm.departments}
                      onChange={(e) => setEditForm({ ...editForm, departments: e.target.value })}
                      placeholder="Computer Science, Information Technology"
                      className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Required Skills (Comma-separated)</label>
                    <input
                      type="text"
                      value={editForm.requiredSkills}
                      onChange={(e) => setEditForm({ ...editForm, requiredSkills: e.target.value })}
                      placeholder="React, Node.js, TypeScript"
                      className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                </div>

                <div className="px-6 py-4 border-t border-[#E2E8F0] flex justify-end gap-3 bg-[#F8FAFC]">
                  <button
                    type="button"
                    onClick={() => setEditingInternship(null)}
                    className="px-4 py-2 border border-[#E2E8F0] hover:bg-slate-50 text-slate-600 font-bold rounded-lg text-xs cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={updateMutation.isPending}
                    className="px-4 py-2 bg-[#EA580C] hover:bg-[#C2410C] text-white font-bold rounded-lg text-xs shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Close Posting Confirmation Modal */}
        {closingInternshipId && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white border border-[#E2E8F0] w-full max-w-md rounded-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
              <div className="p-6 space-y-4">
                <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div className="text-center space-y-1">
                  <h3 className="text-sm font-bold text-slate-900">Close Internship Posting</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Are you sure you want to close this opening? The posting will immediately transition to <strong>closed</strong> status and will no longer accept new student applications.
                  </p>
                </div>
              </div>

              <div className="px-6 py-4 border-t border-[#E2E8F0] flex justify-end gap-3 bg-[#F8FAFC]">
                <button
                  type="button"
                  onClick={() => setClosingInternshipId(null)}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-600 font-bold rounded-lg text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={closeMutation.isPending}
                  onClick={() => closeMutation.mutate(closingInternshipId)}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-xs shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {closeMutation.isPending ? 'Closing...' : 'Confirm Close'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </RoleShell>
  );
}
