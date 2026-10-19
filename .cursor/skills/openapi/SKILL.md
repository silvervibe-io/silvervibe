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
5. Prefer importing DTOs / `*DataService` classes from `@silvervibe/shared/api-client`
   instead of hand-rolling response types. Do not edit `src/lib/generated/**` by hand.
6. Apps should call `provideSilvervibeApiClient()` next to `provideSilvervibeAuth()`
   so `BASE_PATH` matches `API_BASE_URL`.

Shortcut for both steps: `npm run openapi:client`.

Requires Java 11+ for OpenAPI Generator.
