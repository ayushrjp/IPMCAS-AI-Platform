import React from 'react';
import { CheckCircle2, AlertTriangle, Info, Network } from 'lucide-react';
import { MeasurementResult, TestStatus } from '@ipmcas/measurement-engine';

interface TestResultsProps {
  result: MeasurementResult;
  isPersisted?: boolean;
  persistenceError?: string | null;
}

export default function TestResults({ result, isPersisted = false, persistenceError = null }: TestResultsProps) {
  const isRateLimited = result.status === TestStatus.SERVER_RATE_LIMITED || result.httpStatusCode === 429;
  const isCompleted = result.status === TestStatus.COMPLETED || result.status === TestStatus.DURATION_LIMIT_REACHED;

  return (
    <div className="glass-card rounded-2xl p-6 sm:p-8 space-y-6 border border-brand-500/30">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-dark-border pb-4">
        <div className="flex items-center gap-3">
          {isCompleted ? (
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
              <CheckCircle2 className="h-6 w-6" />
            </div>
          ) : (
            <div className="h-10 w-10 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 flex items-center justify-center shrink-0">
              <AlertTriangle className="h-6 w-6" />
            </div>
          )}
          <div>
            <h2 className="text-xl font-extrabold text-white">TEST COMPLETE</h2>
            <span className="text-xs text-slate-400">
              Measured on {new Date(result.timestamp).toLocaleString()}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isPersisted ? (
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 uppercase tracking-wider">
              SAVED TO DATABASE
            </span>
          ) : (
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 uppercase tracking-wider">
              NOT SAVED
            </span>
          )}

          <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
            isCompleted
              ? 'bg-brand-500/20 text-brand-300 border border-brand-500/30'
              : isRateLimited
              ? 'bg-red-500/20 text-red-300 border border-red-500/30'
              : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
          }`}>
            {result.status}
          </div>
        </div>
      </div>

      {/* Persistence Error Warning Banner */}
      {persistenceError && (
        <div className="glass-card rounded-xl p-4 border border-amber-500/30 bg-amber-500/10 flex items-start gap-3 text-left">
          <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-amber-200 uppercase">Failed to Save Measurement</h4>
            <p className="text-xs text-amber-300/90 leading-relaxed">
              {persistenceError}
            </p>
          </div>
        </div>
      )}

      {/* HTTP 429 Rate Limit Warning */}
      {isRateLimited && (
        <div className="glass-card rounded-xl p-4 border border-red-500/30 bg-red-500/10 flex items-start gap-3 text-left">
          <Info className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-red-200 uppercase">SERVER_RATE_LIMITED (HTTP 429)</h4>
            <p className="text-xs text-red-300/90 leading-relaxed">
              The selected test server temporarily rate-limited this measurement. This result is explicitly excluded from valid speed statistics and will not corrupt historical averages.
            </p>
          </div>
        </div>
      )}

      {/* Metric Summary Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center font-mono">
        <div className="p-4 rounded-xl bg-dark-bg border border-dark-border space-y-1">
          <span className="text-[10px] font-sans text-slate-400 uppercase tracking-wider block">Download</span>
          <div className="text-2xl font-bold text-sky-400">
            {isRateLimited ? 'N/A' : `${result.downloadSpeedMbps}`}
            {!isRateLimited && <span className="text-xs text-slate-400 ml-1">Mbps</span>}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-dark-bg border border-dark-border space-y-1">
          <span className="text-[10px] font-sans text-slate-400 uppercase tracking-wider block">Upload</span>
          <div className="text-2xl font-bold text-emerald-400">
            {isRateLimited ? 'N/A' : `${result.uploadSpeedMbps}`}
            {!isRateLimited && <span className="text-xs text-slate-400 ml-1">Mbps</span>}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-dark-bg border border-dark-border space-y-1">
          <span className="text-[10px] font-sans text-slate-400 uppercase tracking-wider block">Latency / Jitter</span>
          <div className="text-2xl font-bold text-indigo-300">
            {result.latency.avgMs} <span className="text-xs text-slate-400">ms</span>
          </div>
          <span className="text-[10px] text-slate-500 font-sans block">Jitter: {result.latency.jitterMs} ms</span>
        </div>

        <div className="p-4 rounded-xl bg-dark-bg border border-dark-border space-y-1">
          <span className="text-[10px] font-sans text-slate-400 uppercase tracking-wider block">Packet Loss</span>
          <div className="text-2xl font-bold text-slate-400">N/A</div>
          <span className="text-[10px] text-slate-500 font-sans block">Browser limitation</span>
        </div>
      </div>

      {/* Concurrency Measurement Breakdown Table */}
      <div className="space-y-3 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Network className="h-4 w-4 text-brand-400" /> Concurrency Streams Breakdown ($N = {result.concurrencyLevel}$)
          </h3>

          <button
            onClick={() => {
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('ask-ai-with-context', {
                  detail: {
                    message: "Explain this specific measurement result",
                    measurementId: (result as any).id || (result as any).result_id,
                    context: result
                  }
                }));
              }
            }}
            className="self-start sm:self-auto inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-extrabold text-xs shadow-lg shadow-brand-600/30 transition-all"
          >
            <span>Explain this specific measurement result</span>
          </button>
        </div>

        <div className="overflow-x-auto rounded-xl border border-dark-border bg-dark-bg">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-dark-card border-b border-dark-border text-slate-400 font-semibold uppercase">
              <tr>
                <th className="px-4 py-2.5">Connections</th>
                <th className="px-4 py-2.5">Aggregate Throughput</th>
                <th className="px-4 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-border font-mono">
              <tr>
                <td className="px-4 py-2 font-bold text-white">{result.concurrencyLevel} parallel streams</td>
                <td className="px-4 py-2 text-sky-300 font-bold">{isRateLimited ? 'N/A' : `${result.downloadSpeedMbps} Mbps`}</td>
                <td className="px-4 py-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    result.isValid ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                  }`}>
                    {result.isValid ? 'VALID' : result.status}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
