# Spécification mise à jour — Module Démarches, Transactions, Ventes et Baux au Sénégal

> **Application cible :** gestion d’un cabinet juridique multidisciplinaire au Sénégal  
> **Version :** 1.1 — 1 octobre 2026  
> **Finalité :** permettre à l’assistante, aux juristes et aux avocats de gérer professionnellement les démarches foncières, administratives, fiscales, les ventes et les locations, avec traçabilité des interventions du cabinet et des autorités externes.
>
> **Avertissement opérationnel :** les pièces, compétences, taxes, délais et formulaires doivent rester paramétrables et être vérifiés au moment du dépôt auprès de l’autorité territorialement compétente. Le cabinet prépare, vérifie, conseille, coordonne et suit ; il ne délivre pas les actes administratifs et ne remplace ni le notaire ni l’administration.

---

## 1. Objectifs

Le module doit permettre de :

- ouvrir une demande, une transaction ou un contrat depuis un dossier juridique existant ;
- identifier avec précision les clients, demandeurs, vendeurs, acheteurs, bailleurs, locataires, mandataires et garants ;
- identifier le bien immobilier ou le terrain et ses références foncières ;
- contrôler la complétude et la cohérence des pièces ;
- préparer les courriers, contrats, bordereaux, mandats, procurations, rapports et états des lieux ;
- suivre les formalités devant le notaire, la DGID, le Cadastre, les Domaines, la Conservation foncière, les services fiscaux, les mairies, l’Urbanisme et tout intervenant utile ;
- enregistrer les dépôts, récépissés, quittances, décisions, relances et preuves ;
- générer, signer, imprimer et archiver des PDF versionnés ;
- empêcher les étapes sensibles tant que les validations obligatoires ne sont pas faites.

### 1.1 Catégories de documents

| Catégorie | Code | Description |
|---|---|---|
| Document interne | `DOCUMENT_INTERNE_CABINET` | Lettre, note juridique, rapport, bordereau, procuration, projet de contrat |
| Document administratif | `DOCUMENT_ADMINISTRATIF_A_OBTENIR` | Document délivré ou visé par une administration |
| Pièce client | `PIECE_CLIENT` | CNI, pouvoir, justificatif, titre, état civil, document société |
| Pièce technique | `PIECE_TECHNIQUE` | Plan, bornage, étude, devis, document architecte / géomètre |
| Preuve de suivi | `PREUVE_DEPOT_ET_SUIVI` | Récépissé, quittance, décision, courrier, preuve de paiement |
| Acte notarié | `ACTE_NOTARIE` | Acte préparé / reçu dans le circuit de l’étude notariale |
| Contrat signé | `CONTRAT_SIGNE` | Contrat sous seing privé ou contrat final signé |

---

## 2. Catalogue des démarches

| Code | Démarche | Famille | Autorité / interlocuteur principal |
|---|---|---|---|
| `URB_LOTIR` | Autorisation de lotir | Urbanisme | Autorité compétente, commune et services d’urbanisme |
| `URB_CONSTRUIRE` | Autorisation de construire | Urbanisme | Maire et services d’urbanisme compétents |
| `CAD_AVIS_FAVORABLE` | Avis favorable cadastral / technique | Cadastre | Bureau du Cadastre compétent |
| `CAD_EXTRAIT_PLAN` | Extrait de plan cadastral certifié | Cadastre | Bureau du Cadastre compétent |
| `CAD_CIC` | Certificat d’identification cadastrale | Cadastre | Bureau du Cadastre compétent |
| `CAD_NICAD` | Attribution ou recherche NICAD | Cadastre | Bureau du Cadastre compétent |
| `FON_RAD` | Radiation d’inscription ou de charge | Foncier | Conservation / autorité compétente |
| `FON_MAINLEVEE` | Mainlevée | Foncier / sûretés | Créancier, notaire, conservation ou juridiction |
| `ADM_DUPLICATA` | Duplicata d’un document | Transversal | Administration émettrice |
| `FIS_ENREG_PROC` | Enregistrement d’un acte | Fiscalité | DGID / service d’enregistrement compétent |
| `FIS_DECES` | Déclaration après décès | Fiscalité / succession | DGID, notaire ou autre autorité compétente |
| `FIS_NON_IMPOSITION` | Attestation de non-imposition | Fiscalité | Centre des services fiscaux |
| `FIS_AVIS_IMPOSITION` | Avis / attestation d’imposition | Fiscalité | Centre des services fiscaux |
| `DOM_BAIL_TF` | Transformation d’un bail en titre foncier | Domaines / foncier | DGID, Direction des Domaines, Conservation |
| `DOM_PERMIS_TF` | Transformation d’un permis / autorisation d’occuper en TF | Domaines / foncier | DGID et services compétents |
| `FIS_ACQUIESCEMENT` | Acte d’acquiescement fiscal | Fiscalité | Administration fiscale compétente |

