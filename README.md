# Silver Vibe

**Silver Vibe** is a personal open-source project exploring calmer, more
flexible ways for remote teams to work asynchronously — without unnecessary
meetings.

- **Site:** [silvervibe.io](https://silvervibe.io)
- **Org:** [github.com/silvervibe-io](https://github.com/silvervibe-io)
- **License:** [MIT](./LICENSE) (source code)
- **Trademarks:** [TRADEMARKS.md](./TRADEMARKS.md) — _Silver Vibe™_, _VibeStandup™_, and related marks are **not** licensed under MIT

This monorepo is early / in development. Product names such as **VibeStandup™**
may appear in the codebase before they are publicly launched.

## Projects

| Project     | Start                                 | Test                       | Build                       | URL                            |
| ----------- | ------------------------------------- | -------------------------- | --------------------------- | ------------------------------ |
| silvervibe  | `npm start` or `npm start silvervibe` | `npm run test:silvervibe`  | `npm run build:silvervibe`  | http://localhost:4200          |
| vibestandup | `npm start vibestandup`               | `npm run test:vibestandup` | `npm run build:vibestandup` | http://localhost:4201          |
| api         | `npm start api`                       | `npm run test:api`         | `npm run build:api`         | http://localhost:3000/api/docs |
| ai          | `npm start ai`                        | `npm run test:ai`          | —                           | http://localhost:8000/health   |
| ui          | —                                     | `npm run test:ui`          | —                           | —                              |

`npm start` serves silvervibe. Start the API with `npm start api` when you need
`/api` proxy and Swagger. Use `npm test` / `npm run build` for all projects,
`npm run openapi` for `openapi/silvervibe.openapi.json`, and
`npm run e2e:silvervibe` / `npm run e2e:vibestandup` for Playwright.

## Platform

Target stack for **silvervibe.io**: Cloudflare Pages (apps), Cloud Run (API + AI),
Firebase Auth, Neon Postgres, OpenFeature + GrowthBook.

- [docs/local-dev.md](docs/local-dev.md) — clone, Node version, run landing + API
- [docs/neon.md](docs/neon.md) — Neon Postgres + `DATABASE_URL`
- [docs/firebase.md](docs/firebase.md) — Firebase Auth web + Admin
- [docs/platform.md](docs/platform.md) — architecture
- [docs/go-live.md](docs/go-live.md) — GitHub + Cloudflare deploy
- [docs/ops-followups.md](docs/ops-followups.md) — GrowthBook keys, live API, info@ mail
- [docs/ci.md](docs/ci.md) — GitHub Actions (format, lint, build, test, e2e, CodeQL)
- [docs/branching.md](docs/branching.md) — `main` (landing) vs `develop` (WIP)
- [docs/legal.md](docs/legal.md) — copyright, licenses, trademarks
- [.env.example](.env.example) — copy to `.env` (never commit `.env`)

## Legal & licenses

| File                                               | Purpose                               |
| -------------------------------------------------- | ------------------------------------- |
| [LICENSE](./LICENSE)                               | MIT license for **this** source code  |
| [NOTICE](./NOTICE)                                 | Copyright + trademark + SPDX summary  |
| [TRADEMARKS.md](./TRADEMARKS.md)                   | Brand policy + registration checklist |
| [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md) | Upstream dependency licenses          |
| [SECURITY.md](./SECURITY.md)                       | Vulnerability reporting               |
| [CONTRIBUTING.md](./CONTRIBUTING.md)               | Contribution basics                   |

**Silver Vibe™** and **VibeStandup™** are project names maintained by the
Silver Vibe / [silvervibe-io](https://github.com/silvervibe-io) project.
The code is open source under the [MIT License](./LICENSE); the **project
names, logos, and branding are not included in that license**. If you modify
or fork this software, you **must rename** your version and must not imply
endorsement. See [TRADEMARKS.md](./TRADEMARKS.md).

## Quick start

Requires **Node.js 24.15.0** (see `.nvmrc`) or another version allowed by
`package.json` `engines`. Day-to-day work: branch from **`develop`**.

```sh
git checkout develop
npm ci
cp .env.example .env
npm start silvervibe
```

In another terminal (API health):

```sh
npm start api
# http://localhost:3000/api/health
```

Full local guide: [docs/local-dev.md](docs/local-dev.md).

```sh
npx nx build silvervibe
npx nx show project silvervibe
npx nx graph
```
