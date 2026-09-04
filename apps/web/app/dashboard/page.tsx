'use client';

import React, { useEffect, useState } from 'react';
import { useRequireAuth } from '../../lib/auth';
import { api } from '../../lib/api';
import DashboardHeader from '../../components/dashboard/DashboardHeader';
import RecentTests from '../../components/dashboard/RecentTests';
import MetricCard from '../../components/speed-test/MetricCard';
import NetworkHealthPanel from '../../components/dashboard/NetworkHealthPanel';
import DashboardMiniChart from '../../components/dashboard/DashboardMiniChart';
import { 
  ArrowDownCircle, 
  ArrowUpCircle, 
  Clock, 
  Zap, 
  Activity, 
  BarChart2, 
  Sparkles,
  ShieldCheck,
  Server,
  Wifi,
  CheckCircle2,
  ArrowUpRight
} from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
  const { user, loading: authLoading } = useRequireAuth('/login');
  const [historyRecords, setHistoryRecords] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(true);

  useEffect(() => {
    if (user) {
      api.getHistory(1, 20)
        .then((res) => {
          setHistoryRecords(res.data || []);
        })
        .catch((err) => {
          console.error('Failed to fetch user measurement history:', err);
        })
        .finally(() => {
          setLoadingHistory(false);
        });
    }
  }, [user]);

  if (authLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <span className="text-slate-400 text-sm font-medium">Verifying authenticated session...</span>
      </div>
    );
  }

  const validRecords = historyRecords.filter(r => r.status !== 'SERVER_RATE_LIMITED' && r.httpStatusCode !== 429);
  const latestTest = validRecords.length > 0 ? validRecords[0] : (historyRecords.length > 0 ? historyRecords[0] : null);
  const previousTest = validRecords.length > 1 ? validRecords[1] : null;

  // Calculate real trends vs previous test
  let dlTrend: { text: string; dir: 'up' | 'down' | 'neutral' } = { text: 'No previous test', dir: 'neutral' };
  let ulTrend: { text: string; dir: 'up' | 'down' | 'neutral' } = { text: 'No previous test', dir: 'neutral' };
  let latTrend: { text: string; dir: 'up' | 'down' | 'neutral' } = { text: 'No previous test', dir: 'neutral' };
  let jitTrend: { text: string; dir: 'up' | 'down' | 'neutral' } = { text: 'Stable', dir: 'neutral' };

  if (latestTest && previousTest) {
    const curDl = latestTest.downloadSpeedMbps || latestTest.throughput_mbps || 0;
    const prevDl = previousTest.downloadSpeedMbps || previousTest.throughput_mbps || 0;
    if (prevDl > 0) {
      const pct = (((curDl - prevDl) / prevDl) * 100).toFixed(1);
      dlTrend = Number(pct) >= 0
        ? { text: `↑ ${pct}% vs previous`, dir: 'up' }
        : { text: `↓ ${Math.abs(Number(pct))}% vs previous`, dir: 'down' };
    }

    const curUl = latestTest.uploadSpeedMbps || 0;
    const prevUl = previousTest.uploadSpeedMbps || 0;
    if (prevUl > 0) {
      const pct = (((curUl - prevUl) / prevUl) * 100).toFixed(1);
      ulTrend = Number(pct) >= 0
        ? { text: `↑ ${pct}% vs previous`, dir: 'up' }
        : { text: `↓ ${Math.abs(Number(pct))}% vs previous`, dir: 'down' };
    }

    const curLat = latestTest.latency?.avgMs || latestTest.latency_avg_ms || latestTest.latencyAvgMs || 0;
    const prevLat = previousTest.latency?.avgMs || previousTest.latency_avg_ms || previousTest.latencyAvgMs || 0;
    const diff = (curLat - prevLat).toFixed(1);
    if (Number(diff) < 0) {
      latTrend = { text: `↓ ${Math.abs(Number(diff))} ms`, dir: 'up' }; // Latency reduction is GOOD (up badge)
    } else if (Number(diff) > 0) {
      latTrend = { text: `↑ ${diff} ms`, dir: 'down' };
    }
  }

  const curJitter = latestTest ? (latestTest.latency?.jitterMs || latestTest.jitter_ms || latestTest.jitterMs || 0) : 0;
  jitTrend = { text: curJitter <= 2 ? 'Stable' : `${curJitter} ms jitter`, dir: curJitter <= 2 ? 'up' : 'down' };

  return (
    <div className="space-y-6">
      {/* Top Banner Hero */}
      <DashboardHeader 
        user={user} 
        totalTests={historyRecords.length} 
        latestTimestamp={latestTest ? (latestTest.timestamp || latestTest.createdAt || latestTest.started_at) : null}
      />

      {/* Primary Performance Metric Cards (4 Cards) */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
          <Activity className="h-4 w-4 text-brand-400" />
          <span>NETWORK PERFORMANCE</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="DOWNLOAD"
            value={latestTest ? (latestTest.status === 'SERVER_RATE_LIMITED' ? 'N/A' : (latestTest.downloadSpeedMbps || latestTest.throughput_mbps || 0)) : '--'}
            unit={latestTest && latestTest.status !== 'SERVER_RATE_LIMITED' ? 'Mbps' : undefined}
            icon={ArrowDownCircle}
            iconColor="text-sky-400"
            subtitle={latestTest ? 'Latest browser measurement' : 'No measurements recorded'}
            trendText={dlTrend.text}
            trendDirection={dlTrend.dir}
          />

          <MetricCard
            title="UPLOAD"
            value={latestTest ? (latestTest.status === 'SERVER_RATE_LIMITED' ? 'N/A' : (latestTest.uploadSpeedMbps || 0)) : '--'}
            unit={latestTest && latestTest.status !== 'SERVER_RATE_LIMITED' ? 'Mbps' : undefined}
            icon={ArrowUpCircle}
            iconColor="text-purple-400"
            subtitle={latestTest ? 'Latest browser measurement' : 'No measurements recorded'}
            trendText={ulTrend.text}
            trendDirection={ulTrend.dir}
          />

          <MetricCard
            title="LATENCY"
            value={latestTest ? (latestTest.latency?.avgMs || latestTest.latency_avg_ms || latestTest.latencyAvgMs || '--') : '--'}
            unit={latestTest ? 'ms' : undefined}
            icon={Clock}
            iconColor="text-indigo-400"
            subtitle={latestTest ? 'Round-trip time (RTT)' : 'No measurements recorded'}
            trendText={latTrend.text}
            trendDirection={latTrend.dir}
          />

          <MetricCard
            title="JITTER"
            value={latestTest ? (latestTest.latency?.jitterMs || latestTest.jitter_ms || latestTest.jitterMs || 0) : '--'}
            unit={latestTest ? 'ms' : undefined}
            icon={Zap}
            iconColor="text-amber-400"
            subtitle={latestTest ? 'RFC 3550 Latency variance' : 'No measurements recorded'}
            trendText={jitTrend.text}
            trendDirection={jitTrend.dir}
          />
        </div>
      </div>

      {/* Middle Row: Network Health Score Panel + Latest Measurement Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Network Health Score Panel */}
        <NetworkHealthPanel latestRecord={latestTest} />

        {/* Latest Test Summary Panel */}
        <div className="lg:col-span-2 glass-card rounded-2xl p-5 border border-dark-border space-y-4 flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-dark-border pb-3">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-brand-400" />
              <span>LATEST MEASUREMENT SESSION</span>
            </span>

            {latestTest ? (
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                latestTest.status === 'COMPLETED' || latestTest.status === 'VALID'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
              }`}>
                {latestTest.status || 'VALID'}
              </span>
            ) : (
              <span className="text-xs text-slate-500">No session available</span>
            )}
          </div>

          {latestTest ? (
            <div className="space-y-3 font-mono text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="p-2.5 rounded-xl bg-dark-bg border border-dark-border">
                  <span className="text-[10px] font-sans text-slate-400 block">Download</span>
                  <span className="font-bold text-sky-400">{latestTest.downloadSpeedMbps || latestTest.throughput_mbps || 0} Mbps</span>
                </div>
                <div className="p-2.5 rounded-xl bg-dark-bg border border-dark-border">
                  <span className="text-[10px] font-sans text-slate-400 block">Upload</span>
                  <span className="font-bold text-purple-400">{latestTest.uploadSpeedMbps || 0} Mbps</span>
                </div>
                <div className="p-2.5 rounded-xl bg-dark-bg border border-dark-border">
                  <span className="text-[10px] font-sans text-slate-400 block">Latency</span>
                  <span className="font-bold text-indigo-300">{latestTest.latency?.avgMs || latestTest.latency_avg_ms || 0} ms</span>
                </div>
                <div className="p-2.5 rounded-xl bg-dark-bg border border-dark-border">
                  <span className="text-[10px] font-sans text-slate-400 block">Streams</span>
                  <span className="font-bold text-white">{latestTest.concurrencyLevel || latestTest.concurrency || 4} TCP</span>
                </div>
              </div>

              <div className="pt-2 border-t border-dark-border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-sans text-slate-400">
                <span className="inline-flex items-center gap-1.5">
                  <Server className="h-3.5 w-3.5 text-brand-400" />
                  <span>Edge Server: {latestTest.server?.name || latestTest.serverName || 'IPMCAS Primary Node'}</span>
                </span>

                <button
                  onClick={() => {
                    if (typeof window !== 'undefined') {
                      window.dispatchEvent(new CustomEvent('ask-ai-with-context', {
                        detail: {
                          message: "Analyze my latest speed test result",
                          context: latestTest
                        }
                      }));
                    }
                  }}
                  className="text-brand-400 hover:underline text-xs font-bold flex items-center gap-1 self-start sm:self-auto"
                >
                  <span>Analyze with AI Assistant</span>
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <div className="py-6 text-center space-y-2">
              <p className="text-xs text-slate-400">No speed test session has been executed in your account history yet.</p>
              <Link
                href="/speed-test"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs transition-all shadow-md shadow-brand-600/20"
              >
                <Zap className="h-3.5 w-3.5 fill-current" />
                <span>Run First Speed Test</span>
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Mini Performance Trend Chart */}
      <DashboardMiniChart records={historyRecords} />

      {/* Recent Measurements History Table */}
      <RecentTests records={historyRecords} loading={loadingHistory} />
    </div>
  );
}
