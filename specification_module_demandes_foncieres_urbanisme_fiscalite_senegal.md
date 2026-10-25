# Spécification fonctionnelle — Module « Démarches foncières, urbanisme et fiscalité »

> **Produit cible :** application web existante de gestion d’un cabinet juridique multidisciplinaire au Sénégal  
> **Version :** 1.0 — 29 septembre 2026  
> **Statut :** cahier des charges fonctionnel et modèle d’intégration  
> **Avertissement :** les listes de pièces sont des check-lists opérationnelles à faire valider par l’autorité territorialement compétente avant chaque dépôt. Une administration peut exiger des pièces complémentaires selon le lieu, la nature du droit, le projet et l’état du dossier.

---

## 1. Objectif du module

Créer un module permettant au cabinet de recevoir, qualifier, préparer, déposer, suivre, relancer, clôturer et archiver les démarches administratives foncières, cadastrales, d’urbanisme et fiscales de ses clients.

Le module ne doit **jamais** présenter le cabinet comme l’autorité qui délivre l’acte. Il distingue impérativement :

- `DOCUMENT_INTERNE_CABINET` : acte, lettre, requête, procuration, note juridique, bordereau ou rapport préparé par le cabinet ;
- `DOCUMENT_ADMINISTRATIF_A_OBTENIR` : document officiel produit ou visé par une administration ;
- `PIECE_CLIENT` : pièce communiquée par le client ou un tiers ;
- `PIECE_TECHNIQUE` : plan, étude, devis, document d’architecte, de géomètre ou autre professionnel ;
- `PREUVE_DE_DEPOT_ET_SUIVI` : récépissé, quittance, courrier d’envoi, preuve de paiement, décision, notification.

Le cabinet peut préparer, contrôler, conseiller, représenter sur mandat et assurer les relances. L’administration compétente instruit et délivre l’acte administratif.

---

## 2. Périmètre des démarches

### 2.1 Catalogue initial

| Code | Intitulé dans l’application | Famille | Autorité / interlocuteur principal | Nature du résultat |
|---|---|---|---|---|
| `URB_LOTIR` | Autorisation de lotir | Urbanisme | Autorité compétente en urbanisme, avec avis des services / collectivité concernés | Autorisation administrative |
| `URB_CONSTRUIRE` | Autorisation de construire | Urbanisme | Maire de la commune territorialement compétente et services d’urbanisme | Autorisation administrative |
| `CAD_AVIS_FAVORABLE` | Avis favorable cadastral / technique | Cadastre | Bureau du Cadastre compétent | Avis ou visa selon objet précis |
| `CAD_EXTRAIT_PLAN` | Extrait de plan cadastral certifié | Cadastre | Bureau du Cadastre territorialement compétent | Extrait certifié |
| `CAD_CIC` | Certificat d’identification cadastrale (CIC) | Cadastre | Bureau du Cadastre compétent | Certificat portant le NICAD |
| `CAD_NICAD` | Attribution / recherche de NICAD | Cadastre | Bureau du Cadastre de situation de la parcelle | NICAD / information cadastrale |
| `FON_RAD` | Radiation d’inscription ou de charge | Livre foncier / conservation | Conservation foncière compétente | Mention de radiation / rejet motivé |
| `FON_MAINLEVEE` | Mainlevée | Sûretés / foncier | Créancier bénéficiaire, notaire / conservation selon la sûreté | Acte de mainlevée et, si nécessaire, radiation |
| `ADM_DUPLICATA` | Duplicata d’un document administratif | Transversal | Administration émettrice du document original | Duplicata / copie / refus motivé |
| `FIS_ENREG_PROC` | Enregistrement d’un acte ou d’une procédure | Enregistrement | Centre / bureau compétent de la DGID | Formalité enregistrée, quittance ou référence |
| `FIS_DECES` | Déclaration après décès | Enregistrement / succession | Service compétent de la DGID | Déclaration reçue / liquidation / quittance |
| `FIS_NON_IMPOSITION` | Attestation / certificat de non-imposition | Fiscalité | Centre des services fiscaux du domicile | Attestation de non-imposition |
| `FIS_AVIS_IMPOSITION` | Avis / attestation d’imposition | Fiscalité | Centre des services fiscaux du domicile | Avis ou attestation d’imposition |
| `DOM_BAIL_TF` | Transformation d’un bail en titre foncier | Domaines / foncier | Direction de l’Enregistrement, des Domaines et du Timbre (DEDT / DGID) | Titre foncier après instruction |
| `DOM_PERMIS_TF` | Transformation d’un permis / autorisation d’occuper en titre foncier | Domaines / foncier | DEDT / DGID, sous réserve de recevabilité du droit | Titre foncier après instruction |
| `FIS_ACQUIESCEMENT` | Acte d’acquiescement en matière fiscale | Fiscalité contentieuse | Autorité fiscale compétente | Acte / lettre d’acquiescement et preuve de dépôt |

