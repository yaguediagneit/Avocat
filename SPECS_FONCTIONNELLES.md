# Spécifications fonctionnelles détaillées - Phase 0

## Périmètre

Ces spécifications couvrent le socle fonctionnel de la plateforme : authentification, gestion des cabinets, utilisateurs, clients, dossiers, documents, tâches, échéances, audit et espace client.

## 1. Authentification et sécurité

### US-AUTH-01 : Connexion
**En tant qu'** utilisateur, **je veux** me connecter avec mon e-mail et mot de passe, **afin d'** accéder à ma session.

**Règles :**
- Mot de passe haché avec Argon2id.
- Vérification du tenant actif.
- Verrouillage temporaire après 5 échecs consécutifs.
- Journalisation dans `audit_logs` (succès et échecs).

### US-AUTH-02 : Authentification multifacteur
**En tant qu'** administrateur ou responsable, **je veux** activer l'authentification multifacteur, **afin de** sécuriser mon accès.

**Règles :**
- MFA obligatoire pour les rôles administrateur, directeur, avocat responsable.
- Support TOTP via application authentificatrice.
- Codes de secours téléchargeables.

### US-AUTH-03 : Gestion des sessions
**En tant qu'** utilisateur, **je veux** visualiser et révoquer mes appareils connectés, **afin de** contrôler mes accès.

### US-AUTH-04 : Récupération de mot de passe
**En tant qu'** utilisateur, **je veux** réinitialiser mon mot de passe en toute sécurité, **afin de** regagner l'accès.

**Règles :**
- Lien à usage unique, expirant sous 1 heure.
- Notification de changement de mot de passe.

## 2. Gestion des cabinets et tenants

### US-TENANT-01 : Création d'un cabinet
**En tant qu'** super-administrateur, **je veux** créer un cabinet, **afin de** provisionner un espace isolé.

**Règles :**
- Génération automatique du schéma PostgreSQL dédié.
- Création des comptes initiaux (administrateur, comptable).
- Paramétrage du nom, adresse, logo, domaine personnalisé.

### US-TENANT-02 : Personnalisation du cabinet
**En tant qu'** administrateur de cabinet, **je veux** configurer les couleurs, le logo et les paramètres généraux, **afin d'** adapter l'interface.

### US-TENANT-03 : Limites et abonnements
**En tant qu'** super-administrateur, **je veux** définir des limites de stockage et de nombre d'utilisateurs par cabinet.

## 3. Gestion des utilisateurs et rôles

### US-USER-01 : Création d'un utilisateur
**En tant qu'** administrateur de cabinet, **je veux** créer un compte utilisateur avec un rôle, **afin d'** donner accès à un collaborateur.

**Rôles disponibles :**
- Avocat responsable
- Associé / directeur
- Avocat collaborateur
- Huissier de justice
- Assistant juridique
- Secrétaire
- Comptable
- Responsable administratif
- Client
- Administrateur technique
- Auditeur interne

### US-USER-02 : Attribution des permissions par dossier
**En tant qu'** avocat responsable, **je veux** donner un accès à un collaborateur sur un dossier spécifique, **afin de** contrôler la confidentialité.

### US-USER-03 : Désactivation d'un utilisateur
**En tant qu'** administrateur, **je veux** désactiver un compte immédiatement, **afin de** bloquer l'accès d'un départ.

## 4. Gestion des clients et parties

### US-CLIENT-01 : Enregistrement d'un client
**En tant qu'** secrétaire ou assistant, **je veux** enregistrer un client (physique, entreprise, administration), **afin de** constituer le référentiel.

**Données :** raison sociale, identifiant, adresse, coordonnées, représentants, informations de facturation, consentements.

### US-CLIENT-02 : Gestion des contacts
**En tant qu'** utilisateur, **je veux** ajouter des contacts et représentants liés à un client, **afin de** suivre les interlocuteurs.

### US-CLIENT-03 : Vérification des conflits d'intérêts
**En tant qu'** avocat responsable, **je veux** vérifier qu'aucun conflit n'existe avant d'ouvrir un dossier, **afin de** respecter la déontologie.

**Règles :**
- Recherche transverse par nom, raison sociale, identifiant.
- Bloquant pour l'ouverture du dossier si conflit détecté.
- Traçabilité de la vérification.

### US-CLIENT-04 : Autres intervenants
**En tant qu'** utilisateur, **je veux** associer des parties adverses, avocats adverses, tribunaux, experts, notaires, témoins, etc. à un dossier.

## 5. Gestion des dossiers

### US-DOSSIER-01 : Ouverture d'un dossier
**En tant qu'** avocat responsable, **je veux** ouvrir un dossier avec toutes les informations de base, **afin de** démarrer le suivi.

**Données :** référence interne, type d'affaire, client, parties adverses, juridiction, avocat responsable, huissier, collaborateurs, niveau de confidentialité, échéances.

### US-DOSSIER-02 : Types de dossiers
Le système gère les types suivants :
- Contentieux immobiliers
- Litiges fonciers
- Expulsions et recouvrements
- Baux commerciaux et d'habitation
- Recouvrement de créances
- Contentieux contractuels
- Rédaction et analyse de contrats
- Procédures civiles et commerciales
- Actes de sommation et mise en demeure
- Constats et procès-verbaux
- Significations
- Saisies et mesures d'exécution
- Conseils juridiques et consultations
- Négociations et règlements amiables

