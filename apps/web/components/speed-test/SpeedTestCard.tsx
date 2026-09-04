'use client';

import React, { useState } from 'react';
import { Play, RotateCcw, Zap, AlertTriangle } from 'lucide-react';
import { 
  IPMCASMeasurementEngine, 
  ProgressState, 
  MeasurementResult 
} from '@ipmcas/measurement-engine';
import { api, APIError } from '../../lib/api';
import TestProgress from './TestProgress';
import DownloadGauge from './DownloadGauge';
import UploadGauge from './UploadGauge';
import LatencyCard from './LatencyCard';
import ServerInfo from './ServerInfo';
import TestResults from './TestResults';

export default function SpeedTestCard() {
  const [concurrency, setConcurrency] = useState<number>(4);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const [finalResult, setFinalResult] = useState<MeasurementResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPersisted, setIsPersisted] = useState<boolean>(false);
  const [persistenceError, setPersistenceError] = useState<string | null>(null);

  const handleStartTest = async () => {
    setIsRunning(true);
    setErrorMsg(null);
    setPersistenceError(null);
    setIsPersisted(false);
    setFinalResult(null);

    // Clear stale measurement context from AI Assistant when launching a new test
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('current-measurement-updated', {
        detail: { measurementId: null, result: null }
      }));
    }

    let sessionId: string | null = null;

    try {
      // 1. Initialize session on FastAPI backend
      try {
        const sessionRes = await api.startSession(concurrency, 'WIFI');
        sessionId = sessionRes?.session_id || null;
      } catch (sessionErr: any) {
        console.warn('Backend session start error:', sessionErr?.message);
        setPersistenceError(`Session creation warning: ${sessionErr?.message || 'Unauthenticated or backend unavailable'}`);
      }

      // 2. Instantiate and run real browser measurement engine
      const engine = new IPMCASMeasurementEngine({
        concurrencyLevel: concurrency,
        downloadDurationSeconds: 10,
        uploadDurationSeconds: 10,
        latencyProbeCount: 10,
        onProgress: (state) => {
          setProgress(state);
        },
      });

      const result = await engine.runFullMeasurement();
      setFinalResult(result);

      // 3. Persist measurement results to Supabase via FastAPI
      let recordedId: string | null = null;
      if (sessionId) {
        try {
          const recRes = await api.recordResult(sessionId, {
            sessionId: result.sessionId,
            timestamp: result.timestamp,
            testType: result.testType,
            server: result.server,
            network: result.network,
            durationSeconds: result.durationSeconds,
            concurrencyLevel: result.concurrencyLevel,
            bytesDownloaded: result.bytesDownloaded,
            bytesUploaded: result.bytesUploaded,
            downloadSpeedMbps: result.downloadSpeedMbps,
            uploadSpeedMbps: result.uploadSpeedMbps,
            latency: result.latency,
            packetLossPercent: result.packetLossPercent,
            requestStatistics: result.requestStatistics,
            httpStatusCode: result.httpStatusCode,
            status: result.status,
            error: result.error,
            isValid: result.isValid,
          });

          if (recRes && (recRes.persisted !== false || recRes.result_id)) {
            setIsPersisted(true);
            setPersistenceError(null);
            recordedId = recRes.result_id || sessionId;
          } else {
            setIsPersisted(false);
            setPersistenceError('Backend returned unpersisted response.');
            recordedId = sessionId;
          }
        } catch (recordErr: any) {
          console.error('Failed to record result to backend:', recordErr?.message);
          setIsPersisted(false);
          setPersistenceError(recordErr?.message || 'Failed to save measurement to database.');
          recordedId = sessionId;
        }
      } else {
        setIsPersisted(false);
        setPersistenceError('No active session ID established. Log in to persist results.');
      }

      // Broadcast current measurement ID to AI Assistant so the new test is immediately focused
      const targetMeasurementId = recordedId || (result as any).id || (result as any).sessionId;
      if (typeof window !== 'undefined' && targetMeasurementId) {
        window.dispatchEvent(new CustomEvent('current-measurement-updated', {
          detail: {
            measurementId: targetMeasurementId,
            result: {
              ...result,
              id: targetMeasurementId,
              result_id: targetMeasurementId,
            }
          }
        }));
      }
    } catch (err: any) {
      if (err instanceof APIError && err.status === 401) {
        setErrorMsg('Authentication session expired. Please log in again.');
      } else {
        setErrorMsg(err.message || 'An unexpected error occurred during measurement.');
      }
    } finally {
      setIsRunning(false);
    }
  };

  const isDownloadActive = progress?.phase === 'DOWNLOAD_TEST';
  const isUploadActive = progress?.phase === 'UPLOAD_TEST';
  const downloadSpeed = isDownloadActive
    ? progress?.currentThroughputMbps || 0
    : finalResult?.downloadSpeedMbps || 0;
  const uploadSpeed = isUploadActive
    ? progress?.currentThroughputMbps || 0
    : finalResult?.uploadSpeedMbps || 0;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Top Controls Bar */}
      <div className="flex items-center justify-between glass-card p-4 rounded-xl border border-dark-border">
        <ServerInfo server={finalResult ? finalResult.server : null} />

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-dark-bg border border-dark-border px-3 py-1.5 rounded-lg text-xs">
            <span className="text-slate-400 font-medium">Streams:</span>
            <select
              value={concurrency}
              onChange={(e) => setConcurrency(Number(e.target.value))}
              disabled={isRunning}
              className="bg-transparent text-brand-400 font-bold focus:outline-none cursor-pointer"
            >
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="4">4 (Default)</option>
              <option value="8">8 (Stress)</option>
            </select>
          </div>

          <button
            onClick={handleStartTest}
            disabled={isRunning}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm shadow-lg transition-all ${
              isRunning
                ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                : 'bg-brand-600 hover:bg-brand-500 text-white shadow-brand-600/30 hover:scale-[1.02]'
            }`}
          >
            {isRunning ? (
              <>
                <RotateCcw className="h-4 w-4 animate-spin" />
                <span>Testing...</span>
              </>
            ) : (
              <>
                <Play className="h-4 w-4 fill-current" />
                <span>START TEST</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Measurement Card */}
      <div className="glass-card rounded-2xl p-6 sm:p-8 space-y-6 relative overflow-hidden border border-brand-500/20">
        <TestProgress progress={progress} />

        {/* Throughput Gauges */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <DownloadGauge mbps={downloadSpeed} active={isDownloadActive} />
          <UploadGauge mbps={uploadSpeed} active={isUploadActive} />
        </div>

        {/* Latency Probe Breakdown */}
        <LatencyCard metrics={finalResult ? finalResult.latency : null} />
      </div>

      {/* Final Summary Result Panel */}
      {finalResult && (
        <TestResults
          result={finalResult}
          isPersisted={isPersisted}
          persistenceError={persistenceError}
        />
      )}

      {/* Error Message Alert */}
      {errorMsg && (
        <div className="glass-card rounded-2xl p-6 border border-red-500/30 bg-red-500/10 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-red-200">Measurement Exception</h3>
            <p className="text-xs text-red-300/80 mt-1">{errorMsg}</p>
          </div>
        </div>
      )}
    </div>
  );
}
