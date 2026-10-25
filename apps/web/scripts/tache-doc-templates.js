/**
 * Modèles de documents (contenuDocument) par spécialité et titre de tâche.
 * Variables au format {{cle}} ou {{cle|Libellé}} / [Libellé].
 */

/* ---------- Blocs réutilisables ---------- */

const enteteLettre = `{{cabinet_nom}}
{{avocat_nom}}, Avocat
{{adresse}}`;

const destinataire = (nom, adr) => `À l'attention de :
${nom}
${adr}`;

const signLettre = `{{avocat_nom}}
{{cabinet_nom}}`;

/* ---------- Notes d'analyse ---------- */

const noteAnalyse = (titre, objet, sections) => `${titre.toUpperCase()}

Dossier n° {{dossier_ref}}
Client : {{client_nom}}
Date : {{date}}

I. OBJET DE L'ANALYSE

${objet}

II. ${sections}`;

const noteCorpsStandard = `FAITS ET PIÈCES EXAMINÉES

{{faits}}

{{pieces}}

III. ANALYSE JURIDIQUE

[Exposer ici les règles de droit applicables, la jurisprudence et les risques identifiés.]

IV. POINTS DE VIGILANCE

{{points_vigilance}}

V. RECOMMANDATIONS

{{recommandations}}

Établie par :
{{avocat_nom}}
{{cabinet_nom}}`;

/* ---------- Fiches de validation internes ---------- */

const ficheValidation = (titre, entete = `Rédacteur : {{avocat_redacteur}}
Validateur : {{avocat_validateur}}`) => `${titre.toUpperCase()}

Dossier n° {{dossier_ref}}
${entete}
Date : {{date}}

POINTS VÉRIFIÉS

{{points_verifies}}

OBSERVATIONS

{{observations}}

VALIDATION

[ ] Validé sans observation
[ ] Validé sous réserve des observations ci-dessus
[ ] À reprendre

Signature du validateur : _______________`;

/* ---------- Dossier d'audience ---------- */

const dossierAudience = (titre, extra = "") => `${titre.toUpperCase()}

Dossier n° {{dossier_ref}}
Client : {{client_nom}}
Tribunal : {{tribunal}}
Date d'audience : {{date_audience}}
${extra}
PIÈCES CLÉS

{{pieces_cles}}

ARGUMENTS PRINCIPAUX

{{arguments_principaux}}

ORGANISATION DE LA PLAIDOIRIE

[Points à plaider, ordre de passage, pièces à produire.]

Avocat : {{avocat_nom}}
{{cabinet_nom}}`;

/* ---------- Conclusions ---------- */

const conclusions = (titre, extraMoyens = "") => `DEVANT LE {{tribunal}} DE {{ville_tribunal}}

Affaire n° {{dossier_ref}}

CONCLUSIONS POUR :

{{client_nom}},
représenté par {{avocat_nom}}, Avocat au Barreau de {{ville_tribunal}}
{{cabinet_nom}}

CONTRE :

{{partie_adverse}}

I. EXPOSÉ DES FAITS

{{expose_faits}}

II. MOYENS DE DROIT

{{moyens_droit}}
${extraMoyens}
III. CONCLUSIONS

Par ces motifs, il est demandé au Tribunal de :

- Dire et juger la demande recevable et bien fondée ;
- Condamner {{partie_adverse}} à {{conclusions_demandes}} ;
- La condamner aux dépens.

SOUS TOUTES RÉSERVES

Fait à {{ville_tribunal}}, le {{date}}

{{avocat_nom}}
{{cabinet_nom}}`;

/* ---------- Mises en demeure ---------- */

const miseEnDemeureCreance = `{{cabinet_nom}}
{{avocat_nom}}, Avocat
{{creancier_adresse}}

${destinataire("{{debiteur_nom}}", "{{debiteur_adresse}}")}

Fait à {{ville}}, le {{date}}

Objet : Mise en demeure de payer

{{civilite|Madame / Monsieur}},

Nous intervenons pour le compte de {{creancier_nom}}, notre client, afin de vous rappeler vos obligations de paiement.

En dépit de nos multiples relances, nous constatons qu'à ce jour, vous n'avez pas procédé au règlement de la (des) facture(s) suivante(s) :
{{factures}}.

Le montant total de votre dette s'élève à {{montant}}.

Par la présente, nous vous mettons formellement en demeure de payer, dans un délai de {{delai}} jours à compter de la réception de ce courrier, la somme de {{montant}}, à défaut de quoi notre client se verra contraint d'engager toute procédure utile aux fins de recouvrement forcé de sa créance, avec tous les frais et conséquences de droit.

Vous pouvez effectuer votre règlement par [préciser mode de paiement].

Dans l'attente de votre règlement, nous vous prions d'agréer, {{civilite|Madame / Monsieur}}, l'expression de nos salutations distinguées.

${signLettre}`;

const miseEnDemeureBail = `{{cabinet_nom}}
{{avocat_nom}}, Avocat
{{bailleur_adresse}}

${destinataire("{{locataire_nom}}", "{{locataire_adresse}}")}

Fait à {{ville}}, le {{date}}

Objet : Mise en demeure – inexécution du bail n°{{bail_ref}}

{{civilite|Madame / Monsieur}},

Nous intervenons pour le compte de {{bailleur_nom}}, propriétaire du local sis {{locataire_adresse}}, loué dans le cadre du bail référencé {{bail_ref}}.

Il ressort de notre analyse que vous ne vous acquittez pas régulièrement de votre obligation de paiement du loyer, et/ou que vous méconnaissez certaines obligations du bail, notamment :
{{manquements}}.

À ce jour, les loyers impayés concernent la période suivante : {{periode}}, pour un montant global de {{loyer}}.

Par la présente, nous vous mettons en demeure, dans un délai de {{delai}} jours, de :
- régulariser votre situation en payant les sommes dues ;
- mettre fin aux manquements ci-dessus rappelés.

À défaut, notre client engagera toute procédure utile, y compris en expulsion et en recouvrement forcé, avec tous les frais et conséquences de droit.

Nous vous prions d'agréer, {{civilite|Madame / Monsieur}}, nos salutations distinguées.

${signLettre}`;

const miseEnDemeureStandard = `{{cabinet_nom}}
{{avocat_nom}}, Avocat

${destinataire("{{debiteur_nom}}", "{{debiteur_adresse}}")}

Fait à {{ville}}, le {{date}}

Objet : Mise en demeure – {{objet}}

{{civilite|Madame / Monsieur}},

Nous intervenons pour le compte de {{creancier_nom}}, notre client.

Il ressort des éléments en notre possession que vous n'avez pas exécuté l'obligation suivante : {{obligation}}.

Par la présente, nous vous mettons formellement en demeure d'exécuter cette obligation dans un délai de {{delai}} jours à compter de la réception de ce courrier.

À défaut d'exécution dans ce délai, notre client se réserve le droit d'engager toute procédure utile, avec tous les frais et conséquences de droit.

Nous vous prions d'agréer, {{civilite|Madame / Monsieur}}, nos salutations distinguées.

${signLettre}`;

