'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { Role } from '@/lib/types';
import RoleShell from '@/components/shared/RoleShell';
import Link from 'next/link';
import { Sparkles, ArrowRight, BookOpen, UserCheck } from 'lucide-react';

export default function StudentRecommendationsPage() {
  const { data: recommendationsRes, isLoading } = useQuery({
    queryKey: ['recommendations'],
    queryFn: () => apiClient.student.getRecommendations(),
  });

  const recommendationData = recommendationsRes?.data;
  const list = recommendationData?.recommendations || [];
  const method = recommendationData?.method || 'deterministic-skill-overlap';

  return (
    <RoleShell role={Role.STUDENT}>
      <div className="space-y-6">
        
        {/* Header */}
        <div>
          <h2 className="text-xl font-bold text-[#0F172A] flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#5B21B6]" />
            Recommended Internships
          </h2>
          <p className="text-xs text-[#64748B] mt-0.5">
            Personalized matches computed from your academic skills inventory.
          </p>
        </div>

        {/* Algorithm Label Panel */}
        <div className="bg-[#EDE9FE] border border-[#DDD6FE] rounded-lg p-5 flex gap-3">
          <BookOpen className="w-5 h-5 text-[#5B21B6] shrink-0 mt-0.5" />
          <div className="text-xs text-[#4C1D95] space-y-1">
            <h4 className="font-bold">Recommendation Engine Model</h4>
            <p className="leading-relaxed">
              This list is generated using the <strong className="underline decoration-2">{method}</strong> algorithm. It evaluates the exact skill match between the requirements defined by companies and the skills listed in your profile.
            </p>
          </div>
        </div>

        {/* Content list */}
        {isLoading ? (
          <div className="flex items-center justify-center min-h-[250px]">
            <div className="text-sm font-semibold text-[#64748B] animate-pulse">
              Computing recommendations...
            </div>
          </div>
        ) : list.length === 0 ? (
          <div className="bg-white border border-[#E2E8F0] rounded-lg p-10 text-center text-xs text-[#64748B]">
            No recommended internships found matching your skills. Try adding more skills to your profile.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {list.map((internship: any) => {
              return (
                <div 
                  key={internship.id}
                  className="bg-white border border-[#E2E8F0] rounded-lg p-5 flex flex-col justify-between gap-4 shadow-sm"
                >
                  <div className="space-y-2">
                    <span className="text-[10px] text-[#94A3B8] font-bold uppercase tracking-wider block">
                      {internship.companyName}
                    </span>
                    <h4 className="text-sm font-bold text-[#0F172A]">
                      Frontend Developer Internship
                    </h4>
                    <p className="text-xs text-[#64748B] leading-relaxed">
                      Required skills matches:
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {internship.criteria.requiredSkills.map((skill: string) => (
                        <span 
                          key={skill}
                          className="px-2 py-0.5 rounded text-[10px] font-medium bg-[#F1F5F9] text-[#475569] border border-[#E2E8F0]"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-[#F1F5F9] pt-3">
                    <span className="text-[10px] text-[#16A34A] font-semibold flex items-center gap-1">
                      <UserCheck className="w-3.5 h-3.5" /> High Skill Overlap
                    </span>
                    <Link
                      href={`/student/internships/${internship.id}`}
                      className="inline-flex items-center gap-1 text-xs font-bold text-[#5B21B6] hover:underline"
                    >
                      View & Apply <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>
    </RoleShell>
  );
}
