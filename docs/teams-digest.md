# Microsoft Teams standup digest

Issues: [#101](https://github.com/silvervibe-io/silvervibe/issues/101) (webhook MVP),
[#106](https://github.com/silvervibe-io/silvervibe/issues/106) (OAuth connect).

## Behaviour

1. A workspace admin clicks **Connect Teams** (Microsoft Entra OAuth).
2. After consent, they pick a Microsoft Team and channel in Workspace admin.
3. Nest stores refresh/access tokens on `AddonConnection` (provider `TEAMS`),
   enables `addons.teams`, and posts digests via Microsoft Graph
   `POST /teams/{id}/channels/{id}/messages`.
4. Post failures are soft-fail (logged; submit/rebuild still succeed).
5. **Disconnect** clears tokens/channel metadata and stops posts.

Legacy Incoming Webhook installs still post via webhook until the admin
disconnects and reconnects with OAuth.

## Azure app setup

1. Entra ID → **App registrations** → New registration (multi-tenant /
   “Accounts in any organizational directory” recommended).
2. **Authentication** → Web redirect URIs:
   - Local: `http://localhost:3000/api/addons/teams/oauth/callback`
   - Prod: `https://api.silvervibe.io/api/addons/teams/oauth/callback`
3. **Certificates & secrets** → New client secret.
4. **API permissions** → Microsoft Graph **delegated**:
   - `ChannelMessage.Send`
   - `Team.ReadBasic.All`
   - `Channel.ReadBasic.All`
   - `offline_access` (plus `openid` / `profile` as requested by the authorize URL)
5. Grant admin consent if your tenant requires it.
6. Copy Application (client) ID and client secret into Nest env.

## Nest / Cloud Run env

| Variable              | Notes                                  |
| --------------------- | -------------------------------------- |
| `TEAMS_CLIENT_ID`     | Entra app client ID                    |
| `TEAMS_CLIENT_SECRET` | Client secret (Secret Manager)         |
| `TEAMS_TENANT_ID`     | Optional; default `organizations`      |
| `TEAMS_REDIRECT_URI`  | Optional override of callback URL      |
| `PUBLIC_API_URL`      | Used to build the default redirect URI |
| `PUBLIC_STANDUP_URL`  | Post-OAuth redirect to Workspace admin |

## API

| Method   | Path                                                         | Notes                        |
| -------- | ------------------------------------------------------------ | ---------------------------- |
| `GET`    | `/api/workspaces/:workspaceId/addons/teams`                  | Status (no secret)           |
| `GET`    | `/api/workspaces/:workspaceId/addons/teams/oauth/start`      | `{ authorizeUrl }`           |
| `GET`    | `/api/addons/teams/oauth/callback`                           | Public; redirects to standup |
| `GET`    | `/api/workspaces/:workspaceId/addons/teams/joined-teams`     | Graph joined teams           |
| `GET`    | `/api/workspaces/:workspaceId/addons/teams/channels?teamId=` | Graph channels               |
| `PUT`    | `/api/workspaces/:workspaceId/addons/teams/channel`          | Save team/channel            |
| `PUT`    | `/api/workspaces/:workspaceId/addons/teams`                  | Deprecated webhook connect   |
| `DELETE` | `/api/workspaces/:workspaceId/addons/teams`                  | Disconnect (admin)           |

## Out of scope (follow-ups)

- Adaptive Cards rich formatting
- Per-standup-team Teams channels
- Bot Framework interactive commands
