"""HTTP entrypoint for the LangGraph service."""

from fastapi import FastAPI
from pydantic import BaseModel, Field

from ai.graphs.echo import build_echo_graph
from ai.graphs.standup_summary import StandupEntry, build_standup_summary_graph

app = FastAPI(title="Silvervibe AI", version="0.0.1")
echo_graph = build_echo_graph()
standup_summary_graph = build_standup_summary_graph()


class EchoRequest(BaseModel):
    message: str = Field(min_length=1)


class EchoResponse(BaseModel):
    message: str


class StandupEntryIn(BaseModel):
    display_name: str = Field(min_length=1)
    yesterday: str | None = None
    today: str | None = None
    blockers: str | None = None


class StandupSummaryRequest(BaseModel):
    team_name: str = Field(min_length=1)
    entry_date: str = Field(min_length=1, description="YYYY-MM-DD")
    entries: list[StandupEntryIn] = Field(default_factory=list)


class StandupSummaryResponse(BaseModel):
    markdown: str
    used_llm: bool = False


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/graphs/echo", response_model=EchoResponse)
def run_echo(body: EchoRequest) -> EchoResponse:
    result = echo_graph.invoke({"message": body.message})
    return EchoResponse(message=result["message"])


@app.post("/graphs/standup-summary", response_model=StandupSummaryResponse)
def run_standup_summary(body: StandupSummaryRequest) -> StandupSummaryResponse:
    entries: list[StandupEntry] = [
        {
            "display_name": entry.display_name,
            "yesterday": entry.yesterday,
            "today": entry.today,
            "blockers": entry.blockers,
        }
        for entry in body.entries
    ]
    result = standup_summary_graph.invoke(
        {
            "team_name": body.team_name,
            "entry_date": body.entry_date,
            "entries": entries,
        }
    )
    return StandupSummaryResponse(
        markdown=result.get("markdown") or "",
        used_llm=bool(result.get("used_llm")),
    )
