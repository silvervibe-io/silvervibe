# Silvervibe platform

Domain: **silvervibe.io** (Cloudflare DNS).

Silver Vibe is a **personal open-source** project (MIT source license; trademarks
separate — see [legal.md](./legal.md)).

## Architecture

```text
Angular apps  →  Cloudflare Pages
      │
      │  Firebase Auth ID token
      ▼
Nest API      →  Cloud Run  →  Neon Postgres (Prisma)
      │                         ├ users (firebase_uid)
      │                         ├ workspaces
OpenFeature   →  GrowthBook     ├ workspace_tools (entitlements)
      │                         └ addon_connections
      ▼
LangGraph AI  →  Cloud Run
```

## Hostnames

| Host | Service |
| --- | --- |
| `silvervibe.io` / `www` | `silvervibe` (Cloudflare Pages) |
| `standup.silvervibe.io` | `vibestandup` (Pages, later) |
| `api.silvervibe.io` | Nest `api` (Cloud Run) |
| `ai.silvervibe.io` | LangGraph `ai` (Cloud Run) |

First deploy steps: [go-live.md](./go-live.md). Neon setup: [neon.md](./neon.md).

## Code map

| Concern | Location |
| --- | --- |
| Prisma schema | `libs/shared/data-access/prisma/schema.prisma` |
| Entitlement helpers | `@silvervibe/shared/data-access` |
| Flag / tool keys | `@silvervibe/shared/feature-flags` |
| Angular Auth + OpenFeature client | `@silvervibe/shared/auth` |
| Nest Firebase guard / `/api/me` | `apps/api/src/app/auth`, `users` |
| Nest OpenFeature | `apps/api/src/app/feature-flags` |

## Feature access

1. **Entitlements** in Neon (`workspace_tools`) — which tools a workspace owns.
2. **OpenFeature + GrowthBook** — rollout, experiments, kill switches.
3. Without GrowthBook keys, API/apps use static in-memory defaults (vibestandup on).
4. Without Firebase Admin, API accepts `Authorization: Bearer dev:<uid>` in non-production.

## Local env

Full guide: [local-dev.md](./local-dev.md).

```bash
cp .env.example .env
npm run prisma:generate
# when Neon is ready:
# npm run prisma:migrate
```

Fill Neon, Firebase, and GrowthBook values when accounts exist.

## API smoke

- `GET /api/health`
- `GET /api/flags/vibestandup`
- `GET /api/me` with `Authorization: Bearer dev:demo`
