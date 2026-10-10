# Silvervibe — Copilot code review

## Purpose

Guide Copilot **code review on pull requests**. Prefer **few, high-value comments**.
CI already runs Format, Lint, Unit tests, Build, E2E, and CodeQL — do not duplicate them.

## When to comment

Leave a comment **only** if you find one of these:

- Likely **bug** or incorrect runtime behavior
- **Security / privacy** issue (secrets in source, auth bypass, XSS, injection, unsafe HTML)
- Broken API / DB **contract** (wrong types, missing null checks that will throw, Prisma misuse)
- Clear **data-loss** or incorrect state mutation risk

If none of the above apply, **submit the review with no line comments**.

## Do not comment on

- Formatting, Prettier, import order, whitespace, or ESLint style (CI Format / Lint)
- Naming or “readability” nits that are not bugs
- Refactors or alternate implementations when the change is already correct
- Missing docs / comments on obvious code
- Test coverage nits on docs-only or CI/chore PRs
- Unused-looking imports that TypeScript/ESLint would already catch unless they cause a real bug
- Suggestions that conflict with intentional monorepo patterns (see below)

## Intentional patterns (do not flag)

- Angular: standalone components, `inject()`, signals / `computed`, `@if` / `@for` / `@switch`, `ChangeDetectionStrategy.OnPush`, `@silvervibe/*` path aliases
- Nest: modules under `apps/api`, add-ons under `apps/api/src/app/addons/`
- Prisma: `@@map` snake_case tables, `firebase_uid`, `workspace_tools`, pooled `DATABASE_URL` + `directUrl`
- Auth: `Bearer dev:<uid>` allowed **outside production** when Firebase Admin is unset
- Git: issue branches `{type}/{n}-slug` → PRs to **`develop`** (not `main` for WIP)

## Comment style

- One comment per real issue; do not repeat the same nit across files
- Be specific and actionable; explain the failure mode briefly
- If uncertain whether something is a bug, **do not comment**
