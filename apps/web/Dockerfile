# syntax=docker/dockerfile:1

# ---------- deps : toutes les dépendances (build inclus) ----------
FROM node:20-bookworm-slim AS deps
WORKDIR /app
# openssl : requis par Prisma pour détecter la bonne cible moteur (debian-openssl-3.0.x)
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci

# ---------- build : clients Prisma + build Next ----------
FROM deps AS build
ENV NEXT_TELEMETRY_DISABLED=1
COPY . .
# Valeurs factices : uniquement pour le build (jamais dans l'image finale).
ENV NODE_ENV=production \
    DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build \
    DATABASE_URL_TENANT_TEMPLATE=postgresql://build:build@127.0.0.1:5432/build \
    SESSION_PASSWORD=build-only-dummy-0123456789abcdef \
    S3_ENDPOINT=http://127.0.0.1:9000 \
    S3_ACCESS_KEY_ID=build \
    S3_SECRET_ACCESS_KEY=build \
    S3_BUCKET=build \
    NEXT_PUBLIC_APP_URL=http://localhost:3000
RUN npx prisma generate --schema=./prisma/schema/public.prisma \
 && npx prisma generate --schema=./prisma/schema/tenant.prisma \
 && npm run build

# ---------- prod-deps : dépendances de production seules ----------
FROM node:20-bookworm-slim AS prod-deps
WORKDIR /app
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ---------- image finale ----------
FROM node:20-bookworm-slim AS runner
WORKDIR /app
# libssl3 : nécessaire aux moteurs Prisma au runtime
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000

# tsx sert uniquement aux scripts d'initialisation (init.ts / seed.ts)
# lancés une fois via `docker exec` / terminal Coolify.
RUN npm install -g tsx@4.16.2

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/.next ./.next
COPY --from=build /app/prisma/generated ./prisma/generated

# server.js (serveur custom Next + WebDAV) nécessite le code source pour
# init.ts/seed.ts/tenant-manager (`npx prisma db push` au provisioning tenant).
COPY server.js package.json next.config.mjs tsconfig.json docker-entrypoint.sh ./
COPY prisma/schema ./prisma/schema
COPY public ./public
COPY lib ./lib
COPY init.ts seed.ts ./
COPY scripts ./scripts

EXPOSE 3000
ENTRYPOINT ["sh", "docker-entrypoint.sh"]
