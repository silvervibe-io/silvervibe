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

| Method | Path                                          | Purpose                                              |
| ------ | --------------------------------------------- | ---------------------------------------------------- |
| `POST` | `/api/workspaces`                             | Create workspace `{ name, slug }`                    |
| `GET`  | `/api/workspaces/:workspaceId/tools`          | List entitlement rows                                |
| `PUT`  | `/api/workspaces/:workspaceId/tools/:toolKey` | Grant (`enabled: true`) or revoke (`enabled: false`) |

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
