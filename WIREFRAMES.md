# Wireframes et parcours utilisateurs - Phase 0

## Vue globale

Ces wireframes décrivent la structure des écrans principaux. Ils servent de base aux maquettes haute-fidélité.

---

## 1. Page de connexion

```
┌────────────────────────────────────────────────────┐
│                                                    │
│              [LOGO CABINET]                        │
│                                                    │
│  E-mail            [____________________]          │
│  Mot de passe      [____________________]          │
│                                                    │
│  [X] Se souvenir de moi                            │
│                                                    │
│  [  SE CONNECTER  ]                                │
│                                                    │
│  Mot de passe oublié ?                             │
│                                                    │
└────────────────────────────────────────────────────┘
```

Comportements :
- Affichage d'un champ TOTP après validation du mot de passe si MFA activé.
- Verrouillage après 5 échecs.
- Affichage des appareils récents si connexion inhabituelle.

---

## 2. Tableau de bord (Avocat responsable)

```
┌───────────────────────────────────────────────────────────────────────┐
│ [LOGO]  Dossiers  Clients  Tâches  Calendrier  Factures  Paramètres [🔔][👤]│
├───────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  Bonjour, Maître Ndiaye              [+ Nouveau dossier]              │
│                                                                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐                │
│  │ Dossiers │ │  Actifs  │ │ Echéances│ │ Factures │                │
│  │   142    │ │    89    │ │  12      │ │  8 imp.  │                │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘                │
│                                                                       │
│  Mes tâches en priorité          Prochaines échéances               │
│  ───────────────────────         ─────────────────────                │
│  [ ] Conclusions Alpha c/ Beta   05/09 - Audience DIC                 │
│  [ ] Relecture PV saisie         07/09 - Echéance contrat             │
│  [ ] Envoyer demande pièces      10/09 - Signification                │
│                                                                       │
│  Derniers dossiers consultés                                        │
│  ─────────────────────────                                          │
│  #2026-0042 - Société Alpha c/ Société Beta - En cours              │
│  #2026-0041 - M. Diop - Litige foncier - En attente de pièces        │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

---

## 3. Liste des dossiers

```
┌───────────────────────────────────────────────────────────────────────┐
│ [LOGO]  Dossiers  Clients  ...                              [+ Nouveau]│
├───────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  Filtres : [Tous ▼] [Statut ▼] [Type ▼] [Responsable ▼]  [🔍 Rechercher]
│                                                                       │
│  Référence      Client                  Type            Statut      Resp. │
│  ──────────────────────────────────────────────────────────────────── │
│  #2026-0042     Société Alpha           Contrat       En rédaction  Ndiaye │
│  #2026-0041     M. Diop                 Foncier       Att. pièces   Fall   │
│  #2026-0040     Société Gamma           Recouvrement  En exécution  Sall   │
│  ...                                                                  │
│                                                                       │
│  [ < 1 2 3 ... 12 > ]                                                 │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

---

## 4. Fiche d'un dossier

