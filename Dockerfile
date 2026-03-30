# syntax=docker/dockerfile:1.7

FROM node:22-alpine AS builder
WORKDIR /app

COPY package*.json ./
COPY apps/api/package*.json apps/api/
COPY apps/web/package*.json apps/web/
COPY packages/types/package*.json packages/types/

RUN npm ci

COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS prod-deps
WORKDIR /app

COPY package*.json ./
COPY apps/api/package*.json apps/api/
COPY packages/types/package*.json packages/types/
RUN npm ci --omit=dev --workspace=@dockmanage/api --workspace=@dockmanage/types && npm cache clean --force

FROM gcr.io/distroless/nodejs22-debian12:nonroot AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/apps/api/package.json ./apps/api/package.json
COPY --from=prod-deps /app/packages/types/package.json ./packages/types/package.json

COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/web/dist ./apps/web/dist
COPY --from=builder /app/packages/types/dist ./packages/types/dist

EXPOSE 4000
CMD ["apps/api/dist/server.js"]
