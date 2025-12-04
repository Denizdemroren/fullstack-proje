# 1. Aşama: Bağımlılıkları Kurma
FROM node:20-alpine AS builder
WORKDIR /usr/src/app

# Git'i kur
RUN apk add --no-cache git

COPY package*.json ./
RUN npm install

# LİSANS KONTROLÜ - Build aşamasında yap
COPY check-licenses-simple.js ./
COPY .license-policy.json ./
RUN node check-licenses-simple.js

# 2. Aşama: Uygulama Build
COPY . .
RUN npm run build

# 3. Aşama: Production Image
FROM node:20-alpine
WORKDIR /usr/src/app

# Production'da da git'i kur
RUN apk add --no-cache git

COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/package.json ./package.json

EXPOSE 3000
CMD ["node", "dist/main"]