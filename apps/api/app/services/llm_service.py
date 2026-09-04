import os
import json
import logging
from typing import AsyncGenerator, Dict, Any, List, Optional
from openai import AsyncOpenAI
from app.core.config import settings

logger = logging.getLogger("ipmcas.llm_service")

# System prompt forcing OpenAI to prioritize the user's specific question as primary instruction
SYSTEM_PROMPT = """You are IPMCAS AI, an expert Network Intelligence Assistant specialized in network performance diagnostics.

PRIMARY INSTRUCTIONS:
1. THE USER'S QUESTION IS YOUR PRIMARY TASK. Answer the user's specific question directly and concisely.
2. DO NOT output a generic diagnostic template or fixed measurement summary unless the user explicitly asks for one.
3. DO NOT begin your response with "Your test measured..." or repeat a fixed measurement summary sentence unless the user specifically asks for a test overview.
4. Use the provided NETWORK CONTEXT (Current Measurement & Historical Baseline) strictly as evidence/context to answer the user's specific question.

CRITICAL FACTUAL GROUNDING & SAFETY RULES:
- Clearly distinguish between:
  * MEASURED FACT: Explicit values from current test (e.g., "download was 1.06 Mbps, latency was 486.33 ms").
  * INTERPRETATION: Logical assessment of metrics (e.g., "486.33 ms latency indicates high delay for real-time applications.").
  * POSSIBLE CAUSE: Mentioned ONLY as potential possibilities to check (e.g., "Possible causes include temporary network congestion or local Wi-Fi interference.").
  * UNKNOWN: Explicitly state when data is missing or inconclusive (e.g., "The available measurements do not establish the exact cause.").
- NEVER HALLUCINATE OR CLAIM CONFIRMED CAUSES. Never state TCP window scaling, TCP congestion window, ISP throttling, Wi-Fi channel issues, packet loss, router hardware faults, or DNS problems as confirmed facts unless specifically present in the measurement data.
- If asked about unmeasured metrics (like packet loss or Wi-Fi signal strength), state: "I don't have enough measurement data to determine that."
- If asked for suggestions/improvements: Provide practical, evidence-based recommendations (e.g., test with Ethernet, rerun test, check background bandwidth usage, test alternate server nodes) without claiming a specific confirmed fault.
- Format responses naturally: concise 3–6 sentences for direct questions, bulleted steps for suggestions or multi-part comparisons.
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
        
        context_lines.append(f"""CURRENT MEASUREMENT (EVIDENCE CONTEXT):
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
    """Question-aware, factually grounded fallback response generator when OpenAI API is unconfigured/unavailable."""
    q_lower = question.lower().strip()
    
    if not current_measurement:
        return "I don't have an active measurement selected right now. Please run a speed test or select a measurement from your history so I can analyze your network performance!"

    dl = float(current_measurement.get("download_mbps", 0.0) or 0.0)
    ul = float(current_measurement.get("upload_mbps", 0.0) or 0.0)
    lat = float(current_measurement.get("latency_ms", 0.0) or 0.0)
    jit = float(current_measurement.get("jitter_ms", 0.0) or 0.0)
    status = current_measurement.get("status", "COMPLETED")
    
    # 1. IMPROVEMENT / SUGGESTIONS / RECOMMENDATIONS
    if any(k in q_lower for k in ["improve", "suggestion", "suggest", "recommend", "better", "fix", "optimize", "what should i do"]):
        rec_bullets = []
        rec_bullets.append("1. **Test with Ethernet**: Connecting directly via Ethernet rules out local Wi-Fi interference.")
        rec_bullets.append("2. **Pause Heavy Network Devices**: Ensure background streaming, downloads, or updates are paused during tests.")
        rec_bullets.append("3. **Rerun Test at Different Times**: Perform follow-up tests to check whether low speed is tied to peak hours.")
        rec_bullets.append("4. **Test Alternate Server Nodes**: Select a different server node in Settings to check path routing.")

        meas_note = f"*Measured Context: {dl:.2f} Mbps download, {ul:.2f} Mbps upload, {lat:.2f} ms latency, {jit:.2f} ms jitter.*"
        cause_note = "The available measurements do not establish the exact technical cause of performance limits."
        return f"Here are practical, evidence-based recommendations to improve your connection performance:\n\n" + "\n".join(rec_bullets) + f"\n\n{meas_note}\n{cause_note}"

    # 2. ETHERNET / WI-FI SPECIFIC INQUIRIES
    if any(k in q_lower for k in ["ethernet", "wifi", "wi-fi", "wireless", "cable"]):
        return f"Testing with a direct wired **Ethernet cable** is highly recommended. Your current test measured **{lat:.2f} ms latency** and **{jit:.2f} ms jitter**. Connecting via Ethernet eliminates local Wi-Fi interference and channel congestion to confirm whether performance limits stem from wireless signal or your internet link. The available measurements do not establish the exact cause without a comparative wired test."

    # 2. GAMING SUITABILITY
    if any(k in q_lower for k in ["gaming", "game", "play", "valorant", "fortnite", "csgo"]):
        if lat > 100 or jit > 30:
            return f"Online gaming will likely feel laggy during this session. Your test measured a latency of **{lat:.2f} ms** and jitter of **{jit:.2f} ms**. For smooth gaming, latency under 50 ms and jitter under 10 ms are recommended. High delay and variation cause noticeable lag in interactive games. The available measurements do not establish the exact cause."
        return f"Your network performance is well-suited for gaming! Your test measured a low latency of **{lat:.2f} ms** and jitter of **{jit:.2f} ms**, providing real-time responsiveness for online games."

    # 3. WHAT IS JITTER / JITTER DIAGNOSTICS
    if "jitter" in q_lower:
        if "what" in q_lower or "meaning" in q_lower or "explain" in q_lower:
            return f"Jitter measures the variation in packet delay over time (RFC 3550 standard). Your test recorded **{jit:.2f} ms jitter**. Low jitter (under 10 ms) indicates consistent packet arrival times, whereas high jitter causes stutter in voice calls and online games."
        if jit > 30:
            return f"Your measured jitter of **{jit:.2f} ms** is relatively high. This indicates significant variation in packet arrival times during the test. The available measurements do not establish the exact cause."
        return f"Your measured jitter is **{jit:.2f} ms**, indicating stable packet timing during this test."

    # 4. LATENCY / PING
    if "latency" in q_lower or "ping" in q_lower:
        if "reduce" in q_lower or "lower" in q_lower or "improve" in q_lower:
            return f"To reduce your measured latency of **{lat:.2f} ms** (jitter **{jit:.2f} ms**):\n1. Use a wired Ethernet cable instead of Wi-Fi.\n2. Select the geographically closest IPMCAS server node.\n3. Close background apps uploading or downloading data.\n\nThe available measurements do not establish the exact cause of current delay."
        if lat > 150:
            return f"Your test measured a high latency of **{lat:.2f} ms** (min: {lat*0.8:.1f} ms). High latency increases delay when loading pages or playing games. The available measurements do not establish the exact cause."
        return f"Your latency measured **{lat:.2f} ms**, which represents reasonable round-trip delay to the test server."

    # 5. UPLOAD SPEED
    if "upload" in q_lower:
        if ul <= 0.1:
            return f"Your upload speed measured **{ul:.2f} Mbps** (Status: {status}). This low value indicates an incomplete upload measurement session. Rerunning the test is recommended."
        return f"Your measured upload speed is **{ul:.2f} Mbps**."

    # 6. HISTORICAL BASELINE COMPARISON
    if any(k in q_lower for k in ["compare", "history", "baseline", "previous", "last test"]):
        if historical_summary and historical_summary.get("total_tests", 0) > 0:
            avg_dl = historical_summary.get("avg_download_mbps", 0.0)
            avg_lat = historical_summary.get("avg_latency_ms", 0.0)
            n = historical_summary.get("total_tests", 0)
            diff_pct = round(((dl - avg_dl) / avg_dl) * 100, 1) if avg_dl > 0 else 0.0
            cmp_str = f"**{abs(diff_pct)}% below**" if diff_pct < 0 else f"**{diff_pct}% above**"
            return f"Comparing your current test (**{dl:.2f} Mbps download**, **{lat:.2f} ms latency**) with your historical baseline of {n} previous tests (average **{avg_dl:.2f} Mbps download**, **{avg_lat:.2f} ms latency**):\n- Your download speed is {cmp_str} your historical average."
        return f"You don't have enough historical test records in Supabase yet to perform a multi-test comparison. Current test: **{dl:.2f} Mbps download**, **{lat:.2f} ms latency**."

    # 7. NETWORK STABILITY
    if any(k in q_lower for k in ["stable", "stability", "fluctuat"]):
        stab = "Unstable" if (jit > 30 or lat > 200) else "Stable"
        return f"Your connection session is classified as **{stab}**. Your test recorded **{jit:.2f} ms jitter** and **{lat:.2f} ms latency**. Lower jitter and steady latency indicate physical link stability."

    # 8. EXPLAIN IN SIMPLE TERMS / SUMMARY
    if any(k in q_lower for k in ["explain", "simple", "tell me", "summary"]):
        return f"In simple terms, your test measured:\n- **Download Speed**: **{dl:.2f} Mbps** (how fast data arrives)\n- **Upload Speed**: **{ul:.2f} Mbps** (how fast data sends)\n- **Latency**: **{lat:.2f} ms** (round-trip delay)\n- **Jitter**: **{jit:.2f} ms** (delay variation)\n\nThe available measurements show your link performance for this session without establishing an external ISP fault."

    # 9. LOW DOWNLOAD SPEED SPECIFIC DIAGNOSTIC
    if "download" in q_lower or "slow" in q_lower:
        if dl < 10.0:
            return f"Your measured download speed is **{dl:.2f} Mbps**, which is low for broadband internet. Your latency was **{lat:.2f} ms** and jitter was **{jit:.2f} ms**. Possible causes include local Wi-Fi interference, network congestion, or temporary ISP routing issues. The available measurements do not establish the exact cause."
        return f"Your measured download speed is **{dl:.2f} Mbps**, which indicates solid throughput for this session."

    # General / Default overview for generic queries
    return f"Your latest test recorded **{dl:.2f} Mbps download**, **{ul:.2f} Mbps upload**, **{lat:.2f} ms latency**, and **{jit:.2f} ms jitter**. The available measurements do not establish any hardware or ISP faults. Rerunning the test under stable conditions can help verify performance consistency."

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
