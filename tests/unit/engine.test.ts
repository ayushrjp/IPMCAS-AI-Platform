import assert from 'node:assert';
import test, { describe, it } from 'node:test';

import {
  calculateThroughputMbps,
  calculateLatencyStats,
  calculateRFC3550Jitter,
} from '../../packages/measurement-engine/src/utils/math';

import {
  classifyTestStatus,
  isMeasurementValid,
} from '../../packages/measurement-engine/src/utils/validation';

import { TestStatus, RequestStatistics } from '../../packages/measurement-engine/src/types';

describe('IPMCAS Measurement Engine - Mathematical Utilities', () => {
  it('should accurately calculate throughput in Mbps', () => {
    // 12.5 MB (100,000,000 bits) transferred in 1.0 second = 100.0 Mbps
    const bytes = 12.5 * 1024 * 1024; // 13,107,200 bytes
    const duration = 1.0;
    const mbps = calculateThroughputMbps(bytes, duration);
    assert.strictEqual(mbps, 104.86); // 13107200 * 8 / 1e6 = 104.8576 -> 104.86
  });

  it('should handle zero bytes or zero duration gracefully without NaN or Infinity', () => {
    assert.strictEqual(calculateThroughputMbps(0, 10.0), 0.0);
    assert.strictEqual(calculateThroughputMbps(1000, 0.0), 0.0);
    assert.strictEqual(calculateThroughputMbps(-100, 5.0), 0.0);
  });

  it('should correctly calculate Latency Stats (min, max, avg, median)', () => {
    const samples = [10.0, 20.0, 15.0, 30.0, 25.0];
    const stats = calculateLatencyStats(samples);

    assert.strictEqual(stats.minMs, 10.0);
    assert.strictEqual(stats.maxMs, 30.0);
    assert.strictEqual(stats.avgMs, 20.0);
    assert.strictEqual(stats.medianMs, 20.0);
  });

  it('should accurately calculate RFC 3550 Standard Jitter', () => {
    const samples = [10.0, 12.0, 11.0, 15.0, 14.0];
    const jitter = calculateRFC3550Jitter(samples);
    assert.ok(jitter > 0, 'Jitter should be greater than 0');
    assert.ok(jitter < 5.0, 'Jitter should be reasonable for close RTTs');
  });
});

describe('IPMCAS Measurement Engine - Error Taxonomy & HTTP 429 Classification', () => {
  const defaultRequestStats: RequestStatistics = {
    totalRequests: 4,
    startedRequests: 4,
    successfulRequests: 4,
    failedRequests: 0,
    rateLimitedRequests: 0,
    otherHttpErrors: 0,
    requestExceptions: 0,
  };

  it('CRITICAL: should classify HTTP 429 as SERVER_RATE_LIMITED', () => {
    const rateLimitedStats: RequestStatistics = {
      ...defaultRequestStats,
      rateLimitedRequests: 2,
      failedRequests: 2,
    };

    const status = classifyTestStatus({
      bytesTransferred: 5000,
      activeDurationSeconds: 2.0,
      targetDurationSeconds: 10.0,
      durationLimitReached: false,
      httpStatusCode: 429,
      requestStats: rateLimitedStats,
    });

    assert.strictEqual(status, TestStatus.SERVER_RATE_LIMITED);
  });

  it('CRITICAL: should mark HTTP 429 rate-limited tests as invalid for speed averages', () => {
    const isValid = isMeasurementValid(TestStatus.SERVER_RATE_LIMITED, 429, 50000);
    assert.strictEqual(isValid, false, 'Rate-limited test MUST NOT be valid for speed stats');
  });

  it('should classify duration limit cutoff as DURATION_LIMIT_REACHED', () => {
    const status = classifyTestStatus({
      bytesTransferred: 10000000,
      activeDurationSeconds: 10.0,
      targetDurationSeconds: 10.0,
      durationLimitReached: true,
      httpStatusCode: 200,
      requestStats: defaultRequestStats,
    });

    assert.strictEqual(status, TestStatus.DURATION_LIMIT_REACHED);
    assert.strictEqual(isMeasurementValid(status, 200, 10000000), true);
  });

  it('should classify normal full transfer as COMPLETED', () => {
    const status = classifyTestStatus({
      bytesTransferred: 5000000,
      activeDurationSeconds: 4.5,
      targetDurationSeconds: 10.0,
      durationLimitReached: false,
      httpStatusCode: 200,
      requestStats: defaultRequestStats,
    });

    assert.strictEqual(status, TestStatus.COMPLETED);
    assert.strictEqual(isMeasurementValid(status, 200, 5000000), true);
  });

  it('should classify 0 bytes transferred with HTTP errors as REQUEST_FAILURE', () => {
    const failedStats: RequestStatistics = {
      ...defaultRequestStats,
      successfulRequests: 0,
      failedRequests: 4,
      otherHttpErrors: 4,
    };

    const status = classifyTestStatus({
      bytesTransferred: 0,
      activeDurationSeconds: 1.0,
      targetDurationSeconds: 10.0,
      durationLimitReached: false,
      httpStatusCode: 500,
      requestStats: failedStats,
    });

    assert.strictEqual(status, TestStatus.REQUEST_FAILURE);
    assert.strictEqual(isMeasurementValid(status, 500, 0), false);
  });
});
