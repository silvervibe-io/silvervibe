---
name: git-issue-branches
description: Creates and names Silvervibe issue branches from develop and opens PRs into develop. Use when starting any GitHub issue, feature, bugfix, docs, or chore work.
---

# Issue branches

## Rule

Every GitHub issue → one short-lived branch from **`develop`**, PR back to **`develop`**.

## Name

```text
{type}/{number}-{short-kebab-slug}
```

| Type | When |
| --- | --- |
| `feature/` | Capabilities, foundation (auth, DB, flags, …) |
| `bugfix/` | Defects |
| `docs/` | Documentation only |
| `chore/` | CI, tooling, repo process |

Examples: `feature/3-neon-postgres`, `docs/1-local-dev-environment`.

## Start work

```bash
git checkout develop
git pull origin develop
git checkout -b feature/<n>-<slug>
```

Set the project board item to **In progress**. Commit messages should reference `#<n>`.

## Finish work

```bash
git push -u origin HEAD
gh pr create --base develop --title "…" --body "Closes #<n>"
```

After merge, delete the remote branch and set the project item to **Done**.

Full policy: `docs/branching.md`.
