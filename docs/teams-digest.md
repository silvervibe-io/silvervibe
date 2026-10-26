# Microsoft Teams standup digest

Issues: [#101](https://github.com/silvervibe-io/silvervibe/issues/101) (webhook MVP),
[#106](https://github.com/silvervibe-io/silvervibe/issues/106) / [#108](https://github.com/silvervibe-io/silvervibe/issues/108) (deferred).

## Status: deferred

Teams digest is **not offered in product** until Silvervibe has a Microsoft 365
tenant with Teams (Microsoft Graph channel APIs require an M365 license).

- Workspace admin **hides** the Teams connect UI (#108).
- Nest still exposes Teams addon routes for a later resume; `postStandupDigest`
  is a no-op.
- OAuth work lives on branch `feature/106-teams-oauth-connect` (PR #107 closed).

## When re-enabling

1. Microsoft 365 (trial or paid) with Teams for the connecting user.
2. Resume OAuth from `feature/106-teams-oauth-connect` (or re-open against
   current `develop`).
3. Restore Workspace admin Teams section + digest posting.
4. Follow setup in the OAuth docs on that branch (`TEAMS_CLIENT_ID` /
   `TEAMS_CLIENT_SECRET`, Entra app, Graph delegated scopes).

## Legacy webhook (pre-deferral)

Webhook connect via `PUT /api/workspaces/:id/addons/teams` may still exist in
Nest for migration, but is not exposed in the UI.
