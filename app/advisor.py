import os
from typing import AsyncGenerator
from expense_store import read_expenses, get_summary_metrics, get_settings

# Load .env from the project root (one level up from app/)
try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
except ImportError:
    pass

# ── Claude (Anthropic) ────────────────────────────────────────────
try:
    import anthropic
    _anthropic_client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY", ""))
    _HAS_ANTHROPIC = bool(os.environ.get("ANTHROPIC_API_KEY", ""))
except ImportError:
    _anthropic_client = None
    _HAS_ANTHROPIC = False

# ── Gemini (Google) ───────────────────────────────────────────────
try:
    from google import genai as _genai_module
    _GEMINI_KEY = os.environ.get("GEMINI_API_KEY", "")
    _HAS_GEMINI = bool(_GEMINI_KEY)
    _gemini_client = _genai_module.Client(api_key=_GEMINI_KEY) if _HAS_GEMINI else None
except ImportError:
    _HAS_GEMINI = False
    _gemini_client = None

_SYSTEM_PROMPT_BASE = """You are FinTracker's AI financial advisor — precise, data-driven, and direct.
You have full access to the user's transaction ledger and financial metrics shown below.
Always reference specific numbers from their data. Never give generic advice.
Keep responses concise (2-4 sentences max) unless the user asks for detail.
Format currency as $X,XXX.XX. Do not use markdown headers."""

_BRAIN_MODE_ADDENDUM = {
    "Creative": " Be imaginative and suggest unconventional savings strategies. Think outside the box.",
    "Balanced": " Balance caution with opportunity. Give practical, grounded advice.",
    "Strict":   " Be strict and conservative. Flag any unnecessary spending and push hard on budget discipline.",
}


def _build_context() -> str:
    expenses = read_expenses()
    summary  = get_summary_metrics()
    settings = get_settings()

    lines = [
        f"=== FINANCIAL SNAPSHOT ({summary.get('current_month', 'This Month')}) ===",
        f"Starting Capital: ${float(settings.get('starting_capital', 10000)):.2f}",
        f"Liquid Capital: ${summary['liquid_capital']:.2f}",
        f"Total Spent: ${summary['total_spent']:.2f}",
        f"Total Income: ${summary['total_income']:.2f}",
        f"Monthly Budget: ${float(settings.get('monthly_budget', 5000)):.2f}",
        f"Remaining Budget: ${summary['remaining_budget']:.2f}",
        f"Daily Budget Remaining: ${summary['daily_budget']:.2f}/day",
        "",
        "=== SPENDING BY CATEGORY ===",
    ]
    for cat in summary["categories"]:
        lines.append(f"  {cat['label']}: ${cat['amount']:.2f}")

    lines.append("")
    lines.append("=== RECENT TRANSACTIONS ===")
    for e in expenses[:20]:
        sign = "+" if e["transaction_type"] == "income" else "-"
        lines.append(f"  [{e['date']}] {e['name']} | {e['category_display']} | {sign}${abs(e['amount']):.2f} | {e['status']}")

    return "\n".join(lines)


def _active_provider() -> str:
    """Return which provider to use: 'gemini' or 'claude'."""
    settings = get_settings()
    pref = settings.get("ai_provider", "gemini").lower()
    if pref == "claude" and _HAS_ANTHROPIC:
        return "claude"
    if _HAS_GEMINI:
        return "gemini"
    if _HAS_ANTHROPIC:
        return "claude"
    return "none"


# ── Gemini helpers ────────────────────────────────────────────────

def _gemini_chat(prompt: str) -> str:
    try:
        response = _gemini_client.models.generate_content(
            model="models/gemini-2.5-flash-lite", contents=prompt
        )
        return response.text.strip()
    except Exception as e:
        return f"Gemini temporarily unavailable: {e}"


async def _gemini_stream(prompt: str) -> AsyncGenerator[str, None]:
    try:
        for chunk in _gemini_client.models.generate_content_stream(
            model="models/gemini-2.5-flash-lite", contents=prompt
        ):
            if chunk.text:
                yield f"data: {chunk.text}\n\n"
    except Exception as e:
        yield f"data: Gemini error: {e}\n\n"
    finally:
        yield "data: [DONE]\n\n"


# ── Claude helpers ────────────────────────────────────────────────

def _claude_chat(prompt: str, system: str) -> str:
    try:
        response = _anthropic_client.messages.create(
            model="claude-opus-4-8",
            max_tokens=400,
            system=system,
            messages=[{"role": "user", "content": prompt}]
        )
        return response.content[0].text
    except Exception as e:
        return f"Claude temporarily unavailable: {e}"


async def _claude_stream(prompt: str, system: str) -> AsyncGenerator[str, None]:
    try:
        with _anthropic_client.messages.stream(
            model="claude-opus-4-8",
            max_tokens=400,
            system=system,
            messages=[{"role": "user", "content": prompt}]
        ) as stream:
            for text in stream.text_stream:
                yield f"data: {text}\n\n"
    except Exception as e:
        yield f"data: Claude error: {e}\n\n"
    finally:
        yield "data: [DONE]\n\n"


# ── Fallback (no API keys) ────────────────────────────────────────

