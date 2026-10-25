# Spécifications techniques détaillées - Phase 0

## Stack final retenu

| Couche | Technologie | Version cible |
|--------|-------------|---------------|
| Framework | Next.js (App Router) | 14+ |
| Langage | TypeScript | 5.x |
| ORM | Prisma | 5.x |
| Base de données | PostgreSQL | 15+ |
| Stockage fichiers | MinIO ou S3-compatible | latest |
| Cache / sessions | Redis | 7.x |
| Auth | next-auth ou iron-session + next-auth | latest |
| Validation | Zod | 3.x |
| UI | Tailwind CSS + shadcn/ui ou Headless UI | latest |
| Recherche | Meilisearch | 1.x |
| OCR | Tesseract (node-tesseract) ou API externe | - |
| Tests | Vitest + Playwright | - |
| Conteneurisation | Docker + Docker Compose | - |

## Structure du projet

```
avocat-platform/
├── apps/
│   └── web/
│       ├── app/                     # App Router Next.js
│       │   ├── (public)/
│       │   ├── (dashboard)/
│       │   ├── api/
│       │   └── layout.tsx
│       ├── components/
│       ├── lib/
│       │   ├── auth.ts
│       │   ├── prisma.ts
│       │   ├── s3.ts
│       │   ├── crypto.ts
│       │   └── audit.ts
│       ├── hooks/
│       ├── types/
│       └── prisma/
│           ├── schema/
│           │   ├── public.prisma    # tenants, subscriptions
│           │   └── tenant.prisma    # modèle du tenant
│           └── migrations/
├── packages/
│   ├── ui/
│   ├── config/
│   └── ts-config/
├── docker-compose.yml
└── README.md
```

## Schéma Prisma

### Schéma `public` (partagé)

```prisma
model Tenant {
  id              String   @id @default(uuid())
  slug            String   @unique
  raisonSociale   String
  adresse         String?
  identifiantFiscal String?
  logoUrl         String?
  domaine         String?  @unique
  configuration   Json?
  actif           Boolean  @default(true)
  createdAt       DateTime @default(now())

  @@map("tenants")
}
```

### Schéma `tenant` (modèle à cloner par cabinet)

