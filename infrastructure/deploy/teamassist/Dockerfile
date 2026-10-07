# Build from a git-archive context, not a working tree containing local secrets.
FROM node:22-bookworm-slim@sha256:c3de60bf2f9dd0ac6370e6117950ff62d6e339527e7472301c9c78a017978392 AS dependencies
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/backend/package.json ./apps/backend/package.json
COPY apps/frontend/package.json ./apps/frontend/package.json
COPY packages/database/package.json ./packages/database/package.json
COPY packages/shared/package.json ./packages/shared/package.json
RUN pnpm install --frozen-lockfile --ignore-scripts

FROM dependencies AS build
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build && pnpm build:frontend

FROM dependencies AS production-dependencies
# Serialize the two Node-heavy steps on the shared host's bounded builder.
COPY --from=build /app/dist ./dist
RUN CI=true pnpm install --prod --frozen-lockfile --ignore-scripts

FROM node:22-bookworm-slim@sha256:c3de60bf2f9dd0ac6370e6117950ff62d6e339527e7472301c9c78a017978392 AS runtime
ARG SOURCE_REVISION
LABEL org.opencontainers.image.revision=$SOURCE_REVISION
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends default-mysql-client ca-certificates && rm -r /var/lib/apt/lists/*
COPY --from=production-dependencies /app/node_modules ./node_modules
COPY --from=production-dependencies /app/dist ./dist
COPY --from=build /app/apps/frontend/.next ./apps/frontend/.next
COPY --from=build /app/apps/frontend/public ./apps/frontend/public
COPY --from=build /app/apps/frontend/next.config.mjs ./apps/frontend/next.config.mjs
COPY --from=build /app/apps/frontend/package.json ./apps/frontend/package.json
RUN rm -r /app/apps/frontend/.next/cache && mkdir -p /app/backups /app/apps/frontend/.next/cache/images && chown -R node:node /app/backups /app/apps/frontend/.next/cache
USER node
CMD ["node", "dist/index.mjs"]
