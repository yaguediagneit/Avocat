"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  DEMARCHE_STATUT_LABELS,
  DEMARCHE_STATUT_BADGES,
  DEMARCHE_TRANSITIONS,
  PIECE_CATEGORIES,
  PIECE_NIVEAUX,
  PIECE_SOURCES,
  PIECE_STATUTS,
  PIECE_STATUTS_COUVRANT,
  STATUTS_ATTENTE_ADMIN,
  EVENEMENT_TYPES,
  FRAIS_NATURES,
  piecesObligatoiresManquantes,
  qualificationComplete,
} from "@/lib/demarches";
import { extractTemplateVariables } from "@/lib/document-template";

const inputCls = "input";
const labelCls = "mb-1 block text-xs font-medium text-gray-600";

function fmt(d?: string | null) {
  return d ? new Date(d).toLocaleDateString("fr-FR") : "—";
}
function demandeurLabel(d: any) {
  if (!d) return "—";
  return d.typePersonne === "MORALE"
    ? d.raisonSociale || d.nom
    : [d.civilite, d.prenoms, d.nom].filter(Boolean).join(" ") || d.nom;
}
function parcelleLabel(p: any) {
  if (!p) return "—";
  return [
    [p.adresse, p.quartier, p.commune].filter(Boolean).join(", "),
    p.nicad && `NICAD ${p.nicad}`,
    p.titreFoncier && `TF ${p.titreFoncier}`,
  ]
    .filter(Boolean)
    .join(" — ");
}
const PIECE_STATUT_COLORS: Record<string, string> = {
  NON_DEMANDEE: "bg-gray-100 text-gray-600",
  DEMANDEE: "bg-amber-100 text-amber-700",
  RECUE: "bg-blue-100 text-blue-700",
  ILLISIBLE: "bg-orange-100 text-orange-700",
  EXPIREE: "bg-red-100 text-red-700",
  VALIDEE: "bg-emerald-100 text-emerald-700",
  NON_APPLICABLE: "bg-gray-200 text-gray-500",
  REJETEE: "bg-red-100 text-red-800",
};

