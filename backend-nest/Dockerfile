# 1. Aşama: Bağımlılıkları Kurma
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm ci --only=production

# 2. Aşama: Uygulama Build
COPY . .
RUN npm run build

# 3. Aşama: Production Image
FROM node:20-alpine
WORKDIR /usr/src/app

# Sadece production dependencies ve build output kopyala
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/package.json ./package.json

EXPOSE 3000

# Production modda çalıştır
CMD ["node", "dist/main"]