'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRequireAuth } from '../../lib/auth';
import { api } from '../../lib/api';
import { 
  History, 
  Database, 
  ArrowDownCircle, 
  ArrowUpCircle, 
  Clock, 
  Zap, 
  Wifi, 
  Server
} from 'lucide-react';

export default function HistoryPage() {
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
          console.error('Failed to fetch measurement history:', err);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [user]);

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <span className="text-slate-400 text-sm font-medium">Loading measurement history...</span>
      </div>
    );
  }

  // Calculate real summary statistics from actual user records
  const validRecords = historyRecords.filter(r => r.status !== 'SERVER_RATE_LIMITED' && r.httpStatusCode !== 429);
  const totalTests = historyRecords.length;
  
  const avgDownload = validRecords.length > 0
    ? (validRecords.reduce((acc, r) => acc + (r.downloadSpeedMbps || r.throughput_mbps || 0), 0) / validRecords.length).toFixed(1)
    : '--';

  const avgUpload = validRecords.length > 0
    ? (validRecords.reduce((acc, r) => acc + (r.uploadSpeedMbps || 0), 0) / validRecords.length).toFixed(1)
    : '--';

  const avgLatency = validRecords.length > 0
    ? (validRecords.reduce((acc, r) => acc + (r.latency?.avgMs || r.latency_avg_ms || r.latencyAvgMs || 0), 0) / validRecords.length).toFixed(1)
    : '--';

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-dark-border pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white flex items-center gap-2.5">
            <History className="h-6 w-6 text-brand-400" />
            <span>Measurement History</span>
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-0.5">
            Review your recorded historical network performance metrics stored in Supabase.
          </p>
        </div>

        <Link
          href="/speed-test"
          className="self-start sm:self-auto flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-extrabold text-xs shadow-lg shadow-brand-600/20 transition-all"
        >
          <Zap className="h-4 w-4 fill-current" />
          <span>NEW SPEED TEST</span>
        </Link>
      </div>

      {/* Summary Statistics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card rounded-2xl p-5 space-y-1 border border-brand-500/20">
          <span className="text-[10px] font-sans text-slate-400 uppercase tracking-wider block font-bold">Total Sessions</span>
          <div className="text-2xl font-extrabold text-white flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-400" />
            <span>{totalTests}</span>
          </div>
          <span className="text-[10px] text-slate-500 block">Recorded in database</span>
        </div>

        <div className="glass-card rounded-2xl p-5 space-y-1 border border-sky-500/20">
          <span className="text-[10px] font-sans text-slate-400 uppercase tracking-wider block font-bold">Avg Download</span>
          <div className="text-2xl font-extrabold text-sky-400 flex items-center gap-2">
            <ArrowDownCircle className="h-5 w-5 text-sky-400" />
            <span>{avgDownload}</span>
            {avgDownload !== '--' && <span className="text-xs text-slate-400">Mbps</span>}
          </div>
          <span className="text-[10px] text-slate-500 block">Valid test average</span>
        </div>

        <div className="glass-card rounded-2xl p-5 space-y-1 border border-emerald-500/20">
          <span className="text-[10px] font-sans text-slate-400 uppercase tracking-wider block font-bold">Avg Upload</span>
          <div className="text-2xl font-extrabold text-emerald-400 flex items-center gap-2">
            <ArrowUpCircle className="h-5 w-5 text-emerald-400" />
            <span>{avgUpload}</span>
            {avgUpload !== '--' && <span className="text-xs text-slate-400">Mbps</span>}
          </div>
          <span className="text-[10px] text-slate-500 block">Valid test average</span>
        </div>

        <div className="glass-card rounded-2xl p-5 space-y-1 border border-indigo-500/20">
          <span className="text-[10px] font-sans text-slate-400 uppercase tracking-wider block font-bold">Avg Latency</span>
          <div className="text-2xl font-extrabold text-indigo-300 flex items-center gap-2">
            <Clock className="h-5 w-5 text-indigo-400" />
            <span>{avgLatency}</span>
            {avgLatency !== '--' && <span className="text-xs text-slate-400">ms</span>}
          </div>
          <span className="text-[10px] text-slate-500 block">Round-trip time</span>
        </div>
      </div>

      {/* Main Measurements Table or Empty State */}
      {historyRecords.length === 0 ? (
        <div className="glass-card rounded-2xl p-16 text-center space-y-4 border border-dark-border">
          <div className="h-14 w-14 rounded-2xl bg-brand-500/10 border border-brand-500/20 text-brand-400 flex items-center justify-center mx-auto">
            <Database className="h-7 w-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-xl font-extrabold text-white">No Measurement Records Found</h3>
            <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto">
              Your historical speed tests will appear here once tests are performed and stored in Supabase PostgreSQL.
            </p>
          </div>
          <Link
            href="/speed-test"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-extrabold text-xs shadow-xl shadow-brand-600/30 transition-all"
          >
            <Zap className="h-4 w-4 fill-current" />
            <span>Run First Speed Test</span>
          </Link>
        </div>
      ) : (
        <div className="glass-card rounded-2xl p-4 sm:p-6 space-y-4 border border-dark-border">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              ALL RECORDED SESSIONS ({historyRecords.length})
            </h3>
          </div>

          {/* Desktop Table View (>=768px) */}
          <div className="hidden md:block overflow-x-auto rounded-xl border border-dark-border bg-dark-bg">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-dark-card border-b border-dark-border text-slate-400 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Date & Time</th>
                  <th className="px-4 py-3">Network</th>
                  <th className="px-4 py-3">Server</th>
                  <th className="px-4 py-3">Download</th>
                  <th className="px-4 py-3">Upload</th>
                  <th className="px-4 py-3">Latency</th>
                  <th className="px-4 py-3">Jitter</th>
                  <th className="px-4 py-3">Streams</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-border font-mono">
                {historyRecords.map((item, idx) => {
                  const isRateLimited = item.status === 'SERVER_RATE_LIMITED' || item.httpStatusCode === 429;
                  return (
                    <tr key={idx} className="hover:bg-dark-hover/50 transition-colors">
                      <td className="px-4 py-3 font-sans text-slate-300">
                        {new Date(item.timestamp || item.createdAt || item.started_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 font-sans text-slate-200">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-dark-card border border-dark-border text-[11px] font-semibold text-slate-300">
                          <Wifi className="h-3 w-3 text-brand-400" />
                          <span>{item.network?.network_type || item.networkType || 'Wi-Fi'}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 font-sans text-slate-300">
                        <span className="inline-flex items-center gap-1 text-slate-400">
                          <Server className="h-3 w-3" />
                          <span>{item.server?.name || item.serverName || 'Local Edge'}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 font-bold text-sky-400">
                        {isRateLimited ? 'N/A' : `${item.downloadSpeedMbps || item.throughput_mbps || 0} Mbps`}
                      </td>
                      <td className="px-4 py-3 font-bold text-emerald-400">
                        {isRateLimited ? 'N/A' : `${item.uploadSpeedMbps || 0} Mbps`}
                      </td>
                      <td className="px-4 py-3 text-indigo-300">
                        {item.latency?.avgMs || item.latency_avg_ms || item.latencyAvgMs || 0} ms
                      </td>
                      <td className="px-4 py-3 text-slate-400">
                        {item.latency?.jitterMs || item.jitter_ms || item.jitterMs || 0} ms
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-300">
                        {item.concurrencyLevel || item.concurrency || 4}
                      </td>
                      <td className="px-4 py-3 font-sans">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                          item.status === 'COMPLETED' || item.status === 'VALID'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : isRateLimited
                            ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        }`}>
                          {item.status || 'VALID'}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-sans">
                        <button
                          onClick={() => {
                            if (typeof window !== 'undefined') {
                              window.dispatchEvent(new CustomEvent('ask-ai-with-context', {
                                detail: {
                                  message: "Explain this specific measurement result",
                                  context: item
                                }
                              }));
                            }
                          }}
                          className="px-2.5 py-1 rounded-lg bg-brand-500/15 hover:bg-brand-500/25 border border-brand-500/30 text-brand-400 text-[11px] font-bold transition-all"
                        >
                          Ask AI
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards View (<768px) */}
          <div className="md:hidden space-y-3">
            {historyRecords.map((item, idx) => {
              const isRateLimited = item.status === 'SERVER_RATE_LIMITED' || item.httpStatusCode === 429;
              return (
                <div key={idx} className="p-4 rounded-xl bg-dark-bg border border-dark-border space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-sans">
                      {new Date(item.timestamp || item.createdAt || item.started_at).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                      item.status === 'COMPLETED' || item.status === 'VALID'
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : isRateLimited
                        ? 'bg-red-500/20 text-red-300'
                        : 'bg-amber-500/20 text-amber-300'
                    }`}>
                      {item.status || 'VALID'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 font-mono text-xs">
                    <div className="p-2.5 rounded-lg bg-dark-card border border-dark-border">
                      <span className="text-[10px] font-sans text-slate-400 block">Download</span>
                      <span className="font-bold text-sky-400">
                        {isRateLimited ? 'N/A' : `${item.downloadSpeedMbps || item.throughput_mbps || 0} Mbps`}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-dark-card border border-dark-border">
                      <span className="text-[10px] font-sans text-slate-400 block">Upload</span>
                      <span className="font-bold text-emerald-400">
                        {isRateLimited ? 'N/A' : `${item.uploadSpeedMbps || 0} Mbps`}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-dark-card border border-dark-border">
                      <span className="text-[10px] font-sans text-slate-400 block">Latency</span>
                      <span className="font-bold text-indigo-300">
                        {item.latency?.avgMs || item.latency_avg_ms || item.latencyAvgMs || 0} ms
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-dark-card border border-dark-border">
                      <span className="text-[10px] font-sans text-slate-400 block">Jitter</span>
                      <span className="font-bold text-slate-400">
                        {item.latency?.jitterMs || item.jitter_ms || item.jitterMs || 0} ms
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-dark-border flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                      <Wifi className="h-3 w-3 text-brand-400" />
                      <span>{item.network?.network_type || item.networkType || 'Wi-Fi'}</span>
                    </span>

                    <button
                      onClick={() => {
                        if (typeof window !== 'undefined') {
                          window.dispatchEvent(new CustomEvent('ask-ai-with-context', {
                            detail: {
                              message: "Explain this specific measurement result",
                              context: item
                            }
                          }));
                        }
                      }}
                      className="px-3 py-1 rounded-lg bg-brand-500/15 hover:bg-brand-500/25 border border-brand-500/30 text-brand-400 text-xs font-bold transition-all"
                    >
                      Ask AI
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
