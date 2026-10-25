"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  IMMOBILISATION_MODES,
  buildAmortissementPlan,
  computeDotationMensuelle,
  formatPeriode,
  type ImmobilisationMode,
} from "@/lib/immobilisation";

interface Category {
  id: string;
  code: string;
  label: string;
  accountCode: string | null;
}

interface TvaRate {
  id: string;
  code: string;
  label: string;
  rate: number;
}

interface DossierOption {
  id: string;
  referenceInterne: string;
  clientId: string;
  client?: { raisonSociale: string } | null;
}

interface TacheOption {
  id: string;
  titre: string;
  dossierId: string;
  dossier?: { referenceInterne: string } | null;
}

interface MissionOption {
  id: string;
  typeActe: string;
  dossierId: string;
  dossier?: { referenceInterne: string } | null;
}

interface ChargeLine {
  description: string;
  quantite: number;
  prixUnitaire: number;
  tauxTva: number;
  totalHt: number;
  totalTva: number;
  totalTtc: number;
}

interface ImmoAccount {
  accountCode: string;
  label: string;
}

interface ChargeFormProps {
  dossiers: DossierOption[];
  taches: TacheOption[];
  missions: MissionOption[];
  categories: Category[];
  tvaRates: TvaRate[];
  immoAccounts: ImmoAccount[];
}

function recalcLine(line: ChargeLine, taux: number): ChargeLine {
  const q = Number(line.quantite) || 0;
  const pu = Number(line.prixUnitaire) || 0;
  const ht = Math.round(q * pu * 100) / 100;
  const tva = Math.round(ht * (taux / 100) * 100) / 100;
  const ttc = Math.round((ht + tva) * 100) / 100;
  return { ...line, tauxTva: taux, totalHt: ht, totalTva: tva, totalTtc: ttc };
}

