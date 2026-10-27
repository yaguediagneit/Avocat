/**
 * Seed des spécialités (types d'affaire) du domaine « Démarches
 * administratives » (foncier, urbanisme, cadastre, fiscalité — Sénégal).
 *
 * Crée 5 spécialités sélectionnables à la création d'un dossier, chacune
 * avec : étapes de workflow calquées sur le cycle de vie d'une démarche,
 * templates de tâches de démarrage (avec modèles de courrier à variables)
 * et types de documents attendus.
 *
 * Idempotent : upsert par code ; n'ajoute que les étapes / tâches /
 * types de documents absents (le paramétrage existant n'est pas écrasé).
 *
 * Usage : node scripts/seed-specialites-demarches.js [--dry-run] [--tenant=<slug>]
 */
try {
  process.loadEnvFile(".env");
} catch {
  // Pas de fichier .env en production (variables injectées par le conteneur).
}
const { PrismaClient: TenantClient } = require("@prisma/client");
const { PrismaClient: PublicClient } = require("../prisma/generated/public");

const DRY_RUN = process.argv.includes("--dry-run");
const TENANT_ARG = process.argv.find((a) => a.startsWith("--tenant="))?.split("=")[1];

/* ------------------------------------------------------------------ */
/* Étapes de workflow communes (cycle de vie d'une démarche admin.)    */
/* ------------------------------------------------------------------ */
const ETAPES_COMMUNES = [
  { code: "prospect", libelle: "Prospect", estInitial: true },
  { code: "qualification", libelle: "Qualification de la demande" },
  { code: "collecte", libelle: "Collecte des pièces" },
  { code: "preparation", libelle: "Préparation du dossier" },
  { code: "validation", libelle: "Contrôle et validation" },
  { code: "depot", libelle: "Dépôt auprès de l'administration" },
  { code: "instruction", libelle: "Instruction et suivi" },
  { code: "decision", libelle: "Décision de l'administration" },
  { code: "remise", libelle: "Document remis au client" },
  { code: "cloture", libelle: "Clôturé", estFinal: true },
];

/* ------------------------------------------------------------------ */
/* Modèles de courrier (variables {{cle}} reprises des conventions du   */
/* cabinet : dossier_ref, client_nom, cabinet_nom, date, ville…)       */
/* ------------------------------------------------------------------ */
const DOC_NOTE_QUALIFICATION = `NOTE DE QUALIFICATION DE LA DEMANDE

Dossier n° {{dossier_ref}}
Client : {{client_nom}}
Date : {{date}}

I. DEMANDE REÇUE

Objet exprimé : {{objet_demande|Objet tel qu'exprimé par le client}}
Autorité visée : {{autorite|Autorité compétente identifiée}}

II. QUALIFICATION

Nature exacte de la démarche : {{nature_demarche|Nature exacte qualifiée}}
Fondement : {{fondement|Fondement de la demande}}
Éléments relevés : {{elements_qualification|Sous-type, références, inscriptions, période, montant…}}

III. RECEVABILITÉ

Qualité du demandeur : {{qualite_demandeur|Qualité du demandeur}}
Pièces exigées : {{pieces_exigees|Liste des pièces}}
Réserves : {{reserves|Réserves éventuelles}}

IV. CONCLUSION

{{conclusion|Recevable / à requalifier / à compléter}}

Rédigée par : {{avocat_nom}}
{{cabinet_nom}}`;

