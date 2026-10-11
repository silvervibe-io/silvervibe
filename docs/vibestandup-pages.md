# Cloudflare Pages: `standup.silvervibe.io`

Issue: [#30](https://github.com/silvervibe-io/silvervibe/issues/30).

Serve the **`vibestandup`** Angular app on its product hostname. The apex
`silvervibe.io` Pages project stays on the marketing / base app — see
[go-live.md](./go-live.md).

## Why a second Pages project

Cloudflare Pages has one production build command and output directory per
project. `silvervibe` and `vibestandup` need different Nx targets, so create a
**second** Pages project on the same GitHub repo.

## Create the project

1. Cloudflare → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
2. Select `silvervibe-io/silvervibe` (authorize if needed).
3. Project name suggestion: `vibestandup` (or `silvervibe-standup`).
4. Build settings:

| Setting                | Value                                                 |
| ---------------------- | ----------------------------------------------------- |
| Framework preset       | None                                                  |
| Build command          | `npx nx build vibestandup --configuration=production` |
| Build output directory | `dist/apps/vibestandup/browser`                       |
| Root directory         | `/` (repo root)                                       |
| Node version           | `24.15.0` — `.nvmrc`, or env `NODE_VERSION=24.15.0`   |

Cloudflare runs `npm ci` before the build. Do not prefix another `npm ci`.

5. **Production branch** = `main` (same policy as the base app).
6. Enable **preview** deployments for `develop` and pull requests.

## Custom domain

1. Pages project → **Custom domains** → add **`standup.silvervibe.io`**.
2. Cloudflare DNS will create/update the CNAME; wait for TLS **Active**.
3. Open https://standup.silvervibe.io.

## Build secrets (Firebase / GrowthBook)

If production builds need web config, set the same env vars as local sync
([firebase.md](./firebase.md), [growthbook.md](./growthbook.md)) on **this**
Pages project:

- `FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_PROJECT_ID`, `FIREBASE_APP_ID`
- `GROWTHBOOK_CLIENT_KEY`, `GROWTHBOOK_API_HOST` (optional)

Wire them into the build the same way as the base app (sync script or CI inject).
Do not commit real keys.

## Local check

```bash
npx nx serve vibestandup
npx nx test vibestandup
npx nx build vibestandup --configuration=production
# output: dist/apps/vibestandup/browser
```

## Hostnames

| Host                    | Pages project / service                   |
| ----------------------- | ----------------------------------------- |
| `silvervibe.io` / `www` | base app (`silvervibe`)                   |
| `standup.silvervibe.io` | `vibestandup` (this doc)                  |
| `api.silvervibe.io`     | Nest — [cloud-run.md](./cloud-run.md)     |
| `ai.silvervibe.io`      | AI — [cloud-run-ai.md](./cloud-run-ai.md) |

## Checklist

- [ ] Second Pages project connected to the repo with vibestandup build settings
- [ ] Preview deploy from `develop` / a PR looks correct
- [ ] `standup.silvervibe.io` custom domain + TLS Active
- [ ] https://standup.silvervibe.io loads the vibestandup app
