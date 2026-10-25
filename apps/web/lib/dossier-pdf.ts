import { generateReportPdf, type CabinetInfo, type PdfThemeConfig, type ReportBlock } from "./pdf-generator";

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR");
}

function fmtMoney(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n) + " FCFA";
}

function safeString(value: unknown): string {
  if (value === null || value === undefined) return "—";
  return String(value);
}

const TACHE_STATUT_COLORS: Record<string, string> = {
  "À faire": "#4b5563",
  "En cours": "#1e40af",
  "Terminée": "#047857",
  "Annulée": "#b91c1c",
};

const MISSION_STATUT_COLORS: Record<string, string> = {
  "En préparation": "#4b5563",
  "Tentée": "#b45309",
  "Remise": "#047857",
  "Annulée": "#b91c1c",
  "Échouée": "#b91c1c",
};

const DOCUMENT_STATUT_COLORS: Record<string, string> = {
  "Publié client": "#047857",
  "Partagé": "#1d4ed8",
  "Interne": "#4b5563",
};

const EVENT_TYPE_COLORS: Record<string, string> = {
  audience: "#2c4c7c",
  echeance: "#b45309",
  rdv: "#1d4ed8",
  signification: "#7e22ce",
  deadline: "#b91c1c",
};

export interface DossierGlobalPdfData {
  reference: string;
  typeAffaireLabel: string;
  naturesMission: string[];
  dateOuverture: Date;
  statut: string;
  echeance: Date | null;
  client: { raisonSociale: string; adresse?: string | null; identifiant?: string | null };
  avocat: string;
  huissier?: string | null;
  partiesAdverses: { nom?: string; prenom?: string; raisonSociale?: string; qualite?: string }[];
  collaborateurs: { nom: string; roleRACI: string; discipline?: string | null; tacheAttendue: string[] }[];
  evenements: { date: Date; type: string; titre: string; lieu?: string | null; statut?: string }[];
  taches: { titre: string; statut: string; priorite: string; echeance: Date | null; responsable: string }[];
  missions: { type: string; discipline: string; statut: string; datePrevue: Date | null; destinataire?: string | null }[];
  commentaires: { auteur: string; date: Date; message: string }[];
  documents: { nom: string; categorie: string; date: Date; statut?: string }[];
  typesDocumentsAttendus: { code: string; libelle: string; obligatoire: boolean; recus: number }[];
  tacheTemplates: { titre: string; statut: string }[];
  factures: { numero: string; date: Date; totalTtc: number; statut: string }[];
  paiements: { date: Date; montant: number; mode: string; reference?: string; facture: string }[];
  conflits: { reference: string; type: string; statut: string }[];
}

function emptyTable(label: string): ReportBlock[] {
  return [
    { type: "sectionTitle", text: label },
    { type: "paragraph", text: "Aucun élément pour cette rubrique." },
    { type: "spacer", height: 12 },
  ];
}

function sectionOrEmpty(label: string, blocks: ReportBlock[], fallback = true): ReportBlock[] {
  if (!fallback || blocks.length > 0) return [{ type: "section", title: label, blocks }];
  return [
    { type: "sectionTitle", text: label },
    { type: "paragraph", text: "Aucun élément pour cette rubrique." },
    { type: "spacer", height: 12 },
  ];
}

