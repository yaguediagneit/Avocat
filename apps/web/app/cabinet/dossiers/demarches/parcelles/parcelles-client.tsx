"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SearchInput } from "@/components/search-input";
import { PaginatedRows } from "@/components/pagination";
import { ETATS_VERIFICATION_PARCELLE } from "@/lib/demarches";

const inputCls = "input";
const labelCls = "mb-1 block text-xs font-medium text-gray-600";
const ETAT_LABELS = Object.fromEntries(ETATS_VERIFICATION_PARCELLE.map((e) => [e.code, e.label]));

const ETAT_COLORS: Record<string, string> = {
  DECLARE: "bg-gray-100 text-gray-600",
  PIECES_RECUES: "bg-blue-100 text-blue-700",
  A_VERIFIER: "bg-amber-100 text-amber-700",
  VERIFIE: "bg-emerald-100 text-emerald-700",
  INCOHERENT: "bg-red-100 text-red-700",
};

const FIELDS_LOCALISATION: [string, string][] = [
  ["region", "Région"],
  ["departement", "Département"],
  ["commune", "Commune"],
  ["quartier", "Quartier / village / lotissement"],
  ["adresse", "Adresse / indications de localisation"],
];

const FIELDS_REFERENCES: [string, string][] = [
  ["nicad", "NICAD"],
  ["titreFoncier", "Titre foncier"],
  ["lot", "Lot"],
  ["bloc", "Bloc"],
  ["ilot", "Îlot"],
  ["numeroParcelle", "N° de parcelle"],
  ["section", "Section"],
];

const FIELDS_DROIT: [string, string][] = [
  ["referenceDroit", "Référence du droit (bail, permis, acte…)"],
  ["origineDroit", "Origine du droit"],
  ["referencesEnregistrement", "Références d'enregistrement"],
];

const FIELDS_TECHNIQUES: [string, string][] = [
  ["referencesPlans", "Références des plans"],
  ["auteurPlans", "Auteur des plans"],
  ["usageActuel", "Usage actuel"],
  ["usageProjete", "Usage projeté"],
];