export function ChargeForm({
  dossiers,
  taches,
  missions,
  categories,
  tvaRates,
  immoAccounts,
}: ChargeFormProps) {
  const router = useRouter();
  const [dossierQuery, setDossierQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const today = new Date().toISOString().split("T")[0];
  const defaultTva = tvaRates.find((r) => r.rate === 18) || tvaRates[0];

  const [form, setForm] = useState({
    categoryId: categories[0]?.id || "",
    dossierId: "",
    tacheId: "",
    missionId: "",
    chargeDate: today,
    amount: "",
    tvaEnabled: false,
    tvaRateId: defaultTva?.id || "",
    paymentMethod: "virement",
    description: "",
    supplierName: "",
    supplierInvoiceRef: "",
  });

  // Immobilisation amortie : le bien entre en classe 2 et la charge est étalée
  // en dotations mensuelles (montant fixe ou taux annuel).
  const [immo, setImmo] = useState({
    enabled: false,
    mode: "montant" as ImmobilisationMode,
    accountCode: "",
    rate: "",
    monthly: "",
    months: "",
    startDate: today,
  });

  const [useLines, setUseLines] = useState(false);
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [lines, setLines] = useState<ChargeLine[]>([
    { description: "", quantite: 1, prixUnitaire: 0, tauxTva: 0, totalHt: 0, totalTva: 0, totalTtc: 0 },
  ]);

  const filteredDossiers = useMemo(() => {
    const q = dossierQuery.trim().toLowerCase();
    if (!q) return dossiers;
    return dossiers.filter(
      (d) =>
        d.referenceInterne.toLowerCase().includes(q) ||
        d.client?.raisonSociale?.toLowerCase().includes(q)
    );
  }, [dossiers, dossierQuery]);

  const selectedTvaRate = useMemo(
    () => tvaRates.find((r) => r.id === form.tvaRateId) || defaultTva,
    [tvaRates, form.tvaRateId, defaultTva]
  );

  const tauxTva = form.tvaEnabled ? selectedTvaRate?.rate || 0 : 0;

  const lineTotals = useMemo(() => {
    const ht = lines.reduce((s, l) => s + l.totalHt, 0);
    const tva = lines.reduce((s, l) => s + l.totalTva, 0);
    const ttc = lines.reduce((s, l) => s + l.totalTtc, 0);
    return { ht, tva, ttc };
  }, [lines]);

  const simpleTotals = useMemo(() => {
    const amount = Number(form.amount) || 0;
    if (!form.tvaEnabled || !selectedTvaRate) {
      return { ht: amount, tva: 0, ttc: amount };
    }
    const rate = selectedTvaRate.rate / 100;
    const ht = Math.round((amount / (1 + rate)) * 100) / 100;
    const tva = Math.round((amount - ht) * 100) / 100;
    return { ht, tva, ttc: amount };
  }, [form.amount, form.tvaEnabled, selectedTvaRate]);

  const totals = useLines ? lineTotals : simpleTotals;

  // Plan d'amortissement prévisionnel (recalculé côté serveur à l'enregistrement).
  const amortissement = useMemo(() => {
    if (!immo.enabled) return null;
    const base = totals.ht;
    const { monthly, months } = computeDotationMensuelle({
      base,
      mode: immo.mode,
      rate: Number(immo.rate) || 0,
      monthlyAmount: Number(immo.monthly) || 0,
      months: Number(immo.months) || 0,
    });
    const plan = buildAmortissementPlan({
      base,
      monthly,
      months,
      startDate: new Date(`${immo.startDate}T12:00:00Z`),
    });
    return { base, monthly, months, plan };
  }, [immo, totals.ht]);

  useEffect(() => {
    if (categories[0] && !form.categoryId) {
      setForm((f) => ({ ...f, categoryId: categories[0].id }));
    }
  }, [categories, form.categoryId]);

  function updateLine(index: number, field: keyof ChargeLine, value: string | number) {
    setLines((prev) =>
      prev.map((l, i) => {
        if (i !== index) return l;
        const next = { ...l, [field]: value } as ChargeLine;
        return recalcLine(next, tauxTva);
      })
    );
  }

  function addLine() {
    setLines((prev) => [
      ...prev,
      { description: "", quantite: 1, prixUnitaire: 0, tauxTva: tauxTva, totalHt: 0, totalTva: 0, totalTtc: 0 },
    ]);
  }

  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  function handleTvaToggle(enabled: boolean) {
    setForm((f) => ({ ...f, tvaEnabled: enabled }));
    const newTaux = enabled ? selectedTvaRate?.rate || 0 : 0;
    setLines((prev) => prev.map((l) => recalcLine(l, newTaux)));
  }

  function handleTvaRateChange(rateId: string) {
    setForm((f) => ({ ...f, tvaRateId: rateId }));
    const rate = tvaRates.find((r) => r.id === rateId)?.rate || 0;
    if (form.tvaEnabled) {
      setLines((prev) => prev.map((l) => recalcLine(l, rate)));
    }
  }

  function switchMode(useLignes: boolean) {
    setUseLines(useLignes);
    if (useLignes) {
      setLines((prev) => prev.map((l) => recalcLine(l, tauxTva)));
    }
  }

  function handleDossierChange(dossierId: string) {
    setForm((f) => ({
      ...f,
      dossierId,
      tacheId: "",
      missionId: "",
    }));
  }

  function handleTacheChange(tacheId: string) {
    const tache = taches.find((t) => t.id === tacheId);
    setForm((f) => ({
      ...f,
      tacheId,
      missionId: "",
      dossierId: tache?.dossierId || "",
    }));
  }

  function handleMissionChange(missionId: string) {
    const mission = missions.find((m) => m.id === missionId);
    setForm((f) => ({
      ...f,
      missionId,
      tacheId: "",
      dossierId: mission?.dossierId || "",
    }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (immo.enabled) {
      if (!immo.accountCode) {
        setError("Sélectionnez le compte d'immobilisation (classe 2).");
        setLoading(false);
        return;
      }
      if (immo.mode === "montant" && !(Number(immo.monthly) > 0)) {
        setError("Saisissez la dotation mensuelle.");
        setLoading(false);
        return;
      }
      if (immo.mode === "taux" && !(Number(immo.rate) > 0)) {
        setError("Saisissez le taux d'amortissement annuel.");
        setLoading(false);
        return;
      }
      if (!amortissement || amortissement.plan.length === 0) {
        setError("Plan d'amortissement vide : vérifiez la dotation et la durée.");
        setLoading(false);
        return;
      }
    }

    const immoPayload = immo.enabled
      ? {
          isImmobilisation: true,
          immobilisationMode: immo.mode,
          immobilisationAccountCode: immo.accountCode,
          immobilisationRate: immo.mode === "taux" ? Number(immo.rate) : null,
          monthlyPayment: immo.mode === "montant" ? Number(immo.monthly) : null,
          immobilisationMonths: amortissement?.months || null,
          amortissementStartDate: immo.startDate,
        }
      : { isImmobilisation: false };

    let body: Record<string, unknown>;

    const cleanForm = {
      ...form,
      dossierId: form.dossierId || null,
      tacheId: form.tacheId || null,
      missionId: form.missionId || null,
      tvaRateId: form.tvaEnabled ? form.tvaRateId : null,
    };

    if (useLines) {
      const validLines = lines.filter((l) => l.description.trim() && l.quantite * l.prixUnitaire > 0);
      if (validLines.length === 0) {
        setError("Ajoutez au moins une ligne valide.");
        setLoading(false);
        return;
      }
      const ttc = validLines.reduce((s, l) => s + l.totalTtc, 0);
      body = {
        ...cleanForm,
        ...immoPayload,
        amount: Math.round(ttc * 100) / 100,
        lines: validLines.map((l, i) => ({ ...l, ordre: i })),
      };
    } else {
      body = {
        ...cleanForm,
        ...immoPayload,
        amount: Number(form.amount),
      };
    }

    const res = await fetch("/api/charges", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(typeof data.error === "string" ? data.error : "Erreur lors de l'enregistrement");
      setLoading(false);
      return;
    }

    const charge = await res.json();

    // Téléverser la facture reçue (si un fichier a été choisi)
    if (invoiceFile && charge?.id) {
      const fd = new FormData();
      fd.append("file", invoiceFile);
      const uploadRes = await fetch(`/api/charges/${charge.id}/upload`, {
        method: "PATCH",
        body: fd,
      });
      if (!uploadRes.ok) {
        const data = await uploadRes.json().catch(() => ({}));
        setError(
          typeof data.error === "string"
            ? data.error
            : "Charge enregistrée, mais échec de l'upload de la facture"
        );
        setLoading(false);
        return;
      }
    }

    setLoading(false);
    router.push("/cabinet/charges");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Nouvelle charge</h1>
        <Link href="/cabinet/charges" className="text-sm text-cabinet-700 hover:underline">
          ← Retour aux charges
        </Link>
      </div>

      <form onSubmit={onSubmit} className="card space-y-5">
        {error && <div className="rounded-md bg-red-100 p-3 text-sm text-red-700">{error}</div>}

        <div className="rounded-lg border border-gray-200 p-4">
          <p className="mb-3 text-sm font-medium text-gray-700">Liaison (optionnel)</p>
          <div className="space-y-4">
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
              {filteredDossiers.length === 0 && dossierQuery && (
                <p className="mt-1 text-xs text-cabinet-600">
                  Aucun dossier trouvé.{" "}
                  <Link href="/cabinet/dossiers/nouveau" className="underline">
                    Ouvrir un dossier
                  </Link>
                </p>
              )}
            </div>

            {form.dossierId && (
              <>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Tâche liée (optionnel)</label>
                  <select
                    value={form.tacheId}
                    onChange={(e) => handleTacheChange(e.target.value)}
                    className="input"
                  >
                    <option value="">Aucune tâche</option>
                    {taches
                      .filter((t) => t.dossierId === form.dossierId)
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.titre}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Mission liée (optionnel)</label>
                  <select
                    value={form.missionId}
                    onChange={(e) => handleMissionChange(e.target.value)}
                    className="input"
                  >
                    <option value="">Aucune mission</option>
                    {missions
                      .filter((m) => m.dossierId === form.dossierId)
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.typeActe} {m.dossier?.referenceInterne ? `— ${m.dossier.referenceInterne}` : ""}
                        </option>
                      ))}
                  </select>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">Catégorie</label>
            <select
              className="input w-full"
              value={form.categoryId}
              onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
              required
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label} {c.accountCode ? `(${c.accountCode})` : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Date</label>
            <input
              type="date"
              className="input w-full"
              value={form.chargeDate}
              onChange={(e) => setForm({ ...form, chargeDate: e.target.value })}
              required
            />
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
          <span className="mr-2 text-sm font-medium text-gray-700">Saisie :</span>
          <button
            type="button"
            onClick={() => switchMode(false)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              !useLines
                ? "bg-cabinet-700 text-white"
                : "bg-white text-gray-600 border border-gray-300 hover:bg-gray-100"
            }`}
          >
            Montant global
          </button>
          <button
            type="button"
            onClick={() => switchMode(true)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              useLines
                ? "bg-cabinet-700 text-white"
                : "bg-white text-gray-600 border border-gray-300 hover:bg-gray-100"
            }`}
          >
            Lignes détaillées
          </button>
        </div>

        {!useLines && (
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Montant TTC</label>
              <input
                type="number"
                min="0"
                step="1"
                className="input w-full"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Mode de paiement</label>
              <select
                className="input w-full"
                value={form.paymentMethod}
                onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
                required
              >
                <option value="virement">Virement</option>
                <option value="cheque">Chèque</option>
                <option value="carte">Carte</option>
                <option value="especes">Espèces</option>
                <option value="autre">Autre</option>
              </select>
            </div>
          </div>
        )}

        {useLines && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Lignes de charge</h3>
              <button type="button" onClick={addLine} className="text-sm text-cabinet-700 hover:underline">
                + Ajouter une ligne
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-cabinet-100 text-cabinet-900">
                  <tr>
                    <th className="px-2 py-2 text-left">Désignation</th>
                    <th className="px-2 py-2 text-right">Qté</th>
                    <th className="px-2 py-2 text-right">Prix unit.</th>
                    <th className="px-2 py-2 text-right">TVA %</th>
                    <th className="px-2 py-2 text-right">HT</th>
                    <th className="px-2 py-2 text-right">TVA</th>
                    <th className="px-2 py-2 text-right">TTC</th>
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
                          placeholder="Désignation de la dépense"
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
                          className="input w-20 text-right"
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
                      <td className="px-2 py-2 text-right">{l.tauxTva}%</td>
                      <td className="px-2 py-2 text-right">{l.totalHt.toLocaleString("fr-FR")}</td>
                      <td className="px-2 py-2 text-right">{l.totalTva.toLocaleString("fr-FR")}</td>
                      <td className="px-2 py-2 text-right font-medium">{l.totalTtc.toLocaleString("fr-FR")}</td>
                      <td className="px-2 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => removeLine(idx)}
                          className="text-red-600 hover:text-red-800"
                          disabled={lines.length === 1}
                          title="Retirer la ligne"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium">Mode de paiement</label>
                <select
                  className="input w-full"
                  value={form.paymentMethod}
                  onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
                  required
                >
                  <option value="virement">Virement</option>
                  <option value="cheque">Chèque</option>
                  <option value="carte">Carte</option>
                  <option value="especes">Espèces</option>
                  <option value="autre">Autre</option>
                </select>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center gap-4 rounded-lg border border-gray-200 p-4">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={form.tvaEnabled}
              onChange={(e) => handleTvaToggle(e.target.checked)}
            />
            Charge avec TVA récupérable
          </label>
          {form.tvaEnabled && (
            <select
              className="input"
              value={form.tvaRateId}
              onChange={(e) => handleTvaRateChange(e.target.value)}
              required={form.tvaEnabled}
            >
              {tvaRates.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label} ({r.rate}%)
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Immobilisation amortie : bien inscrit en classe 2, charge étalée en dotations */}
        <div className="space-y-4 rounded-lg border border-gray-200 p-4">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={immo.enabled}
              onChange={(e) => setImmo({ ...immo, enabled: e.target.checked })}
            />
            Immobilisation amortie (charge étalée sur plusieurs mois)
          </label>
          <p className="text-xs text-gray-500">
            Le bien est inscrit à l&apos;actif (classe 2) au lieu d&apos;être passé en charge, puis
            amorti par une dotation mensuelle (D 681 Dotations / C 28 Amortissements).
          </p>

          {immo.enabled && (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">
                    Compte d&apos;immobilisation (classe 2)
                  </label>
                  <select
                    className="input w-full"
                    value={immo.accountCode}
                    onChange={(e) => setImmo({ ...immo, accountCode: e.target.value })}
                    required
                  >
                    <option value="">Sélectionner un compte...</option>
                    {immoAccounts.map((a) => (
                      <option key={a.accountCode} value={a.accountCode}>
                        {a.accountCode} — {a.label}
                      </option>
                    ))}
                  </select>
                  {immoAccounts.length === 0 && (
                    <p className="mt-1 text-xs text-red-600">
                      Aucun compte de classe 2 dans le plan comptable.
                    </p>
                  )}
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">
                    Début de l&apos;amortissement
                  </label>
                  <input
                    type="date"
                    className="input w-full"
                    value={immo.startDate}
                    onChange={(e) => setImmo({ ...immo, startDate: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="mr-2 text-xs font-medium text-gray-600">Calcul :</span>
                {IMMOBILISATION_MODES.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setImmo({ ...immo, mode: m.value })}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                      immo.mode === m.value
                        ? "bg-cabinet-700 text-white"
                        : "bg-white text-gray-600 border border-gray-300 hover:bg-gray-100"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {immo.mode === "montant" ? (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">
                      Dotation mensuelle (FCFA)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      className="input w-full"
                      value={immo.monthly}
                      onChange={(e) => setImmo({ ...immo, monthly: e.target.value })}
                      required
                    />
                  </div>
                ) : (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">
                      Taux d&apos;amortissement annuel (%)
                    </label>
                    <input
                      type="number"
                      min="0.01"
                      max="100"
                      step="0.01"
                      className="input w-full"
                      value={immo.rate}
                      onChange={(e) => setImmo({ ...immo, rate: e.target.value })}
                      required
                    />
                  </div>
                )}
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">
                    Durée (mois)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="600"
                    step="1"
                    className="input w-full"
                    value={immo.months}
                    onChange={(e) => setImmo({ ...immo, months: e.target.value })}
                    placeholder={
                      immo.mode === "taux" && amortissement
                        ? `${amortissement.months} (linéaire)`
                        : "ex. 60"
                    }
                    required={immo.mode === "montant"}
                  />
                </div>
              </div>

              {amortissement && amortissement.plan.length > 0 && (
                <div className="rounded-lg bg-cabinet-50 p-3 text-sm">
                  <div className="grid gap-1 md:grid-cols-2">
                    <p>
                      Base amortissable (HT) :{" "}
                      <span className="font-medium">
                        {amortissement.base.toLocaleString("fr-FR")} FCFA
                      </span>
                    </p>
                    <p>
                      Dotation mensuelle :{" "}
                      <span className="font-medium">
                        {amortissement.monthly.toLocaleString("fr-FR")} FCFA
                      </span>
                    </p>
                    <p>
                      Durée :{" "}
                      <span className="font-medium">{amortissement.plan.length} mois</span>{" "}
                      <span className="text-xs text-gray-500">
                        ({formatPeriode(
                          amortissement.plan[0].periodYear,
                          amortissement.plan[0].periodMonth
                        )}{" "}
                        →{" "}
                        {formatPeriode(
                          amortissement.plan[amortissement.plan.length - 1].periodYear,
                          amortissement.plan[amortissement.plan.length - 1].periodMonth
                        )}
                        )
                      </span>
                    </p>
                    <p>
                      Dernière dotation :{" "}
                      <span className="font-medium">
                        {amortissement.plan[amortissement.plan.length - 1].amount.toLocaleString(
                          "fr-FR"
                        )}{" "}
                        FCFA
                      </span>{" "}
                      <span className="text-xs text-gray-500">(solde de l&apos;arrondi)</span>
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">Fournisseur</label>
            <input
              type="text"
              className="input w-full"
              value={form.supplierName}
              onChange={(e) => setForm({ ...form, supplierName: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Référence facture</label>
            <input
              type="text"
              className="input w-full"
              value={form.supplierInvoiceRef}
              onChange={(e) => setForm({ ...form, supplierInvoiceRef: e.target.value })}
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Facture reçue (upload)</label>
          <input
            type="file"
            accept=".pdf,image/*"
            className="input w-full"
            onChange={(e) => setInvoiceFile(e.target.files?.[0] || null)}
          />
          {invoiceFile && (
            <p className="mt-1 text-xs text-gray-600">
              {invoiceFile.name} ({Math.round(invoiceFile.size / 1024)} Ko)
            </p>
          )}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Description</label>
          <textarea
            className="input w-full"
            rows={3}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>

        <div className="flex justify-end">
          <div className="w-full max-w-sm space-y-2 rounded-lg bg-cabinet-50 p-4 text-sm">
            <div className="flex justify-between">
              <span>Total HT</span>
              <span>{totals.ht.toLocaleString("fr-FR")} FCFA</span>
            </div>
            {form.tvaEnabled && (
              <div className="flex justify-between">
                <span>TVA</span>
                <span>{totals.tva.toLocaleString("fr-FR")} FCFA</span>
              </div>
            )}
            <div className="flex justify-between font-semibold">
              <span>Total TTC</span>
              <span>{totals.ttc.toLocaleString("fr-FR")} FCFA</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4">
          <Link href="/cabinet/charges" className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100">
            Annuler
          </Link>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? "Enregistrement..." : "Enregistrer la charge"}
          </button>
        </div>
      </form>
    </div>
  );
}
