"""LangGraph: turn submitted standup entries into team markdown."""

from __future__ import annotations

import json
import os
from typing import NotRequired, TypedDict

import httpx
from langgraph.graph import END, START, StateGraph


class StandupEntry(TypedDict):
    display_name: str
    yesterday: NotRequired[str | None]
    today: NotRequired[str | None]
    blockers: NotRequired[str | None]


class StandupSummaryState(TypedDict):
    team_name: str
    entry_date: str
    entries: list[StandupEntry]
    draft_markdown: NotRequired[str]
    markdown: NotRequired[str]
    used_llm: NotRequired[bool]


def _clean(value: str | None) -> str | None:
    if value is None:
        return None
    text = value.strip()
    return text or None


def _bullet_section(title: str, lines: list[str]) -> str | None:
    if not lines:
        return None
    return f"### {title}\n" + "\n".join(f"- {line}" for line in lines)


def draft_markdown(state: StandupSummaryState) -> StandupSummaryState:
    entries = state.get("entries") or []
    if not entries:
        empty = "No submitted standups for this day yet."
        return {**state, "draft_markdown": empty, "markdown": empty, "used_llm": False}

    today_lines: list[str] = []
    blocker_lines: list[str] = []
    yesterday_lines: list[str] = []

    for entry in entries:
        who = (entry.get("display_name") or "Member").strip() or "Member"
        today = _clean(entry.get("today"))
        blockers = _clean(entry.get("blockers"))
        yesterday = _clean(entry.get("yesterday"))
        if today:
            today_lines.append(f"**{who}**: {today}")
        if blockers:
            blocker_lines.append(f"**{who}**: {blockers}")
        if yesterday:
            yesterday_lines.append(f"**{who}**: {yesterday}")

    sections = [
        f"## {state['team_name']} standup — {state['entry_date']}",
        _bullet_section("Today", today_lines),
        _bullet_section("Blockers", blocker_lines),
        _bullet_section("Yesterday", yesterday_lines),
    ]
    draft = "\n\n".join(section for section in sections if section)
    return {**state, "draft_markdown": draft, "markdown": draft, "used_llm": False}


def _gemini_key() -> str | None:
    for name in ("GEMINI_API_KEY", "GOOGLE_API_KEY", "GOOGLE_AI_API_KEY"):
        key = os.environ.get(name, "").strip()
        if key:
            return key
    return None


def route_after_draft(state: StandupSummaryState) -> str:
    if _gemini_key() and (state.get("entries") or []):
        return "polish"
    return "done"


def polish_with_llm(state: StandupSummaryState) -> StandupSummaryState:
    """Optional Gemini rewrite; keeps draft on any failure."""
    api_key = _gemini_key()
    draft = state.get("draft_markdown") or state.get("markdown") or ""
    if not api_key or not draft:
        return {**state, "markdown": draft, "used_llm": False}

    model = (
        os.environ.get("GEMINI_MODEL", "").strip()
        or os.environ.get("GOOGLE_AI_MODEL", "").strip()
        or "gemini-2.0-flash"
    )
    system = (
        "You rewrite daily standup digests for engineering teams. "
        "Keep markdown. Preserve every person's facts and names. "
        "Be concise. Do not invent work. Keep the Today / Blockers / Yesterday "
        "structure when those sections have content."
    )
    user_text = (
        f"Team: {state['team_name']}\n"
        f"Date: {state['entry_date']}\n\n"
        f"Draft digest:\n{draft}"
    )
    payload = {
        "system_instruction": {"parts": [{"text": system}]},
        "contents": [{"role": "user", "parts": [{"text": user_text}]}],
        "generationConfig": {"temperature": 0.2},
    }
    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"{model}:generateContent"
    )

    try:
        response = httpx.post(
            url,
            headers={
                "x-goog-api-key": api_key,
                "Content-Type": "application/json",
            },
            content=json.dumps(payload),
            timeout=20.0,
        )
        response.raise_for_status()
        data = response.json()
        parts = (
            data.get("candidates", [{}])[0]
            .get("content", {})
            .get("parts", [])
        )
        polished = "".join(
            part.get("text", "") for part in parts if isinstance(part, dict)
        ).strip()
        if not polished:
            return {**state, "markdown": draft, "used_llm": False}
        return {**state, "markdown": polished, "used_llm": True}
    except Exception:
        return {**state, "markdown": draft, "used_llm": False}


def build_standup_summary_graph():
    graph = StateGraph(StandupSummaryState)
    graph.add_node("draft", draft_markdown)
    graph.add_node("polish", polish_with_llm)
    graph.add_edge(START, "draft")
    graph.add_conditional_edges(
        "draft",
        route_after_draft,
        {"polish": "polish", "done": END},
    )
    graph.add_edge("polish", END)
    return graph.compile()
