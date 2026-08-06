# ---------- Build stage ----------
FROM node:20-bookworm-slim AS builder
RUN apt-get update && apt-get install -y openssl
WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma
RUN npm ci

COPY . .
RUN npx prisma generate
RUN npm run build

# ---------- Production stage ----------
FROM node:20-bookworm-slim AS production
RUN apt-get update && apt-get install -y openssl
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev
RUN npx prisma generate

COPY --from=builder /app/dist ./dist

EXPOSE 4000
CMD ["node", "dist/main"]
