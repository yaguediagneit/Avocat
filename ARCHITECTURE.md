# Architecture technique - Plateforme de gestion de cabinet

## Vue d'ensemble

Architecture monolithique modulaire, multi-tenant par cabinet, avec isolation stricte des données. Prévue pour évoluer vers une architecture orientée services si le besoin de multi-cabinet commercial se confirme.

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Client (navigateur / PWA)                   │
│                  Next.js + TypeScript (App Router)                  │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼ HTTPS / TLS 1.3
┌─────────────────────────────────────────────────────────────────────┐
│                         Reverse proxy (Nginx)                       │
│                         WAF, rate limiting                          │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         Application backend                         │
│              Next.js (API Routes) + Prisma ORM (Node.js)            │
│                                                                     │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────────┐  │
│  │  Auth   │ │ Dossiers│ │Documents│ │ Factures│ │   Audit     │  │
│  │  RBAC   │ │         │ │         │ │         │ │             │  │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                                  │
              ┌───────────────────┼───────────────────┐
              ▼                   ▼                   ▼
    ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
    │   PostgreSQL    │  │   S3 / MinIO    │  │   Redis         │
    │ (schémas tenant)│  │  (fichiers      │  │  (sessions,     │
    │  chiffrée RLS   │  │   chiffrés E2E) │  │   cache, OTP)   │
    └─────────────────┘  └─────────────────┘  └─────────────────┘
