---
applyTo: 'apps/api/**/*.ts,libs/shared/data-access/**/*'
---

# Nest API / Prisma review

## Comment only on

- Auth gaps on protected routes (missing guard where one is required)
- Secrets logged or committed
- Unsafe raw SQL / Prisma misuse that can leak or corrupt data
- Incorrect env handling for production vs local `dev:` bearer

## Do not comment on

- Module layout under `apps/api/src/app/addons/` for integrations
- Placeholder Firebase / GrowthBook config when clearly local/dev
- Style / formatting (CI handles it)
