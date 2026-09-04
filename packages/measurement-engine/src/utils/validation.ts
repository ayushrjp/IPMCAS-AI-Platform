import { TestStatus, RequestStatistics } from '../types';

export interface StatusClassificationParams {
  bytesTransferred: number;
  activeDurationSeconds: number;
  targetDurationSeconds: number;
  durationLimitReached: boolean;
  httpStatusCode: number;
  requestStats: RequestStatistics;
  timedOut?: boolean;
  hasException?: boolean;
}

/**
 * Classifies a measurement test run into a strongly typed TestStatus enum.
 * Enforces explicit HTTP 429 rate limiting detection and duration-limit taxonomy (E3/E4).
 */
export function classifyTestStatus(params: StatusClassificationParams): TestStatus {
  const {
    bytesTransferred,
    durationLimitReached,
    httpStatusCode,
    requestStats,
    timedOut,
    hasException,
  } = params;

  // 1. Explicit HTTP 429 Server Rate Limiting Check (CRITICAL REQUIREMENT)
  if (httpStatusCode === 429 || requestStats.rateLimitedRequests > 0) {
    return TestStatus.SERVER_RATE_LIMITED;
  }

  // 2. Timeout Check
  if (timedOut) {
    return TestStatus.TIMEOUT;
  }

  // 3. Complete failure or exception with 0 bytes
  if (bytesTransferred === 0 && (requestStats.successfulRequests === 0 || hasException)) {
    if (requestStats.failedRequests > 0 || hasException) {
      return TestStatus.REQUEST_FAILURE;
    }
    return TestStatus.NO_DATA;
  }

  // 4. Duration Limit Reached Check (E3 research finding: high-speed links or time cutoffs)
  if (durationLimitReached && bytesTransferred > 0) {
    return TestStatus.DURATION_LIMIT_REACHED;
  }

  // 5. Successful Completion Check
  if (bytesTransferred > 0 && requestStats.successfulRequests > 0) {
    return TestStatus.COMPLETED;
  }

  return TestStatus.OTHER_ERROR;
}

/**
 * Determines whether a measurement result is valid for statistical speed analysis.
 * Explicitly rejects rate-limited (HTTP 429), zero-byte, or failed measurements from valid averages.
 */
export function isMeasurementValid(status: TestStatus, httpStatusCode: number, bytesTransferred: number): boolean {
  if (httpStatusCode === 429) {
    return false;
  }

  if (
    status === TestStatus.SERVER_RATE_LIMITED ||
    status === TestStatus.REQUEST_FAILURE ||
    status === TestStatus.NO_DATA ||
    status === TestStatus.TIMEOUT ||
    status === TestStatus.OTHER_ERROR
  ) {
    return false;
  }

  return bytesTransferred > 0 && (status === TestStatus.COMPLETED || status === TestStatus.DURATION_LIMIT_REACHED);
}
