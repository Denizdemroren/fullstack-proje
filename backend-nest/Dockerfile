# 1. Aşama: Bağımlılıkları Kurma (Daha hızlı rebuild ve küçük konteyner için)
FROM node:20-alpine AS builder

# Konteynerin çalışma dizinini belirliyoruz
WORKDIR /usr/src/app

# package.json ve package-lock.json dosyalarını kopyalayıp
COPY package*.json ./

# Node paketlerini kuruyoruz
RUN npm install

# 2. Aşama: Uygulama Kodunu Kopyalama ve Çalıştırma
FROM node:20-alpine
WORKDIR /usr/src/app

# İlk aşamadan kurulan node_modules'ü kopyala
COPY --from=builder /usr/src/app/node_modules ./node_modules

# Kalan tüm uygulama kodunu kopyala
COPY . .

# Uygulamanın dinleyeceği portu (3000) dışarıya aç
EXPOSE 3000

# Konteyner başladığında çalışacak komut (geliştirme modu)
CMD ["npm", "run", "start:dev"]