### 2.2 Règle de qualification préalable obligatoire

Les libellés « avis favorable », « document de radiation », « mainlevée », « duplicata », « enregistrement d’une procédure », « déclaration après décès » et « acte d’acquiescement fiscalité » sont potentiellement ambigus. Avant la génération du dossier, l’assistante doit obligatoirement renseigner un **sous-type**, le document ou l’inscription visé(e), l’autorité concernée et le fondement de la demande.

Exemples :

- radiation d’hypothèque, de prénotation, de saisie, de servitude, de bail, d’inscription ou autre ;
- mainlevée amiable ou judiciaire ; créancier, référence de la sûreté, acte constitutif ;
- duplicata d’un titre, d’un certificat, d’une quittance, d’un acte administratif ou d’une pièce d’état civil ;
- enregistrement d’un acte, d’un jugement, d’un bail, d’une convention ou autre ;
- déclaration successorale après décès ;
- acquiescement à un redressement, à une décision de taxation, ou à une autre procédure fiscale.

Le système doit empêcher le passage à l’état `PRET_A_DEPOT` tant que cette qualification n’est pas complétée.

---

## 3. Répartition des rôles

| Action | Cabinet | Client / mandant | Administration / tiers technique |
|---|---|---|---|
| Ouvrir le dossier et vérifier les conflits | Oui | Informations exactes | Non |
| Identifier la démarche et l’autorité compétente | Oui | Valider le besoin | Non |
| Réunir les pièces personnelles et justificatifs originaux | Contrôle | Oui | Peut délivrer certaines pièces |
| Préparer demande, procuration, bordereau, courrier | Oui | Signer si requis | Non |
| Produire plan architectural, bornage, étude technique | Coordination / contrôle | Finance et mandate | Architecte, géomètre, bureau d’études |
| Déposer le dossier | Oui si mandat et règles applicables le permettent | Peut déposer lui-même | Réceptionne et instruit |
| Payer taxes, timbres, droits, redevances | Suivi des fonds / justificatifs | Supporte le coût, sauf convention | Encaisse / délivre quittance |
| Délivrer l’autorisation, certificat, avis ou titre | Non | Non | Oui |
| Relancer, contester, compléter | Oui sur mandat | Fournit les compléments | Répond / instruit |

### 3.1 Profils applicatifs

- `ASSISTANTE_JURIDIQUE` : ouverture, saisie, check-list, relances, préparation de brouillons, scan et classement ; aucune validation juridique finale.
- `JURISTE` : qualification, contrôle des pièces, validation des lettres standards, notes de recevabilité.
- `AVOCAT_RESPONSABLE` : validation des analyses, mandats sensibles, recours, démarches contentieuses et signatures réservées.
- `AGENT_DE_LIAISON` : dépôt, récupération, journal de déplacement, scan des récépissés ; pas de suppression.
- `COMPTABLE_CAISSE` : débours, avances, justificatifs, rapprochement des quittances.
- `ADMINISTRATEUR` : paramétrage du catalogue, des modèles, des circuits et des droits.
- `CLIENT_PORTAIL` : transmission des pièces, consultation du statut et paiement selon les droits accordés.

---

## 4. Données à collecter

### 4.1 Fiche demandeur obligatoire

Le système doit gérer une fiche unique `demandeur` réutilisable, avec contrôle de complétude selon personne physique ou morale.

| Groupe | Champs obligatoires ou conditionnels |
|---|---|
| Identification personne physique | civilité, nom, prénoms, date et lieu de naissance, nationalité, profession, situation matrimoniale si utile, type et numéro CNI/passeport, date d’expiration si connue |
| Coordonnées | adresse complète, commune, département, région, téléphone, WhatsApp si autorisé, e-mail, adresse de correspondance si différente |
| Personne morale | raison sociale, forme juridique, NINEA/RCCM si applicable, siège social, représentant légal, qualité du signataire, pièce justificative du pouvoir |
| Fiscalité | NINEA, centre fiscal, numéro contribuable le cas échéant, exercice / année fiscale concernée |
| Mandat | existence d’une procuration, date, étendue, signataire, pièce d’identité du mandant, date d’expiration, original détenu oui/non |
| Confidentialité | base du traitement, consentement de communication, préférences de notification, niveau de confidentialité |

### 4.2 Fiche bien immobilier / parcelle

Une démarche foncière ou d’urbanisme doit être rattachée à une fiche `parcelle_bien` versionnée.

