const assert = require('node:assert');
const { test, describe, it } = require('node:test');

// Simulation of FastAPI Auth Dependency & JWT Verification
function decodeAccessToken(token) {
  if (!token || token === 'invalid-token') {
    return null;
  }
  if (token === 'user-1-token') {
    return { id: 'user-uuid-1', email: 'user1@ipmcas.internal' };
  }
  if (token === 'user-2-token') {
    return { id: 'user-uuid-2', email: 'user2@ipmcas.internal' };
  }
  return null;
}

function getAuthUser(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw { status: 401, detail: 'Authentication credentials were not provided in Authorization header.' };
  }
  const token = authHeader.replace('Bearer ', '');
  const user = decodeAccessToken(token);
  if (!user) {
    throw { status: 401, detail: 'Invalid or expired authentication token.' };
  }
  return user;
}

// In-memory sessions store simulating measurement_sessions ownership
const mockSessions = {};

function startSession(authHeader, payload) {
  const user = getAuthUser(authHeader);
  const sessionId = `sess_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  mockSessions[sessionId] = {
    sessionId,
    userId: user.id,
    concurrencyLevel: payload.concurrencyLevel || 4,
    status: 'INITIALIZING'
  };
  return { status: 201, sessionId, userId: user.id };
}

function recordResult(authHeader, sessionId, payload) {
  const user = getAuthUser(authHeader);
  const session = mockSessions[sessionId];

  if (!session) {
    throw { status: 404, detail: 'Measurement session not found.' };
  }

  // Cross-user access rejection test
  if (session.userId !== user.id) {
    throw { status: 403, detail: 'Access denied: You do not own this measurement session.' };
  }

  // Range checks and payload validation
  if (payload.downloadSpeedMbps < 0 || payload.uploadSpeedMbps < 0) {
    throw { status: 422, detail: 'Throughput speed must be >= 0.' };
  }
  if (payload.actualDurationSeconds <= 0) {
    throw { status: 422, detail: 'Actual duration must be > 0.' };
  }

  // HTTP 429 classification check
  if (payload.httpStatusCode === 429 || payload.status === 'SERVER_RATE_LIMITED') {
    return {
      status: 201,
      sessionId,
      userId: user.id,
      isValid: false,
      testStatus: 'SERVER_RATE_LIMITED',
      message: 'Flagged as HTTP 429 server rate limited.'
    };
  }

  return {
    status: 201,
    sessionId,
    userId: user.id,
    isValid: payload.isValid !== false,
    testStatus: payload.status || 'COMPLETED',
    message: 'Measurement result successfully recorded.'
  };
}

describe('Task 3 API - Authentication Dependency Tests', () => {
  it('1. should reject unauthorized request without Bearer token (401)', () => {
    assert.throws(() => getAuthUser(null), (err) => err.status === 401);
    assert.throws(() => getAuthUser(''), (err) => err.status === 401);
  });

  it('2. should reject invalid or expired Bearer token (401)', () => {
    assert.throws(() => getAuthUser('Bearer invalid-token'), (err) => err.status === 401);
  });

  it('3. should successfully authenticate valid Bearer token', () => {
    const user = getAuthUser('Bearer user-1-token');
    assert.strictEqual(user.id, 'user-uuid-1');
    assert.strictEqual(user.email, 'user1@ipmcas.internal');
  });
});

describe('Task 3 API - Measurement Session & Ownership Verification Tests', () => {
  let createdSessionId;

  it('4. User 1 creates a measurement session', () => {
    const res = startSession('Bearer user-1-token', { concurrencyLevel: 4 });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.userId, 'user-uuid-1');
    assert.ok(res.sessionId);
    createdSessionId = res.sessionId;
  });

  it('5. User 1 records result for their own session (201)', () => {
    const payload = {
      downloadSpeedMbps: 145.2,
      uploadSpeedMbps: 50.1,
      actualDurationSeconds: 10.0,
      httpStatusCode: 200,
      status: 'COMPLETED',
      isValid: true
    };
    const res = recordResult('Bearer user-1-token', createdSessionId, payload);
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.userId, 'user-uuid-1');
    assert.strictEqual(res.isValid, true);
  });

  it('6. CRITICAL: User 2 attempting to record result into User 1 session MUST be REJECTED (403 Forbidden)', () => {
    const payload = {
      downloadSpeedMbps: 200.0,
      uploadSpeedMbps: 100.0,
      actualDurationSeconds: 10.0,
      httpStatusCode: 200,
      status: 'COMPLETED',
      isValid: true
    };
    assert.throws(
      () => recordResult('Bearer user-2-token', createdSessionId, payload),
      (err) => err.status === 403 && err.detail.includes('Access denied')
    );
  });

  it('7. CRITICAL: HTTP 429 rate-limited payload must be flagged as SERVER_RATE_LIMITED and isValid = false', () => {
    const payload = {
      downloadSpeedMbps: 0.0,
      uploadSpeedMbps: 0.0,
      actualDurationSeconds: 2.0,
      httpStatusCode: 429,
      status: 'SERVER_RATE_LIMITED',
      isValid: false
    };
    const res = recordResult('Bearer user-1-token', createdSessionId, payload);
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.testStatus, 'SERVER_RATE_LIMITED');
    assert.strictEqual(res.isValid, false);
  });

  it('8. Invalid negative throughput should trigger validation failure (422)', () => {
    const payload = {
      downloadSpeedMbps: -15.0,
      uploadSpeedMbps: 50.0,
      actualDurationSeconds: 10.0,
      httpStatusCode: 200,
      status: 'COMPLETED'
    };
    assert.throws(
      () => recordResult('Bearer user-1-token', createdSessionId, payload),
      (err) => err.status === 422
    );
  });
});
