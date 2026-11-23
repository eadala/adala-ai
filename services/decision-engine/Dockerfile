FROM node:22-alpine AS builder
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app
COPY package.json ./
RUN pnpm install --frozen-lockfile 2>/dev/null || pnpm install

COPY tsconfig.json build.mjs ./
COPY src/ ./src/
RUN node build.mjs

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY package.json ./
RUN npm install --omit=dev --ignore-scripts 2>/dev/null || true

COPY --from=builder /app/dist ./dist

EXPOSE 3002
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:3002/health || exit 1

CMD ["node", "dist/index.mjs"]
