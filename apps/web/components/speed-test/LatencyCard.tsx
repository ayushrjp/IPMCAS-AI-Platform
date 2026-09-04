import React from 'react';
import { Clock } from 'lucide-react';
import { LatencyMetrics } from '@ipmcas/measurement-engine';

interface LatencyCardProps {
  metrics: LatencyMetrics | null;
}

export default function LatencyCard({ metrics }: LatencyCardProps) {
  if (!metrics) {
    return (
      <div className="p-4 rounded-xl bg-dark-bg/60 border border-dark-border text-center text-slate-500 text-xs">
        Latency probes pending...
      </div>
    );
  }

  return (
    <div className="p-5 rounded-2xl bg-dark-card border border-dark-border space-y-3">
      <div className="flex items-center gap-2 text-indigo-400 text-xs font-semibold uppercase tracking-wider">
        <Clock className="h-4 w-4" />
        <span>Latency & Jitter Probes ({metrics.successfulProbes}/{metrics.probeCount})</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-1 text-center font-mono">
        <div className="p-2 rounded-lg bg-dark-bg border border-dark-border">
          <span className="text-[10px] text-slate-400 block">Min</span>
          <span className="text-sm font-bold text-white">{metrics.minMs} ms</span>
        </div>
        <div className="p-2 rounded-lg bg-dark-bg border border-dark-border">
          <span className="text-[10px] text-slate-400 block">Average</span>
          <span className="text-sm font-bold text-indigo-300">{metrics.avgMs} ms</span>
        </div>
        <div className="p-2 rounded-lg bg-dark-bg border border-dark-border">
          <span className="text-[10px] text-slate-400 block">Median</span>
          <span className="text-sm font-bold text-white">{metrics.medianMs} ms</span>
        </div>
        <div className="p-2 rounded-lg bg-dark-bg border border-dark-border">
          <span className="text-[10px] text-slate-400 block">Max</span>
          <span className="text-sm font-bold text-white">{metrics.maxMs} ms</span>
        </div>
        <div className="p-2 rounded-lg bg-dark-bg border border-dark-border col-span-2 sm:col-span-1">
          <span className="text-[10px] text-slate-400 block">RFC 3550 Jitter</span>
          <span className="text-sm font-bold text-emerald-400">{metrics.jitterMs} ms</span>
        </div>
      </div>
    </div>
  );
}
