# ── Stage 1: Prune monorepo to only web's dependencies ──────────────────────
FROM node:24-alpine AS pruner
WORKDIR /app
RUN npm install -g turbo@1
COPY . .
RUN turbo prune --scope=@vet-cloud/web --docker

# ── Stage 2: Install dependencies ────────────────────────────────────────────
FROM node:24-alpine AS deps
WORKDIR /app
# Copy pruned lockfile + package manifests
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/package-lock.json ./package-lock.json
RUN npm ci

# ── Stage 3: Build ────────────────────────────────────────────────────────────
FROM node:24-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=pruner /app/out/full/ .
# Build only the web app via turbo
RUN npx turbo run build --filter=@vet-cloud/web

# ── Stage 4: Production image ─────────────────────────────────────────────────
FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# Don't run as root
RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

# Copy standalone output produced by next build
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static     ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public           ./apps/web/public

USER nextjs
EXPOSE 3000

# standalone output places server.js at the app subdirectory
CMD ["node", "apps/web/server.js"]