```
┌───────────────────────────────────────────────────────────────────────┐
│ [LOGO]  Dossiers  ...                    [🖉 Modifier] [✓ Valider]    │
├───────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  #2026-0042 - Société Alpha c/ Société Beta        [Statut : En cours]│
│  Type : Contentieux contractuel    Confidentialité : Interne          │
│                                                                       │
│  [Résumé] [Documents] [Tâches] [Calendrier] [Finances] [Historique]  │
│                                                                       │
│  ─── Résumé ───                                                       │
│                                                                       │
│  Client principal : Société Alpha                                     │
│  Partie adverse : Société Beta                                        │
│  Avocat responsable : Maître Ndiaye                                   │
│  Huissier : Maître Diop                                               │
│  Juridiction : Tribunal de Commerce de Dakar                          │
│                                                                       │
│  Dernières actions :                                                  │
│  - 02/09 - Document "Conclusions v2" ajouté par Ndiaye                │
│  - 01/09 - Statut passé à "En rédaction" par Fall                     │
│  - 28/08 - Tâche "Préparer conclusions" créée                         │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

---

## 5. Onglet Documents du dossier

```
┌───────────────────────────────────────────────────────────────────────┐
│ ...                              [+ Ajouter] [📁 Créer catégorie]     │
├───────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  [Résumé] [Documents] [Tâches] [Calendrier] [Finances] [Historique]  │
│                                                                       │
│  ─── Documents ───                                                    │
│                                                                       │
│  Catégories : [Toutes] [Identité] [Contrat] [Conclusions] [PV] ...    │
│                                                                       │
│  Nom                        Version  Auteur   Date       Visibilité   │
│  ──────────────────────────────────────────────────────────────────── │
│  Conclusions_v2.pdf         v2       Ndiaye    02/09     Interne      │
│  Contrat_prestation.pdf     v1       Sall      25/08     Client       │
│  PV_signification.pdf       v1       Diop      20/08     Interne      │
│                                                                       │
│  Glissez-déposez un fichier ici ou cliquez pour parcourir             │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

Actions par ligne : prévisualiser, télécharger, publier client, historique des versions, supprimer.

---

## 6. Tâches d'un dossier

```
┌───────────────────────────────────────────────────────────────────────┐
│ ...                                                    [+ Nouvelle tâche]│
├───────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  [Résumé] [Documents] [Tâches] [Calendrier] [Finances] [Historique]  │
│                                                                       │
│  ─── Tâches ───                                                       │
│                                                                       │
│  À faire     │ En cours    │ Terminées    │ Toutes                   │
│                                                                       │
│  Titre                       Responsable   Échéance     Priorité      │
│  ──────────────────────────────────────────────────────────────────── │
│  Préparer conclusions        Ndiaye        15/09        Haute        │
│  Relancer client pour pièces Fall          05/09        Moyenne      │
│  Vérifier conflit d'intérêts Sall          03/09        Haute        │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

---

## 7. Module huissier - Liste des missions

```
┌───────────────────────────────────────────────────────────────────────┐
│ [LOGO]  Missions huissier  Dossiers  ...          [+ Nouvelle mission]│
├───────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  Filtres : [Type ▼] [Statut ▼] [Huissier ▼]  [🔍 Rechercher]         │
│                                                                       │
│  Dossier                    Type            Huissier   Date      Statut│
│  ──────────────────────────────────────────────────────────────────── │
│  #2026-0042 Alpha c/ Beta   Signification   Diop       10/09    En préparation│
│  #2026-0038 Gamma c/ Delta  Saisie          Fall       05/09    Terminée     │
│  ...                                                                  │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

---

## 8. Détail d'une mission huissier

```
┌───────────────────────────────────────────────────────────────────────┐
│ ...                          [🖉 Modifier] [✓ Retour de mission]      │
├───────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  Mission : Signification d'une assignation                            │
│  Dossier : #2026-0042 - Société Alpha c/ Société Beta                 │
│  Huissier : Maître Diop                                               │
│  Statut : En préparation                                              │
│                                                                       │
│  ─── Informations ───                                                 │
│  Adresse de signification : 12 Rue de Dakar, Dakar, Sénégal            │
│  Destinataire : M. Babacar Ndiaye                                     │
│  Date prévue : 10 septembre 2026                                      │
│  Frais estimés : 25 000 FCFA                                          │
│                                                                       │
│  ─── Retour ───                                                       │
│  Document de retour : non déposé                                      │
│  [Déposer le PV ou la preuve de remise]                               │
│                                                                       │
│  ─── Historique ───                                                   │
│  - 02/09 : Mission créée par Maître Ndiaye                            │
│  - 03/09 : Huissier Diop notifié                                      │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

---

## 9. Gestion des clients

```
┌───────────────────────────────────────────────────────────────────────┐
│ [LOGO]  Clients  Dossiers  ...                          [+ Nouveau client]│
├───────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  Filtres : [Type ▼] [Conflit ▼]  [🔍 Rechercher]                     │
│                                                                       │
│  Raison sociale / Nom      Type         Coordonnées       Dossiers     │
│  ──────────────────────────────────────────────────────────────────── │
│  Société Alpha             Entreprise   alpha@sn          3            │
│  M. Diop                   Physique     77 123 45 67      1            │
│  ...                                                                  │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

