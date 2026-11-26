# Privacy notice

Canonical page: [https://silvervibe.io/privacy](https://silvervibe.io/privacy)

Last updated: 26 November 2026. Silver Vibe™ is a personal open-source project.
This markdown mirrors the in-app Transloco `privacy` catalog. It is a working
draft for transparency; have a lawyer review controller identity, legal bases,
retention, rights, and international transfers before relying on it for EEA/UK
customers.

Contact: info@silvervibe.io (delivery: [email-routing.md](./email-routing.md)).

## Who is responsible

The project operator of Silver Vibe acts as controller for personal data
processed through the hosted apps (portal, VibeStandup, VibePoll, VibeRetro,
VibeFeedback, VibeMeeting) and the Nest API.

## What we collect

Depending on which tools you use, we may process:

- **Account** — email, display name, Firebase user id; mirrored in Neon Postgres.
- **Workspace** — membership, roles, plan keys, enabled tools.
- **Standup** — entry text, timezone, work hours, away periods, team digests.
- **Other products** — polls, retros, feedback answers, meeting notes.
- **Invites** — in-app member invites (and invite emails when that feature is used).
- **OAuth add-ons** — connection metadata and tokens for Slack, Teams, Jira,
  Linear, GitHub, GitLab, Bitbucket, and/or Trello when connected.
- **Technical** — logs needed to operate and secure Cloud Run / Cloudflare.

## How we use it

To provide sign-in, workspaces, enabled tools, digests/mentions, and to secure
the service. We do not sell personal data or use it for unrelated advertising.

## Processors and recipients

| Provider                                                             | Role                                                                                    |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Google Firebase Auth                                                 | Sign-in                                                                                 |
| Neon                                                                 | Postgres app database                                                                   |
| Cloudflare                                                           | DNS / Pages frontends                                                                   |
| Google Cloud Run                                                     | Nest API + LangGraph AI                                                                 |
| Slack / Teams / Jira / Linear / GitHub / GitLab / Bitbucket / Trello | Only when a workspace connects that add-on                                              |
| Google Gemini                                                        | Only if AI digests + `GEMINI_API_KEY` are enabled (standup text may be sent for polish) |

## International transfers

Several processors process data in the US or globally. Where GDPR applies,
transfers rely on the safeguards those providers publish (for example SCCs).

## Optional AI polish (Gemini)

Off unless the operator sets `AI_STANDUP_SUMMARY` on the API and a Gemini key
on the AI service. See [ai-standup-summary.md](./ai-standup-summary.md).
Workspace admins should tell members before enabling it.

## Retention and rights

Data is kept while accounts/workspaces exist (plus short backup windows).
Request access, correction, deletion, or a copy via info@silvervibe.io.
EEA/UK users may also contact their supervisory authority.

## Changes

We update the date on this page when the notice changes. We do **not** treat
continued use alone as acceptance of a new policy.
