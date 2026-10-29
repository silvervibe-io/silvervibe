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

## Tree-shaking (#129)

`tools/generate-api-client.mjs` rewrites `generated/api/api.ts` after each run to
drop the generator’s `APIS` array (and its side-effect imports).

The package barrel exports **providers + DTOs/enums only**. Import `*DataService`
classes via deep paths so unused addon clients stay out of initial chunks:

```ts
import { provideSilvervibeApiClient, type MeDto } from '@silvervibe/shared/api-client';
import { AuthDataService } from '@silvervibe/shared/api-client/api/auth-data.service';
```

Do not edit files under `src/lib/generated/` by hand (except via the generator
script above).
