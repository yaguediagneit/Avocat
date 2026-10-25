# Avocat Web

Squelette de la plateforme de gestion de cabinet multidisciplinaire.

## Prérequis

- Node.js 20+
- npm 10+
- Docker + Docker Compose (optionnel)

## Installation

```bash
cd apps/web
cp .env.example .env
npm install
```

## Démarrage local avec Docker

```bash
docker-compose up -d
```

Cela démarre PostgreSQL, Redis, MinIO et Meilisearch.

## Migrations Prisma

```bash
npx prisma migrate dev --schema=./prisma/schema/public.prisma
npx prisma generate --schema=./prisma/schema/public.prisma
npx prisma generate --schema=./prisma/schema/tenant.prisma
```

## Démarrage du serveur de développement

```bash
npm run dev
```

Ouvrez http://localhost:3000.

## Structure

- `app/` : pages et routes API Next.js
- `components/` : composants React
- `lib/` : utilitaires (auth, crypto, s3, audit, prisma)
- `prisma/schema/` : modèles public et tenant
- `types/` : types TypeScript partagés

## Tests

```bash
npm run test
```

## Notes

- Le multi-tenant par schéma nécessite un outil de création de schéma à l'ouverture d'un cabinet.
- Le chiffrement client-side est préparé mais l'intégration complète est dans le `TODO`.
- Les routes `app/api/*` sont des stubs avec validation Zod.