### 2.1 Catalogue transactions et contrats

| Code | Procédure | Parties | Circuit principal |
|---|---|---|---|
| `VENTE_IMMOBILIER_TF` | Vente d’immeuble immatriculé / sous titre foncier | Vendeur, acheteur, cabinet, notaire | Notaire, DGID, Conservation, Cadastre, Domaines selon besoin |
| `PROMESSE_VENTE_IMMOBILIER` | Promesse ou compromis de vente | Promettant vendeur, bénéficiaire, cabinet | Cabinet, puis notaire |
| `VENTE_BAIL_DROIT_SUPERFICIE` | Cession de bail ou droit de superficie | Cédant, cessionnaire, cabinet | Domaines, DGID, notaire selon droit concerné |
| `VENTE_AUTORISATION_OCCUPER` | Cession / régularisation liée à une autorisation d’occuper | Titulaire, bénéficiaire, cabinet | Domaines, Cadastre, autorités territoriales |
| `VENTE_BIEN_MEUBLE` | Vente de bien meuble ou actif non immobilier | Vendeur, acheteur, cabinet | Contrat et formalité selon nature |
| `BAIL_HABITATION_VIDE` | Bail d’habitation non meublée | Bailleur, locataire, cabinet | Contrat, état des lieux, formalités si requises |
| `BAIL_HABITATION_MEUBLEE` | Bail d’habitation meublée | Bailleur, locataire, cabinet | Contrat, inventaire, état des lieux |
| `BAIL_PROFESSIONNEL` | Bail professionnel | Bailleur, locataire, cabinet | Contrat, destination et fiscalité à vérifier |
| `BAIL_COMMERCIAL` | Bail commercial | Bailleur, preneur commerçant / société, cabinet | Contrat, régime OHADA et formalités à vérifier |
| `BAIL_MIXTE` | Bail à usage mixte | Bailleur, locataire, cabinet | Contrat, destination, urbanisme selon cas |
| `AVENANT_BAIL` | Avenant, renouvellement, prorogation | Bailleur, locataire | Cabinet |
| `RESILIATION_AMIABLE_BAIL` | Résiliation amiable | Bailleur, locataire | Cabinet, état des lieux, solde |
| `ETAT_LIEUX` | État des lieux entrée / sortie | Bailleur, locataire, cabinet / huissier | Annexe contractuelle ou constat |
| `MANDAT_INTERMEDIATION` | Mandat d’assistance du cabinet | Client, cabinet | Contrat interne |

---

## 3. Intervenants externes

### 3.1 Référentiel à paramétrer