### US-DOSSIER-03 : Changement de statut
**En tant qu'** avocat responsable, **je veux** changer le statut d'un dossier, **afin de** refléter son avancement.

**Statuts :**
Prospect, Nouveau, À qualifier, Conflit d'intérêts à vérifier, En attente de pièces, Ouvert, En cours d'analyse, En rédaction, En relecture, En validation, À signifier, Signification en cours, En attente de retour, Audience ou échéance à venir, En attente du client, En négociation, En attente de décision, Décision rendue, En exécution, Facturation, Clôturé, Archivé.

**Règles :** historisation systématique dans `audit_logs` avec utilisateur, ancien statut, nouveau statut, motif, IP.

### US-DOSSIER-04 : Fiche immobilière
Pour les dossiers immobiliers, ajout des champs : adresse du bien, titre foncier, nature du bien, propriétaire, occupant, montant du litige, expert, notaire.

### US-DOSSIER-05 : Clôture et archivage
**En tant qu'** avocat responsable, **je veux** clôturer et archiver un dossier, **afin de** verrouiller les modifications et conserver l'historique.

**Règles :**
- Vérification des pièces obligatoires.
- Génération d'un dossier PDF récapitulatif.
- Verrouillage des modifications.
- Conservation des métadonnées.

## 6. Gestion documentaire

### US-DOC-01 : Dépôt de documents
**En tant qu'** utilisateur, **je veux** déposer des documents par glisser-déposer dans un dossier, **afin de** centraliser les pièces.

**Règles :**
- Vérification du type MIME.
- Limite de taille.
- Analyse antivirus.
- Chiffrement côté client avant upload.

### US-DOC-02 : Catégorisation
**En tant qu'** utilisateur, **je veux** classer un document par catégorie (contrat, bail, titre foncier, assignation, conclusions, PV, facture, note interne, etc.).

### US-DOC-03 : Versionnement
**En tant qu'** utilisateur, **je veux** consulter les versions antérieures d'un document et restaurer une version, **afin de** tracer les évolutions.

### US-DOC-04 : Prévisualisation
**En tant qu'** utilisateur, **je veux** prévisualiser les PDF et images sans les télécharger, **afin de** gagner du temps.

### US-DOC-05 : OCR et recherche
**En tant qu'** utilisateur, **je veux** rechercher dans le contenu des documents numérisés, **afin de** retrouver une information rapidement.

### US-DOC-06 : Publication vers l'espace client
**En tant qu'** avocat responsable, **je veux** publier un document vers l'espace client, **afin de** partager sécurisément une pièce.

**Règles :** visibilité, date d'expiration, utilisateurs autorisés, traces de consultation et de téléchargement.

## 7. Tâches, échéances et calendrier

### US-TACHE-01 : Création d'une tâche
**En tant qu'** avocat responsable, **je veux** créer une tâche avec responsable, échéance et priorité, **afin de** piloter l'activité.

### US-TACHE-02 : Checklists et mentions
**En tant qu'** utilisateur, **je veux** utiliser des checklists et mentionner un collègue dans un commentaire, **afin de** coordonner le travail.

### US-EVENT-01 : Planification d'audiences et rendez-vous
**En tant qu'** utilisateur, **je veux** ajouter une audience, un rendez-vous ou une échéance dans un calendrier global, **afin de** suivre les délais procéduraux.

## 8. Module huissier

### US-HUISSIER-01 : Création d'une mission
**En tant qu'** huissier ou avocat responsable, **je veux** créer une mission d'huissier (signification, constat, saisie, etc.), **afin de** suivre l'acte.

### US-HUISSIER-02 : Suivi des frais
**En tant qu'** huissier, **je veux** saisir les frais de déplacement, débours et coûts liés à la mission, **afin de** justifier la facturation.

### US-HUISSIER-03 : Retour de mission
**En tant qu'** huissier, **je veux** déposer le procès-verbal ou la preuve de remise, **afin de** clôturer la mission.

## 9. Espace client

### US-CLIENTPORTAL-01 : Consultation des dossiers
**En tant que** client, **je veux** consulter l'état général de mes dossiers, **afin de** suivre mon affaire.

### US-CLIENTPORTAL-02 : Dépôt et téléchargement de documents
**En tant que** client, **je veux** envoyer des documents et télécharger ceux publiés par le cabinet, **afin de** échanger sans e-mail non sécurisé.

### US-CLIENTPORTAL-03 : Consultation des factures
**En tant que** client, **je veux** consulter mes factures et les paiements effectués, **afin de** suivre ma situation financière.

## 10. Audit et traçabilité

### US-AUDIT-01 : Journal d'audit
**En tant qu'** auditeur ou administrateur, **je veux** consulter l'historique des actions sensibles, **afin de** garantir la traçabilité.

**Événements tracés :** connexion, création/modification/clôture de dossier, consultation de document, téléchargement, suppression, changement de statut, validation d'acte, publication client, modification de permissions, facturation, paiement, export.

## Règles transversales

- Toute action sensible nécessite une vérification côté serveur.
- Les champs sensibles sont chiffrés en base.
- Les documents ne sont jamais stockés dans un répertoire public.
- Chaque requête externe au tenant est rejetée.
- L'interface doit rester utilisable sur écran 13" minimum et tablette.
