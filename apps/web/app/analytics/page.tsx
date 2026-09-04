'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRequireAuth } from '../../lib/auth';
import { api } from '../../lib/api';
import { 
  BarChart3, 
  Database, 
  TrendingUp, 
  ShieldCheck, 
  Zap, 
  Activity, 
  Sparkles,
  Info
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';

export default function AnalyticsPage() {
  const { user, loading: authLoading } = useRequireAuth('/login');
  const [historyRecords, setHistoryRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (user) {
      api.getHistory(1, 100)
        .then((res) => {
          setHistoryRecords(res.data || []);
        })
        .catch((err) => {
          console.error('Failed to fetch analytics data:', err);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [user]);

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <span className="text-slate-400 text-sm font-medium">Computing statistical analytics...</span>
      </div>
    );
  }

  const validRecords = historyRecords
    .filter(r => r.status !== 'SERVER_RATE_LIMITED' && r.httpStatusCode !== 429)
    .reverse(); // Chronological order

  const downloads = validRecords.map(r => r.downloadSpeedMbps || r.throughput_mbps || 0).sort((a, b) => a - b);
  const uploads = validRecords.map(r => r.uploadSpeedMbps || 0).sort((a, b) => a - b);
  const latencies = validRecords.map(r => r.latency?.avgMs || r.latency_avg_ms || r.latencyAvgMs || 0).sort((a, b) => a - b);

  const calcMean = (arr: number[]) => arr.length ? (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1) : '--';
  const calcMedian = (arr: number[]) => arr.length ? arr[Math.floor(arr.length / 2)].toFixed(1) : '--';
  const calcP95 = (arr: number[]) => arr.length ? (arr[Math.floor(arr.length * 0.95)] || arr[arr.length - 1]).toFixed(1) : '--';
  const calcMin = (arr: number[]) => arr.length ? arr[0].toFixed(1) : '--';
  const calcMax = (arr: number[]) => arr.length ? arr[arr.length - 1].toFixed(1) : '--';

  // Format chart series data from real records
  const chartData = validRecords.map((r, i) => ({
    session: `#${i + 1}`,
    time: new Date(r.timestamp || r.createdAt || r.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    download: r.downloadSpeedMbps || r.throughput_mbps || 0,
    upload: r.uploadSpeedMbps || 0,
    latency: r.latency?.avgMs || r.latency_avg_ms || r.latencyAvgMs || 0,
    jitter: r.latency?.jitterMs || r.jitter_ms || r.jitterMs || 0,
    concurrency: r.concurrencyLevel || r.concurrency || 4
  }));

  const isSmallSample = validRecords.length < 3;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-dark-border pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white flex items-center gap-2.5">
            <BarChart3 className="h-6 w-6 text-brand-400" />
            <span>Statistical Analytics & Time-Series</span>
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-0.5">
            Real time-series graphs, throughput percentiles, and latency stability metrics.
          </p>
        </div>

        {validRecords.length > 0 && (
          <button
            onClick={() => {
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('ask-ai-with-context', {
                  detail: {
                    message: "Explain my overall network performance and analytics trends",
                    context: {
                      totalRecords: validRecords.length,
                      meanDownload: calcMean(downloads),
                      medianDownload: calcMedian(downloads),
                      p95Download: calcP95(downloads),
                      meanUpload: calcMean(uploads),
                      meanLatency: calcMean(latencies)
                    }
                  }
                }));
              }
            }}
            className="self-start sm:self-auto flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-extrabold text-xs shadow-lg shadow-brand-600/30 transition-all"
          >
            <Sparkles className="h-4 w-4" />
            <span>Explain My Network Performance</span>
          </button>
        )}
      </div>

      {validRecords.length === 0 ? (
        <div className="glass-card rounded-2xl p-16 text-center space-y-4 border border-dark-border">
          <div className="h-14 w-14 rounded-2xl bg-brand-500/10 border border-brand-500/20 text-brand-400 flex items-center justify-center mx-auto">
            <Database className="h-7 w-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-xl font-extrabold text-white">Not Enough Measurements for Analysis</h3>
            <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto">
              Perform speed test measurements to generate real statistical percentiles and throughput distribution graphs.
            </p>
          </div>
          <Link
            href="/speed-test"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-extrabold text-xs shadow-xl shadow-brand-600/30 transition-all"
          >
            <Zap className="h-4 w-4 fill-current" />
            <span>Run Speed Test</span>
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Sample Size Alert */}
          {isSmallSample && (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2 font-medium">
              <Info className="h-4 w-4 shrink-0 text-amber-400" />
              <span>Limited sample size ({validRecords.length} session). Additional measurements recommended for high statistical confidence.</span>
            </div>
          )}

          {/* Statistical Distribution Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="glass-card rounded-2xl p-5 space-y-3 border border-sky-500/20">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Download Speed Metrics</span>
                <TrendingUp className="h-4 w-4 text-sky-400" />
              </div>
              <div className="space-y-2 font-mono">
                <div className="flex justify-between text-xs">
                  <span className="font-sans text-slate-400">Mean:</span>
                  <span className="font-bold text-sky-400">{calcMean(downloads)} Mbps</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="font-sans text-slate-400">Median (50th):</span>
                  <span className="font-bold text-slate-200">{calcMedian(downloads)} Mbps</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="font-sans text-slate-400">P95 Peak:</span>
                  <span className="font-bold text-sky-300">{calcP95(downloads)} Mbps</span>
                </div>
                <div className="flex justify-between text-xs pt-1 border-t border-dark-border">
                  <span className="font-sans text-slate-400">Min / Max Range:</span>
                  <span className="font-bold text-slate-300">{calcMin(downloads)} - {calcMax(downloads)} Mbps</span>
                </div>
              </div>
            </div>

            <div className="glass-card rounded-2xl p-5 space-y-3 border border-purple-500/20">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Upload Speed Metrics</span>
                <TrendingUp className="h-4 w-4 text-purple-400" />
              </div>
              <div className="space-y-2 font-mono">
                <div className="flex justify-between text-xs">
                  <span className="font-sans text-slate-400">Mean:</span>
                  <span className="font-bold text-purple-400">{calcMean(uploads)} Mbps</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="font-sans text-slate-400">Median (50th):</span>
                  <span className="font-bold text-slate-200">{calcMedian(uploads)} Mbps</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="font-sans text-slate-400">P95 Peak:</span>
                  <span className="font-bold text-purple-300">{calcP95(uploads)} Mbps</span>
                </div>
                <div className="flex justify-between text-xs pt-1 border-t border-dark-border">
                  <span className="font-sans text-slate-400">Min / Max Range:</span>
                  <span className="font-bold text-slate-300">{calcMin(uploads)} - {calcMax(uploads)} Mbps</span>
                </div>
              </div>
            </div>

            <div className="glass-card rounded-2xl p-5 space-y-3 border border-indigo-500/20">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Latency Stability</span>
                <ShieldCheck className="h-4 w-4 text-indigo-400" />
              </div>
              <div className="space-y-2 font-mono">
                <div className="flex justify-between text-xs">
                  <span className="font-sans text-slate-400">Mean RTT:</span>
                  <span className="font-bold text-indigo-300">{calcMean(latencies)} ms</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="font-sans text-slate-400">Median RTT:</span>
                  <span className="font-bold text-slate-200">{calcMedian(latencies)} ms</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="font-sans text-slate-400">P95 RTT Peak:</span>
                  <span className="font-bold text-indigo-400">{calcP95(latencies)} ms</span>
                </div>
                <div className="flex justify-between text-xs pt-1 border-t border-dark-border">
                  <span className="font-sans text-slate-400">Min / Max RTT:</span>
                  <span className="font-bold text-slate-300">{calcMin(latencies)} - {calcMax(latencies)} ms</span>
                </div>
              </div>
            </div>
          </div>

          {/* Time-Series Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart 1: Throughput Over Time */}
            <div className="glass-card rounded-2xl p-5 space-y-4 border border-dark-border">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Activity className="h-4 w-4 text-sky-400" />
                <span>DOWNLOAD & UPLOAD THROUGHPUT OVER TIME (MBPS)</span>
              </h3>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="session" stroke="#64748b" fontSize={10} />
                    <YAxis stroke="#64748b" fontSize={10} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#111827', borderColor: '#1e293b', borderRadius: '12px', fontSize: '12px' }}
                    />
                    <Line type="monotone" dataKey="download" stroke="#38bdf8" strokeWidth={2} dot={{ r: 3 }} name="Download (Mbps)" />
                    <Line type="monotone" dataKey="upload" stroke="#a855f7" strokeWidth={2} dot={{ r: 3 }} name="Upload (Mbps)" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 2: Latency Over Time */}
            <div className="glass-card rounded-2xl p-5 space-y-4 border border-dark-border">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Activity className="h-4 w-4 text-indigo-400" />
                <span>LATENCY & JITTER OVER TIME (MS)</span>
              </h3>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="session" stroke="#64748b" fontSize={10} />
                    <YAxis stroke="#64748b" fontSize={10} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#111827', borderColor: '#1e293b', borderRadius: '12px', fontSize: '12px' }}
                    />
                    <Area type="monotone" dataKey="latency" stroke="#818cf8" fill="#818cf8" fillOpacity={0.2} name="Latency (ms)" />
                    <Area type="monotone" dataKey="jitter" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.1} name="Jitter (ms)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