| Code | Entité | Rôle | Déclencheur |
|---|---|---|---|
| `CABINET` | Cabinet juridique | Conseil, audit, rédaction, coordination, suivi | Toujours |
| `NOTAIRE` | Étude notariale compétente | Acte authentique, formalités notariales, transmission des actes | Vente immobilière / acte soumis à publicité foncière |
| `DGID_CADASTRE` | Bureau du Cadastre | NICAD, CIC, extrait de plan, identification parcellaire | Terrain ou immeuble à identifier |
| `DGID_DOMAINES` | Direction / Bureau des Domaines | Baux, droits de superficie, autorisations d’occuper, régularisations, formalités domaniales | Droit domanial ou occupation |
| `DGID_ENREGISTREMENT` | Service de l’Enregistrement | Enregistrement de l’acte et quittance selon le circuit | Acte soumis ou présenté à l’enregistrement |
| `DGID_CONSERVATION` | Conservation de la propriété et des droits fonciers | État de droits réels, publicité foncière, inscription, radiation | Titre foncier, mutation, sûreté, droit réel |
| `CSF` | Centre des services fiscaux | Attestations et vérifications fiscales | Dossier fiscal ou exigence liée à l’opération |
| `DGID_DIGITALE` | Téléservices DGID | Dépôt ou suivi numérique lorsqu’un service le permet | Selon téléservice disponible |
| `MAIRIE` | Commune compétente | Urbanisme local, opérations communales, adresse | Construction, lotissement, usage ou formalité locale |
| `URBANISME` | Services de l’Urbanisme | Autorisation de construire / lotir, contrôle urbanistique | Projet bâti, construction, régularisation |
| `GEOMETRE` | Géomètre compétent | Bornage, plan, morcellement, délimitation | Limites ou superficie à vérifier |
| `ARCHITECTE` | Architecte / maître d’œuvre | Plans, dossier technique et conformité | Construction ou régularisation |
| `HUISSIER` | Huissier de justice | Constat, sommation, état des lieux contradictoire | Litige, refus, impayé, occupation |
| `BANQUE_SEQUESTRE` | Banque / établissement prêteur / compte notarial | Financement, séquestre, garanties, traçabilité du prix | Crédit, sûreté, paiement sécurisé |
| `ETAT_CIVIL` | Centre d’état civil | Naissance, mariage, décès, capacité | Mariage, succession, indivision |
| `RCCM` | Registre / greffe compétent | Vérification de société et pouvoirs | Partie personne morale |
| `JUSTICE` | Juridiction compétente | Décision, mainlevée judiciaire, contentieux | Litige, saisie, succession contestée |

### 3.2 Principes de paramétrage

Ne pas coder en dur les autorités, pièces, frais, délais et formulaires. Chaque règle doit comporter : territoire, type de droit, nature de l’opération, date d’effet, source, liste de pièces, conditions, frais indicatifs, valideur interne et historique des modifications.

---

## 4. Données à collecter

### 4.1 Personne physique

- Civilité, nom, prénoms, date et lieu de naissance, nationalité, profession.
- CNI ou passeport, numéro, date de validité, copie sécurisée.
- Adresse complète, commune, département, région, téléphone, e-mail.
- Situation matrimoniale et pièces utiles si l’opération l’exige.
- Mandataire, procuration, durée, limites et contrôle de l’original.
- NINEA ou informations fiscales lorsque pertinentes.

### 4.2 Personne morale

- Raison sociale, forme juridique, NINEA, RCCM, siège, coordonnées.
- Représentant légal, qualité, pièce d’identité, pouvoirs.
- Statuts, décision sociale, procès-verbal ou délégation autorisant l’opération.

### 4.3 Bien immobilier / parcelle

- Région, département, commune, quartier / village, adresse et repères.
- NICAD, titre foncier, bail, droit de superficie, permis ou autorisation d’occuper.
- Lot, bloc, îlot, parcelle, section, superficie, coordonnées si disponibles.
- Titulaires du droit, quotes-parts, origine et date du droit.
- Références cadastrales, plans, bornage, extraits et CIC.
- Charges, hypothèques, saisies, prénotations, servitudes, baux et contentieux connus.
- Usage actuel, usage projeté, occupation, locataires et sous-locataires.
- Autorisation de construire et autres documents urbanistiques, lorsque pertinents.

### 4.4 Données transactionnelles

- Type de transaction, sous-type, dossier juridique et mandat du cabinet.
- Vendeur / acheteur ou bailleur / locataire, parties représentées et bénéficiaires effectifs.
- Prix, loyer, dépôt de garantie, échéancier, financement et conditions suspensives.
- Autorité / étude notariale compétente, formalités à accomplir et responsable interne.
- Références de dépôt, quittances, récépissés, décisions et échéances.

---

## 5. Vente immobilière et due diligence

### 5.1 Rôle du cabinet

Le cabinet doit pouvoir :

- ouvrir le dossier de transaction ;
- signer un mandat d’assistance et d’intermédiation avec son client ;
- vérifier les pièces et signaler les incohérences ;
- produire un rapport de due diligence et une note de risques ;
- préparer les projets d’accord, promesse, bordereau et instructions ;
- coordonner la transmission au notaire ;
- suivre les formalités auprès des services compétents ;
- archiver la preuve de finalisation ;
- remettre au client le dossier final avec accusé de réception.

Le cabinet ne doit jamais être qualifié dans l’acte comme vendeur, acheteur, bailleur ou locataire, sauf s’il est réellement partie au contrat.

