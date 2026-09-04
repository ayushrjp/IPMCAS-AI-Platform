import httpx
from typing import Dict, Any, Optional
from app.core.config import settings
from app.core.logging import logger

def get_headers() -> Dict[str, str]:
    return {
        "apikey": settings.SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    }

async def get_or_create_test_server(server_data: Optional[Dict[str, Any]] = None) -> str:
    """
    Ensures a test server record exists in public.test_servers and returns its UUID id.
    """
    url = f"{settings.SUPABASE_URL.rstrip('/')}/rest/v1/test_servers"
    headers = get_headers()
    
    async with httpx.AsyncClient() as client:
        # Check for existing test server
        response = await client.get(f"{url}?select=id&limit=1", headers=headers)
        if response.status_code == 200:
            servers = response.json()
            if servers and len(servers) > 0:
                return servers[0]["id"]
        
        # Create default test server if none exists
        import os
        env_base_url = os.getenv("PUBLIC_API_BASE_URL") or os.getenv("NEXT_PUBLIC_API_BASE_URL") or "http://localhost:8000"
        default_base_url = f"{env_base_url.rstrip('/')}/api/v1/measurements"

        name = server_data.get("name", "IPMCAS Primary Server Node (Production Edge)") if server_data else "IPMCAS Primary Server Node (Production Edge)"
        base_url = server_data.get("baseUrl", default_base_url) if server_data else default_base_url
        
        payload = {
            "name": name,
            "base_url": base_url,
            "region": "ap-south-1",
            "country": "IN",
            "latitude": 19.0760,
            "longitude": 72.8777,
            "capabilities": {"download": True, "upload": True, "latency": True},
            "priority": 100,
            "is_active": True
        }
        
        create_resp = await client.post(url, headers=headers, json=payload)
        if create_resp.status_code in (200, 201):
            created = create_resp.json()
            return created[0]["id"]
        else:
            logger.error(f"Failed to create test server in Supabase: {create_resp.status_code} {create_resp.text}")
            raise Exception(f"Failed to initialize test server: {create_resp.text}")

async def create_measurement_session(user_id: str, concurrency_level: int = 4, connection_type: str = "UNKNOWN") -> str:
    """
    Inserts a new measurement session into public.measurement_sessions and returns the session_id UUID.
    """
    url = f"{settings.SUPABASE_URL.rstrip('/')}/rest/v1/measurement_sessions"
    headers = get_headers()
    
    payload = {
        "user_id": user_id,
        "status": "INITIALIZING",
        "client_metadata": {
            "concurrency_level": concurrency_level,
            "connection_type": connection_type
        }
    }
    
    async with httpx.AsyncClient() as client:
        response = await client.post(url, headers=headers, json=payload)
        if response.status_code in (200, 201):
            records = response.json()
            session_id = records[0]["id"]
            logger.info(f"Created measurement session in Supabase: {session_id} for user {user_id}")
            return session_id
        else:
            logger.error(f"Failed to insert measurement session in Supabase: {response.status_code} {response.text}")
            raise Exception(f"Database session creation failed: {response.text}")

