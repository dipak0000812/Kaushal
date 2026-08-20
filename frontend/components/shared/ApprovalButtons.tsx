'use client';

import React, { useState } from 'react';
import { ShieldCheck, ShieldAlert, X } from 'lucide-react';

interface ApprovalButtonsProps {
  onApprove: () => void;
  onReject: (reason: string) => void;
  approveLabel?: string;
  rejectLabel?: string;
  isPending?: boolean;
}

export default function ApprovalButtons({
  onApprove,
  onReject,
  approveLabel = 'Verify & Approve',
  rejectLabel = 'Reject with Reason',
  isPending = false,
}: ApprovalButtonsProps) {
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [reason, setReason] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) return;
    onReject(reason);
    setReason('');
    setShowRejectForm(false);
  };

  return (
    <div className="w-full">
      {!showRejectForm ? (
        <div className="flex gap-3">
          <button
            onClick={onApprove}
            disabled={isPending}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-[#5B21B6] hover:bg-[#4C1D95] disabled:bg-[#C084FC] text-white text-xs font-semibold rounded-md transition-colors cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4" />
            {approveLabel}
          </button>
          <button
            onClick={() => setShowRejectForm(true)}
            disabled={isPending}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 border border-[#E2E8F0] hover:bg-[#FEE2E2] hover:border-[#FCA5A5] text-[#B91C1C] text-xs font-semibold rounded-md transition-colors cursor-pointer"
          >
            <ShieldAlert className="w-4 h-4" />
            {rejectLabel}
          </button>
        </div>
      ) : (
        <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-md p-4 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#475569]">Rejection Details</span>
            <button
              onClick={() => setShowRejectForm(false)}
              className="p-1 hover:bg-[#E2E8F0] rounded text-[#64748B]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-3">
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Provide a clear explanation for this action..."
              className="w-full text-xs p-2 border border-[#E2E8F0] rounded-md bg-white focus:outline-none focus:border-[#5B21B6] min-h-[70px]"
              required
            />
            <div className="flex gap-2 justify-end">
              <button
                type="submit"
                className="px-3 py-1.5 bg-[#B91C1C] hover:bg-[#991B1B] text-white text-xs font-semibold rounded-md transition-colors cursor-pointer"
              >
                Submit Rejection
              </button>
              <button
                type="button"
                onClick={() => setShowRejectForm(false)}
                className="px-3 py-1.5 border border-[#E2E8F0] hover:bg-[#F1F5F9] text-[#475569] text-xs font-semibold rounded-md transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