const DOC_DEMANDE_ADMIN = `{{ville|Ville}}, le {{date}}

À Monsieur / Madame {{destinataire|Titre et fonction du destinataire}}
{{autorite|Autorité destinataire}}
{{adresse_autorite|Adresse de l'autorité}}

Objet : {{objet|Objet de la demande}}
Réf. dossier : {{dossier_ref}}

Madame, Monsieur,

{{corps_demande|Corps de la demande — objet précis, bien ou acte visé, finalité}}

Demandeur : {{client_nom}}
En qualité de : {{qualite_demandeur|Qualité du demandeur}}

Bien / parcelle concerné : {{localisation_parcelle|Localisation}}
Références foncières : {{references_foncieres|TF, NICAD, bail…}}

Pièces jointes :
{{liste_pieces|Liste des pièces jointes}}

Dans l'attente de votre réponse, nous vous prions d'agréer, Madame, Monsieur,
l'expression de nos salutations distinguées.

{{avocat_nom}}
{{cabinet_nom}}`;

const DOC_RELANCE = `{{ville|Ville}}, le {{date}}

À {{autorite|Autorité destinataire}}

Objet : Relance — {{type_demarche|Type de démarche}}
Votre récépissé : {{numero_recepisse|N° de récépissé}}
Notre référence : {{dossier_ref}}

Madame, Monsieur,

Sauf erreur de notre part, la demande déposée le {{date_depot|Date de dépôt}}
au nom de {{client_nom}} reste sans réponse à ce jour.

Nous vous saurions gré de bien vouloir nous faire connaître l'état
d'avancement de l'instruction et, le cas échéant, les compléments à fournir.

Nous vous prions d'agréer, Madame, Monsieur, l'expression de nos
salutations distinguées.

{{avocat_nom}}
{{cabinet_nom}}`;

const DOC_DEMANDE_PIECES = `{{ville|Ville}}, le {{date}}

À l'attention de {{client_nom}}
{{adresse_client|Adresse du client}}

Objet : Votre dossier — pièces à fournir
Réf. dossier : {{dossier_ref}}

Madame, Monsieur,

Dans le cadre de {{objet_dossier|l'opération confiée au cabinet}}, nous vous
remercions de bien vouloir nous faire parvenir les pièces suivantes :

{{liste_pieces|Liste des pièces à fournir}}

Ces documents sont indispensables à la constitution du dossier auprès de
{{autorite|l'autorité compétente}}.

Délai de remise souhaité : {{delai|Délai}}

Nous restons à votre disposition pour tout complément d'information et vous
prions d'agréer, Madame, Monsieur, l'expression de nos salutations distinguées.

{{avocat_nom}}
{{cabinet_nom}}`;

const DOC_BORDEREAU = `BORDEREAU DE DÉPÔT DE DOSSIER

Cabinet : {{cabinet_nom}}
Réf. dossier : {{dossier_ref}}
Client / demandeur : {{client_nom}}
Date de dépôt : {{date}}

Administration destinataire : {{autorite|Autorité / service destinataire}}
Service / guichet : {{service|Service ou guichet}}

Nature de la demande : {{type_demarche|Type de démarche}}
Bien / parcelle concerné : {{localisation_parcelle|Localisation}}

PIÈCES DÉPOSÉES — {{nombre_exemplaires|Nombre}} exemplaire(s)
{{liste_pieces|Liste détaillée des pièces déposées}}

Taxes / timbres acquittés : {{taxes|Montants et références}}

Observations : {{observations|Observations}}

Nom et visa du déposant : {{deposant|Nom du déposant}}

Nom et visa du receveur : _____________________________

Cachet de l'administration : _____________________________`;

const DOC_NOTE_CONTROLE = `NOTE DE CONTRÔLE DE COMPLÉTUDE

Réf. dossier : {{dossier_ref}}
Client : {{client_nom}}
Type de démarche : {{type_demarche|Type de démarche}}
Date de contrôle : {{date}}

I. PIÈCES VÉRIFIÉES
{{pieces_verifiees|Pièces contrôlées — conformité, validité, dates}}

II. PIÈCES MANQUANTES OU NON CONFORMES
{{pieces_manquantes|Pièces manquantes ou à régulariser}}

III. POINTS DE VIGILANCE
{{points_vigilance|Taxes, timbres, signatures, procuration, délais}}

IV. AVIS
{{avis|Dossier complet et déposable / compléments requis}}

Contrôlé par : {{avocat_nom}}
{{cabinet_nom}}`;

