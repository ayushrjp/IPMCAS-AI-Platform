# API Design Specifications — IPMCAS API

## 1. Overview & Authentication

All API endpoints reside under `/api/v1/`. Authenticated endpoints require a Bearer token issued by Supabase Auth (`Authorization: Bearer <token>`).

---

## 2. Core Endpoints Overview

### Health Probe
- `GET /api/v1/health`
  - **Auth**: None
  - **Response**: `200 OK`
  ```json
  {
    "status": "healthy",
    "version": "1.0.0",
    "timestamp": "2026-08-30T17:15:00Z",
    "database": "connected",
    "services": {
      "api": "ok",
      "supabase": "ok"
    }
  }
  ```

### Measurement Endpoints
- `POST /api/v1/measurements/session/start`
  - **Auth**: Required
  - **Request**:
  ```json
  {
    "connection_type": "WIFI",
    "concurrency_level": 4
  }
  ```
  - **Response**: `201 Created` (`{ "session_id": "uuid", "server": { ... } }`)

- `POST /api/v1/measurements/session/{id}/result`
  - **Auth**: Required
  - **Request Payload**:
  ```json
  {
    "download_speed_mbps": 142.5,
    "upload_speed_mbps": 48.2,
    "latency_avg_ms": 14.2,
    "latency_min_ms": 11.0,
    "latency_max_ms": 22.1,
    "jitter_ms": 2.4,
    "packet_loss_percent": 0.0,
    "bytes_downloaded": 185000000,
    "bytes_uploaded": 50000000,
    "test_duration_seconds": 10.2,
    "http_status_code": 200,
    "status": "COMPLETED"
  }
  ```

### Analytics Endpoints
- `GET /api/v1/analytics/summary`
  - **Auth**: Required
  - **QueryParams**: `network_id` (optional), `timeframe` (`7d`, `30d`, `90d`, `all`)
  - **Response**: Returns Mean, Median, StdDev, 95% Confidence Interval, $p_{50}, p_{90}, p_{95}$ percentiles.

### AI Intelligence Assistant
- `POST /api/v1/assistant/chat`
  - **Auth**: Required
  - **Request**: `{ "message": "Why did my Wi-Fi download speed drop today compared to yesterday?" }`
  - **Backend Pipeline**:
    1. Query user's recent measurements & compute stats.
    2. Build structured JSON context.
    3. Pass context + question to LLM backend provider.
    4. Validate response to prevent metric hallucination.
  - **Response**:
  ```json
  {
    "reply": "Based on your 5 recorded tests today, your Wi-Fi average download speed was 42.1 Mbps (std dev 12.4 Mbps), which is 35% lower than your 7-day average of 64.8 Mbps. Your latency also increased from 14ms to 42ms...",
    "referenced_metrics": {
      "today_avg_mbps": 42.1,
      "weekly_avg_mbps": 64.8,
      "sample_size": 5
    }
  }
  ```
