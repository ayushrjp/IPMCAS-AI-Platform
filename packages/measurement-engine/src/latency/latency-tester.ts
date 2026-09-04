import { ServerNode, LatencyMetrics } from '../types';
import { getMonotonicTimeMs, calculateLatencyStats, calculateRFC3550Jitter } from '../utils/math';

export class LatencyTester {
  /**
   * Executes a sequence of lightweight latency probes against a target edge server.
   * Measures RTT, Minimum, Maximum, Average, Median, and RFC 3550 Jitter.
   */
  async runLatencyTest(
    server: ServerNode,
    probeCount: number = 10,
    onProgress?: (completedProbes: number, totalProbes: number, lastRttMs: number) => void
  ): Promise<LatencyMetrics> {
    const samples: number[] = [];
    let successfulProbes = 0;
    let failedProbes = 0;

    for (let i = 0; i < probeCount; i++) {
      const startTime = getMonotonicTimeMs();
      const probeUrl = `${server.baseUrl}/get?_probe=${Date.now()}_${i}`;
      console.log(`[LatencyTester] [Probe ${i + 1}/${probeCount}] GET ${probeUrl}`);
      try {
        const response = await fetch(probeUrl, {
          method: 'GET',
          mode: 'cors',
          cache: 'no-store',
        });

        const rtt = getMonotonicTimeMs() - startTime;
        console.log(`[LatencyTester] [Probe ${i + 1}/${probeCount}] Response: ${response.status}, RTT: ${rtt}ms`);

        if (response.ok || response.status === 200 || response.status === 204) {
          samples.push(rtt);
          successfulProbes++;
          if (onProgress) {
            onProgress(i + 1, probeCount, rtt);
          }
        } else {
          console.warn(`[LatencyTester] [Probe ${i + 1}/${probeCount}] Non-ok HTTP status: ${response.status}`);
          failedProbes++;
        }
      } catch (err: any) {
        console.warn(`[LatencyTester] [Probe ${i + 1}/${probeCount}] Fetch Exception:`, {
          url: probeUrl,
          method: 'GET',
          errorName: err?.name,
          errorMessage: err?.message,
        });
        failedProbes++;
      }

      // Small 50ms pacing interval between probes
      if (i < probeCount - 1) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }

    const stats = calculateLatencyStats(samples);
    const jitterMs = calculateRFC3550Jitter(samples);

    return {
      probeCount,
      successfulProbes,
      failedProbes,
      minMs: stats.minMs,
      maxMs: stats.maxMs,
      avgMs: stats.avgMs,
      medianMs: stats.medianMs,
      jitterMs,
    };
  }
}
