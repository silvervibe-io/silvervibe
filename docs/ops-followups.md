# Ops follow-ups (post-foundation)

Issue: [#31](https://github.com/silvervibe-io/silvervibe/issues/31).

Code and docs for the foundation stack are in the repo. These steps need a
human with Cloudflare / GCP / GrowthBook access. Tick each item when verified.

## 1. GrowthBook SDK keys

Guide: [growthbook.md](./growthbook.md) (was #8).

1. Create a GrowthBook project and SDK connection.
2. Set in local `.env` (never commit):

```bash
GROWTHBOOK_API_HOST=https://cdn.growthbook.io
GROWTHBOOK_CLIENT_KEY=...
GROWTHBOOK_SERVER_KEY=...   # optional; Nest can use CLIENT_KEY
```

3. Create flags `tools.vibestandup.enabled` and `addons.github.webhooks`.
4. Verify:

```bash
npm run growthbook:check
npm run firebase:sync-web   # also syncs GrowthBook client into Angular locals
npm start api
curl -s http://localhost:3000/api/flags/vibestandup
```

5. For Cloud Run later: store the same keys in Secret Manager (see
   [cloud-run.md](./cloud-run.md)).

- [x] Keys in `.env`; `growthbook:check` reports configured (`apiCanUseGrowthBook: true`)
- [x] Live flag value returned from Nest via GrowthBook (`OpenFeature using GrowthBook provider` on Cloud Run; CDN features include `tools.vibestandup.enabled` + `addons.github.webhooks`)
- [x] Secret Manager + Cloud Run env: `GROWTHBOOK_API_HOST`, `GROWTHBOOK_CLIENT_KEY`

## 2. Nest API live on `api.silvervibe.io`

Guide: [cloud-run.md](./cloud-run.md) (was #10).

```bash
npx nx run api:docker:build
# push image + gcloud run deploy … (commands in cloud-run.md)
curl -s https://api.silvervibe.io/api/health
# {"status":"ok"}
```

- [x] Image deployed; Cloud Run revision healthy (`silvervibe-api`, europe-west1)
- [x] Cloudflare CNAME `api` → Cloud Run; TLS Active
- [x] `GET https://api.silvervibe.io/api/health` succeeds
- [x] `RESEND_API_KEY` + `PUBLIC_STANDUP_URL` + `EMAIL_FROM` on the service (#81)
- [x] Redeployed image with invites + reminders (`silvervibe-api-00005-*`, #81 / #82)
- [x] `CRON_SECRET` on Cloud Run; Cloud Scheduler job `standup-reminders` enabled
- [x] Scheduler updated to `*/15 * * * 1-5` (UTC) for per-team reminder times (#86)

## 3. Inbound mail to `info@silvervibe.io`

Guide: [email-routing.md](./email-routing.md) (was #12).

1. Enable Cloudflare Email Routing; verify a destination inbox.
2. Rule: `info@silvervibe.io` → destination.
3. Send a test message (and/or use the landing mailto).

- [x] Cloudflare Email Routing MX Active (`route1/2/3.mx.cloudflare.net` + SPF include `_spf.mx.cloudflare.net`)
- [x] Landing mailto on https://silvervibe.io still points at `info@silvervibe.io`
- [x] Test mail received in the destination inbox (Resend smoke to `info@` confirmed 2026-10-20)

## Related hosting (optional same session)

Not required to close #31, but often done together:

| Item                              | Doc                                                                                   |
| --------------------------------- | ------------------------------------------------------------------------------------- |
| AI → `ai.silvervibe.io`           | [cloud-run-ai.md](./cloud-run-ai.md) (#29) — live (`GET /health` ok via Worker proxy) |
| Standup → `standup.silvervibe.io` | [vibestandup-pages.md](./vibestandup-pages.md) (#30) — live (`GET /` → Vibe Standup)  |

## Done when

All three primary checklists above are ticked (GrowthBook keys, API health URL,
info@ delivery).
