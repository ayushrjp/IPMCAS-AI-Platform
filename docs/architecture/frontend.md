# Frontend Architecture — IPMCAS Web Application

## 1. Overview & Technology Choices

The frontend is built using **Next.js 14+** (App Router architecture) with **TypeScript**, **React**, and **Tailwind CSS**. Data visualization is powered by **Recharts**.

### Core Objectives
- **Zero Freeze UX**: Asynchronous, web-worker-friendly speed testing without locking UI thread.
- **Rich Aesthetics**: Sleek dark mode palette, smooth progress transitions, glassmorphism, responsive grid dashboard.
- **Strict Security**: No backend secrets, service-role keys, or LLM keys included in client bundles.

---

## 2. Page & Route Structure

```text
apps/web/app/
├── layout.tsx                # Root layout shell (Header, Navigation, Provider stack)
├── page.tsx                  # Landing / System Overview Page
├── (auth)/
│   ├── login/page.tsx        # Supabase Auth Login
│   └── register/page.tsx     # User Registration
├── dashboard/page.tsx        # Main Overview & Quick Stats Dashboard
├── speed-test/page.tsx       # Interactive Real-time Speed Test Runner
├── history/page.tsx          # Historical Measurement Log & Filterable Table
├── analytics/page.tsx        # Statistical Analytics & Trend Visualization
├── networks/page.tsx         # Detected & Saved Networks Manager
├── compare/page.tsx          # Network Quality Comparison View (Wi-Fi vs 5G)
├── assistant/page.tsx        # AI Network Intelligence Chat Interface
└── settings/page.tsx         # User Profile & Preferences
```

---

## 3. UI Component System

To ensure reusable, clean modular code, UI elements are broken down into isolated components:

### Key Components
- **`Header` / `Sidebar`**: Responsive platform navigation.
- **`MetricCard`**: Displays speed, latency, jitter, or packet loss with units, baseline delta, and status indicators.
- **`SpeedGauge`**: Interactive visual gauge component for real-time throughput display.
- **`LatencyCard`**: Detailed breakdown of min, avg, max latency and jitter.
- **`NetworkStatus`**: Card displaying connection type (Wi-Fi, Ethernet, 4G, 5G, Unknown), ISP, and IP info.
- **`TestProgress`**: Multi-phase progress tracker (Initializing -> Server Select -> Latency -> Download -> Upload -> Saving).
- **`MeasurementChart`**: High-frequency streaming throughput/latency charts via Recharts.
- **`HistoryTable`**: Sortable, filterable table for historical measurement records.
- **`NetworkComparison`**: Side-by-side metric comparison visualizer.
- **`AIChat`**: Context-aware chat box communicating with `/api/v1/assistant/chat`.
- **`LoadingState` / `ErrorMessage`**: Uniform loading skeletons and graceful error dialogs.

---

## 4. Network Detection & Graceful Fallbacks

Browser APIs (`navigator.connection` / `NetworkInformation`) vary significantly across operating systems and browsers.

- **Detection Logic**:
  1. Inspect `navigator.connection.type` (e.g. `wifi`, `cellular`, `ethernet`).
  2. Inspect `navigator.connection.effectiveType` (e.g. `4g`, `3g`).
  3. Fallback: Query backend IP geolocation / ISP metadata service.
  4. If exact connection protocol is undetermined, tag connection as `UNKNOWN` gracefully without crashing.