def _fallback_response(user_message: str) -> str:
    summary = get_summary_metrics()
    msg = user_message.lower()
    if any(w in msg for w in ["total", "spent", "how much"]):
        top = summary["categories"][0] if summary["categories"] else None
        top_str = f" Your top category is {top['label']} at ${top['amount']:.2f}." if top else ""
        return f"You've spent **${summary['total_spent']:.2f}** this month with **${summary['remaining_budget']:.2f}** budget remaining.{top_str}"
    if any(w in msg for w in ["capital", "balance", "liquid"]):
        return (f"Your liquid capital is **${summary['liquid_capital']:.2f}**. "
                f"You started with **${float(summary['settings'].get('starting_capital', 10000)):.2f}** "
                f"and have spent **${summary['total_spent']:.2f}** this month.")
    return (f"I'm monitoring your finances in real-time. Liquid Capital: **${summary['liquid_capital']:.2f}** | "
            f"Spent: **${summary['total_spent']:.2f}** | Remaining: **${summary['remaining_budget']:.2f}**. "
            "Add an ANTHROPIC_API_KEY or GEMINI_API_KEY to unlock full AI conversation.")


# ── Public API ────────────────────────────────────────────────────

def get_smart_insights() -> dict:
    summary  = get_summary_metrics()
    expenses = read_expenses()
    provider = _active_provider()

    if provider == "none":
        subscriptions = [e for e in expenses if "subscription" in e["category"].lower()]
        sub_count = len(subscriptions)
        sub_total = sum(e["amount"] for e in subscriptions)
        if sub_count >= 2:
            text = f"Your subscription spending is ${sub_total:.2f} this month across {sub_count} services. Consider auditing for duplicates."
        else:
            text = "Add a GEMINI_API_KEY or ANTHROPIC_API_KEY to unlock AI-powered financial insights."
        return {
            "title": "FinTracker Insight",
            "insight": text,
            "savings_potential": f"${sum(e['amount'] for e in expenses) * 0.1:.2f}",
            "velocity_status": f"Liquid capital: ${summary['liquid_capital']:.2f}. Budget remaining: ${summary['remaining_budget']:.2f}.",
        }

    context  = _build_context()
    question = f"{context}\n\nGive me one specific, actionable financial insight based on my actual spending data. Focus on the most important pattern you notice."

    if provider == "gemini":
        text = _gemini_chat(f"{_SYSTEM_PROMPT_BASE}{_BRAIN_MODE_ADDENDUM['Balanced']}\n\n{question}")
    else:
        text = _claude_chat(question, _SYSTEM_PROMPT_BASE + _BRAIN_MODE_ADDENDUM["Balanced"])

    return {
        "title": "AI Financial Insight",
        "insight": text,
        "savings_potential": f"${summary['remaining_budget'] * 0.15:.2f}",
        "velocity_status": f"Liquid capital: ${summary['liquid_capital']:.2f}. Budget remaining: ${summary['remaining_budget']:.2f}.",
    }


def get_chat_response(user_message: str, ai_brain_mode: str = "Balanced") -> str:
    provider = _active_provider()
    if provider == "none":
        return _fallback_response(user_message)

    context  = _build_context()
    addendum = _BRAIN_MODE_ADDENDUM.get(ai_brain_mode, _BRAIN_MODE_ADDENDUM["Balanced"])
    prompt   = f"{context}\n\nUser question: {user_message}"

    if provider == "gemini":
        return _gemini_chat(f"{_SYSTEM_PROMPT_BASE}{addendum}\n\n{prompt}")
    else:
        return _claude_chat(prompt, _SYSTEM_PROMPT_BASE + addendum)


def draft_cancellation_email(service_name: str, monthly_amount: float) -> str:
    provider = _active_provider()
    prompt = (
        f'Write a short, professional cancellation email for the service "{service_name}" '
        f"(monthly charge: ${monthly_amount:.2f}). "
        "Format exactly as:\n"
        "SUBJECT: [subject line]\n\n"
        "[email body — 3-4 sentences max. Request immediate cancellation, "
        "ask for written confirmation, mention no further charges.]"
    )
    if provider == "gemini":
        return _gemini_chat(prompt)
    if provider == "claude":
        return _claude_chat(prompt, "You write concise professional business emails.")
    return (
        f"SUBJECT: Cancellation Request — {service_name} Subscription\n\n"
        f"Dear {service_name} Support,\n\n"
        f"I am writing to request the immediate cancellation of my {service_name} subscription "
        f"(${monthly_amount:.2f}/month), effective today. "
        "Please confirm this cancellation in writing and ensure no further charges are applied to my payment method. "
        "I would appreciate a confirmation number for my records.\n\n"
        "Thank you,\n[Your Name]"
    )


async def stream_chat_response(user_message: str, ai_brain_mode: str = "Balanced") -> AsyncGenerator[str, None]:
    provider = _active_provider()
    if provider == "none":
        reply = _fallback_response(user_message)
        yield f"data: {reply}\n\n"
        yield "data: [DONE]\n\n"
        return

    context  = _build_context()
    addendum = _BRAIN_MODE_ADDENDUM.get(ai_brain_mode, _BRAIN_MODE_ADDENDUM["Balanced"])
    prompt   = f"{context}\n\nUser question: {user_message}"

    if provider == "gemini":
        async for chunk in _gemini_stream(f"{_SYSTEM_PROMPT_BASE}{addendum}\n\n{prompt}"):
            yield chunk
    else:
        async for chunk in _claude_stream(prompt, _SYSTEM_PROMPT_BASE + addendum):
            yield chunk
