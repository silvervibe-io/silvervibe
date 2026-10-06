---
name: neon-data
description: Designs and migrates Neon Postgres schema with Prisma for Silvervibe users, workspaces, tool entitlements, and add-on connections. Use when changing the database, Prisma schema, or data-access libraries.
---

# Neon data

## Schema sketch

- `User`: id, firebaseUid, email, createdAt
- `Workspace`: id, name, slug, createdAt
- `WorkspaceMember`: workspaceId, userId, role
- `WorkspaceTool`: workspaceId, toolKey (`vibestandup`, `addons.github`, …), enabled
- `AddonConnection`: workspaceId, provider, status, encrypted secrets ref

## Commands (once Prisma is added)

```bash
npx prisma migrate dev
npx prisma generate
```

Use the Neon MCP to inspect branches and connection strings. Prefer a develop branch for local work.
