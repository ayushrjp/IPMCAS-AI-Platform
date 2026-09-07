import { supabase } from './supabaseClient';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

export class APIError extends Error {
  status: number;
  data: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.data = data;
  }
}

async function getAuthHeaders(): Promise<HeadersInit> {
  const { data: { session } } = await supabase.auth.getSession();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  }

  return headers;
}

export async function fetchWithAuth<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = await getAuthHeaders();
  const url = `${API_BASE_URL}${endpoint}`;

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...headers,
        ...(options.headers || {}),
      },
    });

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        errorData = { detail: response.statusText };
      }

      if (response.status === 401) {
        if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
          window.location.href = '/login?reason=session_expired';
        }
        throw new APIError('Authentication required. Please log in.', 401, errorData);
      }

      if (response.status === 403) {
        throw new APIError('Access denied to this resource.', 403, errorData);
      }

      if (response.status === 422) {
        throw new APIError(
          `Payload validation failed: ${JSON.stringify(errorData.detail || errorData)}`,
          422,
          errorData
        );
      }

      throw new APIError(
        errorData.detail || `API request failed with status ${response.status}`,
        response.status,
        errorData
      );
    }

    return await response.json();
  } catch (error: any) {
    if (error instanceof APIError) {
      throw error;
    }
    throw new APIError(error.message || 'Network communication error.', 500);
  }
}