```prisma
generator client {
  provider = "prisma-client-js"
  output   = "./generated/client-tenant"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL_TENANT_TEMPLATE")
}

model User {
  id              String    @id @default(uuid())
  email           String    @unique
  passwordHash    String
  prenom          String
  nom             String
  roleId          String
  mfaSecret       String?
  mfaEnabled      Boolean   @default(false)
  actif           Boolean   @default(true)
  derniereConnexion DateTime?
  derniereIp      String?
  appareils       Json?
  createdAt       DateTime  @default(now())
  role            Role      @relation(fields: [roleId], references: [id])
  @@map("users")
}

model Role {
  id                      String   @id @default(uuid())
  nom                     String   @unique
  permissions             Json
  estAdmin                Boolean  @default(false)
  estClient               Boolean  @default(false)
  niveauConfidentialiteMax Int     @default(0)
  users                   User[]
  @@map("roles")
}

model PermissionDossier {
  id        String   @id @default(uuid())
  dossierId String
  userId    String
  niveau    String   // lecture, ecriture, validation, aucun
  createdAt DateTime @default(now())
  @@map("permissions_dossier")
}

model Client {
  id              String   @id @default(uuid())
  type            String   // physique, entreprise, administration
  raisonSociale   String
  identifiant     String?
  adresse         String?
  coordonnees     Json?
  representants   Json?
  billingInfo     Json?
  consentements   Json?
  documentsAdmin  Json?
  createdAt       DateTime @default(now())
  dossiers        Dossier[]
  @@map("clients")
}

model Dossier {
  id                      String   @id @default(uuid())
  referenceInterne        String   @unique
  typeAffaire             String
  natureMission           String
  clientId                String
  client                  Client   @relation(fields: [clientId], references: [id])
  partiesAdverses         Json?
  juridictionId           String?
  avocatResponsableId     String
  huissierResponsableId   String?
  collaborateurs          Json?
  dateOuverture           DateTime @default(now())
  niveauConfidentialite   Int      @default(1)
  statut                  String   @default("Nouveau")
  dateEcheance            DateTime?
  createdAt               DateTime @default(now())
  documents               Document[]
  taches                  Tache[]
  evenements              Evenement[]
  missions                MissionHuissier[]
  factures                Facture[]
  @@map("dossiers")
}

model DossierImmobilier {
  dossierId             String   @id
  adresseBien           String?
  titreFoncier          String?
  natureBien            String?
  proprietaire          String?
  occupant              String?
  montantLitige         Decimal?
  expertId              String?
  notaireId             String?
  documentsPropriete    Json?
  @@map("dossiers_immobiliers")
}

model Document {
  id                String   @id @default(uuid())
  dossierId         String
  dossier           Dossier  @relation(fields: [dossierId], references: [id])
  nom               String
  categorie         String
  s3KeyChiffre      String
  hashSha256        String
  taille            Int
  versionCourante   Int      @default(1)
  publieClient      Boolean  @default(false)
  datePublication   DateTime?
  dateExpiration    DateTime?
  creePar           String
  validePar         String?
  metadata          Json?
  createdAt         DateTime @default(now())
  versions          VersionDocument[]
  @@map("documents")
}

model VersionDocument {
  id              String   @id @default(uuid())
  documentId      String
  document        Document @relation(fields: [documentId], references: [id])
  s3KeyChiffre    String
  numeroVersion   Int
  hashSha256      String
  creePar         String
  createdAt       DateTime @default(now())
  @@map("versions_document")
}

model Tache {
  id            String   @id @default(uuid())
  dossierId     String
  dossier       Dossier  @relation(fields: [dossierId], references: [id])
  titre         String
  description   String?
  responsableId String
  createurId    String
  echeance      DateTime?
  priorite      String   // basse, moyenne, haute, critique
  statut        String   @default("En cours")
  checklist     Json?
  createdAt     DateTime @default(now())
  @@map("taches")
}

model Evenement {
  id            String   @id @default(uuid())
  dossierId     String
  dossier       Dossier  @relation(fields: [dossierId], references: [id])
  type          String   // audience, echeance, rdv, deadline
  titre         String
  dateDebut     DateTime
  dateFin       DateTime?
  lieu          String?
  participants  Json?
  estPublicClient Boolean @default(false)
  createdAt     DateTime @default(now())
  @@map("evenements")
}

model MissionHuissier {
  id                  String   @id @default(uuid())
  dossierId           String
  dossier             Dossier  @relation(fields: [dossierId], references: [id])
  typeActe            String
  huissierId          String
  adresseSignification String?
  destinataire        String?
  datePrevue          DateTime?
  fraisDeplacement    Decimal?
  debours             Decimal?
  dateTentative       DateTime?
  dateRemise          DateTime?
  resultat            String?
  preuveRemiseKey     String?
  statut              String   @default("En préparation")
  retourKey           String?
  createdAt           DateTime @default(now())
  @@map("missions_huissier")
}

model Facture {
  id            String    @id @default(uuid())
  dossierId     String
  dossier       Dossier   @relation(fields: [dossierId], references: [id])
  clientId      String
  numero        String    @unique
  dateEmission  DateTime  @default(now())
  dateEcheance  DateTime?
  honoraires    Json?
  debours       Decimal?
  frais         Decimal?
  totalTtc      Decimal
  statut        String    @default("Brouillon")
  paiements     Paiement[]
  createdAt     DateTime  @default(now())
  @@map("factures")
}

model Paiement {
  id              String   @id @default(uuid())
  factureId       String
  facture         Facture  @relation(fields: [factureId], references: [id])
  montant         Decimal
  datePaiement    DateTime @default(now())
  mode            String
  reference       String?
  preuveKey       String?
  createdAt       DateTime @default(now())
  @@map("paiements")
}

model AuditLog {
  id          String   @id @default(uuid())
  userId      String?
  action      String
  entite      String
  entiteId    String?
  details     Json?
  adresseIp   String?
  userAgent   String?
  createdAt   DateTime @default(now())
  @@index([createdAt])
  @@index([entite, entiteId])
  @@map("audit_logs")
}
```

## Gestion multi-schéma

- Le schéma `public` gère les `Tenant`.
- Un script d'onboarding crée un schéma `tenant_<uuid>` et y exécute les migrations du modèle tenant.
- Prisma génère un client dédié par schéma tenant.
- À la connexion, l'application résout le tenant par `Host` header ou `X-Tenant-ID`, puis instancie le client Prisma correspondant.
- Table `tenant_clients` (en base globale) garde la correspondance `uuid -> DATABASE_URL_TENANT`.

