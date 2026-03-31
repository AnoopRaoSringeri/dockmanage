# syntax=docker/dockerfile:1.7

# --- STAGE 1: BUILDER ---
FROM node:22-alpine AS builder
WORKDIR /app

COPY package*.json ./
COPY apps/api/package*.json apps/api/
COPY apps/web/package*.json apps/web/
COPY packages/types/package*.json packages/types/

RUN npm ci

COPY . .
RUN npm run build

# --- STAGE 2: PRODUCTION DEPENDENCIES ---
FROM node:22-bookworm-slim AS prod-deps
WORKDIR /app

COPY package*.json ./
COPY apps/api/package*.json apps/api/
COPY packages/types/package*.json packages/types/
RUN npm ci --omit=dev --workspace=@dockmanage/api --workspace=@dockmanage/types && npm cache clean --force

# --- STAGE 3: RUNNER ---
# Switching from Distroless to Bookworm-Slim to allow binary installation
FROM node:22-bookworm-slim AS runner
WORKDIR /app

# 1. Install Docker CLI (Required for 'docker-compose' npm package to work)
RUN apt-get update && apt-get install -y \
    ca-certificates \
    curl \
    gnupg \
    && install -m 0755 -d /etc/apt/keyrings \
    && curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg \
    && chmod a+r /etc/apt/keyrings/docker.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian bookworm stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null \
    && apt-get update && apt-get install -y docker-ce-cli \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=4000

# Copy node_modules and package definitions
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/apps/api/package.json ./apps/api/package.json
COPY --from=prod-deps /app/packages/types/package.json ./packages/types/package.json

# Copy compiled build artifacts
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/web/dist ./apps/web/dist
COPY --from=builder /app/packages/types/dist ./packages/types/dist

EXPOSE 4000

# Standard Node execution (Distroless entrypoint won't work here)
CMD ["node", "apps/api/dist/server.js"]