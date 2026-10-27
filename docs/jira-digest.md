# Jira standup digest

Issue: [#116](https://github.com/silvervibe-io/silvervibe/issues/116)

## What it does

1. Workspace admin starts **Connect Jira** (Atlassian OAuth 2.0 / 3LO). Nest
   stores tokens on `addon_connections` (provider `JIRA`), enables
   `addons.jira`, and redirects back to Workspace admin.
2. Admin picks a **Cloud site**, **project**, and **issue**. Digests post as
   issue comments (ADF).
3. When a team standup summary is rebuilt (submit or Rebuild), Nest adds a
   comment if `addons.jira` is enabled and a target is selected.

## Setup (local / Cloud Run)

1. Create an OAuth 2.0 (3LO) app in the
   [Atlassian developer console](https://developer.atlassian.com/console/myapps/).
2. Add permission scopes: `read:jira-work`, `write:jira-work`, `offline_access`.
3. Callback URL:
   - Local: `http://localhost:3000/api/addons/jira/oauth/callback`
   - Prod: `https://api.silvervibe.io/api/addons/jira/oauth/callback`
4. Set `JIRA_CLIENT_ID` and `JIRA_CLIENT_SECRET` (Secret Manager + Cloud Run in
   prod).
5. Optional: `JIRA_REDIRECT_URI` if the callback differs from
   `${PUBLIC_API_URL}/addons/jira/oauth/callback`.

## API

| Method   | Path                                                                   | Notes                        |
| -------- | ---------------------------------------------------------------------- | ---------------------------- |
| `GET`    | `/api/workspaces/:workspaceId/addons/jira`                             | Status (no secret)           |
| `GET`    | `/api/workspaces/:workspaceId/addons/jira/oauth/start`                 | Returns `{ authorizeUrl }`   |
| `GET`    | `/api/addons/jira/oauth/callback`                                      | Public; redirects to standup |
| `GET`    | `/api/workspaces/:workspaceId/addons/jira/sites`                       | Cloud sites                  |
| `PUT`    | `/api/workspaces/:workspaceId/addons/jira/site`                        | Select site                  |
| `GET`    | `/api/workspaces/:workspaceId/addons/jira/projects`                    | Projects                     |
| `GET`    | `/api/workspaces/:workspaceId/addons/jira/projects/:projectKey/issues` | Recent issues                |
| `PUT`    | `/api/workspaces/:workspaceId/addons/jira/target`                      | Select issue                 |
| `DELETE` | `/api/workspaces/:workspaceId/addons/jira`                             | Disconnect                   |

## Out of scope (for now)

- Jira Server / Data Center
- Creating issues from standup lines
- Microsoft Teams (deferred #108)
