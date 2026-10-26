# Notes projet

## Environnement
- Node n'est pas dans le PATH : utiliser le binaire embarqué `tools/node-v20.18.0-win-x64/node.exe`
  (ex. `$env:Path = "C:\xampp\htdocs\Avocat\tools\node-v20.18.0-win-x64;$env:Path"`).
- Application Next.js dans `apps/web`.

## Vérification
- Typecheck : `node node_modules\typescript\bin\tsc --noEmit -p tsconfig.json` depuis `apps/web`.
- Build : `node node_modules\next\dist\bin\next build` — **arrêter le serveur dev avant** (il verrouille
  `.next/trace`, sinon `EPERM`).
- Polices auto-hébergées dans `app/fonts` (Inter variable woff2, Playfair Display variable ttf) via
  `next/font/local` dans `app/layout.tsx` : le build n'a plus besoin d'accéder à Google Fonts.
- `lib/prisma.ts` (`getCurrentPrismaClient`) relance l'erreur `DYNAMIC_SERVER_USAGE` de `headers()` afin
  que Next bascule en rendu dynamique les pages serveur qui utilisent `prisma` sans `headers()` explicite
  (évite les logs « x-tenant-id requis en production » au prerender).

## Sécurité (auth / superadmin)
- Deux clients Prisma : `@prisma/client` (schéma tenant) et `@/prisma/generated/public` (schéma public :
  Tenant, Plan…). Les types `Prisma.TenantUpdateInput` / `Prisma.PlanUpdateInput` viennent du second.
- Les réponses API superadmin ne doivent **jamais** exposer `tenant.databaseUrl` ni `tenant.schemaName` :
  utiliser `TENANT_PUBLIC_SELECT` / `sanitizeTenant` de `lib/superadmin.ts`. Valider `params.id` avec `uuidSchema`.
- `middleware.ts` protège `/superadmin` et `/api/superadmin` (session MFA + email dans `SUPERADMIN_EMAILS`),
  en plus des guards `guardSuperAdmin` / layout.
- Rate limiting : `lib/rate-limit.ts` (`enforceAuthRateLimit` / `resetAuthRateLimit`, API async).
  Store Redis (sorted sets) si `REDIS_URL` est défini, sinon mémoire locale ; repli mémoire automatique
  si Redis est injoignable. Appliqué sur login cabinet/client, verify-mfa, verify-admin, forgot-password (+verify).
- CSRF double-submit : `lib/csrf.ts` (sans dépendance Node, importable depuis le middleware edge) +
  `components/csrf-provider.tsx` (monté dans `app/layout.tsx`, patch `window.fetch` pour ajouter
  `x-csrf-token` aux requêtes same-origin non idempotentes). Le middleware pose le cookie `csrf_token`
  et refuse (403) les requêtes mutantes `/api/*` portant un cookie de session sans jeton valide.
  Tout nouvel appel mutant doit passer par `fetch` (pas de `<form action>` natif ni XHR).
- Codes MFA email (`lib/mfa-email.ts`) : `crypto.randomInt`, stockés hachés (sha256), 5 tentatives max
  par email/purpose, 5 envois / 15 min. `MfaRateLimitError` → réponse 429 via `tooManyRequests`.
- `SESSION_PASSWORD` (≥ 32 caractères) est obligatoire en production (`lib/session-options.ts`).

## Landing cabinet
- `components/landing/cabinet-landing.tsx` est un Server Component ; les parties animées sont des
  Client Components (`hero-slides.tsx`, `hero-carousel.tsx`, `scroll-reveal.tsx`, `spotlight-card.tsx`).
  `defaultHero` vit dans `landing-defaults.ts` (importable côté client sans tirer la landing).
- Images via `components/landing/landing-image.tsx` (wrapper `next/image`) : les images de la landing
  sont des data-URL stockées dans `tenant.configuration` → `unoptimized` automatique ; les URL https
  ou chemins relatifs sont optimisés (`remotePatterns` autorise tout hôte https).

## Espace client
- Visibilité des dossiers côté client : `lib/client-access.ts` (`clientDossierFilter`) = dossiers dont
  `dossier.clientId === session.clientId` uniquement. Les factures/solde ne sont montrés qu'au client principal.
