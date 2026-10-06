---
name: langgraph-ai
description: Implements Python LangGraph graphs and FastAPI routes in apps/ai. Use when the user mentions LangGraph, AI services, agents, or the Python app.
---

# LangGraph AI service

- Package manager is uv. Python range is `>=3.11,<3.14`.
- Add a graph under `apps/ai/src/ai/graphs/<name>.py` with a typed state and a compiled `StateGraph`.
- Expose it from a FastAPI route in `apps/ai/src/ai/main.py`. Return JSON the Nest API or Angular apps can call.
- Dependencies: `npx nx run ai:add --args=langgraph`.
- Tests live next to the graph in `apps/ai/tests` and run with `npx nx test ai`.
- Do not call Slack, Teams, Jira, or Linear from Python. Those add-ons stay in NestJS. Python returns model output only.