export function buildDossierGlobalBlocks(data: DossierGlobalPdfData): ReportBlock[] {
  const blocks: ReportBlock[] = [];

  // En-tête identité
  blocks.push({
    type: "stats",
    items: [
      { label: "Statut", value: data.statut, color: "primary" },
      { label: "Ouvert le", value: fmtDate(data.dateOuverture), color: "gray" },
      { label: "Échéance", value: data.echeance ? fmtDate(data.echeance) : "—", color: "gray" },
    ],
  });
  blocks.push({ type: "spacer", height: 8 });

  // Informations générales
  const generalRows = [
    ["Référence", data.reference],
    ["Type d'affaire", data.typeAffaireLabel],
    ["Natures de mission", data.naturesMission.join(", ") || "—"],
    ["Client", data.client.raisonSociale],
    ["Avocat responsable", data.avocat],
    ["Huissier responsable", data.huissier || "—"],
  ];
  blocks.push({
    type: "table",
    table: {
      columns: [{ label: "Champ" }, { label: "Valeur" }],
      rows: generalRows.map((cells) => ({ cells, style: "normal" })),
    },
  });
  blocks.push({ type: "spacer", height: 8 });

  // Documents de départ
  if (data.typesDocumentsAttendus.length === 0) {
    blocks.push(...emptyTable("Documents de départ"));
  } else {
    blocks.push({
      type: "table",
      table: {
        columns: [
          { label: "Document de départ" },
          { label: "Obligatoire" },
          { label: "Statut" },
          { label: "Reçus" },
        ],
        rows: data.typesDocumentsAttendus.map((t) => ({
          cells: [
            t.libelle,
            t.obligatoire ? "Oui" : "Non",
            t.recus > 0 ? "Reçu" : "Manquant",
            String(t.recus),
          ],
          style: t.obligatoire && t.recus === 0 ? "bold" : "normal",
        })),
      },
    });
    blocks.push({ type: "spacer", height: 12 });
  }

  // Tâches liées au dossier
  if (data.tacheTemplates.length === 0) {
    blocks.push(...emptyTable("Tâches liées au dossier"));
  } else {
    blocks.push({
      type: "table",
      table: {
        columns: [
          { label: "Tâche liée au dossier" },
          { label: "Statut" },
        ],
        rows: data.tacheTemplates.map((t) => ({
          cells: [t.titre, t.statut],
          style: t.statut === "Générée" ? "normal" : "bold",
        })),
      },
    });
    blocks.push({ type: "spacer", height: 12 });
  }

  // Parties adverses
  if (data.partiesAdverses.length > 0) {
    const adverses = data.partiesAdverses.map((p) => {
      const nom = p.raisonSociale || `${p.prenom || ""} ${p.nom || ""}`.trim() || "Partie";
      return [nom, p.qualite || "—"];
    });
    blocks.push({
      type: "table",
      table: {
        columns: [{ label: "Partie adverse" }, { label: "Qualité" }],
        rows: adverses.map((cells) => ({ cells })),
      },
    });
    blocks.push({ type: "spacer", height: 8 });
  }

  // Matrice RACI
  if (data.collaborateurs.length === 0) {
    blocks.push(...emptyTable("Matrice RACI"));
  } else {
    blocks.push({
      type: "table",
      table: {
        columns: [
          { label: "Intervenant" },
          { label: "Rôle" },
          { label: "Discipline" },
          { label: "Tâches attendues" },
        ],
        rows: data.collaborateurs.map((c) => ({
          cells: [
            c.nom,
            c.roleRACI,
            c.discipline || "—",
            c.tacheAttendue.join(", ") || "—",
          ],
        })),
      },
    });
    blocks.push({ type: "spacer", height: 8 });
  }

  // Tâches
  if (data.taches.length === 0) {
    blocks.push(...emptyTable("Tâches"));
  } else {
    blocks.push({
      type: "table",
      table: {
        columns: [
          { label: "Tâche", weight: 40 },
          { label: "Responsable", weight: 15 },
          { label: "Échéance", weight: 15 },
          { label: "Statut", weight: 15 },
          { label: "Priorité", weight: 15 },
        ],
        rows: data.taches.map((t) => ({
          cells: [t.titre, t.responsable, fmtDate(t.echeance), t.statut, t.priorite],
          cellColors: [undefined, undefined, undefined, TACHE_STATUT_COLORS[t.statut], undefined],
        })),
      },
    });
    blocks.push({ type: "spacer", height: 12 });
  }

  // Événements
  if (data.evenements.length === 0) {
    blocks.push(...emptyTable("Rendez-vous et événements"));
  } else {
    blocks.push({
      type: "table",
      table: {
        columns: [
          { label: "Date" },
          { label: "Type" },
          { label: "Titre" },
          { label: "Lieu" },
        ],
        rows: data.evenements.map((e) => ({
          cells: [fmtDate(e.date), e.type, e.titre, e.lieu || "—"],
          cellColors: [undefined, EVENT_TYPE_COLORS[e.type], undefined, undefined],
        })),
      },
    });
    blocks.push({ type: "spacer", height: 12 });
  }

  // Missions
  if (data.missions.length === 0) {
    blocks.push(...emptyTable("Missions"));
  } else {
    blocks.push({
      type: "table",
      table: {
        columns: [
          { label: "Type" },
          { label: "Discipline" },
          { label: "Date prévue" },
          { label: "Destinataire" },
          { label: "Statut" },
        ],
        rows: data.missions.map((m) => ({
          cells: [m.type, m.discipline, fmtDate(m.datePrevue), m.destinataire || "—", m.statut],
          cellColors: [undefined, undefined, undefined, undefined, MISSION_STATUT_COLORS[m.statut]],
        })),
      },
    });
    blocks.push({ type: "spacer", height: 12 });
  }

  // Commentaires
  if (data.commentaires.length === 0) {
    blocks.push(...emptyTable("Commentaires"));
  } else {
    const commentBlocks: ReportBlock[] = data.commentaires.map((c) => ({
      type: "paragraph",
      text: `${c.auteur} — ${fmtDate(c.date)}\n${c.message}`,
      keepTogether: true,
    }));
    blocks.push({ type: "section", title: "Commentaires", blocks: commentBlocks });
  }

  // Documents
  if (data.documents.length === 0) {
    blocks.push(...emptyTable("Documents"));
  } else {
    blocks.push({
      type: "table",
      table: {
        columns: [
          { label: "Document", weight: 40 },
          { label: "Catégorie", weight: 20 },
          { label: "Date", weight: 20 },
          { label: "Statut", weight: 20 },
        ],
        rows: data.documents.map((d) => ({
          cells: [d.nom, d.categorie, fmtDate(d.date), d.statut || "—"],
          cellColors: [undefined, undefined, undefined, DOCUMENT_STATUT_COLORS[d.statut || "—"]],
        })),
      },
    });
    blocks.push({ type: "spacer", height: 12 });
  }

  // Factures
  if (data.factures.length > 0) {
    blocks.push({
      type: "table",
      table: {
        columns: [
          { label: "N°" },
          { label: "Date" },
          { label: "Montant TTC" },
          { label: "Statut" },
        ],
        rows: data.factures.map((f) => ({
          cells: [f.numero, fmtDate(f.date), fmtMoney(f.totalTtc), f.statut],
        })),
      },
    });
    blocks.push({ type: "spacer", height: 12 });
  }

  // Paiements (toujours affichée, même si vide)
  if (data.paiements.length === 0) {
    blocks.push(...emptyTable("Paiements"));
  } else {
    blocks.push({
      type: "table",
      table: {
        columns: [
          { label: "Date" },
          { label: "Montant" },
          { label: "Mode" },
          { label: "Référence" },
          { label: "Facture" },
        ],
        rows: data.paiements.map((p) => ({
          cells: [
            fmtDate(p.date),
            fmtMoney(p.montant),
            p.mode,
            p.reference || "—",
            p.facture,
          ],
        })),
      },
    });
    blocks.push({ type: "spacer", height: 12 });
  }

  // Conflits d'intérêts
  if (data.conflits.length > 0) {
    blocks.push({
      type: "table",
      table: {
        columns: [
          { label: "Dossier en conflit" },
          { label: "Type" },
          { label: "Statut" },
        ],
        rows: data.conflits.map((c) => ({
          cells: [c.reference, c.type, c.statut],
        })),
      },
    });
  }

  return blocks;
}

export async function generateDossierGlobalPdf(
  data: DossierGlobalPdfData,
  cabinet: CabinetInfo,
  theme: PdfThemeConfig
): Promise<Uint8Array> {
  const blocks = buildDossierGlobalBlocks(data);
  return generateReportPdf(
    `Rapport dossier : ${data.reference}`,
    undefined,
    blocks,
    cabinet,
    theme
  );
}
