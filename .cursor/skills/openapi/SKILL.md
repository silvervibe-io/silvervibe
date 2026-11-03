---
name: openapi
description: Generates the Silvervibe OpenAPI document from the NestJS Swagger decorators and keeps Angular clients aligned with it. Use when changing API routes, DTOs, Swagger, or OpenAPI.
---

# OpenAPI

1. Decorate new handlers and DTOs in `apps/api` (`@ApiTags`, `@ApiOperation`, `@ApiProperty`).
2. Generate `openapi/silvervibe.openapi.json` with `npx nx openapi api` (or `npm run openapi`).
3. Swagger UI for local use is `http://localhost:3000/api/docs`.
4. Regenerate the Angular client: `npm run api-client` → `libs/shared/api-client`
   (`@silvervibe/shared/api-client`), with `api/` services and `model/` DTOs.
5. Prefer generated DTOs/enums from `@silvervibe/shared/api-client`. Import
   `*DataService` classes via deep paths (`@silvervibe/shared/api-client/api/…`)
   so unused addon clients tree-shake out of initial bundles (#129). Do not edit
   `src/lib/generated/**` by hand (`generate-api-client.mjs` also strips the
   generator `APIS` array after each run).
6. Apps should call `provideSilvervibeApiClient()` next to `provideSilvervibeAuth()`
   so `BASE_PATH` matches `API_BASE_URL`.

Shortcut for both steps: `npm run openapi:client`.

Requires Java 11+ for OpenAPI Generator.
