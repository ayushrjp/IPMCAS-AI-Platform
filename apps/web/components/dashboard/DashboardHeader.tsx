'use client';

import React from 'react';
import { User } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { Activity, ShieldCheck, Zap, Wifi, Clock } from 'lucide-react';

interface DashboardHeaderProps {
  user: User | null;
  totalTests: number;
  latestTimestamp?: string | null;
}

export default function DashboardHeader({ user, totalTests, latestTimestamp }: DashboardHeaderProps) {
  const router = useRouter();
  const userName = user?.email?.split('@')[0]?.toUpperCase() || 'ENGINEER';

  return (
    <div className="glass-card-elevated rounded-2xl p-6 md:p-7 flex flex-col md:flex-row md:items-center justify-between gap-6 border border-brand-500/25 relative overflow-hidden bg-gradient-to-r from-dark-surface via-dark-elevated to-dark-surface">
      <div className="space-y-2 max-w-2xl">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-mono uppercase tracking-widest text-brand-400 font-extrabold">
            WELCOME BACK, {userName}
          </span>
          <span className="text-slate-600">•</span>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold tracking-wider uppercase">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <ShieldCheck className="h-3 w-3" />
            <span>ENGINE READY</span>
          </div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-sky-500/10 border border-sky-500/30 text-sky-400 text-[10px] font-bold tracking-wider uppercase">
            <Wifi className="h-3 w-3" />
            <span>Wi-Fi</span>
          </div>
        </div>

        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          Network Performance Overview
        </h1>

        <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
          Your connection is currently being monitored across your latest measurement sessions in Supabase.
        </p>

        {latestTimestamp && (
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-mono pt-1">
            <Clock className="h-3 w-3 text-slate-400" />
            <span suppressHydrationWarning>Last measurement session: {new Date(latestTimestamp).toLocaleString()}</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={() => router.push('/speed-test')}
          className="glow-btn-primary flex items-center gap-2.5 px-6 py-3.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-extrabold text-xs sm:text-sm tracking-wider uppercase shadow-xl shadow-brand-600/30 transition-all"
        >
          <Zap className="h-4 w-4 fill-current text-white" />
          <span>RUN SPEED TEST</span>
        </button>
      </div>
    </div>
  );
}
