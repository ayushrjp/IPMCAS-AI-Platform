import os
import json
import logging
from typing import AsyncGenerator, Dict, Any, List, Optional
from openai import AsyncOpenAI
from app.core.config import settings

logger = logging.getLogger("ipmcas.llm_service")

# System prompt adhering strictly to factual grounding rules
SYSTEM_PROMPT = """You are IPMCAS AI, an expert Network Intelligence Assistant. You provide conversational, ChatGPT-style network diagnostics and analysis while adhering strictly to facts.

CRITICAL FACTUAL GROUNDING RULES:
1. Ground every statement in the provided MEASURED DATA (Current measurement & Historical baseline).
2. Clearly distinguish between:
   - MEASURED FACT: Facts explicitly present in the measurement (e.g., "Your test measured 1.19 Mbps download and 822.32 ms latency.").
   - INTERPRETATION: Logical assessment of the values (e.g., "That indicates extremely low throughput and high delay.").
   - POSSIBLE CAUSE: Mentioned ONLY as potential possibilities to check (e.g., "Possible causes include temporary network congestion or Wi-Fi interference.").
   - UNKNOWN: Explicitly state when data is missing or inconclusive (e.g., "The available measurements do not establish the exact cause.").
3. NEVER HALLUCINATE OR CLAIM CONFIRMED CAUSES. Never state TCP window scaling, TCP congestion window, ISP throttling, Wi-Fi channel issues, packet loss, router load, or DNS problems as confirmed facts unless specifically present in the measurement data.
4. If asked about unmeasured metrics (like packet loss or Wi-Fi signal), state: "I don't have enough measurement data to determine that."
5. Be concise, direct, helpful, and natural (~3 to 6 sentences for typical questions, clean bullet points for multi-part diagnostic summaries).
"""

def get_openai_client() -> Optional[AsyncOpenAI]:
    """Retrieves an initialized AsyncOpenAI client if a valid key is set."""
    api_key = (
        os.getenv("OPENAI_API_KEY") or
        getattr(settings, "OPENAI_API_KEY", None) or
        settings.LLM_API_KEY
    )
    if not api_key or api_key in ["placeholder-key", "your_openai_api_key_here", "sk-placeholder"]:
        return None
    
    return AsyncOpenAI(api_key=api_key)

def get_model_name() -> str:
    """Returns configured OpenAI model name."""
    return (
        os.getenv("OPENAI_MODEL") or
        getattr(settings, "OPENAI_MODEL", None) or
        settings.LLM_MODEL or
        "gpt-4o"
    )

def build_network_context(
    current_measurement: Optional[Dict[str, Any]] = None,
    historical_summary: Optional[Dict[str, Any]] = None
) -> str:
    """Formats current measurement and historical summary into structured LLM context."""
    context_lines = []
    
    if current_measurement:
        dl = current_measurement.get("download_mbps")
        ul = current_measurement.get("upload_mbps")
        lat = current_measurement.get("latency_ms")
        jit = current_measurement.get("jitter_ms")
        status = current_measurement.get("status", "unknown")
        
        dl_str = f"{dl:.2f} Mbps" if isinstance(dl, (int, float)) else "not measured / 0 Mbps"
        ul_str = f"{ul:.2f} Mbps" if isinstance(ul, (int, float)) else "not measured / 0 Mbps"
        lat_str = f"{lat:.2f} ms" if isinstance(lat, (int, float)) else "not measured"
        jit_str = f"{jit:.2f} ms" if isinstance(jit, (int, float)) else "not measured"
        
        client_info = current_measurement.get("client_info") or {}
        conn_type = client_info.get("connection_type") or "unknown"
        browser = client_info.get("browser") or "unknown"
        os_name = client_info.get("os") or "unknown"
        server_name = current_measurement.get("server_node") or "IPMCAS Primary Server"
        
        context_lines.append(f"""CURRENT MEASUREMENT (PRIMARY CONTEXT):
- Download Speed: {dl_str}
- Upload Speed: {ul_str}
- Latency: {lat_str}
- Jitter: {jit_str}
- Measurement Status: {status}
- Server Node: {server_name}
- Connection Type: {conn_type}
- Client Environment: {browser} on {os_name}""")
    else:
        context_lines.append("CURRENT MEASUREMENT: None currently selected.")
        
    if historical_summary and historical_summary.get("total_tests", 0) > 0:
        avg_dl = historical_summary.get("avg_download_mbps")
        avg_ul = historical_summary.get("avg_upload_mbps")
        avg_lat = historical_summary.get("avg_latency_ms")
        avg_jit = historical_summary.get("avg_jitter_ms")
        total = historical_summary.get("total_tests", 0)
        
        avg_dl_s = f"{avg_dl:.2f} Mbps" if isinstance(avg_dl, (int, float)) else "unavailable"
        avg_ul_s = f"{avg_ul:.2f} Mbps" if isinstance(avg_ul, (int, float)) else "unavailable"
        avg_lat_s = f"{avg_lat:.2f} ms" if isinstance(avg_lat, (int, float)) else "unavailable"
        avg_jit_s = f"{avg_jit:.2f} ms" if isinstance(avg_jit, (int, float)) else "unavailable"
        
        context_lines.append(f"""HISTORICAL BASELINE ({total} previous tests):
- Average Download: {avg_dl_s}
- Average Upload: {avg_ul_s}
- Average Latency: {avg_lat_s}
- Average Jitter: {avg_jit_s}""")
    else:
        context_lines.append("HISTORICAL BASELINE: No prior test history available.")
        
    return "\n\n".join(context_lines)

