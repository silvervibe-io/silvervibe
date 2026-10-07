# Neon Postgres (local / foundation)

Issue: [#3](https://github.com/silvervibe-io/silvervibe/issues/3). Migrations are [#4](https://github.com/silvervibe-io/silvervibe/issues/4).

## Create the project (console)

1. Sign in at [console.neon.tech](https://console.neon.tech) with the account that owns **silvervibe-io** (same ownership as GitHub / domain when possible).
2. **New project**
   - Name: `silvervibe`
   - Region: pick one close to you (e.g. Frankfurt / London for EU)
3. If Neon shows a long “Set up this Neon project…” wizard (`neon login`, `neon.ts`, `neon deploy`):
   **skip it for now.** This monorepo uses **Prisma + Nest**, not Neon’s `neon.ts` policy deploy flow.
   Optional later: `neon login` + `neon link` for CLI/MCP only (still no need for `neon config init` / `neon deploy` until we adopt that tooling).
4. Open the project → **Dashboard** → **Connection details**
5. Copy two URIs:

| Env var | Neon connection |
| --- | --- |
| `DATABASE_URL` | **Pooled** connection string (PgBouncer / `-pooler` host) |
| `DATABASE_URL_UNPOOLED` | **Direct** connection string (no pooler) |

Both usually include `?sslmode=require`.

## Wire locally

```bash
cp .env.example .env   # if you do not have .env yet
```

Edit `.env` and paste the two URLs. **Never commit `.env`.**

## Verify Prisma can connect

From the repo root (with `DATABASE_URL` set):

```bash
npm run prisma:generate
npx prisma db execute --stdin --schema=libs/shared/data-access/prisma/schema.prisma <<< "SELECT 1;"
```

On Windows PowerShell:

```powershell
npm run prisma:generate
"SELECT 1;" | npx prisma db execute --stdin --schema=libs/shared/data-access/prisma/schema.prisma
```

Or use the helper:

```bash
npm run prisma:ping
```

Success = no auth/connection error. Schema apply happens in issue #4 (`prisma migrate`).

## Neon CLI (optional)

```bash
npx neonctl auth
npx neonctl projects list
npx neonctl connection-string <branch> --project-id <id> --pooled
```

## Branches (Neon)

- Keep a **development** (or `dev`) Neon branch for local work.
- Keep **production** for Cloud Run later (issue #10).
- Do not point local `.env` at production.

## Checklist (acceptance #3)

- [ ] Neon project `silvervibe` exists under the correct account
- [ ] `DATABASE_URL` + `DATABASE_URL_UNPOOLED` in local `.env`
- [ ] `npm run prisma:ping` succeeds
- [ ] No secrets committed to git
