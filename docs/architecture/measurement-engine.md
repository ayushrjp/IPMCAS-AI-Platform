# Measurement Engine Architecture — IPMCAS Engine

## 1. Overview & Research Background

The **IPMCAS Measurement Engine** is designed based on empirical observations from DRDO experiments **E2** (baseline/target setup), **E3** (download throughput vs. duration), and **E4** (concurrency effects & HTTP 429 server rate limiting).

Unlike typical naive speed tests that treat every failed HTTP probe as a generic connection error, the IPMCAS engine implements a rigorous **Error Taxonomy** and **Concurrency Framework**.

---

## 2. Measurement Lifecycle

```text
[Start Session Request]
          │
          ▼
   1. Server Selection ──────> Benchmark Candidate Latency -> Select Lowest Jitter/Latency Server
          │
          ▼
   2. Latency & Jitter ──────> N Probe Samples (ICMP / HTTP HEAD / Fetch RTT)
          │
          ▼
   3. Download Test ──────────> Multi-stream HTTP GET chunk streams (Concurrency N=1..8)
          │
          ▼
   4. Upload Test ────────────> Multi-stream HTTP POST telemetry payloads
          │
          ▼
   5. Status Classification ──> Validate Byte Counts, Time Limits, Rate Limits (HTTP 429)
          │
          ▼
   6. Metric Calculation ────> Throughput (Mbps), Latency (ms), Jitter (ms), Loss % (N/A in browser)
```

---

## 3. Explicit Status Taxonomy (Incorporating E3 & E4 Findings)

The engine enforces explicit test statuses rather than binary success/failure:

| Status Code | Description | Empirical Trigger (E3/E4 Lessons) | Valid for Stats? |
|---|---|---|---|
| `COMPLETED` | Test completed full data transfer within expected parameters. | Full byte transfer before duration cutoff. | **YES** |
| `DURATION_LIMIT_REACHED` | Test reached strict time limit before chunk queue emptied. | Experiment E3 showed high-speed lines hit duration limit early. Throughput calculated accurately over active duration. | **YES** |
| `SERVER_RATE_LIMITED` | Edge test server returned HTTP 429 (Too Many Requests). | **CRITICAL REQUIREMENT**: Must NOT be recorded as 0 Mbps. Explicitly flagged as rate-limited test. | **NO** |
| `TIMEOUT` | Network path or socket timed out. | TCP handshake / TCP reset / Socket timeout. | **NO** |
| `REQUEST_FAILURE` | HTTP 5xx or client-side fetch error. | Remote server crash or DNS resolution failure. | **NO** |
| `NO_DATA` | Connection established but 0 payload bytes transferred. | Socket drop immediately after header exchange. | **NO** |
| `OTHER_ERROR` | Unclassified runtime/browser exception. | Web worker execution error or unexpected exception. | **NO** |

---

## 4. Multi-Stream Concurrency Control

Experiment E4 demonstrated that single-connection tests ($N=1$) under-report available capacity on high-bandwidth or high-latency paths due to TCP window scaling limitations.

The engine supports dynamic concurrency levels ($N=1, 2, 4, 8$, expandable to $16$):
$$\text{Total Throughput (Mbps)} = \frac{8 \times \sum_{i=1}^{N} \text{Bytes Transferred}_i}{10^6 \times \Delta t_{\text{active}}}$$
- Streams are tracked independently to observe individual stream throughput distribution.
- Rate-limited streams (HTTP 429) trigger automatic back-off or concurrency scaling.

---

## 5. Packet Loss Handling

Browser security sandboxes prohibit raw ICMP or TCP socket inspection. In strict compliance with the **No Fake Data Policy**, packet loss is recorded as `null` / `N/A` rather than fabricated.
