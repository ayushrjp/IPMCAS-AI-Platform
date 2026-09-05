import unittest
import sys
import os
from unittest.mock import patch, AsyncMock

# Add apps/api to path so app modules can be imported
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../apps/api')))

from app.api.routes.assistant import assistant_chat, AssistantChatRequest


class TestAssistantLLMFlow(unittest.IsolatedAsyncioTestCase):

    def setUp(self):
        self.context = {
            "id": "meas-flow-test",
            "downloadSpeedMbps": 1.49,
            "uploadSpeedMbps": 0.0,
            "latency": {"avgMs": 423.14, "jitterMs": 86.23},
            "status": "DURATION_LIMIT_REACHED",
        }

    # ─── LLM is invoked, not bypassed ─────────────────────────────────────
    @patch("app.api.routes.assistant.generate_chat_response", new_callable=AsyncMock)
    async def test_llm_service_is_called_for_every_question(self, mock_generate):
        mock_generate.return_value = "LLM answer."

        req = AssistantChatRequest(
            message="What is my download speed?",
            context_override=self.context,
        )
        res = await assistant_chat(req, user_id=None)

        mock_generate.assert_called_once()
        self.assertEqual(res["answer"], "LLM answer.")
        self.assertEqual(res["analysis_type"], "LLM_CONVERSATIONAL")

    # ─── User message is passed as-is ─────────────────────────────────────
    @patch("app.api.routes.assistant.generate_chat_response", new_callable=AsyncMock)
    async def test_user_message_is_exact_last_message(self, mock_generate):
        mock_generate.return_value = "ok"

        user_question = "Explain this specific measurement result"
        req = AssistantChatRequest(
            message=user_question,
            context_override=self.context,
        )
        await assistant_chat(req, user_id=None)

        call_args = mock_generate.call_args[0]
        messages = call_args[0]
        self.assertEqual(messages[-1]["role"], "user")
        self.assertEqual(messages[-1]["content"], user_question)

    # ─── Measurement context is passed to LLM, not used for answer ─────────
    @patch("app.api.routes.assistant.generate_chat_response", new_callable=AsyncMock)
    async def test_measurement_context_passed_to_llm(self, mock_generate):
        mock_generate.return_value = "ok"

        req = AssistantChatRequest(
            message="How can I improve my download speed?",
            context_override=self.context,
        )
        await assistant_chat(req, user_id=None)

        call_args = mock_generate.call_args[0]
        target_measurement = call_args[1]
        self.assertAlmostEqual(target_measurement["download_mbps"], 1.49)
        self.assertAlmostEqual(target_measurement["upload_mbps"], 0.0)
        self.assertAlmostEqual(target_measurement["latency_ms"], 423.14)
        self.assertAlmostEqual(target_measurement["jitter_ms"], 86.23)

    # ─── Three questions → three distinct LLM calls ─────────────────────
    @patch("app.services.llm_service.get_openai_client")
    async def test_three_questions_reach_openai_as_distinct_user_messages(self, mock_get_client):
        mock_client = AsyncMock()
        mock_get_client.return_value = mock_client

        questions = [
            "What is my download speed?",
            "Explain this specific measurement result",
            "How can I improve my download speed?",
        ]

        sent_user_questions = []

        async def capture_call(**kwargs):
            user_q = next(
                m["content"] for m in reversed(kwargs["messages"]) if m["role"] == "user"
            )
            sent_user_questions.append(user_q)
            resp = AsyncMock()
            resp.choices[0].message.content = f"Answer for: {user_q}"
            return resp

        mock_client.chat.completions.create.side_effect = capture_call

        answers = []
        for q in questions:
            req = AssistantChatRequest(
                message=q,
                context_override=self.context,
            )
            res = await assistant_chat(req, user_id=None)
            answers.append(res["answer"])

        # All three user questions reached OpenAI verbatim
        self.assertEqual(sent_user_questions, questions,
                         "Each question must reach OpenAI in order, unchanged")

        # All three answers must be different
        self.assertEqual(len(set(answers)), 3, "All three answers must be distinct")

        # System message must contain measurement values (not hardcoded template)
        sys_content = mock_client.chat.completions.create.call_args_list[0][1]["messages"][0]["content"]
        self.assertIn("1.49 Mbps", sys_content)
        self.assertIn("423.14 ms", sys_content)
        self.assertIn("86.23 ms", sys_content)

        # None of the answers must be a Python-generated template string
        for ans in answers:
            self.assertNotIn("Possible causes include temporary network congestion", ans)
            self.assertNotIn("unstable network path", ans)
            self.assertNotIn("server-side limitations", ans)


if __name__ == '__main__':
    unittest.main()
