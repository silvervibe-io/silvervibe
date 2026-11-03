# GrowthBook + OpenFeature (foundation)

Issues: [#8](https://github.com/silvervibe-io/silvervibe/issues/8),
[#67](https://github.com/silvervibe-io/silvervibe/issues/67) (plans + generated features JSON).

Silvervibe evaluates flags through **OpenFeature**. GrowthBook is the remote
provider when SDK keys are present; otherwise Nest and Angular use **static
in-memory defaults**.

## Flag vs entitlement vs plan

| Layer                    | Meaning                                                                                                                                  |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Neon `workspace_tools`   | Ownership — does this workspace **own** the tool? ([#9](https://github.com/silvervibe-io/silvervibe/issues/9))                           |
| Workspace **plan**       | Commercial package / limits (free: 1 VibeStandup team, max 12 members). Enforced in Nest on team create / invite (default free catalog). |
| OpenFeature / GrowthBook | Rollout — is the feature **turned on** for this user/workspace?                                                                          |

Never use a flag alone as proof of purchase or seat limits.

## Founder preview switcher (role + plan)

Allowlisted Firebase emails can switch **workspace role** and **plan tier** in the
shell navbar to preview UI gates and limit copy. Nest RBAC is unchanged.

| Piece | Detail                                                                          |
| ----- | ------------------------------------------------------------------------------- |
| Env   | `PREVIEW_SWITCHER_EMAILS=you@example.com` (comma-separated) in repo-root `.env` |
| Sync  | `npm run firebase:sync-web` → `preview-switcher.local.ts` (gitignored)          |
| Store | `@silvervibe/stores/preview` (`PreviewContextStore`)                            |
| UI    | `sv-preview-switcher` inside `sv-shell` (md+ screens)                           |
| Prod  | `environment.prod` keeps an empty allowlist                                     |

When active, prefers selecting a workspace with slug `silvervibe` if present.
Overrides persist in `sessionStorage` for the tab session.

## Generated features JSON (from plan catalog)

Canonical sources:

| File                                                   | Role                                       |
| ------------------------------------------------------ | ------------------------------------------ |
| `libs/shared/feature-flags/src/lib/plans.catalog.json` | Plan definitions (free / team placeholder) |
| `libs/shared/feature-flags/src/lib/flag-defaults.json` | Flag keys, types, defaults, descriptions   |
| `libs/shared/feature-flags/src/lib/flag-keys.ts`       | TypeScript `FLAG_KEYS` / `TOOL_KEYS`       |

Regenerate GrowthBook-compatible definitions:

```bash
npm run growthbook:generate-features
```

Outputs under `libs/shared/feature-flags/growthbook/`:

| File                        | Use                                                                                        |
| --------------------------- | ------------------------------------------------------------------------------------------ |
| `features.definitions.json` | Flat FeatureDefinition map — pass as `features` / SDK `payload.features`                   |
| `features.json`             | SDK endpoint-shaped payload `{ status: 200, features }`                                    |
| `features.inventory.json`   | Human checklist (key, type, description, default) when creating flags in the GrowthBook UI |

Suggested GrowthBook attributes for targeting: `id`, `firebaseUid`, `workspaceId`, `planKey`.

After editing the catalog or defaults, regenerate and create/update matching features in GrowthBook (same keys + defaults).

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

## Initial flags

Prefer `npm run growthbook:generate-features` and create features from
`features.inventory.json`. Current defaults include:

| Key                             | Type    | Suggested default | Purpose                                      |
| ------------------------------- | ------- | ----------------- | -------------------------------------------- |
| `tools.vibestandup.enabled`     | boolean | `true`            | Roll out Vibe Standup                        |
| `addons.github.webhooks`        | boolean | `false`           | Roll out GitHub webhook handling             |
| `vibestandup.multiTeam.enabled` | boolean | `false`           | Optional UX gate for multi-team surfaces     |
| `plans.catalog`                 | JSON    | plan catalog      | Remote-readable plan catalog                 |
| `vibestandup.limits`            | JSON    | free limits       | Convenience free-tier limits (Neon enforces) |

Hard limits for create-team / invites use Neon `workspaces.plan_key` + the local
`plans.catalog.json` helpers in Nest — not GrowthBook alone. OWNER
`PUT /api/workspaces/:id/plan` sets `free`/`team` (pre-billing). See
[entitlements.md](./entitlements.md).

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
| Shared flag keys + plan catalog              | `libs/shared/feature-flags`                          |
| Generated GrowthBook JSON                    | `libs/shared/feature-flags/growthbook/`              |
| Nest provider + `GET /api/flags/vibestandup` | `apps/api/src/app/feature-flags`                     |
| Angular `FeatureFlagsService`                | `libs/shared/auth` (`provideSilvervibeFeatureFlags`) |

## Checklist (acceptance #8)

- [ ] GrowthBook project + SDK client key in local `.env`
- [ ] Flags `tools.vibestandup.enabled` and `addons.github.webhooks` exist in GrowthBook
- [ ] `npm run growthbook:check` reports the client key set
- [ ] `GET /api/flags/vibestandup` returns GrowthBook value when API is running with that `.env`
- [ ] Angular app init evaluates `tools.vibestandup.enabled` (see `FeatureFlagsService.vibestandupEnabled`)
