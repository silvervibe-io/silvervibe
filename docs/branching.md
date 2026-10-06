# Branching

## Branches

| Branch | Purpose | Deploys to |
| --- | --- | --- |
| **`main`** | Stable public landing (and approved releases) | **Production** — `silvervibe.io` / Pages production |
| **`develop`** | Day-to-day work, experiments, new routes | **Preview only** (Cloudflare PR / branch previews) |

Do **not** push unfinished app work to `main`. Freeze the public landing until you
intentionally ship a landing change via PR into `main`.

## Workflow

```bash
git checkout develop
git pull origin develop
# work here…
git checkout -b feature/my-change
# commit, push feature branch, open PR → develop
# when ready for production:
#   PR develop → main  (or cherry-pick / release PR)
```

1. Create / update features on **`develop`** (or `feature/*` → `develop`).
2. Keep **`main`** matching what visitors see on silvervibe.io.
3. Landing page (`apps/silvervibe` home) — no drive-by edits on `main`. Change it only when you mean to ship it.
4. New **routes / screens** — add them on `develop`. Do not link them from the public landing until the feature is ready. Prefer lazy routes and no nav until launch.
5. Unknown URLs on the public app should fall back to the landing (see `app.routes.ts`).

## Cloudflare Pages

- **Production branch:** `main`
- **Preview deployments:** enable for `develop` and/or pull requests
- Build settings stay the same; only the branch changes what goes live on the custom domain

## Why

Open-source visitors and `silvervibe.io` should see a calm landing, while you
iterate on tools (e.g. VibeStandup) without exposing WIP URLs or half-built UI.
