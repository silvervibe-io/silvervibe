---
name: github-copilot-review
description: Maintains GitHub Copilot code-review custom instructions so PR reviews stay high-signal and low-noise. Use when editing Copilot review behavior, reducing Copilot PR comments, or updating .github/copilot-instructions.md.
---

# GitHub Copilot code review instructions

## Goal

Fewer, higher-value Copilot comments on PRs. Style and format are covered by CI
(Format, Lint, CodeQL) — Copilot should focus on bugs and security.

## Files Copilot reads (from the PR **head** branch)

| File | Role |
| --- | --- |
| `.github/copilot-instructions.md` | Repo-wide review rules (keep short) |
| `.github/instructions/*.instructions.md` | Path-specific (`applyTo` frontmatter) |
| `AGENTS.md` | Extra agent/repo context (Nx notes; keep review rules in `.github/`) |

## Rules of thumb when editing

1. Prefer **imperative bullets**: “Do not comment on…”, “Only comment when…”.
2. Keep each file short; avoid vague lines (“be accurate”, “find all issues”).
3. Do **not** instruct Copilot to change comment formatting, emoji, or PR overview UX — unsupported.
4. Align with Cursor skills (angular-ui, neon-data, git-issue-branches, platform-infra) but **do not paste entire skills** into Copilot files — distill into review do/don'ts.
5. After changing instructions, open or update a PR and request Copilot review to validate noise level.

## Enable in GitHub (once)

Repo → **Settings → Copilot → Code review** → ensure  
**“Use custom instructions when reviewing pull requests”** is **on**.

Automatic reviews still come from the branch ruleset  
(“Automatically request Copilot code review” on `develop` / `main`).