### 5.2 Workflow de vente sous titre foncier

```text
OUVERTURE_TRANSACTION
→ A_QUALIFIER_DROIT_SUR_BIEN
→ MANDAT_CABINET_A_SIGNER
→ IDENTIFICATION_PARTIES
→ IDENTIFICATION_BIEN
→ COLLECTE_PIECES
→ CONTROLE_CADASTRAL_REQUIS
→ ETAT_DROITS_REELS_A_OBTENIR
→ DUE_DILIGENCE_FONCIERE_ADMINISTRATIVE
→ CHARGES_ET_LITIGES_A_TRAITER
→ FORMALITE_DOMAINES_A_EVALUER
→ DOSSIER_NOTARIAL_A_COMPLETER
→ PROJET_ACTE_A_VALIDER
→ SIGNATURE_NOTARIALE_PLANIFIEE
→ ACTE_NOTARIE_SIGNE
→ DROITS_ET_FORMALITES_EN_COURS
→ DEPOT_CONSERVATION_EFFECTUE
→ ENREGISTREMENT_ET_PUBLICITE_EN_COURS
→ MUTATION_INSCRITE
→ ETAT_DROITS_REELS_FINAL_RECU
→ DOSSIER_REMIS_CLIENT
→ CLOTURE
```

### 5.3 États de blocage

```text
BLOQUE_IDENTITE_PARTIE
BLOQUE_CAPACITE_OU_POUVOIR
BLOQUE_TITRE_NON_VERIFIE
BLOQUE_ETAT_DROITS_REELS_ABSENT
BLOQUE_CHARGE_HYPOTHEQUE
BLOQUE_SAISIE_OU_PRENOTATION
BLOQUE_INCOHERENCE_CADASTRALE
BLOQUE_LITIGE_FONCIER
BLOQUE_SITUATION_SUCCESSORALE
BLOQUE_SITUATION_MATRIMONIALE
BLOQUE_DROIT_DOMANIAL_A_REGULARISER
BLOQUE_URBANISME_A_VERIFIER
BLOQUE_FISCALITE_OU_DROITS
BLOQUE_FINANCEMENT
BLOQUE_VALIDATION_AVOCAT
```

### 5.4 Contrôles obligatoires

| Domaine | Vérification | Preuve attendue | Niveau |
|---|---|---|---|
| Parties | Identité, capacité, pouvoir de signature | CNI, état civil, mandat, documents société | Bloquant |
| Titularité | Le vendeur a-t-il le droit de céder ? | Titre et documents de propriété / occupation | Bloquant |
| Conservation | Propriétaire inscrit et charges éventuelles | État de droits réels si bien immatriculé | Bloquant |
| Cadastre | Localisation, superficie, limites, NICAD | Plan, extrait, CIC, documents cadastraux | Bloquant si incohérence |
| Domaines | Nature et cessibilité du droit d’occupation | Bail, droit de superficie, autorisation, quittances | Bloquant selon droit |
| Urbanisme | Régularité du bâti ou du projet | Autorisation, plans, pièces pertinentes | Conditionnel |
| Occupation | Locataire, occupant, sous-location, litige | Baux, constats, déclarations | Bloquant ou réserve écrite |
| Fiscalité | Droits et formalités à suivre | Quittances, références, attestations | Bloquant avant clôture |
| Succession | Droits et pouvoirs des héritiers | État civil, acte, jugement ou procurations | Bloquant |
| Société | Pouvoir du signataire | RCCM, statuts, PV, délégation | Bloquant |

### 5.5 Check-list vendeur

- Pièce d’identité et coordonnées.
- Situation matrimoniale et pièces utiles selon le dossier.
- Procuration ou mandat lorsque le vendeur est représenté.
- Titre foncier, bail, droit de superficie, autorisation d’occuper ou acte d’attribution.
- État de droits réels récent lorsque le bien est immatriculé.
- NICAD, CIC, extrait de plan cadastral et plans disponibles.
- Quittances de redevances / obligations liées au droit d’occupation.
- Autorisation de construire, plans et documents urbanistiques si pertinents.
- Mainlevée, radiation ou décision nécessaire en présence d’une charge.
- Baux, informations sur occupants et droits de tiers.
- Déclaration des litiges, réclamations et contentieux connus.
- Pour une société : NINEA, RCCM, statuts, décision sociale et pouvoir du signataire.
- Pour une succession / indivision : documents établissant la qualité et accord des personnes concernées.

