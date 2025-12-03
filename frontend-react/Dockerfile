# 1. Aşama: Build (Oluşturma) Aşaması
FROM node:20-alpine AS build

ARG VITE_API_URL=https://backend-nest-msnd.onrender.com
ENV VITE_API_URL=$VITE_API_URL

WORKDIR /app
COPY package*.json ./
RUN npm install

# LİSANS KONTROLÜ
COPY check-licenses-simple.cjs ./
COPY .license-policy.json ./
RUN node check-licenses-simple.cjs

COPY . .
RUN npm run build

# 2. Aşama: Serve (Sunma) Aşaması
FROM nginx:alpine
RUN rm /etc/nginx/conf.d/default.conf
COPY ./nginx/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
