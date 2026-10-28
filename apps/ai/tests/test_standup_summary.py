from fastapi.testclient import TestClient

from ai.graphs.standup_summary import (
    build_standup_summary_graph,
    draft_markdown,
    polish_with_llm,
)
from ai.main import app

client = TestClient(app)


def test_draft_markdown_groups_by_section() -> None:
    result = draft_markdown(
        {
            "team_name": "Alpha",
            "entry_date": "2026-10-27",
            "entries": [
                {
                    "display_name": "Ada",
                    "yesterday": "OAuth",
                    "today": "Digests",
                    "blockers": None,
                },
                {
                    "display_name": "Bob",
                    "yesterday": None,
                    "today": "Review",
                    "blockers": "Waiting on key",
                },
            ],
        }
    )

    markdown = result["markdown"]
    assert "## Alpha standup — 2026-10-27" in markdown
    assert "### Today" in markdown
    assert "**Ada**: Digests" in markdown
    assert "**Bob**: Review" in markdown
    assert "### Blockers" in markdown
    assert "**Bob**: Waiting on key" in markdown
    assert "### Yesterday" in markdown
    assert result["used_llm"] is False


def test_graph_empty_entries() -> None:
    graph = build_standup_summary_graph()
    result = graph.invoke(
        {"team_name": "Alpha", "entry_date": "2026-10-27", "entries": []}
    )
    assert result["markdown"] == "No submitted standups for this day yet."


def test_polish_without_gemini_key_keeps_draft(
    monkeypatch: object,
) -> None:
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.delenv("GOOGLE_API_KEY", raising=False)
    monkeypatch.delenv("GOOGLE_AI_API_KEY", raising=False)

    result = polish_with_llm(
        {
            "team_name": "Alpha",
            "entry_date": "2026-10-27",
            "entries": [{"display_name": "Ada", "today": "Ship"}],
            "draft_markdown": "## draft",
            "markdown": "## draft",
        }
    )

    assert result["markdown"] == "## draft"
    assert result["used_llm"] is False


def test_http_standup_summary() -> None:
    response = client.post(
        "/graphs/standup-summary",
        json={
            "team_name": "Alpha",
            "entry_date": "2026-10-27",
            "entries": [
                {
                    "display_name": "Ada",
                    "today": "Ship AI summaries",
                    "yesterday": "Jira OAuth",
                    "blockers": "",
                }
            ],
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert "Ship AI summaries" in body["markdown"]
    assert body["used_llm"] is False
