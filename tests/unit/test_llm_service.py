import unittest
import sys
import os
from unittest.mock import patch, AsyncMock

# Add apps/api to path so app modules can be imported
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../apps/api')))

from app.services.llm_service import (
    build_network_context,
    generate_insights,
)


class TestLLMService(unittest.IsolatedAsyncioTestCase):

    def setUp(self):
        self.sample_measurement = {
            "id": "meas-test-001",
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

    # ─── build_network_context ─────────────────────────────────────────────
    def test_build_network_context_contains_measurement_data(self):
        ctx = build_network_context(self.sample_measurement, self.sample_history)
        self.assertIn("CURRENT MEASUREMENT", ctx)
        self.assertIn("1.06 Mbps", ctx)
        self.assertIn("486.33 ms", ctx)
        self.assertIn("75.91 ms", ctx)
        self.assertIn("HISTORICAL BASELINE (5 previous tests)", ctx)

    def test_build_network_context_no_measurement(self):
        ctx = build_network_context(None, None)
        self.assertIn("None selected", ctx)
        self.assertIn("No prior test history", ctx)

    def test_build_network_context_no_history(self):
        ctx = build_network_context(self.sample_measurement, {"total_tests": 0})
        self.assertIn("No prior test history", ctx)

    # ─── generate_insights ────────────────────────────────────────────────
    async def test_generate_insights_degraded(self):
        insights = await generate_insights(self.sample_measurement, self.sample_history)
        self.assertEqual(insights["throughput_status"], "Low")
        self.assertEqual(insights["latency_status"], "Very High")
        self.assertEqual(insights["jitter_status"], "Very High")
        self.assertEqual(insights["overall_rating"], "Degraded")

    async def test_generate_insights_no_measurement(self):
        insights = await generate_insights(None, None)
        self.assertEqual(insights["overall_rating"], "N/A")
        self.assertIn("Run a speed test", insights["recommended_action"])

    async def test_generate_insights_comparison_below(self):
        # download 1.06 is well below avg 307.98 — should say "significantly below"
        insights = await generate_insights(self.sample_measurement, self.sample_history)
        self.assertIn("significantly below", insights["historical_comparison"])

    # ─── generate_chat_response raises 503 when no API key ────────────────
    async def test_generate_chat_response_raises_503_without_api_key(self):
        """
        With no OpenAI key configured, generate_chat_response must raise
        HTTPException(503) — NOT silently return a template string.
        """
        from fastapi import HTTPException
        from app.services.llm_service import generate_chat_response

        with patch("app.services.llm_service.get_openai_client", return_value=None):
            with self.assertRaises(HTTPException) as ctx:
                await generate_chat_response(
                    [{"role": "user", "content": "What is my download speed?"}],
                    self.sample_measurement,
                    self.sample_history,
                )
            self.assertEqual(ctx.exception.status_code, 503)

    # ─── generate_chat_response sends user message to LLM ─────────────────
    async def test_generate_chat_response_sends_user_message_to_llm(self):
        """
        When an API key is present, the user's exact question must appear
        as the last message sent to OpenAI.
        """
        from app.services.llm_service import generate_chat_response

        mock_client = AsyncMock()
        mock_choice = AsyncMock()
        mock_choice.message.content = "Your download is 1.06 Mbps."
        mock_resp = AsyncMock()
        mock_resp.choices = [mock_choice]
        mock_client.chat.completions.create.return_value = mock_resp

        user_question = "What is my download speed?"

        with patch("app.services.llm_service.get_openai_client", return_value=mock_client):
            answer = await generate_chat_response(
                [{"role": "user", "content": user_question}],
                self.sample_measurement,
                self.sample_history,
            )

        self.assertEqual(answer, "Your download is 1.06 Mbps.")

        # Verify the exact user question reached OpenAI
        call_kwargs = mock_client.chat.completions.create.call_args[1]
        sent_messages = call_kwargs["messages"]
        user_messages = [m for m in sent_messages if m["role"] == "user"]
        self.assertEqual(len(user_messages), 1)
        self.assertEqual(user_messages[0]["content"], user_question)

        # Verify the system message contains the measurement context
        sys_messages = [m for m in sent_messages if m["role"] == "system"]
        self.assertEqual(len(sys_messages), 1)
        self.assertIn("1.06 Mbps", sys_messages[0]["content"])
        self.assertIn("486.33 ms", sys_messages[0]["content"])

    # ─── Three questions produce three different LLM calls ────────────────
    async def test_three_questions_produce_distinct_llm_calls(self):
        """
        The three required questions must each reach the LLM as distinct
        user messages and return distinct answers — no template strings.
        """
        from app.services.llm_service import generate_chat_response

        questions = {
            "A": "What is my download speed?",
            "B": "Explain this specific measurement result",
            "C": "How can I improve my download speed?",
        }
        expected_key_phrases = {
            "A": "download",
            "B": "measurement result",
            "C": "improve",
        }

        mock_client = AsyncMock()

        async def side_effect(**kwargs):
            # Return answer that echoes the user question — proves LLM is invoked per question
            user_q = next(m["content"] for m in reversed(kwargs["messages"]) if m["role"] == "user")
            resp = AsyncMock()
            resp.choices[0].message.content = f"LLM answer for: {user_q}"
            return resp

        mock_client.chat.completions.create.side_effect = side_effect

        answers = {}
        with patch("app.services.llm_service.get_openai_client", return_value=mock_client):
            for key, q in questions.items():
                answers[key] = await generate_chat_response(
                    [{"role": "user", "content": q}],
                    self.sample_measurement,
                    self.sample_history,
                )

        # All three answers must be different
        self.assertEqual(len(set(answers.values())), 3, "All three answers must be distinct")

        # Each answer must contain the user's own question text
        for key, q in questions.items():
            self.assertIn(q, answers[key], f"Answer [{key}] must contain the user's question")

        # None of the answers may be a hardcoded template string
        for key, ans in answers.items():
            self.assertNotIn("Your test measured", ans)
            self.assertNotIn("Possible causes include temporary network congestion", ans)
            self.assertNotIn("unstable network path", ans)
            self.assertNotIn("server-side limitations", ans)


if __name__ == '__main__':
    unittest.main()