### 5.6 Check-list acheteur

- Pièce d’identité et coordonnées.
- Situation matrimoniale lorsque nécessaire.
- Procuration en cas de représentation.
- Documents société, NINEA, RCCM et pouvoirs pour une personne morale.
- Informations de financement si demandées par les parties, la banque ou le notaire.
- Acceptation écrite du prix, des conditions et des réserves éventuelles.

### 5.7 Clause standard du rôle du cabinet

```text
INTERVENTION DU CABINET

Le Cabinet {{cabinet_nom}} intervient exclusivement en qualité de conseil,
d’assistant juridique et d’intermédiaire, dans les limites du mandat qui lui a été
confié. Il assure notamment la collecte et le contrôle documentaire, la préparation
des projets d’actes, la coordination avec les parties, le notaire, les administrations
et les professionnels concernés, ainsi que le suivi des formalités.

Le Cabinet n’est ni vendeur, ni acquéreur, ni bailleur, ni locataire, ni autorité
délivrant des documents administratifs. Il ne garantit ni la solvabilité d’une partie,
ni la délivrance d’un acte administratif, ni l’aboutissement d’une mutation ou d’une
formalité hors de son contrôle.
```

### 5.8 Clôture d’une vente immobilière

```text
✓ Mandat du cabinet archivé
✓ Parties, capacités et pouvoirs vérifiés
✓ Bien et droit identifié
✓ Due diligence finalisée ; réserves levées ou expressément acceptées
✓ Acte notarié signé, lorsque requis
✓ Formalités externes suivies et preuves archivées
✓ Enregistrement / publicité foncière suivis selon le droit concerné
✓ Mutation inscrite lorsque le dossier porte sur un titre foncier
✓ État de droits réels final ou preuve finale pertinente archivée
✓ Fonds, débours et honoraires rapprochés
✓ Dossier final remis au client avec accusé de réception
```

---

## 6. Contrats de location et baux

### 6.1 Principes

Le système doit contrôler que le bailleur est propriétaire ou dispose d’un droit valable de louer. Il doit identifier sans ambiguïté le bien, son usage, les parties, le loyer, la durée, les charges, la garantie, les modalités de paiement et l’état des lieux.

Le notaire n’est pas imposé de manière générale à tous les baux. L’intervention du notaire, de l’Enregistrement, du Centre fiscal, de la mairie ou d’un autre service doit être évaluée selon la nature du bail, sa durée, sa destination, le droit sur le bien et les formalités applicables.

### 6.2 Workflow du bail

```text
BROUILLON
→ IDENTIFICATION_BAILLEUR
→ IDENTIFICATION_LOCATAIRE
→ IDENTIFICATION_BIEN
→ CONTROLE_DROIT_DE_LOUER
→ CONTROLE_DESTINATION_ET_USAGE
→ VISITE_ET_ETAT_DES_LIEUX_ENTREE
→ PROJET_BAIL
→ VALIDATION_JURIDIQUE
→ SIGNATURE_PARTIES
→ ENREGISTREMENT_A_EVALUER
→ FORMALITES_A_SUIVRE
→ REMISE_CLES
→ BAIL_EN_COURS
→ SUIVI_LOYERS_ET_QUITTANCES
→ RENOUVELLEMENT_OU_RESILIATION
→ ETAT_DES_LIEUX_SORTIE
→ SOLDE_ET_RESTITUTION_GARANTIE
→ CLOTURE
```

### 6.3 Pièces bailleur

- Pièce d’identité, coordonnées et qualité.
- Titre de propriété ou justification du droit de louer.
- Procuration ou mandat de gestion, si applicable.
- Documents société et pouvoir de signature pour une personne morale.
- Accord des copropriétaires ou indivisaires lorsque nécessaire.
- Autorisation du propriétaire principal en cas de sous-location.
- Informations sur les charges, équipements, compteurs et services inclus.
- Relevés d’entrée des compteurs, photos et inventaire du mobilier le cas échéant.

### 6.4 Pièces locataire

