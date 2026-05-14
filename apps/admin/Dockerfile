# ── Stage 1: Install dependencies ────────────────────────────────────────────
FROM node:24-alpine AS deps
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@11.1.2 --activate

# Copy workspace manifests only (no source yet)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/web/package.json ./apps/web/
COPY apps/admin/package.json ./apps/admin/

RUN pnpm install --frozen-lockfile

# ── Stage 2: Build ────────────────────────────────────────────────────────────
FROM node:24-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@11.1.2 --activate

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=deps /app/apps/admin/node_modules ./apps/admin/node_modules

# Copy source (node_modules excluded via .dockerignore)
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter admin build

# ── Stage 3: Production image ─────────────────────────────────────────────────
FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001
ENV HOSTNAME=0.0.0.0

RUN apk add --no-cache curl && \
    addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/apps/admin/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/admin/.next/static     ./apps/admin/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/admin/public           ./apps/admin/public

USER nextjs
EXPOSE 3001
CMD ["node", "apps/admin/server.js"]
