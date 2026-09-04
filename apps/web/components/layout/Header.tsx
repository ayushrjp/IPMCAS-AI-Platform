'use client';

import React from 'react';
import Link from 'next/link';
import { Activity, ShieldCheck, User } from 'lucide-react';

export default function Header() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-dark-border bg-dark-bg/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600/20 border border-brand-500/30 text-brand-500 group-hover:scale-105 transition-transform">
              <Activity className="h-6 w-6" />
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight text-white block">IPMCAS</span>
              <span className="text-[10px] text-slate-400 block -mt-1 tracking-widest uppercase">Network Intelligence</span>
            </div>
          </Link>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Engine Ready</span>
          </div>

          <Link
            href="/login"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-dark-card border border-dark-border text-sm font-medium text-slate-200 hover:border-brand-500/40 hover:text-white transition-all"
          >
            <User className="h-4 w-4 text-slate-400" />
            <span>Account</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
