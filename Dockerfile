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
EXPOSE 3000
CMD ["node", "server.js"]