def fallback_chat_response(
    question: str,
    current_measurement: Optional[Dict[str, Any]] = None,
    historical_summary: Optional[Dict[str, Any]] = None
) -> str:
    """Deterministic, factually grounded fallback response generator when OpenAI is unavailable."""
    q_lower = question.lower()
    
    if not current_measurement:
        return "I don't have an active measurement selected right now. Please run a speed test or select a measurement from your history so I can analyze your network performance!"

    dl = current_measurement.get("download_mbps", 0.0) or 0.0
    ul = current_measurement.get("upload_mbps", 0.0) or 0.0
    lat = current_measurement.get("latency_ms", 0.0) or 0.0
    jit = current_measurement.get("jitter_ms", 0.0) or 0.0
    status = current_measurement.get("status", "COMPLETED")
    
    if "gaming" in q_lower or "game" in q_lower:
        if lat > 100 or jit > 30:
            return f"Your current test recorded a high latency of {lat:.2f} ms and jitter of {jit:.2f} ms. For online gaming, latency under 50 ms and jitter under 10 ms are ideal. The current delay may cause noticeable lag in interactive games. The available measurements do not establish the exact cause."
        return f"Your current latency is {lat:.2f} ms and jitter is {jit:.2f} ms, which is very good for gaming and real-time interactive applications."

    if "download" in q_lower or "slow" in q_lower or "speed" in q_lower:
        if dl < 10.0:
            msg = f"Your measured download speed is {dl:.2f} Mbps, which is relatively low for broadband connections."
            if historical_summary and historical_summary.get("avg_download_mbps"):
                avg = historical_summary["avg_download_mbps"]
                msg += f" This is below your historical baseline average of {avg:.2f} Mbps."
            msg += " Possible causes include local Wi-Fi interference, network congestion, or temporary ISP routing issues. The available measurements do not establish the exact cause."
            return msg
        return f"Your measured download speed is {dl:.2f} Mbps, which indicates solid throughput."

    if "upload" in q_lower:
        if ul <= 0.1:
            return f"Your upload speed measured {ul:.2f} Mbps (Status: {status}). This indicates low or incomplete upload throughput during the test session. Rerunning the test is recommended to confirm stability."
        return f"Your measured upload speed is {ul:.2f} Mbps."

    if "latency" in q_lower or "ping" in q_lower or "jitter" in q_lower:
        return f"Your latency is {lat:.2f} ms and jitter is {jit:.2f} ms. Latency measures the round-trip delay of network packets, while jitter measures the variation in that delay over time."

    # General overview
    return f"Your latest test recorded {dl:.2f} Mbps download, {ul:.2f} Mbps upload, {lat:.2f} ms latency, and {jit:.2f} ms jitter. The available measurements do not establish any hardware or ISP faults. Rerunning the test under stable conditions can help verify performance consistency."

async def generate_chat_response(
    messages: List[Dict[str, str]],
    current_measurement: Optional[Dict[str, Any]] = None,
    historical_summary: Optional[Dict[str, Any]] = None
) -> str:
    """Generates a non-streaming chat response using OpenAI or falls back gracefully."""
    client = get_openai_client()
    if not client:
        last_user_msg = next((m["content"] for m in reversed(messages) if m.get("role") == "user"), "")
        return fallback_chat_response(last_user_msg, current_measurement, historical_summary)
        
    network_context = build_network_context(current_measurement, historical_summary)
    
    formatted_messages = [
        {"role": "system", "content": f"{SYSTEM_PROMPT}\n\nNETWORK CONTEXT:\n{network_context}"}
    ]
    
    # Append past conversation messages (keep up to last 10)
    for m in messages[-10:]:
        formatted_messages.append({"role": m["role"], "content": m["content"]})
        
    try:
        response = await client.chat.completions.create(
            model=get_model_name(),
            messages=formatted_messages,
            temperature=0.3,
            max_tokens=500
        )
        return response.choices[0].message.content or "I couldn't generate a response."
    except Exception as e:
        logger.error(f"OpenAI API call failed: {e}", exc_info=True)
        last_user_msg = next((m["content"] for m in reversed(messages) if m.get("role") == "user"), "")
        return fallback_chat_response(last_user_msg, current_measurement, historical_summary)

