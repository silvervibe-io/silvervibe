# Cloud Run: LangGraph AI (`ai.silvervibe.io`)

Issue: [#29](https://github.com/silvervibe-io/silvervibe/issues/29).

Host the Python FastAPI / LangGraph service on Google Cloud Run and map
**`ai.silvervibe.io`** via Cloudflare.

Nest API hosting: [cloud-run.md](./cloud-run.md).

## Prerequisites

- Google Cloud project with billing (same as Nest API is fine)
- Artifact Registry repository
- Optional model / LangSmith keys later (not required for `/health` + echo graph)

## Container

```bash
npx nx run ai:docker:build
docker run --rm -p 8080:8080 silvervibe-ai
curl -s http://localhost:8080/health
# {"status":"ok"}
```

`ai:docker:build` runs
`docker build -f apps/ai/Dockerfile -t silvervibe-ai apps/ai` (uv sync from
`pyproject.toml` + `uv.lock`).

The image listens on **`0.0.0.0:$PORT`** (Cloud Run sets `PORT`, default `8080`).

## Push + deploy

```bash
export PROJECT=your-gcp-project
export REGION=europe-west1
export REPO=silvervibe
export IMAGE="${REGION}-docker.pkg.dev/${PROJECT}/${REPO}/ai:latest"

gcloud auth configure-docker "${REGION}-docker.pkg.dev"
docker tag silvervibe-ai "$IMAGE"
docker push "$IMAGE"

gcloud run deploy silvervibe-ai \
  --project="$PROJECT" \
  --region="$REGION" \
  --image="$IMAGE" \
  --platform=managed \
  --allow-unauthenticated \
  --port=8080 \
  --set-env-vars="PORT=8080"
```

Health probe path: `/health`.

## DNS (Cloudflare → Cloud Run)

1. Note the `*.run.app` URL from `gcloud run services describe silvervibe-ai`.
2. Cloudflare DNS → CNAME **`ai`** → that hostname (proxied).
3. Confirm:

```bash
curl -s https://ai.silvervibe.io/health
```

## Clients

```bash
PUBLIC_AI_URL=https://ai.silvervibe.io
```

Local default stays `http://localhost:8000` (see `.env.example`).

## Checklist

- [ ] Image builds (`nx run ai:docker:build`)
- [ ] Local container returns `{"status":"ok"}` on `/health`
- [ ] Cloud Run revision healthy
- [ ] `ai.silvervibe.io` CNAME + TLS
- [ ] `GET https://ai.silvervibe.io/health` succeeds