- région, département, commune, quartier / village / lotissement ;
- adresse ou indications de localisation ;
- NICAD si connu ;
- numéro de titre foncier, bail, permis / autorisation d’occuper, délibération ou acte d’attribution ;
- lot, bloc, îlot, parcelle, section, superficie déclarée et unité ;
- coordonnées géographiques si disponibles ;
- titulaire(s) du droit et quotes-parts ;
- origine du droit, date de l’acte, références d’enregistrement ;
- charges, inscriptions, hypothèques, prénotations, contentieux connus ;
- usage actuel et usage projeté ;
- références de plans et professionnel auteur ;
- état de vérification : `DECLARE`, `PIECES_RECUES`, `A_VERIFIER`, `VERIFIE`, `INCOHERENT`.

### 4.3 Fiche démarche

Champs essentiels :

- référence interne automatique ;
- type de démarche et sous-type ;
- dossier juridique parent ;
- demandeur principal, co-demandeurs, mandataire et bénéficiaire réel si différent ;
- parcelle(s) concernée(s) ;
- autorité / bureau compétent, adresse de dépôt, contact si disponible ;
- objet détaillé, finalité, urgence, date limite connue ;
- fondement de la demande et références des actes ;
- responsable interne, assistante assignée, agent de liaison ;
- statut, priorité, niveau de risque ;
- estimation des honoraires, débours, taxes, timbres, avances reçues ;
- dates de dépôt, récépissé, relances, décision, retrait ;
- résultat, motif de rejet le cas échéant, voies de recours et échéance de recours ;
- lien vers la GED et journal d’audit.

---

## 5. Check-lists documentaires par démarche

### 5.1 Autorisation de lotir — `URB_LOTIR`

**Autorité :** autorité compétente en urbanisme ; la compétence exacte, les avis requis et le lieu de dépôt doivent être paramétrables selon la collectivité et la zone.

**Pièces de base à exiger dans le module :**

- demande signée adressée à l’autorité compétente ;
- justificatif du droit sur le terrain : titre foncier, bail, droit de superficie, autorisation d’occuper ou acte admis ;
- pièce d’identité du demandeur ou documents société et pouvoir du représentant ;
- procuration si dépôt par le cabinet ;
- plan de situation du terrain à lotir ;
- plan topographique / plan de bornage et références du géomètre si requis ;
- document graphique présentant l’état actuel, le découpage parcellaire proposé et les voies / dessertes ;
- rapport de présentation décrivant le projet, les caractéristiques des parcelles et les équipements prévus ;
- plan de lotissement conforme aux documents de planification applicables ;
- étude / avis technique ou environnemental lorsque requis ;
- quittances, droits, timbres et autres pièces exigées localement ;
- extrait de plan cadastral / NICAD si requis ;
- tout avis de la collectivité, du cadastre, des réseaux ou des services techniques exigé localement.

**Sorties générées par le cabinet :** lettre de demande, bordereau de pièces, procuration, fiche de contrôle de conformité urbanistique, lettre de transmission / relance.

### 5.2 Autorisation de construire — `URB_CONSTRUIRE`

**Autorité :** Maire de la commune territorialement compétente, dans le circuit des services d’urbanisme applicable.

**Pièces de base :**

- demande adressée au Maire compétent ;
- titre de propriété ou justificatif du droit à construire ;
- fiche de renseignement ;
- devis descriptif et estimatif ;
- plans architecturaux : situation, masse, plans, coupes et façades, aux échelles demandées ;
- plan de fosse septique ou indication du raccordement / système d’évacuation ;
- extrait de plan cadastral visé par le Cadastre ;
- taxe d’urbanisme et timbre fiscal selon les montants et règles en vigueur ;
- procuration le cas échéant ;
- pièces d’identité / pouvoirs de la personne physique ou morale ;
- toute étude ou visa complémentaire demandé selon la nature et la localisation du projet.

**Contrôles application :** nombre d’exemplaires `2` pour dossier simple et `3` pour dossier complexe, mais valeur paramétrable ; correspondance stricte entre le nom du titulaire, le terrain, les plans et la demande ; alerte si extrait cadastral absent ou expiré selon la règle interne.

### 5.3 Avis favorable cadastral / technique — `CAD_AVIS_FAVORABLE`

**Important :** ne pas figer une liste universelle. L’expression doit être qualifiée par `objet_avis` : conformité de plan, avis sur identification de parcelle, avis préalable à une opération, visa de plan, autre.

**Pièces noyau :**

- demande motivée adressée au Chef du Bureau compétent ;
- identité / pouvoir du demandeur ;
- titre ou acte d’attribution disponible ;
- extrait de plan, plan de situation, plan de bornage ou plan technique selon l’objet ;
- NICAD si connu ;
- références de la procédure administrative liée ;
- procuration ;
- preuve de paiement ou timbre si exigé ;
- pièces complémentaires paramétrées par bureau / objet.

### 5.4 Extrait de plan cadastral certifié — `CAD_EXTRAIT_PLAN`

**Autorité :** Bureau du Cadastre territorialement compétent.

**Pièce minimale officiellement publiée :** demande. En pratique, le module doit demander, à titre de pré-contrôle, l’identification exacte de la parcelle, le NICAD si disponible, une copie de titre / acte d’attribution et une pièce d’identité / procuration, car l’administration peut demander des compléments.

