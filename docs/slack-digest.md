# Slack standup digest

Issues: [#89](https://github.com/silvervibe-io/silvervibe/issues/89) (webhook MVP),
[#103](https://github.com/silvervibe-io/silvervibe/issues/103) (OAuth connect).

## Behaviour

1. A workspace admin clicks **Connect Slack** in Workspace admin (OAuth install).
2. Slack asks them to authorize the Silvervibe app and pick a channel
   (`incoming-webhook` + `chat:write`).
3. Nest stores the bot token on `AddonConnection` (provider `SLACK`), enables
   `addons.slack`, and redirects back to Workspace admin.
4. When a team standup summary is rebuilt (member **submit** or admin
   **Rebuild**), Nest posts via Slack Web API `chat.postMessage` to the chosen
   channel if `addons.slack` is enabled and the connection status is `CONNECTED`.
5. Post failures are soft-fail (logged; submit/rebuild still succeed).
6. **Disconnect** clears the token/channel metadata and stops posts.

Legacy Incoming Webhook installs (pre-OAuth) still post via the webhook URL until
the admin disconnects and reconnects with OAuth. Prefer OAuth for new workspaces.

## Slack app setup

1. Create an app at [api.slack.com/apps](https://api.slack.com/apps).
2. **OAuth & Permissions** → Redirect URL:
   - Local: `http://localhost:3000/api/addons/slack/oauth/callback`
   - Prod: `https://api.silvervibe.io/api/addons/slack/oauth/callback`
3. Bot token scopes: `chat:write`, `channels:read`, `groups:read`,
   `incoming-webhook`.
4. Copy **Client ID** and **Client Secret** into Nest env (never commit).

Optional: set `SLACK_REDIRECT_URI` if it must differ from
`${PUBLIC_API_URL}/addons/slack/oauth/callback`.

## Nest / Cloud Run env

| Variable               | Notes                                       |
| ---------------------- | ------------------------------------------- |
| `SLACK_CLIENT_ID`      | Slack app Client ID                         |
| `SLACK_CLIENT_SECRET`  | Slack app Client Secret (Secret Manager)    |
| `SLACK_SIGNING_SECRET` | Optional; reserved for request verification |
| `SLACK_REDIRECT_URI`   | Optional override of callback URL           |
| `PUBLIC_API_URL`       | Used to build the default redirect URI      |
| `PUBLIC_STANDUP_URL`   | Post-OAuth redirect to Workspace admin      |

## API

| Method   | Path                                                    | Notes                        |
| -------- | ------------------------------------------------------- | ---------------------------- |
| `GET`    | `/api/workspaces/:workspaceId/addons/slack`             | Status (no secret)           |
| `GET`    | `/api/workspaces/:workspaceId/addons/slack/oauth/start` | Returns `{ authorizeUrl }`   |
| `GET`    | `/api/addons/slack/oauth/callback`                      | Public; redirects to standup |
| `PUT`    | `/api/workspaces/:workspaceId/addons/slack`             | Deprecated webhook connect   |
| `DELETE` | `/api/workspaces/:workspaceId/addons/slack`             | Disconnect (admin)           |

## Out of scope (follow-ups)

- Per-team Slack channels
- Channel picker after install (MVP uses channel chosen during OAuth)
- Slash commands / interactivity beyond posting digests
- Microsoft Teams OAuth (Teams stays on Incoming Webhook for now)