---

## 10. Espace client

```
┌───────────────────────────────────────────────────────────────────────┐
│              [LOGO CABINET]                                           │
│                                                                       │
│  Bonjour, M. Diop                                                     │
│                                                                       │
│  Mes dossiers             Mes documents          Mes factures        │
│  ─────────────────────────────────────────────────────────────────    │
│                                                                       │
│  #2026-0041 - Litige foncier                                          │
│  Statut : En attente de pièces                                        │
│                                                                       │
│  Documents à télécharger :                                            │
│  - Reçu_paiement.pdf                                                  │
│                                                                       │
│  Documents demandés par le cabinet :                                  │
│  - Titre foncier (en attente)  [Téléverser]                           │
│                                                                       │
│  Prochain rendez-vous : 15/09/2026 à 10h00                            │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

---

## 11. Administration - Utilisateurs et rôles

```
┌───────────────────────────────────────────────────────────────────────┐
│ [LOGO]  Utilisateurs  Rôles  Paramètres  ...  [+ Ajouter utilisateur] │
├───────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  Nom              Email                 Rôle            Actif         │
│  ──────────────────────────────────────────────────────────────────── │
│  Awa Ndiaye       a.ndiaye@cabinet.sn   Avocat resp.    Oui          │
│  Ibra Diop        i.diop@cabinet.sn     Huissier        Oui          │
│  Fatou Fall       f.fall@cabinet.sn     Assistante      Oui          │
│  ...                                                                  │
│                                                                       │
│  [Modifier] [Désactiver] [Réinitialiser MFA]                          │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

---

## 12. Journal d'audit

```
┌───────────────────────────────────────────────────────────────────────┐
│ [LOGO]  Audit  ...                        [Exporter] [Filtrer]        │
├───────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  Date            Utilisateur   Action              Entité   Détails   │
│  ──────────────────────────────────────────────────────────────────── │
│  02/09 14:23     Ndiaye        consultation        doc-12   PDF       │
│  02/09 14:20     Fall          changement_statut   dos-42   En cours  │
│  02/09 11:05     Diop          connexion           user-8   192.168.x │
│  ...                                                                  │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

---

## Parcours utilisateurs prioritaires

### Parcours 1 : Ouvrir un dossier
1. Connexion de l'avocat.
2. Vérification MFA.
3. Clic sur "+ Nouveau dossier".
4. Saisie du client (création si nouveau).
5. Vérification des conflits d'intérêts.
6. Saisie des informations du dossier.
7. Attribution du responsable et des collaborateurs.
8. Enregistrement, génération de la référence interne.

### Parcours 2 : Déposer et publier un document
1. Accès à la fiche du dossier.
2. Onglet Documents.
3. Glisser-déposer du fichier.
4. Sélection de la catégorie.
5. Chiffrement côté client.
6. Upload vers S3.
7. Validation du document par l'avocat responsable.
8. Publication sélective vers l'espace client.

### Parcours 3 : Mission d'huissier
1. Création de la mission depuis le dossier ou le module.
2. Affectation de l'huissier.
3. Saisie des informations de signification.
4. Réalisation par l'huissier.
5. Dépôt du PV ou preuve de remise.
6. Validation et facturation.

### Parcours 4 : Connexion espace client
1. Le client reçoit un lien d'activation.
2. Création de son mot de passe.
3. Accès à son tableau de bord.
4. Consultation des dossiers autorisés.
5. Téléchargement des documents publiés.
6. Dépôt des pièces demandées.
