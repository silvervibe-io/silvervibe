# `@silvervibe/shared/api-client`

Angular HttpClient services and DTO interfaces generated from Nest’s OpenAPI
document via **OpenAPI Generator** (`typescript-angular`) — same approach as
funxtion-portal.

## Layout

```text
src/lib/generated/
  api/     # one *DataService per OpenAPI tag (auth, workspaces, …)
  model/   # one file per schema (me-dto.ts, …)
```

## Workflow

```bash
# 1) Export OpenAPI from Nest controllers/DTOs
npm run openapi

# 2) Generate this library
npm run api-client

# Or both:
npm run openapi:client
```

Requires a **Java 11+** runtime (the generator CLI runs a JAR).

`provideSilvervibeApiClient()` maps `API_BASE_URL` from `@silvervibe/shared/auth`
onto OpenAPI Generator’s `BASE_PATH` (strips the trailing `/api` because OpenAPI
paths already include Nest’s global prefix).

Do not edit files under `src/lib/generated/` by hand.
