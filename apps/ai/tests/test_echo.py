from fastapi.testclient import TestClient

from ai.graphs.echo import build_echo_graph
from ai.main import app

client = TestClient(app)


def test_echo_graph_returns_the_message() -> None:
    graph = build_echo_graph()

    result = graph.invoke({"message": "hello"})

    assert result["message"] == "hello"


def test_health() -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
