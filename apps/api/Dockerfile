# Nest API image for Google Cloud Run.
# Build from the repo root:
#   npx nx run api:docker:build
#
# Local smoke (Docker Desktop must be running):
#   docker run --rm -p 8080:8080 -e NODE_ENV=production silvervibe-api
#   curl -s http://localhost:8080/api/health

FROM docker.io/node:24.15.0-alpine AS deps

WORKDIR /app

# Prisma generate needs URL shape only; runtime uses Cloud Run secrets.
ENV DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build?sslmode=disable"
ENV DATABASE_URL_UNPOOLED="postgresql://build:build@127.0.0.1:5432/build?sslmode=disable"

COPY dist/apps/api/package.json dist/apps/api/package-lock.json ./
COPY dist/apps/api/workspace_modules ./workspace_modules
COPY libs/shared/data-access/prisma ./prisma

# Production deps + Prisma CLI (generate only), then drop the CLI.
RUN npm --omit=dev -f ci \
  && npm install prisma@$(node -p "require('./node_modules/@prisma/client/package.json').version") --no-save \
  && npx prisma generate --schema=./prisma/schema.prisma \
  && npm uninstall prisma \
  && npm cache clean --force

FROM docker.io/node:24.15.0-alpine

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=8080

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./
COPY dist/apps/api/main.js ./
COPY --from=deps /app/prisma ./prisma

RUN chown -R node:node /app
USER node
EXPOSE 8080

CMD ["node", "main.js"]