export function ParcellesClient({ parcelles: initial, canWrite }: { parcelles: any[]; canWrite: boolean }) {
  const router = useRouter();
  const [parcelles, setParcelles] = useState(initial);
  const [edit, setEdit] = useState<any | null>(null);
  const [error, setError] = useState("");

  async function save() {
    if (!edit) return;
    try {
      const payload = {
        ...edit,
        superficie: edit.superficie ? Number(edit.superficie) : null,
      };
      const res = await fetch(
        edit.id ? `/api/demarches/parcelles/${edit.id}` : "/api/demarches/parcelles",
        {
          method: edit.id ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(typeof j.error === "string" ? j.error : "Erreur");
      }
      const saved = await res.json();
      if (edit.id) {
        setParcelles(parcelles.map((p) => (p.id === saved.id ? saved : p)));
      } else {
        setParcelles([saved, ...parcelles]);
      }
      setEdit(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    }
  }

  function field(key: string, label: string) {
    return (
      <div key={key}>
        <label className={labelCls}>{label}</label>
        <input className={inputCls} value={edit?.[key] || ""}
          onChange={(e) => setEdit({ ...edit, [key]: e.target.value })} />
      </div>
    );
  }

  return (
    <div className="card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SearchInput placeholder="Filtrer (NICAD, titre foncier, commune…)" />
        {canWrite && (
          <button type="button" className="btn-primary" onClick={() => { setError(""); setEdit({}); }}>
            + Nouvelle parcelle
          </button>
        )}
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs text-gray-600">
            <tr>
              <th className="px-3 py-2">Localisation</th>
              <th className="px-3 py-2">NICAD</th>
              <th className="px-3 py-2">Titre foncier</th>
              <th className="px-3 py-2">Droit / référence</th>
              <th className="px-3 py-2">Charges</th>
              <th className="px-3 py-2">Vérification</th>
              {canWrite && <th className="px-3 py-2" />}
            </tr>
          </thead>
          <tbody>
            <PaginatedRows colSpan={7} pageSize={15}>
              {parcelles.map((p) => (
                <tr key={p.id} className="border-t">
                  <td className="px-3 py-2">
                    <div className="font-medium">
                      {[p.adresse, p.quartier].filter(Boolean).join(", ") || "—"}
                    </div>
                    <div className="text-xs text-gray-500">
                      {[p.commune, p.departement, p.region].filter(Boolean).join(" · ")}
                    </div>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{p.nicad || "—"}</td>
                  <td className="px-3 py-2 text-xs">{p.titreFoncier || "—"}</td>
                  <td className="px-3 py-2 text-xs">
                    {p.typeDroit ? `${p.typeDroit} ` : ""}{p.referenceDroit || "—"}
                  </td>
                  <td className="max-w-[220px] px-3 py-2 text-xs text-gray-600">
                    {p.chargesInscriptions ? (
                      <span title={p.chargesInscriptions} className="line-clamp-2">{p.chargesInscriptions}</span>
                    ) : "—"}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${ETAT_COLORS[p.etatVerification] || ""}`}>
                      {ETAT_LABELS[p.etatVerification] || p.etatVerification}
                    </span>
                  </td>
                  {canWrite && (
                    <td className="px-3 py-2">
                      <button type="button" className="btn-secondary px-2 py-0.5 text-xs"
                        onClick={() => { setError(""); setEdit({ ...p, superficie: p.superficie ?? "" }); }}>
                        Modifier
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {parcelles.length === 0 && (
                <tr><td colSpan={7} className="px-3 py-6 text-center text-gray-400">Aucune parcelle.</td></tr>
              )}
            </PaginatedRows>
          </tbody>
        </table>
      </div>

      {edit && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
          <div className="card mt-8 w-full max-w-3xl space-y-4">
            <h3 className="font-semibold">{edit.id ? "Modifier la parcelle" : "Nouvelle parcelle"}</h3>
            {error && <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

            <div>
              <div className="mb-2 text-xs font-semibold text-gray-600">Localisation</div>
              <div className="grid gap-3 sm:grid-cols-3">
                {FIELDS_LOCALISATION.map(([k, l]) => field(k, l))}
              </div>
            </div>

            <div className="border-t pt-3">
              <div className="mb-2 text-xs font-semibold text-gray-600">Références cadastrales</div>
              <div className="grid gap-3 sm:grid-cols-3">
                {FIELDS_REFERENCES.map(([k, l]) => field(k, l))}
                <div>
                  <label className={labelCls}>Superficie</label>
                  <input type="number" step="0.01" className={inputCls} value={edit.superficie ?? ""}
                    onChange={(e) => setEdit({ ...edit, superficie: e.target.value })} />
                </div>
                <div>
                  <label className={labelCls}>Unité</label>
                  <select className={inputCls} value={edit.uniteSuperficie || "m2"}
                    onChange={(e) => setEdit({ ...edit, uniteSuperficie: e.target.value })}>
                    <option value="m2">m²</option>
                    <option value="ha">ha</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="border-t pt-3">
              <div className="mb-2 text-xs font-semibold text-gray-600">Droit d'occupation / propriété</div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className={labelCls}>Type de droit</label>
                  <select className={inputCls} value={edit.typeDroit || ""}
                    onChange={(e) => setEdit({ ...edit, typeDroit: e.target.value })}>
                    <option value="">—</option>
                    <option value="titre_foncier">Titre foncier</option>
                    <option value="bail">Bail</option>
                    <option value="droit_superficie">Droit de superficie</option>
                    <option value="permis_occuper">Permis d'occuper</option>
                    <option value="autorisation_occuper">Autorisation d'occuper</option>
                    <option value="deliberation">Délibération</option>
                    <option value="acte_attribution">Acte d'attribution</option>
                    <option value="autre">Autre</option>
                  </select>
                </div>
                {FIELDS_DROIT.map(([k, l]) => field(k, l))}
                <div>
                  <label className={labelCls}>Date de l'acte</label>
                  <input type="date" className={inputCls}
                    value={edit.dateActe ? String(edit.dateActe).slice(0, 10) : ""}
                    onChange={(e) => setEdit({ ...edit, dateActe: e.target.value })} />
                </div>
              </div>
            </div>

            <div>
              <label className={labelCls}>
                Charges et inscriptions connues (hypothèques, prénotations, saisies, servitudes, contentieux)
              </label>
              <textarea className={inputCls} rows={2} value={edit.chargesInscriptions || ""}
                onChange={(e) => setEdit({ ...edit, chargesInscriptions: e.target.value })} />
            </div>

            <div className="grid gap-3 border-t pt-3 sm:grid-cols-3">
              {FIELDS_TECHNIQUES.map(([k, l]) => field(k, l))}
            </div>

            <div>
              <label className={labelCls}>État de vérification</label>
              <select className={inputCls} value={edit.etatVerification || "DECLARE"}
                onChange={(e) => setEdit({ ...edit, etatVerification: e.target.value })}>
                {ETATS_VERIFICATION_PARCELLE.map((s) => (
                  <option key={s.code} value={s.code}>{s.label}</option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-2 border-t pt-3">
              <button type="button" className="btn-secondary" onClick={() => setEdit(null)}>Annuler</button>
              <button type="button" className="btn-primary" onClick={save}>Enregistrer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
