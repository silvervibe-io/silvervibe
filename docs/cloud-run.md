# Cloud Run: Nest API (`api.silvervibe.io`)

Issue: [#10](https://github.com/silvervibe-io/silvervibe/issues/10).

Host the Nest app on Google Cloud Run and map **`api.silvervibe.io`** via Cloudflare.

LangGraph AI service: [cloud-run-ai.md](./cloud-run-ai.md).

## Prerequisites

- Google Cloud project with billing
- Artifact Registry (or Container Registry) repository
- Neon **production** branch + migrations applied (`npm run prisma:migrate:deploy`)
- Firebase Admin available (ADC via Cloud Run service account, or secret env vars)
- Optional GrowthBook server key

## Container

Pruned Nest output + Prisma client:

```bash
npx nx run api:docker:build
docker run --rm -p 8080:8080 -e NODE_ENV=production silvervibe-api
curl -s http://localhost:8080/api/health
# {"status":"ok"}
```

`api:docker:build` runs **`prune`** (webpack build + pruned lockfile) then
`docker build -f apps/api/Dockerfile -t silvervibe-api .`.

The image listens on **`0.0.0.0:$PORT`** (Cloud Run sets `PORT`, default in the image is `8080`).

## Push + deploy

Replace `PROJECT`, `REGION`, and `REPO` with your values (example region `europe-west1`):

```bash
export PROJECT=your-gcp-project
export REGION=europe-west1
export REPO=silvervibe
export IMAGE="${REGION}-docker.pkg.dev/${PROJECT}/${REPO}/api:latest"

gcloud auth configure-docker "${REGION}-docker.pkg.dev"
docker tag silvervibe-api "$IMAGE"
docker push "$IMAGE"

gcloud run deploy silvervibe-api \
  --project="$PROJECT" \
  --region="$REGION" \
  --image="$IMAGE" \
  --platform=managed \
  --allow-unauthenticated \
  --port=8080 \
  --set-env-vars="NODE_ENV=production,CORS_ORIGINS=https://silvervibe.io,https://www.silvervibe.io,https://standup.silvervibe.io,PUBLIC_STANDUP_URL=https://standup.silvervibe.io,PUBLIC_API_URL=https://api.silvervibe.io/api,EMAIL_FROM=invites@silvervibe.io" \
  --set-secrets="DATABASE_URL=DATABASE_URL:latest,DATABASE_URL_UNPOOLED=DATABASE_URL_UNPOOLED:latest,FIREBASE_PROJECT_ID=FIREBASE_PROJECT_ID:latest,FIREBASE_CLIENT_EMAIL=FIREBASE_CLIENT_EMAIL:latest,FIREBASE_PRIVATE_KEY=FIREBASE_PRIVATE_KEY:latest,GROWTHBOOK_SERVER_KEY=GROWTHBOOK_SERVER_KEY:latest,GROWTHBOOK_API_HOST=GROWTHBOOK_API_HOST:latest,RESEND_API_KEY=RESEND_API_KEY:latest,SLACK_CLIENT_ID=SLACK_CLIENT_ID:latest,SLACK_CLIENT_SECRET=SLACK_CLIENT_SECRET:latest,TEAMS_CLIENT_ID=TEAMS_CLIENT_ID:latest,TEAMS_CLIENT_SECRET=TEAMS_CLIENT_SECRET:latest"
```

Create the Secret Manager secrets first (names above). Prefer attaching a Firebase-capable
service account and omitting `FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY` so Nest uses ADC
([firebase.md](./firebase.md)). Verify `silvervibe.io` in Resend before using
`invites@silvervibe.io` as `EMAIL_FROM`.

Health probe path for Cloud Run (optional): `/api/health`.

## DNS (Cloudflare → Cloud Run)

1. After deploy, note the `*.run.app` URL from `gcloud run services describe silvervibe-api`.
2. Cloudflare DNS → CNAME **`api`** → that Cloud Run hostname (proxied).
3. Cloud Run → domain mapping **or** Cloudflare → SSL/TLS Full (strict) once the cert is ready.

Confirm:

```bash
curl -s https://api.silvervibe.io/api/health
```

## CORS

Set `CORS_ORIGINS` to comma-separated production app origins (see deploy command). Local
defaults stay in `.env.example` (`localhost:4200` / `4201`).

## Angular clients

Point Pages / local env at the public API:

```bash
PUBLIC_API_URL=https://api.silvervibe.io/api
```

## Standup reminder cron

After deploy, schedule weekdays (adjust TZ) against the live API:

```bash
# Secret Manager + Cloud Run env
# CRON_SECRET=<random>
# Then:
gcloud scheduler jobs create http standup-reminders \
  --project="$PROJECT" \
  --location="$REGION" \
  --schedule="*/15 * * * 1-5" \
  --time-zone="UTC" \
  --uri="https://api.silvervibe.io/api/jobs/standup-reminders" \
  --http-method=POST \
  --headers="X-Cron-Secret=${CRON_SECRET}"

# If the job already exists:
gcloud scheduler jobs update http standup-reminders \
  --project="$PROJECT" \
  --location="$REGION" \
  --schedule="*/15 * * * 1-5" \
  --time-zone="UTC"
```

`POST /api/jobs/standup-reminders` emails members who have not **submitted** for
the team’s local calendar day when the team-local clock matches
`StandupConfig.reminderHour` / `reminderMinute` (15-minute window).
Scheduler TZ can stay UTC; matching uses each team’s own timezone.

## Checklist

- [ ] Image builds (`nx run api:docker:build`)
- [ ] Local container returns `{"status":"ok"}` on `/api/health`
- [ ] Secrets in Secret Manager; Cloud Run revision healthy
- [ ] `api.silvervibe.io` CNAME + TLS
- [ ] `GET https://api.silvervibe.io/api/health` succeeds
- [ ] `RESEND_API_KEY`, `PUBLIC_STANDUP_URL`, `EMAIL_FROM`, `CRON_SECRET` set
- [ ] Cloud Scheduler job for standup reminders (optional until reminders ship)
