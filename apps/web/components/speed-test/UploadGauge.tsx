import React from 'react';
import { ArrowUpCircle } from 'lucide-react';

interface UploadGaugeProps {
  mbps: number;
  active: boolean;
}

export default function UploadGauge({ mbps, active }: UploadGaugeProps) {
  return (
    <div className={`p-6 rounded-2xl border transition-all ${
      active 
        ? 'bg-emerald-500/10 border-emerald-500/40 shadow-lg shadow-emerald-500/10 scale-[1.02]' 
        : 'bg-dark-card border-dark-border'
    }`}>
      <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-2">
        <ArrowUpCircle className={`h-5 w-5 ${active ? 'animate-bounce' : ''}`} />
        <span>Upload Throughput</span>
      </div>
      <div className="text-4xl sm:text-5xl font-extrabold text-white font-mono">
        {mbps.toFixed(1)}
        <span className="text-sm font-semibold text-slate-400 ml-2">Mbps</span>
      </div>
    </div>
  );
}
