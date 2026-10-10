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

- [ ] Keys in `.env`; `growthbook:check` reports configured
- [ ] Live flag value returned from Nest (not only static default)

## 2. Nest API live on `api.silvervibe.io`

Guide: [cloud-run.md](./cloud-run.md) (was #10).

```bash
npx nx run api:docker:build
# push image + gcloud run deploy … (commands in cloud-run.md)
curl -s https://api.silvervibe.io/api/health
# {"status":"ok"}
```

- [ ] Image deployed; Cloud Run revision healthy
- [ ] Cloudflare CNAME `api` → Cloud Run; TLS Active
- [ ] `GET https://api.silvervibe.io/api/health` succeeds

## 3. Inbound mail to `info@silvervibe.io`

Guide: [email-routing.md](./email-routing.md) (was #12).

1. Enable Cloudflare Email Routing; verify a destination inbox.
2. Rule: `info@silvervibe.io` → destination.
3. Send a test message (and/or use the landing mailto).

- [ ] Test mail received in the destination inbox
- [ ] Landing mailto on https://silvervibe.io still points at `info@`

## Related hosting (optional same session)

Not required to close #31, but often done together:

| Item                              | Doc                                                  |
| --------------------------------- | ---------------------------------------------------- |
| AI → `ai.silvervibe.io`           | [cloud-run-ai.md](./cloud-run-ai.md) (#29)           |
| Standup → `standup.silvervibe.io` | [vibestandup-pages.md](./vibestandup-pages.md) (#30) |

## Done when

All three primary checklists above are ticked (GrowthBook keys, API health URL,
info@ delivery).