- Pièce d’identité, adresse et coordonnées.
- Profession, activité, employeur ou justificatifs demandés par le bailleur.
- Documents entreprise : NINEA, RCCM, statuts et pouvoirs si personne morale.
- Pièces du garant / caution solidaire si une garantie est prévue.
- Procuration, si représentation.
- Preuve de versement du dépôt de garantie et du premier loyer lorsque le bail est signé.

### 6.5 Clauses obligatoires dans le formulaire

1. Parties, représentants et qualité de signature.
2. Qualité du bailleur et droit de louer.
3. Désignation complète du bien, dépendances, compteurs et équipements.
4. Destination autorisée.
5. Date de prise d’effet et durée.
6. Loyer, échéance, mode et lieu de paiement.
7. Dépôt de garantie, avance et caution.
8. Charges, eau, électricité, internet, gardiennage et charges communes.
9. Entretien, réparations et obligations de chaque partie.
10. Sous-location, cession, changement de destination et travaux.
11. État des lieux, inventaire et photos annexés.
12. Notification, mise en demeure, résiliation et restitution des lieux.
13. Nombre d’originaux, signatures et annexes.
14. Évaluation et suivi de la formalité d’enregistrement si nécessaire.

### 6.6 Clôture / bail en cours

```text
✓ Droit de louer contrôlé
✓ Bail signé par toutes les parties
✓ État des lieux et inventaire archivés si applicables
✓ Garantie, premier loyer et paiements initiaux tracés si prévus
✓ Formalité d’enregistrement évaluée et suivie si requise
✓ Remise des clés prouvée
✓ Échéances créées et responsables affectés
```

---

## 7. Formalités externes et suivi

### 7.1 Entité `formalites_externes`

Chaque transaction ou contrat peut générer une ou plusieurs formalités externes.

Champs requis :

- entité et bureau concerné ;
- objet de la formalité ;
- caractère obligatoire, conditionnel ou recommandé ;
- fondement interne ou source ;
- pièces attendues ;
- préparation, dépôt, canal et déposant ;
- récépissé, quittance et référence externe ;
- frais, bénéficiaire réel et preuve de paiement ;
- statut, décision, document de réponse et relance ;
- date de dernière vérification de la règle.

### 7.2 États des formalités

```text
BROUILLON
A_PREPARER
PIECES_MANQUANTES
PRET_A_DEPOT
DEPOSE
DEPOT_A_CONFIRMER
COMPLEMENT_DEMANDE
EN_INSTRUCTION
RELANCE
ACCEPTE
REFUSE
EXPIRE
CLOTURE
```

### 7.3 Preuves à archiver

- Lettre de demande / transmission.
- Bordereau de pièces.
- Copie du dossier déposé.
- Récépissé et référence de dépôt.
- Quittance, taxes, droits et preuve de paiement.
- Courrier de complément ou de rejet.
- Certificat, décision, visa, état de droits réels ou acte final.
- Compte rendu de déplacement et relances.
- PDF final, version du modèle et horodatage.

---

## 8. Documents et modèles

