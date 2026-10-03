"""One reviewed model, tariff and conservative token envelope for video interpretation."""

import math
from decimal import Decimal

# Standard paid Gemini Developer API prices, USD/token, checked 2026-10-03:
# https://ai.google.dev/gemini-api/docs/pricing (no caching, grounding or batch rates).
MODEL = "gemini-2.5-flash-lite"
PRICE_DATE = "2026-10-03"
INPUT_USD_PER_TOKEN = Decimal("0.0000001")
AUDIO_USD_PER_TOKEN = Decimal("0.0000003")
OUTPUT_USD_PER_TOKEN = Decimal("0.0000004")
VIDEO_CAP_USD = Decimal("0.10")
# High-resolution static video: ~258 frame + 32 audio + metadata tokens/s at 1 Hz.
# https://ai.google.dev/gemini-api/docs/video-understanding, checked 2026-10-03.
# Use twice the published ~300 tokens/s and charge all input at the dearer audio tariff.
VIDEO_TOKENS_PER_SECOND = 600
# Operational output ceiling, including thinking; no automatic retries or tools allowed.
MAX_OUTPUT_TOKENS = 4096
# Worst-case byte/token assumption plus structural overhead, deliberately conservative.
PROMPT_OVERHEAD_TOKENS = 1024
MS_PER_SECOND = 1000
MICRODOLLAR = Decimal("0.000001")


def estimate_cost(duration_ms: int, prompt: str) -> dict:
    """Return a conservative USD ceiling and input/output limits before any generation.

    Duration is positive ms from MP4 start. UTF-8 bytes bound prompt tokens; video
    tokens include audio/metadata headroom. The provider must honour both ceilings,
    disable thinking/tools/retries, and report all billed input/output tokens.
    """
    if type(duration_ms) is not int or duration_ms <= 0:
        raise ValueError("Positive measured video duration required")
    tokens_in = (
        math.ceil(duration_ms / MS_PER_SECOND * VIDEO_TOKENS_PER_SECOND)
        + len(prompt.encode())
        + PROMPT_OVERHEAD_TOKENS
    )
    amount = actual_cost(tokens_in, MAX_OUTPUT_TOKENS, tokens_in)
    if amount > VIDEO_CAP_USD:
        raise ValueError("Video exceeds interpretation cost cap")
    return {"tokens_in": tokens_in, "tokens_out": MAX_OUTPUT_TOKENS, "cost_usd": float(amount)}


def actual_cost(tokens_in: int, tokens_out: int, audio_tokens: int) -> Decimal:
    """Price complete provider token usage in USD, rounding upwards to a microdollar.

    Complete input includes audio_tokens; the provider must supply its modality
    breakdown. Output includes any billed thinking tokens. No caching or tools.
    """
    if (
        any(type(value) is not int or value < 0 for value in (tokens_in, tokens_out, audio_tokens))
        or audio_tokens > tokens_in
    ):
        raise ValueError("Complete non-negative billed token counts required")
    return (
        (tokens_in - audio_tokens) * INPUT_USD_PER_TOKEN
        + audio_tokens * AUDIO_USD_PER_TOKEN
        + tokens_out * OUTPUT_USD_PER_TOKEN
    ).quantize(MICRODOLLAR, rounding="ROUND_CEILING")
