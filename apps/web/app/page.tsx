import React from 'react';
import Link from 'next/link';
import { Zap, Activity, BarChart2, Bot, ShieldCheck, ArrowRight } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="space-y-12 py-4">
      {/* Hero Section */}
      <div className="glass-card rounded-2xl p-8 md:p-12 relative overflow-hidden border border-brand-500/20">
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="max-w-3xl space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/30 text-brand-400 text-xs font-semibold uppercase tracking-wider">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Research-Backed Real-Time Engine</span>
          </div>

          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white leading-tight">
            IPMCAS Platform
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-brand-400 via-sky-300 to-indigo-400">
              Internet Performance Measurement & AI Intelligence
            </span>
          </h1>

          <p className="text-slate-300 text-lg leading-relaxed">
            A production-ready platform for real-time Internet speed testing, multi-connection concurrency analysis, statistical network profiling, and context-aware AI diagnostic support.
          </p>

          <div className="flex flex-wrap items-center gap-4 pt-2">
            <Link
              href="/speed-test"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold shadow-lg shadow-brand-600/30 transition-all hover:scale-[1.02]"
            >
              <Zap className="h-5 w-5" />
              <span>Launch Speed Test</span>
            </Link>

            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-dark-card border border-dark-border hover:border-slate-600 text-slate-200 font-semibold transition-all"
            >
              <span>View Dashboard</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* Feature Highlights Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-card glass-card-hover rounded-xl p-6 space-y-3">
          <div className="h-10 w-10 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center">
            <Activity className="h-5 w-5" />
          </div>
          <h3 className="text-lg font-bold text-white">Empirical Engine</h3>
          <p className="text-sm text-slate-400 leading-relaxed">
            Multi-stream HTTP GET/POST concurrency ($N=1\dots16$) with explicit HTTP 429 rate limit classification derived from DRDO E2-E4 research.
          </p>
        </div>

        <div className="glass-card glass-card-hover rounded-xl p-6 space-y-3">
          <div className="h-10 w-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
            <BarChart2 className="h-5 w-5" />
          </div>
          <h3 className="text-lg font-bold text-white">Statistical Analytics</h3>
          <p className="text-sm text-slate-400 leading-relaxed">
            Mean, median, percentiles ($p_{50}, p_{95}$), standard deviation, and 95% confidence intervals across Wi-Fi, 4G, and 5G networks.
          </p>
        </div>

        <div className="glass-card glass-card-hover rounded-xl p-6 space-y-3">
          <div className="h-10 w-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <Bot className="h-5 w-5" />
          </div>
          <h3 className="text-lg font-bold text-white">AI Network Assistant</h3>
          <p className="text-sm text-slate-400 leading-relaxed">
            Backend-orchestrated LLM assistant providing human-readable explanations based strictly on actual recorded measurement data.
          </p>
        </div>
      </div>
    </div>
  );
}
