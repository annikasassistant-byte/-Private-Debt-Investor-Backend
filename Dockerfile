# =============================================================================
# Multi-stage production Dockerfile — Depth Dashboard API
# =============================================================================

# ----- Base -----
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache dumb-init
ENV NODE_ENV=production

# ----- Dependencies -----
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev && npm cache clean --force

# ----- Build / prune (optional transpile step placeholder) -----
FROM base AS build
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
# No compile step for plain ESM JS — keep layer for future TypeScript builds
RUN npm prune --omit=dev

# ----- Production runner -----
FROM base AS runner
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/src ./src

RUN mkdir -p logs uploads && chown -R nodejs:nodejs /app

USER nodejs
EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||5000)+'/api/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "src/server.js"]
