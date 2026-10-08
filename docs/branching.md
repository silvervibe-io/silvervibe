# Branching

## Long-lived branches

| Branch        | Purpose                                       | Deploys to                       |
| ------------- | --------------------------------------------- | -------------------------------- |
| **`main`**    | Stable public landing (and approved releases) | **Production** — `silvervibe.io` |
| **`develop`** | Integration branch for finished issue PRs     | **Preview** (Pages previews)     |

Do **not** push unfinished work to `main`. Do **not** commit issue work directly on
`develop` — use a short-lived issue branch (below), then open a PR into `develop`.

## Issue branch naming

Every GitHub issue gets its own branch, cut from an up-to-date **`develop`**.

### Pattern

```text
{type}/{number}-{short-kebab-slug}
```

| `{type}`       | Use when                                        |
| -------------- | ----------------------------------------------- |
| **`feature/`** | New capability, foundation work, enhancements   |
| **`bugfix/`**  | Fixing a defect                                 |
| **`docs/`**    | Documentation-only changes                      |
| **`chore/`**   | Tooling, CI, repo process (no product behavior) |

- **`{number}`** — GitHub issue number (required).
- **`{short-kebab-slug}`** — 2–5 words from the issue title, lowercase, hyphens only.

### Examples

| Issue                        | Branch                         |
| ---------------------------- | ------------------------------ |
| #3 Provision Neon Postgres…  | `feature/3-neon-postgres`      |
| #1 Document local developer… | `docs/1-local-dev-environment` |
| #11 CI checks on develop…    | `chore/11-ci-develop-previews` |
| Bug: landing mailto broken   | `bugfix/12-info-email-routing` |

### Workflow

```bash
git checkout develop
git pull origin develop
git checkout -b feature/3-neon-postgres

# …commits referencing the issue: "Fix … (#3)" or "Refs #3"…

git push -u origin HEAD
gh pr create --base develop --title "…" --body "Closes #3"
```

1. Branch from **`develop`**, never from `main`, for issue work.
2. One primary issue per branch (split if the PR grows too large).
3. PR target is **`develop`**. Merge (or squash) when green.
4. Promote to production with a deliberate **`develop` → `main`** PR (landing/API
   releases only when you intend to ship).
5. After merge, delete the issue branch.

### Agents / Cursor

Follow this naming and always start issue work on a new branch from `develop`.
See `.cursor/rules/branching.mdc` and the `silvervibe-nx` skill.

## Landing & routes

1. Keep **`main`** matching what visitors see on silvervibe.io.
2. Landing page — no drive-by edits on `main`. Ship landing changes only when intended.
3. New routes/screens — add on an issue branch → `develop`. Do not link them from
   the public landing until ready.
4. Unknown URLs on the public app fall back to the landing (`app.routes.ts`).

## Cloudflare Pages

- **Production branch:** `main`
- **Preview deployments:** `develop` and/or pull requests
- Build settings stay the same; only the branch changes what goes live on the custom domain

GitHub Actions CI (lint, format, build, tests, e2e, CodeQL) is described in [ci.md](./ci.md).