## Endpoints API principaux

Tous les endpoints retournent `JSON`. Toutes les requêtes protégées vérifient session + rôle + accès tenant + accès dossier.

| Méthode | Route | Description | Rôle min |
|---------|-------|-------------|----------|
| POST | `/api/auth/login` | Connexion | public |
| POST | `/api/auth/mfa/verify` | Vérification TOTP | public |
| POST | `/api/auth/logout` | Déconnexion | connecté |
| GET | `/api/users/me` | Profil connecté | connecté |
| GET | `/api/users` | Liste des utilisateurs | admin |
| POST | `/api/users` | Créer un utilisateur | admin |
| GET | `/api/clients` | Liste des clients | assistant+ |
| POST | `/api/clients` | Créer un client | secrétaire+ |
| GET | `/api/clients/:id` | Détail client | assistant+ |
| GET | `/api/dossiers` | Liste des dossiers | assistant+ |
| POST | `/api/dossiers` | Ouvrir un dossier | avocat+ |
| GET | `/api/dossiers/:id` | Détail d'un dossier | droits dossier |
| PATCH | `/api/dossiers/:id/statut` | Changer statut | avocat resp+ |
| GET | `/api/dossiers/:id/documents` | Liste documents | droits dossier |
| POST | `/api/dossiers/:id/documents` | Uploader document | droits dossier |
| GET | `/api/documents/:id` | Télécharger document | droits document |
| POST | `/api/documents/:id/publish` | Publier client | avocat resp+ |
| GET | `/api/taches` | Tâches assignées | connecté |
| POST | `/api/taches` | Créer tâche | avocat resp+ |
| GET | `/api/missions` | Missions huissier | huissier+ |
| POST | `/api/missions` | Créer mission | avocat resp+ |
| GET | `/api/factures` | Liste factures | comptable+ |
| POST | `/api/factures` | Créer facture | comptable+ |
| GET | `/api/audit` | Journal d'audit | auditeur+ |

## Authentification

- next-auth / iron-session avec cookies `httpOnly`, `Secure`, `SameSite=Strict`.
- JWT contenant `userId`, `tenantId`, `role`.
- Refresh token stocké dans Redis ou cookie longue durée.
- TOTP avec `speakeasy` ou `otpauth`.
- Hash Argon2id avec `argon2`.

## Chiffrement des documents

```ts
// Génération clé de document
const dek = crypto.randomBytes(32);

// Chiffrement fichier
const iv = crypto.randomBytes(16);
const cipher = crypto.createCipheriv('aes-256-gcm', dek, iv);

// Chiffrement DEK avec clé publique du tenant
const encryptedDek = crypto.publicEncrypt(tenantPublicKey, dek);

// Stockage
// - fichier chiffré sur S3/MinIO
// - encryptedDek + iv + authTag en base (Document.metadata)
```

- Clé publique du tenant stockée en clair.
- Clé privée du tenant chiffrée avec un secret maître ou HSM.
- Rotation : re-chiffrement des DEK avec une nouvelle paire de clés.

## Déploiement Docker

```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://user:pass@postgres:5432/avocat
      - REDIS_URL=redis://redis:6379
      - S3_ENDPOINT=http://minio:9000
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: avocat
      POSTGRES_USER: user
      POSTGRES_PASSWORD: pass
    volumes:
      - pgdata:/var/lib/postgresql/data
  redis:
    image: redis:7
  minio:
    image: minio/minio
    command: server /data --console-address ":9001"
    volumes:
      - miniodata:/data
volumes:
  pgdata:
  miniodata:
```

## Tests

- **Unitaires** : Vitest pour les fonctions métier et helpers.
- **Intégration** : tests d'API avec base de test isolée.
- **E2E** : Playwright pour les parcours critiques (login, ouverture dossier, upload, changement statut).

## Conformité CDP

- Consentements enregistrés avec date, version et finalité.
- Droit d'accès : export des données personnelles d'un client.
- Droit de rectification : modification traçée.
- Droit d'opposition : marquage dans la base.
- Durées de conservation paramétrables par catégorie.
- Anonymisation possible à la clôture si demandée.
