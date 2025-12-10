# Build stage
FROM node:20-alpine as build

WORKDIR /app

# Copy shared package first
COPY shared ./shared

# Setup client
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install

COPY client/tsconfig.json ./
COPY client/tsconfig.app.json ./
COPY client/tsconfig.node.json ./
COPY client/vite.config.ts ./
COPY client/postcss.config.js ./
COPY client/index.html ./
COPY client/src ./src
COPY client/public ./public

# Build
RUN npm run build

# Serve stage
FROM nginx:alpine
COPY --from=build /app/client/dist /usr/share/nginx/html
COPY client/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
