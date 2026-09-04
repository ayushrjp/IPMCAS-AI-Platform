/**
 * High-resolution monotonic timer helper.
 * Uses performance.now() in browser and Node 16+ environments.
 */
export function getMonotonicTimeMs(): number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

/**
 * Calculates throughput in Megabits per second (Mbps).
 * Formula: throughput_mbps = (bytes_transferred * 8) / (active_duration_seconds * 1,000,000)
 * 
 * @param bytesTransferred Actual measured byte count
 * @param activeDurationSeconds Actual active duration in seconds (must be > 0)
 */
export function calculateThroughputMbps(bytesTransferred: number, activeDurationSeconds: number): number {
  if (bytesTransferred <= 0 || activeDurationSeconds <= 0) {
    return 0.0;
  }
  const bits = bytesTransferred * 8;
  const megabits = bits / 1_000_000;
  const mbps = megabits / activeDurationSeconds;
  return Math.max(0, Math.round(mbps * 100) / 100); // 2 decimal places precision
}

/**
 * Calculates Minimum, Maximum, Average, and Median latency from an array of sample RTTs (in ms).
 */
export function calculateLatencyStats(samplesMs: number[]): {
  minMs: number;
  maxMs: number;
  avgMs: number;
  medianMs: number;
} {
  if (!samplesMs || samplesMs.length === 0) {
    return { minMs: 0, maxMs: 0, avgMs: 0, medianMs: 0 };
  }

  const validSamples = samplesMs.filter((s) => typeof s === 'number' && !isNaN(s) && s >= 0);
  if (validSamples.length === 0) {
    return { minMs: 0, maxMs: 0, avgMs: 0, medianMs: 0 };
  }

  const sorted = [...validSamples].sort((a, b) => a - b);
  const minMs = sorted[0];
  const maxMs = sorted[sorted.length - 1];
  const sum = sorted.reduce((acc, val) => acc + val, 0);
  const avgMs = sum / sorted.length;

  const mid = Math.floor(sorted.length / 2);
  const medianMs = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;

  return {
    minMs: Math.round(minMs * 100) / 100,
    maxMs: Math.round(maxMs * 100) / 100,
    avgMs: Math.round(avgMs * 100) / 100,
    medianMs: Math.round(medianMs * 100) / 100,
  };
}

/**
 * Calculates RFC 3550 Standard Jitter from consecutive latency probe RTTs.
 * Standard Formula: J(i) = J(i-1) + (|D(i-1, i)| - J(i-1)) / 16
 * where D(i-1, i) is the transit time difference between adjacent probes.
 * 
 * @param samplesMs Array of latency sample RTTs in milliseconds
 */
export function calculateRFC3550Jitter(samplesMs: number[]): number {
  if (!samplesMs || samplesMs.length < 2) {
    return 0.0;
  }

  let jitter = 0.0;
  for (let i = 1; i < samplesMs.length; i++) {
    const transitDiff = Math.abs(samplesMs[i] - samplesMs[i - 1]);
    jitter = jitter + (transitDiff - jitter) / 16.0;
  }

  return Math.round(jitter * 100) / 100;
}
