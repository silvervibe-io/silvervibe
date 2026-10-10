---
name: platform-infra
description: Guides Silvervibe hosting and infra on Cloudflare Pages, Google Cloud Run, Firebase Auth, and Neon Postgres for silvervibe.io. Use when deploying, configuring DNS, auth, databases, or Cloud Run services.
---

# Platform infra

## Hosts

| Service | Host | Target |
| --- | --- | --- |
| Marketing / base app | `app.silvervibe.io` | Cloudflare Pages → `silvervibe` |
| Vibe Standup | `standup.silvervibe.io` | Cloudflare Pages → `vibestandup` |
| API | `api.silvervibe.io` | Cloud Run → `api` |
| AI | `ai.silvervibe.io` | Cloud Run → `ai` |

DNS and TLS stay on Cloudflare. Proxy API/AI CNAMEs to Cloud Run URLs.

## Auth

1. Firebase Auth issues ID tokens to Angular apps.
2. Nest validates tokens with Firebase Admin.
3. Upsert `users.firebase_uid` in Neon on first authenticated request.

## Deploy notes

- Pages: build with `nx build <app>`, publish `dist/apps/<app>/browser`.
- Cloud Run: containerize Nest (`apps/api/Dockerfile`, `docs/cloud-run.md`) and the FastAPI/uv AI service separately.
- Env templates: see `.env.example`.

## Cursor MCP

Authenticate Cloudflare, Neon, GrowthBook, and Firebase MCP servers after reload when first using them.
