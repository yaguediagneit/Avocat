"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BIEN_NATURES, BIEN_TYPES_DROIT } from "@/lib/transactions";

const inputCls = "input";
const labelCls = "mb-1 block text-xs font-medium text-gray-600";

export function BienFormClient({
  demandeurs,
  parcelles,
}: {
  demandeurs: any[];
  parcelles: any[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [f, setF] = useState({
    designation: "",
    nature: "IMMEUBLE",
    adresse: "",
    quartier: "",
    commune: "",
    superficie: "",
    typeDroit: "",
    referenceDroit: "",
    proprietaireId: "",
    parcelleId: "",
    notes: "",
  });

  function update(k: string, v: string) {
    setF((prev) => ({ ...prev, [k]: v }));
  }

  async function submit() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/transactions/biens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          designation: f.designation,
          nature: f.nature,
          adresse: f.adresse || null,
          quartier: f.quartier || null,
          commune: f.commune || null,
          superficie: f.superficie ? parseFloat(f.superficie) : null,
          uniteSuperficie: f.superficie ? "m2" : null,
          typeDroit: f.typeDroit || null,
          referenceDroit: f.referenceDroit || null,
          proprietaireId: f.proprietaireId || null,
          parcelleId: f.parcelleId || null,
          notes: f.notes || null,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(typeof j.error === "string" ? j.error : "Erreur");
      }
      setF({
        designation: "", nature: "IMMEUBLE", adresse: "", quartier: "", commune: "",
        superficie: "", typeDroit: "", referenceDroit: "", proprietaireId: "",
        parcelleId: "", notes: "",
      });
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    }
    setBusy(false);
  }

  return (
    <div className="card p-5">
      <button
        type="button"
        className="btn-primary px-4 py-2 text-sm"
        onClick={() => setOpen(!open)}
      >
        {open ? "− Fermer le formulaire" : "+ Nouveau bien"}
      </button>
      {open && (
        <div className="mt-4 space-y-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
              {error}
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className={labelCls}>Désignation *</label>
              <input className={inputCls} value={f.designation}
                onChange={(e) => update("designation", e.target.value)}
                placeholder="Villa 3 chambres, Terrain de 500 m², Local commercial…" />
            </div>
            <div>
              <label className={labelCls}>Nature</label>
              <select className={inputCls} value={f.nature}
                onChange={(e) => update("nature", e.target.value)}>
                {BIEN_NATURES.map((n) => (
                  <option key={n.code} value={n.code}>{n.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Adresse</label>
              <input className={inputCls} value={f.adresse}
                onChange={(e) => update("adresse", e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Quartier</label>
              <input className={inputCls} value={f.quartier}
                onChange={(e) => update("quartier", e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Commune</label>
              <input className={inputCls} value={f.commune}
                onChange={(e) => update("commune", e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Superficie (m²)</label>
              <input type="number" className={inputCls} value={f.superficie}
                onChange={(e) => update("superficie", e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Type de droit</label>
              <select className={inputCls} value={f.typeDroit}
                onChange={(e) => update("typeDroit", e.target.value)}>
                <option value="">—</option>
                {BIEN_TYPES_DROIT.map((d) => (
                  <option key={d.code} value={d.code}>{d.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Référence du droit</label>
              <input className={inputCls} value={f.referenceDroit}
                onChange={(e) => update("referenceDroit", e.target.value)}
                placeholder="TF n°, bail, autorisation d'occuper…" />
            </div>
            <div>
              <label className={labelCls}>Propriétaire (demandeur)</label>
              <select className={inputCls} value={f.proprietaireId}
                onChange={(e) => update("proprietaireId", e.target.value)}>
                <option value="">—</option>
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
              <label className={labelCls}>Parcelle liée</label>
              <select className={inputCls} value={f.parcelleId}
                onChange={(e) => update("parcelleId", e.target.value)}>
                <option value="">—</option>
                {parcelles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {[p.titreFoncier && `TF ${p.titreFoncier}`, p.nicad && `NICAD ${p.nicad}`, p.commune]
                      .filter(Boolean).join(" — ") || p.id}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-3">
              <label className={labelCls}>Notes</label>
              <textarea className={inputCls} rows={2} value={f.notes}
                onChange={(e) => update("notes", e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              className="btn-primary px-4 py-2 text-sm"
              disabled={busy || !f.designation.trim()}
              onClick={submit}
            >
              {busy ? "Enregistrement…" : "Créer le bien"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
