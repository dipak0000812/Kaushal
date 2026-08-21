'use client';

import React from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: React.ReactNode;
}

export default function StatCard({ title, value, description, icon }: StatCardProps) {
  return (
    <div className="bg-white border border-[#E2E8F0] rounded-lg p-5 flex items-start justify-between shadow-sm hover:shadow-md transition-shadow">
      <div className="space-y-1.5">
        <span className="text-xs font-semibold text-[#64748B] tracking-wide uppercase">
          {title}
        </span>
        <h3 className="text-2xl font-bold text-[#0F172A] leading-tight">
          {value}
        </h3>
        {description && (
          <p className="text-xs text-[#94A3B8]">
            {description}
          </p>
        )}
      </div>
      {icon && (
        <div className="w-10 h-10 rounded-md bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-center text-[#5B21B6]">
          {icon}
        </div>
      )}
    </div>
  );
}
