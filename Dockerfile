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

FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

COPY package*.json ./
COPY apps/api/package*.json apps/api/
COPY packages/types/package*.json packages/types/
RUN npm ci --omit=dev --workspace=@dockmanage/api --workspace=@dockmanage/types

COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/web/dist ./apps/web/dist
COPY --from=builder /app/packages/types/dist ./packages/types/dist

EXPOSE 4000
CMD ["npm", "run", "start", "-w", "@dockmanage/api"]