**Usage :** bail, immatriculation, autorisation de construire, morcellement de parcelles et autres dossiers fonciers.

### 5.5 Certificat d’identification cadastrale (CIC) — `CAD_CIC`

**Autorité :** Bureau du Cadastre compétent.

**Pièces noyau :**

- demande adressée au Chef du Bureau du Cadastre ;
- état de droits réels ;
- extrait de plan cadastral ;
- identité / pouvoir du demandeur ;
- procuration si applicable ;
- tout complément demandé par le bureau.

**Règle :** le CIC est à traiter comme un document administratif issu du Cadastre ; le cabinet prépare et suit la demande, mais ne « produit » jamais le CIC.

### 5.6 NICAD — `CAD_NICAD`

**Autorité :** Bureau du Cadastre de la localité de situation de la parcelle.

**Pièces officielles publiées :**

- copie du titre foncier ou de l’acte d’attribution ;
- plan de situation de la parcelle ;
- copie de la pièce d’identité du propriétaire.

**Données internes supplémentaires :** commune, quartier, repères de localisation, titulaire, procuration et coordonnées du demandeur.

### 5.7 Radiation — `FON_RAD`

**Qualification impérative avant check-list :** type d’inscription / charge, référence de l’inscription, registre concerné, bénéficiaire / créancier, motif juridique de radiation.

**Pièces noyau :**

- requête ou demande de radiation adressée à l’autorité / conservation compétente ;
- copie de l’acte ou de l’inscription à radier ;
- justificatif du motif : mainlevée, jugement définitif / exécutoire, quittance, acte de renonciation, extinction de la dette ou autre titre ;
- identité et qualité du requérant ;
- procuration ;
- acte notarié ou judiciaire lorsque requis ;
- preuve du paiement des droits / frais si applicables ;
- bordereau de dépôt.

**Règle de risque :** validation avocat obligatoire si la radiation découle d’un contentieux, affecte une garantie, un droit réel ou une saisie.

### 5.8 Mainlevée — `FON_MAINLEVEE`

**Qualification :** type de sûreté ou mesure, créancier / bénéficiaire, référence de l’inscription, dette ou obligation éteinte, mainlevée amiable ou judiciaire.

**Pièces noyau :**

- demande ou acte de mainlevée signé par le créancier / bénéficiaire habilité, ou décision judiciaire ;
- preuve de l’extinction ou du règlement de l’obligation ;
- copie de l’acte constitutif et références d’inscription ;
- identité et pouvoirs des signataires ;
- procuration ;
- acte authentique ou formalité particulière lorsque la nature de la sûreté l’exige ;
- demande de radiation subséquente si nécessaire ;
- quittances et récépissés.

**Sorties cabinet :** projet d’acte / lettre de mainlevée, demande de radiation, courrier au créancier, note de contrôle des signatures.

### 5.9 Duplicata — `ADM_DUPLICATA`

**Qualification :** administration émettrice, nature du document, référence / date si connue, perte / vol / détérioration / autre motif, urgence.

**Pièces noyau :**

- demande motivée de duplicata ;
- copie d’identité ;
- copie du document si disponible ou référence exacte ;
- déclaration de perte, vol ou détérioration si exigée ;
- procuration ;
- preuve de qualité du demandeur / titulaire ;
- timbre, quittance ou droit selon l’administration ;
- documents spécifiques au type d’acte.

### 5.10 Enregistrement d’acte ou de procédure — `FIS_ENREG_PROC`

**Qualification :** préciser `nature_acte` : bail, vente, donation, jugement, convention, mandat, acte de société, autre. Le terme « enregistrement d’une procédure » ne suffit pas.

**Pièces noyau :**

- original ou expédition de l’acte / décision à enregistrer ;
- bordereau de présentation ou lettre de dépôt ;
- identité / NINEA des parties selon l’acte ;
- procuration si dépôt par le cabinet ;
- pièces justifiant l’assiette ou la valeur déclarée, selon la nature de l’acte ;
- droits, pénalités éventuelles et quittances ;
- copie conservée par le cabinet ;
- preuve de dépôt et référence d’enregistrement.

**Règle :** afficher une alerte de délai légal configurable par type d’acte ; ne pas coder de délai fixe sans validation fiscale à jour.

### 5.11 Déclaration après décès — `FIS_DECES`

**Qualification :** succession, mutation par décès, déclaration fiscale ou autre démarche. Identifier le défunt, les héritiers, l’existence d’un testament, d’un mariage, d’immeubles, de parts sociales et de dettes.

**Pièces noyau :**

