# Speed Test & Dashboard Frontend Architecture — IPMCAS

## 1. Overview & UI Component Hierarchy

The IPMCAS web frontend delivers a real-time Internet speed measurement experience powered by `@ipmcas/measurement-engine`. All values displayed originate directly from browser streaming probes.

```text
apps/web/
├── app/
│   ├── dashboard/page.tsx       # Protected Dashboard overview & recent measurements
│   ├── speed-test/page.tsx      # Protected Speed Test runner view
│   ├── login/page.tsx           # Supabase Auth sign in
│   └── register/page.tsx        # Supabase Auth account creation
├── components/
│   ├── speed-test/
│   │   ├── SpeedTestCard.tsx    # Master runner card & state machine manager
│   │   ├── TestProgress.tsx     # Phase progress bar & active phase indicator
│   │   ├── MetricCard.tsx       # Numeric value display card
│   │   ├── DownloadGauge.tsx    # Live streaming download throughput meter
│   │   ├── UploadGauge.tsx      # Live payload upload throughput meter
│   │   ├── LatencyCard.tsx      # Probe latency & RFC 3550 jitter breakdown
│   │   ├── TestResults.tsx      # Final summary panel & concurrency table
│   │   └── ServerInfo.tsx       # Edge node benchmark info
│   └── dashboard/
│       ├── DashboardHeader.tsx  # User profile greeting & actions
│       └── RecentTests.tsx      # User measurement history table
└── lib/
    ├── api.ts                   # Centralized API fetch wrapper with Bearer token injection
    ├── auth.ts                  # Protected route auth hook (useRequireAuth)
    └── supabaseClient.ts        # Supabase client wrapper (@supabase/supabase-js)
```

---

## 2. Speed Test Execution & Persistence Flow

1. **Authentication Check**: `useRequireAuth()` verifies active Supabase JWT session. Unauthenticated requests redirect to `/login`.
2. **Session Initialization**: User clicks **START TEST**. `api.startSession(concurrency, networkType)` makes an authenticated `POST` request to FastAPI `/api/v1/measurements/session/start`, obtaining `session_id`.
3. **Engine Execution**: `IPMCASMeasurementEngine` initializes multi-phase execution (`INITIALIZING` -> `SERVER_SELECTION` -> `LATENCY` -> `DOWNLOAD` -> `UPLOAD` -> `CALCULATING`).
4. **Live Telemetry**: Engine updates `onProgress` state callback every 100ms without locking the UI thread.
5. **Backend Persistence**: On test completion, `api.recordResult(sessionId, measurementResult)` posts the payload to `/api/v1/measurements/session/{session_id}/result`.
6. **Dashboard History Update**: Results are queryable under `GET /api/v1/history`.

---

## 3. Error Taxonomy & HTTP 429 UI Rendering

| Error / Status Code | UI Display Message | Speed Impact |
|---|---|---|
| `SERVER_RATE_LIMITED` (HTTP 429) | "The selected test server temporarily rate-limited this measurement. This result is excluded from valid speed statistics." | Shown as **N/A** (Never 0 Mbps). |
| `DURATION_LIMIT_REACHED` | "Measurement reached configured duration cutoff. Throughput calculated accurately over active duration." | Valid speed displayed. |
| `TIMEOUT` | "Network socket connection timed out." | Marked as failed. |
| `UNAUTHENTICATED` (401) | "Authentication required. Please log in." | Redirects to `/login`. |
