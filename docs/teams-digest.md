# Microsoft Teams standup digest

Issue: [#101](https://github.com/silvervibe-io/silvervibe/issues/101).

## Behaviour

1. A workspace admin pastes a Microsoft Teams **Incoming Webhook** URL in
   Workspace admin (optional channel label for display).
2. Saving enables the `addons.teams` workspace tool entitlement and stores the
   webhook on `AddonConnection` (provider `TEAMS`). The URL is never returned to
   the client after save.
3. When a team standup summary is rebuilt (member **submit** or admin
   **Rebuild**), Nest posts the summary text to that webhook if
   `addons.teams` is enabled and the connection status is `CONNECTED`.
4. Post failures are soft-fail (logged; submit/rebuild still succeed).

## Setup

1. In Teams: channel → Connectors / Workflows → Incoming Webhook; copy the URL
   (`https://….webhook.office.com/...` or `outlook.office.com/webhook/...`).
2. VibeStandup → Workspace → paste URL → Save Teams webhook.
3. Submit a standup (or Rebuild summary) and confirm the channel message.

## API

| Method   | Path                                        | Notes              |
| -------- | ------------------------------------------- | ------------------ |
| `GET`    | `/api/workspaces/:workspaceId/addons/teams` | Status (no secret) |
| `PUT`    | `/api/workspaces/:workspaceId/addons/teams` | Connect (admin)    |
| `DELETE` | `/api/workspaces/:workspaceId/addons/teams` | Disconnect (admin) |

## Out of scope (for now)

- OAuth Teams app / bot tokens
- Per-team webhooks (workspace-wide webhook posts all teams)
- Adaptive Card rich formatting
