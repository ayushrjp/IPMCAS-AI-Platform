export enum TestStatus {
  INITIALIZING = 'INITIALIZING',
  SERVER_SELECTION = 'SERVER_SELECTION',
  LATENCY_TEST = 'LATENCY_TEST',
  DOWNLOAD_TEST = 'DOWNLOAD_TEST',
  UPLOAD_TEST = 'UPLOAD_TEST',
  CALCULATING = 'CALCULATING',
  SAVING = 'SAVING',
  COMPLETED = 'COMPLETED',
  DURATION_LIMIT_REACHED = 'DURATION_LIMIT_REACHED',
  SERVER_RATE_LIMITED = 'SERVER_RATE_LIMITED',
  TIMEOUT = 'TIMEOUT',
  REQUEST_FAILURE = 'REQUEST_FAILURE',
  NO_DATA = 'NO_DATA',
  OTHER_ERROR = 'OTHER_ERROR'
}

export enum NetworkType {
  WIFI = 'WIFI',
  ETHERNET = 'ETHERNET',
  CELLULAR_4G = 'CELLULAR_4G',
  CELLULAR_5G = 'CELLULAR_5G',
  UNKNOWN = 'UNKNOWN'
}

export type ServerHealthStatus = 'healthy' | 'degraded' | 'offline';

export interface ServerNode {
  id: string;
  name: string;
  baseUrl: string;
  region: string;
  country: string;
  latitude: number;
  longitude: number;
  capabilities: {
    download: boolean;
    upload: boolean;
    latency: boolean;
  };
  healthStatus: ServerHealthStatus;
  priority: number;
  pingLatencyMs?: number;
  jitterMs?: number;
}

export interface RequestStatistics {
  totalRequests: number;
  startedRequests: number;
  successfulRequests: number;
  failedRequests: number;
  rateLimitedRequests: number; // HTTP 429 explicit count
  otherHttpErrors: number;
  requestExceptions: number;
}

export interface LatencyMetrics {
  probeCount: number;
  successfulProbes: number;
  failedProbes: number;
  minMs: number;
  maxMs: number;
  avgMs: number;
  medianMs: number;
  jitterMs: number; // RFC 3550 standard jitter calculation
}

export interface ThroughputMetrics {
  bytesTransferred: number;
  throughputMbps: number;
  activeDurationSeconds: number;
  httpStatusCode: number;
  requestStats: RequestStatistics;
  status: TestStatus;
}

export interface MeasurementResult {
  sessionId: string;
  timestamp: string; // ISO 8601 string
  testType: 'FULL' | 'LATENCY_ONLY' | 'DOWNLOAD_ONLY' | 'UPLOAD_ONLY';
  server: ServerNode;
  network: {
    type: NetworkType;
    ispName?: string;
    effectiveType?: string;
  };
  durationSeconds: number;
  concurrencyLevel: number;
  bytesDownloaded: number;
  bytesUploaded: number;
  downloadSpeedMbps: number;
  uploadSpeedMbps: number;
  latency: LatencyMetrics;
  packetLossPercent: number | null; // null if unmeasurable by browser (NO FAKE METRICS)
  requestStatistics: RequestStatistics;
  httpStatusCode: number;
  status: TestStatus;
  error?: string;
  isValid: boolean; // false if HTTP 429 or invalid test
}

export type ProgressPhase = 
  | 'INITIALIZING'
  | 'SERVER_SELECTION'
  | 'LATENCY_TEST'
  | 'DOWNLOAD_TEST'
  | 'UPLOAD_TEST'
  | 'CALCULATING'
  | 'SAVING'
  | 'COMPLETED'
  | 'FAILED';

export interface ProgressState {
  phase: ProgressPhase;
  progressPercent: number; // 0 to 100
  currentThroughputMbps: number;
  bytesTransferred: number;
  elapsedTimeSeconds: number;
  activeConnections: number;
  statusMessage: string;
  currentMetrics?: Partial<MeasurementResult>;
}

export type ProgressCallback = (state: ProgressState) => void;

export interface EngineConfig {
  concurrencyLevel: number; // 1, 2, 4, 8 (16 ready)
  downloadDurationSeconds: number; // e.g. 10s
  uploadDurationSeconds: number; // e.g. 10s
  latencyProbeCount: number; // e.g. 10 probes
  selectedServer?: ServerNode;
  customServerList?: ServerNode[];
  onProgress?: ProgressCallback;
}