- Les clients ne voient que les documents `publieClient = true` de leurs dossiers.
- Le téléchargement client passe par `/api/documents/[id]/download` : l'accès est vérifié via
  `session.clientId` + `publieClient` (pas via la matrice RACI, réservée aux utilisateurs cabinet).
- `middleware.ts` redirige les sessions client vers `/login` pour toute route `/api/*` hors `/api/auth`
  et `/api/client`. Seules `/api/keys` et `/api/documents/[id]/download` sont explicitement partagées.
  Toute nouvelle API appelée depuis l'espace client doit être ajoutée à cette liste (ou placée sous `/api/client`).

## Génération PDF
- Tous les PDF passent par `lib/pdf-generator.ts` : `generateLegalPdf` (courriers/actes via
  `/api/tache-templates/[id]/pdf`) et `generateReportPdf` (rapports multi-sections/tableaux,
  utilisé par `/api/comptabilite/rapport/pdf`). En-tête/pied de page identiques (logo, raison
  sociale, slogan, `headerText`/`footerText`, pagination « Page X / N »), thème depuis
  `tenant.configuration.pdfTheme`.
- Les lignes OHADA du rapport sont partagées dans `lib/report-rows.ts` (SIG/CR/FLUX/CLASS_LABELS).
- `pdfTheme.headerText` / `pdfTheme.footerText` acceptent `{{annee}}` (année en cours) et
  `{{date}}` (date du jour), substituées au rendu par `resolvePdfThemeText`
  (`lib/pdf-theme-text.ts`) — appliqué dans `pdf-generator.ts`, la fenêtre d'impression
  des versements (`payments-section.tsx`) et la page contrat `imprimer`.
- `TacheTemplate.contenuDocument` = modèle de document à texte fixe avec variables
  `[Libellé]` ou `{{cle|Libellé}}` (`lib/document-template.ts`). Le formulaire PDF
  (`pdf-form-client.tsx`) affiche un champ par variable (texte fixe non éditable) et
  pré-remplit via `suggestVariableValues` depuis dossier/client/cabinet/utilisateur ;
  la substitution est refaite côté serveur dans `/api/tache-templates/[id]/pdf`.
- Le corps des courriers est remis en paragraphes par `bodyToParagraphs` (même fichier) :
  lignes vides = séparateurs, énumérations/puces/salutations/formules de lettre rouvrent
  un paragraphe, les monoblocs > ~620 caractères sont éclatés aux fins de phrase. Rendu
  justifié (sauf dernière ligne de paragraphe), intitulés « … : » en gras, et `wrapText`
  coupe les mots trop longs — rien ne doit dépasser les marges `MARGIN`.

## Recherche des listes
- Toutes les barres « Filtrer… » (`components/search-input.tsx`, param `?q=`, debounce 300 ms)
  construisent leur `where` via `tableSearchWhere(q, fields, extra?)` de `lib/search.ts` :
  requête découpée en mots, **chaque mot** doit matcher au moins un champ
  (AND entre mots, OR entre champs). Les chemins imbriqués passent en chaîne
  (`"client.raisonSociale"`, relations to-many via `".some."` ex. `"lines.some.description"`).
- `extra(term)` sert pour couvrir **toutes les colonnes affichées** : les codes
  par libellé (`codesMatchingLabel`), les égalités numériques (`numericClauses`),
  les dates (`dateClauses` — « 2025 », « 03/2025 », « 15/03/2025 », « 2025-03-15 »),
  les booléens (`boolClauses` — « oui »/« non », ou libellés métier
  « payée »/« impayée »), les champs JSON (`{ metadata: { path, string_contains } }`)
  et les FK utilisateur sans relation (`usersMatchingQuery` pré-chargé +
  `userIdsMatchingTerm` par mot — ex. `responsableId`, `huissierId`, `creePar`).
- La recherche globale (palette `SearchCommand`, `/api/search`) garde la
  sémantique OR entre mots via `termOr` (rappel maximal) ; le journal d'audit
  partage `auditSearchWhere` (multi-mots) entre `/api/audit` et `/api/audit/export`.

