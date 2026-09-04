'use client';

import React, { useEffect, useState } from 'react';
import { useRequireAuth } from '../../lib/auth';
import { api } from '../../lib/api';
import { GitCompare, Wifi, Radio, ArrowRightLeft } from 'lucide-react';

export default function ComparePage() {
  const { user, loading: authLoading } = useRequireAuth('/login');
  const [historyRecords, setHistoryRecords] = useState<any[]>([]);

  useEffect(() => {
    if (user) {
      api.getHistory(1, 100).then((res) => setHistoryRecords(res.data || [])).catch(() => {});
    }
  }, [user]);

  if (authLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <span className="text-slate-400 text-sm font-medium">Loading comparison data...</span>
      </div>
    );
  }

  const wifiRecords = historyRecords.filter(r => (r.network?.network_type || r.networkType || 'WIFI') === 'WIFI');
  const avgWifiDownload = wifiRecords.length > 0
    ? (wifiRecords.reduce((acc, r) => acc + (r.downloadSpeedMbps || r.throughput_mbps || 0), 0) / wifiRecords.length).toFixed(1)
    : '--';
  const avgWifiLatency = wifiRecords.length > 0
    ? (wifiRecords.reduce((acc, r) => acc + (r.latency?.avgMs || r.latency_avg_ms || 0), 0) / wifiRecords.length).toFixed(1)
    : '--';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-dark-border pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white flex items-center gap-2.5">
            <GitCompare className="h-6 w-6 text-brand-400" />
            <span>Network Comparison</span>
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-0.5">
            Compare Wi-Fi vs Mobile Data performance using stored measurement sessions.
          </p>
        </div>

        <button
          onClick={() => {
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('ask-ai-with-context', {
                detail: {
                  message: "Compare my Wi-Fi vs mobile cellular network performance",
                  context: { wifiAvgDownload: avgWifiDownload, wifiAvgLatency: avgWifiLatency }
                }
              }));
            }
          }}
          className="self-start sm:self-auto flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-extrabold text-xs shadow-lg shadow-brand-600/30 transition-all"
        >
          <span>Ask AI to Compare Networks</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass-card rounded-2xl p-6 space-y-4 border border-brand-500/20">
          <div className="flex items-center justify-between border-b border-dark-border pb-3">
            <div className="flex items-center gap-2">
              <Wifi className="h-5 w-5 text-sky-400" />
              <h3 className="font-bold text-white text-base">Environment A: Wi-Fi</h3>
            </div>
            <span className="text-xs text-slate-400 font-mono">{wifiRecords.length} sessions</span>
          </div>

          <div className="space-y-3 text-xs font-mono">
            <div className="flex justify-between p-3 rounded-xl bg-dark-bg border border-dark-border">
              <span className="font-sans text-slate-400">Avg Download:</span>
              <span className="font-bold text-sky-400">{avgWifiDownload} {avgWifiDownload !== '--' && 'Mbps'}</span>
            </div>
            <div className="flex justify-between p-3 rounded-xl bg-dark-bg border border-dark-border">
              <span className="font-sans text-slate-400">Avg Latency:</span>
              <span className="font-bold text-indigo-300">{avgWifiLatency} {avgWifiLatency !== '--' && 'ms'}</span>
            </div>
          </div>
        </div>

        <div className="glass-card rounded-2xl p-6 space-y-4 border border-purple-500/20">
          <div className="flex items-center justify-between border-b border-dark-border pb-3">
            <div className="flex items-center gap-2">
              <Radio className="h-5 w-5 text-purple-400" />
              <h3 className="font-bold text-white text-base">Environment B: Cellular (5G/4G)</h3>
            </div>
            <span className="text-xs text-slate-400 font-mono">0 sessions</span>
          </div>

          <div className="space-y-3 text-xs font-mono">
            <div className="flex justify-between p-3 rounded-xl bg-dark-bg border border-dark-border">
              <span className="font-sans text-slate-400">Avg Download:</span>
              <span className="font-bold text-purple-400">--</span>
            </div>
            <div className="flex justify-between p-3 rounded-xl bg-dark-bg border border-dark-border">
              <span className="font-sans text-slate-400">Avg Latency:</span>
              <span className="font-bold text-indigo-300">--</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
