from datetime import datetime
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field, field_validator


class ServerNodeSchema(BaseModel):
    id: str
    name: str
    baseUrl: str
    region: str
    country: str
    latitude: float
    longitude: float


class LatencyMetricsSchema(BaseModel):
    probeCount: int = Field(ge=1, le=100)
    successfulProbes: int = Field(ge=0)
    failedProbes: int = Field(ge=0)
    minMs: float = Field(ge=0.0, le=10000.0)
    maxMs: float = Field(ge=0.0, le=10000.0)
    avgMs: float = Field(ge=0.0, le=10000.0)
    medianMs: float = Field(ge=0.0, le=10000.0)
    jitterMs: float = Field(ge=0.0, le=10000.0)


class RequestStatisticsSchema(BaseModel):
    totalRequests: int = Field(ge=0)
    startedRequests: int = Field(ge=0)
    successfulRequests: int = Field(ge=0)
    failedRequests: int = Field(ge=0)
    rateLimitedRequests: int = Field(ge=0) # HTTP 429 explicit count
    otherHttpErrors: int = Field(ge=0)
    requestExceptions: int = Field(ge=0)


class NetworkInfoSchema(BaseModel):
    type: str = Field(..., example="WIFI")
    ispName: Optional[str] = None
    effectiveType: Optional[str] = None


class MeasurementResultCreate(BaseModel):
    sessionId: str
    timestamp: datetime
    testType: str = "FULL"
    server: ServerNodeSchema
    network: NetworkInfoSchema
    durationSeconds: float = Field(gt=0.0, le=300.0)
    concurrencyLevel: int = Field(ge=1, le=16)
    bytesDownloaded: int = Field(ge=0)
    bytesUploaded: int = Field(ge=0)
    downloadSpeedMbps: float = Field(ge=0.0, le=10000.0)
    uploadSpeedMbps: float = Field(ge=0.0, le=10000.0)
    latency: LatencyMetricsSchema
    packetLossPercent: Optional[float] = None
    requestStatistics: RequestStatisticsSchema
    httpStatusCode: int = Field(ge=100, le=599)
    status: str
    error: Optional[str] = None
    isValid: bool

    @field_validator('status')
    @classmethod
    def validate_status_enum(cls, v: str) -> str:
        valid_statuses = {
            'COMPLETED',
            'DURATION_LIMIT_REACHED',
            'SERVER_RATE_LIMITED',
            'TIMEOUT',
            'REQUEST_FAILURE',
            'NO_DATA',
            'OTHER_ERROR'
        }
        if v not in valid_statuses:
            raise ValueError(f"Invalid test status '{v}'. Must be one of {valid_statuses}")
        return v