```

## Stack technique retenu

| Couche | Technologie | Justification |
|--------|-------------|---------------|
| Full-stack | Next.js 14+ (App Router) + TypeScript | SSR, routes API, authentification intégrée, typage |
| ORM | Prisma | Modélisation relationnelle, migrations, sécurité requêtes |
| Base de données | PostgreSQL 15+ | ACID, JSONB, schémas par tenant, pg_trgm, row-level security |
| Fichiers | S3-compatible (MinIO / AWS S3) | Versioning, chiffrement serveur, accès pré-signé |
| Cache / sessions | Redis + next-auth / iron-session | Sessions stateless, rate limiting, OTP temporaires |
| Recherche | Meilisearch ou PostgreSQL full-text | Recherche rapide dans noms et contenus OCR |
| OCR | Tesseract / AWS Textract / Google Vision | Extraction du contenu des PDF scannés |
| Signature électronique | Prestataire qualifié local ou Docusign | Conformité légale sénégalaise |
| Paiement | Wave, PayDunya, Stripe | Selon disponibilité locale |
| Infra | VPS/cloud privé, backups géo-redondants | Maîtrise et souveraineté des données |

## Multi-tenant par schéma PostgreSQL

Chaque cabinet dispose d'un schéma PostgreSQL isolé : `tenant_<uuid>`.

- Création d'un cabinet = création d'un schéma + exécution des migrations Prisma ciblées.
- L'application sélectionne le schéma actif à partir du sous-domaine (`cabinet.exemple.sn`) ou d'un header `X-Tenant-ID` validé côté serveur.
- Prisma n'a pas de support natif multi-schéma dynamique simple : utiliser une pool de connexions par tenant avec `search_path` ou une abstraction Prisma par schéma.
- Alternative à moyen terme : passer à une base dédiée par tenant si le volume le justifie.

Avantages :
- Isolation forte des données métier.
- Sauvegarde et restauration indépendantes par cabinet.
- Personnalisation du schéma possible (champs spécifiques).

Contraintes :
- Migrations à appliquer sur N schémas (outillage d'ops nécessaire).
- Surveillance des ressources par tenant.

## Modèle de données (tables principales)

Les tables suivantes résident dans le schéma du tenant. Les tables globales (`tenants`, `subscriptions`, `plans`) restent dans le schéma `public`.

### `tenants` (schéma `public`)
- `id` (uuid), `slug`, `raison_sociale`, `adresse`, `identifiant_fiscal`, `logo_url`, `domaine`, `configuration`, `created_at`, `actif`

### `users` (schéma tenant)
- `id`, `email`, `password_hash`, `prenom`, `nom`, `role_id`, `mfa_secret`, `actif`, `derniere_connexion`, `derniere_ip`, `appareils` (JSON), `created_at`

### `roles` (schéma tenant)
- `id`, `nom`, `permissions` (JSON), `est_admin`, `est_client`, `niveau_confidentialite_max`

### `permissions_dossier`
- `id`, `dossier_id`, `user_id`, `niveau` (lecture / écriture / validation / aucun), `created_at`

### `clients`
- `id`, `type` (physique/entreprise/administration), `raison_sociale`, `identifiant`, `adresse`, `coordonnees`, `representants` (JSON), `billing_info` (JSON), `consentements` (JSON), `documents_admin` (JSON), `created_at`

### `conflits_interets`
- `id`, `client_id`, `partie_opposee_id`, `dossier_id`, `statut` (en_cours / valide / refuse), `verifie_par`, `date_verification`, `motif`

### `dossiers`
- `id`, `reference_interne`, `type_affaire`, `nature_mission`, `client_id`, `parties_adverses` (JSON), `juridiction_id`, `avocat_responsable_id`, `huissier_responsable_id`, `collaborateurs` (JSON), `date_ouverture`, `niveau_confidentialite`, `statut`, `date_echeance`, `created_at`

### `dossiers_immobiliers`
- `dossier_id` (PK/FK), `adresse_bien`, `titre_foncier`, `nature_bien`, `proprietaire`, `occupant`, `montant_litige`, `expert_id`, `notaire_id`, `documents_propriete` (JSON)

### `documents`
- `id`, `dossier_id`, `nom`, `categorie`, `s3_key_chiffre`, `hash_sha256`, `taille`, `version_courante`, `publie_client`, `date_publication`, `date_expiration`, `cree_par`, `valide_par`, `metadata` (JSON), `created_at`

### `versions_document`
- `id`, `document_id`, `s3_key_chiffre`, `numero_version`, `hash_sha256`, `cree_par`, `created_at`

### `taches`
- `id`, `dossier_id`, `titre`, `description`, `responsable_id`, `createur_id`, `echeance`, `priorite`, `statut`, `checklist` (JSON), `created_at`

### `evenements` (audiences, échéances, rendez-vous)
- `id`, `dossier_id`, `type`, `titre`, `date_debut`, `date_fin`, `lieu`, `participants` (JSON), `est_public_client`, `created_at`

### `missions_huissier`
- `id`, `dossier_id`, `type_acte`, `huissier_id`, `adresse_signification`, `destinataire`, `date_prevue`, `frais_deplacement`, `debours`, `date_tentative`, `date_remise`, `resultat`, `preuve_remise_key`, `statut`, `retour_key`, `created_at`

### `factures`
- `id`, `dossier_id`, `client_id`, `numero`, `date_emission`, `date_echeance`, `honoraires` (JSON), `debours`, `frais`, `total_ttc`, `statut`, `created_at`

### `paiements`
- `id`, `facture_id`, `montant`, `date_paiement`, `mode`, `reference`, `preuve_key`, `created_at`

### `audit_logs`
- `id`, `user_id`, `action`, `entite`, `entite_id`, `details` (JSON), `adresse_ip`, `user_agent`, `created_at`
- Partitionnement par mois. Accès réservé aux rôles `auditeur` et `administrateur`.

## Chiffrement des documents (client-side)

Les documents sensibles sont chiffrés **côté client** avant l'envoi au stockage.

```
Document en clair
        │
        ▼ AES-256-GCM
Clé de document aléatoire (DEK)
        │
        ▼ chiffrement avec clé publique du cabinet
DEK chiffré stocké en base
        │
        ▼ upload
