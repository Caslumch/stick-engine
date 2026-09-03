# Build do @jarvis/api em monorepo pnpm.
# Contexto de build: raiz do repositorio.
FROM node:22-slim AS base
RUN corepack enable
WORKDIR /repo

# ─── deps ────────────────────────────────────────────────────
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --filter @jarvis/api... --filter @jarvis/shared

# ─── build ───────────────────────────────────────────────────
FROM deps AS build
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @jarvis/shared build \
 && pnpm --filter @jarvis/api exec prisma generate \
 && pnpm --filter @jarvis/api build

# ─── runtime ─────────────────────────────────────────────────
FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/package.json ./
COPY --from=build /repo/packages/shared/dist packages/shared/dist
COPY --from=build /repo/packages/shared/package.json packages/shared/
COPY --from=build /repo/packages/shared/node_modules packages/shared/node_modules
COPY --from=build /repo/apps/api/dist apps/api/dist
COPY --from=build /repo/apps/api/package.json apps/api/
COPY --from=build /repo/apps/api/prisma apps/api/prisma
COPY --from=build /repo/apps/api/node_modules apps/api/node_modules

WORKDIR /repo/apps/api
EXPOSE 3000
CMD ["node", "dist/main"]