/* ---------- Commandement de payer ---------- */

const commandementPayer = `COMMANDEMENT DE PAYER

À la requête de : {{creancier_nom}},

Je soussigné(e), {{huissier_nom}}, Commissaire de Justice,

Fais commandement à :

{{debiteur_nom}}
{{debiteur_adresse}}

De payer, dans les {{delai}} jours, la somme de {{montant}}, en vertu du titre exécutoire suivant : {{titre_executoire}}.

À défaut, il sera procédé à toutes mesures d'exécution forcée, y compris saisie.

Fait à {{ville}}, le {{date}}

{{huissier_nom}}`;

/* ---------- Assignation ---------- */

const assignation = `ASSIGNATION À TOUTES FINS DEVANT LE TRIBUNAL DE {{ville_tribunal}}

L'AN {{date}},

À LA DEMANDE DE :

{{demandeur_nom}}
{{demandeur_adresse}}

Agissant par le ministère de :
{{avocat_nom}}, Avocat au Barreau de {{ville_tribunal}}
{{cabinet_nom}}

J'AI, Commissaire de Justice soussigné,

DONNÉ ASSIGNATION À :

{{defendeur_nom}}
{{defendeur_adresse}}

D'AVOIR À COMPARAÎTRE devant le {{tribunal}}, sis [adresse du tribunal], le [date d'audience] à [heure],

POUR :

EXPOSÉ DES FAITS

{{expose_faits}}

DÉMARCHES AMIABLES

{{demarches_amiable}}

MOYENS DE DROIT

{{moyens_droit}}

PAR CES MOTIFS

PLAISE AU TRIBUNAL :

- Dire et juger la demande recevable et bien fondée ;
- Condamner {{defendeur_nom}} à {{demandes}} ;
- Le condamner aux dépens.

SOUS TOUTES RÉSERVES

Fait à {{ville_tribunal}}, le {{date}}

{{avocat_nom}}
{{cabinet_nom}}`;

/* ---------- Actes de signification ---------- */

const acteSignification = (titre, corps) => `${titre.toUpperCase()}

${corps}

Fait pour servir et valoir ce que de droit.

{{huissier_nom}}`;

/* ---------- PV ---------- */

const pvGenerique = (titre, entete, corps) => `${titre.toUpperCase()}

L'AN {{date}},

${entete}

${corps}

OBSERVATIONS

{{observations}}

Fait pour servir et valoir ce que de droit.

{{huissier_nom}}`;

/* ---------- Lettres diverses ---------- */

const lettreSimple = (objet, corps) => `{{cabinet_nom}}
{{avocat_nom}}, Avocat
{{adresse}}

${destinataire("{{destinataire_nom}}", "{{destinataire_adresse}}")}

Fait à {{ville}}, le {{date}}

Objet : ${objet}

{{civilite|Madame / Monsieur}},

${corps}

Nous vous prions d'agréer, {{civilite|Madame / Monsieur}}, l'expression de nos salutations distinguées.

${signLettre}`;

const lettreClient = (objet, corps) => `{{cabinet_nom}}
{{avocat_nom}}, Avocat
{{adresse}}

À l'attention de : {{client_nom}}

Fait à {{ville}}, le {{date}}

Objet : ${objet}

{{civilite|Madame / Monsieur}},

${corps}

Nous restons à votre disposition pour tout complément.

Veuillez agréer, {{civilite|Madame / Monsieur}}, l'expression de nos salutations distinguées.

${signLettre}`;

/* ---------- Note de suivi ---------- */

const noteSuivi = (titre, entete, corps) => `${titre.toUpperCase()}

Dossier n° {{dossier_ref}}
${entete}
Date : {{date}}

${corps}

Établie par :
{{avocat_nom}}
{{cabinet_nom}}`;

/* ===================================================================== */
/* Mapping : code spécialité → titre de tâche → contenuDocument          */
/* ===================================================================== */

