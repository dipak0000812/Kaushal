'use client';

import React from 'react';
import { ProgressLog } from '@/lib/types';
import { ExternalLink, CheckCircle, Clock, AlertTriangle } from 'lucide-react';

interface EvidenceCardProps {
  log: ProgressLog;
  onVerify?: (logId: string) => void;
  showActions?: boolean;
}

export default function EvidenceCard({ log, onVerify, showActions = false }: EvidenceCardProps) {
  const getStatusBadge = () => {
    if (log.verified) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#DCFCE7] text-[#16A34A] border border-[#BBF7D0]">
          <CheckCircle className="w-3 h-3" />
          VERIFIED
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#FEF3C7] text-[#D97706] border border-[#FDE68A]">
        <Clock className="w-3 h-3" />
        PENDING VERIFICATION
      </span>
    );
  };

  const isUrl = (str: string) => {
    try {
      new URL(str);
      return true;
    } catch {
      return false;
    }
  };

  return (
    <div className="bg-white border border-[#E2E8F0] rounded-lg p-5 flex flex-col gap-3.5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-[#5B21B6] bg-[#EDE9FE] px-2 py-0.5 rounded">
            {log.weekLabel}
          </span>
          <span className="text-[10px] text-[#94A3B8] font-mono">
            {new Date(log.createdAt).toLocaleDateString()}
          </span>
        </div>
        <div>{getStatusBadge()}</div>
      </div>

      <div className="text-xs text-[#334155] leading-relaxed">
        <p>{log.description}</p>
      </div>

      <div className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-md flex items-center justify-between gap-4">
        <div className="min-w-0">
          <span className="text-[10px] font-bold text-[#94A3B8] uppercase block tracking-wider">
            Evidence Attachment ({log.evidence.type})
          </span>
          <span className="text-xs text-[#475569] truncate block mt-0.5 font-mono">
            {log.evidence.value}
          </span>
        </div>
        {isUrl(log.evidence.value) && (
          <a
            href={log.evidence.value}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 bg-white border border-[#E2E8F0] hover:bg-[#F1F5F9] rounded text-[#5B21B6] transition-colors shrink-0"
            title="Open attachment in new tab"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        )}
      </div>

      {log.verified && log.verifiedAt && (
        <p className="text-[10px] text-[#94A3B8] text-right italic leading-none">
          Verified by faculty mentor on {new Date(log.verifiedAt).toLocaleDateString()}
        </p>
      )}

      {showActions && !log.verified && onVerify && (
        <div className="flex justify-end border-t border-[#E2E8F0] pt-3 mt-1">
          <button
            onClick={() => onVerify(log.id)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#5B21B6] hover:bg-[#4C1D95] text-white text-xs font-semibold rounded-md transition-colors"
          >
            Verify Log Submission
          </button>
        </div>
      )}
    </div>
  );
}
