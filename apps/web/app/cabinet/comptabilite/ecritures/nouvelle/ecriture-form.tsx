"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { AccountingAccount, AccountingJournal, AccountingExercise } from "@prisma/client";

interface EcritureFormProps {
  journals: AccountingJournal[];
  exercises: AccountingExercise[];
  accounts: AccountingAccount[];
}

interface Line {
  accountId: string;
  debit: string;
  credit: string;
  libelle: string;
  tiersType: string;
  tiersId: string;
}

interface TiersItem {
  type: string;
  id: string;
  label: string;
}

const CLASSES: Record<number, string> = {
  1: "1 - Capitaux",
  2: "2 - Actif immobilisé",
  3: "3 - Stocks",
  4: "4 - Tiers",
  5: "5 - Trésorerie",
  6: "6 - Charges",
  7: "7 - Produits",
  8: "8 - Résultats",
};

export function EcritureForm({ journals, exercises, accounts }: EcritureFormProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState({
    journalId: journals[0]?.id ?? "",
    exerciseId: exercises[0]?.id ?? "",
    entryDate: today,
    reference: "",
    libelle: "",
  });

  const [lines, setLines] = useState<Line[]>([
    { accountId: "", debit: "", credit: "", libelle: "", tiersType: "", tiersId: "" },
    { accountId: "", debit: "", credit: "", libelle: "", tiersType: "", tiersId: "" },
  ]);
  const [tiersTypes, setTiersTypes] = useState<{ value: string; label: string }[]>([]);
  const [tiersList, setTiersList] = useState<TiersItem[]>([]);

  useEffect(() => {
    fetch("/api/comptabilite/tiers")
      .then((r) => (r.ok ? r.json() : { types: [], tiers: [] }))
      .then((d) => {
        setTiersTypes(d.types || []);
        setTiersList(d.tiers || []);
      })
      .catch(() => {});
  }, []);

  const groupedAccounts = accounts.reduce<Record<number, AccountingAccount[]>>((acc, a) => {
    (acc[a.class] ||= []).push(a);
    return acc;
  }, {});

  const totalDebit = lines.reduce((sum, l) => sum + (Number(l.debit) || 0), 0);
  const totalCredit = lines.reduce((sum, l) => sum + (Number(l.credit) || 0), 0);
  const balanced = Math.abs(totalDebit - totalCredit) < 0.001;

  function updateLine(index: number, field: keyof Line, value: string) {
    setLines((prev) =>
      prev.map((l, i) => {
        if (i !== index) return l;
        const next = { ...l, [field]: value };
        if (field === "tiersType") next.tiersId = "";
        return next;
      })
    );
  }

  function addLine() {
    setLines((prev) => [
      ...prev,
      { accountId: "", debit: "", credit: "", libelle: "", tiersType: "", tiersId: "" },
    ]);
  }

  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    if (!balanced) {
      setMessage("L'écriture doit être équilibrée (total débit = total crédit).");
      return;
    }

    const validLines = lines
      .filter((l) => l.accountId && (Number(l.debit) || Number(l.credit)))
      .map((l) => ({
        accountId: l.accountId,
        debit: Number(l.debit) || 0,
        credit: Number(l.credit) || 0,
        libelle: l.libelle,
        thirdPartyType: l.tiersType || undefined,
        thirdPartyId: l.tiersType && l.tiersId ? l.tiersId : undefined,
      }));

    if (validLines.length < 2) {
      setMessage("Une écriture doit avoir au moins deux lignes.");
      return;
    }

    const missingTiers = lines
      .filter((l) => l.accountId && (Number(l.debit) || Number(l.credit)))
      .some((l) => {
        const account = accounts.find((a) => a.id === l.accountId);
        return account?.class === 4 && (!l.tiersType || !l.tiersId);
      });
    if (missingTiers) {
      setMessage("Un compte de tiers (classe 4) doit être associé à un tiers.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/comptabilite/ecritures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, lines: validLines }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || "Erreur lors de la sauvegarde.");
      } else {
        router.push("/cabinet/comptabilite/ecritures");
        router.refresh();
      }
    } catch (error) {
      console.error(error);
      setMessage("Erreur réseau.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {message && (
        <div className={`rounded-lg p-3 text-sm ${balanced ? "bg-amber-50 text-amber-800" : "bg-red-50 text-red-700"}`}>
          {message}
        </div>
      )}

      <div className="grid gap-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">Journal</label>
          <select
            className="input w-full"
            value={form.journalId}
            onChange={(e) => setForm({ ...form, journalId: e.target.value })}
            required
          >
            {journals.map((j) => (
              <option key={j.id} value={j.id}>
                {j.code} - {j.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Exercice</label>
          <select
            className="input w-full"
            value={form.exerciseId}
            onChange={(e) => setForm({ ...form, exerciseId: e.target.value })}
            required
          >
            {exercises.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Date</label>
          <input
            type="date"
            className="input w-full"
            value={form.entryDate}
            onChange={(e) => setForm({ ...form, entryDate: e.target.value })}
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Référence</label>
          <input
            type="text"
            className="input w-full"
            value={form.reference}
            onChange={(e) => setForm({ ...form, reference: e.target.value })}
            placeholder="N° facture, pièce..."
          />
        </div>
        <div className="md:col-span-2">
          <label className="mb-1 block text-sm font-medium">Libellé</label>
          <input
            type="text"
            className="input w-full"
            value={form.libelle}
            onChange={(e) => setForm({ ...form, libelle: e.target.value })}
            placeholder="Libellé de l'écriture"
            required
          />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Lignes d'écriture</h2>
          <button type="button" onClick={addLine} className="text-sm text-cabinet-700 hover:underline">
            + Ajouter une ligne
          </button>
        </div>

        {lines.map((line, idx) => {
          const accountClass = accounts.find((a) => a.id === line.accountId)?.class;
          return (
          <div
            key={idx}
            className="space-y-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
          >
            <div className="grid items-end gap-3 md:grid-cols-[1fr_120px_120px_1fr_40px]">
            <div>
              <label className="mb-1 block text-xs font-medium">Compte</label>
              <select
                className="input w-full"
                value={line.accountId}
                onChange={(e) => updateLine(idx, "accountId", e.target.value)}
                required
              >
                <option value="">Sélectionner un compte</option>
                {Object.entries(groupedAccounts).map(([classe, items]) => (
                  <optgroup key={classe} label={CLASSES[Number(classe)] || `Classe ${classe}`}>
                    {items.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.accountCode} - {a.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Débit</label>
              <input
                type="number"
                min="0"
                step="1"
                className="input w-full"
                value={line.debit}
                onChange={(e) => updateLine(idx, "debit", e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Crédit</label>
              <input
                type="number"
                min="0"
                step="1"
                className="input w-full"
                value={line.credit}
                onChange={(e) => updateLine(idx, "credit", e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Libellé ligne</label>
              <input
                type="text"
                className="input w-full"
                value={line.libelle}
                onChange={(e) => updateLine(idx, "libelle", e.target.value)}
              />
            </div>
            <button
              type="button"
              onClick={() => removeLine(idx)}
              className="text-sm text-red-600 hover:text-red-800"
              title="Retirer la ligne"
            >
              ✕
            </button>
            </div>
            <div className="grid items-end gap-3 md:grid-cols-[160px_1fr]">
              <div>
                <label className="mb-1 block text-xs font-medium">
                  Type de tiers
                  {accountClass === 4 && <span className="text-red-500"> *</span>}
                </label>
                <select
                  className="input w-full"
                  value={line.tiersType}
                  onChange={(e) => updateLine(idx, "tiersType", e.target.value)}
                  required={accountClass === 4}
                >
                  <option value="">—</option>
                  {tiersTypes.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">
                  Tiers
                  {accountClass === 4 && <span className="text-red-500"> *</span>}
                </label>
                <select
                  className="input w-full"
                  value={line.tiersId}
                  onChange={(e) => updateLine(idx, "tiersId", e.target.value)}
                  disabled={!line.tiersType}
                  required={accountClass === 4}
                >
                  <option value="">Sélectionner un tiers</option>
                  {tiersList
                    .filter((t) => t.type === line.tiersType)
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                </select>
              </div>
            </div>
          </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="space-y-1 text-sm">
          <p>
            Total débit : <span className="font-semibold">{totalDebit.toLocaleString("fr-FR")}</span>
          </p>
          <p>
            Total crédit : <span className="font-semibold">{totalCredit.toLocaleString("fr-FR")}</span>
          </p>
          {!balanced && <p className="text-red-600">Écart : {(totalDebit - totalCredit).toLocaleString("fr-FR")}</p>}
        </div>
        <button type="submit" className="btn-primary" disabled={saving || !balanced}>
          {saving ? "Enregistrement..." : "Enregistrer l'écriture"}
        </button>
      </div>
    </form>
  );
}
