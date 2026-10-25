"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

interface DossierOption {
  id: string;
  referenceInterne: string;
  clientId: string;
  client?: { raisonSociale: string } | null;
  associatedUserIds: string[];
}

interface TacheOption {
  id: string;
  titre: string;
  dossierId: string;
  responsableId: string;
  dossier?: { referenceInterne: string } | null;
}

interface MissionOption {
  id: string;
  type: string;
  typeLabel: string;
  typeActe: string;
  dossierId: string;
  intervenantId: string;
  dossier?: { referenceInterne: string } | null;
}

interface TvaRate {
  id: string;
  code: string;
  label: string;
  rate: number;
}

interface Line {
  description: string;
  quantite: number;
  prixUnitaire: number;
  tauxTva: number;
  totalHt: number;
  totalTva: number;
  totalTtc: number;
}

type TaxMode = "exonere" | "tva" | "prelevement_impots";

const INTERVENANT_TYPES = [
  { value: "huissier", label: "Huissier" },
  { value: "clerc", label: "Clerc" },
  { value: "architecte", label: "Architecte" },
  { value: "conseiller_juridique", label: "Conseiller Juridique" },
  { value: "avocat", label: "Avocat" },
];

const PAYMENT_METHODS = [
  { value: "virement", label: "Virement" },
  { value: "cheque", label: "Chèque" },
  { value: "carte", label: "Carte" },
  { value: "especes", label: "Espèces" },
  { value: "autre", label: "Autre" },
];

function fmt(n: number) {
  return Math.round(n);
}

function recalcLine(line: Line, taux: number): Line {
  const q = Number(line.quantite) || 0;
  const pu = Number(line.prixUnitaire) || 0;
  const ht = fmt(q * pu);
  const tva = fmt(ht * (taux / 100));
  const ttc = fmt(ht + tva);
  return { ...line, tauxTva: taux, totalHt: ht, totalTva: tva, totalTtc: ttc };
}

function buildLabel(
  intervenantType: string,
  intervenantName: string,
  referenceType: string,
  referenceLabel: string
) {
  const it = INTERVENANT_TYPES.find((i) => i.value === intervenantType)?.label || intervenantType;
  const ref = referenceLabel ? ` — ${referenceType === "dossier" ? "Dossier" : referenceType === "tache" ? "Tâche" : "Mission"} ${referenceLabel}` : "";
  return `Paiement ${it}${intervenantName ? ` / ${intervenantName}` : ""}${ref}`;
}

interface Intervenant {
  id: string;
  prenom: string;
  nom: string;
}

interface PaiementFormProps {
  dossiers: DossierOption[];
  taches: TacheOption[];
  missions: MissionOption[];
  tvaRates: TvaRate[];
}

