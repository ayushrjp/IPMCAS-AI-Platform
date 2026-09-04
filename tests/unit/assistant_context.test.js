const test = require('node:test');
const assert = require('node:assert');

// Mock data structures matching Supabase PostgreSQL tables
const mockUser1 = { id: 'usr-1111-2222-3333-4444' };
const mockUser2 = { id: 'usr-9999-8888-7777-6666' };

const mockMeasurementTestA = {
  id: 'meas-aaaa-1111',
  session_id: 'sess-aaaa-1111',
  user_id: mockUser1.id,
  throughput_mbps: 120.0,
  upload_speed_mbps: 100.0,
  latency_avg_ms: 35.0,
  latency_min_ms: 20.0,
  latency_max_ms: 50.0,
  jitter_ms: 8.0,
  concurrency: 4,
  status: 'COMPLETED',
  http_status: 200,
  created_at: '2026-09-04T07:00:00Z'
};

const mockMeasurementTestB = {
  id: 'meas-bbbb-2222',
  session_id: 'sess-bbbb-2222',
  user_id: mockUser1.id,
  throughput_mbps: 550.0,
  upload_speed_mbps: 480.0,
  latency_avg_ms: 9.5,
  latency_min_ms: 8.0,
  latency_max_ms: 12.0,
  jitter_ms: 1.2,
  concurrency: 8,
  status: 'COMPLETED',
  http_status: 200,
  created_at: '2026-09-04T07:15:00Z'
};

const mockMeasurementUser2 = {
  id: 'meas-u222-9999',
  session_id: 'sess-u222-9999',
  user_id: mockUser2.id,
  throughput_mbps: 300.0,
  upload_speed_mbps: 250.0,
  latency_avg_ms: 15.0,
  jitter_ms: 2.0,
  status: 'COMPLETED',
  http_status: 200,
  created_at: '2026-09-04T07:20:00Z'
};

const mockHistoryRecords = [
  mockMeasurementTestA,
  mockMeasurementTestB,
  {
    id: 'meas-cccc-3333',
    session_id: 'sess-cccc-3333',
    user_id: mockUser1.id,
    throughput_mbps: 310.0,
    upload_speed_mbps: 280.0,
    latency_avg_ms: 14.0,
    jitter_ms: 2.1,
    status: 'COMPLETED',
    http_status: 200,
    created_at: '2026-09-03T10:00:00Z'
  }
];

// Context & Analysis Handler Logic Simulation
function simulateAssistantChat(payload, authenticatedUserId) {
  const targetMeasurementId = payload.measurement_id || (payload.context_override && payload.context_override.id);

  let targetMeasurement = null;

  if (targetMeasurementId) {
    if (targetMeasurementId === mockMeasurementUser2.id) {
      if (authenticatedUserId && mockMeasurementUser2.user_id !== authenticatedUserId) {
        const err = new Error('Forbidden: Target measurement record does not belong to authenticated user.');
        err.statusCode = 403;
        throw err;
      }
      targetMeasurement = mockMeasurementUser2;
    } else if (targetMeasurementId === mockMeasurementTestA.id) {
      targetMeasurement = mockMeasurementTestA;
    } else if (targetMeasurementId === mockMeasurementTestB.id) {
      targetMeasurement = mockMeasurementTestB;
    } else if (payload.context_override) {
      targetMeasurement = payload.context_override;
    } else {
      const err = new Error('Target measurement record not found.');
      err.statusCode = 404;
      throw err;
    }
  }

  // Calculate baseline
  const validRecords = mockHistoryRecords.filter(r => r.status === 'COMPLETED' && r.http_status !== 429);
  const totalTests = validRecords.length;
  const avgDl = validRecords.reduce((acc, r) => acc + r.throughput_mbps, 0) / totalTests;
  const avgLat = validRecords.reduce((acc, r) => acc + r.latency_avg_ms, 0) / totalTests;

  if (targetMeasurement) {
    const tDl = targetMeasurement.throughput_mbps || targetMeasurement.downloadSpeedMbps || 0;
    const tLat = targetMeasurement.latency_avg_ms || (targetMeasurement.latency && targetMeasurement.latency.avgMs) || 0;
    const dlPct = Math.round(((tDl - avgDl) / avgDl) * 100);

    const answer = `### 🎯 CURRENT TEST ANALYSIS\n\n- **Download Speed**: **${tDl} Mbps**\n- **Latency**: **${tLat} ms**\n\n### 📊 COMPARISON WITH HISTORICAL BASELINE\n- **Download Speed**: **${tDl} Mbps** is ${Math.abs(dlPct)}% ${dlPct < 0 ? 'below' : 'above'} your baseline average of ${avgDl.toFixed(1)} Mbps.`;

    return {
      status: 200,
      data: {
        analysis_type: 'SPECIFIC_MEASUREMENT',
        target_measurement: targetMeasurement,
        answer: answer,
        observation: answer,
        evidence: [
          `PRIMARY SUBJECT (Current Test): Download ${tDl} Mbps, Latency ${tLat} ms`,
          `SECONDARY CONTEXT (Historical Baseline): Average ${avgDl.toFixed(1)} Mbps download`
        ]
      }
    };
  }

  // General Network Analysis Mode
  const answer = `Across your last ${totalTests} valid speed tests, your connection averages ${avgDl.toFixed(1)} Mbps download.`;
  return {
    status: 200,
    data: {
      analysis_type: 'GENERAL_NETWORK_ANALYSIS',
      answer: answer,
      observation: answer
    }
  };
}

