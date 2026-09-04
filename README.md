# IPMCAS — Internet Performance Measurement, Comparison and AI Support

IPMCAS is a professional, production-ready web platform for real-time Internet performance measurement, network environment classification, statistical performance analytics, network quality comparison, and AI-driven diagnostic assistance.

The platform is designed using empirical methodologies derived from rigorous Internet performance research (experiments E2, E3, and E4), incorporating advanced measurement validation, error taxonomy (including explicit HTTP 429 rate-limiting detection), and multi-connection concurrency control.

---

## 🌟 Key Features

1. **Real-time Measurement Engine**: Precise measurement of download throughput, upload throughput, latency, jitter, and packet loss across Wi-Fi, Ethernet, 4G, and 5G connections.
2. **Advanced Error Taxonomy**: Explicit classification of test statuses (`COMPLETED`, `DURATION_LIMIT_REACHED`, `SERVER_RATE_LIMITED`, `TIMEOUT`, `NO_DATA`, `REQUEST_FAILURE`).
3. **Statistical Analytics**: Mean, median, min/max, percentiles ($p_{50}, p_{90}, p_{95}, p_{99}$), standard deviation, coefficient of variation, and confidence intervals.
4. **Network Comparison**: Head-to-head comparison between network environments (e.g. Home Wi-Fi vs Mobile 5G).
5. **AI Network Intelligence Assistant**: Context-aware assistant powered by backend metrics (never invents measurement values).
6. **Supabase PostgreSQL & Auth**: Secure historical record keeping with Row Level Security (RLS) and encrypted session persistence.

---

## 🛠️ Technology Stack

- **Frontend**: Next.js 14+ (App Router), React, TypeScript, Tailwind CSS, Recharts.
- **Backend API**: Python 3.11+, FastAPI, Pydantic v2, SQLAlchemy 2.0 Async, Alembic.
- **Database & Auth**: Supabase PostgreSQL, Supabase Auth.
- **Measurement Engine**: Modular engine abstraction (`packages/measurement-engine`).
- **AI Integration**: Backend-only LLM orchestrator (OpenAI / Gemini / Anthropic).

---

## 📁 Repository Structure

```text
IPMCAS-AI-Platform/
├── apps/
│   ├── web/                    # Next.js Frontend Application
│   └── api/                    # FastAPI Backend Service
├── packages/
│   ├── measurement-engine/     # Standalone measurement logic package
│   └── shared-types/           # Shared TypeScript interfaces & API schemas
├── database/
│   ├── migrations/             # SQL & Alembic database migrations
│   └── seed/                   # Server directory & system seed data
├── research/                   # Methodological documentation (E2, E3, E4)
├── docs/
│   ├── architecture/           # System, frontend, backend, engine design
│   ├── api/                    # REST & WebSocket API documentation
│   ├── database/               # Database schema & RLS policy specs
│   └── research/               # DRDO research synthesis & translation
├── infrastructure/             # Docker compose & deployment manifests
├── scripts/                    # Development & setup automation scripts
├── tests/                      # System integration & E2E tests
├── .env.example                # Environment variables template
├── .gitignore                  # Git ignore rules
└── README.md                   # Project overview & documentation index
```

---

## 🚀 Quick Start Guide

### Prerequisites
- Node.js 18+ & npm
- Python 3.11+ & pip / venv
- Supabase account or local PostgreSQL instance

### 1. Backend Setup (`apps/api`)
```bash
cd apps/api
python -m venv venv
# On Windows:
.\venv\Scripts\activate
# On Linux/macOS:
# source venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
Backend API interactive docs will be available at `http://localhost:8000/docs`.

### 2. Frontend Setup (`apps/web`)
```bash
cd apps/web
npm install
npm run dev
```
Frontend web dashboard will be available at `http://localhost:3000`.

---

## 📄 License & Confidentiality

Internal DRDO Research & Production Platform Project. All rights reserved.
