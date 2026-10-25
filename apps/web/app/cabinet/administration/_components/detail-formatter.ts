/**
 * Fonctions partagées pour l'affichage des sections Détail dans l'administration.
 * Traduction des clés en français, formatage des dates/heures, remplacement des IDs par les noms.
 */

export interface DetailFormatterContext {
  employees?: Array<{ id: string; firstName: string; lastName: string }>;
  clients?: Array<{ id: string; raisonSociale: string }>;
  users?: Array<{ id: string; prenom: string; nom: string }>;
  dossiers?: Array<{ id: string; referenceInterne: string }>;
}

// Traduction des clés du détail en français
export const DETAIL_LABELS: Record<string, string> = {
  id: "Identifiant",
  type: "Type",
  subject: "Sujet",
  description: "Description",
  status: "Statut",
  clientId: "Client",
  requesterName: "Demandeur",
  requesterPhone: "Téléphone",
  requesterEmail: "Email",
  requestDate: "Date de demande",
  responseStatus: "Statut de réponse",
  responseDate: "Date de réponse",
  responseDetail: "Détail de réponse",
  createdAt: "Créé le",
  createdBy: "Créé par",
  updatedAt: "Modifié le",
  direction: "Direction",
  callDate: "Date de début",
  endDate: "Date de fin",
  channel: "Canal",
  contactName: "Contact",
  structure: "Structure",
  notes: "Notes",
  employeeId: "Interlocuteur interne",
  dossierId: "Dossier",
  statut: "Statut",
  dateEnvoi: "Date d'envoi",
  dateReception: "Date de réception",
  dateEcheance: "Date d'échéance",
  dateRelance: "Date de relance",
  dateAudience: "Date d'audience",
  heureAudience: "Heure d'audience",
  lieu: "Lieu",
  tribunal: "Tribunal",
  reference: "Référence",
  numeroAffaire: "Numéro d'affaire",
  partieAdverse: "Partie adverse",
  natureMission: "Nature de la mission",
  destinataire: "Destinataire",
  adresse: "Adresse",
  typeCourrier: "Type de courrier",
  contenu: "Contenu",
  expediteur: "Expéditeur",
  typeMission: "Type de mission",
  prestataire: "Prestataire",
  montant: "Montant",
  monnaie: "Devise",
  facture: "Facture",
  dateFacture: "Date de facture",
  dateDebut: "Date de début",
  dateFin: "Date de fin",
  duree: "Durée",
  motif: "Motif",
  observation: "Observation",
  priorite: "Priorité",
  rappel: "Rappel",
  envoye: "Envoyé",
  recu: "Reçu",
  archive: "Archivé",
  fichier: "Fichier",
  signature: "Signature",
  approuvePar: "Approuvé par",
  dateApprobation: "Date d'approbation",
  signataireId: "Signataire",
  mailDate: "Date du courrier",
  body: "Corps",
  dossierLabel: "Dossier (étiquette)",
};

// Types d'options pour les champs à traduire
interface SelectOption {
  value: string;
  label: string;
}

const REQUEST_TYPES: SelectOption[] = [
  { value: "info", label: "Information" },
  { value: "dossier", label: "Dossier" },
  { value: "rendezvous", label: "Rendez-vous" },
  { value: "document", label: "Document" },
  { value: "autre", label: "Autre" },
];

const CALL_CHANNELS: SelectOption[] = [
  { value: "telephone", label: "Téléphone" },
  { value: "visioconference", label: "Visioconférence" },
  { value: "autre", label: "Autre" },
];

const DIRECTIONS: SelectOption[] = [
  { value: "entrant", label: "Entrant" },
  { value: "sortant", label: "Sortant" },
];

const RESPONSE_STATUSES: SelectOption[] = [
  { value: "en_attente", label: "En attente" },
  { value: "repondu", label: "Réponse donnée" },
];

/**
 * Formate une valeur pour l'affichage dans le détail :
 * - Dates/heures ISO → format français
 * - IDs → noms (client, employé, utilisateur, dossier)
 * - Valeurs statiques → traductions françaises
 */
export function formatDetailValue(
  key: string,
  value: unknown,
  ctx: DetailFormatterContext = {}
): string {
  if (value == null) return "—";
  const str = String(value);

  // Dates et heures ISO → format français
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(str)) {
    return new Date(str).toLocaleString("fr-FR");
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return new Date(str).toLocaleDateString("fr-FR");
  }

  // Remplacement des IDs par les noms
  if (key === "clientId" && ctx.clients) {
    const c = ctx.clients.find((x) => x.id === str);
    return c ? c.raisonSociale : str;
  }
  if (key === "employeeId" && ctx.employees) {
    const e = ctx.employees.find((x) => x.id === str);
    return e ? `${e.firstName} ${e.lastName}` : str;
  }
  if (key === "createdBy" && ctx.users) {
    const u = ctx.users.find((x) => x.id === str);
    return u ? `${u.prenom} ${u.nom}` : str;
  }
  if (key === "approuvePar" && ctx.users) {
    const u = ctx.users.find((x) => x.id === str);
    return u ? `${u.prenom} ${u.nom}` : str;
  }
  if (key === "signataireId" && ctx.users) {
    const u = ctx.users.find((x) => x.id === str);
    return u ? `${u.prenom} ${u.nom}` : str;
  }
  if (key === "dossierId" && ctx.dossiers) {
    const d = ctx.dossiers.find((x) => x.id === str);
    return d ? d.referenceInterne : str;
  }

  // Traduction des valeurs connues
  if (key === "type") {
    return REQUEST_TYPES.find((t) => t.value === str)?.label || str;
  }
  if (key === "direction") {
    return DIRECTIONS.find((d) => d.value === str)?.label || str;
  }
  if (key === "channel") {
    return CALL_CHANNELS.find((c) => c.value === str)?.label || str;
  }
  if (key === "responseStatus") {
    return RESPONSE_STATUSES.find((r) => r.value === str)?.label || str;
  }
  if (key === "statut" || key === "status") {
    // Statuts communs
    const statutMap: Record<string, string> = {
      pending: "En attente",
      en_attente: "En attente",
      in_progress: "En cours",
      en_cours: "En cours",
      completed: "Terminé",
      termine: "Terminé",
      cancelled: "Annulé",
      annule: "Annulé",
      draft: "Brouillon",
      brouillon: "Brouillon",
      approved: "Approuvé",
      approuve: "Approuvé",
      rejected: "Rejeté",
      rejete: "Rejeté",
      sent: "Envoyé",
      envoye: "Envoyé",
      received: "Reçu",
      recu: "Reçu",
      archived: "Archivé",
      archive: "Archivé",
    };
    return statutMap[str.toLowerCase()] || str;
  }
  if (key === "priorite" || key === "priority") {
    const prioriteMap: Record<string, string> = {
      low: "Basse",
      basse: "Basse",
      medium: "Moyenne",
      moyenne: "Moyenne",
      high: "Haute",
      haute: "Haute",
      urgent: "Urgent",
    };
    return prioriteMap[str.toLowerCase()] || str;
  }

  return str;
}
