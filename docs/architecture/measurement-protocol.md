# IPMCAS Measurement Protocol Specification

## 1. Mathematical Formulas & Timing Definitions

### 1.1 Monotonic Timing
Active measurement duration $\Delta t$ is computed using monotonic high-resolution timers (`performance.now()`):
$$\Delta t = \frac{t_{\text{end}} - t_{\text{start}}}{1000} \quad (\text{seconds})$$

### 1.2 Streaming Throughput Calculation
$$\text{Throughput (Mbps)} = \frac{\text{Bytes Transferred} \times 8}{\Delta t \times 1,000,000}$$

### 1.3 Latency Statistics
Given $k$ valid probe sample RTTs $\{r_1, r_2, \dots, r_k\}$:
- **Min Latency**: $\min_i (r_i)$
- **Max Latency**: $\max_i (r_i)$
- **Average Latency**: $\frac{1}{k} \sum_{i=1}^k r_i$
- **Median Latency ($p_{50}$)**: Midpoint of sorted array $r_{(1)} \le r_{(2)} \le \dots \le r_{(k)}$

### 1.4 RFC 3550 Standard Jitter
$$J_i = J_{i-1} + \frac{|D(i-1, i)| - J_{i-1}}{16}$$
where $D(i-1, i) = |r_i - r_{i-1}|$.

---

## 2. Server Selection Protocol

1. Query available `test_servers` from directory.
2. Dispatch 3 lightweight RTT probes to active servers.
3. Sort candidate servers by lowest average RTT and lowest jitter.
4. Bind measurement session to optimal server node.

---

## 3. Concurrency & Rate Limit Protocol (HTTP 429)

1. Supported concurrency levels: $N \in \{1, 2, 4, 8, 16\}$.
2. Each stream manages an independent HTTP GET/POST connection.
3. If any stream encounters HTTP `429` (Too Many Requests), the request statistics counter `rateLimitedRequests` is incremented.
4. The test status is explicitly flagged as `SERVER_RATE_LIMITED`.
5. The result is marked as `isValid = false` and excluded from valid statistical averages.

---

## 4. Browser Limitations & Security Safeguards

- **Packet Loss**: Raw socket ICMP access is restricted in standard web browsers. Marked as `null` / `N/A`.
- **Upload Progress**: Browser `fetch` API body stream upload tracking depends on browser engine implementation. Payload size is verified against response byte telemetry.
- **Client Security**: No database credentials or AI API keys exposed.
