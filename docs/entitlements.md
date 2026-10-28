# Workspace entitlements (`workspace_tools`)

Issue: [#9](https://github.com/silvervibe-io/silvervibe/issues/9).

## Flag vs entitlement

| Layer                    | Meaning                                                                    |
| ------------------------ | -------------------------------------------------------------------------- |
| Neon `workspace_tools`   | **Ownership** — does this workspace own the tool?                          |
| OpenFeature / GrowthBook | **Rollout** — is the feature turned on? ([growthbook.md](./growthbook.md)) |

Gate product features with **both**: entitled in DB **and** flag enabled (when using GrowthBook).

## Tool keys

Canonical strings live in `@silvervibe/shared/feature-flags` as `TOOL_KEYS`
(e.g. `vibestandup`, `addons.github`). Unknown keys are rejected by the API.

Pure helpers: `@silvervibe/shared/data-access` (`isToolEnabled`, `enabledToolKeys`).

## Nest API (Bearer auth)

Requires Firebase ID token (or `Bearer dev:<uid>` outside production when Admin is unset). Requires `DATABASE_URL`.

| Method | Path                                          | Purpose                                                                                              |
| ------ | --------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `POST` | `/api/workspaces`                             | Create workspace `{ name, slug }` (caller becomes OWNER + vibestandup; `planKey` defaults to `free`) |
| `PUT`  | `/api/workspaces/:workspaceId/plan`           | Set commercial plan `{ planKey: "free" \| "team" }` (workspace **OWNER** only; pre-billing unlock)   |
| `GET`  | `/api/workspaces/:workspaceId/tools`          | List entitlement rows (workspace **member**)                                                         |
| `PUT`  | `/api/workspaces/:workspaceId/tools/:toolKey` | Grant/revoke (workspace **OWNER** or **ADMIN**)                                                      |

`GET /api/me/workspaces` includes each workspace `planKey`. Nest enforces
VibeStandup `maxTeams` / `maxMembersPerTeam` from
`libs/shared/feature-flags/src/lib/plans.catalog.json` using that stored value
(not the preview switcher). GrowthBook `vibestandup.multiTeam.enabled` can gate
extra UX later; plan limits are always Neon + catalog.

Prefer creating workspaces from the Silvervibe **portal** UI (`/portal`) when signed in; the curl examples below remain useful for API smoke checks.

Example:

```bash
TOKEN='dev:demo'

# create
curl -s -X POST http://localhost:3000/api/workspaces \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"Demo","slug":"demo"}'

# grant vibestandup (use id from create response)
curl -s -X PUT "http://localhost:3000/api/workspaces/<id>/tools/vibestandup" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"enabled":true}'

# list
curl -s "http://localhost:3000/api/workspaces/<id>/tools" \
  -H "Authorization: Bearer $TOKEN"

# revoke
curl -s -X PUT "http://localhost:3000/api/workspaces/<id>/tools/vibestandup" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"enabled":false}'
```

Swagger: `http://localhost:3000/api/docs` → **workspaces**.

## Checklist (acceptance #9)

- [ ] Create a workspace via API
- [ ] Grant `vibestandup`, list shows `enabled: true`
- [ ] Revoke, list shows `enabled: false`
- [ ] Unknown `toolKey` returns 400