- acte / certificat de décès ;
- pièce d’identité du déclarant et qualité ;
- documents d’état civil établissant les liens et la qualité d’héritier ;
- procurations des héritiers / mandats si applicable ;
- inventaire des actifs, passifs et droits du défunt ;
- titres fonciers, baux, extraits, relevés bancaires, actes de propriété, parts sociales, véhicules et autres justificatifs selon patrimoine ;
- testament, donation, contrat de mariage, jugement d’hérédité / certificat d’hérédité selon les cas ;
- déclaration préparée, bordereau de dépôt et pièces fiscales demandées ;
- quittances et décision / liquidation si applicable.

**Règle de risque :** validation avocat obligatoire ; dossier « sensible » ; accès restreint par défaut.

### 5.12 Attestation de non-imposition — `FIS_NON_IMPOSITION`

**Autorité :** Centre des services fiscaux du domicile du requérant.

**Pièces officielles publiées :**

- demande adressée au chef de centre compétent ;
- attestation de chômage ;
- photocopie de la CNI ;
- certificat de résidence ou de domicile ;
- toute pièce complémentaire demandée par le Centre, telle qu’une attestation d’hébergement.

**Contrôle :** l’assistante doit sélectionner l’année / période concernée et vérifier la cohérence de l’adresse avec le centre fiscal.

### 5.13 Avis / attestation d’imposition — `FIS_AVIS_IMPOSITION`

**Autorité :** Centre des services fiscaux du domicile du requérant.

**Pièces officielles publiées :**

- demande adressée au chef de centre compétent ;
- copie de la déclaration fiscale ;
- pour un salarié, bulletin de salaire ;
- photocopie de la CNI ;
- certificat de domicile ou de résidence.

**Données supplémentaires :** année concernée, impôt concerné, NINEA si applicable, employeur / activité et moyen de retour souhaité.

### 5.14 Transformation d’un bail en titre foncier — `DOM_BAIL_TF`

**Autorité :** Direction de l’Enregistrement, des Domaines et du Timbre ; instruction administrative et, le cas échéant, commission compétente.

**Pièces officiellement publiées :**

- demande écrite adressée au Directeur de l’Enregistrement, des Domaines et du Timbre ;
- copie certifiée conforme du bail, du certificat d’inscription de bail, du contrat de droit de superficie ou de l’autorisation d’occuper ;
- copie certifiée conforme de la CNI, ou document établissant le statut de la société pour une personne morale ;
- quittance de paiement des redevances d’occupation.

**Pré-contrôles recommandés :** identité du titulaire strictement identique au contrat, situation des redevances, références de la parcelle, plans / NICAD disponibles, régime matrimonial ou pouvoirs sociaux, charges et contentieux connus.

### 5.15 Transformation d’un permis / autorisation d’occuper en titre foncier — `DOM_PERMIS_TF`

**Important :** le libellé utilisateur doit être présenté comme « transformation d’un permis ou d’une autorisation d’occuper en titre foncier — sous réserve de recevabilité du droit ». La recevabilité et les pièces exactes dépendent du titre administratif, de la zone, de la réglementation applicable et de l’instruction de l’administration.

**Pièces noyau :**

- demande au Directeur de l’Enregistrement, des Domaines et du Timbre ;
- copie certifiée conforme du permis / autorisation d’occuper et, si disponible, certificat d’inscription ;
- identité / documents de société et pouvoirs ;
- quittances de redevances d’occupation ;
- plan de situation, références cadastrales / NICAD et acte d’attribution si disponibles ;
- justificatifs de mise en valeur / construction lorsqu’exigés ;
- procuration ;
- toutes pièces complémentaires demandées lors de l’instruction.

### 5.16 Acte d’acquiescement fiscal — `FIS_ACQUIESCEMENT`

**Qualification obligatoire :** acquiescement à quelle décision, imposition, proposition, redressement ou procédure ?

**Pièces noyau :**

- copie de l’avis, notification, proposition de rectification, décision ou acte visé ;
- lettre / acte d’acquiescement précisant sans ambiguïté les références, montants, période et portée ;
- identité / NINEA et pouvoir du signataire ;
- procuration / mandat ;
- pièces de calcul et, le cas échéant, calendrier de paiement / justificatif de paiement ;
- preuve du dépôt ou de la transmission ;
- note de conseil validée par avocat ou fiscaliste ;
- décision / accusé de réception de l’administration.

**Règle de risque :** aucune génération finale sans validation d’un avocat / fiscaliste et confirmation expresse du client, car l’acquiescement peut emporter des conséquences juridiques et financières.

---

## 6. Workflow opérationnel

### 6.1 États standard

```text
BROUILLON
→ A_QUALIFIER
→ ATTENTE_CLIENT
→ PIECES_PARTIELLES
→ CONTROLE_INTERNE
→ A_CORRIGER
→ PRET_VALIDATION
→ PRET_A_DEPOT
→ DEPOSE
→ EN_INSTRUCTION
→ COMPLEMENT_DEMANDE
→ RELANCE
→ ACCEPTE / DOCUMENT_DELIVRE
→ REFUSE / CLASSE_SANS_SUITE
→ RECOURS_A_ETUDIER
→ CLOTURE
→ ARCHIVE
```

