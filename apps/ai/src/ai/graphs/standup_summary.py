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


def _openai_key() -> str | None:
    key = os.environ.get("OPENAI_API_KEY", "").strip()
    return key or None


def route_after_draft(state: StandupSummaryState) -> str:
    if _openai_key() and (state.get("entries") or []):
        return "polish"
    return "done"


def polish_with_llm(state: StandupSummaryState) -> StandupSummaryState:
    """Optional OpenAI rewrite; keeps draft on any failure."""
    api_key = _openai_key()
    draft = state.get("draft_markdown") or state.get("markdown") or ""
    if not api_key or not draft:
        return {**state, "markdown": draft, "used_llm": False}

    model = os.environ.get("OPENAI_MODEL", "gpt-4o-mini").strip() or "gpt-4o-mini"
    system = (
        "You rewrite daily standup digests for engineering teams. "
        "Keep markdown. Preserve every person's facts and names. "
        "Be concise. Do not invent work. Keep the Today / Blockers / Yesterday "
        "structure when those sections have content."
    )
    payload = {
        "model": model,
        "temperature": 0.2,
        "messages": [
            {"role": "system", "content": system},
            {
                "role": "user",
                "content": (
                    f"Team: {state['team_name']}\n"
                    f"Date: {state['entry_date']}\n\n"
                    f"Draft digest:\n{draft}"
                ),
            },
        ],
    }

    try:
        response = httpx.post(
            "https://api.openai.com/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            content=json.dumps(payload),
            timeout=20.0,
        )
        response.raise_for_status()
        data = response.json()
        content = (
            data.get("choices", [{}])[0]
            .get("message", {})
            .get("content", "")
        )
        polished = (content or "").strip()
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
