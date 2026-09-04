# Backend Architecture — IPMCAS FastAPI API

## 1. Modular Architecture Overview

The backend is built as a high-performance **FastAPI** Python service adhering to clean architecture principles:
- **Thin Controllers**: Route handlers strictly parse HTTP input, enforce auth, and call service classes.
- **Service Layer**: Business logic, statistical calculations, error taxonomy processing, and AI context assembly reside in decoupled services.
- **Repository / Data Access Layer**: Database queries use SQLAlchemy 2.0 Async sessions over Supabase PostgreSQL.
- **Dependency Injection**: FastAPI `Depends` handles database sessions, authenticated user contexts, and service instances.

---

## 2. Directory Structure

```text
apps/api/app/
├── main.py                   # FastAPI Application Entrypoint & Middleware Setup
├── core/
│   ├── config.py             # Pydantic BaseSettings Configuration
│   ├── security.py           # JWT Verification & Supabase Auth Helpers
│   ├── logging.py            # Structured JSON Logger Setup
│   └── errors.py             # Custom Exception Classes & Error Handlers
├── api/
│   └── routes/
│       ├── health.py         # System Probe & DB Health check
│       ├── measurements.py   # Measurement Session Start/Complete Routes
│       ├── history.py        # Historical User Measurement Endpoints
│       ├── analytics.py      # Statistical Aggregations & Confidence Intervals
│       ├── networks.py       # Network Profile Management & Comparison
│       └── assistant.py      # AI Network Intelligence Assistant Route
├── models/                   # SQLAlchemy 2.0 ORM Models
├── schemas/                  # Pydantic v2 Request/Response Schemas
├── services/                 # Core Business Logic (MeasurementService, AnalyticsService, AIService)
├── repositories/             # Database Query Repositories
└── middleware/               # Request ID tracking, CORS, Error Interceptors
```

---

## 3. Core Principles & Design Rules

1. **No Logic in Routes**: Handler functions simply call service methods.
2. **Explicit Exception Hierarchy**: Standardized error responses with error codes (`NETWORK_UNAVAILABLE`, `HTTP_429`, `TIMEOUT`, `SERVER_RATE_LIMITED`).
3. **Structured Context for LLM**: AI assistant endpoints (`POST /api/v1/assistant/chat`) construct precise JSON payload context derived from database queries prior to calling the LLM. The LLM is restricted from executing arbitrary SQL or fabricating metrics.
4. **Structured Logging**: All backend operations log `request_id`, `user_id`, `endpoint`, `execution_time_ms`, and `measurement_id`. Sensitive keys, passwords, and tokens are automatically redacted.