### 6.2 Règles de transition

- `A_QUALIFIER` : sous-type, autorité, demandeur et objet doivent être renseignés.
- `PRET_VALIDATION` : toutes les pièces marquées `OBLIGATOIRE` sont reçues ou une dérogation motivée est validée.
- `PRET_A_DEPOT` : demande signée, mandat contrôlé, taxe / avance suivie, bordereau de pièces généré, contrôle juridique effectué lorsque requis.
- `DEPOSE` : saisie obligatoire de la date, du déposant, de l’autorité, du canal et du numéro de récépissé si remis.
- `DOCUMENT_DELIVRE` : scan obligatoire du document final, données clés indexées, client notifié.
- `REFUSE` : motif, date de notification, pièce de refus et échéance de recours obligatoires si applicables.

### 6.3 Tâches automatiques

- créer une tâche « relance interne » après un délai paramétrable sans mouvement ;
- alerter avant l’expiration du mandat, de la CNI, du document technique ou de la date de recours ;
- relancer automatiquement le client pour chaque pièce manquante, sans exposer de données sensibles dans le message ;
- interdire la clôture si débours non rapprochés ou original à restituer non enregistré ;
- générer une revue hebdomadaire des dossiers `DEPOSE`, `EN_INSTRUCTION` et `COMPLEMENT_DEMANDE`.

---

## 7. Exigences d’interface pour l’assistante

### 7.1 Assistant de création en 7 étapes

1. **Choisir la démarche** : catalogue, recherche, sous-type obligatoire si démarche ambiguë.
2. **Identifier le client et le demandeur** : recherche dans la base ou création contrôlée.
3. **Renseigner le bien / la situation** : parcelle, références, localisation et droit invoqué.
4. **Déterminer le circuit** : autorité, bureau, canal de dépôt et responsable interne.
5. **Collecter les pièces** : check-list avec statut, date de réception, validité et contrôle.
6. **Préparer les documents** : fusion des variables dans les modèles, aperçu, validation, signature.
7. **Déposer et suivre** : bordereau, récépissé, frais, échéances, relances, décision.

### 7.2 Écran « check-list »

Chaque ligne de pièce doit contenir :

- libellé et code ;
- catégorie ;
- obligatoire / conditionnelle / facultative ;
- condition d’exigibilité lisible ;
- source attendue : client, cabinet, administration, architecte, géomètre, notaire, autre ;
- statut : non demandée, demandée, reçue, illisible, expirée, validée, non applicable, rejetée ;
- document attaché, version, date, auteur de contrôle, commentaire ;
- bouton « demander au client » ;
- visibilité client paramétrable.

### 7.3 Tableau de bord

Indicateurs minimums :

- demandes ouvertes par type et par statut ;
- dossiers bloqués par pièce manquante ;
- dossiers en attente d’administration ;
- relances à faire aujourd’hui / cette semaine ;
- documents délivrés non encore remis au client ;
- avances, débours et quittances non rapprochés ;
- dossiers à risque élevé et échéances de recours.

---

## 8. Modèles documentaires à intégrer

### 8.1 Modèles transversaux

| Code modèle | Titre | Variables essentielles |
|---|---|---|
| `TPL_DEM_ADMIN` | Demande administrative générique | demandeur, autorité, objet, références, parcelle, pièces, signataire |
| `TPL_BORDEREAU_DEPOT` | Bordereau de pièces | référence dossier, autorité, liste pièces, nombre d’exemplaires, déposant |
| `TPL_PROCURATION_ADMIN` | Procuration administrative | mandant, mandataire, objet, autorité, durée, limites du mandat |
| `TPL_RELANCE_ADMIN` | Lettre de relance administrative | référence dépôt, récépissé, date, objet, demandeur |
| `TPL_DEMANDE_COMPLEMENT_CLIENT` | Demande de pièces au client | client, démarche, pièces manquantes, échéance, canal sécurisé |
| `TPL_NOTE_RECEVABILITE` | Note de recevabilité | faits, droit invoqué, pièces vérifiées, risques, recommandation |
| `TPL_REMISE_DOCUMENT_CLIENT` | Procès-verbal de remise | document remis, numéro, date, destinataire, signature |
| `TPL_COMPTE_RENDU_DEPOT` | Compte rendu de dépôt | lieu, date, agent, pièces déposées, récépissé, frais |

### 8.2 Modèles spécialisés

