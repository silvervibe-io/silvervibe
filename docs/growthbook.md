# GrowthBook + OpenFeature (foundation)

Issue: [#8](https://github.com/silvervibe-io/silvervibe/issues/8).

Silvervibe evaluates flags through **OpenFeature**. GrowthBook is the remote
provider when SDK keys are present; otherwise Nest and Angular use **static
in-memory defaults**.

## Flag vs entitlement

| Layer                    | Meaning                                                                                                        |
| ------------------------ | -------------------------------------------------------------------------------------------------------------- |
| Neon `workspace_tools`   | Ownership — does this workspace **own** the tool? ([#9](https://github.com/silvervibe-io/silvervibe/issues/9)) |
| OpenFeature / GrowthBook | Rollout — is the feature **turned on** for this user/workspace?                                                |

Never use a flag alone as proof of purchase.

## Create a GrowthBook project

1. Sign up at [GrowthBook](https://app.growthbook.io/) (or self-host).
2. Create a project for Silver Vibe (e.g. `silvervibe`).
3. **SDK Configuration** → create a **SDK Connection** for the web/API apps.
4. Copy the **Client key** into repo-root `.env`:

| Env var                 | Use                                                              |
| ----------------------- | ---------------------------------------------------------------- |
| `GROWTHBOOK_API_HOST`   | Usually `https://cdn.growthbook.io`                              |
| `GROWTHBOOK_CLIENT_KEY` | SDK client key (Angular + Nest)                                  |
| `GROWTHBOOK_SERVER_KEY` | Optional alias; Nest falls back to this if `CLIENT_KEY` is empty |

5. Run:

```bash
npm run growthbook:check
npm run firebase:sync-web   # also syncs GrowthBook into Angular local modules
```

`npm start` / Nx `serve` / `build` sync Angular env from `.env` automatically.

## Initial boolean flags

Create these **boolean** features in GrowthBook with the **same keys** as
`FLAG_KEYS` in `@silvervibe/shared/feature-flags`:

| Key                         | Suggested default | Purpose                          |
| --------------------------- | ----------------- | -------------------------------- |
| `tools.vibestandup.enabled` | `true`            | Roll out Vibe Standup            |
| `addons.github.webhooks`    | `false`           | Roll out GitHub webhook handling |

Publish rules so the SDK connection can see them (dev environment is fine for local).

## Fallback when keys are missing

| App     | Behavior                                                                                 |
| ------- | ---------------------------------------------------------------------------------------- |
| Nest    | Logs a warning; `tools.vibestandup.enabled` → `true`, `addons.github.webhooks` → `false` |
| Angular | Same vibestandup default via `StaticBooleanProvider`                                     |

Smoke without GrowthBook:

```bash
curl -s http://localhost:3000/api/flags/vibestandup
```

With keys set, the same endpoint returns GrowthBook’s evaluation.

## Code map

| Piece                                        | Location                                             |
| -------------------------------------------- | ---------------------------------------------------- |
| Shared flag keys                             | `libs/shared/feature-flags`                          |
| Nest provider + `GET /api/flags/vibestandup` | `apps/api/src/app/feature-flags`                     |
| Angular `FeatureFlagsService`                | `libs/shared/auth` (`provideSilvervibeFeatureFlags`) |

## Checklist (acceptance #8)

- [ ] GrowthBook project + SDK client key in local `.env`
- [ ] Flags `tools.vibestandup.enabled` and `addons.github.webhooks` exist in GrowthBook
- [ ] `npm run growthbook:check` reports the client key set
- [ ] `GET /api/flags/vibestandup` returns GrowthBook value when API is running with that `.env`
- [ ] Angular app init evaluates `tools.vibestandup.enabled` (see `FeatureFlagsService.vibestandupEnabled`)
