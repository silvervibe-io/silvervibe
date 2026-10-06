"""Minimal LangGraph used as the integration point for later agents."""

from typing import TypedDict

from langgraph.graph import END, START, StateGraph


class EchoState(TypedDict):
    message: str


def echo(state: EchoState) -> EchoState:
    return {"message": state["message"]}


def build_echo_graph():
    graph = StateGraph(EchoState)
    graph.add_node("echo", echo)
    graph.add_edge(START, "echo")
    graph.add_edge("echo", END)
    return graph.compile()
