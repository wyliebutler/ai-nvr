FROM node:20-slim

# Install ffmpeg
RUN apt-get update && \
    apt-get install -y ffmpeg python3 make g++ && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy root tsconfig.json (extended by server)
COPY tsconfig.json ./

# Copy shared package first
COPY shared ./shared

# Setup server
WORKDIR /app/server
COPY server/package*.json ./
RUN npm install

COPY server/tsconfig.json ./
COPY server/src ./src
COPY server/add_camera.js ./
COPY server/restore_feeds.js ./

# Build
RUN npm run build

# Expose port
EXPOSE 7000

# Create directories for data and recordings
RUN mkdir -p data recordings

CMD ["node", "dist/index.js"]