const DOC_REMISE = `PROCÈS-VERBAL DE REMISE DE DOCUMENT

Cabinet : {{cabinet_nom}}
Réf. dossier : {{dossier_ref}}
Date de remise : {{date}}

Entre le cabinet {{cabinet_nom}}, représenté par {{avocat_nom}},
et {{client_nom}}, ci-après « le client ».

Document remis : {{document_remis|Nature et référence du document officiel}}
Délivré par : {{autorite|Autorité délivrante}}
Date de délivrance : {{date_delivrance|Date}}
Nombre d'exemplaires : {{exemplaires|Nombre}}

Le client reconnaît avoir reçu le document ci-dessus en main propre et en
avoir pris connaissance.

Observations : {{observations|Observations}}

Fait à {{ville|Ville}}, le {{date}}

Pour le cabinet :                                  Le client :
{{avocat_nom}}                                     {{client_nom}}
(signature)                                        (signature précédée de « lu et approuvé »)`;

const DOC_EXTRAIT_CADASTRE = `{{ville|Ville}}, le {{date}}

À Monsieur le Chef du Bureau du Cadastre de
{{bureau_cadastre|Bureau du Cadastre compétent}}

Objet : Demande d'extrait de plan cadastral visé
Réf. dossier : {{dossier_ref}}

Monsieur le Chef de Bureau,

Dans le cadre de {{objet|l'opération visée — autorisation de construire, bail, immatriculation…}},
nous avons l'honneur de solliciter un extrait de plan cadastral visé
concernant la parcelle située {{localisation_parcelle|Localisation de la parcelle}},
référencée {{references_foncieres|TF / NICAD / section et numéro}}.

Demandeur : {{client_nom}}, en qualité de {{qualite_demandeur|propriétaire / ayant droit / mandataire}}.

Pièces jointes :
{{liste_pieces|Copie du titre foncier ou acte d'attribution, pièce d'identité, plan de situation…}}

Nous vous prions d'agréer, Monsieur le Chef de Bureau, l'expression de nos
salutations distinguées.

{{avocat_nom}}
{{cabinet_nom}}`;