async def generate_chat_response_stream(
    messages: List[Dict[str, str]],
    current_measurement: Optional[Dict[str, Any]] = None,
    historical_summary: Optional[Dict[str, Any]] = None
) -> AsyncGenerator[str, None]:
    """Generates a streaming SSE chat response using OpenAI or falls back gracefully."""
    client = get_openai_client()
    if not client:
        last_user_msg = next((m["content"] for m in reversed(messages) if m.get("role") == "user"), "")
        fallback_text = fallback_chat_response(last_user_msg, current_measurement, historical_summary)
        # Stream fallback words with micro-chunks
        words = fallback_text.split(" ")
        for i, word in enumerate(words):
            chunk = word if i == len(words) - 1 else word + " "
            yield f"data: {json.dumps({'content': chunk})}\n\n"
        yield "data: [DONE]\n\n"
        return

    network_context = build_network_context(current_measurement, historical_summary)
    formatted_messages = [
        {"role": "system", "content": f"{SYSTEM_PROMPT}\n\nNETWORK CONTEXT:\n{network_context}"}
    ]
    for m in messages[-10:]:
        formatted_messages.append({"role": m["role"], "content": m["content"]})

    try:
        stream = await client.chat.completions.create(
            model=get_model_name(),
            messages=formatted_messages,
            temperature=0.3,
            max_tokens=500,
            stream=True
        )
        async for chunk in stream:
            if chunk.choices and chunk.choices[0].delta and chunk.choices[0].delta.content:
                text_piece = chunk.choices[0].delta.content
                yield f"data: {json.dumps({'content': text_piece})}\n\n"
        yield "data: [DONE]\n\n"
    except Exception as e:
        logger.error(f"OpenAI Streaming API failed: {e}", exc_info=True)
        last_user_msg = next((m["content"] for m in reversed(messages) if m.get("role") == "user"), "")
        fallback_text = fallback_chat_response(last_user_msg, current_measurement, historical_summary)
        yield f"data: {json.dumps({'content': fallback_text})}\n\n"
        yield "data: [DONE]\n\n"

async def generate_insights(
    current_measurement: Optional[Dict[str, Any]] = None,
    historical_summary: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """Generates structured network insights based on facts."""
    if not current_measurement:
        return {
            "summary": "No active measurement selected.",
            "throughput_status": "Unknown",
            "latency_status": "Unknown",
            "jitter_status": "Unknown",
            "overall_rating": "N/A",
            "historical_comparison": "No active test to compare.",
            "recommended_action": "Run a speed test to generate network insights."
        }

    dl = current_measurement.get("download_mbps", 0.0) or 0.0
    ul = current_measurement.get("upload_mbps", 0.0) or 0.0
    lat = current_measurement.get("latency_ms", 0.0) or 0.0
    jit = current_measurement.get("jitter_ms", 0.0) or 0.0

    dl_status = "Good" if dl >= 50 else ("Fair" if dl >= 15 else "Low")
    lat_status = "Excellent" if lat < 30 else ("Fair" if lat < 100 else "Very High")
    jit_status = "Low" if jit < 15 else ("Moderate" if jit < 40 else "Very High")

    hist_cmp = "No prior history available for baseline comparison."
    if historical_summary and historical_summary.get("avg_download_mbps"):
        avg_dl = historical_summary["avg_download_mbps"]
        if dl < avg_dl * 0.7:
            hist_cmp = f"Current download ({dl:.2f} Mbps) is significantly below your average ({avg_dl:.2f} Mbps)."
        elif dl > avg_dl * 1.2:
            hist_cmp = f"Current download ({dl:.2f} Mbps) is above your average ({avg_dl:.2f} Mbps)."
        else:
            hist_cmp = f"Current download ({dl:.2f} Mbps) aligns with your historical average ({avg_dl:.2f} Mbps)."

    overall = "Optimal" if (dl_status == "Good" and lat_status == "Excellent") else "Degraded" if (dl_status == "Low" or lat_status == "Very High") else "Moderate"

    action = "Your connection is performing well." if overall == "Optimal" else "Rerun the speed test under stable conditions and check local device activity."

    return {
        "summary": f"Test shows {dl:.2f} Mbps download, {ul:.2f} Mbps upload, {lat:.2f} ms latency, and {jit:.2f} ms jitter.",
        "throughput_status": dl_status,
        "latency_status": lat_status,
        "jitter_status": jit_status,
        "overall_rating": overall,
        "historical_comparison": hist_cmp,
        "recommended_action": action
    }
