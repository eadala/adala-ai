# ══════════════════════════════════════════════════════════
#  عدالة AI — Dockerfile للنشر على Hetzner + Coolify
#  Multi-stage: Build → Production
# ══════════════════════════════════════════════════════════

# ── Stage 1: Builder ─────────────────────────────────────
FROM node:22-alpine AS builder

# Install pnpm
RUN npm install -g pnpm@9

WORKDIR /app

# Copy workspace manifests first (for layer caching)
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc tsconfig.base.json ./
# Copy lib packages (shared across workspace)
COPY lib/ ./lib/

# Copy artifacts source
COPY artifacts/api-server/ ./artifacts/api-server/
COPY artifacts/adala/      ./artifacts/adala/

# Install ALL workspace dependencies
RUN pnpm install --no-frozen-lockfile

# Build frontend (Vite → static HTML/JS/CSS)
RUN pnpm --filter @workspace/adala build

# Build backend (esbuild → single bundled dist/index.mjs)
RUN pnpm --filter @workspace/api-server build


# ── Stage 2: Production ──────────────────────────────────
FROM node:22-alpine AS production

# Security: run as non-root
RUN addgroup -g 1001 -S adala && adduser -u 1001 -S adala -G adala

WORKDIR /app

# Copy built backend (single bundled file + pino workers)
COPY --from=builder --chown=adala:adala /app/artifacts/api-server/dist/ ./dist/

# Copy built frontend static files (vite → dist4/public, build script → dist-stable)
COPY --from=builder --chown=adala:adala /app/artifacts/adala/dist-stable/ ./public/
COPY --from=builder --chown=adala:adala /app/node_modules/ ./node_modules/
COPY --from=builder --chown=adala:adala /app/artifacts/api-server/node_modules/ ./artifacts/api-server/node_modules/


USER adala

# Tell the Express server to serve ./public in production
ENV NODE_ENV=production
ENV PUBLIC_DIR=/app/public
ENV PORT=8080

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:8080/api/health || exit 1

CMD ["node", "--max-old-space-size=512", "./dist/index.mjs"]
