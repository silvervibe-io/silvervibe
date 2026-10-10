# Local development

How to run Silver Vibe from a fresh clone. Work happens on **`develop`**;
**`main`** is the public landing — see [branching.md](./branching.md).

## Prerequisites

| Tool        | Requirement                                                                                             |
| ----------- | ------------------------------------------------------------------------------------------------------- |
| **Node.js** | `24.15.0` preferred (see [`.nvmrc`](../.nvmrc)); also `^22.22.3` or `>=26` per `package.json` `engines` |
| **npm**     | `>=10` (ships with Node)                                                                                |
| **Git**     | current                                                                                                 |

Optional later (not needed for landing + API health):

| Tool                                                              | When                                                                                                                  |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Neon `DATABASE_URL`                                               | Real DB — [docs/neon.md](./neon.md)                                                                                   |
| Firebase Auth keys                                                | Auth — [docs/firebase.md](./firebase.md) ([issue #5](https://github.com/silvervibe-io/silvervibe/issues/5))           |
| GrowthBook keys                                                   | Live flags — [docs/growthbook.md](./growthbook.md) ([issue #8](https://github.com/silvervibe-io/silvervibe/issues/8)) |
| **Python** `>=3.11,<3.14` + [uv](https://github.com/astral-sh/uv) | `apps/ai` only                                                                                                        |

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
database. Leave placeholder `DATABASE_URL` values until Neon is ready
([docs/neon.md](./neon.md)), then run `npm run prisma:ping` to verify.

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

| Check                        | URL                                                             |
| ---------------------------- | --------------------------------------------------------------- |
| Swagger                      | http://localhost:3000/api/docs                                  |
| Health                       | http://localhost:3000/api/health                                |
| Flags (static fallback OK)   | http://localhost:3000/api/flags/vibestandup                     |
| Me (dev bearer, no Firebase) | `Authorization: Bearer dev:demo` → http://localhost:3000/api/me |

Example:

```bash
curl -s http://localhost:3000/api/health
curl -s -H "Authorization: Bearer dev:demo" http://localhost:3000/api/me
```

Without Firebase Admin and outside production, Nest accepts `Bearer dev:<uid>`.
Without GrowthBook keys, OpenFeature uses in-memory defaults
(`tools.vibestandup.enabled` → true). See [growthbook.md](./growthbook.md).
`npm run growthbook:check` / `npm run firebase:sync-web` (syncs Angular env).

Angular apps proxy `/api` to the Nest server when configured
(`apps/silvervibe/proxy.conf.json`).

## Other apps

```bash
npm start vibestandup   # http://localhost:4201
npm start ai            # http://localhost:8000/health (Python / uv)
```

## Common scripts

| Script                                                      | Purpose                                           |
| ----------------------------------------------------------- | ------------------------------------------------- |
| `npm ci`                                                    | Clean install + Prisma generate                   |
| `npm run prisma:generate`                                   | Regenerate client                                 |
| `npm run prisma:migrate`                                    | Create/apply migrations locally (needs Neon URLs) |
| `npm run prisma:migrate:deploy`                             | Apply committed migrations (CI / shared DB)       |
| `npm run prisma:ping`                                       | Connect + verify core tables                      |
| `npm run prisma:studio`                                     | Prisma Studio                                     |
| `npm run firebase:check`                                    | Report which Firebase env vars are set            |
| `npm run format` / `npm run format:check`                   | Prettier write / check                            |
| `npm run lint`                                              | ESLint (all projects)                             |
| `npm test` / `npm run test:silvervibe` / `npm run test:api` | Unit tests                                        |
| `npm run e2e:silvervibe`                                    | Playwright (starts silvervibe serve)              |
| `npm run build:silvervibe`                                  | Production build                                  |
| `npm run openapi`                                           | Write `openapi/silvervibe.openapi.json`           |
| `npx nx graph`                                              | Dependency graph                                  |

CI mirrors these checks on PRs to `develop` — see [ci.md](./ci.md).

## Environment variables

See [`.env.example`](../.env.example). Nest loads `.env` from the repo root via
`dotenv` in `apps/api/src/main.ts`.

Angular Firebase **web** values come from `.env` (`FIREBASE_API_KEY` …).
`npm start` / `npm run firebase:sync-web` generates gitignored
`firebase-web.local.ts` — do not commit keys into `environment.ts`.
Nest Admin credentials stay server-side only (see [firebase.md](./firebase.md)).

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
