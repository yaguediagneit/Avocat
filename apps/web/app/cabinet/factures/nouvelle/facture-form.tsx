"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import Link from "next/link";

interface DossierOption {
  id: string;
  referenceInterne: string;
  clientId: string;
  client?: { raisonSociale: string } | null;
}

interface ClientOption {
  id: string;
  raisonSociale: string;
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

interface FactureFormProps {
  dossiers: DossierOption[];
  clients: ClientOption[];
  tvaRates: TvaRate[];
  taches: TacheOption[];
  missions: MissionOption[];
}

function recalcLine(line: Line, taux: number): Line {
  const q = Number(line.quantite) || 0;
  const pu = Number(line.prixUnitaire) || 0;
  const ht = Math.round(q * pu * 100) / 100;
  const tva = Math.round(ht * (taux / 100) * 100) / 100;
  const ttc = Math.round((ht + tva) * 100) / 100;
  return { ...line, tauxTva: taux, totalHt: ht, totalTva: tva, totalTtc: ttc };
}

export function FactureForm({ dossiers, clients, tvaRates, taches, missions }: FactureFormProps) {
  const router = useRouter();
  const [dossierQuery, setDossierQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState("");

  const defaultTva = tvaRates.find((r) => r.rate === 18) || tvaRates[0];

  const [form, setForm] = useState({
    dossierId: "",
    tacheId: "",
    missionId: "",
    clientId: "",
    numero: `FACT-${Date.now()}`,
    libelle: "",
    designation: "",
    tvaEnabled: false,
    tvaRateId: defaultTva?.id || "",
    dateEcheance: "",
    amount: "",
  });

  const [useLines, setUseLines] = useState(false);
  const [lines, setLines] = useState<Line[]>([
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

  function updateLine(index: number, field: keyof Line, value: string | number) {
    setLines((prev) =>
      prev.map((l, i) => {
        if (i !== index) return l;
        const next = { ...l, [field]: value } as Line;
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
      // Recalcule les lignes avec le taux courant
      setLines((prev) => prev.map((l) => recalcLine(l, tauxTva)));
    }
  }

  function handleDossierChange(dossierId: string) {
    const dossier = dossiers.find((d) => d.id === dossierId);
    setForm((f) => ({
      ...f,
      dossierId,
      tacheId: "",
      missionId: "",
      clientId: dossier?.clientId || f.clientId,
    }));
  }

  function handleTacheChange(tacheId: string) {
    const tache = taches.find((t) => t.id === tacheId);
    const dossier = tache ? dossiers.find((d) => d.id === tache.dossierId) : undefined;
    setForm((f) => ({
      ...f,
      tacheId,
      missionId: "",
      dossierId: tache?.dossierId || "",
      clientId: dossier?.clientId || f.clientId,
    }));
  }

  function handleMissionChange(missionId: string) {
    const mission = missions.find((m) => m.id === missionId);
    const dossier = mission ? dossiers.find((d) => d.id === mission.dossierId) : undefined;
    setForm((f) => ({
      ...f,
      missionId,
      tacheId: "",
      dossierId: mission?.dossierId || "",
      clientId: dossier?.clientId || f.clientId,
    }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setGeneralError("");
    setLoading(true);

    let validLines: Line[];

    if (useLines) {
      validLines = lines.filter((l) => l.description.trim() && (l.quantite * l.prixUnitaire) > 0);
      if (validLines.length === 0) {
        setGeneralError("Ajoutez au moins une ligne valide.");
        setLoading(false);
        return;
      }
    } else {
      if (simpleTotals.ttc <= 0) {
        setGeneralError("Saisissez un montant supérieur à zéro.");
        setLoading(false);
        return;
      }
      validLines = [
        {
          description: form.libelle.trim() || "Prestation",
          quantite: 1,
          prixUnitaire: simpleTotals.ht,
          tauxTva,
          totalHt: simpleTotals.ht,
          totalTva: simpleTotals.tva,
          totalTtc: simpleTotals.ttc,
        },
      ];
    }

    const body = {
      dossierId: form.dossierId || null,
      tacheId: form.tacheId || null,
      missionId: form.missionId || null,
      clientId: form.clientId,
      numero: form.numero,
      libelle: form.libelle,
      designation: form.designation,
      tvaEnabled: form.tvaEnabled,
      tvaRateId: form.tvaEnabled ? form.tvaRateId : null,
      dateEcheance: form.dateEcheance ? new Date(form.dateEcheance).toISOString() : null,
      lines: validLines.map((l, i) => ({ ...l, ordre: i })),
    };

    const res = await fetch("/api/factures", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    setLoading(false);

    if (res.ok) {
      router.push("/cabinet/factures");
      return;
    }

    const data = await res.json().catch(() => ({}));
    if (data.error?.fieldErrors) {
      const flat: Record<string, string> = {};
      for (const [key, value] of Object.entries(data.error.fieldErrors as Record<string, string[]>)) {
        flat[key] = value[0];
      }
      setErrors(flat);
      setGeneralError(data.error.formErrors?.[0] || "");
    } else if (typeof data.error === "string") {
      setGeneralError(data.error);
    } else {
      setGeneralError("Erreur lors de la création de la facture");
    }
  }

  return (
    <form onSubmit={onSubmit} className="card space-y-5">
      {generalError && (
        <div className="rounded-md bg-red-100 p-3 text-sm text-red-700">{generalError}</div>
      )}

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
            {errors.dossierId && <p className="mt-1 text-xs text-red-600">{errors.dossierId}</p>}
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
                {errors.tacheId && <p className="mt-1 text-xs text-red-600">{errors.tacheId}</p>}
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
                {errors.missionId && <p className="mt-1 text-xs text-red-600">{errors.missionId}</p>}
              </div>
            </>
          )}
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Client</label>
        <select
          value={form.clientId}
          onChange={(e) => setForm({ ...form, clientId: e.target.value })}
          className="input"
          required
        >
          <option value="">Sélectionner un client</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.raisonSociale}
            </option>
          ))}
        </select>
        {errors.clientId && <p className="mt-1 text-xs text-red-600">{errors.clientId}</p>}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">Numéro de facture</label>
          <input
            type="text"
            value={form.numero}
            onChange={(e) => setForm({ ...form, numero: e.target.value })}
            className="input"
            required
          />
          {errors.numero && <p className="mt-1 text-xs text-red-600">{errors.numero}</p>}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Date d'échéance</label>
          <input
            type="date"
            value={form.dateEcheance}
            onChange={(e) => setForm({ ...form, dateEcheance: e.target.value })}
            className="input"
          />
          {errors.dateEcheance && <p className="mt-1 text-xs text-red-600">{errors.dateEcheance}</p>}
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Libellé</label>
        <input
          type="text"
          value={form.libelle}
          onChange={(e) => setForm({ ...form, libelle: e.target.value })}
          className="input"
          required
        />
        {errors.libelle && <p className="mt-1 text-xs text-red-600">{errors.libelle}</p>}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Désignation / Notes</label>
        <textarea
          value={form.designation}
          onChange={(e) => setForm({ ...form, designation: e.target.value })}
          className="input"
          rows={3}
        />
        {errors.designation && <p className="mt-1 text-xs text-red-600">{errors.designation}</p>}
      </div>

      <div className="flex items-center gap-4 rounded-lg border border-gray-200 p-4">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={form.tvaEnabled}
            onChange={(e) => handleTvaToggle(e.target.checked)}
          />
          Facture avec TVA
        </label>
        {form.tvaEnabled && (
          <div>
            <label className="mb-1 block text-xs text-gray-600">Taux de TVA</label>
            <select
              value={form.tvaRateId}
              onChange={(e) => handleTvaRateChange(e.target.value)}
              className="input"
              required={form.tvaEnabled}
            >
              {tvaRates.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label} ({r.rate}%)
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Bascule entre montant global et lignes détaillées */}
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

      {/* Montant global */}
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
            {form.tvaEnabled && (
              <p className="mt-1 text-xs text-gray-500">
                La TVA ({tauxTva}%) est extraite du montant TTC saisi.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Lignes détaillées */}
      {useLines && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Lignes de facture</h3>
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
                        placeholder="Prestation"
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
        </div>
      )}

      <div className="flex justify-end">
        <div className="w-full max-w-sm space-y-2 rounded-lg bg-cabinet-50 p-4 text-sm">
          <div className="flex justify-between">
            <span>Total HT</span>
            <span>{totals.ht.toLocaleString("fr-FR")} FCFA</span>
          </div>
          {form.tvaEnabled && (
            <div className="flex justify-between">
              <span>Total TVA</span>
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
        <button
          type="button"
          onClick={() => router.push("/cabinet/factures")}
          className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
        >
          Annuler
        </button>
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? "Création..." : "Créer la facture"}
        </button>
      </div>
    </form>
  );
}
