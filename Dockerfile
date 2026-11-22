# GRND — the Mini App server, built in two stages so the image holds no build tools.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY server.js ./
COPY backend ./backend
COPY dist ./dist
COPY data ./data
COPY design ./design
COPY docs ./docs
# Ilja, 2026-11-21: the app ran as root, so every file it wrote belonged to root and the host user could
# no longer overwrite it. `node` is uid 1000, the same as the host user who owns the volume.
RUN mkdir -p uploads && chown -R node:node /app/uploads /app/data
USER node
EXPOSE 3000
CMD ["node", "server.js"]
