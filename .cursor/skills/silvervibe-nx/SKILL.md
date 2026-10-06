---
name: silvervibe-nx
description: Navigates the Silvervibe Nx monorepo and generates Angular apps, NestJS add-ons, and the Python AI service with the correct tags and ports. Use when adding a project, library, app, or when the user mentions Nx, silvervibe, or vibestandup.
---

# Silvervibe Nx workspace

## Layout

| Project | Path | Port | Tags |
| --- | --- | --- | --- |
| silvervibe | `apps/silvervibe` | 4200 | `type:app`, `scope:silvervibe` |
| vibestandup | `apps/vibestandup` | 4201 | `type:app`, `scope:vibestandup` |
| api | `apps/api` | 3000 | `type:app`, `scope:api` |
| ai | `apps/ai` | 8000 | `type:app`, `scope:ai` |
| shared ui | `libs/shared/ui` | — | `type:ui`, `scope:shared` |

## Platform (planned libs)

| Concern | Approach |
| --- | --- |
| Entitlements / Prisma | `libs/shared/data-access` (Neon) |
| OpenFeature client | `libs/shared/feature-flags` |
| Hosting | Cloudflare Pages + Cloud Run — see `docs/platform.md` |

## Commands

```bash
npx nx serve silvervibe
npx nx serve vibestandup
npx nx serve api
npx nx serve ai
npx nx run-many -t lint test build
```

## New Angular app

```bash
npx nx g @nx/angular:application apps/<name> --prefix=<prefix> --port=<port> --routing --ssr=false --zoneless --e2eTestRunner=playwright --unitTestRunner=vitest --style=css --tags=type:app,scope:<name>
```

Then import shared Tailwind styles and `sv-shell`.

## New shared library

```bash
npx nx g @nx/angular:library libs/shared/<name> --prefix=sv --unitTestRunner=vitest --changeDetection=OnPush --tags=type:ui,scope:shared
```

Export new symbols from the library `index.ts`.