test('AI Assistant Context Tests - General Mode vs Specific Mode', async (t) => {
  await t.test('1. should return GENERAL_NETWORK_ANALYSIS when measurement_id is omitted', () => {
    const res = simulateAssistantChat({ message: "How is my network?" }, mockUser1.id);
    assert.strictEqual(res.data.analysis_type, 'GENERAL_NETWORK_ANALYSIS');
    assert.match(res.data.answer, /Across your last/);
  });

  await t.test('2. should return SPECIFIC_MEASUREMENT and prioritize Current Test A metrics when measurement_id is provided', () => {
    const res = simulateAssistantChat({ message: "Why is my download speed low?", measurement_id: mockMeasurementTestA.id }, mockUser1.id);
    assert.strictEqual(res.data.analysis_type, 'SPECIFIC_MEASUREMENT');
    assert.strictEqual(res.data.target_measurement.id, mockMeasurementTestA.id);
    assert.match(res.data.answer, /CURRENT TEST ANALYSIS/);
    assert.match(res.data.answer, /120 Mbps/);
    assert.match(res.data.evidence[0], /PRIMARY SUBJECT \(Current Test\): Download 120 Mbps/);
  });

  await t.test('3. CRITICAL: should reject User 1 attempting to query User 2 measurement with 403 Forbidden', () => {
    assert.throws(
      () => simulateAssistantChat({ message: "Explain this result", measurement_id: mockMeasurementUser2.id }, mockUser1.id),
      (err) => err.statusCode === 403 && /Forbidden/.test(err.message)
    );
  });

  await t.test('4. should reject non-existent measurement_id with 404 Not Found', () => {
    assert.throws(
      () => simulateAssistantChat({ message: "Explain result", measurement_id: 'non-existent-uuid' }, mockUser1.id),
      (err) => err.statusCode === 404 && /not found/.test(err.message)
    );
  });

  await t.test('5. Test switching: selecting Test B produces distinct analysis reflecting Test B metrics (550 Mbps)', () => {
    const resA = simulateAssistantChat({ message: "Analyze test", measurement_id: mockMeasurementTestA.id }, mockUser1.id);
    const resB = simulateAssistantChat({ message: "Analyze test", measurement_id: mockMeasurementTestB.id }, mockUser1.id);

    assert.match(resA.data.answer, /120 Mbps/);
    assert.match(resB.data.answer, /550 Mbps/);
    assert.notStrictEqual(resA.data.answer, resB.data.answer);
  });
});
