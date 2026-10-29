# Linear standup digest

Issue: [#110](https://github.com/silvervibe-io/silvervibe/issues/110)

## What it does

1. Workspace admin starts **Connect Linear** (OAuth). Nest stores tokens on
   `addon_connections` (provider `LINEAR`), enables tool entitlement
   `addons.linear`, and redirects back to Workspace admin.
2. Admin picks a Linear **project**. Digests post as Linear **project updates**.
3. When a team standup summary is rebuilt (submit or Rebuild), Nest creates a
   project update if `addons.linear` is enabled and a project is selected.

## Setup (local / Cloud Run)

1. Create an OAuth application in [Linear settings → API](https://linear.app/settings/api).
2. Callback URL:
   - Local: `http://localhost:3000/api/addons/linear/oauth/callback`
   - Prod: `https://api.silvervibe.io/api/addons/linear/oauth/callback`
3. Set `LINEAR_CLIENT_ID` and `LINEAR_CLIENT_SECRET` (Secret Manager + Cloud Run
   mount in prod).
4. Optional: `LINEAR_REDIRECT_URI` if the callback differs from
   `${PUBLIC_API_URL}/addons/linear/oauth/callback`.

Scopes requested: `read,write`. Actor: `app` (resources created as the app).

## API

| Method   | Path                                                     | Notes                        |
| -------- | -------------------------------------------------------- | ---------------------------- |
| `GET`    | `/api/workspaces/:workspaceId/addons/linear`             | Status (no secret)           |
| `GET`    | `/api/workspaces/:workspaceId/addons/linear/oauth/start` | Returns `{ authorizeUrl }`   |
| `GET`    | `/api/addons/linear/oauth/callback`                      | Public; redirects to standup |
| `GET`    | `/api/workspaces/:workspaceId/addons/linear/projects`    | Project picker               |
| `PUT`    | `/api/workspaces/:workspaceId/addons/linear/project`     | Select digest project        |
| `DELETE` | `/api/workspaces/:workspaceId/addons/linear`             | Disconnect (admin)           |
| `GET`    | `/api/teams/:teamId/addons/linear/projects`              | Project picker (team admin)  |
| `GET`    | `/api/teams/:teamId/addons/linear/project`               | Effective team project       |
| `PUT`    | `/api/teams/:teamId/addons/linear/project`               | Set team override            |
| `DELETE` | `/api/teams/:teamId/addons/linear/project`               | Clear override               |

Per-team overrides live in connection `metadataJson.teamTargets` (same pattern as
Slack `teamChannels`). Digests resolve the team project first, then the workspace
default.

## Out of scope (for now)

- Creating Linear issues from standup lines
- Webhooks into VibeStandup