/* ------------------------------------------------------------------ */
/* Spécialités                                                          */
/* ------------------------------------------------------------------ */
const SPECIALITES = [
  {
    code: "demarches_urbanisme",
    libelle: "Urbanisme : autorisations de construire et de lotir",
    description:
      "Demandes d'autorisation de construire et de lotir auprès des mairies et services de l'Urbanisme (URB_CONSTRUIRE, URB_LOTIR).",
    ordre: 60,
    tasks: [
      { titre: "Qualifier la demande d'urbanisme (construire / lotir, commune compétente)", etape: "qualification", delaiJours: 2, roleAttendu: "juriste", priorite: "haute", contenuDocument: DOC_NOTE_QUALIFICATION },
      { titre: "Collecter les pièces : titre de propriété, fiche de renseignement, devis, plans architecte, assainissement", etape: "collecte", delaiJours: 7, roleAttendu: "assistant", priorite: "haute", contenuDocument: DOC_DEMANDE_PIECES },
      { titre: "Faire viser l'extrait de plan cadastral (Bureau du Cadastre)", etape: "collecte", delaiJours: 10, roleAttendu: "any", priorite: "moyenne", contenuDocument: DOC_EXTRAIT_CADASTRE },
      { titre: "Rédiger la demande au maire compétent et préparer le paquet (2 ou 3 exemplaires)", etape: "preparation", delaiJours: 12, roleAttendu: "juriste", priorite: "haute", contenuDocument: DOC_DEMANDE_ADMIN },
      { titre: "Contrôler la complétude : taxe d'urbanisme, timbre fiscal, procuration", etape: "validation", delaiJours: 14, roleAttendu: "avocat", priorite: "haute", contenuDocument: DOC_NOTE_CONTROLE },
      { titre: "Déposer le dossier en mairie et obtenir le récépissé", etape: "depot", delaiJours: 15, roleAttendu: "any", priorite: "haute", contenuDocument: DOC_BORDEREAU },
      { titre: "Suivre l'instruction et relancer le service", etape: "instruction", delaiJours: 30, roleAttendu: "assistant", priorite: "moyenne", contenuDocument: DOC_RELANCE },
      { titre: "Retirer l'arrêté d'autorisation délivré et le remettre au client", etape: "remise", delaiJours: 60, roleAttendu: "assistant", priorite: "moyenne", contenuDocument: DOC_REMISE },
    ],
    docs: [
      { code: "titre_propriete", libelle: "Titre de propriété / titre foncier", obligatoire: true },
      { code: "demande_maire", libelle: "Demande adressée au maire" },
      { code: "devis_descriptif", libelle: "Devis descriptif et estimatif" },
      { code: "plans_architecte", libelle: "Plans architecturaux visés" },
      { code: "extrait_plan_cadastral", libelle: "Extrait de plan cadastral visé" },
      { code: "procuration", libelle: "Procuration / mandat" },
      { code: "recepisse_depot", libelle: "Récépissé de dépôt" },
      { code: "document_delivre", libelle: "Autorisation administrative délivrée" },
    ],
  },
  {
    code: "demarches_cadastre",
    libelle: "Cadastre : NICAD, extraits de plan, certificats (CIC), avis",
    description:
      "Demandes auprès des Bureaux du Cadastre : attribution de NICAD, extrait de plan cadastral certifié, certificat d'identification cadastrale, avis favorable (CAD_*).",
    ordre: 61,
    tasks: [
      { titre: "Qualifier la demande cadastrale (objet, service sollicité, références de la parcelle)", etape: "qualification", delaiJours: 2, roleAttendu: "juriste", priorite: "haute", contenuDocument: DOC_NOTE_QUALIFICATION },
      { titre: "Collecter titre foncier ou acte d'attribution, pièce d'identité, plan de situation", etape: "collecte", delaiJours: 5, roleAttendu: "assistant", priorite: "haute", contenuDocument: DOC_DEMANDE_PIECES },
      { titre: "Rédiger la demande au Bureau du Cadastre de la localité de la parcelle", etape: "preparation", delaiJours: 7, roleAttendu: "juriste", priorite: "haute", contenuDocument: DOC_DEMANDE_ADMIN },
      { titre: "Déposer au guichet du Bureau du Cadastre et obtenir le récépissé", etape: "depot", delaiJours: 10, roleAttendu: "any", priorite: "haute", contenuDocument: DOC_BORDEREAU },
      { titre: "Suivre l'instruction et relancer si nécessaire", etape: "instruction", delaiJours: 25, roleAttendu: "assistant", priorite: "moyenne", contenuDocument: DOC_RELANCE },
      { titre: "Retirer le document délivré (NICAD, extrait, CIC, avis) et le remettre au client", etape: "remise", delaiJours: 45, roleAttendu: "assistant", priorite: "moyenne", contenuDocument: DOC_REMISE },
    ],
    docs: [
      { code: "titre_ou_acte", libelle: "Titre foncier ou acte d'attribution", obligatoire: true },
      { code: "piece_identite", libelle: "Pièce d'identité du propriétaire" },
      { code: "plan_situation", libelle: "Plan de situation" },
      { code: "recepisse_depot", libelle: "Récépissé de dépôt" },
      { code: "document_delivre", libelle: "Document cadastral délivré (NICAD, extrait, CIC, avis)" },
    ],
  },
  {
    code: "demarches_foncier_domaines",
    libelle: "Foncier et domaines : livre foncier, radiations, mainlevées, transformation en titre foncier",
    description:
      "Démarches auprès de la Conservation foncière et de la DEDT : radiations, mainlevées, transformation de bail / permis d'occuper en titre foncier (FON_*, DOM_*).",
    ordre: 62,
    tasks: [
      { titre: "Qualifier l'inscription ou le droit visé (référence au livre foncier, créancier, motif)", etape: "qualification", delaiJours: 2, roleAttendu: "avocat", priorite: "haute", contenuDocument: DOC_NOTE_QUALIFICATION },
      { titre: "Collecter les justificatifs : titre d'occupation, mainlevée, quittances de redevances, CNI", etape: "collecte", delaiJours: 7, roleAttendu: "assistant", priorite: "haute", contenuDocument: DOC_DEMANDE_PIECES },
      { titre: "Rédiger la demande à la Conservation foncière ou à la DEDT", etape: "preparation", delaiJours: 10, roleAttendu: "avocat", priorite: "haute", contenuDocument: DOC_DEMANDE_ADMIN },
      { titre: "Contrôle juridique du dossier et validation", etape: "validation", delaiJours: 12, roleAttendu: "avocat", priorite: "haute", contenuDocument: DOC_NOTE_CONTROLE },
      { titre: "Déposer le dossier et obtenir le récépissé", etape: "depot", delaiJours: 15, roleAttendu: "any", priorite: "haute", contenuDocument: DOC_BORDEREAU },
      { titre: "Suivre l'instruction (commission ad hoc éventuelle) et relancer", etape: "instruction", delaiJours: 45, roleAttendu: "assistant", priorite: "moyenne", contenuDocument: DOC_RELANCE },
      { titre: "Vérifier l'inscription / le titre délivré et le remettre au client", etape: "remise", delaiJours: 90, roleAttendu: "assistant", priorite: "moyenne", contenuDocument: DOC_REMISE },
    ],
    docs: [
      { code: "titre_ou_acte", libelle: "Titre foncier, bail, permis ou acte d'attribution", obligatoire: true },
      { code: "mainlevee", libelle: "Mainlevée / justificatif d'extinction" },
      { code: "quittance_redevances", libelle: "Quittances de redevances d'occupation" },
      { code: "piece_identite", libelle: "CNI ou documents de société" },
      { code: "recepisse_depot", libelle: "Récépissé de dépôt" },
      { code: "document_delivre", libelle: "Acte ou titre délivré (mainlevée, radiation, TF)" },
    ],
  },
  {
    code: "demarches_fiscalite",
    libelle: "Fiscalité et enregistrement : attestations, enregistrement d'actes, successions, acquiescements",
    description:
      "Demandes fiscales auprès de la DGID et des Centres des services fiscaux : attestation de non-imposition, avis d'imposition, enregistrement d'actes, déclaration après décès, acquiescement (FIS_*).",
    ordre: 63,
    tasks: [
      { titre: "Qualifier la demande fiscale (acte ou décision visé, période, centre compétent)", etape: "qualification", delaiJours: 2, roleAttendu: "juriste", priorite: "haute", contenuDocument: DOC_NOTE_QUALIFICATION },
      { titre: "Collecter les pièces fiscales (CNI, déclaration, attestation, acte à enregistrer)", etape: "collecte", delaiJours: 5, roleAttendu: "assistant", priorite: "haute", contenuDocument: DOC_DEMANDE_PIECES },
      { titre: "Préparer la demande / la déclaration et la note de conseil si acquiescement ou succession", etape: "preparation", delaiJours: 8, roleAttendu: "avocat", priorite: "haute", contenuDocument: DOC_DEMANDE_ADMIN },
      { titre: "Validation avocat / fiscaliste (obligatoire pour succession et acquiescement)", etape: "validation", delaiJours: 10, roleAttendu: "avocat", priorite: "haute", contenuDocument: DOC_NOTE_CONTROLE },
      { titre: "Déposer au Centre des services fiscaux ou à la DEDT et obtenir la quittance", etape: "depot", delaiJours: 12, roleAttendu: "any", priorite: "haute", contenuDocument: DOC_BORDEREAU },
      { titre: "Suivre la liquidation des droits et relancer", etape: "instruction", delaiJours: 25, roleAttendu: "assistant", priorite: "moyenne", contenuDocument: DOC_RELANCE },
      { titre: "Retirer l'attestation / quittance / accusé et remettre au client", etape: "remise", delaiJours: 40, roleAttendu: "assistant", priorite: "moyenne", contenuDocument: DOC_REMISE },
    ],
    docs: [
      { code: "piece_identite", libelle: "CNI du demandeur / déclarant", obligatoire: true },
      { code: "declaration_fiscale", libelle: "Déclaration fiscale" },
      { code: "acte_a_enregistrer", libelle: "Acte ou décision à enregistrer" },
      { code: "certificat_residence", libelle: "Certificat de résidence / domicile" },
      { code: "acte_deces", libelle: "Acte de décès (succession)" },
      { code: "confirmation_client", libelle: "Confirmation écrite du client (acquiescement)" },
      { code: "quittance", libelle: "Quittance / preuve de paiement des droits" },
      { code: "document_delivre", libelle: "Attestation ou accusé fiscal délivré" },
    ],
  },
  {
    code: "demarches_administratives",
    libelle: "Démarches administratives diverses : duplicata, certificats, attestations",
    description:
      "Demandes transversales auprès des administrations : duplicata de documents administratifs et autres demandes ne relevant pas d'un domaine spécialisé (ADM_*).",
    ordre: 64,
    tasks: [
      { titre: "Qualifier la demande (document visé, autorité émettrice, motif)", etape: "qualification", delaiJours: 2, roleAttendu: "juriste", priorite: "haute", contenuDocument: DOC_NOTE_QUALIFICATION },
      { titre: "Collecter les pièces (déclaration de perte, pièce d'identité, copie de l'original)", etape: "collecte", delaiJours: 5, roleAttendu: "assistant", priorite: "moyenne", contenuDocument: DOC_DEMANDE_PIECES },
      { titre: "Rédiger la demande auprès de l'administration émettrice", etape: "preparation", delaiJours: 7, roleAttendu: "juriste", priorite: "moyenne", contenuDocument: DOC_DEMANDE_ADMIN },
      { titre: "Déposer la demande et obtenir le récépissé", etape: "depot", delaiJours: 10, roleAttendu: "any", priorite: "moyenne", contenuDocument: DOC_BORDEREAU },
      { titre: "Suivre et relancer l'administration", etape: "instruction", delaiJours: 25, roleAttendu: "assistant", priorite: "moyenne", contenuDocument: DOC_RELANCE },
      { titre: "Retirer le document délivré et le remettre au client", etape: "remise", delaiJours: 40, roleAttendu: "assistant", priorite: "moyenne", contenuDocument: DOC_REMISE },
    ],
    docs: [
      { code: "piece_identite", libelle: "Pièce d'identité du demandeur", obligatoire: true },
      { code: "declaration_perte", libelle: "Déclaration de perte / vol" },
      { code: "copie_original", libelle: "Copie ou référence du document original" },
      { code: "recepisse_depot", libelle: "Récépissé de dépôt" },
      { code: "document_delivre", libelle: "Document administratif délivré" },
    ],
  },
];

