---
name: openapi
description: Generates the Silvervibe OpenAPI document from the NestJS Swagger decorators and keeps Angular clients aligned with it. Use when changing API routes, DTOs, Swagger, or OpenAPI.
---

# OpenAPI

1. Decorate new handlers and DTOs in `apps/api` (`@ApiTags`, `@ApiOperation`, `@ApiProperty`).
2. Generate `openapi/silvervibe.openapi.json` with `npx nx openapi api`.
3. Swagger UI for local use is `http://localhost:3000/api/docs`.
4. When an Angular app needs a new call, update the typed client in `libs/shared/api-client` to match the generated document. Do not duplicate DTO field names by hand if the spec already lists them.
