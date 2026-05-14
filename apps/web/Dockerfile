# ── Stage 1: Install & Build ──────────────────────────────────────────────────
FROM node:24-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@11.1.2 --activate

# Copy workspace manifests for dependency install layer caching
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/web/package.json ./apps/web/
COPY apps/admin/package.json ./apps/admin/

RUN pnpm install --frozen-lockfile

# Copy source (node_modules excluded via .dockerignore)
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @vet-cloud/web build

# ── Stage 2: Production image ─────────────────────────────────────────────────
FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
# standalone output unpacks to /app, but Next.js serves public from /app/apps/web/public/
ENV ASSET_PUBLIC_DIR=/app/apps/web/public

RUN apk add --no-cache curl && \
    addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static     ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public           ./apps/web/public

# Pre-create upload dir so Docker initialises the named volume with nextjs ownership.
# Without this Docker creates the volume mount point as root, causing EACCES on upload.
RUN mkdir -p ./apps/web/public/tenant-assets && \
    chown nextjs:nodejs ./apps/web/public/tenant-assets

# Migration runner + its dependencies.
# pnpm hoists drizzle-orm/postgres to workspace root node_modules.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/drizzle-orm  ./node_modules/drizzle-orm
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/postgres      ./node_modules/postgres
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/drizzle           ./drizzle
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/migrate.mjs       ./migrate.mjs
COPY --from=builder                       /app/apps/web/entrypoint.sh     ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

USER nextjs
EXPOSE 3000
CMD ["./entrypoint.sh"]