export function DemarcheDetailClient({
  demarche: initial,
  documents,
  modeles,
  autorites,
  demandeurs,
  parcelles,
  users,
  userNames,
  canWrite,
  canValidate,
  valideParNom,
}: {
  demarche: any;
  documents: any[];
  modeles: any[];
  autorites: any[];
  demandeurs: any[];
  parcelles: any[];
  users: any[];
  userNames: Record<string, string>;
  canWrite: boolean;
  canValidate: boolean;
  valideParNom: string | null;
}) {
  const router = useRouter();
  const [d, setD] = useState<any>(initial);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // --- Qualification / édition ---
  const [editOpen, setEditOpen] = useState(false);
  const [edit, setEdit] = useState({
    sousType: d.sousType || "",
    objet: d.objet || "",
    finalite: d.finalite || "",
    fondement: d.fondement || "",
    referenceActes: d.referenceActes || "",
    autoriteId: d.autoriteId || "",
    autoriteLibre: d.autoriteLibre || "",
    demandeurId: d.demandeurId || "",
    mandataireId: d.mandataireId || "",
    parcelleId: d.parcelleId || "",
    dateLimite: d.dateLimite ? String(d.dateLimite).slice(0, 10) : "",
    priorite: d.priorite || "NORMALE",
    urgent: !!d.urgent,
    responsableId: d.responsableId || "",
    assistanteId: d.assistanteId || "",
    agentLiaisonId: d.agentLiaisonId || "",
    noteRecevabilite: d.noteRecevabilite || "",
  });

  // --- Transition ---
  const [cible, setCible] = useState("");
  const [depot, setDepot] = useState({
    dateDepot: new Date().toISOString().slice(0, 10),
    deposePar: "",
    canalDepot: "physique",
    numeroRecepisse: "",
  });
  const [decision, setDecision] = useState({
    decisionDate: new Date().toISOString().slice(0, 10),
    decisionNotes: "",
    motifRejet: "",
    voieRecours: "",
    recoursEcheance: "",
    documentDelivreId: "",
    remisAuClientLe: "",
  });
  const [derogationMotif, setDerogationMotif] = useState("");
  const [noteTransition, setNoteTransition] = useState("");

  // --- Pièce ---
  const [newPiece, setNewPiece] = useState({
    code: "", libelle: "", categorie: "PIECE_CLIENT", niveau: "OBLIGATOIRE",
    condition: "", sourceAttendue: "CLIENT",
  });
  const [derogationPiece, setDerogationPiece] = useState<{ id: string; libelle: string } | null>(null);
  const [derogationPieceMotif, setDerogationPieceMotif] = useState("");

  // --- Documents ---
  const [modeleId, setModeleId] = useState("");
  const [modeleVars, setModeleVars] = useState<Record<string, string>>({});
  const [publieClient, setPublieClient] = useState(false);
  const [genBusy, setGenBusy] = useState(false);

  // --- Événements ---
  const [evt, setEvt] = useState({ type: "NOTE", description: "", date: "" });

  // --- Frais ---
  const [frais, setFrais] = useState({ nature: "DEBOURS", libelle: "", montant: "", quittance: "" });

  const transitions = DEMARCHE_TRANSITIONS[d.statut] || [];
  const manquantes = useMemo(
    () => piecesObligatoiresManquantes(d.pieces, d.derogations),
    [d.pieces, d.derogations]
  );
  const qualif = qualificationComplete(d, d.type);
  const piecesDocDelivre = documents;

  async function call(url: string, method: string, payload?: any) {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: payload ? JSON.stringify(payload) : undefined,
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(typeof j.error === "string" ? j.error : "Erreur");
    }
    return res.json();
  }

  async function saveEdit() {
    setBusy(true);
    setError("");
    try {
      const updated = await call(`/api/demarches/${d.id}`, "PATCH", {
        ...edit,
        autoriteId: edit.autoriteId || null,
        demandeurId: edit.demandeurId || null,
        mandataireId: edit.mandataireId || null,
        parcelleId: edit.parcelleId || null,
        dateLimite: edit.dateLimite || null,
        responsableId: edit.responsableId || null,
        assistanteId: edit.assistanteId || null,
        agentLiaisonId: edit.agentLiaisonId || null,
      });
      setD({ ...d, ...updated });
      setEditOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    }
    setBusy(false);
  }

  async function doTransition(statut: string) {
    setBusy(true);
    setError("");
    try {
      const payload: any = { statut, note: noteTransition || null };
      if (statut === "DEPOSE") {
        payload.dateDepot = depot.dateDepot;
        payload.deposePar = depot.deposePar;
        payload.canalDepot = depot.canalDepot;
        payload.numeroRecepisse = depot.numeroRecepisse || null;
      }
      if (["ACCEPTE", "REFUSE", "CLASSE_SANS_SUITE"].includes(statut)) {
        payload.decisionDate = decision.decisionDate;
        payload.decisionType = statut === "ACCEPTE" ? "ACCEPTE" : statut === "REFUSE" ? "REFUSE" : "CLASSE_SANS_SUITE";
        payload.decisionNotes = decision.decisionNotes || null;
        payload.motifRejet = decision.motifRejet || null;
        payload.voieRecours = decision.voieRecours || null;
        payload.recoursEcheance = decision.recoursEcheance || null;
      }
      if (statut === "DOCUMENT_DELIVRE") {
        payload.documentDelivreId = decision.documentDelivreId || null;
        payload.remisAuClientLe = decision.remisAuClientLe || null;
      }
      if (statut === "PRET_VALIDATION" && derogationMotif.trim()) {
        payload.derogationMotif = derogationMotif;
      }
      const updated = await call(`/api/demarches/${d.id}/transition`, "POST", payload);
      setD({ ...d, ...updated });
      setCible("");
      setDerogationMotif("");
      setNoteTransition("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    }
    setBusy(false);
  }

  async function updatePiece(pieceId: string, patch: any) {
    try {
      const updated = await call(`/api/demarches/${d.id}/pieces/${pieceId}`, "PATCH", patch);
      setD({ ...d, pieces: d.pieces.map((p: any) => (p.id === pieceId ? { ...p, ...updated } : p)) });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    }
  }

  async function addPiece() {
    if (!newPiece.code.trim() || !newPiece.libelle.trim()) return;
    try {
      const p = await call(`/api/demarches/${d.id}/pieces`, "POST", newPiece);
      setD({ ...d, pieces: [...d.pieces, p] });
      setNewPiece({ code: "", libelle: "", categorie: "PIECE_CLIENT", niveau: "OBLIGATOIRE", condition: "", sourceAttendue: "CLIENT" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    }
  }

  async function removePiece(pieceId: string) {
    if (!confirm("Retirer cette pièce de la check-list ?")) return;
    const res = await fetch(`/api/demarches/${d.id}/pieces/${pieceId}`, { method: "DELETE" });
    if (res.ok) setD({ ...d, pieces: d.pieces.filter((p: any) => p.id !== pieceId) });
  }

  async function addDerogation() {
    if (!derogationPiece || !derogationPieceMotif.trim()) return;
    try {
      const updated = await call(`/api/demarches/${d.id}`, "PATCH", {
        derogation: { pieceId: derogationPiece.id, motif: derogationPieceMotif.trim() },
      });
      setD({ ...d, derogations: updated.derogations });
      setDerogationPiece(null);
      setDerogationPieceMotif("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    }
  }

  async function addEvent() {
    if (!evt.description.trim()) return;
    try {
      const created = await call(`/api/demarches/${d.id}/evenements`, "POST", {
        type: evt.type,
        description: evt.description,
        date: evt.date || null,
      });
      setD({ ...d, evenements: [created, ...d.evenements] });
      setEvt({ type: "NOTE", description: "", date: "" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    }
  }

  async function addFrais() {
    if (!frais.libelle.trim() || !frais.montant) return;
    try {
      const created = await call(`/api/demarches/${d.id}/frais`, "POST", {
        nature: frais.nature,
        libelle: frais.libelle,
        montant: parseInt(frais.montant, 10),
        quittance: frais.quittance || null,
      });
      setD({ ...d, frais: [created, ...d.frais] });
      setFrais({ nature: "DEBOURS", libelle: "", montant: "", quittance: "" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    }
  }

  async function toggleRapproche(f: any) {
    try {
      const updated = await call(`/api/demarches/${d.id}/frais/${f.id}`, "PATCH", { rapproche: !f.rapproche });
      setD({ ...d, frais: d.frais.map((x: any) => (x.id === f.id ? { ...x, ...updated } : x)) });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    }
  }

  async function valider() {
    setBusy(true);
    setError("");
    try {
      const updated = await call(`/api/demarches/${d.id}`, "PATCH", { valider: true });
      setD({ ...d, ...updated });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    }
    setBusy(false);
  }

  async function genererPdf() {
    if (!modeleId) return;
    setGenBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/demarches/${d.id}/pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modeleId, variables: modeleVars, publieClient }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(typeof j.error === "string" ? j.error : "Erreur de génération");
      }
      const blob = await res.blob();
      window.open(URL.createObjectURL(blob), "_blank");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    }
    setGenBusy(false);
  }

  const modeleSel = modeles.find((m) => m.id === modeleId);
  const modeleVariables = useMemo(
    () => (modeleSel?.contenu ? extractTemplateVariables(modeleSel.contenu) : []),
    [modeleSel]
  );
  const evtTypeLabel = (c: string) => EVENEMENT_TYPES.find((e) => e.code === c)?.label || c;
  const fraisNatureLabel = (c: string) => FRAIS_NATURES.find((f) => f.code === c)?.label || c;
  const pieceCategorieLabel = (c: string) => PIECE_CATEGORIES.find((x) => x.code === c)?.label || c;
  const pieceNiveauLabel = (c: string) => PIECE_NIVEAUX.find((x) => x.code === c)?.label || c;
  const pieceSourceLabel = (c: string) => PIECE_SOURCES.find((x) => x.code === c)?.label || c;
  const pieceStatutLabel = (c: string) => PIECE_STATUTS.find((x) => x.code === c)?.label || c;

  const besoinChampDepot = cible === "DEPOSE";
  const besoinChampDecision = ["ACCEPTE", "REFUSE", "CLASSE_SANS_SUITE"].includes(cible);
  const besoinDocDelivre = cible === "DOCUMENT_DELIVRE";

  /* ---------- Vue d'ensemble : pièces groupées par catégorie ---------- */
  const piecesParCategorie = PIECE_CATEGORIES.map((cat) => {
    const items = (d.pieces as any[]).filter((p) => p.categorie === cat.code);
    return {
      ...cat,
      items,
      couvertes: items.filter((p) => PIECE_STATUTS_COUVRANT.includes(p.statut)).length,
    };
  }).filter((g) => g.items.length > 0);

  /// Documents que le cabinet doit produire lui-même (check-list interne
  /// non encore couverte) — à établir via les modèles ou l'upload.
  const docsInternesAFaire = (d.pieces as any[]).filter(
    (p) =>
      p.categorie === "DOCUMENT_INTERNE_CABINET" &&
      !["RECUE", "VALIDEE", "NON_APPLICABLE"].includes(p.statut)
  );

  /// Prochaine action de suivi suggérée selon le statut courant.
  const prochaineAction = (() => {
    switch (d.statut) {
      case "A_QUALIFIER":
        return qualif.complete
          ? "Qualification complète — lancer la collecte des pièces."
          : `Compléter la qualification : ${qualif.manquants.join(", ")}.`;
      case "BROUILLON":
        return "Vérifier la qualification puis lancer la collecte des pièces.";
      case "ATTENTE_CLIENT":
        return manquantes.length
          ? `Relancer le client pour ${manquantes.length} pièce(s) obligatoire(s).`
          : "Pièces reçues — envoyer en contrôle interne.";
      case "PIECES_PARTIELLES":
        return manquantes.length
          ? `Collecter ${manquantes.length} pièce(s) obligatoire(s) manquante(s).`
          : "Check-list complète — passer en contrôle interne.";
      case "CONTROLE_INTERNE":
        return "Vérifier forme, lisibilité et validité des pièces.";
      case "A_CORRIGER":
        return "Corriger le dossier puis le resoumettre au contrôle.";
      case "PRET_VALIDATION":
        return d.type.validationAvocat && !d.valideParId
          ? "Faire valider par un avocat / fiscaliste."
          : "Validation OK — préparer le paquet de dépôt.";
      case "PRET_A_DEPOT":
        return `Constituer ${d.type.nbExemplaires || 2} exemplaire(s) et déposer auprès de ${d.autorite?.nom || d.autoriteLibre || "l'autorité"}.`;
      case "DEPOSE":
      case "EN_INSTRUCTION":
        return d.prochaineRelance
          ? `Suivre l'instruction — relance prévue le ${fmt(d.prochaineRelance)}.`
          : "Suivre l'instruction auprès de l'autorité.";
      case "COMPLEMENT_DEMANDE":
        return "Fournir le complément demandé puis repasser « Prêt à déposer » ou « En instruction ».";
      case "RELANCE":
        return "Relance envoyée — surveiller la réponse.";
      case "ACCEPTE":
        return "Récupérer le document délivré et le verser dans la GED.";
      case "DOCUMENT_DELIVRE":
        return "Remettre le document au client puis clôturer.";
      case "REFUSE":
        return `Étudier le recours${d.recoursEcheance ? ` — échéance ${fmt(d.recoursEcheance)}` : ""}.`;
      case "RECOURS_A_ETUDIER":
        return "Analyser la voie de recours avec le client.";
      case "CLOTURE":
        return "Archiver le dossier (preuves conservées).";
      default:
        return null;
    }
  })();

  function renderPieceRow(p: any) {
    const derogee = (d.derogations as any[] | null)?.some((x) => x.pieceId === p.id);
    return (
      <tr key={p.id} className="border-b align-top">
        <td className="px-2 py-2">
          <div className="font-medium">{p.libelle}</div>
          {p.condition && <div className="text-gray-400">Si : {p.condition}</div>}
          {p.commentaire && <div className="text-gray-500 italic">{p.commentaire}</div>}
          {derogee && <div className="text-amber-600">Dérogation accordée</div>}
        </td>
        <td className="px-2 py-2">
          <span className={p.niveau === "OBLIGATOIRE" ? "font-semibold text-red-700" : ""}>
            {pieceNiveauLabel(p.niveau)}
          </span>
        </td>
        <td className="px-2 py-2">{pieceSourceLabel(p.sourceAttendue)}</td>
        <td className="px-2 py-2">
          {canWrite ? (
            <select
              className="rounded border border-gray-200 px-1 py-0.5 text-xs"
              value={p.statut}
              onChange={(e) => updatePiece(p.id, { statut: e.target.value })}
            >
              {PIECE_STATUTS.map((s) => (
                <option key={s.code} value={s.code}>{s.label}</option>
              ))}
            </select>
          ) : (
            <span className={`rounded-full px-2 py-0.5 ${PIECE_STATUT_COLORS[p.statut]}`}>
              {pieceStatutLabel(p.statut)}
            </span>
          )}
        </td>
        <td className="px-2 py-2">
          {canWrite ? (
            <select
              className="max-w-[160px] rounded border border-gray-200 px-1 py-0.5 text-xs"
              value={p.documentId || ""}
              onChange={(e) => updatePiece(p.id, { documentId: e.target.value || null })}
            >
              <option value="">—</option>
              {documents.map((doc) => (
                <option key={doc.id} value={doc.id}>{doc.nom}</option>
              ))}
            </select>
          ) : (
            documents.find((doc) => doc.id === p.documentId)?.nom || "—"
          )}
        </td>
        {canWrite && (
          <td className="px-2 py-2 text-right whitespace-nowrap">
            {p.niveau === "OBLIGATOIRE" && !["RECUE", "VALIDEE", "NON_APPLICABLE"].includes(p.statut) && !derogee && (
              <button
                type="button"
                title="Accorder une dérogation motivée"
                className="mr-1 rounded bg-amber-50 px-2 py-0.5 text-amber-700 hover:bg-amber-100"
                onClick={() => setDerogationPiece({ id: p.id, libelle: p.libelle })}
              >
                Déroger
              </button>
            )}
            <button
              type="button"
              title="Demander la pièce au client"
              className="mr-1 rounded bg-blue-50 px-2 py-0.5 text-blue-700 hover:bg-blue-100"
              onClick={() => updatePiece(p.id, { statut: "DEMANDEE" })}
            >
              Demander
            </button>
            <button
              type="button"
              className="rounded bg-red-50 px-2 py-0.5 text-red-600 hover:bg-red-100"
              title="Retirer de la check-list"
              onClick={() => removePiece(p.id)}
            >
              ✕
            </button>
          </td>
        )}
      </tr>
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold">{d.reference}</h1>
              <span className={`rounded-full px-3 py-1 text-xs font-medium ${DEMARCHE_STATUT_BADGES[d.statut]}`}>
                {DEMARCHE_STATUT_LABELS[d.statut]}
              </span>
              {d.urgent && <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">Urgent</span>}
              {d.type.sensible && <span className="rounded bg-red-50 px-2 py-0.5 text-xs text-red-700">Sensible</span>}
              {d.risque === "ELEVE" && <span className="rounded bg-orange-100 px-2 py-0.5 text-xs text-orange-700">Risque élevé</span>}
            </div>
            <div className="mt-1 text-sm text-gray-600">
              {d.type.libelle}
              {d.sousType ? ` — ${d.sousType}` : ""} ·{" "}
              <Link href={`/cabinet/dossiers/${d.dossierId}`} className="text-cabinet-700 hover:underline">
                {d.dossier.referenceInterne}
              </Link>{" "}
              ({d.dossier.client.raisonSociale})
            </div>
          </div>
          <div className="text-right text-xs text-gray-500">
            <div>Créée le {fmt(d.createdAt)}</div>
            {d.prochaineRelance && STATUTS_ATTENTE_ADMIN.includes(d.statut) && (
              <div className={new Date(d.prochaineRelance) <= new Date() ? "font-semibold text-rose-600" : ""}>
                Relance : {fmt(d.prochaineRelance)}
              </div>
            )}
            {d.dateLimite && <div>Limite : {fmt(d.dateLimite)}</div>}
          </div>
        </div>

        {d.type.avertissement && (
          <div className="mt-3 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {d.type.avertissement}
          </div>
        )}
        {d.statut === "A_QUALIFIER" && (
          <div className="mt-3 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Qualification obligatoire incomplète : {qualif.manquants.join(", ") || "—"}.
            La démarche ne pourra pas passer à « Prêt à déposer » tant que ces informations manquent.
          </div>
        )}
        {d.type.validationAvocat && (
          <div className="mt-3 rounded border border-purple-300 bg-purple-50 px-3 py-2 text-sm text-purple-800">
            Validation renforcée requise (avocat / fiscaliste).
            {d.valideParId
              ? ` Validée par ${valideParNom || d.valideParId} le ${fmt(d.valideLe)}.`
              : " Non encore validée."}
          </div>
        )}
      </div>

      {/* Vue d'ensemble à l'ouverture : suivi + pièces par catégorie */}
      <div className="card space-y-3">
        {prochaineAction && (
          <div className="flex items-start gap-2 rounded-lg border border-cabinet-200 bg-cabinet-50/60 px-3 py-2 text-sm">
            <span className="font-semibold text-cabinet-800">À faire :</span>
            <span className="text-cabinet-900">{prochaineAction}</span>
          </div>
        )}
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {piecesParCategorie.map((g) => {
            const complete = g.couvertes === g.items.length;
            return (
              <div key={g.code} className="rounded-lg border border-gray-200 px-3 py-2">
                <div className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
                  {g.label}
                </div>
                <div className={`mt-0.5 text-sm font-semibold ${complete ? "text-emerald-700" : "text-gray-800"}`}>
                  {g.couvertes}/{g.items.length}
                  {complete && <span className="ml-1 text-xs">✓</span>}
                </div>
              </div>
            );
          })}
        </div>
        {docsInternesAFaire.length > 0 && (
          <div className="rounded-lg border border-dashed border-cabinet-300 px-3 py-2 text-xs text-gray-700">
            <span className="font-semibold">Documents à établir par le cabinet :</span>{" "}
            {docsInternesAFaire.map((p: any) => p.libelle).join(" · ")}
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Actions de workflow */}
      {canWrite && transitions.length > 0 && (
        <div className="card space-y-3">
          <div className="text-sm font-semibold">Avancer le dossier</div>
          <div className="flex flex-wrap gap-2">
            {transitions.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setCible(cible === t ? "" : t)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  cible === t
                    ? "bg-cabinet-700 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                → {DEMARCHE_STATUT_LABELS[t]}
              </button>
            ))}
          </div>

          {cible && (
            <div className="space-y-3 rounded-lg border border-cabinet-200 bg-cabinet-50/40 p-4">
              <div className="text-sm font-medium">
                Passer à « {DEMARCHE_STATUT_LABELS[cible]} »
              </div>

              {besoinChampDepot && (
                <div className="grid gap-3 sm:grid-cols-4">
                  <div><label className={labelCls}>Date de dépôt *</label>
                    <input type="date" className={inputCls} value={depot.dateDepot} onChange={(e) => setDepot({ ...depot, dateDepot: e.target.value })} /></div>
                  <div><label className={labelCls}>Déposant *</label>
                    <input className={inputCls} value={depot.deposePar} onChange={(e) => setDepot({ ...depot, deposePar: e.target.value })} placeholder="Agent de liaison…" /></div>
                  <div><label className={labelCls}>Canal *</label>
                    <select className={inputCls} value={depot.canalDepot} onChange={(e) => setDepot({ ...depot, canalDepot: e.target.value })}>
                      <option value="physique">Dépôt physique</option>
                      <option value="courrier">Courrier</option>
                      <option value="en_ligne">En ligne</option>
                      <option value="email">E-mail officiel</option>
                    </select></div>
                  <div><label className={labelCls}>N° récépissé</label>
                    <input className={inputCls} value={depot.numeroRecepisse} onChange={(e) => setDepot({ ...depot, numeroRecepisse: e.target.value })} /></div>
                </div>
              )}

              {besoinChampDecision && (
                <div className="grid gap-3 sm:grid-cols-3">
                  <div><label className={labelCls}>Date de la décision *</label>
                    <input type="date" className={inputCls} value={decision.decisionDate} onChange={(e) => setDecision({ ...decision, decisionDate: e.target.value })} /></div>
                  {cible === "REFUSE" && (
                    <>
                      <div><label className={labelCls}>Motif de refus *</label>
                        <input className={inputCls} value={decision.motifRejet} onChange={(e) => setDecision({ ...decision, motifRejet: e.target.value })} /></div>
                      <div><label className={labelCls}>Voie de recours</label>
                        <input className={inputCls} value={decision.voieRecours} onChange={(e) => setDecision({ ...decision, voieRecours: e.target.value })} /></div>
                      <div><label className={labelCls}>Échéance de recours</label>
                        <input type="date" className={inputCls} value={decision.recoursEcheance} onChange={(e) => setDecision({ ...decision, recoursEcheance: e.target.value })} /></div>
                    </>
                  )}
                  <div className="sm:col-span-3"><label className={labelCls}>Notes de décision</label>
                    <input className={inputCls} value={decision.decisionNotes} onChange={(e) => setDecision({ ...decision, decisionNotes: e.target.value })} /></div>
                </div>
              )}

              {besoinDocDelivre && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div><label className={labelCls}>Document délivré (GED) *</label>
                    <select className={inputCls} value={decision.documentDelivreId} onChange={(e) => setDecision({ ...decision, documentDelivreId: e.target.value })}>
                      <option value="">— Choisir le scan du document —</option>
                      {piecesDocDelivre.map((doc) => (
                        <option key={doc.id} value={doc.id}>{doc.nom}</option>
                      ))}
                    </select></div>
                  <div><label className={labelCls}>Remis au client le</label>
                    <input type="date" className={inputCls} value={decision.remisAuClientLe} onChange={(e) => setDecision({ ...decision, remisAuClientLe: e.target.value })} /></div>
                </div>
              )}

              {cible === "PRET_VALIDATION" && manquantes.length > 0 && (
                <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm">
                  <div className="font-medium text-amber-900">
                    Pièces obligatoires manquantes : {manquantes.map((p: any) => p.libelle).join(", ")}
                  </div>
                  <label className={`${labelCls} mt-2`}>Motif de dérogation (journalisé)</label>
                  <input className={inputCls} value={derogationMotif} onChange={(e) => setDerogationMotif(e.target.value)} />
                </div>
              )}

              <div>
                <label className={labelCls}>Note (journal)</label>
                <input className={inputCls} value={noteTransition} onChange={(e) => setNoteTransition(e.target.value)} />
              </div>
              <button type="button" className="btn-primary" disabled={busy} onClick={() => doTransition(cible)}>
                Confirmer
              </button>
            </div>
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Colonne principale */}
        <div className="space-y-6 lg:col-span-2">
          {/* Qualification */}
          <div className="card">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Qualification de la demande</h2>
              {canWrite && (
                <button type="button" className="btn-secondary px-3 py-1 text-xs" onClick={() => setEditOpen(!editOpen)}>
                  {editOpen ? "Fermer" : "Modifier"}
                </button>
              )}
            </div>
            {!editOpen ? (
              <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                <div><dt className="text-xs text-gray-500">Objet</dt><dd>{d.objet || "—"}</dd></div>
                <div><dt className="text-xs text-gray-500">Sous-type</dt><dd>{d.sousType || "—"}</dd></div>
                <div><dt className="text-xs text-gray-500">Finalité</dt><dd>{d.finalite || "—"}</dd></div>
                <div><dt className="text-xs text-gray-500">Fondement</dt><dd>{d.fondement || "—"}</dd></div>
                <div><dt className="text-xs text-gray-500">Références des actes</dt><dd>{d.referenceActes || "—"}</dd></div>
                <div><dt className="text-xs text-gray-500">Autorité</dt><dd>{d.autorite?.nom || d.autoriteLibre || "—"}</dd></div>
                <div><dt className="text-xs text-gray-500">Demandeur</dt><dd>{demandeurLabel(d.demandeur)}</dd></div>
                <div><dt className="text-xs text-gray-500">Client du cabinet (demandeur lié)</dt><dd>{d.demandeur?.client?.raisonSociale || "—"}</dd></div>
                <div><dt className="text-xs text-gray-500">Mandataire</dt><dd>{demandeurLabel(d.mandataire)}</dd></div>
                <div><dt className="text-xs text-gray-500">Client du dossier</dt><dd>{d.dossier?.client?.raisonSociale || "—"}</dd></div>
                <div className="sm:col-span-2"><dt className="text-xs text-gray-500">Parcelle / bien</dt><dd>{parcelleLabel(d.parcelle)}</dd></div>
                {d.qualification && Object.keys(d.qualification).length > 0 && (
                  <div className="sm:col-span-2">
                    <dt className="text-xs text-gray-500">Données de qualification</dt>
                    <dd className="mt-1 space-y-0.5">
                      {Object.entries(d.qualification as Record<string, string>).map(([k, v]) => (
                        <div key={k} className="text-xs"><span className="font-medium">{k}</span> : {String(v)}</div>
                      ))}
                    </dd>
                  </div>
                )}
                {d.noteRecevabilite && (
                  <div className="sm:col-span-2"><dt className="text-xs text-gray-500">Note de recevabilité</dt><dd className="whitespace-pre-wrap">{d.noteRecevabilite}</dd></div>
                )}
              </dl>
            ) : (
              <div className="mt-3 space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div><label className={labelCls}>Sous-type</label>
                    <input className={inputCls} value={edit.sousType} onChange={(e) => setEdit({ ...edit, sousType: e.target.value })} /></div>
                  <div><label className={labelCls}>Autorité référencée</label>
                    <select className={inputCls} value={edit.autoriteId} onChange={(e) => setEdit({ ...edit, autoriteId: e.target.value })}>
                      <option value="">—</option>
                      {autorites.map((a) => <option key={a.id} value={a.id}>{a.nom}</option>)}
                    </select></div>
                  <div><label className={labelCls}>Autorité libre</label>
                    <input className={inputCls} value={edit.autoriteLibre} onChange={(e) => setEdit({ ...edit, autoriteLibre: e.target.value })} /></div>
                  <div><label className={labelCls}>Demandeur *</label>
                    <select className={inputCls} value={edit.demandeurId} onChange={(e) => setEdit({ ...edit, demandeurId: e.target.value })}>
                      <option value="">—</option>
                      {demandeurs.map((dd) => <option key={dd.id} value={dd.id}>{demandeurLabel(dd)}</option>)}
                    </select></div>
                  <div><label className={labelCls}>Mandataire</label>
                    <select className={inputCls} value={edit.mandataireId} onChange={(e) => setEdit({ ...edit, mandataireId: e.target.value })}>
                      <option value="">—</option>
                      {demandeurs.map((dd) => <option key={dd.id} value={dd.id}>{demandeurLabel(dd)}</option>)}
                    </select></div>
                  <div><label className={labelCls}>Parcelle</label>
                    <select className={inputCls} value={edit.parcelleId} onChange={(e) => setEdit({ ...edit, parcelleId: e.target.value })}>
                      <option value="">—</option>
                      {parcelles.map((p) => <option key={p.id} value={p.id}>{parcelleLabel(p)}</option>)}
                    </select></div>
                </div>
                <div><label className={labelCls}>Objet</label>
                  <textarea className={inputCls} rows={2} value={edit.objet} onChange={(e) => setEdit({ ...edit, objet: e.target.value })} /></div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div><label className={labelCls}>Finalité</label>
                    <input className={inputCls} value={edit.finalite} onChange={(e) => setEdit({ ...edit, finalite: e.target.value })} /></div>
                  <div><label className={labelCls}>Références des actes</label>
                    <input className={inputCls} value={edit.referenceActes} onChange={(e) => setEdit({ ...edit, referenceActes: e.target.value })} /></div>
                </div>
                <div><label className={labelCls}>Fondement</label>
                  <textarea className={inputCls} rows={2} value={edit.fondement} onChange={(e) => setEdit({ ...edit, fondement: e.target.value })} /></div>
                <div><label className={labelCls}>Note de recevabilité</label>
                  <textarea className={inputCls} rows={3} value={edit.noteRecevabilite} onChange={(e) => setEdit({ ...edit, noteRecevabilite: e.target.value })} /></div>
                <div className="grid gap-3 sm:grid-cols-4">
                  <div><label className={labelCls}>Responsable</label>
                    <select className={inputCls} value={edit.responsableId} onChange={(e) => setEdit({ ...edit, responsableId: e.target.value })}>
                      <option value="">—</option>
                      {users.map((u) => <option key={u.id} value={u.id}>{u.prenom} {u.nom}</option>)}
                    </select></div>
                  <div><label className={labelCls}>Assistante</label>
                    <select className={inputCls} value={edit.assistanteId} onChange={(e) => setEdit({ ...edit, assistanteId: e.target.value })}>
                      <option value="">—</option>
                      {users.map((u) => <option key={u.id} value={u.id}>{u.prenom} {u.nom}</option>)}
                    </select></div>
                  <div><label className={labelCls}>Agent de liaison</label>
                    <select className={inputCls} value={edit.agentLiaisonId} onChange={(e) => setEdit({ ...edit, agentLiaisonId: e.target.value })}>
                      <option value="">—</option>
                      {users.map((u) => <option key={u.id} value={u.id}>{u.prenom} {u.nom}</option>)}
                    </select></div>
                  <div><label className={labelCls}>Date limite</label>
                    <input type="date" className={inputCls} value={edit.dateLimite} onChange={(e) => setEdit({ ...edit, dateLimite: e.target.value })} /></div>
                </div>
                <div className="flex items-center gap-4">
                  <div>
                    <label className={labelCls}>Priorité</label>
                    <select className={inputCls} value={edit.priorite} onChange={(e) => setEdit({ ...edit, priorite: e.target.value })}>
                      <option value="BASSE">Basse</option><option value="NORMALE">Normale</option>
                      <option value="HAUTE">Haute</option><option value="URGENTE">Urgente</option>
                    </select>
                  </div>
                  <label className="mt-4 flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={edit.urgent} onChange={(e) => setEdit({ ...edit, urgent: e.target.checked })} />
                    Urgent
                  </label>
                </div>
                <button type="button" className="btn-primary" disabled={busy} onClick={saveEdit}>
                  Enregistrer
                </button>
              </div>
            )}
          </div>

          {/* Check-list des pièces */}
          <div className="card">
            <h2 className="font-semibold">
              Check-list des pièces{" "}
              <span className="text-xs font-normal text-gray-500">
                ({d.pieces.filter((p: any) => ["RECUE", "VALIDEE", "NON_APPLICABLE"].includes(p.statut)).length}/{d.pieces.length} couvertes)
              </span>
            </h2>
            {manquantes.length > 0 && (
              <div className="mt-2 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Pièces obligatoires manquantes : {manquantes.map((p: any) => p.libelle).join(", ")}
              </div>
            )}
            <div className="mt-3 space-y-4">
              {piecesParCategorie.map((g) => (
                <div key={g.code}>
                  <div className="mb-1 flex items-center justify-between">
                    <div className="text-xs font-semibold uppercase tracking-wide text-cabinet-800">
                      {g.label}
                    </div>
                    <div className={`text-xs ${g.couvertes === g.items.length ? "text-emerald-600 font-semibold" : "text-gray-400"}`}>
                      {g.couvertes}/{g.items.length} couverte(s)
                    </div>
                  </div>
                  <div className="overflow-x-auto rounded-lg border border-gray-200">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-gray-50 text-gray-600">
                        <tr>
                          <th className="px-2 py-2">Pièce</th>
                          <th className="px-2 py-2">Niveau</th>
                          <th className="px-2 py-2">Source</th>
                          <th className="px-2 py-2">Statut</th>
                          <th className="px-2 py-2">Document GED</th>
                          {canWrite && <th className="px-2 py-2 text-right">Actions</th>}
                        </tr>
                      </thead>
                      <tbody>{g.items.map(renderPieceRow)}</tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>

            {derogationPiece && (
              <div className="mt-3 rounded border border-amber-300 bg-amber-50 p-3 text-sm">
                <div className="font-medium">Dérogation : {derogationPiece.libelle}</div>
                <input
                  className={`${inputCls} mt-2`}
                  placeholder="Motif obligatoire de la dérogation"
                  value={derogationPieceMotif}
                  onChange={(e) => setDerogationPieceMotif(e.target.value)}
                />
                <div className="mt-2 flex gap-2">
                  <button type="button" className="btn-primary px-3 py-1 text-xs" onClick={addDerogation}>Valider la dérogation</button>
                  <button type="button" className="btn-secondary px-3 py-1 text-xs" onClick={() => setDerogationPiece(null)}>Annuler</button>
                </div>
              </div>
            )}

            {canWrite && (
              <div className="mt-4 rounded-lg border border-dashed border-gray-300 p-3">
                <div className="mb-2 text-xs font-semibold text-gray-600">
                  Ajouter une pièce (complément exigé par l&apos;administration…)
                </div>
                <div className="grid gap-2 sm:grid-cols-6">
                  <input className={inputCls} placeholder="Code" value={newPiece.code}
                    onChange={(e) => setNewPiece({ ...newPiece, code: e.target.value })} />
                  <input className={`${inputCls} sm:col-span-2`} placeholder="Libellé" value={newPiece.libelle}
                    onChange={(e) => setNewPiece({ ...newPiece, libelle: e.target.value })} />
                  <select className={inputCls} value={newPiece.categorie}
                    onChange={(e) => setNewPiece({ ...newPiece, categorie: e.target.value })}>
                    {PIECE_CATEGORIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
                  </select>
                  <select className={inputCls} value={newPiece.niveau}
                    onChange={(e) => setNewPiece({ ...newPiece, niveau: e.target.value })}>
                    {PIECE_NIVEAUX.map((n) => <option key={n.code} value={n.code}>{n.label}</option>)}
                  </select>
                  <button type="button" className="btn-secondary px-3 py-1 text-xs" onClick={addPiece}>
                    + Ajouter
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Journal */}
          <div className="card">
            <h2 className="font-semibold">Journal de suivi</h2>
            {canWrite && (
              <div className="mt-3 flex flex-wrap items-end gap-2">
                <select className={inputCls + " w-44"} value={evt.type} onChange={(e) => setEvt({ ...evt, type: e.target.value })}>
                  {EVENEMENT_TYPES.filter((t) => !["CHANGEMENT_STATUT", "VALIDATION"].includes(t.code)).map((t) => (
                    <option key={t.code} value={t.code}>{t.label}</option>
                  ))}
                </select>
                <input type="date" className={inputCls + " w-40"} value={evt.date} onChange={(e) => setEvt({ ...evt, date: e.target.value })} />
                <input className={inputCls + " flex-1"} placeholder="Description (relance envoyée, complément reçu…)"
                  value={evt.description} onChange={(e) => setEvt({ ...evt, description: e.target.value })} />
                <button type="button" className="btn-secondary px-3 py-2 text-xs" onClick={addEvent}>Ajouter</button>
              </div>
            )}
            <ul className="mt-3 space-y-2">
              {d.evenements.map((e: any) => (
                <li key={e.id} className="flex items-start gap-3 border-b pb-2 text-sm last:border-0">
                  <span className="mt-0.5 rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600 whitespace-nowrap">
                    {evtTypeLabel(e.type)}
                  </span>
                  <div className="flex-1">
                    <div>{e.description}</div>
                    <div className="text-xs text-gray-400">
                      {new Date(e.date).toLocaleString("fr-FR")}
                      {e.creePar && userNames[e.creePar] ? ` — ${userNames[e.creePar]}` : ""}
                    </div>
                  </div>
                </li>
              ))}
              {d.evenements.length === 0 && <li className="text-sm text-gray-400">Aucun événement.</li>}
            </ul>
          </div>
        </div>

        {/* Colonne latérale */}
        <div className="space-y-6">
          {/* Validation juridique */}
          {d.type.validationAvocat && canValidate && !d.valideParId && canWrite && (
            <div className="card border-purple-300">
              <h3 className="font-semibold text-purple-900">Validation juridique</h3>
              <p className="mt-1 text-xs text-purple-700">
                Cette démarche exige la validation d&apos;un avocat ou fiscaliste avant dépôt.
              </p>
              <button type="button" className="btn-primary mt-3 w-full" disabled={busy} onClick={valider}>
                Valider la démarche
              </button>
            </div>
          )}

          {/* Génération de documents */}
          <div className="card">
            <h3 className="font-semibold">Documents à établir par le cabinet</h3>
            <p className="mt-1 text-xs text-gray-500">
              Modèles du cabinet — le PDF est chiffré et rangé dans la GED du dossier.
            </p>
            <div className="mt-3 space-y-1">
              {modeles.map((m) => {
                const sel = m.id === modeleId;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => { setModeleId(sel ? "" : m.id); setModeleVars({}); }}
                    className={`flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-xs transition ${
                      sel
                        ? "border-cabinet-500 bg-cabinet-50 font-semibold text-cabinet-900"
                        : "border-gray-200 text-gray-700 hover:border-cabinet-300 hover:bg-gray-50"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span className="font-mono text-[10px] text-gray-400">{m.code}</span>
                      {m.titre}
                    </span>
                    <span className="shrink-0 text-cabinet-600">{sel ? "▾" : "Générer →"}</span>
                  </button>
                );
              })}
              {modeles.length === 0 && (
                <div className="text-xs text-gray-400">Aucun modèle configuré pour ce type.</div>
              )}
            </div>
            {modeleVariables.length > 0 && (
              <div className="mt-3 max-h-64 space-y-2 overflow-y-auto rounded border border-gray-100 p-2">
                {modeleVariables.map((v) => (
                  <div key={v.cle}>
                    <label className="block text-xs text-gray-500">{v.label}</label>
                    {v.multiline ? (
                      <textarea className={inputCls} rows={2} value={modeleVars[v.cle] || ""}
                        onChange={(e) => setModeleVars({ ...modeleVars, [v.cle]: e.target.value })} />
                    ) : (
                      <input className={inputCls} value={modeleVars[v.cle] || ""}
                        onChange={(e) => setModeleVars({ ...modeleVars, [v.cle]: e.target.value })} />
                    )}
                  </div>
                ))}
              </div>
            )}
            <label className="mt-2 flex items-center gap-2 text-xs text-gray-600">
              <input type="checkbox" checked={publieClient} onChange={(e) => setPublieClient(e.target.checked)} />
              Publier dans l&apos;espace client
            </label>
            <button
              type="button"
              className="btn-primary mt-3 w-full disabled:opacity-50"
              disabled={!modeleId || genBusy}
              onClick={genererPdf}
            >
              {genBusy ? "Génération…" : "Générer le PDF"}
            </button>
          </div>

          {/* Frais */}
          <div className="card">
            <h3 className="font-semibold">Frais & avances</h3>
            <div className="mt-2 grid grid-cols-2 gap-1 text-xs">
              <div>Honoraires : <strong>{d.honoraires?.toLocaleString("fr-FR") || 0}</strong></div>
              <div>Débours : <strong>{d.debours?.toLocaleString("fr-FR") || 0}</strong></div>
              <div>Taxes : <strong>{d.taxes?.toLocaleString("fr-FR") || 0}</strong></div>
              <div>Timbres : <strong>{d.timbres?.toLocaleString("fr-FR") || 0}</strong></div>
              <div className="col-span-2">Avances reçues : <strong>{d.avancesRecues?.toLocaleString("fr-FR") || 0}</strong></div>
            </div>
            <ul className="mt-3 space-y-1 text-xs">
              {d.frais.map((f: any) => (
                <li key={f.id} className="flex items-center justify-between gap-2 border-b pb-1 last:border-0">
                  <div>
                    <span className="font-medium">{fraisNatureLabel(f.nature)}</span> — {f.libelle}
                    {f.quittance && <span className="text-gray-400"> (quitt. {f.quittance})</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span>{f.montant.toLocaleString("fr-FR")}</span>
                    {canWrite && ["DEBOURS", "TAXE", "TIMBRE"].includes(f.nature) && (
                      <button
                        type="button"
                        title={f.rapproche ? "Rapproché" : "Marquer rapproché"}
                        className={`rounded px-1.5 py-0.5 ${f.rapproche ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}
                        onClick={() => toggleRapproche(f)}
                      >
                        {f.rapproche ? "✓" : "…"}
                      </button>
                    )}
                  </div>
                </li>
              ))}
              {d.frais.length === 0 && <li className="text-gray-400">Aucun frais saisi.</li>}
            </ul>
            {canWrite && (
              <div className="mt-3 space-y-2 border-t pt-3">
                <div className="grid grid-cols-2 gap-2">
                  <select className={inputCls} value={frais.nature} onChange={(e) => setFrais({ ...frais, nature: e.target.value })}>
                    {FRAIS_NATURES.map((n) => <option key={n.code} value={n.code}>{n.label}</option>)}
                  </select>
                  <input type="number" min={0} className={inputCls} placeholder="Montant" value={frais.montant}
                    onChange={(e) => setFrais({ ...frais, montant: e.target.value })} />
                </div>
                <input className={inputCls} placeholder="Libellé" value={frais.libelle}
                  onChange={(e) => setFrais({ ...frais, libelle: e.target.value })} />
                <input className={inputCls} placeholder="N° quittance (optionnel)" value={frais.quittance}
                  onChange={(e) => setFrais({ ...frais, quittance: e.target.value })} />
                <button type="button" className="btn-secondary w-full px-3 py-1.5 text-xs" onClick={addFrais}>
                  + Ajouter un frais
                </button>
              </div>
            )}
          </div>

          {/* Infos complémentaires */}
          <div className="card text-sm">
            <h3 className="font-semibold">Informations</h3>
            <dl className="mt-2 space-y-1.5">
              <div className="flex justify-between"><dt className="text-gray-500">Responsable</dt><dd>{d.responsableId ? userNames[d.responsableId] : "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Assistante</dt><dd>{d.assistanteId ? userNames[d.assistanteId] : "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Agent de liaison</dt><dd>{d.agentLiaisonId ? userNames[d.agentLiaisonId] : "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Déposé le</dt><dd>{fmt(d.dateDepot)}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Récépissé</dt><dd>{d.numeroRecepisse || "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Décision</dt><dd>{d.decisionDate ? fmt(d.decisionDate) : "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Échéance recours</dt><dd>{fmt(d.recoursEcheance)}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Remis au client</dt><dd>{fmt(d.remisAuClientLe)}</dd></div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