- `TPL_URB_LOTIR_DEMANDE` — demande d’autorisation de lotir
- `TPL_URB_CONSTRUIRE_DEMANDE` — demande d’autorisation de construire
- `TPL_CAD_EXTRAIT_PLAN_DEMANDE` — demande d’extrait de plan cadastral
- `TPL_CAD_CIC_DEMANDE` — demande de CIC
- `TPL_CAD_NICAD_DEMANDE` — demande de NICAD
- `TPL_FON_RAD_DEMANDE` — requête de radiation qualifiée
- `TPL_FON_MAINLEVEE` — projet de mainlevée / lettre au créancier
- `TPL_ADM_DUPLICATA` — demande de duplicata
- `TPL_FIS_ENREG_BORDEREAU` — bordereau d’enregistrement d’acte
- `TPL_FIS_DECES_DECLARATION` — brouillon de déclaration après décès à valider
- `TPL_FIS_NON_IMPOSITION` — demande d’attestation de non-imposition
- `TPL_FIS_AVIS_IMPOSITION` — demande d’avis / attestation d’imposition
- `TPL_DOM_BAIL_TF` — demande de transformation de bail en titre foncier
- `TPL_DOM_PERMIS_TF` — demande de transformation de permis / autorisation d’occuper
- `TPL_FIS_ACQUIESCEMENT` — projet d’acquiescement fiscal à validation renforcée

### 8.3 Exemple de modèle : demande d’extrait de plan cadastral

```text
[Ville], le {{date_courrier}}

À Monsieur / Madame le Chef du Bureau du Cadastre de {{bureau_cadastre}}

Objet : Demande d’extrait de plan cadastral certifié
Référence cabinet : {{reference_demarche}}

Monsieur / Madame le Chef de Bureau,

J’ai l’honneur de solliciter la délivrance d’un extrait de plan cadastral certifié
relatif à la parcelle située à {{localisation_parcelle}}, identifiée, si connu, sous
le NICAD {{nicad}} et/ou les références foncières suivantes : {{references_foncieres}}.

Cette demande est présentée pour le compte de {{demandeur_nom_complet}},
{{qualite_demandeur}}, demeurant / ayant son siège à {{adresse_demandeur}}.

Vous trouverez ci-joint les pièces utiles à l’instruction de la présente demande,
selon la check-list jointe.

Je vous prie d’agréer, Monsieur / Madame le Chef de Bureau, l’expression de ma considération distinguée.

{{signataire_nom}}
{{signataire_qualite}}
{{signature}}
```

---

## 9. Génération, impression et PDF

### 9.1 Exigences fonctionnelles

- modèles DOCX / HTML versionnés avec variables de fusion ;
- aperçu avant génération ;
- génération en PDF non modifiable et, si nécessaire, DOCX éditable ;
- en-tête / pied de page du cabinet, numéro de dossier, pagination, code QR ou code de vérification facultatif ;
- insertion automatique des annexes dans un **dossier de dépôt PDF** avec sommaire, pagination et bordereau ;
- signature manuscrite scannée ou mécanisme de signature électronique conforme à la politique du cabinet ;
- impression unitaire ou par lot ;
- archivage du PDF final avec hash, version du modèle, utilisateur générateur et horodatage ;
- impossibilité de remplacer silencieusement un document finalisé : créer une nouvelle version ;
- filigrane `BROUILLON` tant que le document n’est pas validé.

### 9.2 Paquet de dépôt

Le bouton `Générer le paquet de dépôt` doit produire :

1. une page de garde : référence, demandeur, démarche, destinataire ;
2. la lettre / requête signée ;
3. le bordereau des pièces ;
4. les annexes dans l’ordre de la check-list ;
5. un sommaire avec pages ;
6. une fiche interne non transmise, séparée du paquet, contenant les contacts, risques et instructions de dépôt.

---

## 10. Architecture de données recommandée

### 10.1 Tables principales

```text
legal_cases
administrative_requests
administrative_request_types
administrative_request_subtypes
request_authorities
request_checklist_templates
request_checklist_template_items
request_checklist_items
request_parties
persons
organizations
properties
property_rights
mandates
documents
 document_versions
 document_links
 document_templates
request_deposits
request_followups
request_decisions
request_fees
request_payments
request_tasks
audit_logs
```

> Conserver `tenant_id` sur chaque table métier si l’application est multi-cabinet. Ajouter `created_by`, `updated_by`, `created_at`, `updated_at`, et privilégier l’archivage logique (`archived_at`) à la suppression définitive.

### 10.2 Exemple de structure SQL indicative

