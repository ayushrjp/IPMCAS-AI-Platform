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

    def setUp(self):
        self.sample_measurement = {
            "download_mbps": 1.06,
            "upload_mbps": 3.74,
            "latency_ms": 486.33,
            "jitter_ms": 75.91,
            "status": "DURATION_LIMIT_REACHED",
            "server_node": "IPMCAS Primary Server"
        }
        self.sample_history = {
            "total_tests": 5,
            "avg_download_mbps": 307.98,
            "avg_upload_mbps": 280.0,
            "avg_latency_ms": 15.0,
            "avg_jitter_ms": 2.1
        }

    def test_build_network_context_with_data(self):
        ctx = build_network_context(self.sample_measurement, self.sample_history)
        self.assertIn("CURRENT MEASUREMENT (EVIDENCE CONTEXT)", ctx)
        self.assertIn("1.06 Mbps", ctx)
        self.assertIn("486.33 ms", ctx)
        self.assertIn("HISTORICAL BASELINE (5 previous tests)", ctx)

    def test_question_intent_give_suggestions(self):
        resp = fallback_chat_response("Give suggestions to improve speed", self.sample_measurement, self.sample_history)
        self.assertIn("practical, evidence-based recommendations", resp.lower())
        self.assertIn("ethernet", resp.lower())
        self.assertNotIn("gaming will likely feel laggy", resp.lower())

    def test_question_intent_gaming(self):
        resp = fallback_chat_response("Is this good for gaming?", self.sample_measurement, self.sample_history)
        self.assertIn("gaming", resp.lower())
        self.assertIn("486.33 ms", resp)
        self.assertNotIn("practical steps to improve", resp.lower())

    def test_question_intent_what_is_jitter(self):
        resp = fallback_chat_response("What is jitter?", self.sample_measurement, self.sample_history)
        self.assertIn("jitter measures", resp.lower())
        self.assertIn("75.91 ms", resp)

    def test_question_intent_reduce_latency(self):
        resp = fallback_chat_response("How can I reduce latency?", self.sample_measurement, self.sample_history)
        self.assertIn("reduce your measured latency of **486.33 ms**", resp)

    def test_question_intent_compare(self):
        resp = fallback_chat_response("Compare this with my previous tests", self.sample_measurement, self.sample_history)
        self.assertIn("comparing your current test", resp.lower())
        self.assertIn("historical baseline of 5 previous tests", resp.lower())

    def test_question_intent_stability(self):
        resp = fallback_chat_response("Is my network stable?", self.sample_measurement, self.sample_history)
        self.assertIn("unstable", resp.lower())
        self.assertIn("75.91 ms jitter", resp)

    def test_question_intent_simple_terms(self):
        resp = fallback_chat_response("Explain my test in simple terms", self.sample_measurement, self.sample_history)
        self.assertIn("in simple terms", resp.lower())
        self.assertIn("how fast data arrives", resp.lower())

    async def test_generate_insights(self):
        insights = await generate_insights(self.sample_measurement, self.sample_history)
        self.assertEqual(insights["throughput_status"], "Low")
        self.assertEqual(insights["latency_status"], "Very High")
        self.assertEqual(insights["jitter_status"], "Very High")
        self.assertEqual(insights["overall_rating"], "Degraded")

if __name__ == '__main__':
    unittest.main()
