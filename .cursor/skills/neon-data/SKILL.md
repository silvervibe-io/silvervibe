---
name: neon-data
description: Designs and migrates Neon Postgres schema with Prisma for Silvervibe users, workspaces, tool entitlements, and add-on connections. Use when changing the database, Prisma schema, or data-access libraries.
---

# Neon data

## Git

Neon / Prisma work ships on an issue branch from `develop`, e.g. `feature/3-neon-postgres`. Never commit `DATABASE_URL` or `.env`. See `docs/branching.md`.

## Schema sketch

- `User`: id, firebaseUid, email, createdAt
- `Workspace`: id, name, slug, createdAt
- `WorkspaceMember`: workspaceId, userId, role
- `WorkspaceTool`: workspaceId, toolKey (`vibestandup`, `addons.github`, …), enabled
- `AddonConnection`: workspaceId, provider, status, encrypted secrets ref

## Provisioning (foundation)

1. Create a Neon project (owner aligned with silvervibe-io).
2. Copy **pooled** URI → `DATABASE_URL` and **direct/unpooled** → `DATABASE_URL_UNPOOLED` in local `.env` (from `.env.example`).
3. Confirm connectivity with `npm run prisma:ping`, then apply migrations (`npm run prisma:migrate` locally or `npm run prisma:migrate:deploy` in CI).
4. Document steps in `docs/neon.md`; never commit secrets.

## Commands

```bash
npm run prisma:generate
npm run prisma:migrate          # local: create + apply
npm run prisma:migrate:deploy  # CI / shared Neon: apply committed only
npm run prisma:ping
npm run prisma:studio
```

Schema path: `libs/shared/data-access/prisma/schema.prisma`  
(`url` = pooled `DATABASE_URL`, `directUrl` = `DATABASE_URL_UNPOOLED`).

Use the Neon MCP or console for branches and connection strings. Prefer a Neon **development** branch for local work; keep production separate.