const TEMPLATES = {

  /* ---------------- 1. contentieux_immobilier ---------------- */
  contentieux_immobilier: {
    "Analyse du titre foncier et des pièces": noteAnalyse(
      "Note d'analyse du titre foncier et des pièces",
      `Titre foncier concerné : {{titre_foncier_ref}}

Situation juridique du bien : {{situation_juridique}}`,
      noteCorpsStandard
    ),

    "Rédaction des conclusions": conclusions("Conclusions pour contentieux immobilier"),

    "Relecture et validation des conclusions": ficheValidation(
      "Fiche de relecture et validation des conclusions"
    ),

    "Préparation de l'audience": dossierAudience(
      "Dossier d'audience – contentieux immobilier"
    ),

    "Signification du jugement": lettreClient(
      "Transmission et explication du jugement – dossier n°{{dossier_ref}}",
      `Nous avons le plaisir de vous transmettre copie du jugement rendu par le {{tribunal}} le {{date_jugement}} dans le cadre de votre dossier n° {{dossier_ref}}.

DISPOSITIF DE LA DÉCISION

{{dispositif}}

VOIES DE RECOURS

{{voies_recours}}

Nous vous invitons à prendre attache avec nous afin d'étudier ensemble la suite à donner à cette décision.`
    ),
  },

  /* ---------------- 2. litige_foncier ---------------- */
  litige_foncier: {
    "Vérification du titre foncier et des documents de propriété": noteAnalyse(
      "Note de vérification du titre foncier et des documents de propriété",
      `Titre foncier concerné : {{titre_foncier_ref}}

Documents examinés : {{documents_list}}`,
      `ANOMALIES ET POINTS D'ATTENTION

{{anomalies}}

III. ANALYSE JURIDIQUE

[Exposer ici les règles de droit applicables, la jurisprudence et les risques identifiés.]

IV. RECOMMANDATIONS

{{recommandations}}

Établie par :
{{avocat_nom}}
{{cabinet_nom}}`
    ),

    "Demande de bornage / expertise": `REQUÊTE EN BORNAGE / DÉSIGNATION D'EXPERT

À Monsieur le Président du {{tribunal}}

Dossier n° {{dossier_ref}}

REQUÊTE DE : {{client_nom}}

CONTRE : {{partie_adverse}}

OBJET DE LA DEMANDE

Terrain concerné : {{description_terrain}}

MOTIFS DE LA DEMANDE

{{motifs}}

PAR CES MOTIFS

Il est demandé au Tribunal de bien vouloir :
{{demandes}}

Fait à {{ville}}, le {{date}}

{{avocat_nom}}
{{cabinet_nom}}`,

    "Tentative de négociation amiable": lettreSimple(
      "Proposition de transaction – litige foncier",
      `Nous intervenons pour le compte de {{client_nom}}, notre client, dans le cadre du litige foncier suivant :

{{description_litige}}

Soucieux de privilégier une issue amiable, notre client vous propose la transaction suivante :

{{proposition}}

Nous vous invitons à nous faire connaître votre position dans un délai de {{delai_reponse}} à compter de la réception du présent courrier. À défaut de réponse, notre client se réservera le droit d'engager la procédure judiciaire appropriée.`
    ),

    "Préparation de l'audience": dossierAudience(
      "Dossier d'audience – litige foncier"
    ),
  },

  /* ---------------- 3. expulsion_recouvrement ---------------- */
  expulsion_recouvrement: {
    "Vérification du titre exécutoire et du commandement": noteAnalyse(
      "Note de vérification du titre exécutoire",
      `Titre exécutoire : {{titre_executoire_ref}}

Montant dû : {{montant_du}}`,
      `VÉRIFICATIONS EFFECTUÉES

{{observations}}

III. ANALYSE JURIDIQUE

[Vérifier la régularité du titre, sa force exécutoire, les délais et les formalités préalables.]

IV. RECOMMANDATIONS

{{recommandations}}

Établie par :
{{avocat_nom}}
{{cabinet_nom}}`
    ),

    "Rédaction et envoi de la mise en demeure": miseEnDemeureBail,

    "Signification du commandement de payer": commandementPayer,

    "Signification de l'assignation": assignation,

    "Mise en œuvre de la saisie / expulsion": pvGenerique(
      "Procès-verbal d'expulsion / de saisie",
      `À : {{adresse}}

Je soussigné(e), {{huissier_nom}}, Commissaire de Justice,

Ai procédé, au vu du titre exécutoire visé au dossier n° {{dossier_ref}}, aux opérations suivantes concernant {{debiteur_nom}} :`,
      `DESCRIPTION DES OPÉRATIONS

{{description_operations}}`
    ),
  },

  /* ---------------- 4. baux_commerciaux_habitation ---------------- */
  baux_commerciaux_habitation: {
    "Analyse du contrat de bail et des quittances": noteAnalyse(
      "Note d'analyse du contrat de bail et des quittances",
      `Bail concerné : {{bail_ref}}
Type de bail : {{type_bail}}
Loyer : {{loyer}}
Durée : {{duree}}`,
      `ANOMALIES ET POINTS D'ATTENTION

{{anomalies}}

III. ANALYSE JURIDIQUE

[Exposer ici les règles de droit applicables, la jurisprudence et les risques identifiés.]

IV. RECOMMANDATIONS

{{recommandations}}

Établie par :
{{avocat_nom}}
{{cabinet_nom}}`
    ),

    "Rédaction de la mise en demeure": miseEnDemeureBail,

    "Tentative de négociation amiable": lettreSimple(
      "Négociation amiable – bail n°{{bail_ref}}",
      `Nous intervenons dans le cadre du bail référencé {{bail_ref}} et souhaitons privilégier une issue amiable au différend en cours.

À cette fin, nous vous proposons :

{{propositions}}

Nous vous invitons à nous faire connaître votre position dans un délai de {{delai}} à compter de la réception du présent courrier.`
    ),

    "Préparation de l'audience": dossierAudience(
      "Dossier d'audience – litige sur bail"
    ),
  },

  /* ---------------- 5. recouvrement_creances ---------------- */
  recouvrement_creances: {
    "Vérification des factures impayées et pièces justificatives": `FICHE DE VÉRIFICATION DE CRÉANCE

Dossier n° {{dossier_ref}}
Client (créancier) : {{client_nom}}
Débiteur : {{debiteur_nom}}
Date : {{date}}

FACTURES ET PIÈCES JUSTIFICATIVES EXAMINÉES

{{factures_list}}

MONTANT TOTAL DE LA CRÉANCE

{{montant_total}}

OBSERVATIONS

{{observations}}

Établie par :
{{juriste_nom}}
{{cabinet_nom}}`,

    "Envoi de la lettre de rappel": `{{cabinet_nom}}
{{creancier_nom}}
{{adresse}}

${destinataire("{{debiteur_nom}}", "{{debiteur_adresse}}")}

Fait à {{ville}}, le {{date}}

Objet : Rappel – facture impayée n°{{facture_ref}}

{{civilite|Madame / Monsieur}},

Sauf erreur de notre part, la facture n° {{facture_ref}} d'un montant de {{montant}}, arrivée à échéance le {{date_echeance}}, demeure impayée à ce jour.

Nous vous invitons à procéder à son règlement dans les meilleurs délais, par [préciser mode de paiement].

Si vous avez déjà réglé cette facture, merci de ne pas tenir compte du présent courrier.

Nous vous prions d'agréer, {{civilite|Madame / Monsieur}}, nos salutations distinguées.

{{creancier_nom}}`,

    "Rédaction et envoi de la mise en demeure": miseEnDemeureCreance,

    "Signification du commandement de payer": commandementPayer,

    "Mise en œuvre de la saisie-vente": pvGenerique(
      "Procès-verbal de saisie-vente",
      `À : {{adresse}}

Je soussigné(e), {{huissier_nom}}, Commissaire de Justice,

Ai procédé, au vu du titre exécutoire visé au dossier n° {{dossier_ref}}, à la saisie des biens de {{debiteur_nom}} ci-après désignés :`,
      `BIENS SAISIS

{{biens_saisis}}`
    ),
  },

  /* ---------------- 6. contentieux_contractuel ---------------- */
  contentieux_contractuel: {
    "Analyse du contrat et des correspondances": noteAnalyse(
      "Note d'analyse du contrat et des correspondances",
      `Contrat concerné : {{contrat_ref}}

Clauses clés : {{clauses_cles}}

Manquements constatés : {{manquements}}`,
      noteCorpsStandard
    ),

    "Rédaction des conclusions": conclusions("Conclusions – contentieux contractuel"),

    "Relecture et validation": ficheValidation(
      "Fiche de validation des conclusions – contentieux contractuel"
    ),

    "Préparation de l'audience": dossierAudience(
      "Dossier d'audience – contentieux contractuel"
    ),
  },

  /* ---------------- 7. redaction_analyse_contrats ---------------- */
  redaction_analyse_contrats: {
    "Analyse des besoins du client": `FICHE D'ANALYSE DES BESOINS – CONTRAT

Dossier n° {{dossier_ref}}
Client : {{client_nom}}
Date : {{date}}

TYPE DE CONTRAT ENVISAGÉ

{{type_contrat}}

BESOINS DU CLIENT

{{besoins}}

RISQUES IDENTIFIÉS

{{risques}}

RECOMMANDATIONS

{{recommandations}}

Établie par :
{{juriste_nom}}
{{cabinet_nom}}`,

    "Rédaction du contrat": `CONTRAT – {{type_contrat}}

ENTRE LES SOUSSIGNÉS :

{{partie1_nom}}, demeurant à {{partie1_adresse}}, ci-après « la Partie 1 »,

ET

{{partie2_nom}}, demeurant à {{partie2_adresse}}, ci-après « la Partie 2 »,

IL A ÉTÉ CONVENU ET ARRÊTÉ CE QUI SUIT :

Type de contrat : {{type_contrat|Type de contrat}}

ARTICLE 1 – OBJET

{{objet}}

ARTICLE 2 – PRIX ET MODALITÉS DE PAIEMENT

Prix : {{prix}}
Modalités de paiement : {{modalites_paiement}}

ARTICLE 3 – DURÉE

{{duree}}

ARTICLE 4 – OBLIGATIONS GÉNÉRALES

{{obligations}}

ARTICLE 5 – RÉSILIATION

{{resiliation}}

ARTICLE 6 – LOI APPLICABLE ET JURIDICTION COMPÉTENTE

{{loi_applicable}}

{{#if type_contrat == "prestation"}}
ARTICLE 7 – PRESTATION DE SERVICES

7.1. Description des prestations

{{description_prestations}}

7.2. Obligations du prestataire

{{obligations_prestataire}}

7.3. Obligations du client

{{obligations_client}}

7.4. Délais et acceptation des prestations

{{delais_prestations}}

7.5. Références / normes

{{normes_qualite}}

ARTICLE 8 – PROPRIÉTÉ INTELLECTUELLE

{{propriete_intellectuelle}}

ARTICLE 9 – CONFIDENTIALITÉ

{{confidentialite}}

ARTICLE 10 – RESPONSABILITÉ ET PÉNALITÉS

{{responsabilite_penalites}}
{{/if}}

{{#if type_contrat == "vente"}}
ARTICLE 7 – VENTE

7.1. Désignation du bien vendu

{{designation_bien}}

7.2. Prix et conditions de vente

Prix de vente : {{prix_vente}}
Conditions de paiement : {{modalites_paiement}}

7.3. Livraison / transfert

{{modalites_livraison}}

7.4. Transfert de propriété et des risques

{{transfert_propriete_risques}}

7.5. Garanties

{{garanties}}

ARTICLE 8 – RÉSOLUTION POUR VICES CACHÉS

{{resolution_vices_caches}}
{{/if}}

{{#if type_contrat == "partenariat"}}
ARTICLE 7 – PARTENARIAT

7.1. Objet précis du partenariat

{{objet_partenariat}}

7.2. Contributions respectives

{{contributions}}

7.3. Partage des résultats

{{partage_resultats}}

7.4. Gouvernance / décisions

{{gouvernance}}

7.5. Exclusivité / non-concurrence

{{exclusivite_non_concurrence}}

7.6. Sortie du partenariat

{{sortie_partenariat}}
{{/if}}

{{#if type_contrat == "licence"}}
ARTICLE 7 – LICENCE

7.1. Objet de la licence

{{objet_licence}}

7.2. Étendue de la licence (territoire / exclusivité)

{{etendue_licence}}

7.3. Redevances et modalités

{{redevances}}

7.4. Propriété intellectuelle – droits réservés

{{droits_reserves}}

7.5. Garanties du licenciant

{{garanties_licenciant}}

7.6. Sous-licence et cession

{{sous_licence}}
{{/if}}

Fait à {{ville}}, le {{date}}, en deux exemplaires originaux.

Pour la Partie 1                     Pour la Partie 2

{{partie1_nom}}                      {{partie2_nom}}`,

    "Relecture juridique": ficheValidation(
      "Fiche de relecture juridique de contrat",
      `Type de contrat : {{contrat_type}}
Relecteur : {{juriste_relecteur}}`
    ),

    "Validation par le client": lettreClient(
      "Validation du projet de contrat – {{contrat_type}}",
      `Nous vous prions de bien vouloir trouver ci-joint le projet de contrat de type {{contrat_type}} établi conformément à vos instructions.

POINTS CLÉS DU CONTRAT

{{points_cles}}

Nous vous invitons à nous confirmer votre accord sur ce projet, ou à nous faire part de vos observations, afin que nous puissions procéder à sa finalisation et à sa signature.`
    ),

    "Organisation de la signature": lettreSimple(
      "Organisation de la signature – {{contrat_type}}",
      `Dans le cadre de la conclusion du contrat {{contrat_type}} entre {{client_nom}} et {{partie2_nom}}, nous vous proposons d'organiser la signature selon les modalités suivantes :

{{modalites_signature}}

Date envisagée : {{date_signature}}

Nous vous prions de bien vouloir nous confirmer votre disponibilité.

Assistant(e) en charge : {{assistant_nom}}`
    ),
  },

  /* ---------------- 8. procedure_civile_commerciale ---------------- */
  procedure_civile_commerciale: {
    "Analyse du dossier et de la juridiction compétente": noteAnalyse(
      "Note d'analyse – juridiction compétente",
      `Type de litige : {{litige_type}}

Juridiction envisagée : {{juridiction}}`,
      `MOTIFS ET RÈGLES DE COMPÉTENCE

{{motifs}}

III. ANALYSE JURIDIQUE

[Exposer ici les règles de compétence territoriale et d'attribution, les risques d'incompétence et les options.]

IV. RECOMMANDATIONS

{{recommandations}}

Établie par :
{{avocat_nom}}
{{cabinet_nom}}`
    ),

    "Rédaction de l'assignation": assignation,

    "Signification de l'assignation": acteSignification(
      "Acte de signification d'assignation",
      `L'AN {{date}},

Je soussigné(e), {{huissier_nom}}, Commissaire de Justice,

Ai signifié à :

{{defendeur_nom}}

l'assignation référencée {{assignation_ref}}.

MODALITÉS DE LA SIGNIFICATION

{{modalites}}`
    ),

    "Préparation de l'audience et des conclusions": dossierAudience(
      "Dossier d'audience – procédure civile/commerciale"
    ),

    "Signification du jugement": acteSignification(
      "Acte de signification de jugement",
      `L'AN {{date}},

Je soussigné(e), {{huissier_nom}}, Commissaire de Justice,

Ai signifié à :

{{partie_nom}}

le jugement référencé {{jugement_ref}}.

DISPOSITIF

{{dispositif}}`
    ),
  },

  /* ---------------- 9. sommation_mise_en_demeure ---------------- */
  sommation_mise_en_demeure: {
    "Rédaction de la mise en demeure": miseEnDemeureStandard,

    "Validation de l'acte": ficheValidation(
      "Fiche de validation – mise en demeure"
    ),

    "Signification de la mise en demeure": acteSignification(
      "Acte de signification de mise en demeure",
      `L'AN {{date}},

Je soussigné(e), {{huissier_nom}}, Commissaire de Justice,

Ai signifié à :

{{destinataire_nom}}

la mise en demeure référencée {{mise_en_demeure_ref}}.`
    ),

    "Suivi de la réponse (délai 30 jours)": noteSuivi(
      "Note de suivi de réponse à mise en demeure",
      `Date limite de réponse : {{date_limite}}
Suivi par : {{juriste_nom}}`,
      `RÉPONSE REÇUE

{{reponse_recue}}

SUITE DONNÉE

{{suite_donnee}}`
    ),
  },

  /* ---------------- 10. constats_proces_verbaux ---------------- */
  constats_proces_verbaux: {
    "Programmation du constat avec l'huissier": `{{cabinet_nom}}
{{avocat_nom}}, Avocat
{{adresse}}

À l'attention de : Maître {{huissier_nom}}, Commissaire de Justice

Fait à {{ville}}, le {{date}}

Objet : Demande de constat – dossier n°{{dossier_ref}}

Cher Confrère,

Nous intervenons pour le compte de {{client_nom}} et vous prions de bien vouloir procéder au constat suivant :

Objet du constat : {{objet_constat}}
Adresse : {{adresse}}
Date souhaitée : {{date_souhaitee}}

Nous vous remercions de bien vouloir nous confirmer la programmation de ce constat et nous transmettre le procès-verbal dès sa réalisation.

Nous vous prions d'agréer, Cher Confrère, l'expression de nos salutations distinguées.

${signLettre}`,

    "Réalisation du constat": pvGenerique(
      "Procès-verbal de constat",
      `À : {{lieu}}

Je soussigné(e), {{huissier_nom}}, Commissaire de Justice,

Ai procédé aux constatations suivantes, dans le cadre du dossier n° {{dossier_ref}} :`,
      `FAITS CONSTATÉS

{{faits_constates}}`
    ),

    "Rédaction du procès-verbal": pvGenerique(
      "Procès-verbal de constat",
      `À : {{lieu}}

Je soussigné(e), {{huissier_nom}}, Commissaire de Justice,

Ai procédé aux constatations suivantes, dans le cadre du dossier n° {{dossier_ref}} :`,
      `FAITS CONSTATÉS

{{faits_constates}}`
    ),

    "Validation du PV": ficheValidation(
      "Fiche de validation du PV de constat",
      `PV concerné : {{pv_ref}}
Validateur : {{avocat_validateur}}`
    ),

    "Remise du PV au client": lettreClient(
      "Remise du PV de constat n°{{pv_ref}}",
      `Nous avons le plaisir de vous remettre, ci-joint, le procès-verbal de constat n° {{pv_ref}} établi dans le cadre de votre dossier.

Ce document vous est remis à toutes fins utiles. N'hésitez pas à prendre attache avec nous pour toute question relative à son contenu ou à la suite à donner.`
    ),
  },

  /* ---------------- 11. significations ---------------- */
  significations: {
    "Préparation de l'acte à signifier": `FICHE DE PRÉPARATION DE SIGNIFICATION

Dossier n° {{dossier_ref}}
Date : {{date}}

TYPE D'ACTE

{{acte_type}}

DESTINATAIRE

{{destinataire_nom}}
[Adresse du destinataire]

PIÈCES JOINTES

{{pieces_jointes}}

Établie par :
{{assistant_nom}}
{{cabinet_nom}}`,

    "Programmation de la signification": `{{cabinet_nom}}
{{avocat_nom}}, Avocat
{{adresse}}

À l'attention de : Maître {{huissier_nom}}, Commissaire de Justice

Fait à {{ville}}, le {{date}}

Objet : Programmation de signification – dossier n°{{dossier_ref}}

Cher Confrère,

Nous vous prions de bien vouloir procéder à la signification de l'acte référencé {{acte_ref}} auprès de :

{{destinataire_nom}}

Date souhaitée : {{date_souhaitee}}

Vous trouverez ci-joint l'acte ainsi que les pièces nécessaires. Nous vous remercions de nous transmettre le procès-verbal de remise dès la signification effectuée.

Nous vous prions d'agréer, Cher Confrère, l'expression de nos salutations distinguées.

${signLettre}`,

    "Réalisation de la signification": acteSignification(
      "Acte de signification",
      `L'AN {{date}},

Je soussigné(e), {{huissier_nom}}, Commissaire de Justice,

Ai signifié à :

{{destinataire_nom}}

l'acte référencé {{acte_ref}}.`
    ),

    "Récupération du PV de remise": `FICHE DE SUIVI DU PV DE REMISE

Dossier n° {{dossier_ref}}
Acte concerné : {{acte_ref}}
Date : {{date}}

DATE PRÉVUE DE LA SIGNIFICATION

{{date_prevue}}

DATE DE RÉCEPTION DU PV

{{date_reception}}

OBSERVATIONS

{{observations}}

Établie par :
{{assistant_nom}}
{{cabinet_nom}}`,

    "Transmission de la preuve de signification": lettreClient(
      "Transmission de la preuve de signification – {{acte_ref}}",
      `Nous avons le plaisir de vous transmettre, ci-joint, la preuve de signification de l'acte référencé {{acte_ref}}, effectuée dans le cadre de votre dossier.

Cette signification emporte les effets de droit attachés à l'acte concerné. Nous restons à votre disposition pour vous préciser la suite de la procédure.`
    ),
  },

  /* ---------------- 12. saisies_execution ---------------- */
  saisies_execution: {
    "Vérification du titre exécutoire": noteAnalyse(
      "Note de vérification du titre exécutoire – saisie",
      `Titre exécutoire : {{titre_executoire_ref}}

Montant : {{montant}}`,
      `VÉRIFICATIONS EFFECTUÉES

{{observations}}

III. ANALYSE JURIDIQUE

[Vérifier la régularité du titre, sa force exécutoire, les délais et les formalités préalables à la saisie.]

IV. RECOMMANDATIONS

{{recommandations}}

Établie par :
{{avocat_nom}}
{{cabinet_nom}}`
    ),

    "Rédaction du commandement": commandementPayer,

    "Signification du commandement": acteSignification(
      "Acte de signification du commandement de payer",
      `L'AN {{date}},

Je soussigné(e), {{huissier_nom}}, Commissaire de Justice,

Ai signifié à :

{{debiteur_nom}}

le commandement de payer référencé {{commandement_ref}}.`
    ),

    "Réalisation de la saisie": pvGenerique(
      "Procès-verbal de saisie",
      `À : {{adresse}}

Je soussigné(e), {{huissier_nom}}, Commissaire de Justice,

Ai procédé, au vu du titre exécutoire visé au dossier n° {{dossier_ref}}, à la saisie des biens de {{debiteur_nom}} ci-après désignés :`,
      `BIENS SAISIS

{{biens}}`
    ),

    "Distribution du produit de la saisie": `ÉTAT DE RÉPARTITION DU PRODUIT DE LA SAISIE

Dossier n° {{dossier_ref}}
Date : {{date}}

MONTANT TOTAL DU PRODUIT DE LA SAISIE

{{montant_total}}

LISTE DES CRÉANCIERS

{{creanciers_list}}

RÉPARTITION

{{repartition}}

Établi par :
{{huissier_nom}}`,
  },

  /* ---------------- 13. conseil_consultation ---------------- */
  conseil_consultation: {
    "Analyse de la question juridique posée": `FICHE D'ANALYSE DE LA QUESTION JURIDIQUE

Dossier n° {{dossier_ref}}
Client : {{client_nom}}
Date : {{date}}

QUESTION POSÉE

{{question}}

FAITS

{{faits}}

ENJEUX

{{enjeux}}

Établie par :
{{juriste_nom}}
{{cabinet_nom}}`,

    "Recherche jurisprudentielle et doctrinale": `NOTE DE RECHERCHE JURISPRUDENTIELLE ET DOCTRINALE

Dossier n° {{dossier_ref}}
Date : {{date}}

QUESTION DE RECHERCHE

{{question}}

RÉFÉRENCES IDENTIFIÉES

{{references}}

SYNTHÈSE

{{synthese}}

Établie par :
{{juriste_nom}}
{{cabinet_nom}}`,

    "Rédaction de l'avis / mémoire": `AVIS JURIDIQUE

À l'attention de : {{client_nom}}
Objet : {{question}}
Date : {{date}}

I. RAPPEL DE VOTRE DEMANDE

Vous nous avez consultés sur la question suivante : {{question}}.

II. FAITS

{{faits}}

III. ANALYSE JURIDIQUE

{{analyse}}

IV. RECOMMANDATIONS

{{recommandations}}

Le présent avis est établi à l'attention exclusive de {{client_nom}} et ne saurait être opposé à des tiers.

{{avocat_nom}}
{{cabinet_nom}}
{{ville}}`,

    "Validation de l'avis": ficheValidation(
      "Fiche de validation de l'avis juridique"
    ),

    "Remise de l'avis au client": lettreClient(
      "Remise de l'avis juridique n°{{avis_ref}}",
      `Nous avons le plaisir de vous remettre, ci-joint, l'avis juridique n° {{avis_ref}} établi à votre attention dans le cadre de votre dossier.

Nous restons à votre disposition pour vous accompagner dans la mise en œuvre des recommandations qui y figurent.`
    ),
  },

  /* ---------------- 14. negociation_reglement_amiable ---------------- */
  negociation_reglement_amiable: {
    "Analyse du dossier et des positions respectives": noteAnalyse(
      "Note d'analyse des positions – négociation",
      `Parties concernées : {{parties}}

Positions respectives : {{positions}}`,
      `POINTS DE BLOCAGE

{{points_blocage}}

III. ANALYSE JURIDIQUE

[Exposer ici les rapports de force, les marges de négociation et les scénarios envisageables.]

IV. RECOMMANDATIONS

{{recommandations}}

Établie par :
{{avocat_nom}}
{{cabinet_nom}}`
    ),

    "Ouverture des négociations": lettreSimple(
      "Ouverture de négociations – {{litige}}",
      `Nous intervenons pour le compte de notre client dans le cadre du litige suivant : {{litige}}.

Soucieux de privilégier une issue amiable, nous vous proposons d'ouvrir des négociations sur les bases suivantes :

{{propositions}}

Modalités proposées : {{modalites}}

Nous vous invitons à nous faire connaître votre accord de principe afin de convenir d'un premier échange.`
    ),

    "Rédaction du protocole d'accord": `PROTOCOLE D'ACCORD TRANSACTIONNEL

Entre les soussignés :

{{partie1_nom}}, demeurant à {{partie1_adresse}}, ci-après « la Partie 1 »,

ET

{{partie2_nom}}, demeurant à {{partie2_adresse}}, ci-après « la Partie 2 »,

Il a été convenu et arrêté ce qui suit :

ARTICLE 1 – OBJET

Le présent protocole a pour objet de mettre fin au litige suivant : {{litige}}.

ARTICLE 2 – ENGAGEMENTS DE LA PARTIE 1

La Partie 1 s'engage à : {{engagements_partie1}}.

ARTICLE 3 – ENGAGEMENTS DE LA PARTIE 2

La Partie 2 s'engage à : {{engagements_partie2}}.

ARTICLE 4 – MODALITÉS FINANCIÈRES

En contrepartie, la Partie 2 versera à la Partie 1 la somme de {{montant}}, selon les modalités suivantes : {{modalites_paiement}}.

ARTICLE 5 – CONFIDENTIALITÉ

Les parties s'engagent à garder confidentiels les termes du présent accord, sauf : {{confidentialite}}.

ARTICLE 6 – CLÔTURE DU LITIGE

Les parties reconnaissent que l'exécution complète du présent protocole emportera extinction de toute action liée au litige ci-dessus visé.

Fait à {{ville}}, le {{date}}, en deux exemplaires originaux.

Pour la Partie 1                     Pour la Partie 2

{{partie1_nom}}                      {{partie2_nom}}

Vu et approuvé,
{{avocat_nom}}, Avocat
{{cabinet_nom}}`,

    "Organisation de la signature": lettreSimple(
      "Organisation de la signature du protocole d'accord",
      `Dans le cadre de la signature du protocole d'accord entre {{parties}}, nous vous proposons l'organisation suivante :

Date de signature : {{date_signature}}
Lieu : {{lieu}}
Modalités : {{modalites}}

Nous vous prions de bien vouloir nous confirmer votre disponibilité.

Assistant(e) en charge : {{assistant_nom}}`
    ),
  },

  /* ---------------- 15. RLF ---------------- */
  RLF: {
    "Analyse de la situation familiale et des pièces": `FICHE D'ANALYSE DE LA SITUATION FAMILIALE

Dossier n° {{dossier_ref}}
Client : {{client_nom}}
Date : {{date}}

COMPOSITION DE LA FAMILLE

{{composition_famille}}

ENFANTS

{{enfants}}

PATRIMOINE

{{patrimoine}}

OBSERVATIONS

{{observations}}

Établie par :
{{avocat_nom}}
{{cabinet_nom}}`,

    "Tentative de médiation familiale": `PROCÈS-VERBAL DE MÉDIATION FAMILIALE

L'AN {{date}},

En présence de : {{parties}}

Et de : {{mediateur_nom}}, médiateur,

Il a été procédé à une séance de médiation familiale dans le cadre du dossier n° {{dossier_ref}}.

POINTS ABORDÉS

{{points_abordes}}

ACCORDS PARTIELS

{{accords_partiels}}

OBSERVATIONS

{{observations}}

Fait pour servir et valoir ce que de droit.

{{mediateur_nom}}`,

    "Rédaction de la convention / requête": `CONVENTION / REQUÊTE – RÈGLEMENT DE LITIGE FAMILIAL

ENTRE LES SOUSSIGNÉS :

{{epoux1_nom}}, ci-après « l'Époux 1 »,

ET

{{epoux2_nom}}, ci-après « l'Époux 2 »,

Type de convention : {{type_convention|Type de convention}}

{{#if type_convention == "consentement_mutuel"}}
CONVENTION DE DIVORCE PAR CONSENTEMENT MUTUEL

ARTICLE 1 – DISSOLUTION DU MARIAGE

Les Époux conviennent de divorcer par consentement mutuel.

ARTICLE 2 – ENFANTS ET AUTORITÉ PARENTALE

Enfants : {{enfants}}
Garde : {{garde}}

ARTICLE 3 – PENSION ALIMENTAIRE

{{pension}}

ARTICLE 4 – RÉGIME MATRIMONIAL ET PARTAGE DES BIENS

Régime matrimonial : {{regime_matrimonial}}
Partage des biens : {{partage_biens}}

ARTICLE 5 – LOGEMENT FAMILIAL

{{logement_familial}}

ARTICLE 6 – CONFIDENTIALITÉ ET DÉPÔT

La présente convention est déposée au rang des minutes d'un notaire et sera soumise à l'homologation judiciaire.
{{/if}}

{{#if type_convention == "divorce_contentieux"}}
REQUÊTE EN DIVORCE CONTENTIEUX

À Monsieur le Président du {{tribunal}}

REQUÊTE DE : {{epoux1_nom}}

CONTRE : {{epoux2_nom}}

MOTIFS DE LA DEMANDE

{{motifs_divorce}}

DEMANDES

- Divorce pour faute / pour rupture du lien conjugal ;
- Attribution de la garde des enfants : {{garde}} ;
- Pension alimentaire : {{pension}} ;
- Partage des biens : {{partage_biens}} ;
- {{autres_demandes}}.

PAR CES MOTIFS

PLAISE AU TRIBUNAL :

{{demandes}}

Fait à {{ville}}, le {{date}}

{{avocat_nom}}
{{cabinet_nom}}
{{/if}}

{{#if type_convention == "garde_pension"}}
CONVENTION DE GARDE ET PENSION ALIMENTAIRE

ARTICLE 1 – ENFANTS

{{enfants}}

ARTICLE 2 – GARDE ET DROIT DE VISITE

{{garde}}

ARTICLE 3 – PENSION ALIMENTAIRE

Montant : {{pension}}
Modalités de paiement : {{modalites_paiement}}

ARTICLE 4 – RÉVISION

{{revision_pension}}

ARTICLE 5 – AUTORITÉ PARENTALE CONJOINTE

{{autorite_parentale}}
{{/if}}

Fait à {{ville}}, le {{date}}, en deux exemplaires originaux.

L'Époux 1                          L'Époux 2

{{epoux1_nom}}                     {{epoux2_nom}}

Vu et approuvé,
{{avocat_nom}}, Avocat
{{cabinet_nom}}`,

    "Validation avec les parties": ficheValidation(
      "Fiche de validation de la convention familiale",
      `Parties : {{parties}}
Avocat : {{avocat_nom}}`
    ),

    "Dépôt / homologation au tribunal": `REQUÊTE EN HOMOLOGATION DE CONVENTION FAMILIALE

À Monsieur le Président du {{tribunal}}

Dossier n° {{dossier_ref}}

REQUÊTE DE : {{parties}}

OBJET DE LA DEMANDE

Convention déposée : {{convention_ref}}

INTÉRÊT DES ENFANTS

{{interet_enfants}}

PAR CES MOTIFS

Il est demandé au Tribunal de bien vouloir homologuer la convention ci-dessus référencée.

Fait à {{ville}}, le {{date}}

{{avocat_nom}}
{{cabinet_nom}}`,

    "Suivi d'exécution": noteSuivi(
      "Note de suivi d'exécution – décision familiale",
      `Décision concernée : {{decision_ref}}`,
      `POINTS SUIVIS

{{points_suivis}}

INCIDENTS CONSTATÉS

{{incidents}}

SUITE ENVISAGÉE

[Préciser les actions à mener : rappel, exécution forcée, clôture, etc.]`
    ),
  },

  /* ---------------- 16. DROIT_NUMERIQUE ---------------- */
  DROIT_NUMERIQUE: {
    "Conservation des preuves numériques": `PROCÈS-VERBAL DE CONSERVATION DES PREUVES NUMÉRIQUES

Dossier n° {{dossier_ref}}
Date : {{date}}

SUPPORTS NUMÉRIQUES CONSERVÉS

{{supports}}

MODALITÉS DE CONSERVATION

[Décrire les méthodes de copie, de scellement, de hachage et de stockage sécurisé.]

Établi par :
{{expert_nom}}

En présence de :
{{avocat_nom}}`,

    "Analyse technique et expertise numérique": `RAPPORT D'EXPERTISE NUMÉRIQUE

Dossier n° {{dossier_ref}}
Date : {{date}}

FAITS ET CONTEXTE

{{faits}}

MÉTHODOLOGIE

{{methodologie}}

CONSTATATIONS

{{constatations}}

Établi par :
{{expert_nom}}`,

    "Qualification juridique des infractions": noteAnalyse(
      "Note de qualification juridique des infractions numériques",
      `Faits allégués : {{faits}}

Textes applicables : {{textes_applicables}}`,
      `QUALIFICATION RETENUE

{{qualification}}

III. ANALYSE JURIDIQUE

[Exposer ici les éléments constitutifs des infractions, les peines encourues et les risques de requalification.]

IV. RECOMMANDATIONS

{{recommandations}}

Établie par :
{{avocat_nom}}
{{cabinet_nom}}`
    ),

    "Rédaction des conclusions / mémoire": `DEVANT LE {{tribunal}} DE {{ville_tribunal}}

Affaire n° {{dossier_ref}}

CONCLUSIONS POUR :

{{client_nom}},
représenté par {{avocat_nom}}, Avocat au Barreau de {{ville_tribunal}}
{{cabinet_nom}}

I. EXPOSÉ DES FAITS

{{expose_faits}}

II. QUALIFICATION JURIDIQUE

{{qualification}}

III. CONCLUSIONS

Par ces motifs, il est demandé au Tribunal de :

{{demandes}}

SOUS TOUTES RÉSERVES

Fait à {{ville_tribunal}}, le {{date}}

{{avocat_nom}}
{{cabinet_nom}}`,

    "Préparation de l'audience": dossierAudience(
      "Dossier d'audience – droit pénal du numérique"
    ),

    "Suivi de la décision": noteSuivi(
      "Note de suivi de décision – droit du numérique",
      `Décision : {{decision_ref}}`,
      `DISPOSITIF DE LA DÉCISION

{{sanctions}}

VOIES DE RECOURS

{{voies_recours}}

SUIVI ENVISAGÉ

[Préciser les actions à mener : appel, exécution, clôture, etc.]`
    ),
  },

  /* ---------------- 17. DROIT_PENALCRIMINEL ---------------- */
  DROIT_PENALCRIMINEL: {
    "Examen du dossier d'instruction": noteAnalyse(
      "Note d'analyse du dossier d'instruction",
      `Infractions visées : {{infractions}}

Pièces clés : {{pieces_cles}}`,
      noteCorpsStandard
    ),

    "Entretien avec le client et les témoins": `COMPTE RENDU D'ENTRETIEN – CLIENT ET TÉMOINS

Dossier n° {{dossier_ref}}
Date : {{date}}

PARTICIPANTS

{{participants}}

POINTS ABORDÉS

{{points_abordes}}

OBSERVATIONS

{{observations}}

Établi par :
{{avocat_nom}}
{{cabinet_nom}}`,

    "Rédaction des conclusions de défense": `DEVANT LA {{juridiction}}

Affaire n° {{dossier_ref}}

CONCLUSIONS DE DÉFENSE POUR :

{{client_nom}},
représenté par {{avocat_nom}}, Avocat
{{cabinet_nom}}

I. INFRACTIONS REPROCHÉES

{{infractions}}

II. MOYENS DE DÉFENSE

{{moyens}}

III. DEMANDES

{{demandes}}

SOUS TOUTES RÉSERVES

Fait à {{ville}}, le {{date}}

{{avocat_nom}}
{{cabinet_nom}}`,

    "Préparation de l'audience": `DOSSIER D'AUDIENCE – PROCÉDURE PÉNALE

Dossier n° {{dossier_ref}}
Juridiction : {{juridiction}}
Date d'audience : {{date_audience}}

PIÈCES CLÉS

{{pieces}}

ARGUMENTS PRINCIPAUX

{{arguments}}

ORGANISATION DE LA PLAIDOIRIE

[Points à plaider, ordre de passage, pièces à produire.]

Avocat : {{avocat_nom}}
{{cabinet_nom}}`,

    "Assistance à l'audience": `FEUILLE D'AUDIENCE – PROCÉDURE PÉNALE

Dossier n° {{dossier_ref}}
Juridiction : {{juridiction}}
Date d'audience : {{date_audience}}

PIÈCES À PRODUIRE

{{pieces}}

ARGUMENTS À PLAIDER

{{arguments}}

ÉLÉMENTS À VÉRIFIER AVANT L'AUDIENCE

[Présence du client, convocations des témoins, pièces originales, conclusions déposées.]

Avocat : {{avocat_nom}}
{{cabinet_nom}}`,

    "Recours / exécution de la décision": noteSuivi(
      "Note de suivi de décision pénale",
      `Décision : {{decision_ref}}`,
      `DISPOSITIF DE LA DÉCISION

{{sanctions}}

VOIES DE RECOURS

{{voies_recours}}

SUIVI ENVISAGÉ

[Préciser les actions à mener : appel, exécution, clôture, etc.]`
    ),
  },

  /* ---------------- 18. DROIT_FINANCIER ---------------- */
  DROIT_FINANCIER: {
    "Analyse du dossier": noteAnalyse(
      "Note d'analyse du dossier – droit pénal financier",
      `Faits : {{faits}}

Enjeux : {{enjeux}}`,
      noteCorpsStandard
    ),

    "Analyse des documents financiers et comptables": `RAPPORT D'ANALYSE FINANCIÈRE ET COMPTABLE

Dossier n° {{dossier_ref}}
Date : {{date}}

DOCUMENTS EXAMINÉS

{{documents}}

ANOMALIES CONSTATÉES

{{anomalies}}

CONCLUSIONS DE L'ANALYSE

[Préciser les flux suspects, les écarts et les montants en cause.]

Établi par :
{{expert_nom}}

Vu par :
{{avocat_nom}}
{{cabinet_nom}}`,

    "Audit juridique et qualification des faits": noteAnalyse(
      "Note d'audit juridique – qualification des infractions financières",
      `Faits : {{faits}}

Textes applicables : {{textes}}`,
      `QUALIFICATION RETENUE

{{qualification}}

III. ANALYSE JURIDIQUE

[Exposer ici les éléments constitutifs des infractions financières, les peines encourues et les responsabilités.]

IV. RECOMMANDATIONS

{{recommandations}}

Établie par :
{{avocat_nom}}
{{cabinet_nom}}`
    ),

    "Rédaction des conclusions": `DEVANT LA {{juridiction}}

Affaire n° {{dossier_ref}}

CONCLUSIONS POUR :

{{client_nom}},
représenté par {{avocat_nom}}, Avocat
{{cabinet_nom}}

I. EXPOSÉ DES FAITS

{{expose_faits}}

II. QUALIFICATION JURIDIQUE

{{qualification}}

III. DEMANDES

{{demandes}}

SOUS TOUTES RÉSERVES

Fait à {{ville}}, le {{date}}

{{avocat_nom}}
{{cabinet_nom}}`,

    "Préparation de l'audience": `DOSSIER D'AUDIENCE – DROIT PÉNAL FINANCIER

Dossier n° {{dossier_ref}}
Juridiction : {{juridiction}}
Date d'audience : {{date_audience}}

PIÈCES CLÉS

{{pieces}}

ARGUMENTS PRINCIPAUX

{{arguments}}

ORGANISATION DE LA PLAIDOIRIE

[Points à plaider, ordre de passage, pièces à produire.]

Avocat : {{avocat_nom}}
{{cabinet_nom}}`,

    "Suivi de la décision": noteSuivi(
      "Note de suivi de décision – droit pénal financier",
      `Décision : {{decision_ref}}`,
      `DISPOSITIF DE LA DÉCISION

{{sanctions}}

VOIES DE RECOURS

{{voies_recours}}

SUIVI ENVISAGÉ

[Préciser les actions à mener : appel, exécution, clôture, etc.]`
    ),
  },
};

module.exports = { TEMPLATES };
