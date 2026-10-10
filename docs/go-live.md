# Go live: silvervibe.io

Deploy the `silvervibe` Angular app to the apex domain via GitHub → Cloudflare Pages.

Repo: `https://github.com/silvervibe-io/silvervibe.git`

## 1. Accounts (create in this order)

1. **Email** — route `info@silvervibe.io` (Cloudflare Email Routing or Google Workspace).
   Steps: [email-routing.md](./email-routing.md).
2. **Cloudflare** — domain `silvervibe.io` on Cloudflare DNS.
3. **GitHub org** — `silvervibe-io` with empty repo `silvervibe` (public for OSS).
4. **Optional later** — Neon, Firebase, GrowthBook, Google Cloud (API/AI). Not required for the static landing page.
5. **Trademarks** — follow [TRADEMARKS.md](../TRADEMARKS.md) / [legal.md](./legal.md) when ready to file.

## 2. Push this monorepo

```bash
git remote add origin https://github.com/silvervibe-io/silvervibe.git
git branch -M main
git push -u origin main
```

Do **not** commit `.env`. Keep secrets in Cloudflare / Secret Manager later.

## 3. Cloudflare Pages project

1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
2. Authorize `silvervibe-io`; select the `silvervibe` repo.
3. Build settings:

| Setting                | Value                                                          |
| ---------------------- | -------------------------------------------------------------- |
| Framework preset       | None                                                           |
| Build command          | `npx nx build silvervibe --configuration=production`           |
| Build output directory | `dist/apps/silvervibe/browser`                                 |
| Root directory         | `/` (repo root)                                                |
| Node version           | `24.15.0` — commit `.nvmrc`, or set env `NODE_VERSION=24.15.0` |

Cloudflare already runs `npm ci` before your build command. Do not prefix the build with another `npm ci`.

4. Save and deploy. Confirm the `*.pages.dev` preview URL shows the landing page.

## 4. Attach silvervibe.io

1. Pages project → **Custom domains** → add `silvervibe.io` (and optionally `www.silvervibe.io`).
2. Wait for TLS active, then open https://silvervibe.io.

| Host                    | App                             |
| ----------------------- | ------------------------------- |
| `silvervibe.io` / `www` | marketing / base (`silvervibe`) |
| `standup.silvervibe.io` | `vibestandup` (later)           |
| `api.silvervibe.io`     | Nest API (later)                |
| `ai.silvervibe.io`      | LangGraph (later)               |

## 5. CI/CD behavior

With Git connected:

- **Production branch = `main`** → deploys to silvervibe.io.
- **`develop`** and pull requests → preview deployments only (enable in Pages settings).
- Do not push WIP routes or landing experiments to `main`. See [branching.md](./branching.md).

GitHub Actions also runs format, lint, unit tests, build, e2e, and CodeQL on PRs —
see [ci.md](./ci.md).

## 6. Local check before push

```bash
npx nx serve silvervibe
npx nx test silvervibe
npx nx build silvervibe
```

## 7. After the page is live

1. Point email routing for `info@silvervibe.io` — [email-routing.md](./email-routing.md).
2. Create Neon + Firebase + GrowthBook when you need auth/API.
3. Add Cloud Run services and CNAMEs for `api` / `ai` — [cloud-run.md](./cloud-run.md).
4. File trademark applications and update the registration log in TRADEMARKS.md.
