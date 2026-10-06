"""HTTP entrypoint for the LangGraph service."""

from fastapi import FastAPI
from pydantic import BaseModel, Field

from ai.graphs.echo import build_echo_graph

app = FastAPI(title="Silvervibe AI", version="0.0.1")
echo_graph = build_echo_graph()


class EchoRequest(BaseModel):
    message: str = Field(min_length=1)


class EchoResponse(BaseModel):
    message: str


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/graphs/echo", response_model=EchoResponse)
def run_echo(body: EchoRequest) -> EchoResponse:
    result = echo_graph.invoke({"message": body.message})
    return EchoResponse(message=result["message"])
