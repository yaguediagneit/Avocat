export const MISSION_TITLES: Record<string, string> = {
  huissier: "ORDRE DE MISSION – huissier de justice (commissaire de justice)",
  avocat: "ORDRE DE MISSION – avocat",
  architecte: "ORDRE DE MISSION – architecte (maître d’œuvre)",
  expert: "ORDRE DE MISSION – expert-comptable / commissaire aux comptes (CAC)",
  clerc: "ORDRE DE MISSION – clec / conseil spécialisé",
  conseiller: "ORDRE DE MISSION – conseiller juridique",
  autre: "ORDRE DE MISSION",
};

function sentenceCase(text: string): string {
  if (!text) return text;
  const lower = text.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function normalizeProfession(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/**
 * Résout une profession (code historique ou nom de rôle utilisateur,
 * ex. « Huissier de justice », « Expert-comptable ») vers la clé de
 * template de mission correspondante. Repli : « autre ».
 */
export function resolveMissionTemplateKey(profession: string): string {
  const p = normalizeProfession(profession || "");
  if (!p) return "autre";
  if (MISSION_TEMPLATE_NOTES[p]) return p;

  if (p.includes("huissier") || p.includes("commissaire de justice")) return "huissier";
  if (p.includes("avocat")) return "avocat";
  if (p.includes("architecte")) return "architecte";
  if (p.includes("expert") || p.includes("comptable") || p.includes("commissaire aux comptes"))
    return "expert";
  if (p.includes("clerc") || p.includes("clec")) return "clerc";
  if (p.includes("conseiller") || p.includes("conseil") || p.includes("juridique"))
    return "conseiller";
  if (p === "autre") return "autre";

  return "autre";
}

export function getMissionTitle(profession: string): string {
  const title =
    MISSION_TITLES[resolveMissionTemplateKey(profession)] || MISSION_TITLES.autre;
  const dash = title.indexOf("–");
  if (dash === -1) return title;
  const prefix = title.slice(0, dash + 2);
  const rest = title.slice(dash + 2);
  return prefix + sentenceCase(rest);
}

export const MISSION_TEMPLATE_NOTES: Record<string, string> = {
  huissier: `<<<CABINET>>>
Cabinet mandant :
Nom : [Nom du cabinet]
Adresse : [Adresse complète]
Téléphone / Email : [Coordonnées]
N° SIRET : [Numéro]

<<<PROFESSIONNEL>>>
Professionnel mandaté
Nom / Raison sociale : [Nom de l’huissier ou de l’étude]
Qualité : Huissier de justice
Adresse professionnelle : [Adresse complète]
Téléphone / Email : [Coordonnées]
N° d’inscription à la chambre : [Numéro]

<<<BODY>>>
Client concerné : [Nom]  Téléphone : [Téléphone]

Destinataire : [Nom]  Téléphone : [Téléphone]




Motif de la mission :
[ ] Signification d’acte (assignation, commandement, jugement, etc.)
[ ] Constat (état des lieux, trouble de voisinage, livraison, etc.)
[ ] Saisie / recouvrement
[ ] Autre : [Préciser]

Description détaillée :
[Ex. : Signification d’une assignation devant le Tribunal judiciaire de … à l’encontre de M./Mme …]

Lieu(x) et durée
Lieu(x) d’intervention : [Adresse(s) précise(s)]
Date(s) prévue(s) : [JJ/MM/AAAA]


<<<SIGNATURES>>>
Signature
Fait à : [Ville] le [Date de signature]

<<<CABINET-SIGN>>>
Pour le cabinet mandant :
Nom / Fonction : [………]
Signature :

<<<PROFESSIONNEL-SIGN>>>
Pour l’huissier de justice :
Nom / Étude : [………]
Signature :`,

  avocat: `<<<CABINET>>>
Cabinet mandant :
Nom : [Nom du cabinet]
Adresse : [Adresse complète]
Téléphone / Email : [Coordonnées]
N° SIRET : [Numéro]

<<<PROFESSIONNEL>>>
Avocat mandaté
Maître : [Nom, Prénom]
Barreau : [Ville]
Adresse du cabinet : [Adresse complète]
Téléphone / Email : [Coordonnées]
N° d’inscription au tableau : [Numéro]

<<<BODY>>>
Client concerné : [Nom / Raison sociale – Adresse]


Nature de l’affaire :
[ ] Conseil juridique
[ ] Rédaction d’actes / contrats
[ ] Représentation en justice (préciser la juridiction : [………])
[ ] Négociation / transaction
[ ] Autre : [Préciser]

Description détaillée de la mission :
[Ex. : Assistance et représentation de M./Mme … dans le cadre d’un litige commercial devant le Tribunal de commerce de …]

Étendue et limites de la mission
La mission inclut :
[ ] Consultations écrites et orales
[ ] Rédaction des conclusions et pièces
[ ] Plaidoirie à l’audience du [………]

Sont exclus (sauf avenant) :
[ ] Appel / pourvoi en cassation
[ ] Recours devant une autre juridiction
[ ] Actes d’exécution post-jugement

Honoraires et modalités de paiement
Mode de rémunération :
[ ] Forfait global : [……… F HT]
[ ] Taux horaire : [……… F HT/heure]
[ ] Honoraires de résultat : […… %] (si autorisé)
[ ] Autre : [Préciser]

Provision initiale : [……… F]
Facturation : [ ] Mensuelle / [ ] Trimestrielle / [ ] À la fin de la mission
Délai de paiement : [30 jours / autre]

Frais et débours : Facturés en sus sur justificatifs (frais de greffe, huissier, déplacement, etc.)

Confidentialité et déontologie
L’avocat est tenu au secret professionnel (article 66-5 de la loi du 31 décembre 1971).
Il s’engage à respecter les règles déontologiques du barreau de [Ville].

<<<SIGNATURES>>>
Signature
Fait à : [Ville] le [Date de signature]

<<<CABINET-SIGN>>>
Pour le cabinet mandant :
Nom / Fonction : [………]
Signature :

<<<PROFESSIONNEL-SIGN>>>
Pour l’avocat :
Maître [Nom] – Barreau de [Ville]
Signature :`,

  architecte: `<<<CABINET>>>
Cabinet mandant :
Nom : [Nom du cabinet]
Adresse : [Adresse complète]
Téléphone / Email : [Coordonnées]
N° SIRET : [Numéro]

<<<PROFESSIONNEL>>>
Architecte mandaté
Nom / Raison sociale : [Nom de l’architecte ou de l’agence]
Qualité : Architecte DPLG / HMONP
Adresse professionnelle : [Adresse complète]
Téléphone / Email : [Coordonnées]
N° d’inscription à l’Ordre des architectes : [Numéro]
Assurance RC pro : [Compagnie – N° de police – Validité]

<<<BODY>>>
Projet concerné :
Nom / Référence : [Nom du projet]
Adresse du chantier : [Adresse complète]
Maître d’ouvrage : [Nom / Raison sociale]

Type de mission :
[ ] Études préliminaires (esquisse, APS, APD)
[ ] Permis de construire / autorisations administratives
[ ] Mission de maîtrise d’œuvre complète (DCE, DET, AOR)
[ ] Suivi de chantier / direction de l’exécution des travaux
[ ] Réception des travaux / levée des réserves
[ ] Autre : [Préciser]

Description détaillée :
[Ex. : Conception et suivi d’un projet de construction de … m² à usage de …]

Calendrier prévisionnel
Date de démarrage : [JJ/MM/AAAA]
Date de livraison prévue : [JJ/MM/AAAA]
Phases clés :
[ ] Esquisse : [Date]
[ ] Permis de construire : [Date]
[ ] DCE : [Date]
[ ] Réception : [Date]

Honoraires et modalités de paiement
Mode de rémunération :
[ ] Forfait global : [……… F HT]
[ ] Pourcentage du montant des travaux : […… %]
[ ] Taux journalier moyen (TJM) : [……… F HT/jour]
[ ] Autre : [Préciser]

Échéancier de paiement :
[ ] À la signature : […… %]
[ ] À l’obtention du permis : […… %]
[ ] À l’ouverture du chantier : […… %]
[ ] À la réception : […… %]

Frais remboursables :
[ ] Déplacements / frais de dossier / impressions – sur justificatifs

Délivrables attendus
[ ] Plans, coupes, façades, notices techniques
[ ] Dossier de demande de permis de construire complet
[ ] Dossier de consultation des entreprises (DCE)
[ ] PV de réunion de chantier, PV de réception

<<<SIGNATURES>>>
Signature
Fait à : [Ville] le [Date de signature]

<<<CABINET-SIGN>>>
Pour le cabinet mandant :
Nom / Fonction : [………]
Signature :

<<<PROFESSIONNEL-SIGN>>>
Pour l’architecte :
Nom / Agence : [………]
Signature :`,

  expert: `<<<CABINET>>>
Cabinet mandant :
Nom : [Nom du cabinet]
Adresse : [Adresse complète]
Téléphone / Email : [Coordonnées]
N° SIRET : [Numéro]

<<<PROFESSIONNEL>>>
Professionnel mandaté
Nom / Raison sociale : [Nom du cabinet d’expertise]
Qualité :
[ ] Expert-comptable inscrit à l’Ordre
[ ] Commissaire aux comptes (CAC) inscrit à la COB / CNCC
Adresse professionnelle : [Adresse complète]
Téléphone / Email : [Coordonnées]
N° d’inscription à l’Ordre / COB : [Numéro]
Assurance RC pro : [Compagnie – N° de police – Validité]

<<<BODY>>>
Client concerné :
Nom / Raison sociale : [Nom du client]
Adresse : [Adresse complète]
Forme juridique : [SARL, SA, SAS, etc.]
Exercice concerné : [Du … au …]

Type de mission :
[ ] Tenue de comptabilité
[ ] Établissement des comptes annuels et liasse fiscale
[ ] Audit légal / certification des comptes (CAC)
[ ] Mission d’expertise / évaluation
[ ] Conseil fiscal / social / juridique
[ ] Autre : [Préciser]

Description détaillée :
[Ex. : Certification des comptes annuels de l’exercice clos le … conformément aux normes d’exercice professionnel de la COB]

Étendue et limites de la mission
La mission inclut :
[ ] Examen des pièces comptables et rapprochements bancaires
[ ] Établissement du bilan, compte de résultat, annexe
[ ] Rédaction du rapport de certification

Sont exclus (sauf avenant) :
[ ] Commissariat aux comptes sur les comptes consolidés
[ ] Missions de conseil en organisation ou SI
[ ] Contentieux fiscal / social

Honoraires et modalités de paiement
Mode de rémunération :
[ ] Forfait annuel : [……… F HT]
[ ] Taux horaire : [……… F HT/heure]
[ ] Honoraires selon barème de l’Ordre
[ ] Autre : [Préciser]

Échéancier :
[ ] À la signature : […… %]
[ ] À mi-exercice : […… %]
[ ] À la remise des comptes : […… %]

Frais remboursables :
[ ] Déplacements / frais de dossier – sur justificatifs

Obligations déontologiques
L’expert-comptable / CAC s’engage à :
[ ] Respecter le Code de déontologie de l’Ordre des experts-comptables et les normes de la COB.
[ ] Garantir la confidentialité des informations.
[ ] Déclarer tout conflit d’intérêts.
[ ] Maintenir une assurance RC pro en cours de validité.

Délivrables attendus
[ ] Comptes annuels signés (bilan, compte de résultat, annexe)
[ ] Rapport de certification (pour CAC)
[ ] Liasse fiscale déposée
[ ] Note de synthèse / recommandations

Date limite de remise : [JJ/MM/AAAA]


<<<SIGNATURES>>>
Signature
Fait à : [Ville] le [Date de signature]

<<<CABINET-SIGN>>>
Pour le cabinet mandant :
Nom / Fonction : [………]
Signature :

<<<PROFESSIONNEL-SIGN>>>
Pour l’expert-comptable / CAC :
Nom / Cabinet : [………]
Signature :`,

  clerc: `<<<CABINET>>>
Cabinet mandant :
Nom : [Nom du cabinet]
Adresse : [Adresse complète]
Téléphone / Email : [Coordonnées]
N° SIRET : [Numéro]

<<<PROFESSIONNEL>>>
Professionnel mandaté
Nom / Raison sociale : [Nom du conseil / cabinet]
Qualité : CLEC / Conseil en [Préciser le domaine]
Adresse professionnelle : [Adresse complète]
Téléphone / Email : [Coordonnées]
N° d’immatriculation / certification (si applicable) : [Numéro]
Assurance RC pro : [Compagnie – N° de police – Validité]

<<<BODY>>>
Bénéficiaire / Client concerné :
Nom / Raison sociale : [Nom]
Adresse : [Adresse complète]

Motif de la mission :
[ ] Accompagnement social / insertion
[ ] Conseil juridique / administratif
[ ] Audit / diagnostic organisationnel
[ ] Formation / renforcement de capacités
[ ] Autre : [Préciser]

Description détaillée :
[Ex. : Accompagnement de M./Mme … dans ses démarches d’accès au logement et à l’emploi]

Lieu(x) et durée
Lieu(x) d’intervention : [Adresse(s)]
Date de début : [JJ/MM/AAAA]
Date de fin prévue : [JJ/MM/AAAA]
Nombre de jours/heures estimés : [………]

Prestations attendues
[ ] Entretiens individuels / collectifs
[ ] Rédaction de rapports / notes de synthèse
[ ] Animation d’ateliers / formations
[ ] Suivi périodique et points d’étape

Livrables :
[ ] Rapport final d’accompagnement
[ ] Plan d’action personnalisé
[ ] Attestation de réalisation

Date limite de remise : [JJ/MM/AAAA]


Honoraires et modalités de paiement
Mode de rémunération :
[ ] Forfait global : [……… F HT]
[ ] TJM : [……… F HT/jour]
[ ] Prise en charge par financeur (préciser : [………])
[ ] Autre : [Préciser]

Échéancier :
[ ] À la signature : […… %]
[ ] À mi-parcours : […… %]
[ ] À la fin de la mission : […… %]

Frais remboursables :
[ ] Déplacements / hébergement / repas – sur justificatifs et dans la limite de […… F]

Confidentialité et éthique
Le conseil s’engage à :
[ ] Respecter les règles déontologiques de sa profession.
[ ] Garantir la confidentialité des informations personnelles et sensibles.
[ ] Agir dans le respect des principes d’éthique, de neutralité et de bienveillance.

<<<SIGNATURES>>>
Signature
Fait à : [Ville] le [Date de signature]

<<<CABINET-SIGN>>>
Pour le cabinet mandant :
Nom / Fonction : [………]
Signature :

<<<PROFESSIONNEL-SIGN>>>
Pour le conseil / CLEC :
Nom / Structure : [………]
Signature :`,

  conseiller: `<<<CABINET>>>
Cabinet mandant :
Nom : [Nom du cabinet]
Adresse : [Adresse complète]
Téléphone / Email : [Coordonnées]
N° SIRET : [Numéro]

<<<PROFESSIONNEL>>>
Conseiller mandaté
Nom / Raison sociale : [Nom du conseiller]
Qualité : Conseiller juridique
Adresse professionnelle : [Adresse complète]
Téléphone / Email : [Coordonnées]
N° d’inscription (si applicable) : [Numéro]

<<<BODY>>>
Client concerné : [Nom / Raison sociale – Adresse]


Nature de la mission :
[ ] Conseil juridique
[ ] Rédaction d’actes / contrats
[ ] Audit juridique
[ ] Négociation / transaction
[ ] Autre : [Préciser]

Description détaillée :
[Ex. : Analyse et rédaction d’un contrat de prestation de services entre … et …]

Lieu(x) et durée
Lieu(x) d’intervention : [Adresse(s)]
Date de début : [JJ/MM/AAAA]
Date de fin prévue : [JJ/MM/AAAA]

Honoraires et modalités de paiement
Mode de rémunération :
[ ] Forfait global : [……… F HT]
[ ] Taux horaire : [……… F HT/heure]
[ ] Autre : [Préciser]

Échéancier :
[ ] À la signature : […… %]
[ ] À mi-parcours : […… %]
[ ] À la fin de la mission : […… %]

Frais remboursables :
[ ] Déplacements / frais de dossier – sur justificatifs

<<<SIGNATURES>>>
Signature
Fait à : [Ville] le [Date de signature]

<<<CABINET-SIGN>>>
Pour le cabinet mandant :
Nom / Fonction : [………]
Signature :

<<<PROFESSIONNEL-SIGN>>>
Pour le conseiller :
Nom / Structure : [………]
Signature :`,

  autre: `<<<CABINET>>>
Cabinet mandant :
Nom : [Nom du cabinet]
Adresse : [Adresse complète]
Téléphone / Email : [Coordonnées]
N° SIRET : [Numéro]

<<<PROFESSIONNEL>>>
Prestataire mandaté
Nom / Raison sociale : [Nom du prestataire]
Qualité : [Préciser]
Adresse professionnelle : [Adresse complète]
Téléphone / Email : [Coordonnées]
N° d’inscription (si applicable) : [Numéro]

<<<BODY>>>
Client concerné : [Nom / Raison sociale – Adresse]


Description détaillée :
[………]

Lieu(x) et durée
Lieu(x) d’intervention : [Adresse(s)]
Date de début : [JJ/MM/AAAA]
Date de fin prévue : [JJ/MM/AAAA]

Honoraires et modalités de paiement
Mode de rémunération : [……… F HT / taux horaire / forfait]
Échéancier : [………]

Frais remboursables : [………]

Délivrables attendus : [………]
Date limite de remise : [JJ/MM/AAAA]


<<<SIGNATURES>>>
Signature
Fait à : [Ville] le [Date de signature]

<<<CABINET-SIGN>>>
Pour le cabinet mandant :
Nom / Fonction : [………]
Signature :

<<<PROFESSIONNEL-SIGN>>>
Pour le prestataire :
Nom / Structure : [………]
Signature :`,
};

export function getMissionTemplateNotes(profession: string): string {
  return (
    MISSION_TEMPLATE_NOTES[resolveMissionTemplateKey(profession)] ||
    MISSION_TEMPLATE_NOTES.autre
  );
}
