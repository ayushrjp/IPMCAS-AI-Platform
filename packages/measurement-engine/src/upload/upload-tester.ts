import { ServerNode, ThroughputMetrics, RequestStatistics } from '../types';
import { getMonotonicTimeMs, calculateThroughputMbps } from '../utils/math';
import { classifyTestStatus } from '../utils/validation';

export interface UploadProgressCallback {
  (bytesUploaded: number, currentThroughputMbps: number, elapsedTimeSeconds: number): void;
}

export class UploadTester {
  /**
   * Generates a random Uint8Array chunk payload for upload testing.
   */
  private generatePayloadChunk(sizeBytes: number): Uint8Array {
    const chunk = new Uint8Array(sizeBytes);
    // Fill payload chunk
    for (let i = 0; i < sizeBytes; i += 1024) {
      chunk[i] = (i % 256);
    }
    return chunk;
  }

  /**
   * Executes a multi-stream HTTP POST upload throughput test using generated payloads.
   */
  async runUploadTest(
    server: ServerNode,
    durationSeconds: number = 10,
    concurrencyLevel: number = 2,
    onProgress?: UploadProgressCallback
  ): Promise<ThroughputMetrics> {
    const requestStats: RequestStatistics = {
      totalRequests: 0,
      startedRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      rateLimitedRequests: 0,
      otherHttpErrors: 0,
      requestExceptions: 0,
    };

    let totalBytesUploaded = 0;
    let durationLimitReached = false;
    let primaryHttpStatusCode = 200;

    const abortController = new AbortController();
    const startTimeMs = getMonotonicTimeMs();

    const timeoutId = setTimeout(() => {
      durationLimitReached = true;
      abortController.abort();
    }, durationSeconds * 1000);

    const progressIntervalId = setInterval(() => {
      const elapsedSec = (getMonotonicTimeMs() - startTimeMs) / 1000.0;
      if (elapsedSec > 0 && onProgress) {
        const currentMbps = calculateThroughputMbps(totalBytesUploaded, elapsedSec);
        onProgress(totalBytesUploaded, currentMbps, elapsedSec);
      }
    }, 100);

    // 64KB payload chunk per POST request for high temporal precision and reliability on all connections
    const chunkSize = 64 * 1024;
    const payloadChunk = this.generatePayloadChunk(chunkSize);
    const payloadBlob = typeof Blob !== 'undefined'
      ? new Blob([payloadChunk.buffer as ArrayBuffer], { type: 'application/octet-stream' })
      : payloadChunk;

    const uploadPromises = Array.from({ length: concurrencyLevel }).map(async (_, streamIndex) => {
      let chunkSeq = 0;
      while (!durationLimitReached && !abortController.signal.aborted) {
        chunkSeq++;
        requestStats.totalRequests++;
        requestStats.startedRequests++;
        const uploadUrl = `${server.baseUrl}/post?_s=${streamIndex}&_seq=${chunkSeq}&_t=${Date.now()}`;

        try {
          const response = await fetch(uploadUrl, {
            method: 'POST',
            mode: 'cors',
            headers: {
              'Content-Type': 'application/octet-stream',
            },
            body: payloadBlob as unknown as BodyInit,
            signal: abortController.signal,
          });

          primaryHttpStatusCode = response.status;

          if (response.status === 429) {
            console.warn(`[UploadTester] [Stream ${streamIndex + 1}/${concurrencyLevel}] HTTP 429 Rate Limited`);
            requestStats.rateLimitedRequests++;
            requestStats.failedRequests++;
            break;
          }

          if (!response.ok) {
            console.warn(`[UploadTester] [Stream ${streamIndex + 1}/${concurrencyLevel}] Non-ok HTTP status: ${response.status}`);
            requestStats.otherHttpErrors++;
            requestStats.failedRequests++;
            break;
          }

          requestStats.successfulRequests++;
          totalBytesUploaded += payloadChunk.byteLength;
        } catch (error: any) {
          if (error.name === 'AbortError' || durationLimitReached) {
            durationLimitReached = true;
            break;
          } else {
            console.warn(`[UploadTester] [Stream ${streamIndex + 1}/${concurrencyLevel}] Fetch Exception:`, {
              url: uploadUrl,
              method: 'POST',
              errorName: error?.name,
              errorMessage: error?.message,
            });
            requestStats.requestExceptions++;
            requestStats.failedRequests++;
            break;
          }
        }
      }
    });

    await Promise.allSettled(uploadPromises);

    clearTimeout(timeoutId);
    clearInterval(progressIntervalId);

    const endTimeMs = getMonotonicTimeMs();
    const activeDurationSeconds = Math.max(0.001, (endTimeMs - startTimeMs) / 1000.0);

    const status = classifyTestStatus({
      bytesTransferred: totalBytesUploaded,
      activeDurationSeconds,
      targetDurationSeconds: durationSeconds,
      durationLimitReached,
      httpStatusCode: primaryHttpStatusCode,
      requestStats,
    });

    const throughputMbps = calculateThroughputMbps(totalBytesUploaded, activeDurationSeconds);

    return {
      bytesTransferred: totalBytesUploaded,
      throughputMbps,
      activeDurationSeconds: Math.round(activeDurationSeconds * 100) / 100,
      httpStatusCode: primaryHttpStatusCode,
      requestStats,
      status,
    };
  }
}