## Dossiers et spécialités
- Le « type d'affaire » du formulaire dossier liste les `Specialite` `selectionnee = true` du cabinet
  (fallback : toutes les actives) ; `dossier.typeAffaire` stocke le `code` de la spécialité.
  `lib/specialite.ts` (`findSpecialiteForTypeAffaire`) assure la résolution avec les anciens codes
  paramètre `type_affaire`.
- « Nature de la mission » = multi-choix à cocher parmi les paramètres `nature_mission` ;
  `dossier.natureMission` est un `Json` (tableau de codes). Normaliser les lectures avec
  `lib/nature-mission.ts` (`naturesMissionOf`) — tolère les anciennes valeurs en chaîne.
- L'onglet Documents d'un dossier affiche les `TypeDocumentSpecialite` attendus de la spécialité
  (statut Reçu/Manquant + lien « Uploader »). La couverture est détectée via `document.categorie`
  ou `document.metadata.typeDocument` (renseigné quand l'upload vient du lien « Uploader »).
- « Travail / tâches attendues » des intervenants = multi-choix (cases à cocher) des titres
  des `TacheTemplate` de la spécialité du dossier (formulaire dossier + matrice RACI).
  `dossierCollaborateur.tacheAttendue` est un `Json` (tableau de titres).
- À la création, les tâches générées depuis les `TacheTemplate` sont affectées à l'intervenant
  dont la « tâches attendues » inclut le titre du template. Sinon le responsable par défaut
  reste l'huissier (`roleAttendu = "huissier"`) ou l'avocat responsable — voir
  `app/api/dossiers/route.ts` (POST) et `lib/tache-affectation.ts`.
- Les tâches déchargées sur un intervenant restent actionnables par le responsable du dossier
  (avocat ou huissier) et par l'administrateur (`app/api/taches/[id]/route.ts`).

## Rapport financier
- Le rapport `/cabinet/comptabilite/rapport` accepte désormais un mode `mois` (1-12)
  ou une période personnalisée `debut`/`fin` (YYYY-MM-DD).
- Le compte de résultat, les SIG et les flux sont calculés sur la **période sélectionnée**
  à partir des lignes d'écriture validées (`AccountingEntry.isValidated`).
- Le bilan reste une photo au **dernier jour de la période**, avec un résultat net
  cumulé depuis le 1er janvier de l'exercice afin de conserver l'équilibre actif/passif.
- Les dotations `soldeActuel` des comptes ne sont plus utilisées directement pour le CR :
  on recalcule les soldes à date et les mouvements période via `computeAccountBalancesAt`
  et `computeAccountMovements` dans `lib/reporting.ts`.
- L'URL PDF reproduit le même filtrage (`mois`, `debut`, `fin`) et le titre reflète
  la période choisie.

## Charges et immobilisations
- Catégories de charge = `ChargeCategory` (paramétrage). Le seed contient loyer, transport,
  fournitures, services, impôts, personnel, divers + factures Électricité (SENELEC, 6062),
  Eau (SEN EAU, 6061), Téléphone et Internet (614).
- Écriture d'une charge simple : D 6xx (compte auxiliaire de la catégorie) + D 445 TVA / C 52-57.
- Case « Immobilisation amortie » du formulaire nouvelle charge : le HT est débité au compte
  de **classe 2** choisi (`Charge.immobilisationAccountCode`) au lieu du compte de charge, puis
  réparti par des dotations mensuelles D 681x / C 28x (une écriture par ligne `ChargeAmortissement`).
  Le compte 28x est déduit du compte d'immobilisation (244 → 2844), le compte de dotation de sa
  nature (6812 incorporel / 6813 corporel), avec repli sur les mappings `AMORTIZATION_EXPENSE`
  et `AMORTIZATION_CUMULATED`.
- Calcul de la dotation : `lib/immobilisation.ts` — mode « montant » (dotation mensuelle fixe) ou
  « taux » (taux annuel, dotation = base × taux / 12, durée linéaire suggérée = 1200 / taux).
  La dernière dotation absorbe l'arrondi ; le plan s'arrête si le bien est soldé avant la durée.
- Comptabilisation : les dotations échues sont passées à la création, puis via
  `POST /api/charges/amortissements` (bouton « Comptabiliser les dotations échues » sur la liste
  des charges, appelable aussi par une tâche planifiée) ou `POST /api/charges/[id]/amortissements`
  pour une charge/dotation précise. Idempotence par `amortissement-<id>`.
- Le montant d'une immobilisation n'est plus modifiable dès qu'une dotation est comptabilisée.

## Administration / audiences
- `POST /api/administration/audiences` crée le `Hearing` ET un `Evenement` (calendrier) dans la
  même transaction : `audience` → type `audience`, `reunion` → type `rdv` ; `attendees` (chaîne
  « A, B ») devient `participants` (`[{ nom }]`). Un statut `annule` ne génère pas d'événement.

## Démarches administratives (foncier / urbanisme / fiscalité)
- Module dédié (`/cabinet/dossiers/demarches`, onglet « Démarches adm. » de la section
  Dossiers — sous-navigation `demarches/layout.tsx` : Démarches / Demandeurs / Parcelles /
  Paramétrage), distinct de
  `CourtFormality`/`ClientRequest` : 16 types (`URB_*`, `CAD_*`, `FON_*`, `ADM_*`, `FIS_*`,
  `DOM_*`), workflow qualifié et check-lists de pièces par type.
- Principe : le cabinet prépare/suit ; seule l'administration délivre l'acte. Les pièces sont
  catégorisées (`PIECE_CATEGORIES` : interne cabinet, administratif à obtenir, pièce client,
  technique, preuve de dépôt).
- `lib/demarches.ts` : statuts + `DEMARCHE_TRANSITIONS`, `assertDemarcheTransition` (bloque
  `A_QUALIFIER`→préparation si qualification incomplète, pièces obligatoires avant
  `PRET_VALIDATION`, validation avocat, champs de dépôt/décision, clôture si débours non
  rapprochés). Schémas zod partagés : `lib/demarches-schemas.ts` (jamais dans `route.ts`).
- Modèles : `Demarche`, `DemarcheType(+Piece)`, `DemarcheAutorite`, `Demandeur`, `Parcelle`,
  `DemarchePiece`, `DemarchePartie`, `DemarcheEvenement`, `DemarcheFrais`, `DemarcheModele`.
  Une démarche est toujours rattachée à un `dossierId` (GED + isolation RBAC + confidentialité).
- Seed idempotent : `node scripts/seed-demarches.js [--tenant=<slug>]` (upsert par code,
  n'écrase pas le paramétrage existant).
- Intégrations : onglet « Démarches » sur la fiche dossier (`dossier-tabs.tsx`, requête
  `demarches` dans `dossiers/[id]/page.tsx`) ; wizard pré-rempli via query params
  (`?dossierId=`, `?objet=`, `?demandeurNom/Tel/Email=`, `?clientId=`, `?origine=`) ;
  `Demandeur.clientId` = relation Prisma réelle vers `Client` (sélecteur dans la fiche
  demandeur + bouton « client du dossier » dans le wizard) ; carte pont vers
  `/cabinet/dossiers/demarches` dans `administration/[section]` ; bouton « → Démarche » sur chaque
  demande client (registre des demandes, pré-remplit l'objet + le demandeur + l'origine).
- Spécialités « démarches adm. » : `node scripts/seed-specialites-demarches.js [--tenant=<slug>]`
  crée 5 types d'affaire sélectionnables à la création de dossier (`demarches_urbanisme`,
  `demarches_cadastre`, `demarches_foncier_domaines`, `demarches_fiscalite`,
  `demarches_administratives`) avec workflow calqué sur le cycle démarche
  (qualification→collecte→préparation→validation→dépôt→instruction→décision→remise→clôture),
  tâches de démarrage (modèles de courrier à variables) et types de documents attendus.
- Données fictives de démo : `node scripts/seed-demarches-demo.js [--dry-run] [--tenant=<slug>]`
  — 1 démarche par type (16), statuts répartis sur tout le workflow, demandeurs/parcelles
  fictifs sénégalais, événements et frais ; objets préfixés « [DÉMO] » (idempotent, ne
  re-crée pas une démarche déjà présente). Sans dossier existant, crée un client + dossier
  « DEMONSTRATION » de rattachement.
- PDF : `POST /api/demarches/[id]/pdf` {modeleId, variables, publieClient} — modèles `TPL_*`
  à variables `{{cle|Libellé}}`/`[Libellé]` + variables canoniques de la démarche
  (`reference_demarche`, `demandeur_nom_complet`, `liste_pieces`, `bureau_cadastre`, …) ;
  le PDF est chiffré et versé dans la GED du dossier (`categorie: "courrier"`).
- RBAC : ressource `demarches` (`read`/`write`/`validate`/`delete`, cochable dans Paramétrage
  → Rôles) ; la validation juridique (`valider`, dérogations) exige `demarches:validate` ou admin.

## Transactions & contrats (ventes, baux, mandats)
- Sous-module distinct (`/api/transactions/*`), rattaché au dossier (`transaction.dossierId`)
  et orchestrant les démarches existantes via `Demarche.transactionId` et
  `TransactionFormalite.demarcheId` — ne pas dupliquer le circuit administratif.
- Principe : le cabinet est conseil / intermédiaire, jamais partie au contrat ; la clause
  « INTERVENTION DU CABINET » (`CLAUSE_INTERVENTION_CABINET` dans `lib/transactions.ts`)
  est insérée dans tous les modèles de contrat.
- `lib/transactions.ts` : 3 workflows (`VENTE_TF` 22 statuts, `BAIL` 19, `GENERIQUE` 11)
  + 15 statuts `BLOQUE_*` orthogonaux (motif obligatoire) + `ANNULEE`/`ARCHIVE` ;
  `TRANSACTION_TRANSITIONS` est généré par workflow (avance/recul d'un pas + blocage +
  annulation ; déblocage vers les points de contrôle).
- `assertTransactionTransition` : invariant vente TF = pas de clôture sans `mutationInscrite`
  + `documentMutationId` (inscription au livre foncier) + `remisAuClientLe` ; bail = droit de
  louer vérifié, loyer/date d'effet, bail signé en GED, état des lieux ; pièces obligatoires
  couvertes ou dérogées avant validation ; notaire requis avant signature notariale.
- Transitions sensibles (`SIGNATURE_NOTARIALE_*`, `ACTE_NOTARIE_SIGNE`, `MUTATION_INSCRITE`,
  `CLOTURE`, écriture des preuves de mutation via PATCH) exigent `transactions:validate` ou admin.
- Paiements (`TransactionPaiement`) : 16 natures (`PAIEMENT_NATURES`) ; seuls
  `HONORAIRES_CABINET`/`DEBOURS_CABINET` sont des recettes cabinet — bénéficiaire réel
  obligatoire sinon ; un paiement rapproché n'est pas supprimable ; paiements non
  rapprochés bloquent la clôture.
- Schémas zod : `lib/transactions-schemas.ts` ; seed : `node scripts/seed-transactions.js`
  (14 types `VENTE_*`/`BAIL_*`/`MANDAT_*`/`ETAT_LIEUX`/`AVENANT`/`RESILIATION` + 22 modèles
  `TPL_*`, idempotent). Push schéma multi-tenant : `node scripts/push-tenant-schema.js`.
  Données de démo : `node scripts/seed-transactions-demo.js [--dry-run] [--tenant=<slug>]`
  — 8 transactions couvrant les 3 workflows (vente TF à 3 étapes + blocage hypothèque,
  baux, promesse, mandat, état des lieux), biens liés aux parcelles, parties,
  check-lists matérialisées, formalités, paiements avec bénéficiaires réels et
  journal ; objets préfixés « [DÉMO] » (idempotent, partage les demandeurs et
  parcelles fictifs du seed démarches).
- Modèles : `Bien` (lien `parcelleId` vers la fiche foncière), `TransactionType(+Piece)`,
  `Transaction`, `TransactionBien`, `TransactionPartie` (rôles vendeur/acheteur/bailleur/
  locataire/garant/mandant — jamais CABINET), `TransactionPiece`, `TransactionFormalite`,
  `TransactionPaiement`, `TransactionEvenement`, `TransactionModele`,
  `TransactionEcheance`, `EtatLieux`, `EtatLieuxLigne`.
- **Échéancier locatif** (`TransactionEcheance`, natures `LOYER`/`CHARGES`/
  `REVERSEMENT_BAILLEUR`/`AUTRE`, statuts `A_PERCEVOIR`/`PARTIEL`/`PAYE`/`EN_RETARD`/`ANNULE`) :
  `genererEcheancierBail` (`lib/transactions.ts`) produit loyer + charges + reversement
  bailleur net de commission (`commissionType`/`commissionValeur` sur `Transaction`) pour
  `dureeMois` mois à partir de `dateEffet`, jour `jourEcheanceLoyer`. Génération à la
  création (`genererEcheances: true` dans POST) ou via `POST …/echeances {generer:true}`
  (dédoublonnage par nature+période). `PATCH …/echeances/[id]` recalcule le statut depuis
  les montants et peut matérialiser un `TransactionPaiement` (`enregistrerPaiement`) ;
  DELETE annule une échéance payée, retire une échéance vierge. Une fiche d'état des
  lieux finalisée passe les drapeaux `etatLieuxEntreeFait`/`etatLieuxSortieFait`.
- **États des lieux** (`EtatLieux` + `EtatLieuxLigne`, tableau entrée/sortie objet ×
  emplacement × état `NEUF`→`CASSE`) : `POST/PATCH/DELETE /api/transactions/[id]/etats-lieux[/etatId]`
  — les lignes sont remplacées en bloc via `lignes[]` du payload ; DELETE archive une
  fiche finalisée (`CLOTURE`), retire un brouillon.
- Champs bail/mandat/vente sur `Transaction` : `chargesMensuelles`+`chargesMode`
  (FIXE/POURCENTAGE/INCLUSES)+`chargesIncluses`, `modePaiementLoyer`,
  `clausesParticulieres` (Json), `typeMandat`, `commissionType`/`commissionValeur`/
  `commissionBase`, décomposition vente `netVendeur`+`honorairesAgence`+`tva`+
  `taxesMunicipales`+`fraisNotaire`.
- **Impression confidentielle** : `POST /api/transactions/[id]/pdf` accepte
  `confidentiel: true` → les blocs `[[CONFIDENTIEL]]…[[/CONFIDENTIEL]]` du modèle
  (ex. article RÉMUNÉRATION de `TPL_MANDAT_INTERMEDIATION_IMMO`) sont supprimés avant
  rendu ; les marqueurs seuls sont toujours retirés par `renderDocumentTemplate`.
  Une version confidentielle n'est jamais publiée sur l'espace client
  (`publieClient` forcé à false). Migration ponctuelle des modèles seedés :
  `node scripts/patch-tpl-confidentiel.js` (n'insère les marqueurs que si l'article
  standard est intact).
- Le seed démo enrichit le bail démo (TRX-2026-0004) : 11 échéances (payées /
  partielles / en retard / à percevoir + reversements bailleur), état des lieux
  finalisé à 7 lignes ; complète aussi les champs financiers vides des transactions
  existantes sans écraser les saisies.
- UI : onglet « Transactions » de la section Dossiers (`/cabinet/dossiers/transactions`,
  sous-navigation `transactions/layout.tsx` : Transactions / Biens / Types & modèles)
  — liste avec compteurs
  (en cours / ventes TF / bloquées / paiements à rapprocher), recherche multi-champs
  (`reference`, parties, bien, notaire, dossier) ; wizard 5 étapes
  `nouveau/page.tsx` + `transaction-wizard.tsx` (type → dossier → parties → bien
  → conditions ; pré-rempli via `?dossierId=`, le bien libre crée une fiche `Bien`) ;
  fiche `[id]/page.tsx` + `transaction-detail-client.tsx` à onglets (Vue d'ensemble
  avec progression + transitions à champs de preuve contextuels, Parties, Pièces avec
  dérogations motivées, Contrats & documents, Formalités externes liées aux
  démarches du dossier, Paiements avec rapprochement, Journal) ; référentiel
  `biens/page.tsx` + `bien-form-client.tsx` ; paramétrage `parametrage/page.tsx`
  (types + check-lists + modèles TPL, édition réservée admin). Onglet
  « Transactions » ajouté à la fiche dossier (`dossier-tabs.tsx`, requête dans
  `dossiers/[id]/page.tsx`).
- PDF : `POST /api/transactions/[id]/pdf` {modeleId, variables, publieClient, apercu} —
  variables canoniques pré-remplies (référence, parties par rôle, bien, prix/loyer,
  notaire, NICAD/TF…) + `suggestVariableValues` ; `apercu` renvoie le PDF sans
  archivage ; sinon le PDF est chiffré et versé dans la GED du dossier
  (`categorie: "contrat"`, `metadata.transactionId`), événement + audit. Filigrane
  « BROUILLON » (`generateLegalPdf` accepte `watermark`) tant que le statut n'est
  pas un statut de signature/exécution (`STATUTS_DOCUMENT_FINAL`).

## Intervenants externes
- `Document.partageExterne` (case à cocher à l'upload/édition) = le document est visible par les
  intervenants externes du dossier (huissier responsable, collaborateurs externes).
- `lib/rbac.ts` (`estIntervenantExterne`) : un utilisateur est « externe » si son rôle n'est ni admin
  ni client et n'a pas la permission `documents:read` (ex. rôles « Huissier de justice », « Architecte »).
- Les externes ne voient que les documents `partageExterne = true` : filtré dans les listes
  (page dossier, page documents) et vérifié sur `/api/documents/[id]` (GET, download, preview).

## Déploiement production (Docker / Coolify)
- `apps/web/Dockerfile` : multi-stage (deps → build avec env factices → prod-deps → runner).
  Pas de `output: standalone` : `server.js` utilise l'API programmatique `next()` (+ WebDAV
  `/webdav/*` pour l'édition Word). Le runner garde `lib/`, `prisma/schema`, `init.ts`,
  `seed.ts`, `scripts/` et `tsx` global pour le provisioning (`npx prisma db push` par tenant
  via `lib/tenant-manager.ts`, init une fois via `npx tsx init.ts`).
- `docker-entrypoint.sh` : `prisma db push` du schéma **public** (idempotent) + attente
  Postgres, puis `node server.js` (port 3000).
- `docker-compose.prod.yml` (racine) : app + avocat-postgres + avocat-minio + avocat-redis +
  avocat-meilisearch. VPS < 4 GB : supprimer redis/meilisearch (replis mémoire / SQL déjà
  prévus dans le code).
- Variables : `.env.production.example`. `NEXT_PUBLIC_APP_URL` est lu côté serveur
  (runtime) — la valeur factice du build ne pose pas de problème.
- Production actuelle : VPS RackNerd `204.44.66.91` (Ubuntu 24.04, 4 GB + 6 GB swap),
  Coolify v4.5 (proxy **Traefik v3**), ressource `gg2dzrlxqblurzml61mlf3xb`, URL
  `https://avocat.204.44.66.91.sslip.io`, déploiement depuis `github.com/yaguediagneit/Avocat`
  (branche `main`, deploy key SSH). Tenant par défaut `3bd33f4d-6f75-4235-ad6e-fa08fde7475b`.
- Pièges rencontrés :
  - Les services sont préfixés `avocat-*` : sur le réseau partagé `coolify`, `postgres` et
    `redis` résolvent vers `coolify-db` / `coolify-redis` (base interne de Coolify → P1000).
  - Seul `app` rejoint le réseau externe `coolify` (accès du proxy) ; pas de `ports:` publié.
  - MinIO n'est plus publié sur Docker Hub ni quay.io : image `bitnamilegacy/minio`,
    bucket créé via `MINIO_DEFAULT_BUCKETS`.
  - Les images `node:*-slim` n'ont pas `openssl` : requis par les moteurs Prisma.
  - La route Traefik n'est pas générée par Coolify pour cette stack (aucun label `traefik.*`) :
    elle est définie à la main dans `/data/coolify/proxy/dynamic/avocat.yaml` sur le VPS
    (routers http→https + certResolver `letsencrypt` → `gg2dzrlxqblurzml61mlf3xb-app-1:3000`).
    À adapter si le domaine ou le nom de la ressource changent.
  - Postgres ne lit `POSTGRES_PASSWORD` qu'à la création du volume : pour le changer ensuite,
    `ALTER USER avocat WITH PASSWORD '…'` dans le conteneur, puis **Redeploy**
    (`docker restart` ne recharge pas les variables d'environnement).
- Le plan comptable Syscohada est versionné dans `apps/web/data/` (plus de chemin Windows en dur).
