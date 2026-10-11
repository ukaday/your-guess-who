# syntax=docker/dockerfile:1.7
# Build context is the repo root: docker build -f backend/Dockerfile .

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/
COPY packages/contract/package.json ./packages/contract/
RUN npm ci -w backend

FROM deps AS builder
WORKDIR /app/backend
COPY backend/tsconfig.json ./
COPY backend/prisma ./prisma
COPY backend/prisma.config.ts ./
RUN npx prisma generate
COPY packages/contract /app/packages/contract
COPY backend/src ./src
RUN npx tsc

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/
COPY packages/contract/package.json ./packages/contract/
RUN npm ci -w backend --omit=dev
WORKDIR /app/backend
COPY --from=builder /app/backend/prisma ./prisma
COPY --from=builder /app/backend/prisma.config.ts ./
COPY --from=builder /app/backend/dist ./dist
USER node
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
