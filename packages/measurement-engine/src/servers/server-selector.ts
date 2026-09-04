declare const process: any;

import { ServerNode, LatencyMetrics } from '../types';
import { getMonotonicTimeMs, calculateLatencyStats, calculateRFC3550Jitter } from '../utils/math';

const getPrimaryEdgeBaseUrl = (): string => {
  if (typeof process !== 'undefined' && process.env && process.env.NEXT_PUBLIC_API_BASE_URL) {
    return `${process.env.NEXT_PUBLIC_API_BASE_URL.replace(/\/$/, '')}/api/v1/measurements`;
  }
  return 'http://localhost:8000/api/v1/measurements';
};

/**
 * Default Edge Test Server Directory.
 * Supports public fallback endpoints for browser client testing with documented limitations.
 */
export const DEFAULT_SERVER_NODES: ServerNode[] = [
  {
    id: 'server-local-primary',
    name: 'IPMCAS Primary Server Node (Production / Local Edge)',
    baseUrl: getPrimaryEdgeBaseUrl(),
    region: 'ap-south-1',
    country: 'IN',
    latitude: 19.0760,
    longitude: 72.8777,
    capabilities: { download: true, upload: true, latency: true },
    healthStatus: 'healthy',
    priority: 100,
  },
  {
    id: 'server-ap-south-mumbai',
    name: 'Asia Pacific (Mumbai Fallback)',
    baseUrl: 'https://httpbin.org',
    region: 'ap-south-1',
    country: 'IN',
    latitude: 19.0760,
    longitude: 72.8777,
    capabilities: { download: true, upload: true, latency: true },
    healthStatus: 'degraded',
    priority: 10,
  },
];

export class ServerSelector {
  private servers: ServerNode[];

  constructor(customServers?: ServerNode[]) {
    this.servers = customServers && customServers.length > 0 ? customServers : DEFAULT_SERVER_NODES;
  }

  /**
   * Benchmarks candidate edge servers using lightweight RTT probes and selects the optimal node.
   */
  async selectOptimalServer(probeCount: number = 3): Promise<ServerNode> {
    const activeServers = this.servers.filter((s) => s.healthStatus === 'healthy');
    if (activeServers.length === 0) {
      return this.servers[0];
    }

    if (activeServers.length === 1) {
      return activeServers[0];
    }

    const benchmarkResults = await Promise.all(
      activeServers.map(async (server) => {
        try {
          const latencyStats = await this.pingServer(server, probeCount);
          return {
            server: {
              ...server,
              pingLatencyMs: latencyStats.avgMs,
              jitterMs: latencyStats.jitterMs,
            },
            latencyMs: latencyStats.avgMs,
          };
        } catch {
          return {
            server: { ...server, pingLatencyMs: 9999, jitterMs: 9999 },
            latencyMs: 9999,
          };
        }
      })
    );

    benchmarkResults.sort((a, b) => a.latencyMs - b.latencyMs);
    return benchmarkResults[0].server;
  }

  /**
   * Executes probe RTT pings to a specific edge server node.
   */
  async pingServer(server: ServerNode, probeCount: number = 3): Promise<LatencyMetrics> {
    const samples: number[] = [];
    let successful = 0;
    let failed = 0;

    for (let i = 0; i < probeCount; i++) {
      const start = getMonotonicTimeMs();
      const targetUrl = `${server.baseUrl}/get?_t=${Date.now()}_${i}`;
      console.log(`[ServerSelector] [Ping ${i + 1}/${probeCount}] Requesting: ${targetUrl} (Method: HEAD)`);
      try {
        const response = await fetch(targetUrl, {
          method: 'HEAD',
          mode: 'cors',
          cache: 'no-store',
        });

        const rtt = getMonotonicTimeMs() - start;
        console.log(`[ServerSelector] [Ping ${i + 1}/${probeCount}] Response status: ${response.status}, RTT: ${rtt}ms`);
        if (response.ok || response.status === 304 || response.status === 405) {
          samples.push(rtt);
          successful++;
        } else {
          failed++;
        }
      } catch (err: any) {
        console.warn(`[ServerSelector] [Ping ${i + 1}/${probeCount}] Fetch Exception:`, {
          url: targetUrl,
          method: 'HEAD',
          errorName: err?.name,
          errorMessage: err?.message,
        });
        failed++;
      }
    }

    const stats = calculateLatencyStats(samples);
    const jitterMs = calculateRFC3550Jitter(samples);

    return {
      probeCount,
      successfulProbes: successful,
      failedProbes: failed,
      minMs: stats.minMs,
      maxMs: stats.maxMs,
      avgMs: stats.avgMs,
      medianMs: stats.medianMs,
      jitterMs,
    };
  }
}