/* ------------------------------------------------------------------ */
/* Application                                                         */
/* ------------------------------------------------------------------ */
(async () => {
  const pub = new PublicClient();
  let tenants = await pub.tenant.findMany();
  if (TENANT_ARG) tenants = tenants.filter((t) => t.slug === TENANT_ARG || t.id === TENANT_ARG);
  const base = process.env.DATABASE_URL;

  for (const t of tenants) {
    const url = t.databaseUrl || `${base}${base.includes("?") ? "&" : "?"}schema=${t.schemaName}`;
    const db = new TenantClient({ datasources: { db: { url } } });
    console.log(`\n===== TENANT ${t.slug || t.id} (${t.schemaName}) =====`);

    for (const spec of SPECIALITES) {
      const { tasks, docs, ...sp } = spec;
      if (DRY_RUN) {
        console.log(`  [dry] spécialité ${sp.code} (${tasks.length} tâches, ${docs.length} docs)`);
        continue;
      }
      const specialite = await db.specialite.upsert({
        where: { code: sp.code },
        create: { ...sp, selectionnee: true },
        update: { libelle: sp.libelle, description: sp.description, ordre: sp.ordre, selectionnee: true },
      });
      console.log(`  ok spécialité ${sp.code}`);

      // Étapes de workflow (ajout des manquantes uniquement).
      const etapesExistantes = await db.workflowSpecialite.findMany({
        where: { specialiteId: specialite.id }, select: { code: true },
      });
      const codesEtapes = new Set(etapesExistantes.map((e) => e.code));
      const etapesManquantes = ETAPES_COMMUNES.filter((e) => !codesEtapes.has(e.code));
      if (etapesManquantes.length) {
        await db.workflowSpecialite.createMany({
          data: etapesManquantes.map((e) => ({
            ...e, specialiteId: specialite.id,
            ordre: ETAPES_COMMUNES.indexOf(e),
          })),
        });
      }
      const etapes = await db.workflowSpecialite.findMany({ where: { specialiteId: specialite.id } });
      const etapeIdOf = (code) => etapes.find((e) => e.code === code)?.id || null;

      // Templates de tâches (ajout des titres manquants).
      const tachesExistantes = await db.tacheTemplate.findMany({
        where: { specialiteId: specialite.id }, select: { id: true, titre: true, contenuDocument: true },
      });
      const titres = new Set(tachesExistantes.map((x) => x.titre));
      const manquantes = tasks.filter((x) => !titres.has(x.titre));
      for (const tk of manquantes) {
        await db.tacheTemplate.create({
          data: {
            specialiteId: specialite.id,
            workflowEtapeId: etapeIdOf(tk.etape),
            titre: tk.titre,
            contenuDocument: tk.contenuDocument || null,
            delaiJours: tk.delaiJours,
            roleAttendu: tk.roleAttendu,
            priorite: tk.priorite,
            ordre: tasks.indexOf(tk),
          },
        });
      }
      // Compléter le modèle de document des tâches existantes qui n'en ont pas
      // (n'écrase jamais un contenuDocument déjà renseigné / personnalisé).
      let modelesAjoutes = 0;
      for (const t of tachesExistantes) {
        const def = tasks.find((x) => x.titre === t.titre);
        if (def?.contenuDocument && !t.contenuDocument) {
          await db.tacheTemplate.update({
            where: { id: t.id },
            data: { contenuDocument: def.contenuDocument },
          });
          modelesAjoutes++;
        }
      }
      console.log(`    ${etapesManquantes.length} étape(s), ${manquantes.length} tâche(s) ajoutée(s), ${modelesAjoutes} modèle(s) de document complété(s)`);

      // Types de documents attendus (ajout des codes manquants).
      const docsExistants = await db.typeDocumentSpecialite.findMany({
        where: { specialiteId: specialite.id }, select: { code: true },
      });
      const codesDocs = new Set(docsExistants.map((d) => d.code));
      const docsManquants = docs.filter((d) => !codesDocs.has(d.code));
      if (docsManquants.length) {
        await db.typeDocumentSpecialite.createMany({
          data: docsManquants.map((d) => ({
            ...d, obligatoire: d.obligatoire || false,
            specialiteId: specialite.id, ordre: docs.indexOf(d),
          })),
        });
      }
      console.log(`    ${docsManquants.length} type(s) de document ajouté(s)`);
    }

    await db.$disconnect();
  }
  console.log("\nTerminé.");
  await pub.$disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
