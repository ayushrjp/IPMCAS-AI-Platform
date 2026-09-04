'use client';

import React from 'react';
import { Activity, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';
import { clsx } from 'clsx';

interface NetworkHealthPanelProps {
  latestRecord: any | null;
}

export default function NetworkHealthPanel({ latestRecord }: NetworkHealthPanelProps) {
  if (!latestRecord || latestRecord.status === 'SERVER_RATE_LIMITED' || latestRecord.httpStatusCode === 429) {
    return (
      <div className="glass-card rounded-2xl p-5 border border-dark-border space-y-3 flex flex-col justify-between">
        <div className="flex items-center justify-between border-b border-dark-border pb-3">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Activity className="h-4 w-4 text-brand-400" />
            <span>NETWORK HEALTH</span>
          </span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 uppercase">
            Awaiting Test Data
          </span>
        </div>

        <div className="text-center py-3 space-y-1">
          <div className="text-3xl font-extrabold text-slate-500 font-mono">--</div>
          <span className="text-xs font-bold text-slate-400 uppercase block tracking-wider">Analyzing...</span>
          <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
            Run your first measurement to compute your deterministic network health score.
          </p>
        </div>

        <div className="pt-2 border-t border-dark-border grid grid-cols-3 text-center text-[10px] font-mono text-slate-500">
          <div>Latency: --</div>
          <div>Jitter: --</div>
          <div>Throughput: --</div>
        </div>
      </div>
    );
  }

  // Extract real metrics
  const download = latestRecord.downloadSpeedMbps || latestRecord.throughput_mbps || 0;
  const latency = latestRecord.latency?.avgMs || latestRecord.latency_avg_ms || latestRecord.latencyAvgMs || 100;
  const jitter = latestRecord.latency?.jitterMs || latestRecord.jitter_ms || latestRecord.jitterMs || 10;

  // Calculate deterministic score (0-100)
  const latencyScore = Math.max(0, Math.min(40, 40 - Math.max(0, (latency - 10) * 0.5)));
  const jitterScore = Math.max(0, Math.min(20, 20 - Math.max(0, (jitter - 2) * 2)));
  const throughputScore = Math.max(0, Math.min(40, (download / 100) * 40));
  
  const score = Math.round(latencyScore + jitterScore + throughputScore);

  let label = 'EXCELLENT';
  let badgeColor = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
  let scoreColor = 'text-emerald-400';

  if (score < 50) {
    label = 'POOR';
    badgeColor = 'bg-red-500/20 text-red-300 border-red-500/40';
    scoreColor = 'text-red-400';
  } else if (score < 70) {
    label = 'FAIR';
    badgeColor = 'bg-amber-500/20 text-amber-300 border-amber-500/40';
    scoreColor = 'text-amber-400';
  } else if (score < 85) {
    label = 'GOOD';
    badgeColor = 'bg-sky-500/20 text-sky-300 border-sky-500/40';
    scoreColor = 'text-sky-400';
  }

  return (
    <div className="glass-card rounded-2xl p-5 border border-dark-border hover:border-brand-500/30 transition-all space-y-4 flex flex-col justify-between">
      <div className="flex items-center justify-between border-b border-dark-border pb-3">
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
          <Activity className="h-4 w-4 text-brand-400" />
          <span>NETWORK HEALTH</span>
        </span>
        <span className={clsx('px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border', badgeColor)}>
          {label}
        </span>
      </div>

      <div className="text-center space-y-1">
        <div className={clsx('text-4xl font-extrabold font-mono tracking-tight', scoreColor)}>
          {score}
          <span className="text-xs text-slate-500 font-sans font-normal ml-1">/ 100</span>
        </div>
        <span className="text-xs font-extrabold text-white uppercase tracking-widest block">{label} STABILITY</span>
      </div>

      <div className="pt-2 border-t border-dark-border space-y-1.5 text-xs font-mono">
        <div className="flex justify-between items-center text-slate-300">
          <span className="font-sans text-slate-400 text-[11px]">Latency ({latency}ms):</span>
          <span className={clsx('font-bold text-[11px]', latency <= 20 ? 'text-emerald-400' : 'text-amber-400')}>
            {latency <= 20 ? 'Excellent' : latency <= 50 ? 'Good' : 'High RTT'}
          </span>
        </div>

        <div className="flex justify-between items-center text-slate-300">
          <span className="font-sans text-slate-400 text-[11px]">Jitter ({jitter}ms):</span>
          <span className={clsx('font-bold text-[11px]', jitter <= 3 ? 'text-emerald-400' : 'text-amber-400')}>
            {jitter <= 3 ? 'Stable' : 'Variability detected'}
          </span>
        </div>

        <div className="flex justify-between items-center text-slate-300">
          <span className="font-sans text-slate-400 text-[11px]">Throughput ({download}Mbps):</span>
          <span className={clsx('font-bold text-[11px]', download >= 50 ? 'text-emerald-400' : 'text-sky-400')}>
            {download >= 100 ? 'Ultra-fast' : download >= 50 ? 'High Speed' : 'Standard'}
          </span>
        </div>
      </div>
    </div>
  );
}
