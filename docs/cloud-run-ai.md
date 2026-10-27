# Cloud Run: LangGraph AI (`ai.silvervibe.io`)

Issue: [#29](https://github.com/silvervibe-io/silvervibe/issues/29).

Host the Python FastAPI / LangGraph service on Google Cloud Run and map
**`ai.silvervibe.io`** via Cloudflare.

Nest API hosting: [cloud-run.md](./cloud-run.md).

## Prerequisites

- Google Cloud project with billing (same as Nest API is fine)
- Artifact Registry repository
- Optional `GEMINI_API_KEY` for LLM polish on standup summaries (not required for
  `/health`, echo, or structured standup digests)

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
  --port=8080
```

Do not set `PORT` as an env var — Cloud Run reserves it.

Health probe path: `/health`.

## DNS (Cloudflare → Cloud Run)

Same pattern as `api.silvervibe.io`: a Cloudflare Worker proxies the custom
host to the Cloud Run `*.run.app` URL (Custom Domain + route on the zone).

1. Note the `*.run.app` URL from `gcloud run services describe silvervibe-ai`
   (example: `silvervibe-ai-sdaothtm5q-ew.a.run.app`).
2. Deploy Worker `silvervibe-ai-proxy` that rewrites the request hostname to that
   Cloud Run URL; attach custom domain **`ai.silvervibe.io`** (creates DNS) and
   route `ai.silvervibe.io/*`.
3. Confirm:

```bash
curl -s https://ai.silvervibe.io/health
# {"status":"ok"}
```

## Clients

```bash
PUBLIC_AI_URL=https://ai.silvervibe.io
```

Set the same on Nest Cloud Run (`gcloud run services update silvervibe-api --update-env-vars=PUBLIC_AI_URL=https://ai.silvervibe.io`).
Local default stays `http://localhost:8000` (see `.env.example`).

## Checklist

- [x] Image builds (`nx run ai:docker:build`)
- [x] Local container returns `{"status":"ok"}` on `/health`
- [x] Cloud Run revision healthy (`silvervibe-ai`, europe-west1)
- [x] `ai.silvervibe.io` Worker custom domain + TLS (`silvervibe-ai-proxy`)
- [x] `GET https://ai.silvervibe.io/health` succeeds
- [x] Nest `PUBLIC_AI_URL=https://ai.silvervibe.io` on Cloud Run
