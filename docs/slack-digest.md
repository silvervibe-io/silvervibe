# Slack standup digest

Issue: [#89](https://github.com/silvervibe-io/silvervibe/issues/89).

## Behaviour

1. A workspace admin pastes a Slack **Incoming Webhook** URL in Workspace admin
   (optional channel label for display).
2. Saving enables the `addons.slack` workspace tool entitlement and stores the
   webhook on `AddonConnection` (provider `SLACK`). The URL is never returned to
   the client after save.
3. When a team standup summary is rebuilt (member **submit** or admin
   **Rebuild**), Nest posts the summary markdown to that webhook if
   `addons.slack` is enabled and the connection status is `CONNECTED`.
4. Post failures are soft-fail (logged; submit/rebuild still succeed).

## Setup

1. In Slack: create an [Incoming Webhook](https://api.slack.com/messaging/webhooks)
   for the target channel; copy the `https://hooks.slack.com/...` URL.
2. VibeStandup → Workspace → paste URL → Save.
3. Submit a standup (or Rebuild summary) and confirm the channel message.

## API

| Method   | Path                                        | Notes              |
| -------- | ------------------------------------------- | ------------------ |
| `GET`    | `/api/workspaces/:workspaceId/addons/slack` | Status (no secret) |
| `PUT`    | `/api/workspaces/:workspaceId/addons/slack` | Connect (admin)    |
| `DELETE` | `/api/workspaces/:workspaceId/addons/slack` | Disconnect (admin) |

## Out of scope (for now)

- OAuth Slack app / bot tokens
- Per-team webhooks (workspace-wide webhook posts all teams)
- Per-member DMs, Jira digests (Teams: see [teams-digest.md](./teams-digest.md))
