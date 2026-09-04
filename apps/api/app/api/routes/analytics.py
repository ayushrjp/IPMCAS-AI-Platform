from fastapi import APIRouter
from typing import Optional

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get("/summary")
async def get_analytics_summary(timeframe: Optional[str] = "30d"):
    """
    Retrieve statistical analytics (Mean, Median, Percentiles, 95% Confidence Intervals).
    (Implementation placeholder for subsequent feature tasks).
    """
    return {
        "timeframe": timeframe,
        "sample_count": 0,
        "metrics": {
            "download_mbps": {"mean": 0.0, "median": 0.0, "std_dev": 0.0, "p95": 0.0},
            "upload_mbps": {"mean": 0.0, "median": 0.0, "std_dev": 0.0, "p95": 0.0},
            "latency_ms": {"mean": 0.0, "median": 0.0, "jitter_avg": 0.0}
        }
    }
