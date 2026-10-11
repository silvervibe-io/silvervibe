# LangGraph AI image for Google Cloud Run.
# Build from the repo root:
#   npx nx run ai:docker:build
#
# Local smoke (Docker Desktop must be running):
#   docker run --rm -p 8080:8080 silvervibe-ai
#   curl -s http://localhost:8080/health

FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim

ENV UV_COMPILE_BYTECODE=1
ENV UV_LINK_MODE=copy
ENV HOST=0.0.0.0
ENV PORT=8080

WORKDIR /app

COPY pyproject.toml uv.lock ./
COPY src ./src

RUN uv sync --frozen --no-dev \
  && useradd --create-home --uid 10001 appuser \
  && chown -R appuser:appuser /app

USER appuser
EXPOSE 8080

CMD ["sh", "-c", "uv run uvicorn ai.main:app --host 0.0.0.0 --port ${PORT:-8080} --app-dir src"]