export const api = {
  /**
   * Starts a new speed test measurement session associated with the authenticated user.
   */
  async startSession(concurrencyLevel: number = 4, connectionType: string = 'UNKNOWN') {
    try {
      return await fetchWithAuth<{ session_id: string; status: string; user_id: string }>(
        '/api/v1/measurements/session/start',
        {
          method: 'POST',
          body: JSON.stringify({
            concurrency_level: concurrencyLevel,
            connection_type: connectionType,
          }),
        }
      );
    } catch (err) {
      console.warn('FastAPI session start fallback to direct Supabase session creation:', err);
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;
      if (!user) throw err;

      const { data: inserted, error: subErr } = await supabase
        .from('measurement_sessions')
        .insert({
          user_id: user.id,
          status: 'INITIALIZING',
          client_metadata: { concurrency_level: concurrencyLevel, connection_type: connectionType }
        })
        .select()
        .single();

      if (subErr || !inserted) throw err;
      return { session_id: inserted.id, status: inserted.status, user_id: user.id };
    }
  },

  /**
   * Records completed measurement results for a session.
   */
  async recordResult(sessionId: string, resultData: any) {
    try {
      return await fetchWithAuth<{
        session_id: string;
        status: string;
        is_valid: boolean;
        persisted?: boolean;
        result_id?: string;
        message: string;
      }>(
        `/api/v1/measurements/session/${sessionId}/result`,
        {
          method: 'POST',
          body: JSON.stringify(resultData),
        }
      );
    } catch (err) {
      console.warn('FastAPI record result fallback to direct Supabase insertion:', err);
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;
      if (!user) throw err;

      // Extract server ID or default server
      const { data: serverRec } = await supabase.from('test_servers').select('id').limit(1).single();

      const insertPayload: any = {
        session_id: sessionId,
        user_id: user.id,
        server_id: serverRec?.id || null,
        test_type: resultData.testType || 'FULL',
        concurrency: resultData.concurrencyLevel || 4,
        configured_duration_s: 10.0,
        actual_duration_s: Math.max(0.1, resultData.durationSeconds || 10.0),
        bytes_transferred: (resultData.bytesDownloaded || 0) + (resultData.bytesUploaded || 0),
        throughput_mbps: resultData.downloadSpeedMbps || 0.0,
        upload_speed_mbps: resultData.uploadSpeedMbps || 0.0,
        latency_min_ms: resultData.latency?.minMs || 0.0,
        latency_avg_ms: resultData.latency?.avgMs || 0.0,
        latency_median_ms: resultData.latency?.medianMs || 0.0,
        latency_max_ms: resultData.latency?.maxMs || 0.0,
        jitter_ms: resultData.latency?.jitterMs || 0.0,
        packet_loss_percent: resultData.packetLossPercent || null,
        total_requests: resultData.requestStatistics?.totalRequests || 0,
        successful_requests: resultData.requestStatistics?.successfulRequests || 0,
        rate_limited_requests: resultData.requestStatistics?.rateLimitedRequests || 0,
        other_http_errors: resultData.requestStatistics?.otherHttpErrors || 0,
        request_exceptions: resultData.requestStatistics?.requestExceptions || 0,
        http_status: resultData.httpStatusCode || 200,
        status: resultData.status || 'COMPLETED',
        error: resultData.error || null
      };

      let { data: insertedRes, error: insErr } = await supabase
        .from('measurement_results')
        .insert(insertPayload)
        .select()
        .single();

      if (insErr && (insErr.message?.includes('upload_speed_mbps') || insErr.code === 'PGRST204')) {
        console.warn('Supabase direct insert missing upload_speed_mbps column, retrying without upload_speed_mbps');
        delete insertPayload.upload_speed_mbps;
        const retryRes = await supabase
          .from('measurement_results')
          .insert(insertPayload)
          .select()
          .single();
        insertedRes = retryRes.data;
        insErr = retryRes.error;
      }

      if (insErr) {
        console.error('Supabase direct result insert failed:', insErr);
        throw err;
      }

      await supabase.from('measurement_sessions').update({ status: resultData.status || 'COMPLETED' }).eq('id', sessionId);

      return {
        session_id: sessionId,
        status: resultData.status || 'COMPLETED',
        is_valid: true,
        persisted: true,
        result_id: insertedRes?.id,
        message: 'Directly persisted to Supabase database'
      };
    }
  },

  /**
   * Fetches historical measurement records for the authenticated user.
   */
  async getHistory(page: number = 1, limit: number = 20) {
    try {
      return await fetchWithAuth<{ page: number; limit: number; total_records: number; data: any[] }>(
        `/api/v1/history?page=${page}&limit=${limit}`,
        {
          method: 'GET',
        }
      );
    } catch (err) {
      console.warn('FastAPI history endpoint unreachable, falling back to direct Supabase query:', err);
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;
      
      let query = supabase
        .from('measurement_results')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range((page - 1) * limit, page * limit - 1);

      if (user?.id) {
        query = query.eq('user_id', user.id);
      }

      const { data: dbRecords, count, error: subErr } = await query;

      if (subErr) {
        console.error('Supabase direct history query failed:', subErr.message);
        throw err;
      }

      const formatted = (dbRecords || []).map((r: any) => {
        let ulSpeed = r.upload_speed_mbps || 0.0;
        if (!ulSpeed && r.bytes_transferred && r.throughput_mbps) {
          const estDl = (r.throughput_mbps * 1000000 / 8) * Math.min(10, (r.actual_duration_s || 10) / 2);
          const estUl = Math.max(0, r.bytes_transferred - estDl);
          if (estUl > 0) {
            ulSpeed = Math.round((estUl * 8) / (1000000 * Math.max(1, (r.actual_duration_s || 10) / 2)) * 100) / 100;
          }
        }
        return {
          id: r.id,
          sessionId: r.session_id,
          userId: r.user_id,
          testType: r.test_type,
          concurrencyLevel: r.concurrency,
          durationSeconds: r.actual_duration_s,
          bytesDownloaded: r.bytes_transferred,
          bytesUploaded: 0,
          downloadSpeedMbps: r.throughput_mbps,
          uploadSpeedMbps: ulSpeed,
          latency: {
            minMs: r.latency_min_ms,
            avgMs: r.latency_avg_ms,
            medianMs: r.latency_median_ms,
            maxMs: r.latency_max_ms,
            jitterMs: r.jitter_ms
          },
          latency_avg_ms: r.latency_avg_ms,
          jitter_ms: r.jitter_ms,
          throughput_mbps: r.throughput_mbps,
          upload_speed_mbps: ulSpeed,
          packetLossPercent: r.packet_loss_percent,
          httpStatusCode: r.http_status,
          status: r.status,
          error: r.error,
          timestamp: r.created_at || r.timestamp
        };
      });

      return {
        page,
        limit,
        total_records: count || formatted.length,
        data: formatted
      };
    }
  },

  /**
   * Sends user prompt, target measurement_id, and context override to FastAPI AI Assistant endpoint.
   */
  async askAssistant(
    message: string,
    contextOverride?: any,
    measurementId?: string,
    conversationHistory?: { role: string; content: string }[],
    sessionId?: string
  ) {
    const targetId = measurementId || (contextOverride && (contextOverride.id || contextOverride.measurementId || contextOverride.measurement_id)) || null;
    return fetchWithAuth<{
      answer?: string;
      observation: string;
      analysis_type?: string;
      target_measurement?: any;
      historical_context?: any;
      explanation: string;
      possible_cause: string;
      recommendation: string;
      evidence: string[];
      suggested_questions: string[];
    }>(
      '/api/v1/assistant/chat',
      {
        method: 'POST',
        body: JSON.stringify({
          message,
          measurement_id: targetId,
          analysis_type: targetId ? "SPECIFIC_MEASUREMENT" : undefined,
          context_override: contextOverride || null,
          conversation_history: conversationHistory || null,
          session_id: sessionId || null,
        }),
      }
    );
  },

  /**
   * Real-time SSE streaming method for the AI Assistant.
   */
  async askAssistantStream(
    message: string,
    onChunk: (chunk: string) => void,
    conversationHistory?: { role: string; content: string }[],
    contextOverride?: any,
    measurementId?: string,
    sessionId?: string
  ): Promise<{ completed: boolean; fullText: string }> {
    const { data: { session } } = await supabase.auth.getSession();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }

    const targetId = measurementId || (contextOverride && (contextOverride.id || contextOverride.measurementId || contextOverride.measurement_id)) || null;

    const response = await fetch(`${API_BASE_URL}/api/v1/assistant/chat/stream`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        message,
        measurement_id: targetId,
        context_override: contextOverride || null,
        conversation_history: conversationHistory || null,
        session_id: sessionId || null,
      }),
    });

    if (!response.ok) {
      throw new APIError('I couldn\'t reach the AI service right now. Your measurement data is still available.', response.status);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder('utf-8');
    if (!reader) {
      throw new APIError('Response body stream unreadable.', 500);
    }

    let buffer = '';
    let fullText = '';
    let completed = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data: ')) {
          const rawData = trimmed.replace('data: ', '').trim();
          if (rawData === '[DONE]') {
            completed = true;
            return { completed: true, fullText };
          }
          try {
            const parsed = JSON.parse(rawData);
            if (parsed.error) {
              throw new APIError(parsed.error, 502);
            }
            if (parsed.content) {
              fullText += parsed.content;
              onChunk(parsed.content);
            }
          } catch (e: any) {
            if (e instanceof APIError) throw e;
            if (rawData) {
              fullText += rawData;
              onChunk(rawData);
            }
          }
        }
      }
    }

    if (!completed) {
      throw new APIError('Stream disconnected prematurely before completion signal.', 500);
    }

    return { completed: true, fullText };
  },

  /**
   * Fetches AI conversation history for authenticated user.
   */
  async getAIHistory(limit: number = 30) {
    return fetchWithAuth<{ conversations: { id: string; role: string; message: string; created_at: string }[] }>(
      `/api/v1/assistant/history?limit=${limit}`,
      { method: 'GET' }
    );
  },

  /**
   * Fetches performance and latency insights from the backend.
   */
  async getAIInsights(measurementId?: string) {
    const query = measurementId ? `?measurement_id=${encodeURIComponent(measurementId)}` : '';
    return fetchWithAuth<{
      summary: string;
      throughput_status: string;
      latency_status: string;
      jitter_status: string;
      overall_rating: string;
      historical_comparison: string;
      recommended_action: string;
    }>(`/api/v1/assistant/insights${query}`, { method: 'GET' });
  },
};

