# Guide d'installation - Plateforme de gestion de cabinet

## Prérequis

- Windows 10/11, macOS ou Linux
- Node.js 20 LTS ou supérieur
- npm 10 ou supérieur
- Docker + Docker Compose
- Git (optionnel)

## Démarrage rapide

### 1. Récupération du projet

```powershell
cd C:\xampp\htdocs\Avocat\apps\web
```

### 2. Installation des dépendances

```powershell
npm install
```

### 3. Configuration de l'environnement

```powershell
cp .env.example .env
```

Configurez au minimum les variables suivantes dans `.env` :

```env
DATABASE_URL=postgresql://avocat:avocat@localhost:5432/avocat
REDIS_URL=redis://localhost:6379
SESSION_PASSWORD=une_chaine_de_32_octets_au_moins_ici_!!
S3_ENDPOINT=http://localhost:9000
S3_REGION=us-east-1
S3_ACCESS_KEY_ID=minioadmin
S3_SECRET_ACCESS_KEY=minioadmin
S3_BUCKET=avocat-documents
MEILISEARCH_HOST=http://localhost:7700
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

> **Important** : `SESSION_PASSWORD` doit faire au moins 32 caractères.

### 4. Démarrage de l'infrastructure

Depuis la racine `Avocat/` :

```powershell
cd C:\xampp\htdocs\Avocat
docker-compose up -d
```

Cela démarre PostgreSQL, Redis, MinIO et Meilisearch.

### 5. Initialisation de la base et du premier cabinet

```powershell
cd C:\xampp\htdocs\Avocat\apps\web
npm run db:init
```

Cette commande unique effectue :
- la génération des clients Prisma public et tenant ;
- la création du schéma `public` et de la table `tenants` ;
- la création du premier cabinet (`default`) et de son schéma PostgreSQL ;
- l'injection des rôles et des comptes de test ;
- l'ajout de `DEFAULT_TENANT_ID` dans votre `.env`.

### 6. Démarrage du serveur de développement

```powershell
npm run dev
```

Ouvrir le navigateur à : http://localhost:3000

## Accès à l'application

### Espace cabinet

- URL : http://localhost:3000/login
- E-mail : `admin@cabinet.sn`
- Mot de passe : `Admin1234!`

### Espace client

- URL : http://localhost:3000/client/login
- Comptes clients à créer depuis le dashboard

## Arrêt de l'application

Arrêter le serveur de développement : `Ctrl + C`

Arrêter Docker :

```powershell
cd C:\xampp\htdocs\Avocat
docker-compose down
```

Pour supprimer les données et repartir à zéro :

```powershell
docker-compose down -v
```

## Commandes utiles

| Commande | Description |
|----------|-------------|
| `npm run dev` | Démarrer le serveur Next.js |
| `npm run build` | Builder pour la production |
| `npm run start` | Démarrer en production |
| `npm run db:init` | Initialisation complète du premier cabinet |
| `npm run db:seed` | Recréer rôles et comptes de test |
| `npm run test` | Lancer Vitest |
| `npx prisma migrate dev --schema=./prisma/schema/tenant.prisma` | Créer une migration tenant |

## Dépannage

### `node` ou `npm` non reconnu

Vérifiez que Node.js est installé et dans le `PATH`. Redémarrez le terminal après l'installation.

### Erreur de connexion à PostgreSQL

Vérifiez que Docker est démarré et que le conteneur `avocat-postgres` est actif :

```powershell
cd C:\xampp\htdocs\Avocat
docker-compose up -d postgres
```

### Erreur `PrismaClientInitializationError`

Régénérez les clients Prisma :

```powershell
npx prisma generate --schema=./prisma/schema/public.prisma
npx prisma generate --schema=./prisma/schema/tenant.prisma
```

### `npm run db:init` échoue

Vérifiez que :
- le fichier `.env` existe et contient `DATABASE_URL` et `SESSION_PASSWORD` ;
- `SESSION_PASSWORD` fait au moins 32 caractères ;
- `docker-compose up -d` a bien démarré les services.

### Le middleware redirige vers `/login` en boucle

Vérifiez que `SESSION_PASSWORD` est bien renseigné et que `.env` est chargé. Next.js charge automatiquement `.env` à la racine du projet.

### Impossible d'uploader un document

Vérifiez que MinIO est démarré et accessible à `http://localhost:9000`. Vérifiez aussi les variables `S3_*` dans `.env`.

## Production

En production :
- Utilisez `npm run build` puis `npm run start` ;
- Remplacez `SESSION_PASSWORD` par un secret fort ;
- Utilisez HTTPS ;
- Définissez `NODE_ENV=production` ;
- Utilisez des services PostgreSQL, Redis, S3 et Meilisearch managés ;
- Activez le MFA pour tous les administrateurs ;
- Sauvegardez régulièrement la base et les fichiers.