export function PaiementForm({ dossiers, taches, missions, tvaRates }: PaiementFormProps) {
  const router = useRouter();
  const today = new Date().toISOString().split("T")[0];
  const defaultTva = tvaRates.find((r) => r.rate === 18) || tvaRates[0];

  const [form, setForm] = useState({
    intervenantType: "huissier",
    intervenantId: "",
    intervenantName: "",
    referenceType: "dossier" as "dossier" | "tache" | "mission",
    dossierId: "",
    tacheId: "",
    missionId: "",
    taxMode: "exonere" as TaxMode,
    tvaRateId: defaultTva?.id || "",
    withholdingRate: "15",
    chargeDate: today,
    paymentMethod: "virement",
    libelle: "",
    designation: "",
    globalAmount: "",
    useLines: false,
  });

  const [lines, setLines] = useState<Line[]>([
    { description: "", quantite: 1, prixUnitaire: 0, tauxTva: 0, totalHt: 0, totalTva: 0, totalTtc: 0 },
  ]);

  const [dossierQuery, setDossierQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [intervenants, setIntervenants] = useState<Intervenant[]>([]);

  useEffect(() => {
    const type = INTERVENANT_TYPES.find((i) => i.value === form.intervenantType);
    if (!type) return;
    setForm((prev) => ({ ...prev, intervenantId: "", intervenantName: "" }));
    setIntervenants([]);
    fetch(`/api/intervenants?role=${encodeURIComponent(type.label)}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setIntervenants(Array.isArray(data) ? data : []))
      .catch(() => setIntervenants([]));
  }, [form.intervenantType]);

  const filteredDossiers = useMemo(() => {
    let result = dossiers;
    if (form.intervenantId) {
      result = result.filter((d) => d.associatedUserIds.includes(form.intervenantId));
    }
    const q = dossierQuery.trim().toLowerCase();
    if (!q) return result;
    return result.filter(
      (d) =>
        d.referenceInterne.toLowerCase().includes(q) ||
        d.client?.raisonSociale?.toLowerCase().includes(q)
    );
  }, [dossiers, dossierQuery, form.intervenantId]);

  const filteredTaches = useMemo(() => {
    if (!form.intervenantId) return taches;
    return taches.filter((t) => t.responsableId === form.intervenantId);
  }, [taches, form.intervenantId]);

  const filteredMissions = useMemo(() => {
    if (!form.intervenantId) return missions;
    return missions.filter((m) => m.intervenantId === form.intervenantId);
  }, [missions, form.intervenantId]);

  const selectedTvaRate = useMemo(
    () => tvaRates.find((r) => r.id === form.tvaRateId) || defaultTva,
    [tvaRates, form.tvaRateId, defaultTva]
  );

  const tauxApplicable = useMemo(() => {
    if (form.taxMode === "tva") return selectedTvaRate?.rate || 0;
    return 0;
  }, [form.taxMode, selectedTvaRate]);

  const lineTotals = useMemo(() => {
    const ht = lines.reduce((s, l) => s + l.totalHt, 0);
    const tva = lines.reduce((s, l) => s + l.totalTva, 0);
    const ttc = lines.reduce((s, l) => s + l.totalTtc, 0);
    return { ht, tva, ttc };
  }, [lines]);

  const globalTotals = useMemo(() => {
    const base = Number(form.globalAmount) || 0;
    if (form.taxMode === "exonere") {
      return { ht: base, tva: 0, ttc: base };
    }
    if (form.taxMode === "tva" && selectedTvaRate) {
      const rate = selectedTvaRate.rate / 100;
      const ht = fmt(base / (1 + rate));
      const tva = fmt(base - ht);
      return { ht, tva, ttc: base };
    }
    if (form.taxMode === "prelevement_impots") {
      const rate = Number(form.withholdingRate) || 0;
      const tva = fmt(base * (rate / 100));
      return { ht: base, tva, ttc: base };
    }
    return { ht: base, tva: 0, ttc: base };
  }, [form.globalAmount, form.taxMode, form.withholdingRate, selectedTvaRate]);

  const totals = form.useLines ? lineTotals : globalTotals;

  const withholding = useMemo(() => {
    if (form.taxMode !== "prelevement_impots") return 0;
    if (form.useLines) {
      const rate = Number(form.withholdingRate) || 0;
      return fmt(totals.ht * (rate / 100));
    }
    return totals.tva;
  }, [form.taxMode, form.useLines, totals, form.withholdingRate]);

  const netAmount = useMemo(() => fmt(totals.ttc - withholding), [totals.ttc, withholding]);

  const referenceLabel = useMemo(() => {
    if (form.referenceType === "tache") {
      const t = taches.find((x) => x.id === form.tacheId);
      return t ? `${t.titre} (${t.dossier?.referenceInterne || ""})` : "";
    }
    if (form.referenceType === "mission") {
      const m = missions.find((x) => x.id === form.missionId);
      return m ? `${m.typeLabel} — ${m.typeActe} (${m.dossier?.referenceInterne || ""})` : "";
    }
    const d = dossiers.find((x) => x.id === form.dossierId);
    return d ? d.referenceInterne : "";
  }, [form, taches, missions, dossiers]);

  const autoLabel = useMemo(
    () => buildLabel(form.intervenantType, form.intervenantName, form.referenceType, referenceLabel),
    [form.intervenantType, form.intervenantName, form.referenceType, referenceLabel]
  );

  const simpleReferenceLabel = useMemo(() => {
    if (form.referenceType === "tache") {
      const t = taches.find((x) => x.id === form.tacheId);
      return t ? t.titre : "";
    }
    if (form.referenceType === "mission") {
      const m = missions.find((x) => x.id === form.missionId);
      return m ? `${m.typeLabel} — ${m.typeActe}` : "";
    }
    const d = dossiers.find((x) => x.id === form.dossierId);
    return d ? d.referenceInterne : "";
  }, [form.tacheId, form.missionId, form.dossierId, taches, missions, dossiers]);

  function updateLine(index: number, field: keyof Line, value: string | number) {
    setLines((prev) =>
      prev.map((l, i) => {
        if (i !== index) return l;
        const next = { ...l, [field]: value } as Line;
        return recalcLine(next, tauxApplicable);
      })
    );
  }

  function addLine() {
    setLines((prev) => [
      ...prev,
      { description: "", quantite: 1, prixUnitaire: 0, tauxTva: tauxApplicable, totalHt: 0, totalTva: 0, totalTtc: 0 },
    ]);
  }

  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  function handleTaxModeChange(mode: TaxMode) {
    setForm((f) => ({ ...f, taxMode: mode }));
    const taux = mode === "tva" ? selectedTvaRate?.rate || 0 : 0;
    setLines((prev) => prev.map((l) => recalcLine(l, taux)));
  }

  function handleTvaRateChange(rateId: string) {
    setForm((f) => ({ ...f, tvaRateId: rateId }));
    const rate = tvaRates.find((r) => r.id === rateId)?.rate || 0;
    if (form.taxMode === "tva") {
      setLines((prev) => prev.map((l) => recalcLine(l, rate)));
    }
  }

  function handleIntervenantChange(intervenantId: string) {
    const u = intervenants.find((i) => i.id === intervenantId);
    setForm((f) => ({
      ...f,
      intervenantId,
      intervenantName: u ? `${u.prenom} ${u.nom}` : "",
      dossierId: "",
      tacheId: "",
      missionId: "",
    }));
    setDossierQuery("");
  }

  function handleReferenceTypeChange(type: "dossier" | "tache" | "mission") {
    setForm((f) => ({ ...f, referenceType: type, dossierId: "", tacheId: "", missionId: "" }));
  }

  function handleDossierChange(dossierId: string) {
    setForm((f) => ({ ...f, dossierId, tacheId: "", missionId: "" }));
  }

  function handleTacheChange(tacheId: string) {
    const t = taches.find((x) => x.id === tacheId);
    setForm((f) => ({
      ...f,
      referenceType: tacheId ? "tache" : "dossier",
      tacheId,
      missionId: "",
      dossierId: t?.dossierId || "",
    }));
  }

  function handleMissionChange(missionId: string) {
    const m = missions.find((x) => x.id === missionId);
    setForm((f) => ({
      ...f,
      referenceType: missionId ? "mission" : "dossier",
      missionId,
      tacheId: "",
      dossierId: m?.dossierId || "",
    }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (!form.intervenantName.trim()) {
      setError("Saisissez le nom de l'intervenant.");
      setLoading(false);
      return;
    }
    if (!form.dossierId && !form.tacheId && !form.missionId) {
      setError("Sélectionnez un dossier, une tâche ou une mission.");
      setLoading(false);
      return;
    }
    if (totals.ttc <= 0) {
      setError("Saisissez un montant supérieur à zéro.");
      setLoading(false);
      return;
    }

    const finalLibelle = form.libelle.trim() || (form.useLines ? autoLabel : simpleReferenceLabel);

    let validLines: Line[];
    if (form.useLines) {
      validLines = lines.filter((l) => l.description.trim() && l.quantite * l.prixUnitaire > 0);
      if (validLines.length === 0) {
        setError("Ajoutez au moins une ligne valide.");
        setLoading(false);
        return;
      }
    } else {
      const desc = finalLibelle;
      validLines = [
        {
          description: desc,
          quantite: 1,
          prixUnitaire: totals.ht,
          tauxTva: tauxApplicable,
          totalHt: totals.ht,
          totalTva: totals.tva,
          totalTtc: totals.ttc,
        },
      ];
    }

    const mission = missions.find((m) => m.id === form.missionId);

    const body = {
      intervenantType: form.intervenantType,
      intervenantName: form.intervenantName.trim(),
      referenceType: form.referenceType,
      dossierId: form.dossierId || null,
      tacheId: form.tacheId || null,
      missionId: form.missionId || null,
      missionType: mission?.type || null,
      taxMode: form.taxMode,
      tvaRateId: form.taxMode === "tva" ? form.tvaRateId : null,
      withholdingRate: form.taxMode === "prelevement_impots" ? Number(form.withholdingRate) : null,
      chargeDate: form.chargeDate,
      paymentMethod: form.paymentMethod,
      libelle: finalLibelle,
      designation: form.designation.trim(),
      amount: totals.ttc,
      totalHt: totals.ht,
      taxAmount: form.taxMode === "tva" ? totals.tva : form.taxMode === "prelevement_impots" ? withholding : 0,
      netAmount: form.taxMode === "prelevement_impots" ? netAmount : totals.ttc,
      tvaEnabled: form.taxMode === "tva",
      lines: validLines.map((l, i) => ({ ...l, ordre: i })),
    };

    const res = await fetch("/api/paiements-intervenants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    setLoading(false);

    if (res.ok) {
      const charge = await res.json();
      router.push(`/cabinet/paiements-intervenants/${charge.id}/imprimer`);
      return;
    }

    const data = await res.json().catch(() => ({}));
    const details = typeof data.details === "string" ? data.details : "";
    const base = typeof data.error === "string" ? data.error : "Erreur lors de l'enregistrement";
    setError(details ? `${base} : ${details}` : base);
  }

  return (
    <form onSubmit={onSubmit} className="card space-y-5">
      {error && <div className="rounded-md bg-red-100 p-3 text-sm text-red-700">{error}</div>}

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">Type d&apos;intervenant</label>
          <select
            value={form.intervenantType}
            onChange={(e) => setForm({ ...form, intervenantType: e.target.value, intervenantName: "" })}
            className="input w-full"
            required
          >
            {INTERVENANT_TYPES.map((i) => (
              <option key={i.value} value={i.value}>
                {i.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Nom de l&apos;intervenant</label>
          <select
            value={form.intervenantId}
            onChange={(e) => handleIntervenantChange(e.target.value)}
            className="input w-full"
            required
            disabled={intervenants.length === 0}
          >
            <option value="">
              {intervenants.length === 0 ? "Chargement…" : "Sélectionner un intervenant"}
            </option>
            {intervenants.map((u) => (
              <option key={u.id} value={u.id}>
                {u.prenom} {u.nom}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 p-4">
        <p className="mb-3 text-sm font-medium text-gray-700">Liaison</p>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Référence</label>
            <div className="flex flex-wrap gap-2">
              {[
                { value: "dossier", label: "Dossier" },
                { value: "tache", label: "Tâche" },
                { value: "mission", label: "Mission" },
              ].map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => handleReferenceTypeChange(r.value as any)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                    form.referenceType === r.value
                      ? "bg-cabinet-700 text-white"
                      : "bg-white text-gray-600 border border-gray-300 hover:bg-gray-100"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {form.referenceType === "dossier" && (
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Dossier</label>
              <input
                type="text"
                value={dossierQuery}
                onChange={(e) => {
                  setDossierQuery(e.target.value);
                  handleDossierChange("");
                }}
                className="input mb-2"
                placeholder="Rechercher un dossier..."
              />
              <select
                value={form.dossierId}
                onChange={(e) => handleDossierChange(e.target.value)}
                className="input"
                size={Math.min(5, filteredDossiers.length + 1)}
              >
                <option value="">Aucun dossier</option>
                {filteredDossiers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.referenceInterne} {d.client?.raisonSociale ? `— ${d.client.raisonSociale}` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          {form.referenceType === "tache" && (
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Tâche</label>
              <select
                value={form.tacheId}
                onChange={(e) => handleTacheChange(e.target.value)}
                className="input"
                required
              >
                <option value="">Sélectionner une tâche</option>
                {filteredTaches.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.titre} — {t.dossier?.referenceInterne || ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          {form.referenceType === "mission" && (
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Mission</label>
              <select
                value={form.missionId}
                onChange={(e) => handleMissionChange(e.target.value)}
                className="input"
                required
              >
                <option value="">Sélectionner une mission</option>
                {filteredMissions.map((m) => (
                  <option key={`${m.type}-${m.id}`} value={m.id}>
                    {m.typeLabel} — {m.typeActe} ({m.dossier?.referenceInterne || ""})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Libellé</label>
        <input
          type="text"
          value={form.libelle}
          onChange={(e) => setForm({ ...form, libelle: e.target.value })}
          className="input w-full"
          placeholder={form.useLines ? autoLabel : simpleReferenceLabel}
        />
        <p className="mt-1 text-xs text-gray-500">Par défaut : {form.useLines ? autoLabel : simpleReferenceLabel}</p>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Désignation / Notes</label>
        <textarea
          value={form.designation}
          onChange={(e) => setForm({ ...form, designation: e.target.value })}
          className="input"
          rows={2}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">Date</label>
          <input
            type="date"
            value={form.chargeDate}
            onChange={(e) => setForm({ ...form, chargeDate: e.target.value })}
            className="input w-full"
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Mode de paiement</label>
          <select
            value={form.paymentMethod}
            onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
            className="input w-full"
            required
          >
            {PAYMENT_METHODS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 p-4">
        <p className="mb-3 text-sm font-medium text-gray-700">Traitement fiscal</p>
        <div className="flex flex-wrap gap-3">
          {[
            { value: "exonere", label: "Exonéré" },
            { value: "tva", label: "TVA" },
            { value: "prelevement_impots", label: "Prélèvement impôts" },
          ].map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => handleTaxModeChange(t.value as TaxMode)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                form.taxMode === t.value
                  ? "bg-cabinet-700 text-white"
                  : "bg-white text-gray-600 border border-gray-300 hover:bg-gray-100"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {form.taxMode === "tva" && (
          <div className="mt-3">
            <label className="mb-1 block text-xs font-medium text-gray-600">Taux de TVA</label>
            <select
              value={form.tvaRateId}
              onChange={(e) => handleTvaRateChange(e.target.value)}
              className="input"
              required
            >
              {tvaRates.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label} ({r.rate}%)
                </option>
              ))}
            </select>
          </div>
        )}

        {form.taxMode === "prelevement_impots" && (
          <div className="mt-3">
            <label className="mb-1 block text-xs font-medium text-gray-600">Taux de retenue (%)</label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={form.withholdingRate}
              onChange={(e) => setForm({ ...form, withholdingRate: e.target.value })}
              className="input w-32"
              required
            />
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
        <span className="mr-2 text-sm font-medium text-gray-700">Saisie :</span>
        <button
          type="button"
        onClick={() => setForm((f) => ({ ...f, useLines: false }))}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
            !form.useLines
              ? "bg-cabinet-700 text-white"
              : "bg-white text-gray-600 border border-gray-300 hover:bg-gray-100"
          }`}
        >
          Montant global
        </button>
        <button
          type="button"
          onClick={() => setForm((f) => ({ ...f, useLines: true }))}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
            form.useLines
              ? "bg-cabinet-700 text-white"
              : "bg-white text-gray-600 border border-gray-300 hover:bg-gray-100"
          }`}
        >
          Lignes détaillées
        </button>
      </div>

      {!form.useLines && (
        <div>
          <label className="mb-1 block text-sm font-medium">
            Montant {form.taxMode === "tva" ? "TTC" : "total"}
          </label>
          <input
            type="number"
            min="0"
            step="1"
            value={form.globalAmount}
            onChange={(e) => setForm({ ...form, globalAmount: e.target.value })}
            className="input w-full"
            required
          />
        </div>
      )}

      {form.useLines && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Actions / Prestations</h3>
            <button type="button" onClick={addLine} className="text-sm text-cabinet-700 hover:underline">
              + Ajouter une ligne
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-cabinet-100 text-cabinet-900">
                <tr>
                  <th className="px-2 py-2 text-left">Désignation</th>
                  <th className="px-2 py-2 text-right">Qté / Durée</th>
                  <th className="px-2 py-2 text-right">Prix unit.</th>
                  <th className="px-2 py-2 text-right">{form.taxMode === "tva" ? "TVA %" : "—"}</th>
                  <th className="px-2 py-2 text-right">HT</th>
                  {form.taxMode === "tva" && <th className="px-2 py-2 text-right">TVA</th>}
                  <th className="px-2 py-2 text-right">Total</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {lines.map((l, idx) => (
                  <tr key={idx} className="border-b">
                    <td className="px-2 py-2">
                      <input
                        type="text"
                        value={l.description}
                        onChange={(e) => updateLine(idx, "description", e.target.value)}
                        className="input w-full"
                        placeholder="Action ou prestation"
                        required
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={l.quantite}
                        onChange={(e) => updateLine(idx, "quantite", parseInt(e.target.value, 10) || 0)}
                        className="input w-24 text-right"
                        required
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={l.prixUnitaire}
                        onChange={(e) => updateLine(idx, "prixUnitaire", parseInt(e.target.value, 10) || 0)}
                        className="input w-28 text-right"
                        required
                      />
                    </td>
                    <td className="px-2 py-2 text-right">
                      {form.taxMode === "tva" ? `${l.tauxTva}%` : "—"}
                    </td>
                    <td className="px-2 py-2 text-right">{l.totalHt.toLocaleString("fr-FR")}</td>
                    {form.taxMode === "tva" && (
                      <td className="px-2 py-2 text-right">{l.totalTva.toLocaleString("fr-FR")}</td>
                    )}
                    <td className="px-2 py-2 text-right font-medium">{l.totalTtc.toLocaleString("fr-FR")}</td>
                    <td className="px-2 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => removeLine(idx)}
                        className="text-red-600 hover:text-red-800"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <h3 className="mb-2 text-sm font-semibold">Totaux</h3>
        <div className="flex flex-col gap-1 text-sm md:w-1/2 md:ml-auto">
          <div className="flex justify-between">
            <span>Total HT</span>
            <span>{totals.ht.toLocaleString("fr-FR")} FCFA</span>
          </div>
          {form.taxMode === "tva" && (
            <div className="flex justify-between">
              <span>TVA</span>
              <span>{totals.tva.toLocaleString("fr-FR")} FCFA</span>
            </div>
          )}
          {form.taxMode === "prelevement_impots" && (
            <div className="flex justify-between text-amber-700">
              <span>Retenue d&apos;impôt ({Number(form.withholdingRate).toLocaleString("fr-FR")}%)</span>
              <span>{withholding.toLocaleString("fr-FR")} FCFA</span>
            </div>
          )}
          <div className="flex justify-between border-t border-gray-300 pt-1 font-semibold">
            <span>Total TTC</span>
            <span>{totals.ttc.toLocaleString("fr-FR")} FCFA</span>
          </div>
          {form.taxMode === "prelevement_impots" && (
            <div className="flex justify-between font-semibold text-emerald-700">
              <span>Net à payer</span>
              <span>{netAmount.toLocaleString("fr-FR")} FCFA</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <Link href="/cabinet/paiements-intervenants" className="text-sm text-cabinet-700 hover:underline">
          Annuler
        </Link>
        <button
          type="submit"
          disabled={loading}
          className="btn-primary"
        >
          {loading ? "Enregistrement…" : "Enregistrer et imprimer"}
        </button>
      </div>
    </form>
  );
}
