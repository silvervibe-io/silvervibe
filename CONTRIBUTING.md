# Contributing

Silver Vibe is a **personal open-source project**. Contributions are welcome
as the public roadmap matures.

## Ground rules

1. Open an issue before large changes.
2. Work on **`develop`** (or `feature/*` → `develop`). Keep **`main`** for the stable public landing — see [docs/branching.md](./docs/branching.md).
3. Keep secrets out of PRs (no `.env`, keys, or service accounts).
4. Follow existing Nx / Angular / Nest patterns in the repo.
5. Do not add branding that conflicts with [TRADEMARKS.md](./TRADEMARKS.md).
6. By contributing, you agree your code is licensed under the [MIT License](./LICENSE)
   and that you have the right to submit it.

## Local setup

1. Use **Node.js 24.15.0** (`.nvmrc`) or an `engines`-compatible version.
2. Check out **`develop`**.
3. Install and run:

```bash
npm ci
cp .env.example .env
npm start silvervibe
```

4. API (optional second terminal): `npm start api` → http://localhost:3000/api/health

Details: [docs/local-dev.md](./docs/local-dev.md). Also
[README.md](./README.md), [docs/go-live.md](./docs/go-live.md), and
[docs/legal.md](./docs/legal.md).
