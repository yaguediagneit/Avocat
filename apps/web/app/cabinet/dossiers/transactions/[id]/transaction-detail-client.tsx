"use client";

import { Fragment, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  TRANSACTION_STATUT_LABELS,
  TRANSACTION_STATUT_BADGES,
  TRANSACTION_TRANSITIONS,
  BLOCAGE_STATUTS,
  TRX_PIECE_CATEGORIES,
  TRX_PARTIE_ROLES,
  FORMALITE_ENTITES,
  FORMALITE_STATUTS,
  PAIEMENT_NATURES,
  PAIEMENT_NATURES_CABINET,
  TRX_EVENEMENT_TYPES,
  ECHEANCE_STATUTS_LABELS,
  ETAT_LIEUX_OBJETS,
  ETAT_LIEUX_EMPLACEMENTS,
  ETAT_LIEUX_TYPES,
  ETAT_LIEUX_ETATS,
  MODES_PAIEMENT,
  TYPES_MANDAT,
  commissionMensuelle,
  piecesObligatoiresManquantesTrx,
} from "@/lib/transactions";
import { PIECE_STATUTS, PIECE_NIVEAUX } from "@/lib/demarches";
import { extractTemplateVariables } from "@/lib/document-template";

const inputCls = "input";
const labelCls = "mb-1 block text-xs font-medium text-gray-600";
const BLOQUES = new Set<string>(BLOCAGE_STATUTS as unknown as string[]);
const TRANSITIONS_SENSIBLES = new Set([
  "SIGNATURE_NOTARIALE_PLANIFIEE",
  "ACTE_NOTARIE_SIGNE",
  "MUTATION_INSCRITE",
  "ETAT_DROITS_REELS_FINAL_RECU",
  "DOSSIER_REMIS_CLIENT",
  "CLOTURE",
]);

