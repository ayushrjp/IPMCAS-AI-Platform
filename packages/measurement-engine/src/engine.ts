import {
  EngineConfig,
  MeasurementResult,
  NetworkType,
  ProgressState,
  TestStatus,
  ServerNode,
} from './types';
import { ServerSelector } from './servers/server-selector';
import { LatencyTester } from './latency/latency-tester';
import { DownloadTester } from './download/download-tester';
import { UploadTester } from './upload/upload-tester';
import { isMeasurementValid } from './utils/validation';

export class IPMCASMeasurementEngine {
  private config: EngineConfig;
  private serverSelector: ServerSelector;
  private latencyTester: LatencyTester;
  private downloadTester: DownloadTester;
  private uploadTester: UploadTester;

  constructor(config: EngineConfig) {
    this.config = {
      ...config,
      concurrencyLevel: config.concurrencyLevel ?? 4,
      downloadDurationSeconds: config.downloadDurationSeconds ?? 10,
      uploadDurationSeconds: config.uploadDurationSeconds ?? 10,
      latencyProbeCount: config.latencyProbeCount ?? 10,
    };

    this.serverSelector = new ServerSelector(config.customServerList);
    this.latencyTester = new LatencyTester();
    this.downloadTester = new DownloadTester();
    this.uploadTester = new UploadTester();
  }

  /**
   * Helper to report real-time state machine progress.
   */
  private emitProgress(state: ProgressState) {
    if (this.config.onProgress) {
      this.config.onProgress(state);
    }
  }

  /**
   * Detects browser connection environment gracefully without assuming non-standard APIs exist.
   */
  private detectNetworkType(): { type: NetworkType; effectiveType?: string } {
    if (typeof navigator !== 'undefined' && 'connection' in navigator) {
      const conn = (navigator as any).connection;
      const typeStr = (conn?.type || '').toLowerCase();
      const effType = conn?.effectiveType || '';

      if (typeStr.includes('wifi')) return { type: NetworkType.WIFI, effectiveType: effType };
      if (typeStr.includes('ethernet')) return { type: NetworkType.ETHERNET, effectiveType: effType };
      if (typeStr.includes('cellular')) {
        if (effType === '5g') return { type: NetworkType.CELLULAR_5G, effectiveType: effType };
        return { type: NetworkType.CELLULAR_4G, effectiveType: effType };
      }
    }
    return { type: NetworkType.UNKNOWN };
  }

