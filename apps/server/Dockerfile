# NestJS Server — Multi-stage build
# ============================================================================
FROM node:22-alpine AS builder
RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY apps/server/package.json apps/server/
COPY apps/server/tsconfig.json apps/server/nest-cli.json apps/server/
COPY packages/shared/package.json packages/shared/
COPY packages/shared/tsconfig.json packages/shared/
COPY prisma/schema.prisma prisma/

RUN pnpm install --frozen-lockfile

COPY apps/server/src apps/server/src/
COPY packages/shared/src packages/shared/src/

RUN pnpm prisma:generate
RUN pnpm --filter @wxgzh/server build

# ── Production image ──────────────────────────────────────────────────────
FROM node:22-alpine AS runner
RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /app
COPY --from=builder /app/node_modules node_modules/
COPY --from=builder /app/apps/server/dist apps/server/dist/
COPY --from=builder /app/apps/server/node_modules apps/server/node_modules/
COPY --from=builder /app/apps/server/package.json apps/server/
COPY --from=builder /app/packages/shared/dist packages/shared/dist/
COPY --from=builder /app/packages/shared/package.json packages/shared/
COPY --from=builder /app/prisma prisma/

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "apps/server/dist/main.js"]
