# ── Stage 1: Prune monorepo to only admin's dependencies ─────────────────────
FROM node:24-alpine AS pruner
WORKDIR /app
RUN npm install -g turbo@1
COPY . .
RUN turbo prune --scope=admin --docker

# ── Stage 2: Install dependencies ────────────────────────────────────────────
FROM node:24-alpine AS deps
WORKDIR /app
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/package-lock.json ./package-lock.json
RUN npm ci

# ── Stage 3: Build ────────────────────────────────────────────────────────────
FROM node:24-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=pruner /app/out/full/ .
RUN npx turbo run build --filter=admin

# ── Stage 4: Production image ─────────────────────────────────────────────────
FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001

RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/apps/admin/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/admin/.next/static     ./apps/admin/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/admin/public           ./apps/admin/public 2>/dev/null || true

USER nextjs
EXPOSE 3001

CMD ["node", "apps/admin/server.js"]
