import { ServerNode, ThroughputMetrics, RequestStatistics, TestStatus } from '../types';
import { getMonotonicTimeMs, calculateThroughputMbps } from '../utils/math';
import { classifyTestStatus } from '../utils/validation';

export interface DownloadProgressCallback {
  (bytesDownloaded: number, currentThroughputMbps: number, elapsedTimeSeconds: number, activeStreams: number): void;
}

export class DownloadTester {
  /**
   * Executes a streaming multi-connection HTTP GET download throughput measurement test.
   * 
   * @param server Edge test server node
   * @param durationSeconds Target measurement duration (e.g. 10 seconds)
   * @param concurrencyLevel Number of parallel HTTP GET streams (1, 2, 4, 8)
   * @param onProgress Progress callback updated during streaming
   */
  async runDownloadTest(
    server: ServerNode,
    durationSeconds: number = 10,
    concurrencyLevel: number = 4,
    onProgress?: DownloadProgressCallback
  ): Promise<ThroughputMetrics> {
    const requestStats: RequestStatistics = {
      totalRequests: concurrencyLevel,
      startedRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      rateLimitedRequests: 0,
      otherHttpErrors: 0,
      requestExceptions: 0,
    };

    let totalBytesDownloaded = 0;
    let durationLimitReached = false;
    let primaryHttpStatusCode = 200;

    const abortController = new AbortController();
    const startTimeMs = getMonotonicTimeMs();

    // Timer to trigger duration limit abort cutoff
    const timeoutId = setTimeout(() => {
      durationLimitReached = true;
      abortController.abort();
    }, durationSeconds * 1000);

    // Progress tick interval (every 100ms)
    const progressIntervalId = setInterval(() => {
      const elapsedSec = (getMonotonicTimeMs() - startTimeMs) / 1000.0;
      if (elapsedSec > 0 && onProgress) {
        const currentMbps = calculateThroughputMbps(totalBytesDownloaded, elapsedSec);
        onProgress(totalBytesDownloaded, currentMbps, elapsedSec, requestStats.startedRequests);
      }
    }, 100);

    // Launch parallel connection streams
    const streamPromises = Array.from({ length: concurrencyLevel }).map(async (_, streamIndex) => {
      requestStats.startedRequests++;
      // Request 10MB chunk per stream fallback
      const targetChunkSize = 10 * 1024 * 1024;
      const downloadUrl = `${server.baseUrl}/bytes/${targetChunkSize}?_s=${streamIndex}&_t=${Date.now()}`;
      console.log(`[DownloadTester] [Stream ${streamIndex + 1}/${concurrencyLevel}] GET ${downloadUrl}`);

      try {
        const response = await fetch(downloadUrl, {
          method: 'GET',
          mode: 'cors',
          cache: 'no-store',
          signal: abortController.signal,
        });

        primaryHttpStatusCode = response.status;
        console.log(`[DownloadTester] [Stream ${streamIndex + 1}/${concurrencyLevel}] Response status: ${response.status}`);

        if (response.status === 429) {
          console.warn(`[DownloadTester] [Stream ${streamIndex + 1}/${concurrencyLevel}] HTTP 429 Rate Limited`);
          requestStats.rateLimitedRequests++;
          requestStats.failedRequests++;
          return;
        }

        if (!response.ok) {
          console.warn(`[DownloadTester] [Stream ${streamIndex + 1}/${concurrencyLevel}] Non-ok HTTP status: ${response.status}`);
          requestStats.otherHttpErrors++;
          requestStats.failedRequests++;
          return;
        }

        requestStats.successfulRequests++;

        // Process HTTP response body stream
        if (response.body) {
          const reader = response.body.getReader();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) {
              totalBytesDownloaded += value.byteLength;
            }
          }
        }
      } catch (error: any) {
        if (error.name === 'AbortError') {
          console.log(`[DownloadTester] [Stream ${streamIndex + 1}/${concurrencyLevel}] Duration limit reached (AbortError)`);
          durationLimitReached = true;
        } else {
          console.warn(`[DownloadTester] [Stream ${streamIndex + 1}/${concurrencyLevel}] Fetch Exception:`, {
            url: downloadUrl,
            method: 'GET',
            errorName: error?.name,
            errorMessage: error?.message,
          });
          requestStats.requestExceptions++;
          requestStats.failedRequests++;
        }
      }
    });

    await Promise.allSettled(streamPromises);

    clearTimeout(timeoutId);
    clearInterval(progressIntervalId);

    const endTimeMs = getMonotonicTimeMs();
    const activeDurationSeconds = Math.max(0.001, (endTimeMs - startTimeMs) / 1000.0);

    // Classify test status (E3/E4 taxonomy)
    const status = classifyTestStatus({
      bytesTransferred: totalBytesDownloaded,
      activeDurationSeconds,
      targetDurationSeconds: durationSeconds,
      durationLimitReached,
      httpStatusCode: primaryHttpStatusCode,
      requestStats,
    });

    const throughputMbps = calculateThroughputMbps(totalBytesDownloaded, activeDurationSeconds);

    return {
      bytesTransferred: totalBytesDownloaded,
      throughputMbps,
      activeDurationSeconds: Math.round(activeDurationSeconds * 100) / 100,
      httpStatusCode: primaryHttpStatusCode,
      requestStats,
      status,
    };
  }
}