| Code | Modèle | Validation minimale |
|---|---|---|
| `TPL_DEM_ADMIN` | Demande administrative générique | Juriste |
| `TPL_BORDEREAU_DEPOT` | Bordereau de pièces | Juriste |
| `TPL_PROCURATION_ADMIN` | Procuration administrative | Avocat / responsable |
| `TPL_RELANCE_ADMIN` | Lettre de relance | Juriste |
| `TPL_NOTE_RECEVABILITE` | Note de recevabilité | Juriste |
| `TPL_MANDAT_INTERMEDIATION_IMMO` | Mandat d’assistance et d’intermédiation | Avocat |
| `TPL_FICHE_DUE_DILIGENCE_IMMO` | Rapport de vérification foncière et administrative | Juriste + avocat |
| `TPL_FICHE_RISQUES_VENTE` | Note de risques et réserves | Avocat |
| `TPL_PROMESSE_VENTE_IMMO` | Promesse de vente | Avocat ; coordination notaire si nécessaire |
| `TPL_PROTOCOLE_ACCORD_VENTE` | Protocole d’accord de vente | Avocat |
| `TPL_BORDEREAU_NOTAIRE` | Bordereau de transmission au notaire | Juriste |
| `TPL_LETTRE_INSTRUCTIONS_NOTAIRE` | Instructions et pièces au notaire | Avocat / juriste |
| `TPL_DEMANDE_ETAT_DROITS_REELS` | Demande d’état de droits réels | Juriste |
| `TPL_DEMANDE_CADASTRE_TRANSACTION` | Demande d’extrait, CIC ou NICAD | Juriste |
| `TPL_DECLARATION_DOMAINES_TRANSACTION` | Demande / déclaration aux Domaines | Juriste + avocat si sensible |
| `TPL_BAIL_HABITATION` | Bail d’habitation | Juriste |
| `TPL_BAIL_PROFESSIONNEL` | Bail professionnel | Juriste + avocat |
| `TPL_BAIL_COMMERCIAL` | Bail commercial | Avocat |
| `TPL_ETAT_LIEUX_ENTREE` | État des lieux d’entrée | Assistant + parties |
| `TPL_ETAT_LIEUX_SORTIE` | État des lieux de sortie | Assistant + parties |
| `TPL_INVENTAIRE_MOBILIER` | Inventaire mobilier | Assistant + parties |
| `TPL_QUITTANCE_LOYER` | Quittance de loyer | Assistant autorisé |
| `TPL_RECU_DEPOT_GARANTIE` | Reçu de dépôt de garantie | Responsable autorisé |
| `TPL_AVENANT_BAIL` | Avenant de bail | Juriste |
| `TPL_RESILIATION_AMIABLE_BAIL` | Convention de résiliation | Juriste + avocat selon risque |
| `TPL_PV_REMISE_CLES` | Procès-verbal de remise des clés | Assistant + parties |
| `TPL_PV_RESTITUTION_CLES` | Procès-verbal de restitution des clés | Assistant + parties |

---

## 9. Impression, PDF et GED

- Modèles HTML / DOCX versionnés avec variables de fusion.
- Aperçu obligatoire avant génération finale.
- Export PDF avec numéro de dossier, pagination et version du modèle.
- Filigrane `BROUILLON` avant validation.
- Création d’un paquet de dépôt : page de garde, lettre, bordereau, annexes et sommaire.
- Archivage du PDF, de son hash, de l’horodatage et de l’utilisateur générateur.
- Nouvelle version obligatoire en cas de modification d’un document finalisé.
- Répertoire séparé pour les documents transmis à l’administration et les notes internes confidentielles.

---

## 10. Frais, fonds et comptabilité

Séparer les catégories suivantes :

```text
PRIX_DE_VENTE
DEPOT_GARANTIE
LOYER
AVANCE_LOYER
FRAIS_NOTAIRE
DROITS_ENREGISTREMENT
DROITS_PUBLICITE_FONCIERE
FRAIS_CADASTRE
FRAIS_DOMAINES
FRAIS_GEOMETRE
FRAIS_HUISSIER
FRAIS_URBANISME
FRAIS_BANCAIRES_OU_SEQUESTRE
HONORAIRES_CABINET
DEBOURS_CABINET
REMBOURSEMENT_CLIENT
```

Chaque paiement doit indiquer le bénéficiaire réel, le payeur, l’objet, la transaction, la formalité associée, le montant, le mode de paiement, la date, la référence, la quittance et le statut de rapprochement.

**Règle impérative :** aucune somme destinée au notaire, à la DGID, au Cadastre, aux Domaines, à la Conservation foncière ou à un professionnel externe ne doit être classée comme honoraire du cabinet.

---

## 11. Architecture de données

### 11.1 Tables principales

```text
legal_cases
administrative_requests
administrative_request_types
administrative_request_subtypes
request_checklist_templates
request_checklist_items
persons
organizations
properties
property_rights
mandates
transactions
transaction_parties
transaction_properties
transaction_intervenants_externes
notarial_files
notarial_instructions
property_due_diligence_reports
cadastre_checks
domain_checks
land_registry_checks
real_rights_statements
urban_planning_checks
tax_checks
external_formalities
external_submissions
external_receipts
external_decisions
transaction_fees
transaction_payments
payment_escrows
contracts
contract_documents
documents
document_versions
document_templates
audit_logs
```

### 11.2 Exemple SQL