async def save_measurement_result(session_id: str, user_id: str, payload: Any) -> Dict[str, Any]:
    """
    Inserts measurement result into public.measurement_results table in Supabase PostgreSQL.
    """
    url = f"{settings.SUPABASE_URL.rstrip('/')}/rest/v1/measurement_results"
    headers = get_headers()
    
    # 1. Get or create a valid server_id FK
    server_dict = payload.server.dict() if hasattr(payload.server, "dict") else (payload.server if isinstance(payload.server, dict) else {})
    server_id = await get_or_create_test_server(server_dict)
    
    # Extract latency metrics cleanly
    latency = payload.latency
    latency_min = getattr(latency, "minMs", 0.0)
    latency_avg = getattr(latency, "avgMs", 0.0)
    latency_median = getattr(latency, "medianMs", 0.0)
    latency_max = getattr(latency, "maxMs", 0.0)
    jitter = getattr(latency, "jitterMs", 0.0)
    
    # Extract request statistics cleanly
    req_stats = payload.requestStatistics
    total_reqs = getattr(req_stats, "totalRequests", 0)
    succ_reqs = getattr(req_stats, "successfulRequests", 0)
    rate_lim_reqs = getattr(req_stats, "rateLimitedRequests", 0)
    other_errors = getattr(req_stats, "otherHttpErrors", 0)
    exceptions = getattr(req_stats, "requestExceptions", 0)
    
    db_payload = {
        "session_id": session_id,
        "user_id": user_id,
        "server_id": server_id,
        "test_type": payload.testType or "FULL",
        "concurrency": payload.concurrencyLevel,
        "configured_duration_s": 10.0,
        "actual_duration_s": max(0.1, payload.durationSeconds),
        "bytes_transferred": payload.bytesDownloaded + payload.bytesUploaded,
        "throughput_mbps": payload.downloadSpeedMbps,
        "latency_min_ms": latency_min,
        "latency_avg_ms": latency_avg,
        "latency_median_ms": latency_median,
        "latency_max_ms": latency_max,
        "jitter_ms": jitter,
        "packet_loss_percent": payload.packetLossPercent,
        "total_requests": total_reqs,
        "successful_requests": succ_reqs,
        "rate_limited_requests": rate_lim_reqs,
        "other_http_errors": other_errors,
        "request_exceptions": exceptions,
        "http_status": payload.httpStatusCode,
        "status": payload.status,
        "error": payload.error
    }
    
    async with httpx.AsyncClient() as client:
        # Insert measurement_results record
        res_response = await client.post(url, headers=headers, json=db_payload)
        if res_response.status_code not in (200, 201):
            logger.error(f"Failed to insert measurement result in Supabase: {res_response.status_code} {res_response.text}")
            raise Exception(f"Database insertion failed ({res_response.status_code}): {res_response.text}")
        
        inserted_result = res_response.json()[0]
        
        # Update measurement_sessions status to COMPLETED
        sess_url = f"{settings.SUPABASE_URL.rstrip('/')}/rest/v1/measurement_sessions?id=eq.{session_id}"
        await client.patch(sess_url, headers=headers, json={"status": payload.status})
        
        logger.info(f"Successfully persisted measurement result {inserted_result['id']} for session {session_id} in Supabase")
        return inserted_result

async def get_user_measurement_history(user_id: str, limit: int = 20, page: int = 1) -> Dict[str, Any]:
    """
    Fetches historical measurement records for the user directly from public.measurement_results in Supabase.
    """
    offset = (page - 1) * limit
    url = f"{settings.SUPABASE_URL.rstrip('/')}/rest/v1/measurement_results?user_id=eq.{user_id}&order=created_at.desc&limit={limit}&offset={offset}"
    headers = get_headers()
    headers["Prefer"] = "count=exact"

    async with httpx.AsyncClient() as client:
        response = await client.get(url, headers=headers)
        if response.status_code == 200:
            records = response.json()
            # Extract total count from Content-Range header if present e.g. "0-19/42"
            content_range = response.headers.get("Content-Range", "")
            total_records = len(records)
            if "/" in content_range:
                try:
                    total_records = int(content_range.split("/")[1])
                except ValueError:
                    pass

            # Map DB fields to camelCase structure for frontend compatibility
            formatted_data = []
            for r in records:
                formatted_data.append({
                    "id": r.get("id"),
                    "sessionId": r.get("session_id"),
                    "userId": r.get("user_id"),
                    "testType": r.get("test_type"),
                    "concurrencyLevel": r.get("concurrency"),
                    "durationSeconds": r.get("actual_duration_s"),
                    "bytesDownloaded": r.get("bytes_transferred"),
                    "bytesUploaded": 0,
                    "downloadSpeedMbps": r.get("throughput_mbps"),
                    "uploadSpeedMbps": r.get("upload_speed_mbps", 0.0),
                    "latency": {
                        "minMs": r.get("latency_min_ms"),
                        "avgMs": r.get("latency_avg_ms"),
                        "medianMs": r.get("latency_median_ms"),
                        "maxMs": r.get("latency_max_ms"),
                        "jitterMs": r.get("jitter_ms")
                    },
                    "latency_avg_ms": r.get("latency_avg_ms"),
                    "jitter_ms": r.get("jitter_ms"),
                    "throughput_mbps": r.get("throughput_mbps"),
                    "upload_speed_mbps": r.get("upload_speed_mbps"),
                    "packetLossPercent": r.get("packet_loss_percent"),
                    "httpStatusCode": r.get("http_status"),
                    "status": r.get("status"),
                    "error": r.get("error"),
                    "timestamp": r.get("created_at") or r.get("timestamp")
                })

            return {
                "page": page,
                "limit": limit,
                "total_records": total_records,
                "data": formatted_data
            }
        else:
            logger.error(f"Failed to query measurement history from Supabase: {response.status_code} {response.text}")
            return {"page": page, "limit": limit, "total_records": 0, "data": []}
