FROM node:22-bookworm-slim

# Chromium pour la génération PDF (Puppeteer) + dépendances de polices.
RUN apt-get update && apt-get install -y --no-install-recommends \
      chromium ca-certificates fonts-liberation fonts-dejavu-core openssl \
    && rm -rf /var/lib/apt/lists/*
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    NODE_ENV=production \
    STATIC_DIR=../dist

WORKDIR /app

# Dépendances front + build (devDependencies nécessaires : vite).
COPY package*.json ./
RUN npm ci --include=dev
COPY . .
RUN npm run build

# Dépendances serveur (tsx/prisma en dev) + client Prisma.
RUN npm ci --include=dev --prefix server && npm run prisma:generate --prefix server

EXPOSE 4000
# Migrations puis démarrage (pas de seed → base vide).
CMD ["sh", "-c", "npm run prisma:deploy --prefix server && npm start --prefix server"]
