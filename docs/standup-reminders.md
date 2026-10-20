# Standup reminders

Issues: [#82](https://github.com/silvervibe-io/silvervibe/issues/82),
[#86](https://github.com/silvervibe-io/silvervibe/issues/86).

## Behaviour

1. Entry/summary “today” uses `StandupConfig.timezone` when `?date=` is omitted.
2. Each team sets `reminderHour` / `reminderMinute` (defaults **09:00** local).
3. `POST /api/jobs/standup-reminders` (cron secret) emails members of workspaces
   with `vibestandup` enabled who have **not submitted** for that team-local day,
   **only** when the team-local clock is in the same **15-minute** bucket as the
   configured send time (run the Scheduler every 15 minutes).
4. Mail goes through Resend ([resend.md](./resend.md)).

## Auth

Set `CRON_SECRET` on Nest. Callers must send:

```http
X-Cron-Secret: <CRON_SECRET>
```

or `Authorization: Bearer <CRON_SECRET>`.

## Local smoke

```bash
# .env
CRON_SECRET=dev-cron
RESEND_API_KEY=re_...
PUBLIC_STANDUP_URL=http://localhost:4201

curl -s -X POST http://localhost:3000/api/jobs/standup-reminders \
  -H "X-Cron-Secret: dev-cron"
```

## Production

See Cloud Scheduler snippet in [cloud-run.md](./cloud-run.md).
