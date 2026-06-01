# React Web — Multi-stage build with Nginx
# ============================================================================
FROM node:22-alpine AS builder
RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY apps/web/package.json apps/web/
COPY apps/web/vite.config.ts apps/web/tsconfig.node.json apps/web/
COPY apps/web/index.html apps/web/postcss.config.js apps/web/tailwind.config.ts apps/web/
COPY packages/shared/package.json packages/shared/
COPY packages/shared/tsconfig.json packages/shared/

RUN pnpm install --frozen-lockfile

COPY apps/web/src apps/web/src/
COPY packages/shared/src packages/shared/src/

RUN pnpm --filter @wxgzh/web build

# ── Nginx production image ───────────────────────────────────────────────
FROM nginx:alpine
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
