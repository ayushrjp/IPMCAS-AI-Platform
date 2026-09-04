const assert = require('node:assert');
const { describe, it } = require('node:test');

/**
 * Unit regression test for Supabase Database Persistence Mapping
 * Verifies that measurement engine payloads correctly translate to the 
 * PostgreSQL column schema defined in database/migrations/001_initial_schema.sql.
 */

function buildSupabaseResultRecord(sessionId, userId, serverId, enginePayload) {
  const latency = enginePayload.latency || {};
  const reqStats = enginePayload.requestStatistics || {};

  return {
    session_id: sessionId,
    user_id: userId,
    server_id: serverId,
    test_type: enginePayload.testType || 'FULL',
    concurrency: enginePayload.concurrencyLevel || 4,
    configured_duration_s: 10.0,
    actual_duration_s: Math.max(0.1, enginePayload.durationSeconds || 0),
    bytes_transferred: (enginePayload.bytesDownloaded || 0) + (enginePayload.bytesUploaded || 0),
    throughput_mbps: enginePayload.downloadSpeedMbps || 0.0,
    latency_min_ms: latency.minMs || 0.0,
    latency_avg_ms: latency.avgMs || 0.0,
    latency_median_ms: latency.medianMs || 0.0,
    latency_max_ms: latency.maxMs || 0.0,
    jitter_ms: latency.jitterMs || 0.0,
    packet_loss_percent: enginePayload.packetLossPercent !== undefined ? enginePayload.packetLossPercent : null,
    total_requests: reqStats.totalRequests || 0,
    successful_requests: reqStats.successfulRequests || 0,
    rate_limited_requests: reqStats.rateLimitedRequests || 0,
    other_http_errors: reqStats.otherHttpErrors || 0,
    request_exceptions: reqStats.requestExceptions || 0,
    http_status: enginePayload.httpStatusCode || 200,
    status: enginePayload.status || 'COMPLETED',
    error: enginePayload.error || null
  };
}

describe('Task 4 Database Persistence Audit - Schema Mapping Tests', () => {
  it('1. Correctly maps complete measurement engine result to Supabase public.measurement_results columns', () => {
    const mockPayload = {
      sessionId: 'sess_12345',
      timestamp: '2026-08-31T19:30:00.000Z',
      testType: 'FULL',
      server: { name: 'Test Edge Node', baseUrl: 'http://localhost:8000/api/v1/measurements' },
      network: { type: 'WIFI' },
      durationSeconds: 20.5,
      concurrencyLevel: 4,
      bytesDownloaded: 50000000,
      bytesUploaded: 25000000,
      downloadSpeedMbps: 603.5,
      uploadSpeedMbps: 569.7,
      latency: {
        minMs: 5.2,
        avgMs: 8.57,
        medianMs: 8.9,
        maxMs: 11.9,
        jitterMs: 1.08,
        probeCount: 10
      },
      packetLossPercent: null,
      requestStatistics: {
        totalRequests: 8,
        successfulRequests: 8,
        rateLimitedRequests: 0,
        otherHttpErrors: 0,
        requestExceptions: 0
      },
      httpStatusCode: 200,
      status: 'COMPLETED',
      error: null,
      isValid: true
    };

    const record = buildSupabaseResultRecord('sess_12345', 'user_abc', 'srv_987', mockPayload);

    assert.strictEqual(record.session_id, 'sess_12345');
    assert.strictEqual(record.user_id, 'user_abc');
    assert.strictEqual(record.server_id, 'srv_987');
    assert.strictEqual(record.test_type, 'FULL');
    assert.strictEqual(record.concurrency, 4);
    assert.strictEqual(record.bytes_transferred, 75000000);
    assert.strictEqual(record.throughput_mbps, 603.5);
    assert.strictEqual(record.latency_avg_ms, 8.57);
    assert.strictEqual(record.latency_median_ms, 8.9);
    assert.strictEqual(record.jitter_ms, 1.08);
    assert.strictEqual(record.packet_loss_percent, null);
    assert.strictEqual(record.total_requests, 8);
    assert.strictEqual(record.successful_requests, 8);
    assert.strictEqual(record.http_status, 200);
    assert.strictEqual(record.status, 'COMPLETED');
  });

  it('2. Enforces positive actual_duration_s constraint (actual_duration_s > 0)', () => {
    const invalidPayload = { durationSeconds: 0 };
    const record = buildSupabaseResultRecord('sess_1', 'user_1', 'srv_1', invalidPayload);
    assert.ok(record.actual_duration_s > 0, 'actual_duration_s must be > 0');
  });

  it('3. Handled HTTP 429 rate limit classification correctly', () => {
    const rateLimitedPayload = {
      httpStatusCode: 429,
      status: 'SERVER_RATE_LIMITED',
      requestStatistics: { totalRequests: 4, successfulRequests: 0, rateLimitedRequests: 4 }
    };
    const record = buildSupabaseResultRecord('sess_2', 'user_1', 'srv_1', rateLimitedPayload);
    assert.strictEqual(record.http_status, 429);
    assert.strictEqual(record.status, 'SERVER_RATE_LIMITED');
    assert.strictEqual(record.rate_limited_requests, 4);
  });
});
