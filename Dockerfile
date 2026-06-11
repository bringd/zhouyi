# 易象阁 (Zhouyi Studio) production image
# Multi-stage: build frontend + backend, single image runs both via Express serving dist/.

# ---- Stage 1: Build frontend (Vite) ----
FROM node:20-alpine AS frontend-builder
WORKDIR /frontend

# Install deps separately for better layer caching
COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
RUN npm run build

# ---- Stage 2: Build backend (tsc) ----
FROM node:20-alpine AS backend-builder
WORKDIR /app/server

COPY server/package.json server/package-lock.json* ./
RUN npm ci

COPY server/ ./
RUN npm run build

# ---- Stage 3: Install production backend deps only ----
FROM node:20-alpine AS backend-deps
WORKDIR /app/server

COPY server/package.json server/package-lock.json* ./
RUN npm ci --omit=dev && npm cache clean --force

# ---- Stage 4: Runtime ----
FROM node:20-alpine
WORKDIR /app

# Copy built artifacts
COPY --from=frontend-builder /frontend/dist ./dist
COPY --from=backend-builder  /app/server/dist  ./server/dist
COPY --from=backend-deps     /app/server/node_modules ./server/node_modules
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
