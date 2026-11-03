# GitHub standup digest

Issue: [#113](https://github.com/silvervibe-io/silvervibe/issues/113)

## What it does

1. Workspace admin starts **Connect GitHub** (OAuth App). Nest stores the token
   on `addon_connections` (provider `GITHUB`), enables `addons.github`, and
   redirects back to Workspace admin.
2. Admin picks a **repository** and an open **issue**. Digests post as issue
   comments.
3. When a team standup summary is rebuilt (submit or Rebuild), Nest creates a
   comment if `addons.github` is enabled and a target is selected.

## Setup (local / Cloud Run)

1. Create an **OAuth App** under GitHub → Settings → Developer settings →
   OAuth Apps (org or user).
2. Authorization callback URL:
   - Local: `http://localhost:3000/api/addons/github/oauth/callback`
   - Prod: `https://api.silvervibe.io/api/addons/github/oauth/callback`
3. Set `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`.
4. Optional: `GITHUB_REDIRECT_URI` if the callback differs from
   `${PUBLIC_API_URL}/addons/github/oauth/callback`.

Scope requested: `repo` (comment on private repos the connecting user can
access).

## API

| Method   | Path                                                                   | Notes                        |
| -------- | ---------------------------------------------------------------------- | ---------------------------- |
| `GET`    | `/api/workspaces/:workspaceId/addons/github`                           | Status (no secret)           |
| `GET`    | `/api/workspaces/:workspaceId/addons/github/oauth/start`               | Returns `{ authorizeUrl }`   |
| `GET`    | `/api/addons/github/oauth/callback`                                    | Public; redirects to standup |
| `GET`    | `/api/workspaces/:workspaceId/addons/github/repos`                     | Repo picker                  |
| `GET`    | `/api/workspaces/:workspaceId/addons/github/repos/:owner/:repo/issues` | Open issues                  |
| `PUT`    | `/api/workspaces/:workspaceId/addons/github/target`                    | Select repo + issue          |
| `DELETE` | `/api/workspaces/:workspaceId/addons/github`                           | Disconnect (admin)           |
| `GET`    | `/api/teams/:teamId/addons/github/repos`                               | Repo picker (team admin)     |
| `GET`    | `/api/teams/:teamId/addons/github/repos/:owner/:repo/issues`           | Issues (team admin)          |
| `GET`    | `/api/teams/:teamId/addons/github/target`                              | Effective team target        |
| `PUT`    | `/api/teams/:teamId/addons/github/target`                              | Set team override            |
| `DELETE` | `/api/teams/:teamId/addons/github/target`                              | Clear override               |

Per-team overrides live in connection `metadataJson.teamTargets`. Digests resolve
the team repo/issue first, then the workspace default.

## Out of scope (for now)

- GitHub App installation tokens (prefer later for bot identity)
- Incoming webhooks (`addons.github.webhooks`)
- Discussions / Projects v2 as digest targets
