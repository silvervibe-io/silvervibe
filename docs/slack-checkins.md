# Slack DM / slash check-ins (#208)

Members can submit the daily standup from Slack with `/standup`. Answers write
to the same Neon `StandupEntry` path as the web form and trigger the existing
channel digest when reveal is live.

## Behaviour

1. Workspace has Slack connected (OAuth). Admins must **Disconnect + Connect**
   after this feature to grant new bot scopes.
2. Member runs `/standup` (or `/standup <team name>` when on multiple teams).
3. Nest opens a modal (yesterday / today / blockers).
4. On submit, Nest maps Slack user → Silvervibe user (link table, else Slack
   profile email), upserts the standup as `SUBMITTED` with `submittedVia=slack`,
   and rebuilds the digest like a web submit.
5. Web form remains available; Slack is never required.

## Slack app setup (additions)

1. **Slash Commands** → create `/standup`  
   Request URL: `${PUBLIC_API_URL}/addons/slack/commands`  
   (local: `http://localhost:3000/api/addons/slack/commands`)
2. **Interactivity & Shortcuts** → enable  
   Request URL: `${PUBLIC_API_URL}/addons/slack/interactions`
3. Bot scopes (reinstall after change): existing digest scopes plus  
   `commands`, `users:read`, `users:read.email`
4. Set Nest `SLACK_SIGNING_SECRET` (Basic Information → Signing Secret).

## Nest env

| Variable               | Notes                                    |
| ---------------------- | ---------------------------------------- |
| `SLACK_SIGNING_SECRET` | Required for commands / interactions     |
| `SLACK_CLIENT_ID`      | OAuth (includes new scopes on reinstall) |
| `SLACK_CLIENT_SECRET`  | OAuth                                    |

## API (public, signed)

| Method | Path                             | Notes                   |
| ------ | -------------------------------- | ----------------------- |
| `POST` | `/api/addons/slack/commands`     | Slash command           |
| `POST` | `/api/addons/slack/interactions` | Modal `view_submission` |

## Data

- `slack_user_links` — `(slack_team_id, slack_user_id)` → Neon `user_id`
- `standup_entries.submitted_via` — `web` \| `slack` (roster “Answered in Slack”)

## Out of scope (later)

- Scheduled Geekbot-style DM prompts
- Full custom standup question types in Slack
- Teams interactive cards
