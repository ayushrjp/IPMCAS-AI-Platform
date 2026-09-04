import React from 'react';
import { Activity } from 'lucide-react';
import { ProgressState } from '@ipmcas/measurement-engine';

interface TestProgressProps {
  progress: ProgressState | null;
}

export default function TestProgress({ progress }: TestProgressProps) {
  const phase = progress ? progress.phase : 'READY';
  const percent = progress ? progress.progressPercent : 0;
  const message = progress ? progress.statusMessage : 'Click Start to measure your connection speed';

  return (
    <div className="space-y-4 text-center">
      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/30 text-brand-400 text-xs font-semibold uppercase tracking-wider">
        <Activity className="h-3.5 w-3.5" />
        <span>{phase}</span>
      </div>

      <h2 className="text-xl font-bold text-white max-w-lg mx-auto">
        {message}
      </h2>

      <div className="max-w-md mx-auto mt-4 bg-dark-bg border border-dark-border rounded-full h-3 overflow-hidden p-0.5">
        <div
          className="bg-gradient-to-r from-brand-600 via-sky-400 to-emerald-400 h-full rounded-full transition-all duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="text-xs text-slate-500 block">{percent}% Complete</span>
    </div>
  );
}
