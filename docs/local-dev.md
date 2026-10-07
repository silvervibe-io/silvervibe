# Local development

How to run Silver Vibe from a fresh clone. Work happens on **`develop`**;
**`main`** is the public landing — see [branching.md](./branching.md).

## Prerequisites

| Tool | Requirement |
| --- | --- |
| **Node.js** | `24.15.0` preferred (see [`.nvmrc`](../.nvmrc)); also `^22.22.3` or `>=26` per `package.json` `engines` |
| **npm** | `>=10` (ships with Node) |
| **Git** | current |

Optional later (not needed for landing + API health):

| Tool | When |
| --- | --- |
| Neon `DATABASE_URL` | Prisma migrate / real DB ([issue #3](https://github.com/silvervibe-io/silvervibe/issues/3)) |
| Firebase / GrowthBook keys | Auth & live flags |
| **Python** `>=3.11,<3.14` + [uv](https://github.com/astral-sh/uv) | `apps/ai` only |

## First-time setup

```bash
git clone https://github.com/silvervibe-io/silvervibe.git
cd silvervibe
git checkout develop
# Issue work: git checkout -b feature/<n>-<slug>   (see docs/branching.md)

# Node 24.15 if you use nvm / fnm / asdf
nvm install   # or: fnm use / asdf install
nvm use

npm ci
cp .env.example .env
```

`npm ci` runs `postinstall` → `prisma generate`. That does **not** need a live
database. Leave placeholder `DATABASE_URL` values until Neon is ready.

Never commit `.env`.

## Run the landing (silvervibe)

```bash
npm start
# or: npm start silvervibe
```

Open http://localhost:4200 — public landing page.

## Run the API

In a second terminal:

```bash
npm start api
```

| Check | URL |
| --- | --- |
| Swagger | http://localhost:3000/api/docs |
| Health | http://localhost:3000/api/health |
| Flags (static fallback OK) | http://localhost:3000/api/flags/vibestandup |
| Me (dev bearer, no Firebase) | `Authorization: Bearer dev:demo` → http://localhost:3000/api/me |

Example:

```bash
curl -s http://localhost:3000/api/health
curl -s -H "Authorization: Bearer dev:demo" http://localhost:3000/api/me
```

Without Firebase Admin and outside production, Nest accepts `Bearer dev:<uid>`.
Without GrowthBook keys, OpenFeature uses in-memory defaults.

Angular apps proxy `/api` to the Nest server when configured
(`apps/silvervibe/proxy.conf.json`).

## Other apps

```bash
npm start vibestandup   # http://localhost:4201
npm start ai            # http://localhost:8000/health (Python / uv)
```

## Common scripts

| Script | Purpose |
| --- | --- |
| `npm ci` | Clean install + Prisma generate |
| `npm run prisma:generate` | Regenerate client |
| `npm run prisma:migrate` | Apply migrations (needs real `DATABASE_URL`) |
| `npm run prisma:studio` | Prisma Studio |
| `npm test` / `npm run test:silvervibe` / `npm run test:api` | Unit tests |
| `npm run e2e:silvervibe` | Playwright (starts silvervibe serve) |
| `npm run build:silvervibe` | Production build |
| `npm run openapi` | Write `openapi/silvervibe.openapi.json` |
| `npx nx graph` | Dependency graph |

## Environment variables

See [`.env.example`](../.env.example). Nest loads `.env` from the repo root via
`dotenv` in `apps/api/src/main.ts`.

Angular Firebase / GrowthBook values also live in
`apps/*/src/environments/environment*.ts` for the client (fill when accounts
exist — issues #5 / #8).

## Smoke checklist (acceptance for foundation #1)

1. `npm ci` completes.
2. `npm start silvervibe` → landing loads on :4200.
3. `npm start api` → `GET /api/health` returns OK.
4. Optional: `npm run test:silvervibe` and `npm run e2e:silvervibe` pass.

## Troubleshooting

- **Node engine warnings / failed Pages builds** — use Node **24.15.0** (or a
  version that satisfies `engines` in `package.json`).
- **`npm ci` lockfile errors** — do not hand-edit `package-lock.json`; run
  `npm install` on an allowed Node version and commit the lockfile on `develop`.
- **Prisma generate fails** — schema path is
  `libs/shared/data-access/prisma/schema.prisma`.
- **API 401 on `/api/me`** — use `Authorization: Bearer dev:your-id` until
  Firebase Admin is configured.
- **Windows EPERM on esbuild** — stop other Node processes (`serve` / IDE
  watchers) and retry.
