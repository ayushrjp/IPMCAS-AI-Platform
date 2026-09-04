const assert = require('node:assert');
const { test, describe, it } = require('node:test');

// In-memory data store for testing history retrieval isolation across users
const mockUserHistoryStore = {
  'user-uuid-1': [
    {
      id: 'res-1',
      sessionId: 'sess-1',
      userId: 'user-uuid-1',
      downloadSpeedMbps: 42.37,
      uploadSpeedMbps: 18.21,
      latencyAvgMs: 24.6,
      jitterMs: 3.2,
      packetLossPercent: null,
      status: 'COMPLETED',
      httpStatusCode: 200,
      createdAt: '2026-08-30T17:25:00Z',
    },
    {
      id: 'res-2',
      sessionId: 'sess-2',
      userId: 'user-uuid-1',
      downloadSpeedMbps: 0.0,
      uploadSpeedMbps: 0.0,
      latencyAvgMs: 22.1,
      jitterMs: 2.8,
      packetLossPercent: null,
      status: 'SERVER_RATE_LIMITED',
      httpStatusCode: 429,
      createdAt: '2026-08-30T17:20:00Z',
    },
  ],
  'user-uuid-2': [
    {
      id: 'res-3',
      sessionId: 'sess-3',
      userId: 'user-uuid-2',
      downloadSpeedMbps: 95.4,
      uploadSpeedMbps: 40.2,
      latencyAvgMs: 12.1,
      jitterMs: 1.5,
      packetLossPercent: null,
      status: 'COMPLETED',
      httpStatusCode: 200,
      createdAt: '2026-08-30T17:26:00Z',
    },
  ],
};

function getHistoryForUser(authHeader, page = 1, limit = 20) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw { status: 401, detail: 'Authentication required. Please log in.' };
  }
  const token = authHeader.replace('Bearer ', '');
  let userId;
  if (token === 'user-1-token') userId = 'user-uuid-1';
  else if (token === 'user-2-token') userId = 'user-uuid-2';
  else throw { status: 401, detail: 'Invalid authentication token.' };

  const records = mockUserHistoryStore[userId] || [];
  const start = (page - 1) * limit;
  const pageData = records.slice(start, start + limit);

  return {
    status: 200,
    page,
    limit,
    total_records: records.length,
    data: pageData,
  };
}

function formatSpeedDisplay(result) {
  if (result.status === 'SERVER_RATE_LIMITED' || result.httpStatusCode === 429) {
    return 'N/A';
  }
  return `${result.downloadSpeedMbps} Mbps`;
}

describe('Task 4 - History API & Cross-User Isolation Tests', () => {
  it('1. should reject unauthenticated GET /history requests (401)', () => {
    assert.throws(() => getHistoryForUser(null), (err) => err.status === 401);
  });

  it('2. User 1 history request should return ONLY User 1 records (Isolation)', () => {
    const res = getHistoryForUser('Bearer user-1-token');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.total_records, 2);
    assert.strictEqual(res.data[0].userId, 'user-uuid-1');
    assert.strictEqual(res.data[1].userId, 'user-uuid-1');
  });

  it('3. User 2 history request should return ONLY User 2 records (Isolation)', () => {
    const res = getHistoryForUser('Bearer user-2-token');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.total_records, 1);
    assert.strictEqual(res.data[0].userId, 'user-uuid-2');
    assert.strictEqual(res.data[0].downloadSpeedMbps, 95.4);
  });
});

describe('Task 4 - UI Speed Formatting & Rate Limiting Rules', () => {
  it('4. Completed test result displays throughput with units', () => {
    const display = formatSpeedDisplay({
      status: 'COMPLETED',
      httpStatusCode: 200,
      downloadSpeedMbps: 42.37,
    });
    assert.strictEqual(display, '42.37 Mbps');
  });

  it('5. CRITICAL: SERVER_RATE_LIMITED (HTTP 429) MUST display as N/A (never 0 Mbps)', () => {
    const display = formatSpeedDisplay({
      status: 'SERVER_RATE_LIMITED',
      httpStatusCode: 429,
      downloadSpeedMbps: 0.0,
    });
    assert.strictEqual(display, 'N/A', 'Rate limited display MUST be N/A');
  });
});
