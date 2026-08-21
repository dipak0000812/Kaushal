'use client';

import React, { useState } from 'react';
import { MentorAssignment, Role, AssignmentStatus } from '@/lib/types';
import { UserCheck, UserX, UserMinus, AlertTriangle } from 'lucide-react';

interface AssignmentQueueCardProps {
  assignment: MentorAssignment;
  studentName: string;
  internshipTitle: string;
  role: Role;
  onAccept?: (assignmentId: string) => void;
  onReject?: (assignmentId: string, reason: string) => void;
}

export default function AssignmentQueueCard({
  assignment,
  studentName,
  internshipTitle,
  role,
  onAccept,
  onReject,
}: AssignmentQueueCardProps) {
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);

  const handleRejectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectReason.trim()) return;
    if (onReject && assignment.id) {
      onReject(assignment.id, rejectReason);
      setShowRejectForm(false);
      setRejectReason('');
    }
  };

  const getStatusBadge = () => {
    switch (assignment.status) {
      case AssignmentStatus.PENDING:
        return (
          <span className="bg-[#FEF3C7] text-[#D97706] text-xs font-semibold px-2 py-0.5 rounded-full border border-[#FDE68A]">
            PENDING FACULTY RESPONSE
          </span>
        );
      case AssignmentStatus.ACCEPTED:
        return (
          <span className="bg-[#DCFCE7] text-[#16A34A] text-xs font-semibold px-2 py-0.5 rounded-full border border-[#BBF7D0]">
            ACCEPTED
          </span>
        );
      case AssignmentStatus.REJECTED:
        return (
          <span className="bg-[#FEE2E2] text-[#B91C1C] text-xs font-semibold px-2 py-0.5 rounded-full border border-[#FCA5A5]">
            REJECTED
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="bg-white border border-[#E2E8F0] rounded-lg p-5 flex flex-col gap-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-4">
        <div>
          <span className="text-[10px] uppercase font-bold tracking-wider text-[#94A3B8]">
            Mentor Assignment Request
          </span>
          <h4 className="text-sm font-semibold text-[#0F172A] mt-1">{studentName}</h4>
          <p className="text-xs text-[#475569] mt-0.5">{internshipTitle}</p>
        </div>
        <div>{getStatusBadge()}</div>
      </div>

      {assignment.rejectReason && (
        <div className="p-3 bg-[#FFF5F5] border border-[#FEE2E2] rounded-md flex gap-2">
          <AlertTriangle className="w-4 h-4 text-[#DC2626] shrink-0 mt-0.5" />
          <p className="text-xs text-[#B91C1C]">
            <strong>Rejection Reason:</strong> {assignment.rejectReason}
          </p>
        </div>
      )}

      {/* Action panel for Faculty */}
      {role === Role.FACULTY && assignment.status === AssignmentStatus.PENDING && (
        <div className="border-t border-[#E2E8F0] pt-4 mt-1">
          {!showRejectForm ? (
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => onAccept && assignment.id && onAccept(assignment.id)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#5B21B6] hover:bg-[#4C1D95] text-white text-xs font-semibold rounded-md transition-colors"
              >
                <UserCheck className="w-3.5 h-3.5" />
                Accept Assignment
              </button>
              <button
                onClick={() => setShowRejectForm(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[#E2E8F0] hover:bg-[#FEE2E2] hover:border-[#FCA5A5] text-[#B91C1C] text-xs font-semibold rounded-md transition-colors"
              >
                <UserX className="w-3.5 h-3.5" />
                Reject Assignment
              </button>
            </div>
          ) : (
            <form onSubmit={handleRejectSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#475569] mb-1">
                  Reason for rejection (Required)
                </label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="e.g., Load limit reached, student in different sub-domain..."
                  className="w-full text-xs p-2 border border-[#E2E8F0] rounded-md bg-[#F8FAFC] focus:outline-none focus:border-[#5B21B6] focus:bg-white min-h-[60px]"
                  required
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-[#B91C1C] hover:bg-[#991B1B] text-white text-xs font-semibold rounded-md transition-colors"
                >
                  Confirm Reject
                </button>
                <button
                  type="button"
                  onClick={() => setShowRejectForm(false)}
                  className="px-3 py-1.5 border border-[#E2E8F0] hover:bg-[#F1F5F9] text-[#475569] text-xs font-semibold rounded-md transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Info panel for T&P Cell */}
      {role === Role.TNP && assignment.status === AssignmentStatus.REJECTED && (
        <div className="border-t border-[#E2E8F0] pt-4 flex justify-between items-center text-xs">
          <span className="text-[#94A3B8]">Returned to unassigned queue</span>
          <button
            disabled
            className="px-3 py-1.5 bg-[#F1F5F9] text-[#94A3B8] font-semibold rounded-md border border-[#E2E8F0] cursor-not-allowed inline-flex items-center gap-1.5"
          >
            <UserMinus className="w-3.5 h-3.5" />
            Reassign Required
          </button>
        </div>
      )}
    </div>
  );
}
