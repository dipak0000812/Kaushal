'use client';

import React, { useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid
} from 'recharts';

interface ChartWrapperProps {
  title?: string;
  type: 'bar' | 'line' | 'funnel';
  data: any[];
  xKey: string;
  series: {
    key: string;
    label: string;
    color: string;
  }[];
}

export default function ChartWrapper({
  title,
  type,
  data,
  xKey,
  series,
}: ChartWrapperProps) {
  const [mounted, setMounted] = useState(false);

  // Prevent SSR hydration mismatches with Recharts
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="bg-white border border-[#E2E8F0] rounded-lg p-6 h-[320px] flex items-center justify-center">
        <span className="text-xs text-[#94A3B8] font-semibold animate-pulse">Loading charts...</span>
      </div>
    );
  }

  const renderChart = () => {
    if (type === 'line') {
      return (
        <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
          <XAxis 
            dataKey={xKey} 
            stroke="#94A3B8" 
            fontSize={11} 
            tickLine={false}
          />
          <YAxis 
            stroke="#94A3B8" 
            fontSize={11} 
            tickLine={false} 
            allowDecimals={false}
          />
          <Tooltip 
            contentStyle={{ backgroundColor: '#FFFFFF', borderColor: '#E2E8F0', borderRadius: '6px', fontSize: '12px' }}
          />
          <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
          {series.map((s, idx) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={s.color}
              strokeWidth={2}
              activeDot={{ r: 6 }}
            />
          ))}
        </LineChart>
      );
    }

    // Default or Bar chart
    return (
      <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
        <XAxis 
          dataKey={xKey} 
          stroke="#94A3B8" 
          fontSize={11} 
          tickLine={false} 
        />
        <YAxis 
          stroke="#94A3B8" 
          fontSize={11} 
          tickLine={false} 
          allowDecimals={false}
        />
        <Tooltip 
          contentStyle={{ backgroundColor: '#FFFFFF', borderColor: '#E2E8F0', borderRadius: '6px', fontSize: '12px' }}
        />
        <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
        {series.map((s, idx) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.label}
            fill={s.color}
            radius={[4, 4, 0, 0]}
          />
        ))}
      </BarChart>
    );
  };

  return (
    <div className="bg-white border border-[#E2E8F0] rounded-lg p-6 flex flex-col gap-4 shadow-sm">
      {title && (
        <div className="border-b border-[#E2E8F0] pb-3">
          <h4 className="text-xs font-bold text-[#64748B] uppercase tracking-wider">{title}</h4>
        </div>
      )}
      <div className="h-[240px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          {renderChart()}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