  /**
   * Runs the complete multi-phase Internet performance measurement sequence.
   */
  async runFullMeasurement(): Promise<MeasurementResult> {
    const sessionId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `sess_${Date.now()}`;
    const timestamp = new Date().toISOString();
    const network = this.detectNetworkType();

    // ------------------------------------------------------------------------
    // Phase 1: INITIALIZING & SERVER SELECTION
    // ------------------------------------------------------------------------
    this.emitProgress({
      phase: 'INITIALIZING',
      progressPercent: 5,
      currentThroughputMbps: 0,
      bytesTransferred: 0,
      elapsedTimeSeconds: 0,
      activeConnections: 0,
      statusMessage: 'Initializing engine and detecting network connection...',
    });

    this.emitProgress({
      phase: 'SERVER_SELECTION',
      progressPercent: 10,
      currentThroughputMbps: 0,
      bytesTransferred: 0,
      elapsedTimeSeconds: 0.5,
      activeConnections: 1,
      statusMessage: 'Benchmarking candidate edge test servers...',
    });

    const targetServer: ServerNode = this.config.selectedServer || await this.serverSelector.selectOptimalServer(3);

    // ------------------------------------------------------------------------
    // Phase 2: LATENCY & JITTER TEST
    // ------------------------------------------------------------------------
    this.emitProgress({
      phase: 'LATENCY_TEST',
      progressPercent: 20,
      currentThroughputMbps: 0,
      bytesTransferred: 0,
      elapsedTimeSeconds: 1.0,
      activeConnections: 1,
      statusMessage: `Testing latency probes against ${targetServer.name}...`,
    });

    const latencyMetrics = await this.latencyTester.runLatencyTest(
      targetServer,
      this.config.latencyProbeCount,
      (completed, total) => {
        const pct = 20 + Math.round((completed / total) * 15);
        this.emitProgress({
          phase: 'LATENCY_TEST',
          progressPercent: pct,
          currentThroughputMbps: 0,
          bytesTransferred: 0,
          elapsedTimeSeconds: 1.0 + (completed * 0.1),
          activeConnections: 1,
          statusMessage: `Latency probe ${completed}/${total} completed (${latencyMetrics?.avgMs || 0} ms)`,
        });
      }
    );

    // ------------------------------------------------------------------------
    // Phase 3: STREAMING DOWNLOAD TEST
    // ------------------------------------------------------------------------
    this.emitProgress({
      phase: 'DOWNLOAD_TEST',
      progressPercent: 35,
      currentThroughputMbps: 0,
      bytesTransferred: 0,
      elapsedTimeSeconds: 2.5,
      activeConnections: this.config.concurrencyLevel,
      statusMessage: `Starting streaming download test (${this.config.concurrencyLevel} parallel connections)...`,
    });

    const downloadMetrics = await this.downloadTester.runDownloadTest(
      targetServer,
      this.config.downloadDurationSeconds,
      this.config.concurrencyLevel,
      (bytes, currentMbps, elapsed) => {
        const pct = 35 + Math.min(30, Math.round((elapsed / this.config.downloadDurationSeconds) * 30));
        this.emitProgress({
          phase: 'DOWNLOAD_TEST',
          progressPercent: pct,
          currentThroughputMbps: currentMbps,
          bytesTransferred: bytes,
          elapsedTimeSeconds: 2.5 + elapsed,
          activeConnections: this.config.concurrencyLevel,
          statusMessage: `Downloading: ${currentMbps} Mbps (${(bytes / 1_000_000).toFixed(1)} MB)`,
        });
      }
    );

    // ------------------------------------------------------------------------
    // Phase 4: UPLOAD TEST
    // ------------------------------------------------------------------------
    this.emitProgress({
      phase: 'UPLOAD_TEST',
      progressPercent: 65,
      currentThroughputMbps: 0,
      bytesTransferred: downloadMetrics.bytesTransferred,
      elapsedTimeSeconds: 12.5,
      activeConnections: Math.min(2, this.config.concurrencyLevel),
      statusMessage: 'Starting upload throughput test...',
    });

    const uploadMetrics = await this.uploadTester.runUploadTest(
      targetServer,
      this.config.uploadDurationSeconds,
      Math.min(2, this.config.concurrencyLevel),
      (bytes, currentMbps, elapsed) => {
        const pct = 65 + Math.min(30, Math.round((elapsed / this.config.uploadDurationSeconds) * 30));
        this.emitProgress({
          phase: 'UPLOAD_TEST',
          progressPercent: pct,
          currentThroughputMbps: currentMbps,
          bytesTransferred: downloadMetrics.bytesTransferred + bytes,
          elapsedTimeSeconds: 12.5 + elapsed,
          activeConnections: Math.min(2, this.config.concurrencyLevel),
          statusMessage: `Uploading: ${currentMbps} Mbps (${(bytes / 1_000_000).toFixed(1)} MB)`,
        });
      }
    );

    // ------------------------------------------------------------------------
    // Phase 5: CALCULATING & FINAL RESULT ASSEMBLY
    // ------------------------------------------------------------------------
    this.emitProgress({
      phase: 'CALCULATING',
      progressPercent: 95,
      currentThroughputMbps: downloadMetrics.throughputMbps,
      bytesTransferred: downloadMetrics.bytesTransferred + uploadMetrics.bytesTransferred,
      elapsedTimeSeconds: 22.5,
      activeConnections: 0,
      statusMessage: 'Calculating final network statistical metrics...',
    });

    const aggregateRequestStats = {
      totalRequests: downloadMetrics.requestStats.totalRequests + uploadMetrics.requestStats.totalRequests,
      startedRequests: downloadMetrics.requestStats.startedRequests + uploadMetrics.requestStats.startedRequests,
      successfulRequests: downloadMetrics.requestStats.successfulRequests + uploadMetrics.requestStats.successfulRequests,
      failedRequests: downloadMetrics.requestStats.failedRequests + uploadMetrics.requestStats.failedRequests,
      rateLimitedRequests: downloadMetrics.requestStats.rateLimitedRequests + uploadMetrics.requestStats.rateLimitedRequests,
      otherHttpErrors: downloadMetrics.requestStats.otherHttpErrors + uploadMetrics.requestStats.otherHttpErrors,
      requestExceptions: downloadMetrics.requestStats.requestExceptions + uploadMetrics.requestStats.requestExceptions,
    };

    // Overall status priority: Rate Limited -> Failure -> Duration Limit -> Completed
    let finalStatus = downloadMetrics.status;
    if (downloadMetrics.status === TestStatus.SERVER_RATE_LIMITED || uploadMetrics.status === TestStatus.SERVER_RATE_LIMITED) {
      finalStatus = TestStatus.SERVER_RATE_LIMITED;
    } else if (downloadMetrics.status === TestStatus.REQUEST_FAILURE || uploadMetrics.status === TestStatus.REQUEST_FAILURE) {
      finalStatus = TestStatus.REQUEST_FAILURE;
    }

    const primaryStatusCode = downloadMetrics.httpStatusCode !== 200 ? downloadMetrics.httpStatusCode : uploadMetrics.httpStatusCode;
    const isValid = isMeasurementValid(finalStatus, primaryStatusCode, downloadMetrics.bytesTransferred);

    const result: MeasurementResult = {
      sessionId,
      timestamp,
      testType: 'FULL',
      server: targetServer,
      network,
      durationSeconds: Math.round((downloadMetrics.activeDurationSeconds + uploadMetrics.activeDurationSeconds) * 100) / 100,
      concurrencyLevel: this.config.concurrencyLevel,
      bytesDownloaded: downloadMetrics.bytesTransferred,
      bytesUploaded: uploadMetrics.bytesTransferred,
      downloadSpeedMbps: downloadMetrics.throughputMbps,
      uploadSpeedMbps: uploadMetrics.throughputMbps,
      latency: latencyMetrics,
      packetLossPercent: null, // Standard browser APIs cannot measure raw ICMP/TCP packet loss reliably (NO FAKE METRICS)
      requestStatistics: aggregateRequestStats,
      httpStatusCode: primaryStatusCode,
      status: finalStatus,
      isValid,
    };

    this.emitProgress({
      phase: 'COMPLETED',
      progressPercent: 100,
      currentThroughputMbps: result.downloadSpeedMbps,
      bytesTransferred: result.bytesDownloaded + result.bytesUploaded,
      elapsedTimeSeconds: 23.0,
      activeConnections: 0,
      statusMessage: 'Measurement test completed successfully!',
      currentMetrics: result,
    });

    return result;
  }
}
