const assert = require('node:assert');
const { test, describe, it } = require('node:test');

// Test throughput calculation formula
function calculateThroughputMbps(bytesTransferred, activeDurationSeconds) {
  if (bytesTransferred <= 0 || activeDurationSeconds <= 0) {
    return 0.0;
  }
  const bits = bytesTransferred * 8;
  const megabits = bits / 1_000_000;
  const mbps = megabits / activeDurationSeconds;
  return Math.max(0, Math.round(mbps * 100) / 100);
}

// Test Latency Stats
function calculateLatencyStats(samplesMs) {
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

// Test RFC 3550 Jitter
function calculateRFC3550Jitter(samplesMs) {
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

// Test Status Classification
function classifyTestStatus(params) {
  const { bytesTransferred, durationLimitReached, httpStatusCode, requestStats, timedOut, hasException } = params;
  if (httpStatusCode === 429 || (requestStats && requestStats.rateLimitedRequests > 0)) {
    return 'SERVER_RATE_LIMITED';
  }
  if (timedOut) {
    return 'TIMEOUT';
  }
  if (bytesTransferred === 0 && (requestStats && requestStats.successfulRequests === 0)) {
    return 'REQUEST_FAILURE';
  }
  if (durationLimitReached && bytesTransferred > 0) {
    return 'DURATION_LIMIT_REACHED';
  }
  if (bytesTransferred > 0) {
    return 'COMPLETED';
  }
  return 'OTHER_ERROR';
}

function isMeasurementValid(status, httpStatusCode, bytesTransferred) {
  if (httpStatusCode === 429 || status === 'SERVER_RATE_LIMITED') {
    return false;
  }
  return bytesTransferred > 0 && (status === 'COMPLETED' || status === 'DURATION_LIMIT_REACHED');
}

describe('IPMCAS Engine - Mathematical Formulas', () => {
  it('should accurately calculate throughput in Mbps', () => {
    const bytes = 12.5 * 1024 * 1024;
    const mbps = calculateThroughputMbps(bytes, 1.0);
    assert.strictEqual(mbps, 104.86);
  });

  it('should handle zero bytes and zero duration gracefully', () => {
    assert.strictEqual(calculateThroughputMbps(0, 10), 0);
    assert.strictEqual(calculateThroughputMbps(100, 0), 0);
  });

  it('should calculate latency min, max, avg, median', () => {
    const stats = calculateLatencyStats([10, 20, 15, 30, 25]);
    assert.strictEqual(stats.minMs, 10);
    assert.strictEqual(stats.maxMs, 30);
    assert.strictEqual(stats.avgMs, 20);
    assert.strictEqual(stats.medianMs, 20);
  });

  it('should calculate RFC 3550 Jitter correctly', () => {
    const jitter = calculateRFC3550Jitter([10, 12, 11, 15, 14]);
    assert.ok(jitter > 0);
  });
});

describe('IPMCAS Engine - Status Taxonomy & HTTP 429 Rate Limiting', () => {
  it('CRITICAL: HTTP 429 MUST be classified as SERVER_RATE_LIMITED', () => {
    const status = classifyTestStatus({
      bytesTransferred: 500,
      httpStatusCode: 429,
      requestStats: { rateLimitedRequests: 1 },
    });
    assert.strictEqual(status, 'SERVER_RATE_LIMITED');
  });

  it('CRITICAL: HTTP 429 measurements MUST NOT be valid for speed averages', () => {
    const isValid = isMeasurementValid('SERVER_RATE_LIMITED', 429, 500);
    assert.strictEqual(isValid, false);
  });

  it('Duration limit cutoff should be classified as DURATION_LIMIT_REACHED and marked valid', () => {
    const status = classifyTestStatus({
      bytesTransferred: 100000,
      durationLimitReached: true,
      httpStatusCode: 200,
      requestStats: { successfulRequests: 4 },
    });
    assert.strictEqual(status, 'DURATION_LIMIT_REACHED');
    assert.strictEqual(isMeasurementValid(status, 200, 100000), true);
  });
});
