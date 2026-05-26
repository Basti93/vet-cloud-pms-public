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
RUN pnpm --filter admin build

# ── Stage 2: Production image ─────────────────────────────────────────────────
FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001
ENV HOSTNAME=0.0.0.0
# Next.js uses this origin for internal middleware/RSC self-fetches.
ENV __NEXT_PRIVATE_ORIGIN=http://localhost:3001

RUN apk add --no-cache curl && \
    addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/apps/admin/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/admin/.next/static     ./apps/admin/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/admin/public           ./apps/admin/public

RUN sed -i 's/"trustHostHeader":false/"trustHostHeader":true/' apps/admin/server.js && \
    sed -i 's/  hostname,/  hostname: undefined,/' apps/admin/server.js

USER nextjs
EXPOSE 3001
CMD ["node", "apps/admin/server.js"]
