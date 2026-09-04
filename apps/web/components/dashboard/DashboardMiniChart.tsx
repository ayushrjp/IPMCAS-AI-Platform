'use client';

import React, { useState } from 'react';
import { Activity, BarChart2, TrendingUp, Zap } from 'lucide-react';
import { clsx } from 'clsx';
import Link from 'next/link';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';

interface DashboardMiniChartProps {
  records: any[];
}

export default function DashboardMiniChart({ records }: DashboardMiniChartProps) {
  const [activeTab, setActiveTab] = useState<'download' | 'upload' | 'latency'>('download');

  const validRecords = records
    .filter(r => r.status !== 'SERVER_RATE_LIMITED' && r.httpStatusCode !== 429)
    .reverse();

  if (!validRecords || validRecords.length === 0) {
    return (
      <div className="glass-card rounded-2xl p-6 border border-dark-border space-y-3">
        <div className="flex items-center justify-between border-b border-dark-border pb-3">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Activity className="h-4 w-4 text-brand-400" />
            <span>RECENT PERFORMANCE TREND</span>
          </span>
        </div>

        <div className="p-8 text-center space-y-3">
          <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
            Run additional speed tests to visualize performance trends over time.
          </p>
          <Link
            href="/speed-test"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs shadow-md shadow-brand-600/20 transition-all"
          >
            <Zap className="h-3.5 w-3.5 fill-current" />
            <span>Run Speed Test</span>
          </Link>
        </div>
      </div>
    );
  }

  const chartData = validRecords.map((r, i) => ({
    session: `#${i + 1}`,
    download: r.downloadSpeedMbps || r.throughput_mbps || 0,
    upload: r.uploadSpeedMbps || 0,
    latency: r.latency?.avgMs || r.latency_avg_ms || r.latencyAvgMs || 0,
    time: new Date(r.timestamp || r.createdAt || r.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }));

  return (
    <div className="glass-card rounded-2xl p-5 border border-dark-border space-y-4">
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-dark-border pb-3">
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
          <Activity className="h-4 w-4 text-brand-400" />
          <span>RECENT PERFORMANCE TREND</span>
        </span>

        <div className="flex items-center gap-1 bg-dark-bg p-1 rounded-xl border border-dark-border self-start sm:self-auto">
          {(['download', 'upload', 'latency'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={clsx(
                'px-3 py-1 rounded-lg text-[11px] font-extrabold uppercase tracking-wider transition-all',
                activeTab === tab
                  ? 'bg-brand-500/20 text-brand-400 border border-brand-500/30'
                  : 'text-slate-400 hover:text-white'
              )}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Mini Recharts Graph */}
      <div className="h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="session" stroke="#64748b" fontSize={10} />
            <YAxis stroke="#64748b" fontSize={10} />
            <Tooltip
              contentStyle={{ backgroundColor: '#0d1420', borderColor: '#1e293b', borderRadius: '12px', fontSize: '12px' }}
            />
            {activeTab === 'download' && (
              <Area type="monotone" dataKey="download" stroke="#38bdf8" fill="#38bdf8" fillOpacity={0.15} strokeWidth={2} name="Download (Mbps)" />
            )}
            {activeTab === 'upload' && (
              <Area type="monotone" dataKey="upload" stroke="#a855f7" fill="#a855f7" fillOpacity={0.15} strokeWidth={2} name="Upload (Mbps)" />
            )}
            {activeTab === 'latency' && (
              <Area type="monotone" dataKey="latency" stroke="#818cf8" fill="#818cf8" fillOpacity={0.15} strokeWidth={2} name="Latency (ms)" />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
