import React from 'react';
import Link from 'next/link';
import { History, Database, Wifi, Zap, ArrowUpRight } from 'lucide-react';

interface RecentTestsProps {
  records: any[];
  loading: boolean;
}

export default function RecentTests({ records, loading }: RecentTestsProps) {
  if (loading) {
    return (
      <div className="glass-card rounded-2xl p-8 text-center text-slate-400">
        <span className="text-sm font-medium">Loading historical measurement records...</span>
      </div>
    );
  }

  if (!records || records.length === 0) {
    return (
      <div className="glass-card rounded-2xl p-12 text-center space-y-4 border border-dark-border">
        <div className="h-12 w-12 rounded-2xl bg-brand-500/10 border border-brand-500/20 text-brand-400 flex items-center justify-center mx-auto">
          <Database className="h-6 w-6" />
        </div>
        <div className="space-y-1">
          <h3 className="text-lg font-bold text-white">No Measurements Yet</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Run your first speed test to start building your network performance history.
          </p>
        </div>
        <Link
          href="/speed-test"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs shadow-lg shadow-brand-600/30 transition-all"
        >
          <Zap className="h-3.5 w-3.5 fill-current" />
          <span>Run Speed Test</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
          <History className="h-4 w-4 text-brand-400" />
          <span>RECENT TESTS</span>
        </h3>
        <Link href="/history" className="text-xs text-brand-400 hover:underline flex items-center gap-1 font-semibold">
          <span>View All ({records.length})</span>
          <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="overflow-x-auto rounded-xl border border-dark-border bg-dark-bg">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-dark-card border-b border-dark-border text-slate-400 font-semibold uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3">Date & Time</th>
              <th className="px-4 py-3">Network</th>
              <th className="px-4 py-3">Download</th>
              <th className="px-4 py-3">Upload</th>
              <th className="px-4 py-3">Latency</th>
              <th className="px-4 py-3">Jitter</th>
              <th className="px-4 py-3">Streams</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-dark-border font-mono">
            {records.slice(0, 5).map((item, idx) => {
              const isRateLimited = item.status === 'SERVER_RATE_LIMITED' || item.httpStatusCode === 429;
              return (
                <tr key={idx} className="hover:bg-dark-hover/50 transition-colors">
                  <td className="px-4 py-3 font-sans text-slate-300">
                    {new Date(item.timestamp || item.createdAt || item.started_at).toLocaleString([], {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </td>
                  <td className="px-4 py-3 font-sans text-slate-200">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-dark-card border border-dark-border text-[11px] font-semibold text-slate-300">
                      <Wifi className="h-3 w-3 text-brand-400" />
                      <span>{item.network?.network_type || item.networkType || 'Wi-Fi'}</span>
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
                  <td className="px-4 py-3 text-right font-sans">
                    <button
                      onClick={() => {
                        if (typeof window !== 'undefined') {
                          window.dispatchEvent(new CustomEvent('ask-ai-with-context', {
                            detail: {
                              message: "Explain this specific measurement result",
                              measurementId: item.id,
                              context: item
                            }
                          }));
                        }
                      }}
                      className="px-2.5 py-1 rounded-lg bg-brand-500/15 hover:bg-brand-500/25 border border-brand-500/30 text-brand-400 text-[11px] font-bold transition-all inline-flex items-center gap-1"
                    >
                      <span>Ask AI</span>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
