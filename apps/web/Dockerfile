# ── Stage 1: Install dependencies ────────────────────────────────────────────
FROM node:24-alpine AS deps
WORKDIR /app

# Copy workspace manifests only (no source yet)
COPY package.json package-lock.json .npmrc ./
COPY apps/web/package.json ./apps/web/
COPY apps/admin/package.json ./apps/admin/

# Install all workspace deps so npm correctly resolves cross-workspace
# version conflicts (e.g. @clerk/nextjs ^6 vs ^7)
RUN npm ci

# ── Stage 2: Build ────────────────────────────────────────────────────────────
FROM node:24-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules

# Copy source (node_modules excluded via .dockerignore)
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build --workspace=@vet-cloud/web

# ── Stage 3: Production image ─────────────────────────────────────────────────
FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static     ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public           ./apps/web/public

USER nextjs
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