```sql
CREATE TABLE administrative_requests (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  tenant_id BIGINT NOT NULL,
  legal_case_id BIGINT NULL,
  reference VARCHAR(50) NOT NULL,
  request_type_code VARCHAR(50) NOT NULL,
  request_subtype_code VARCHAR(80) NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'BROUILLON',
  priority VARCHAR(20) NOT NULL DEFAULT 'NORMALE',
  risk_level VARCHAR(20) NOT NULL DEFAULT 'STANDARD',
  applicant_party_id BIGINT NOT NULL,
  authority_id BIGINT NULL,
  property_id BIGINT NULL,
  assigned_assistant_id BIGINT NULL,
  responsible_lawyer_id BIGINT NULL,
  subject TEXT NOT NULL,
  legal_basis TEXT NULL,
  submitted_at DATETIME NULL,
  receipt_number VARCHAR(120) NULL,
  decision_at DATETIME NULL,
  decision_type VARCHAR(40) NULL,
  decision_notes TEXT NULL,
  next_followup_at DATETIME NULL,
  created_by BIGINT NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  archived_at DATETIME NULL,
  UNIQUE KEY uq_request_reference (tenant_id, reference)
);

CREATE TABLE request_checklist_items (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  tenant_id BIGINT NOT NULL,
  administrative_request_id BIGINT NOT NULL,
  item_code VARCHAR(80) NOT NULL,
  label VARCHAR(255) NOT NULL,
  required_level VARCHAR(20) NOT NULL,
  condition_expression TEXT NULL,
  expected_source VARCHAR(30) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'NON_DEMANDEE',
  document_id BIGINT NULL,
  received_at DATETIME NULL,
  validated_by BIGINT NULL,
  validated_at DATETIME NULL,
  expires_at DATE NULL,
  notes TEXT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL
);
```

### 10.3 JSON de paramétrage d’un type de démarche

```json
{
  "code": "URB_CONSTRUIRE",
  "label": "Autorisation de construire",
  "family": "URBANISME",
  "requires_property": true,
  "requires_mandate_check": true,
  "approval_required": ["JURISTE"],
  "authority_rule": "MAIRIE_COMMUNE_PARCELLE",
  "checklist_template": "CHK_URB_CONSTRUIRE_V1",
  "document_templates": [
    "TPL_URB_CONSTRUIRE_DEMANDE",
    "TPL_BORDEREAU_DEPOT",
    "TPL_PROCURATION_ADMIN",
    "TPL_COMPTE_RENDU_DEPOT"
  ],
  "risk_rules": [
    "REQUIRE_PROPERTY_RIGHT",
    "REQUIRE_CADASTRAL_EXTRACT",
    "MATCH_APPLICANT_AND_TITLE_HOLDER"
  ]
}
```

---

## 11. Sécurité, preuve et conformité

- appliquer le principe du moindre privilège ;
- isoler les dossiers sensibles, notamment successions, fiscalité et sûretés ;
- journaliser toute consultation, téléchargement, impression, modification, validation, dépôt et suppression logique ;
- chiffrer les fichiers au repos et protéger les liens de téléchargement ;
- éviter l’envoi par WhatsApp ou e-mail non sécurisé des CNI, titres fonciers et dossiers complets ; envoyer plutôt un lien authentifié et à durée limitée ;
- conserver les originaux et la chaîne de remise : détenteur, date, lieu, restitution ;
- stocker les copies de reçus, quittances et preuves de dépôt dans la GED ;
- séparer strictement les honoraires du cabinet, les débours, les taxes et les fonds avancés par le client ;
- rendre les règles, montants, autorités et pièces **paramétrables**, sans les coder en dur ;
- prévoir un écran « mises à jour réglementaires » avec date d’effet, source, auteur de la modification et historique.

---

## 12. Critères d’acceptation

Le module est accepté lorsque :

- l’assistante peut créer une demande complète en suivant un assistant guidé ;
- chaque demande est rattachée à un client / demandeur, une autorité et, si applicable, une parcelle ;
- la check-list est générée selon le type et le sous-type de démarche ;
- une pièce obligatoire manquante bloque le dépôt sauf dérogation validée et journalisée ;
- les modèles génèrent des courriers correctement remplis et exportables en PDF ;
- le dépôt enregistre un récépissé, un déposant, une date et les frais ;
- les relances et échéances sont visibles sur un tableau de bord ;
- les documents finaux sont versionnés et liés au dossier ;
- les procédures sensibles exigent une validation renforcée ;
- les listes de pièces, autorités, frais et délais sont modifiables par un administrateur autorisé.

---

## 13. Sources de vérification à maintenir dans l’application

- Ministère de l’Urbanisme : fiche de demande d’autorisation de construire et textes applicables.
- DGID : fiches de démarches foncières et fiscales, notamment NICAD, extrait de plan cadastral, attestation de non-imposition et avis d’imposition.
- Ministère chargé des Finances / DGID : procédure de transformation d’un bail, d’un droit de superficie ou d’une autorisation d’occuper en titre foncier.
- Code de l’Urbanisme et textes réglementaires applicables.
- Instructions, formulaires et exigences effectivement communiqués par le service territorialement compétent au moment du dépôt.

**Principe opérationnel final :** le logiciel doit aider le cabinet à faire un dossier administrativement propre, traçable et professionnel ; il ne doit pas garantir l’acceptation ni remplacer la vérification juridique, technique et administrative adaptée à chaque cas.
