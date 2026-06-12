# 易象阁 (Zhouyi Studio) BACKEND production image (Fly.io).
# Frontend is hosted separately on Cloudflare Pages — see docs/deploy/cloudflare-pages.md
# This image runs ONLY the Express API + (optionally) connects to a separate Fly Postgres.

# ---- Stage 1: Build backend (tsc) ----
FROM node:20-alpine AS backend-builder
WORKDIR /app/server

COPY server/package.json server/package-lock.json* ./
RUN npm ci

COPY server/ ./
RUN npm run build

# ---- Stage 2: Install production backend deps only ----
FROM node:20-alpine AS backend-deps
WORKDIR /app/server

COPY server/package.json server/package-lock.json* ./
RUN npm ci --omit=dev && npm cache clean --force

# ---- Stage 3: Runtime ----
FROM node:20-alpine
WORKDIR /app

# Copy built artifacts
COPY --from=backend-builder /app/server/dist       ./server/dist
COPY --from=backend-deps    /app/server/node_modules ./server/node_modules
COPY server/package.json     ./server/package.json

# Fly.io internal port convention: 8080 for HTTP services
ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

# Health check (graceful: Fly waits for this before routing traffic)
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

# Non-root runtime
USER node

CMD ["node", "server/dist/index.js"]

