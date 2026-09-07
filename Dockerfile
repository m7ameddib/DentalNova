# syntax=docker/dockerfile:1

# ── Build stage ──────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY server/package.json ./server/
COPY client/package.json ./client/

RUN npm ci

COPY database ./database
COPY server ./server
COPY client ./client

RUN npm run build

RUN npm ci --omit=dev

# ── Production stage ─────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS production

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libsqlite3-0 \
    && rm -rf /var/lib/apt/lists/*

RUN groupadd --system dentalnova && useradd --system --gid dentalnova dentalnova

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/server/package.json ./server/package.json
COPY --from=builder /app/server/keys ./server/keys
COPY --from=builder /app/client/dist ./server/public
COPY --from=builder /app/database ./database

RUN mkdir -p /data && chown -R dentalnova:dentalnova /data /app

ENV NODE_ENV=production \
    DEPLOYMENT_MODE=online \
    SERVE_CLIENT=1 \
    DNT_DATA_DIR=/data \
    MIGRATIONS_DIR=/app/database/migrations \
    PORT=4000 \
    HOST=0.0.0.0

WORKDIR /app/server

EXPOSE 4000

VOLUME ["/data"]

USER dentalnova

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:4000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/main.js"]
