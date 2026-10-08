# CI (GitHub Actions)

Issue: [#11](https://github.com/silvervibe-io/silvervibe/issues/11).

PRs targeting **`develop`** or **`main`**, and pushes to **`develop`**, run:

| Workflow / job      | What it checks                                               |
| ------------------- | ------------------------------------------------------------ |
| **CI → Format**     | `npm run format:check` (Prettier)                            |
| **CI → Lint**       | `nx run-many -t lint` (ESLint)                               |
| **CI → Unit tests** | `npm test`                                                   |
| **CI → Build**      | `npm run build` (`silvervibe`, `vibestandup`, `api`)         |
| **CI → E2E**        | Playwright Chromium for `silvervibe-e2e` + `vibestandup-e2e` |
| **CodeQL**          | Security + quality queries (`javascript-typescript`)         |

Workflows live in [`.github/workflows/`](../.github/workflows/).

## Local equivalents

```bash
npm run format:check
npm run lint
npm test
npm run build
npx playwright install chromium   # first time
npx nx e2e silvervibe-e2e -- --project=chromium
npx nx e2e vibestandup-e2e -- --project=chromium
```

Fix formatting with `npm run format`.

## Cloudflare Pages previews

GitHub Actions does **not** deploy Pages. Cloudflare Pages (connected to this repo) should:

| Branch / event                    | Deploy                     |
| --------------------------------- | -------------------------- |
| **`main`**                        | Production → silvervibe.io |
| **`develop`** + **pull requests** | Preview URLs only          |

Enable PR / branch previews in the Cloudflare Pages project settings. Build command and output path stay as in [go-live.md](./go-live.md).

## Branch protection (recommended)

On `develop` (and later `main`), require these status checks before merge:

- Format
- Lint
- Unit tests
- Build
- E2E
- Code quality (CodeQL) / Analyze (javascript-typescript)

Repo → **Settings → Branches → Branch protection rules**.

## Copilot code review (fewer nits)

Custom instructions live in:

- `.github/copilot-instructions.md` — high-signal-only review rules
- `.github/instructions/*.instructions.md` — Angular / API path rules

Keep **Settings → Copilot → Code review → Use custom instructions** enabled.
See `.cursor/skills/github-copilot-review/SKILL.md`.

## Notes

- Node **24.15.0** (`.nvmrc`) in Actions.
- Unit tests install **uv** so `ai:test` (`uv sync` + pytest) can run alongside the Node projects.
- CI sets placeholder `DATABASE_URL` values so `prisma generate` (postinstall) succeeds; it does not migrate or connect to Neon.
- E2E uses Chromium only in CI for speed; local configs still list Firefox/WebKit.
- Nx `defaultBase` is **`develop`** (`nx.json`) for future `nx affected` usage.