function fmt(d?: string | null) {
  return d ? new Date(d).toLocaleDateString("fr-FR") : "—";
}
function money(n?: number | null, devise = "XOF") {
  return n != null ? `${n.toLocaleString("fr-FR")} ${devise}` : "—";
}
function partieLabel(p: any) {
  if (!p) return "—";
  if (p.demandeur) {
    const d = p.demandeur;
    return d.typePersonne === "MORALE"
      ? d.raisonSociale || d.nom
      : [d.civilite, d.prenoms, d.nom].filter(Boolean).join(" ");
  }
  return p.client?.raisonSociale || p.nomLibre || "—";
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

const TABS = [
  { id: "apercu", label: "Vue d'ensemble" },
  { id: "parties", label: "Parties" },
  { id: "pieces", label: "Pièces" },
  { id: "contrats", label: "Contrats & documents" },
  { id: "formalites", label: "Formalités externes" },
  { id: "paiements", label: "Paiements" },
  { id: "echeances", label: "Échéances & versements", bail: true },
  { id: "etatlieux", label: "État des lieux", bail: true },
  { id: "journal", label: "Journal" },
] as const;

export function TransactionDetailClient({
  transaction: initial,
  documents,
  modeles,
  demandeurs,
  biens,
  demarchesDossier,
  users,
  userNames,
  canWrite,
  canValidate,
  valideParNom,
}: {
  transaction: any;
  documents: any[];
  modeles: any[];
  demandeurs: any[];
  biens: any[];
  demarchesDossier: any[];
  users: any[];
  userNames: Record<string, string>;
  canWrite: boolean;
  canValidate: boolean;
  valideParNom: string | null;
}) {
  const router = useRouter();
  const [t, setT] = useState<any>(initial);
  const [tab, setTab] = useState<string>("apercu");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // --- Transition ---
  const [cible, setCible] = useState("");
  const [motifBlocage, setMotifBlocage] = useState("");
  const [preuves, setPreuves] = useState({
    mandatSigne: t.mandatSigne ?? false,
    notaireNom: t.notaireNom || "",
    notaireEtude: t.notaireEtude || "",
    acteSigneLe: t.acteSigneLe ? String(t.acteSigneLe).slice(0, 10) : "",
    documentActeId: t.documentActeId || "",
    depotConservationLe: t.depotConservationLe ? String(t.depotConservationLe).slice(0, 10) : "",
    mutationInscriteLe: t.mutationInscriteLe ? String(t.mutationInscriteLe).slice(0, 10) : "",
    documentMutationId: t.documentMutationId || "",
    remisAuClientLe: t.remisAuClientLe ? String(t.remisAuClientLe).slice(0, 10) : "",
    droitDeLouerVerifie: t.droitDeLouerVerifie ?? false,
    etatLieuxEntreeFait: t.etatLieuxEntreeFait ?? false,
    etatLieuxSortieFait: t.etatLieuxSortieFait ?? false,
    etatDroitsReelsObtenu: t.etatDroitsReelsObtenu ?? false,
  });
  const [derogationMotif, setDerogationMotif] = useState("");
  const [noteTransition, setNoteTransition] = useState("");

  // --- Parties ---
  const [newPartie, setNewPartie] = useState({
    role: "VENDEUR",
    demandeurId: "",
    nomLibre: "",
    qualite: "",
  });

  // --- Pièces ---
  const [newPiece, setNewPiece] = useState({
    code: "",
    libelle: "",
    categorie: "PIECE_CLIENT",
    niveau: "OBLIGATOIRE",
    partieConcernee: "TOUTES",
    sourceAttendue: "CLIENT",
  });
  const [derogPiece, setDerogPiece] = useState<{ id: string; libelle: string } | null>(null);
  const [derogPieceMotif, setDerogPieceMotif] = useState("");

  // --- Documents / PDF ---
  const [modeleId, setModeleId] = useState("");
  const [modeleVars, setModeleVars] = useState<Record<string, string>>({});
  const [publieClient, setPublieClient] = useState(false);
  const [confidentiel, setConfidentiel] = useState(false);
  const [genBusy, setGenBusy] = useState(false);

  // --- Formalités ---
  const [newForm, setNewForm] = useState({
    entite: "NOTAIRE",
    bureau: "",
    objet: "",
    niveauObligation: "CONDITIONNELLE",
    demarcheId: "",
  });

  // --- Paiements ---
  const [newPay, setNewPay] = useState({
    nature: "HONORAIRES_CABINET",
    libelle: "",
    montant: "",
    payeur: "",
    beneficiaire: "",
    mode: "VIREMENT",
    reference: "",
    date: new Date().toISOString().slice(0, 10),
    formaliteId: "",
  });

  // --- Événements ---
  const [evt, setEvt] = useState({ type: "NOTE", description: "", date: "" });

  // --- Échéances ---
  const [newEch, setNewEch] = useState({
    nature: "LOYER",
    periode: "",
    jourEcheance: "",
    montantDu: "",
    beneficiaire: "",
  });
  const [payEch, setPayEch] = useState<{ id: string; montant: string; mode: string } | null>(null);

  // --- État des lieux ---
  const [elForm, setElForm] = useState<any | null>(null); // fiche en édition
  const [elLignes, setElLignes] = useState<any[]>([]);

  const workflow = t.type?.workflow || "GENERIQUE";
  const transitions = TRANSACTION_TRANSITIONS[workflow]?.[t.statut] || [];
  const manquantes = useMemo(
    () => piecesObligatoiresManquantesTrx(t.pieces || [], t.derogations),
    [t.pieces, t.derogations]
  );
  const paiementsNonRapproches = (t.paiements || []).filter((p: any) => !p.rapproche).length;
  const estBloquee = BLOQUES.has(t.statut);
  const cibleEstBlocage = BLOQUES.has(cible);
  const isVenteTF = workflow === "VENTE_TF";
  const isBail = workflow === "BAIL";
  // Onglets locatifs : baux, mandats (reversements) et états des lieux.
  const showLocatif = isBail || t.type?.famille === "ETAT_LIEUX" || t.type?.famille === "MANDAT";
  const tabsVisibles = TABS.filter((tb: any) => !tb.bail || showLocatif);
  const echeances: any[] = t.echeances || [];
  const echeancesLoyer = echeances.filter((e) => e.nature !== "REVERSEMENT_BAILLEUR");
  const versements = echeances.filter((e) => e.nature === "REVERSEMENT_BAILLEUR");
  const totalDu = echeancesLoyer.reduce((s, e) => s + e.montantDu, 0);
  const totalPaye = echeancesLoyer.reduce((s, e) => s + e.montantPaye, 0);
  const impayes = echeancesLoyer
    .filter((e) => ["A_PERCEVOIR", "PARTIEL", "EN_RETARD"].includes(e.statut))
    .reduce((s, e) => s + (e.montantDu - e.montantPaye), 0);

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

  async function refresh() {
    const res = await fetch(`/api/transactions/${t.id}`);
    if (res.ok) setT(await res.json());
    router.refresh();
  }

  async function doTransition(statut: string) {
    setBusy(true);
    setError("");
    try {
      const payload: any = { statut, note: noteTransition || null };
      if (cibleEstBlocage) payload.motifBlocage = motifBlocage;
      // Champs de preuve transmis selon l'étape visée.
      if (["MANDAT_CABINET_A_SIGNER", "IDENTIFICATION_PARTIES"].includes(statut)) {
        payload.mandatSigne = preuves.mandatSigne;
        payload.documentMandatId = preuves.documentActeId || null;
      }
      if (statut === "DOSSIER_NOTARIAL_A_COMPLETER")
        payload.etatDroitsReelsObtenu = preuves.etatDroitsReelsObtenu;
      if (["SIGNATURE_NOTARIALE_PLANIFIEE", "DOSSIER_NOTARIAL_A_COMPLETER"].includes(statut)) {
        payload.notaireNom = preuves.notaireNom || null;
        payload.notaireEtude = preuves.notaireEtude || null;
      }
      if (statut === "ACTE_NOTARIE_SIGNE") {
        payload.acteSigneLe = preuves.acteSigneLe || null;
        payload.documentActeId = preuves.documentActeId || null;
      }
      if (statut === "DEPOT_CONSERVATION_EFFECTUE")
        payload.depotConservationLe = preuves.depotConservationLe || null;
      if (statut === "MUTATION_INSCRITE") {
        payload.mutationInscrite = true;
        payload.mutationInscriteLe = preuves.mutationInscriteLe || null;
        payload.documentMutationId = preuves.documentMutationId || null;
      }
      if (statut === "CONTROLE_DESTINATION_ET_USAGE")
        payload.droitDeLouerVerifie = preuves.droitDeLouerVerifie;
      if (statut === "BAIL_EN_COURS") payload.etatLieuxEntreeFait = preuves.etatLieuxEntreeFait;
      if (statut === "CLOTURE" || statut === "DOSSIER_REMIS_CLIENT")
        payload.remisAuClientLe = preuves.remisAuClientLe || null;
      if (derogationMotif.trim()) payload.derogationMotif = derogationMotif;

      await call(`/api/transactions/${t.id}/transition`, "POST", payload);
      await refresh();
      setCible("");
      setMotifBlocage("");
      setDerogationMotif("");
      setNoteTransition("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    }
    setBusy(false);
  }

  async function addPartie() {
    setBusy(true);
    setError("");
    try {
      await call(`/api/transactions/${t.id}/parties`, "POST", newPartie);
      setNewPartie({ role: "VENDEUR", demandeurId: "", nomLibre: "", qualite: "" });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    }
    setBusy(false);
  }

  async function removePartie(id: string) {
    if (!confirm("Retirer cette partie ?")) return;
    await call(`/api/transactions/${t.id}/parties/${id}`, "DELETE");
    await refresh();
  }

  async function setPieceStatut(pieceId: string, statut: string, extra: any = {}) {
    await call(`/api/transactions/${t.id}/pieces/${pieceId}`, "PATCH", { statut, ...extra });
    await refresh();
  }

  async function addPiece() {
    setBusy(true);
    setError("");
    try {
      await call(`/api/transactions/${t.id}/pieces`, "POST", newPiece);
      setNewPiece({
        code: "",
        libelle: "",
        categorie: "PIECE_CLIENT",
        niveau: "OBLIGATOIRE",
        partieConcernee: "TOUTES",
        sourceAttendue: "CLIENT",
      });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    }
    setBusy(false);
  }

  async function addFormalite() {
    setBusy(true);
    setError("");
    try {
      await call(`/api/transactions/${t.id}/formalites`, "POST", {
        ...newForm,
        demarcheId: newForm.demarcheId || null,
      });
      setNewForm({ entite: "NOTAIRE", bureau: "", objet: "", niveauObligation: "CONDITIONNELLE", demarcheId: "" });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    }
    setBusy(false);
  }

  async function patchFormalite(id: string, payload: any) {
    await call(`/api/transactions/${t.id}/formalites/${id}`, "PATCH", payload);
    await refresh();
  }

  async function addPaiement() {
    setBusy(true);
    setError("");
    try {
      await call(`/api/transactions/${t.id}/paiements`, "POST", {
        ...newPay,
        montant: parseInt(newPay.montant, 10),
        formaliteId: newPay.formaliteId || null,
      });
      setNewPay({ nature: "HONORAIRES_CABINET", libelle: "", montant: "", payeur: "", beneficiaire: "", mode: "VIREMENT", reference: "", date: new Date().toISOString().slice(0, 10), formaliteId: "" });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    }
    setBusy(false);
  }

  async function toggleRapproche(id: string, rapproche: boolean) {
    await call(`/api/transactions/${t.id}/paiements/${id}`, "PATCH", { rapproche });
    await refresh();
  }

  // --- Échéances ---
  async function genererEcheances() {
    setBusy(true);
    setError("");
    try {
      await call(`/api/transactions/${t.id}/echeances`, "POST", {
        generer: true,
        nature: "LOYER",
        periode: new Date().toISOString().slice(0, 10),
        montantDu: 0,
      });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    }
    setBusy(false);
  }

  async function addEcheance() {
    setBusy(true);
    setError("");
    try {
      await call(`/api/transactions/${t.id}/echeances`, "POST", {
        nature: newEch.nature,
        periode: newEch.periode || new Date().toISOString().slice(0, 10),
        jourEcheance: newEch.jourEcheance ? parseInt(newEch.jourEcheance, 10) : null,
        montantDu: parseInt(newEch.montantDu, 10) || 0,
        beneficiaire: newEch.beneficiaire || null,
      });
      setNewEch({ nature: "LOYER", periode: "", jourEcheance: "", montantDu: "", beneficiaire: "" });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    }
    setBusy(false);
  }

  async function payerEcheance(id: string, montant: string, mode: string) {
    setBusy(true);
    setError("");
    try {
      const e = echeances.find((x) => x.id === id);
      await call(`/api/transactions/${t.id}/echeances/${id}`, "PATCH", {
        montantPaye: parseInt(montant, 10),
        modePaiement: mode || null,
        enregistrerPaiement: true,
      });
      setPayEch(null);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    }
    setBusy(false);
  }

  async function annulerEcheance(id: string) {
    if (!confirm("Annuler / retirer cette échéance ?")) return;
    await call(`/api/transactions/${t.id}/echeances/${id}`, "DELETE");
    await refresh();
  }

  // --- État des lieux ---
  function ouvrirEtatLieux(existant?: any) {
    const base = existant || {
      typeLocation: "VIDE",
      statut: "BROUILLON",
      dateEntree: t.dateEffet ? String(t.dateEffet).slice(0, 10) : "",
      dateSortie: "",
      nbCles: "",
      nbPieces: "",
      etage: "",
      surface: "",
      dependances: "",
      compteurEau: "",
      compteurElectricite: "",
      representant: "",
      observations: "",
    };
    setElForm({
      ...base,
      dateEntree: base.dateEntree ? String(base.dateEntree).slice(0, 10) : "",
      dateSortie: base.dateSortie ? String(base.dateSortie).slice(0, 10) : "",
    });
    setElLignes(
      (existant?.lignes || []).map((l: any) => ({
        objet: l.objet,
        emplacement: l.emplacement || "",
        typeElement: l.typeElement || "",
        quantiteEntree: l.quantiteEntree ?? "",
        etatEntree: l.etatEntree || "",
        obsEntree: l.obsEntree || "",
        quantiteSortie: l.quantiteSortie ?? "",
        etatSortie: l.etatSortie || "",
        obsSortie: l.obsSortie || "",
      }))
    );
  }

  async function saveEtatLieux(statut?: string) {
    if (!elForm) return;
    setBusy(true);
    setError("");
    try {
      const payload = {
        ...elForm,
        statut: statut || elForm.statut || "BROUILLON",
        nbCles: elForm.nbCles ? parseInt(elForm.nbCles, 10) : null,
        nbPieces: elForm.nbPieces ? parseInt(elForm.nbPieces, 10) : null,
        surface: elForm.surface ? parseFloat(elForm.surface) : null,
        lignes: elLignes
          .filter((l) => l.objet)
          .map((l, i) => ({
            ...l,
            ordre: i,
            quantiteEntree: l.quantiteEntree === "" ? null : parseInt(l.quantiteEntree, 10),
            quantiteSortie: l.quantiteSortie === "" ? null : parseInt(l.quantiteSortie, 10),
            etatEntree: l.etatEntree || null,
            etatSortie: l.etatSortie || null,
          })),
      };
      if (elForm.id) {
        await call(`/api/transactions/${t.id}/etats-lieux/${elForm.id}`, "PATCH", payload);
      } else {
        await call(`/api/transactions/${t.id}/etats-lieux`, "POST", payload);
      }
      setElForm(null);
      setElLignes([]);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    }
    setBusy(false);
  }

  async function retirerEtatLieux(id: string) {
    if (!confirm("Retirer cette fiche d'état des lieux ?")) return;
    await call(`/api/transactions/${t.id}/etats-lieux/${id}`, "DELETE");
    await refresh();
  }

  async function addEvenement() {
    setBusy(true);
    setError("");
    try {
      await call(`/api/transactions/${t.id}/evenements`, "POST", {
        ...evt,
        date: evt.date || null,
      });
      setEvt({ type: "NOTE", description: "", date: "" });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    }
    setBusy(false);
  }

  async function genererPdf(apercu: boolean) {
    setGenBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/transactions/${t.id}/pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modeleId: modeleId || undefined,
          variables: modeleVars,
          publieClient,
          apercu,
          confidentiel,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(typeof j.error === "string" ? j.error : "Erreur de génération");
      }
      const blob = await res.blob();
      window.open(URL.createObjectURL(blob), "_blank");
      if (!apercu) await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    }
    setGenBusy(false);
  }

  const modeleChoisi = modeles.find((m) => m.id === modeleId);
  const modeleVariables = modeleChoisi ? extractTemplateVariables(modeleChoisi.contenu) : [];

  return (
    <div className="space-y-4">
      {/* En-tête */}
      <div className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold">{t.reference}</h1>
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  TRANSACTION_STATUT_BADGES[t.statut] || "bg-gray-100 text-gray-700"
                }`}
              >
                {TRANSACTION_STATUT_LABELS[t.statut] || t.statut}
              </span>
              {estBloquee && t.blocageMotif && (
                <span className="text-xs text-red-600">⛔ {t.blocageMotif}</span>
              )}
            </div>
            <p className="mt-1 text-sm text-gray-600">
              {t.type?.libelle}
              {t.sousType ? ` — ${t.sousType}` : ""}
              {t.objet ? ` · ${t.objet}` : ""}
            </p>
            <p className="mt-0.5 text-xs text-gray-500">
              Dossier{" "}
              <Link href={`/cabinet/dossiers/${t.dossierId}`} className="text-cabinet-700 hover:underline">
                {t.dossier.referenceInterne}
              </Link>{" "}
              — {t.dossier.client.raisonSociale}
              {t.notaireNom ? ` · Notaire : ${t.notaireNom}` : ""}
            </p>
          </div>
          <div className="text-right text-xs text-gray-500">
            <div>Créée le {fmt(t.createdAt)}</div>
            {t.type?.mutationFonciere && (
              <div className="mt-1">
                Mutation livre foncier :{" "}
                {t.mutationInscrite ? (
                  <span className="font-medium text-emerald-700">
                    inscrite le {fmt(t.mutationInscriteLe)}
                  </span>
                ) : (
                  <span className="font-medium text-amber-700">non achevée</span>
                )}
              </div>
            )}
            {valideParNom && <div className="mt-1">Validée par {valideParNom}</div>}
          </div>
        </div>
        {t.type?.avertissement && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            ⚠️ {t.type.avertissement}
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Onglets */}
      <div className="flex flex-wrap gap-1 border-b">
        {tabsVisibles.map((tb) => (
          <button
            key={tb.id}
            type="button"
            onClick={() => setTab(tb.id)}
            className={`rounded-t px-4 py-2 text-sm font-medium transition ${
              tab === tb.id
                ? "bg-cabinet-800 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {tb.label}
            {tb.id === "pieces" && manquantes.length > 0 && (
              <span className="ml-1.5 rounded-full bg-red-500 px-1.5 text-[10px] text-white">
                {manquantes.length}
              </span>
            )}
            {tb.id === "paiements" && paiementsNonRapproches > 0 && (
              <span className="ml-1.5 rounded-full bg-amber-500 px-1.5 text-[10px] text-white">
                {paiementsNonRapproches}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ============ VUE D'ENSEMBLE ============ */}
      {tab === "apercu" && (
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Progression du workflow */}
          <div className="card p-5 lg:col-span-2">
            <h2 className="mb-3 font-semibold">Progression</h2>
            <ol className="space-y-1.5 text-sm">
              {(TRANSACTION_TRANSITIONS[workflow]
                ? Object.keys(TRANSACTION_TRANSITIONS[workflow]).filter(
                    (s) => !BLOQUES.has(s) && !["ANNULEE", "ARCHIVE"].includes(s)
                  )
                : []
              ).map((s) => {
                const atteint =
                  Object.keys(TRANSACTION_TRANSITIONS[workflow]).filter(
                    (x) => !BLOQUES.has(x) && !["ANNULEE", "ARCHIVE"].includes(x)
                  ).indexOf(s) <=
                  Object.keys(TRANSACTION_TRANSITIONS[workflow])
                    .filter((x) => !BLOQUES.has(x) && !["ANNULEE", "ARCHIVE"].includes(x))
                    .indexOf(t.statut);
                return (
                  <li
                    key={s}
                    className={`flex items-center gap-2 ${
                      s === t.statut ? "font-semibold text-cabinet-800" : atteint ? "text-emerald-700" : "text-gray-400"
                    }`}
                  >
                    <span
                      className={`inline-block h-2.5 w-2.5 rounded-full ${
                        s === t.statut ? "bg-cabinet-700" : atteint ? "bg-emerald-500" : "bg-gray-300"
                      }`}
                    />
                    {TRANSACTION_STATUT_LABELS[s] || s}
                  </li>
                );
              })}
            </ol>
          </div>

          {/* Actions / transitions */}
          <div className="card space-y-3 p-5">
            <h2 className="font-semibold">Actions</h2>
            {canWrite ? (
              <>
                <select className={inputCls} value={cible} onChange={(e) => setCible(e.target.value)}>
                  <option value="">— Choisir une étape —</option>
                  {transitions.map((s) => (
                    <option
                      key={s}
                      value={s}
                      disabled={TRANSITIONS_SENSIBLES.has(s) && !canValidate}
                    >
                      {TRANSACTION_STATUT_LABELS[s] || s}
                      {TRANSITIONS_SENSIBLES.has(s) && !canValidate ? " 🔒" : ""}
                    </option>
                  ))}
                </select>

                {cibleEstBlocage && (
                  <div>
                    <label className={labelCls}>Motif du blocage *</label>
                    <textarea
                      className={inputCls}
                      rows={2}
                      value={motifBlocage}
                      onChange={(e) => setMotifBlocage(e.target.value)}
                      placeholder="Documentez précisément la cause du blocage"
                    />
                  </div>
                )}

                {/* Champs de preuve selon l'étape */}
                {cible === "IDENTIFICATION_PARTIES" && isVenteTF && (
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={preuves.mandatSigne}
                      onChange={(e) => setPreuves({ ...preuves, mandatSigne: e.target.checked })}
                    />
                    Mandat du cabinet signé et archivé
                  </label>
                )}
                {cible === "DOSSIER_NOTARIAL_A_COMPLETER" && (
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={preuves.etatDroitsReelsObtenu}
                      onChange={(e) =>
                        setPreuves({ ...preuves, etatDroitsReelsObtenu: e.target.checked })
                      }
                    />
                    État des droits réels obtenu (Conservation)
                  </label>
                )}
                {cible === "SIGNATURE_NOTARIALE_PLANIFIEE" && (
                  <div className="space-y-2">
                    <input
                      className={inputCls}
                      placeholder="Notaire territorialement compétent *"
                      value={preuves.notaireNom}
                      onChange={(e) => setPreuves({ ...preuves, notaireNom: e.target.value })}
                    />
                    <input
                      className={inputCls}
                      placeholder="Étude notariale"
                      value={preuves.notaireEtude}
                      onChange={(e) => setPreuves({ ...preuves, notaireEtude: e.target.value })}
                    />
                  </div>
                )}
                {cible === "ACTE_NOTARIE_SIGNE" && (
                  <div className="space-y-2">
                    <div>
                      <label className={labelCls}>Date de signature *</label>
                      <input
                        type="date"
                        className={inputCls}
                        value={preuves.acteSigneLe}
                        onChange={(e) => setPreuves({ ...preuves, acteSigneLe: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Acte notarié signé (GED) *</label>
                      <select
                        className={inputCls}
                        value={preuves.documentActeId}
                        onChange={(e) => setPreuves({ ...preuves, documentActeId: e.target.value })}
                      >
                        <option value="">— Choisir le document —</option>
                        {documents.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.nom}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
                {cible === "DEPOT_CONSERVATION_EFFECTUE" && (
                  <div>
                    <label className={labelCls}>Date de dépôt à la Conservation *</label>
                    <input
                      type="date"
                      className={inputCls}
                      value={preuves.depotConservationLe}
                      onChange={(e) => setPreuves({ ...preuves, depotConservationLe: e.target.value })}
                    />
                  </div>
                )}
                {cible === "MUTATION_INSCRITE" && (
                  <div className="space-y-2">
                    <div>
                      <label className={labelCls}>Date d'inscription au livre foncier *</label>
                      <input
                        type="date"
                        className={inputCls}
                        value={preuves.mutationInscriteLe}
                        onChange={(e) =>
                          setPreuves({ ...preuves, mutationInscriteLe: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Preuve d'inscription (GED) *</label>
                      <select
                        className={inputCls}
                        value={preuves.documentMutationId}
                        onChange={(e) =>
                          setPreuves({ ...preuves, documentMutationId: e.target.value })
                        }
                      >
                        <option value="">— Choisir le document —</option>
                        {documents.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.nom}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
                {cible === "CONTROLE_DESTINATION_ET_USAGE" && (
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={preuves.droitDeLouerVerifie}
                      onChange={(e) =>
                        setPreuves({ ...preuves, droitDeLouerVerifie: e.target.checked })
                      }
                    />
                    Droit de louer du bailleur vérifié
                  </label>
                )}
                {cible === "BAIL_EN_COURS" && (
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={preuves.etatLieuxEntreeFait}
                      onChange={(e) =>
                        setPreuves({ ...preuves, etatLieuxEntreeFait: e.target.checked })
                      }
                    />
                    État des lieux d'entrée réalisé
                  </label>
                )}
                {cible === "DOSSIER_REMIS_CLIENT" && (
                  <div>
                    <label className={labelCls}>Date de remise du dossier au client *</label>
                    <input
                      type="date"
                      className={inputCls}
                      value={preuves.remisAuClientLe}
                      onChange={(e) => setPreuves({ ...preuves, remisAuClientLe: e.target.value })}
                    />
                  </div>
                )}
                {manquantes.length > 0 && ["COLLECTE_PIECES", "DOSSIER_NOTARIAL_A_COMPLETER", "PROJET_BAIL", "VALIDATION_JURIDIQUE"].includes(cible) && (
                  <div>
                    <label className={labelCls}>
                      Dérogation motivée ({manquantes.length} pièce(s) manquante(s))
                    </label>
                    <textarea
                      className={inputCls}
                      rows={2}
                      value={derogationMotif}
                      onChange={(e) => setDerogationMotif(e.target.value)}
                      placeholder="Motif justifiant l'absence des pièces"
                    />
                  </div>
                )}
                <input
                  className={inputCls}
                  placeholder="Note (optionnel)"
                  value={noteTransition}
                  onChange={(e) => setNoteTransition(e.target.value)}
                />
                <button
                  type="button"
                  className="btn-primary w-full py-2 text-sm"
                  disabled={!cible || busy}
                  onClick={() => doTransition(cible)}
                >
                  {busy ? "…" : `Passer à « ${TRANSACTION_STATUT_LABELS[cible] || cible} »`}
                </button>
              </>
            ) : (
              <p className="text-sm text-gray-500">Lecture seule.</p>
            )}
          </div>

          {/* Récap financier / notarial */}
          <div className="card space-y-2 p-5 lg:col-span-3">
            <h2 className="font-semibold">Synthèse</h2>
            <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
              {t.prix != null && (
                <div>
                  <div className="text-xs text-gray-500">Prix de vente</div>
                  <div className="font-semibold">{money(t.prix, t.devise)}</div>
                </div>
              )}
              {t.loyer != null && (
                <div>
                  <div className="text-xs text-gray-500">Loyer</div>
                  <div className="font-semibold">{money(t.loyer, t.devise)}/mois</div>
                  {t.chargesMensuelles != null && !t.chargesIncluses && (
                    <div className="text-[10px] text-gray-400">+ {money(t.chargesMensuelles, t.devise)} charges</div>
                  )}
                  {t.chargesIncluses && <div className="text-[10px] text-gray-400">charges incluses</div>}
                </div>
              )}
              {t.depotGarantie != null && (
                <div>
                  <div className="text-xs text-gray-500">Dépôt de garantie</div>
                  <div className="font-semibold">{money(t.depotGarantie, t.devise)}</div>
                </div>
              )}
              {t.commissionValeur != null && (
                <div>
                  <div className="text-xs text-gray-500">Commission cabinet</div>
                  <div className="font-semibold">
                    {t.commissionValeur}{t.commissionType === "POURCENTAGE" ? " %" : ` ${t.devise}`}
                    {t.commissionBase ? ` (${t.commissionBase})` : ""}
                  </div>
                  {commissionMensuelle(t) > 0 && (
                    <div className="text-[10px] text-gray-400">
                      ≈ {money(commissionMensuelle(t), t.devise)}/mois · net bailleur{" "}
                      {money((t.loyer ?? 0) + (t.chargesIncluses ? 0 : t.chargesMensuelles ?? 0) - commissionMensuelle(t), t.devise)}
                    </div>
                  )}
                </div>
              )}
              {t.typeMandat && (
                <div>
                  <div className="text-xs text-gray-500">Type de mandat</div>
                  <div className="font-semibold">
                    {TYPES_MANDAT.find((m) => m.code === t.typeMandat)?.label || t.typeMandat}
                  </div>
                </div>
              )}
              {(t.honorairesAgence != null || t.netVendeur != null || t.fraisNotaire != null) && (
                <div className="sm:col-span-2 lg:col-span-2">
                  <div className="text-xs text-gray-500">Décomposition du prix</div>
                  <div className="text-xs">
                    Net vendeur {money(t.netVendeur, t.devise)} · honoraires {money(t.honorairesAgence, t.devise)}
                    {t.tva != null ? ` · TVA ${money(t.tva, t.devise)}` : ""}
                    {t.taxesMunicipales != null ? ` · taxes ${money(t.taxesMunicipales, t.devise)}` : ""}
                    {t.fraisNotaire != null ? ` · frais notaire ${money(t.fraisNotaire, t.devise)}` : ""}
                  </div>
                </div>
              )}
              {t.jourEcheanceLoyer != null && (
                <div>
                  <div className="text-xs text-gray-500">Échéance loyer</div>
                  <div className="font-semibold">Le {t.jourEcheanceLoyer} du mois</div>
                  {t.modePaiementLoyer && (
                    <div className="text-[10px] text-gray-400">
                      {MODES_PAIEMENT.find((m) => m.code === t.modePaiementLoyer)?.label || t.modePaiementLoyer}
                    </div>
                  )}
                </div>
              )}
              <div>
                <div className="text-xs text-gray-500">Honoraires cabinet</div>
                <div className="font-semibold">{money(t.honoraires, t.devise)}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Débours / avances</div>
                <div className="font-semibold">
                  {money(t.debours, t.devise)} / {money(t.avancesRecues, t.devise)}
                </div>
              </div>
              {t.notaireNom && (
                <div>
                  <div className="text-xs text-gray-500">Notaire</div>
                  <div>{t.notaireNom} {t.notaireEtude ? `(${t.notaireEtude})` : ""}</div>
                </div>
              )}
              {isVenteTF && (
                <>
                  <div>
                    <div className="text-xs text-gray-500">Mandat cabinet</div>
                    <div>{t.mandatSigne ? "✓ signé" : "— non signé"}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Dépôt Conservation</div>
                    <div>{t.depotConservationLe ? fmt(t.depotConservationLe) : "—"}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Mutation livre foncier</div>
                    <div>
                      {t.mutationInscrite ? `✓ ${fmt(t.mutationInscriteLe)}` : "— en attente"}
                    </div>
                  </div>
                </>
              )}
              {isBail && (
                <>
                  <div>
                    <div className="text-xs text-gray-500">Droit de louer</div>
                    <div>{t.droitDeLouerVerifie ? "✓ vérifié" : "— non vérifié"}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">États des lieux</div>
                    <div>
                      Entrée {t.etatLieuxEntreeFait ? "✓" : "—"} · Sortie{" "}
                      {t.etatLieuxSortieFait ? "✓" : "—"}
                    </div>
                  </div>
                </>
              )}
            </div>
            {t.conditionsSuspensives && (
              <p className="mt-2 text-xs text-gray-600">
                <strong>Conditions suspensives :</strong> {t.conditionsSuspensives}
              </p>
            )}
            {Array.isArray(t.clausesParticulieres) && t.clausesParticulieres.length > 0 && (
              <div className="mt-2 text-xs text-gray-600">
                <strong>Clauses particulières :</strong>
                <ul className="mt-1 list-inside list-disc">
                  {t.clausesParticulieres.map((c: string, i: number) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============ PARTIES ============ */}
      {tab === "parties" && (
        <div className="card p-5">
          <h2 className="mb-3 font-semibold">Parties à la transaction</h2>
          <p className="mb-3 text-xs text-gray-500">
            Le cabinet n&apos;est jamais partie au contrat : il intervient comme
            conseil et intermédiaire (clause insérée dans les documents générés).
          </p>
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs text-gray-600">
              <tr>
                <th className="px-3 py-2">Rôle</th>
                <th className="px-3 py-2">Partie</th>
                <th className="px-3 py-2">Qualité</th>
                <th className="px-3 py-2">Contact / représentant</th>
                {canWrite && <th className="px-3 py-2"></th>}
              </tr>
            </thead>
            <tbody>
              {(t.parties || []).map((p: any) => (
                <tr key={p.id} className="border-b">
                  <td className="px-3 py-2">
                    <span className="rounded bg-cabinet-100 px-2 py-0.5 text-xs font-medium text-cabinet-800">
                      {TRX_PARTIE_ROLES.find((r) => r.code === p.role)?.label || p.role}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-medium">{partieLabel(p)}</td>
                  <td className="px-3 py-2 text-xs">{p.qualite || "—"}</td>
                  <td className="px-3 py-2 text-xs">
                    {p.demandeur?.telephone || p.coordonnees || "—"}
                    {p.representePar ? ` · repr. ${p.representePar}` : ""}
                  </td>
                  {canWrite && (
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        className="text-xs text-red-600 hover:underline"
                        onClick={() => removePartie(p.id)}
                      >
                        Retirer
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {t.parties?.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-sm text-gray-500">
                    Aucune partie enregistrée.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {canWrite && (
            <div className="mt-4 grid items-end gap-3 rounded-lg border border-gray-200 p-3 sm:grid-cols-5">
              <div>
                <label className={labelCls}>Rôle</label>
                <select
                  className={inputCls}
                  value={newPartie.role}
                  onChange={(e) => setNewPartie({ ...newPartie, role: e.target.value })}
                >
                  {TRX_PARTIE_ROLES.map((r) => (
                    <option key={r.code} value={r.code}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>Demandeur existant</label>
                <select
                  className={inputCls}
                  value={newPartie.demandeurId}
                  onChange={(e) => setNewPartie({ ...newPartie, demandeurId: e.target.value })}
                >
                  <option value="">— ou nom libre —</option>
                  {demandeurs.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.typePersonne === "MORALE"
                        ? d.raisonSociale || d.nom
                        : [d.civilite, d.prenoms, d.nom].filter(Boolean).join(" ")}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Nom libre</label>
                <input
                  className={inputCls}
                  value={newPartie.nomLibre}
                  onChange={(e) => setNewPartie({ ...newPartie, nomLibre: e.target.value })}
                />
              </div>
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label className={labelCls}>Qualité</label>
                  <input
                    className={inputCls}
                    value={newPartie.qualite}
                    onChange={(e) => setNewPartie({ ...newPartie, qualite: e.target.value })}
                  />
                </div>
                <button
                  type="button"
                  className="btn-primary px-3 py-2 text-xs"
                  disabled={busy || (!newPartie.demandeurId && !newPartie.nomLibre.trim())}
                  onClick={addPartie}
                >
                  Ajouter
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============ PIÈCES ============ */}
      {tab === "pieces" && (
        <div className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Check-list des pièces</h2>
            {manquantes.length > 0 && (
              <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-800">
                {manquantes.length} obligatoire(s) manquante(s)
              </span>
            )}
          </div>
          {TRX_PIECE_CATEGORIES.map((cat) => {
            const items = (t.pieces || []).filter((p: any) => p.categorie === cat.code);
            if (!items.length) return null;
            return (
              <div key={cat.code} className="mb-4">
                <h3 className="mb-1 text-xs font-semibold uppercase text-gray-500">
                  {cat.label}
                </h3>
                <table className="w-full text-left text-sm">
                  <tbody>
                    {items.map((p: any) => {
                      const derogee = (t.derogations || []).some((d: any) => d.pieceId === p.id);
                      return (
                        <tr key={p.id} className="border-b">
                          <td className="px-2 py-2">
                            <div className="font-medium">{p.libelle}</div>
                            <div className="text-xs text-gray-500">
                              {PIECE_NIVEAUX.find((n) => n.code === p.niveau)?.label || p.niveau}
                              {p.partieConcernee !== "TOUTES" && ` · ${p.partieConcernee}`}
                              {p.condition && ` · ${p.condition}`}
                            </div>
                          </td>
                          <td className="px-2 py-2">
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs ${PIECE_STATUT_COLORS[p.statut] || ""}`}
                            >
                              {PIECE_STATUTS.find((s) => s.code === p.statut)?.label || p.statut}
                            </span>
                            {derogee && (
                              <span className="ml-1 text-xs text-violet-700" title="Dérogation motivée">
                                ⚑ dérogée
                              </span>
                            )}
                          </td>
                          {canWrite && (
                            <td className="px-2 py-2 text-right">
                              <div className="flex justify-end gap-1">
                                <select
                                  className="input w-auto px-1 py-0.5 text-xs"
                                  value={p.statut}
                                  onChange={(e) => setPieceStatut(p.id, e.target.value)}
                                >
                                  {PIECE_STATUTS.map((s) => (
                                    <option key={s.code} value={s.code}>
                                      {s.label}
                                    </option>
                                  ))}
                                </select>
                                {p.niveau === "OBLIGATOIRE" &&
                                  !["RECUE", "VALIDEE", "NON_APPLICABLE"].includes(p.statut) &&
                                  !derogee && (
                                    <button
                                      type="button"
                                      className="text-xs text-violet-700 hover:underline"
                                      onClick={() => setDerogPiece({ id: p.id, libelle: p.libelle })}
                                    >
                                      Déroger
                                    </button>
                                  )}
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })}

          {derogPiece && (
            <div className="mt-3 rounded-lg border border-violet-200 bg-violet-50 p-3">
              <p className="mb-2 text-xs font-medium text-violet-800">
                Dérogation motivée : {derogPiece.libelle}
              </p>
              <div className="flex gap-2">
                <input
                  className={inputCls}
                  placeholder="Motif de la dérogation (obligatoire)"
                  value={derogPieceMotif}
                  onChange={(e) => setDerogPieceMotif(e.target.value)}
                />
                <button
                  type="button"
                  className="btn-primary px-3 py-2 text-xs"
                  disabled={derogPieceMotif.trim().length < 5}
                  onClick={async () => {
                    await call(`/api/transactions/${t.id}/pieces/${derogPiece.id}`, "PATCH", {
                      statut: "NON_APPLICABLE",
                      commentaire: `Dérogation : ${derogPieceMotif}`,
                    });
                    setDerogPiece(null);
                    setDerogPieceMotif("");
                    await refresh();
                  }}
                >
                  Valider
                </button>
                <button
                  type="button"
                  className="btn-secondary px-3 py-2 text-xs"
                  onClick={() => setDerogPiece(null)}
                >
                  Annuler
                </button>
              </div>
            </div>
          )}

          {canWrite && (
            <div className="mt-4 grid items-end gap-2 rounded-lg border border-gray-200 p-3 sm:grid-cols-6">
              <div className="sm:col-span-2">
                <label className={labelCls}>Libellé</label>
                <input
                  className={inputCls}
                  value={newPiece.libelle}
                  onChange={(e) => setNewPiece({ ...newPiece, libelle: e.target.value })}
                />
              </div>
              <div>
                <label className={labelCls}>Catégorie</label>
                <select
                  className={inputCls}
                  value={newPiece.categorie}
                  onChange={(e) => setNewPiece({ ...newPiece, categorie: e.target.value })}
                >
                  {TRX_PIECE_CATEGORIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Niveau</label>
                <select
                  className={inputCls}
                  value={newPiece.niveau}
                  onChange={(e) => setNewPiece({ ...newPiece, niveau: e.target.value })}
                >
                  {PIECE_NIVEAUX.map((n) => (
                    <option key={n.code} value={n.code}>
                      {n.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Partie concernée</label>
                <select
                  className={inputCls}
                  value={newPiece.partieConcernee}
                  onChange={(e) => setNewPiece({ ...newPiece, partieConcernee: e.target.value })}
                >
                  {["TOUTES", ...TRX_PARTIE_ROLES.map((r) => r.code), "CABINET"].map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <button
                  type="button"
                  className="btn-primary w-full py-2 text-xs"
                  disabled={busy || !newPiece.libelle.trim()}
                  onClick={() => {
                    setNewPiece({ ...newPiece, code: newPiece.libelle.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 40) });
                    setTimeout(addPiece, 0);
                  }}
                >
                  + Ajouter
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============ CONTRATS & DOCUMENTS ============ */}
      {tab === "contrats" && (
        <div className="card p-5">
          <h2 className="mb-3 font-semibold">Contrats, avant-contrats et courriers</h2>
          <p className="mb-3 text-xs text-gray-500">
            Tous les modèles insèrent la clause « INTERVENTION DU CABINET ».
            Aperçu obligatoire avant génération finale ; filigrane BROUILLON tant
            que le document n&apos;est pas finalisé.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Modèle</label>
              <select
                className={inputCls}
                value={modeleId}
                onChange={(e) => {
                  setModeleId(e.target.value);
                  setModeleVars({});
                }}
              >
                <option value="">— Choisir un modèle —</option>
                {modeles.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.titre} ({m.code})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end gap-4">
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={publieClient}
                  onChange={(e) => setPublieClient(e.target.checked)}
                />
                Publier dans l&apos;espace client
              </label>
              <label className="flex items-center gap-2 text-xs" title="Retire les sections encadrées par [[CONFIDENTIEL]] dans le modèle (ex. article de rémunération du cabinet)">
                <input
                  type="checkbox"
                  checked={confidentiel}
                  onChange={(e) => setConfidentiel(e.target.checked)}
                />
                Version confidentielle (sans article rémunération)
              </label>
            </div>
          </div>
          {modeleChoisi && modeleVariables.length > 0 && (
            <div className="mt-3 grid gap-2 rounded-lg border border-gray-200 p-3 sm:grid-cols-2">
              {modeleVariables.slice(0, 24).map((v: any) => (
                <div key={v.cle}>
                  <label className={labelCls}>{v.label || v.cle}</label>
                  {v.multiline ? (
                    <textarea
                      className={inputCls}
                      rows={2}
                      value={modeleVars[v.cle] || ""}
                      onChange={(e) =>
                        setModeleVars({ ...modeleVars, [v.cle]: e.target.value })
                      }
                    />
                  ) : (
                    <input
                      className={inputCls}
                      value={modeleVars[v.cle] || ""}
                      onChange={(e) =>
                        setModeleVars({ ...modeleVars, [v.cle]: e.target.value })
                      }
                    />
                  )}
                </div>
              ))}
            </div>
          )}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              className="btn-secondary px-4 py-2 text-sm"
              disabled={!modeleId || genBusy}
              onClick={() => genererPdf(true)}
            >
              👁 Aperçu (brouillon)
            </button>
            <button
              type="button"
              className="btn-primary px-4 py-2 text-sm"
              disabled={!modeleId || genBusy}
              onClick={() => genererPdf(false)}
            >
              {genBusy ? "Génération…" : "Générer et archiver dans la GED"}
            </button>
          </div>
          {t.statut && !["ACTE_NOTARIE_SIGNE","MUTATION_INSCRITE","ETAT_DROITS_REELS_FINAL_RECU","BAIL_EN_COURS","SUIVI_LOYERS_ET_QUITTANCES","EXECUTION_EN_COURS","DOSSIER_REMIS_CLIENT","CLOTURE"].includes(t.statut) && (
            <p className="mt-2 text-xs text-amber-700">
              ⚠️ Le document final portera le filigrane « BROUILLON » tant que la
              transaction n&apos;atteint pas l&apos;étape de signature / exécution.
            </p>
          )}
        </div>
      )}

      {/* ============ FORMALITÉS EXTERNES ============ */}
      {tab === "formalites" && (
        <div className="card p-5">
          <h2 className="mb-3 font-semibold">Formalités externes &amp; démarches liées</h2>
          <p className="mb-3 text-xs text-gray-500">
            Notaire, Conservation foncière, Enregistrement, Cadastre, Domaines,
            banque, géomètre… Chaque formalité peut être portée par une démarche
            administrative du dossier (workflow, check-lists et preuves du module
            Démarches).
          </p>
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs text-gray-600">
              <tr>
                <th className="px-3 py-2">Entité</th>
                <th className="px-3 py-2">Objet</th>
                <th className="px-3 py-2">Démarche liée</th>
                <th className="px-3 py-2">Statut</th>
                <th className="px-3 py-2">Dépôt / décision</th>
                {canWrite && <th className="px-3 py-2"></th>}
              </tr>
            </thead>
            <tbody>
              {(t.formalites || []).map((f: any) => (
                <tr key={f.id} className="border-b">
                  <td className="px-3 py-2 text-xs">
                    {FORMALITE_ENTITES.find((e) => e.code === f.entite)?.label || f.entite}
                    {f.bureau && <div className="text-gray-500">{f.bureau}</div>}
                  </td>
                  <td className="px-3 py-2">{f.objet}</td>
                  <td className="px-3 py-2 text-xs">
                    {f.demarche ? (
                      <Link href={`/cabinet/dossiers/demarches/${f.demarche.id}`} className="text-blue-600 hover:underline">
                        {f.demarche.reference}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {canWrite ? (
                      <select
                        className="input w-auto px-1 py-0.5 text-xs"
                        value={f.statut}
                        onChange={(e) => patchFormalite(f.id, { statut: e.target.value })}
                      >
                        {FORMALITE_STATUTS.map((s) => (
                          <option key={s.code} value={s.code}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      FORMALITE_STATUTS.find((s) => s.code === f.statut)?.label || f.statut
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {f.dateDepot && <div>Dépôt : {fmt(f.dateDepot)}</div>}
                    {f.numeroRecepisse && <div>Récépissé : {f.numeroRecepisse}</div>}
                    {f.decisionDate && <div>Décision : {fmt(f.decisionDate)}</div>}
                  </td>
                  {canWrite && (
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        className="text-xs text-red-600 hover:underline"
                        onClick={() => {
                          if (confirm("Retirer cette formalité ?"))
                            call(`/api/transactions/${t.id}/formalites/${f.id}`, "DELETE").then(refresh);
                        }}
                      >
                        Retirer
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {t.formalites?.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-sm text-gray-500">
                    Aucune formalité externe.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {(t.demarches || []).length > 0 && (
            <div className="mt-3 rounded-lg bg-sky-50 p-3 text-xs text-sky-800">
              <strong>Démarches rattachées à cette transaction :</strong>{" "}
              {t.demarches.map((d: any, i: number) => (
                <span key={d.id}>
                  {i > 0 && ", "}
                  <Link href={`/cabinet/dossiers/demarches/${d.id}`} className="font-medium underline">
                    {d.reference}
                  </Link>{" "}
                  ({d.type?.libelle})
                </span>
              ))}
            </div>
          )}

          {canWrite && (
            <div className="mt-4 grid items-end gap-2 rounded-lg border border-gray-200 p-3 sm:grid-cols-6">
              <div>
                <label className={labelCls}>Entité</label>
                <select
                  className={inputCls}
                  value={newForm.entite}
                  onChange={(e) => setNewForm({ ...newForm, entite: e.target.value })}
                >
                  {FORMALITE_ENTITES.map((e2) => (
                    <option key={e2.code} value={e2.code}>
                      {e2.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Bureau / étude</label>
                <input
                  className={inputCls}
                  value={newForm.bureau}
                  onChange={(e) => setNewForm({ ...newForm, bureau: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>Objet</label>
                <input
                  className={inputCls}
                  value={newForm.objet}
                  onChange={(e) => setNewForm({ ...newForm, objet: e.target.value })}
                  placeholder="État des droits réels, enregistrement, mutation…"
                />
              </div>
              <div>
                <label className={labelCls}>Démarche liée</label>
                <select
                  className={inputCls}
                  value={newForm.demarcheId}
                  onChange={(e) => setNewForm({ ...newForm, demarcheId: e.target.value })}
                >
                  <option value="">— aucune —</option>
                  {demarchesDossier.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.reference} — {d.type?.libelle}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <button
                  type="button"
                  className="btn-primary w-full py-2 text-xs"
                  disabled={busy || !newForm.objet.trim()}
                  onClick={addFormalite}
                >
                  + Ajouter
                </button>
              </div>
            </div>
          )}
          {canWrite && (
            <div className="mt-2 text-xs text-gray-500">
              💡 Pour créer une démarche administrative portant la formalité :{" "}
              <Link
                href={`/cabinet/dossiers/demarches/nouveau?dossierId=${t.dossierId}&objet=${encodeURIComponent(
                  `${t.type?.libelle || "Transaction"} ${t.reference}`
                )}`}
                className="text-cabinet-700 underline"
              >
                ouvrir le wizard démarche pré-rempli
              </Link>{" "}
              puis liez-la à la formalité.
            </div>
          )}
        </div>
      )}

      {/* ============ PAIEMENTS ============ */}
      {tab === "paiements" && (
        <div className="card p-5">
          <h2 className="mb-1 font-semibold">Paiements et fonds</h2>
          <p className="mb-3 text-xs text-gray-500">
            Chaque paiement indique son bénéficiaire réel. Les fonds clients, les
            sommes du notaire / de l&apos;administration et les débours ne sont
            jamais des honoraires du cabinet. Les paiements non rapprochés
            bloquent la clôture.
          </p>
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs text-gray-600">
              <tr>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Nature</th>
                <th className="px-3 py-2">Montant</th>
                <th className="px-3 py-2">Payeur → Bénéficiaire</th>
                <th className="px-3 py-2">Réf.</th>
                <th className="px-3 py-2">Rapproché</th>
              </tr>
            </thead>
            <tbody>
              {(t.paiements || []).map((p: any) => (
                <tr key={p.id} className="border-b">
                  <td className="px-3 py-2 text-xs">{fmt(p.date)}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded px-1.5 py-0.5 text-xs ${
                        PAIEMENT_NATURES_CABINET.includes(p.nature)
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {PAIEMENT_NATURES.find((n) => n.code === p.nature)?.label || p.nature}
                    </span>
                    {p.libelle && <div className="text-xs text-gray-500">{p.libelle}</div>}
                  </td>
                  <td className="px-3 py-2 font-medium">{money(p.montant, p.devise)}</td>
                  <td className="px-3 py-2 text-xs">
                    {p.payeur || "—"} → {p.beneficiaire || "—"}
                    {p.mode && <div className="text-gray-400">{p.mode}</div>}
                  </td>
                  <td className="px-3 py-2 text-xs">{p.reference || "—"}</td>
                  <td className="px-3 py-2">
                    {canWrite ? (
                      <input
                        type="checkbox"
                        checked={p.rapproche}
                        onChange={(e) => toggleRapproche(p.id, e.target.checked)}
                      />
                    ) : (
                      p.rapproche ? "✓" : "—"
                    )}
                  </td>
                </tr>
              ))}
              {t.paiements?.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-sm text-gray-500">
                    Aucun paiement tracé.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {canWrite && (
            <div className="mt-4 grid items-end gap-2 rounded-lg border border-gray-200 p-3 sm:grid-cols-4">
              <div>
                <label className={labelCls}>Nature</label>
                <select
                  className={inputCls}
                  value={newPay.nature}
                  onChange={(e) => setNewPay({ ...newPay, nature: e.target.value })}
                >
                  {PAIEMENT_NATURES.map((n) => (
                    <option key={n.code} value={n.code}>
                      {n.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Montant *</label>
                <input
                  type="number"
                  className={inputCls}
                  value={newPay.montant}
                  onChange={(e) => setNewPay({ ...newPay, montant: e.target.value })}
                />
              </div>
              <div>
                <label className={labelCls}>Payeur</label>
                <input
                  className={inputCls}
                  value={newPay.payeur}
                  onChange={(e) => setNewPay({ ...newPay, payeur: e.target.value })}
                />
              </div>
              <div>
                <label className={labelCls}>
                  Bénéficiaire réel {!PAIEMENT_NATURES_CABINET.includes(newPay.nature) && "*"}
                </label>
                <input
                  className={inputCls}
                  value={newPay.beneficiaire}
                  onChange={(e) => setNewPay({ ...newPay, beneficiaire: e.target.value })}
                />
              </div>
              <div>
                <label className={labelCls}>Mode</label>
                <select
                  className={inputCls}
                  value={newPay.mode}
                  onChange={(e) => setNewPay({ ...newPay, mode: e.target.value })}
                >
                  <option value="ESPECE">Espèces</option>
                  <option value="VIREMENT">Virement</option>
                  <option value="CHEQUE">Chèque</option>
                  <option value="MOBILE_MONEY">Mobile money</option>
                  <option value="SEQUESTRE">Séquestre</option>
                  <option value="AUTRE">Autre</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Date</label>
                <input
                  type="date"
                  className={inputCls}
                  value={newPay.date}
                  onChange={(e) => setNewPay({ ...newPay, date: e.target.value })}
                />
              </div>
              <div>
                <label className={labelCls}>Référence / quittance</label>
                <input
                  className={inputCls}
                  value={newPay.reference}
                  onChange={(e) => setNewPay({ ...newPay, reference: e.target.value })}
                />
              </div>
              <div>
                <button
                  type="button"
                  className="btn-primary w-full py-2 text-xs"
                  disabled={busy || !newPay.montant}
                  onClick={addPaiement}
                >
                  + Enregistrer le paiement
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============ ÉCHÉANCES & VERSEMENTS ============ */}
      {tab === "echeances" && (
        <div className="card p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">Échéancier du bail</h2>
              <p className="text-xs text-gray-500">
                Loyers, charges et reversements bailleur (nets de commission cabinet).
              </p>
            </div>
            {canWrite && isBail && (
              <button type="button" className="btn-secondary px-3 py-1.5 text-xs" disabled={busy}
                onClick={genererEcheances}>
                ⚙ Générer l&apos;échéancier ({t.dureeMois || 12} mois)
              </button>
            )}
          </div>

          {/* KPI */}
          <div className="mb-4 grid gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-gray-200 p-3">
              <div className="text-xs text-gray-500">Loyer mensuel</div>
              <div className="text-lg font-semibold">{money(t.loyer)}</div>
              {t.chargesMensuelles ? (
                <div className="text-[10px] text-gray-400">+ {money(t.chargesMensuelles)} charges</div>
              ) : null}
            </div>
            <div className="rounded-lg border border-gray-200 p-3">
              <div className="text-xs text-gray-500">Total perçu</div>
              <div className="text-lg font-semibold text-emerald-700">{money(totalPaye)}</div>
            </div>
            <div className="rounded-lg border border-gray-200 p-3">
              <div className="text-xs text-gray-500">Impayés / à percevoir</div>
              <div className="text-lg font-semibold text-red-700">{money(impayes)}</div>
            </div>
            <div className="rounded-lg border border-gray-200 p-3">
              <div className="text-xs text-gray-500">Avancement</div>
              <div className="text-lg font-semibold">
                {totalDu ? `${Math.round((totalPaye / totalDu) * 100)} %` : "—"}
              </div>
            </div>
          </div>

          {/* Table loyers/charges */}
          <h3 className="mb-2 text-sm font-semibold">Échéances locataire</h3>
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs text-gray-600">
              <tr>
                <th className="px-3 py-2">Période</th>
                <th className="px-3 py-2">Échéance</th>
                <th className="px-3 py-2">Nature</th>
                <th className="px-3 py-2">Montant dû</th>
                <th className="px-3 py-2">Payé</th>
                <th className="px-3 py-2">Statut</th>
                {canWrite && <th className="px-3 py-2"></th>}
              </tr>
            </thead>
            <tbody>
              {echeancesLoyer.map((e) => (
                <tr key={e.id} className="border-b">
                  <td className="px-3 py-2 text-xs">
                    {new Date(e.periode).toLocaleDateString("fr-FR", { month: "short", year: "numeric" })}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-500">
                    {e.jourEcheance ? `le ${e.jourEcheance}` : "—"}
                  </td>
                  <td className="px-3 py-2 text-xs">{e.nature === "LOYER" ? "Loyer" : e.nature === "CHARGES" ? "Charges" : "Autre"}</td>
                  <td className="px-3 py-2 font-medium">{money(e.montantDu)}</td>
                  <td className="px-3 py-2 text-xs">
                    {e.montantPaye > 0 ? money(e.montantPaye) : "—"}
                    {e.payeLe && <div className="text-gray-400">{fmt(e.payeLe)}</div>}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`rounded px-1.5 py-0.5 text-xs ${
                      e.statut === "PAYE" ? "bg-emerald-100 text-emerald-700"
                      : e.statut === "PARTIEL" ? "bg-amber-100 text-amber-700"
                      : e.statut === "ANNULE" ? "bg-gray-200 text-gray-500"
                      : "bg-blue-100 text-blue-700"
                    }`}>
                      {ECHEANCE_STATUTS_LABELS[e.statut] || e.statut}
                    </span>
                  </td>
                  {canWrite && (
                    <td className="px-3 py-2 text-right text-xs">
                      {e.statut !== "PAYE" && e.statut !== "ANNULE" && (
                        <button type="button" className="text-emerald-700 hover:underline"
                          onClick={() => setPayEch({ id: e.id, montant: String(e.montantDu - e.montantPaye), mode: "VIREMENT" })}>
                          Encaisser
                        </button>
                      )}
                      {" "}
                      <button type="button" className="text-red-600 hover:underline"
                        onClick={() => annulerEcheance(e.id)}>
                        {e.montantPaye > 0 ? "Annuler" : "Retirer"}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {echeancesLoyer.length === 0 && (
                <tr><td colSpan={7} className="px-3 py-6 text-center text-sm text-gray-500">
                  Aucune échéance — utilisez « Générer l&apos;échéancier » ou ajoutez-en une.
                </td></tr>
              )}
            </tbody>
          </table>

          {/* Formulaire d'encaissement inline */}
          {payEch && (
            <div className="mt-3 grid items-end gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 sm:grid-cols-4">
              <div>
                <label className={labelCls}>Montant encaissé (FCFA)</label>
                <input type="number" className={inputCls} value={payEch.montant}
                  onChange={(e) => setPayEch({ ...payEch, montant: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>Mode</label>
                <select className={inputCls} value={payEch.mode}
                  onChange={(e) => setPayEch({ ...payEch, mode: e.target.value })}>
                  {MODES_PAIEMENT.map((m) => (
                    <option key={m.code} value={m.code}>{m.label}</option>
                  ))}
                </select>
              </div>
              <button type="button" className="btn-primary py-2 text-xs" disabled={busy}
                onClick={() => payerEcheance(payEch.id, payEch.montant, payEch.mode)}>
                Confirmer l&apos;encaissement
              </button>
              <button type="button" className="btn-secondary py-2 text-xs" onClick={() => setPayEch(null)}>
                Annuler
              </button>
            </div>
          )}

          {/* Versements bailleur */}
          <h3 className="mb-2 mt-6 text-sm font-semibold">
            Versements au propriétaire
            {commissionMensuelle(t) > 0 && (
              <span className="ml-2 text-xs font-normal text-gray-500">
                (loyer + charges − commission {t.commissionValeur}
                {t.commissionType === "POURCENTAGE" ? " %" : " F"} = {money((t.loyer ?? 0) + (t.chargesIncluses ? 0 : t.chargesMensuelles ?? 0) - commissionMensuelle(t))}/mois)
              </span>
            )}
          </h3>
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs text-gray-600">
              <tr>
                <th className="px-3 py-2">Période</th>
                <th className="px-3 py-2">Montant</th>
                <th className="px-3 py-2">Bénéficiaire</th>
                <th className="px-3 py-2">Statut</th>
                {canWrite && <th className="px-3 py-2"></th>}
              </tr>
            </thead>
            <tbody>
              {versements.map((e) => (
                <tr key={e.id} className="border-b">
                  <td className="px-3 py-2 text-xs">
                    {new Date(e.periode).toLocaleDateString("fr-FR", { month: "short", year: "numeric" })}
                  </td>
                  <td className="px-3 py-2 font-medium">{money(e.montantDu)}</td>
                  <td className="px-3 py-2 text-xs">{e.beneficiaire || "Bailleur"}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded px-1.5 py-0.5 text-xs ${
                      e.statut === "PAYE" ? "bg-emerald-100 text-emerald-700"
                      : e.statut === "ANNULE" ? "bg-gray-200 text-gray-500"
                      : "bg-blue-100 text-blue-700"
                    }`}>
                      {e.statut === "PAYE" ? "Versé" : ECHEANCE_STATUTS_LABELS[e.statut] || e.statut}
                    </span>
                    {e.payeLe && <div className="text-[10px] text-gray-400">{fmt(e.payeLe)}</div>}
                  </td>
                  {canWrite && (
                    <td className="px-3 py-2 text-right text-xs">
                      {e.statut !== "PAYE" && e.statut !== "ANNULE" && (
                        <button type="button" className="text-emerald-700 hover:underline"
                          onClick={() => setPayEch({ id: e.id, montant: String(e.montantDu - e.montantPaye), mode: "VIREMENT" })}>
                          Marquer versé
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
              {versements.length === 0 && (
                <tr><td colSpan={5} className="px-3 py-4 text-center text-sm text-gray-500">
                  Aucun versement — ils sont créés avec l&apos;échéancier si une commission est configurée.
                </td></tr>
              )}
            </tbody>
          </table>

          {/* Ajout manuel */}
          {canWrite && (
            <div className="mt-4 grid items-end gap-2 rounded-lg border border-gray-200 p-3 sm:grid-cols-6">
              <div>
                <label className={labelCls}>Nature</label>
                <select className={inputCls} value={newEch.nature}
                  onChange={(e) => setNewEch({ ...newEch, nature: e.target.value })}>
                  <option value="LOYER">Loyer</option>
                  <option value="CHARGES">Charges</option>
                  <option value="REVERSEMENT_BAILLEUR">Reversement bailleur</option>
                  <option value="AUTRE">Autre</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Période (mois)</label>
                <input type="month" className={inputCls} value={newEch.periode}
                  onChange={(e) => setNewEch({ ...newEch, periode: e.target.value ? `${e.target.value}-01` : "" })} />
              </div>
              <div>
                <label className={labelCls}>Jour</label>
                <input type="number" min={1} max={31} className={inputCls} value={newEch.jourEcheance}
                  onChange={(e) => setNewEch({ ...newEch, jourEcheance: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>Montant dû *</label>
                <input type="number" className={inputCls} value={newEch.montantDu}
                  onChange={(e) => setNewEch({ ...newEch, montantDu: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>Bénéficiaire</label>
                <input className={inputCls} value={newEch.beneficiaire}
                  onChange={(e) => setNewEch({ ...newEch, beneficiaire: e.target.value })} />
              </div>
              <button type="button" className="btn-primary py-2 text-xs" disabled={busy || !newEch.montantDu}
                onClick={addEcheance}>
                + Ajouter
              </button>
            </div>
          )}
        </div>
      )}

      {/* ============ ÉTAT DES LIEUX ============ */}
      {tab === "etatlieux" && (
        <div className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-semibold">États des lieux</h2>
              <p className="text-xs text-gray-500">
                Fiche d&apos;entrée et de sortie — la finalisation met à jour les gardes du workflow.
              </p>
            </div>
            {canWrite && !elForm && (
              <button type="button" className="btn-primary px-3 py-1.5 text-xs" onClick={() => ouvrirEtatLieux()}>
                + Nouvel état des lieux
              </button>
            )}
          </div>

          {/* Liste des fiches */}
          {!elForm && (
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs text-gray-600">
                <tr>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Entrée</th>
                  <th className="px-3 py-2">Sortie</th>
                  <th className="px-3 py-2">Lignes</th>
                  <th className="px-3 py-2">Statut</th>
                  {canWrite && <th className="px-3 py-2"></th>}
                </tr>
              </thead>
              <tbody>
                {(t.etatsLieux || []).map((e: any) => (
                  <tr key={e.id} className="border-b">
                    <td className="px-3 py-2 text-xs">{e.typeLocation === "MEUBLEE" ? "Meublée" : "Vide"}</td>
                    <td className="px-3 py-2 text-xs">{fmt(e.dateEntree)}</td>
                    <td className="px-3 py-2 text-xs">{fmt(e.dateSortie)}</td>
                    <td className="px-3 py-2 text-xs">{e.lignes?.length ?? 0}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded px-1.5 py-0.5 text-xs ${
                        e.statut === "BROUILLON" ? "bg-gray-100 text-gray-600"
                        : e.statut === "CLOTURE" ? "bg-gray-200 text-gray-500"
                        : "bg-emerald-100 text-emerald-700"
                      }`}>
                        {e.statut === "FINALISE_ENTREE" ? "Entrée finalisée"
                          : e.statut === "FINALISE_SORTIE" ? "Sortie finalisée"
                          : e.statut === "CLOTURE" ? "Clôturé" : "Brouillon"}
                      </span>
                    </td>
                    {canWrite && (
                      <td className="px-3 py-2 text-right text-xs">
                        {e.statut !== "CLOTURE" && (
                          <button type="button" className="text-cabinet-700 hover:underline"
                            onClick={() => ouvrirEtatLieux(e)}>
                            Modifier
                          </button>
                        )}{" "}
                        <button type="button" className="text-red-600 hover:underline"
                          onClick={() => retirerEtatLieux(e.id)}>
                          {e.statut === "BROUILLON" ? "Retirer" : "Clôturer"}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
                {(t.etatsLieux || []).length === 0 && (
                  <tr><td colSpan={6} className="px-3 py-6 text-center text-sm text-gray-500">
                    Aucun état des lieux — créez la fiche d&apos;entrée avant la remise des clés.
                  </td></tr>
                )}
              </tbody>
            </table>
          )}

          {/* Formulaire d'édition */}
          {elForm && (
            <div className="space-y-5">
              <div className="rounded-lg border border-gray-200 p-4">
                <h3 className="mb-3 text-sm font-semibold">1. Informations générales</h3>
                <div className="grid gap-4 sm:grid-cols-4">
                  <div>
                    <label className={labelCls}>Type de location</label>
                    <div className="flex gap-3 pt-1 text-sm">
                      {[["VIDE", "Vide"], ["MEUBLEE", "Meublée"]].map(([v, l]) => (
                        <label key={v} className="flex items-center gap-1.5">
                          <input type="radio" checked={elForm.typeLocation === v}
                            onChange={() => setElForm({ ...elForm, typeLocation: v })} />
                          {l}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Date d&apos;entrée</label>
                    <input type="date" className={inputCls} value={elForm.dateEntree}
                      onChange={(e) => setElForm({ ...elForm, dateEntree: e.target.value })} />
                  </div>
                  <div>
                    <label className={labelCls}>Date de sortie</label>
                    <input type="date" className={inputCls} value={elForm.dateSortie}
                      onChange={(e) => setElForm({ ...elForm, dateSortie: e.target.value })} />
                  </div>
                  <div>
                    <label className={labelCls}>Nombre de clés remises</label>
                    <input type="number" className={inputCls} value={elForm.nbCles}
                      onChange={(e) => setElForm({ ...elForm, nbCles: e.target.value })} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelCls}>Représentant (si applicable)</label>
                    <input className={inputCls} value={elForm.representant}
                      onChange={(e) => setElForm({ ...elForm, representant: e.target.value })} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelCls}>Statut de la fiche</label>
                    <div className="pt-1 text-sm font-medium">
                      {elForm.statut === "BROUILLON" ? "Brouillon" : elForm.statut === "FINALISE_ENTREE" ? "Entrée finalisée" : elForm.statut === "FINALISE_SORTIE" ? "Sortie finalisée" : "Clôturé"}
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-gray-200 p-4">
                <h3 className="mb-3 text-sm font-semibold">2. Description du logement</h3>
                <div className="grid gap-4 sm:grid-cols-4">
                  <div>
                    <label className={labelCls}>Nombre de pièces</label>
                    <input type="number" className={inputCls} value={elForm.nbPieces}
                      onChange={(e) => setElForm({ ...elForm, nbPieces: e.target.value })} />
                  </div>
                  <div>
                    <label className={labelCls}>Étage</label>
                    <input className={inputCls} value={elForm.etage}
                      onChange={(e) => setElForm({ ...elForm, etage: e.target.value })} />
                  </div>
                  <div>
                    <label className={labelCls}>Surface (m²)</label>
                    <input type="number" className={inputCls} value={elForm.surface}
                      onChange={(e) => setElForm({ ...elForm, surface: e.target.value })} />
                  </div>
                  <div>
                    <label className={labelCls}>Dépendances</label>
                    <input className={inputCls} value={elForm.dependances}
                      onChange={(e) => setElForm({ ...elForm, dependances: e.target.value })} />
                  </div>
                  <div>
                    <label className={labelCls}>Compteur d&apos;eau</label>
                    <input className={inputCls} value={elForm.compteurEau}
                      onChange={(e) => setElForm({ ...elForm, compteurEau: e.target.value })} />
                  </div>
                  <div>
                    <label className={labelCls}>Compteur électricité</label>
                    <input className={inputCls} value={elForm.compteurElectricite}
                      onChange={(e) => setElForm({ ...elForm, compteurElectricite: e.target.value })} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelCls}>Observations générales</label>
                    <input className={inputCls} value={elForm.observations}
                      onChange={(e) => setElForm({ ...elForm, observations: e.target.value })} />
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-gray-200 p-4">
                <h3 className="mb-1 text-sm font-semibold">3. Tableau d&apos;entrée et sortie</h3>
                <p className="mb-3 text-xs text-gray-500">Une ligne par élément inspecté.</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50 text-gray-600">
                      <tr>
                        <th className="px-2 py-1.5">Objet</th>
                        <th className="px-2 py-1.5">Emplacement</th>
                        <th className="px-2 py-1.5">Type</th>
                        <th className="px-2 py-1.5">Qté E</th>
                        <th className="px-2 py-1.5">État E</th>
                        <th className="px-2 py-1.5">Obs. E</th>
                        <th className="px-2 py-1.5">Qté S</th>
                        <th className="px-2 py-1.5">État S</th>
                        <th className="px-2 py-1.5">Obs. S</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {elLignes.map((l, i) => (
                        <tr key={i} className="border-b">
                          <td className="px-1 py-1">
                            <select className="input !py-1 !text-xs" value={l.objet}
                              onChange={(e) => setElLignes(elLignes.map((x, j) => j === i ? { ...x, objet: e.target.value } : x))}>
                              <option value="">—</option>
                              {ETAT_LIEUX_OBJETS.map((o) => <option key={o} value={o}>{o}</option>)}
                            </select>
                          </td>
                          <td className="px-1 py-1">
                            <select className="input !py-1 !text-xs" value={l.emplacement}
                              onChange={(e) => setElLignes(elLignes.map((x, j) => j === i ? { ...x, emplacement: e.target.value } : x))}>
                              <option value="">—</option>
                              {ETAT_LIEUX_EMPLACEMENTS.map((o) => <option key={o} value={o}>{o}</option>)}
                            </select>
                          </td>
                          <td className="px-1 py-1">
                            <select className="input !py-1 !text-xs" value={l.typeElement}
                              onChange={(e) => setElLignes(elLignes.map((x, j) => j === i ? { ...x, typeElement: e.target.value } : x))}>
                              <option value="">—</option>
                              {ETAT_LIEUX_TYPES.map((o) => <option key={o.code} value={o.code}>{o.label}</option>)}
                            </select>
                          </td>
                          {(["Entree", "Sortie"] as const).map((side) => (
                            <Fragment key={side}>
                              <td className="px-1 py-1">
                                <input type="number" className="input w-14 !py-1 !text-xs"
                                  value={side === "Entree" ? l.quantiteEntree : l.quantiteSortie}
                                  onChange={(e) => setElLignes(elLignes.map((x, j) => j === i ? { ...x, [side === "Entree" ? "quantiteEntree" : "quantiteSortie"]: e.target.value } : x))} />
                              </td>
                              <td className="px-1 py-1">
                                <select className="input !py-1 !text-xs"
                                  value={side === "Entree" ? l.etatEntree : l.etatSortie}
                                  onChange={(e) => setElLignes(elLignes.map((x, j) => j === i ? { ...x, [side === "Entree" ? "etatEntree" : "etatSortie"]: e.target.value } : x))}>
                                  <option value="">—</option>
                                  {ETAT_LIEUX_ETATS.map((o) => <option key={o.code} value={o.code}>{o.label}</option>)}
                                </select>
                              </td>
                              <td className="px-1 py-1">
                                <input className="input w-28 !py-1 !text-xs"
                                  value={side === "Entree" ? l.obsEntree : l.obsSortie}
                                  onChange={(e) => setElLignes(elLignes.map((x, j) => j === i ? { ...x, [side === "Entree" ? "obsEntree" : "obsSortie"]: e.target.value } : x))} />
                              </td>
                            </Fragment>
                          ))}
                          <td className="px-1 py-1">
                            <button type="button" className="text-red-600 hover:underline"
                              onClick={() => setElLignes(elLignes.filter((_, j) => j !== i))}>
                              Retirer
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button type="button" className="btn-secondary mt-2 px-3 py-1.5 text-xs"
                  onClick={() => setElLignes([...elLignes, { objet: "", emplacement: "", typeElement: "", quantiteEntree: 1, etatEntree: "", obsEntree: "", quantiteSortie: "", etatSortie: "", obsSortie: "" }])}>
                  + Ajouter une ligne
                </button>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-4">
                <button type="button" className="btn-secondary px-4 py-2 text-sm"
                  onClick={() => { setElForm(null); setElLignes([]); }}>
                  Annuler
                </button>
                <button type="button" className="btn-secondary px-4 py-2 text-sm" disabled={busy}
                  onClick={() => saveEtatLieux("BROUILLON")}>
                  Enregistrer (brouillon)
                </button>
                <button type="button" className="btn-primary px-4 py-2 text-sm" disabled={busy}
                  onClick={() => saveEtatLieux("FINALISE_ENTREE")}>
                  Finaliser l&apos;entrée
                </button>
                <button type="button" className="btn-primary px-4 py-2 text-sm" disabled={busy}
                  onClick={() => saveEtatLieux("FINALISE_SORTIE")}>
                  Finaliser la sortie
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============ JOURNAL ============ */}
      {tab === "journal" && (
        <div className="card p-5">
          <h2 className="mb-3 font-semibold">Journal des événements</h2>
          {canWrite && (
            <div className="mb-4 grid items-end gap-2 rounded-lg border border-gray-200 p-3 sm:grid-cols-4">
              <div>
                <label className={labelCls}>Type</label>
                <select
                  className={inputCls}
                  value={evt.type}
                  onChange={(e) => setEvt({ ...evt, type: e.target.value })}
                >
                  {TRX_EVENEMENT_TYPES.map((et) => (
                    <option key={et.code} value={et.code}>
                      {et.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Date</label>
                <input
                  type="date"
                  className={inputCls}
                  value={evt.date}
                  onChange={(e) => setEvt({ ...evt, date: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2 flex gap-2">
                <input
                  className={inputCls}
                  placeholder="Description"
                  value={evt.description}
                  onChange={(e) => setEvt({ ...evt, description: e.target.value })}
                />
                <button
                  type="button"
                  className="btn-primary shrink-0 px-3 py-2 text-xs"
                  disabled={busy}
                  onClick={addEvenement}
                >
                  + Ajouter
                </button>
              </div>
            </div>
          )}
          <ol className="space-y-2">
            {(t.evenements || []).map((e: any) => (
              <li key={e.id} className="flex gap-3 border-b pb-2 text-sm last:border-0">
                <span className="w-20 shrink-0 text-xs text-gray-500">{fmt(e.date)}</span>
                <div>
                  <span className="mr-2 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600">
                    {TRX_EVENEMENT_TYPES.find((x) => x.code === e.type)?.label || e.type}
                  </span>
                  {e.description}
                  {e.creePar && (
                    <span className="ml-1 text-xs text-gray-400">— {userNames[e.creePar] || ""}</span>
                  )}
                </div>
              </li>
            ))}
            {t.evenements?.length === 0 && (
              <li className="py-4 text-center text-sm text-gray-500">Aucun événement.</li>
            )}
          </ol>
        </div>
      )}
    </div>
  );
}
