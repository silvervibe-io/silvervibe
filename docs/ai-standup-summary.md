# AI standup summaries

Issue: [#119](https://github.com/silvervibe-io/silvervibe/issues/119)

## What it does

1. On standup submit / Rebuild, Nest builds a classic per-person markdown
   fallback, then asks LangGraph (`PUBLIC_AI_URL`) for a team digest.
2. The AI graph groups **Today / Blockers / Yesterday**. If `OPENAI_API_KEY` is
   set on the AI service, it optionally polishes that draft with OpenAI.
3. Digests (Slack / Linear / GitHub / Jira) post the resulting markdown. AI
   failures soft-fall back to classic markdown.

## Setup

| Env                  | Where                           | Notes                                                      |
| -------------------- | ------------------------------- | ---------------------------------------------------------- |
| `PUBLIC_AI_URL`      | Nest (local `.env` / Cloud Run) | e.g. `http://localhost:8000` or `https://ai.silvervibe.io` |
| `AI_STANDUP_SUMMARY` | Nest                            | Opt-in: `true` / `1` / `on` to call LangGraph              |
| `OPENAI_API_KEY`     | AI Cloud Run / local AI process | Optional LLM polish                                        |
| `OPENAI_MODEL`       | AI (optional)                   | Default `gpt-4o-mini`                                      |

Local:

```bash
npm start ai
# In .env: AI_STANDUP_SUMMARY=true  (PUBLIC_AI_URL already defaults to :8000)
```

Smoke the graph:

```bash
curl -s http://localhost:8000/graphs/standup-summary \
  -H 'Content-Type: application/json' \
  -d '{"team_name":"Alpha","entry_date":"2026-10-27","entries":[{"display_name":"Ada","today":"Ship summaries"}]}'
```

## API

| Method | Path                      | Notes                                                                   |
| ------ | ------------------------- | ----------------------------------------------------------------------- |
| `POST` | `/graphs/standup-summary` | Body: `team_name`, `entry_date`, `entries[]` → `{ markdown, used_llm }` |

## Out of scope

- Streaming chat UI
- Creating tracker issues from blockers
- Microsoft Teams (deferred)