```sql
CREATE TABLE transactions (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  tenant_id BIGINT NOT NULL,
  legal_case_id BIGINT NULL,
  reference VARCHAR(50) NOT NULL,
  transaction_type_code VARCHAR(80) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'BROUILLON',
  risk_level VARCHAR(20) NOT NULL DEFAULT 'STANDARD',
  property_id BIGINT NULL,
  responsible_lawyer_id BIGINT NULL,
  assigned_assistant_id BIGINT NULL,
  notary_external_participant_id BIGINT NULL,
  subject TEXT NOT NULL,
  price_amount DECIMAL(18,2) NULL,
  currency_code VARCHAR(10) NOT NULL DEFAULT 'XOF',
  signed_at DATETIME NULL,
  closed_at DATETIME NULL,
  created_by BIGINT NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  archived_at DATETIME NULL,
  UNIQUE KEY uq_transaction_reference (tenant_id, reference)
);

CREATE TABLE external_formalities (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  tenant_id BIGINT NOT NULL,
  transaction_id BIGINT NOT NULL,
  entity_type_code VARCHAR(80) NOT NULL,
  entity_office_id BIGINT NULL,
  formality_code VARCHAR(100) NOT NULL,
  obligation_level VARCHAR(20) NOT NULL DEFAULT 'CONDITIONNELLE',
  status VARCHAR(40) NOT NULL DEFAULT 'BROUILLON',
  subject TEXT NOT NULL,
  legal_or_internal_basis TEXT NULL,
  prepared_at DATETIME NULL,
  submitted_at DATETIME NULL,
  submitted_by_user_id BIGINT NULL,
  submission_channel VARCHAR(30) NULL,
  receipt_number VARCHAR(120) NULL,
  receipt_document_id BIGINT NULL,
  decision_at DATETIME NULL,
  decision_document_id BIGINT NULL,
  expected_response_at DATE NULL,
  next_followup_at DATETIME NULL,
  notes TEXT NULL,
  created_by BIGINT NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL
);
```

---

## 12. Sécurité et audit

- Isoler les données par `tenant_id` si l’application est multi-cabinet.
- Appliquer le moindre privilège et des accès renforcés pour succession, fiscalité, fonds, titres et sûretés.
- Journaliser toute consultation, impression, téléchargement, modification, signature, validation, dépôt et suppression logique.
- Chiffrer les documents sensibles au repos et utiliser des liens authentifiés à durée limitée.
- Ne pas transmettre sans contrôle des CNI, titres et dossiers complets via des canaux non sécurisés.
- Conserver une chaîne de détention des originaux : détenteur, date, lieu, restitution.
- Conserver l’historique des check-lists et règles applicables au moment du dépôt.

---

## 13. Critères d’acceptation

- L’assistante crée une demande, une vente ou un bail avec un assistant guidé.
- Les pièces sont contrôlées avec statut, validité, source et commentaire.
- Les contrôles bloquants empêchent le dépôt ou la signature finale selon les règles.
- Le système oriente le dossier vers le notaire, le Cadastre, les Domaines, la Conservation, l’Enregistrement, les services fiscaux, l’Urbanisme ou un autre intervenant selon les paramètres.
- Chaque formalité externe possède une liste de pièces, un déposant, un récépissé, une quittance, un statut et une preuve archivée.
- Les modèles peuvent être prévisualisés, validés, signés, imprimés et enregistrés en PDF versionné.
- Une vente sous titre foncier ne peut être clôturée sans preuve de finalisation du circuit foncier applicable.
- Un bail ne peut être finalisé sans parties identifiées, bien identifié, droit de louer, loyer, durée, charges et signatures.
- Le tableau de bord affiche les dossiers bloqués, les formalités en retard, les récépissés absents, les paiements non rapprochés et les relances à effectuer.

---

## 14. Références à vérifier périodiquement

- DGID : Cadastre, Domaines, Enregistrement, Conservation de la propriété et des droits fonciers.
- Plateforme DGID Digitale pour les téléservices disponibles.
- Ministère de l’Urbanisme, collectivités territoriales et mairies compétentes.
- Étude notariale compétente pour le circuit notarial et foncier du dossier.
- Code des obligations civiles et commerciales, textes fonciers et fiscaux sénégalais, actes uniformes OHADA applicables.
- Géomètres, architectes, huissiers, banques et juridictions selon les circonstances du dossier.

**Règle finale :** avant une signature définitive ou un dépôt, le responsable juridique doit confirmer dans le système que la check-list a été vérifiée pour le bien, le territoire, le type de droit et l’autorité effectivement compétente.
