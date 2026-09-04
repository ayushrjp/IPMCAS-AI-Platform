import React from 'react';
import { ArrowDownCircle } from 'lucide-react';

interface DownloadGaugeProps {
  mbps: number;
  active: boolean;
}

export default function DownloadGauge({ mbps, active }: DownloadGaugeProps) {
  return (
    <div className={`p-6 rounded-2xl border transition-all ${
      active 
        ? 'bg-sky-500/10 border-sky-500/40 shadow-lg shadow-sky-500/10 scale-[1.02]' 
        : 'bg-dark-card border-dark-border'
    }`}>
      <div className="flex items-center gap-2 text-sky-400 text-xs font-semibold uppercase tracking-wider mb-2">
        <ArrowDownCircle className={`h-5 w-5 ${active ? 'animate-bounce' : ''}`} />
        <span>Download Throughput</span>
      </div>
      <div className="text-4xl sm:text-5xl font-extrabold text-white font-mono">
        {mbps.toFixed(1)}
        <span className="text-sm font-semibold text-slate-400 ml-2">Mbps</span>
      </div>
    </div>
  );
}
