import unittest
import sys
import os

# Add apps/api to path so app modules can be imported
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../apps/api')))

from app.services.llm_service import (
    build_network_context,
    fallback_chat_response,
    generate_insights
)

class TestLLMService(unittest.IsolatedAsyncioTestCase):

    def test_build_network_context_with_data(self):
        current = {
            "download_mbps": 1.19,
            "upload_mbps": 0.0,
            "latency_ms": 822.32,
            "jitter_ms": 169.51,
            "status": "DURATION_LIMIT_REACHED",
            "server_node": "IPMCAS Primary Server"
        }
        history = {
            "total_tests": 5,
            "avg_download_mbps": 307.98,
            "avg_upload_mbps": 280.0,
            "avg_latency_ms": 15.0,
            "avg_jitter_ms": 2.1
        }

        ctx = build_network_context(current, history)
        self.assertIn("CURRENT MEASUREMENT", ctx)
        self.assertIn("1.19 Mbps", ctx)
        self.assertIn("822.32 ms", ctx)
        self.assertIn("HISTORICAL BASELINE (5 previous tests)", ctx)
        self.assertIn("307.98 Mbps", ctx)

    def test_fallback_chat_response_gaming(self):
        current = {
            "download_mbps": 1.19,
            "upload_mbps": 0.0,
            "latency_ms": 822.32,
            "jitter_ms": 169.51,
            "status": "DURATION_LIMIT_REACHED"
        }

        resp = fallback_chat_response("Is my latency good for gaming?", current, None)
        self.assertIn("822.32 ms", resp)
        self.assertIn("169.51 ms", resp)
        self.assertIn("The available measurements do not establish the exact cause", resp)
        self.assertNotIn("TCP window scaling", resp)
        self.assertNotIn("packet loss", resp)

    def test_fallback_chat_response_low_download(self):
        current = {
            "download_mbps": 1.19,
            "upload_mbps": 0.0,
            "latency_ms": 822.32,
            "jitter_ms": 169.51,
            "status": "DURATION_LIMIT_REACHED"
        }
        history = {
            "total_tests": 10,
            "avg_download_mbps": 300.0,
            "avg_upload_mbps": 250.0,
            "avg_latency_ms": 15.0,
            "avg_jitter_ms": 2.0
        }

        resp = fallback_chat_response("Why is my download speed low?", current, history)
        self.assertIn("1.19 Mbps", resp)
        self.assertIn("300.00 Mbps", resp)
        self.assertIn("available measurements do not establish the exact cause", resp)

    async def test_generate_insights(self):
        current = {
            "download_mbps": 1.19,
            "upload_mbps": 0.0,
            "latency_ms": 822.32,
            "jitter_ms": 169.51,
            "status": "DURATION_LIMIT_REACHED"
        }
        history = {
            "total_tests": 3,
            "avg_download_mbps": 100.0
        }

        insights = await generate_insights(current, history)
        self.assertEqual(insights["throughput_status"], "Low")
        self.assertEqual(insights["latency_status"], "Very High")
        self.assertEqual(insights["jitter_status"], "Very High")
        self.assertEqual(insights["overall_rating"], "Degraded")
        self.assertIn("significantly below your average", insights["historical_comparison"])

if __name__ == '__main__':
    unittest.main()