Fichier chiffré stocké sur S3/MinIO
```

- Génération d'une clé symétrique unique par document (Data Encryption Key, DEK).
- La DEK est chiffrée avec la clé publique du cabinet (RSA-4096 ou ECDH).
- Seuls les utilisateurs disposant de la clé privée déchiffrée en session peuvent lire le document.
- La clé privée du cabinet est elle-même chiffrée par le mot de passe maître ou un HSM/dérivé de clé.
- Les documents à publier vers l'espace client sont re-chiffrés avec la clé publique du client ou via un lien pré-signé à durée limitée.

Avantages :
- Le prestataire d'hébergement ne peut pas lire les documents.
- Protection renforcée contre une compromission du serveur.

Contraintes :
- Gestion complexe des clés (rotation, révocation, perte de mot de passe).
- Nécessite un mécanisme de récupération (shamir secret sharing ou clé de secours offline).

## Gestion des permissions

Contrôle d'accès basé sur les rôles (RBAC) combiné à des droits par dossier.

Chaque requête API doit vérifier :

1. L'utilisateur est authentifié (JWT + session Redis).
2. Son compte est actif.
3. MFA validé si requis.
4. Le tenant est identifié et actif.
5. Il a accès au schéma du cabinet.
6. Il détient le rôle nécessaire pour l'action.
7. Il a accès au dossier concerné (`permissions_dossier`).
8. Il a accès au document concerné.
9. L'action est autorisée dans ce contexte.
10. Le document est publiable pour ce destinataire si espace client.

Vérification systématique **côté serveur**. Masquer un bouton dans l'interface ne suffit pas.

## Sécurité et conformité

| Exigence | Mise en œuvre |
|----------|---------------|
| Authentification robuste | Hash Argon2id, MFA TOTP, verrouillage après 5 échecs |
| Sessions | JWT courte durée + refresh token, expiration inactivité, gestion des appareils |
| Chiffrement au repos | AES-256-GCM pour les documents, clés DEK chiffrées |
| Chiffrement en transit | TLS 1.3 minimum, HSTS, certificats valides |
| Sauvegardes | Quotidiennes, chiffrées, copie géographique distante, tests de restauration |
| Journal d'audit | Traçabilité complète, partitionné, non modifiable par les utilisateurs |
| CDP Sénégal | Consentements, droit d'accès, limitation des données, durées de conservation |
| Moindre privilège | Permissions granulaires par rôle et par dossier |
| Fichiers | Stockage hors répertoire public, vérification type/taille, antivirus, pas d'exécutables |
| RLS PostgreSQL | Row-level security en renfort sur les tables sensibles |

## Espace client sécurisé

- Sous-domaine ou route dédiée (`client.cabinet.exemple.sn`).
- Authentification simplifiée mais avec MFA recommandé (SMS ou e-mail).
- Le client ne voit que les dossiers et documents explicitement publiés.
- Chaque document publié dispose d'un niveau de visibilité, d'une date de publication et d'une éventuelle date d'expiration.
- Les consultations et téléchargements sont tracés dans `audit_logs`.
- Messagerie interne sécurisée (pas de pièces jointes par e-mail).
- Paiement en ligne optionnel via passerelle intégrée.

Visibilités possibles :
- `interne` : équipe du cabinet uniquement.
- `client` : client autorisé.
- `partie` : autre partie autorisée avec date d'expiration.
- `public_temporaire` : lien pré-signé avec durée de vie limitée.

## Module huissier

- Missions indépendantes rattachées à un `dossier_id` optionnel.
- Types : signification, sommation, mise en demeure, commandement, constat, procès-verbal, saisie, convocation, recouvrement.
- Statuts : en préparation, programmée, en cours, tentative, remise, retour, validée, facturée.
- Gestion des frais de déplacement, débours, preuves de remise (photo, PV scanné).
- Génération de modèles d'actes en PDF / DOCX avec fusion des variables.
- Suivi des retours et alertes sur échéances.

## Workflow d'un dossier (automatisation)

```text
Prospect → Nouveau → À qualifier → Conflit d'intérêts → Ouvert
  → En analyse → En rédaction → En relecture → En validation
  → À signifier → Signification en cours → En attente de retour
  → Audience → Décision → Exécution → Facturation → Clôturé → Archivé
```

Chaque changement de statut génère une entrée `audit_logs` avec : utilisateur, date, ancien statut, nouveau statut, motif, IP.

## API

- Routes API Next.js (`app/api/*`) avec handlers typés.
- Authentification JWT + refresh tokens via cookies `httpOnly` `Secure` `SameSite=Strict`.
- Rate limiting par IP et par utilisateur.
- Validation systématique avec Zod.
- Réponses en JSON, codes HTTP explicites.
- Documentation OpenAPI générée automatiquement si besoin.

## Hébergement cible

- Serveur privé virtuel (VPS) ou cloud souverain.
- Système d'exploitation durci (Ubuntu LTS), pare-feu, fail2ban.
- Docker / Docker Compose pour le déploiement.
- Sauvegardes automatisées hors site (base + fichiers + clés chiffrées séparément).
- Surveillance (logs, alertes, métriques).
- Plan de reprise d'activité (PRA) documenté.

## Interopérabilité future

- API ouverte pour intégrations (calendriers, messagerie).
- Webhooks pour notifications.
- Export comptable (CSV, FEC).
- Connecteurs de signature et de paiement.
- PWA pour accès mobile.
