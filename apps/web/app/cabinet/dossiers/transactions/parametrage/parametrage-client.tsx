"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  TRANSACTION_FAMILLES,
  TRANSACTION_WORKFLOWS,
  TRX_PIECE_CATEGORIES,
  TRX_PARTIE_ROLES,
} from "@/lib/transactions";
import { PIECE_NIVEAUX, PIECE_SOURCES } from "@/lib/demarches";
import { extractTemplateVariables } from "@/lib/document-template";

const inputCls = "input";
const labelCls = "mb-1 block text-xs font-medium text-gray-600";

const FAMILLE_LABELS = Object.fromEntries(TRANSACTION_FAMILLES.map((f) => [f.code, f.label]));
const WORKFLOW_LABELS = Object.fromEntries(TRANSACTION_WORKFLOWS.map((w) => [w.code, w.label]));
const CATEGORIE_LABELS = Object.fromEntries(TRX_PIECE_CATEGORIES.map((c) => [c.code, c.label]));

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

const EMPTY_TYPE = {
  code: "",
  libelle: "",
  famille: "AUTRE",
  workflow: "GENERIQUE",
  circuitPrincipal: "",
  bienRequis: true,
  notaireObligatoire: false,
  mutationFonciere: false,
  enregistrementAEvaluer: false,
  qualificationObligatoire: false,
  validationAvocat: false,
  sensible: false,
  nbExemplaires: 2,
  delaiRelanceJours: 15,
  avertissement: "",
};

export function TransactionsParametrage({
  types: initialTypes,
  modeles: initialModeles,
  estAdmin,
}: {
  types: any[];
  modeles: any[];
  estAdmin: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"types" | "modeles">("types");
  const [types, setTypes] = useState(initialTypes);
  const [modeles, setModeles] = useState(initialModeles);
  const [error, setError] = useState("");
  const [openTypeId, setOpenTypeId] = useState<string | null>(null);
  const [editType, setEditType] = useState<any | null>(null);
  const [editModele, setEditModele] = useState<any | null>(null);
  const [newPiece, setNewPiece] = useState({
    code: "",
    libelle: "",
    categorie: "PIECE_CLIENT",
    niveau: "OBLIGATOIRE",
    partieConcernee: "TOUTES",
    sourceAttendue: "CLIENT",
    condition: "",
  });

  async function saveType() {
    if (!editType) return;
    setError("");
    try {
      const payload = {
        libelle: editType.libelle,
        famille: editType.famille,
        workflow: editType.workflow,
        circuitPrincipal: editType.circuitPrincipal || null,
        bienRequis: !!editType.bienRequis,
        notaireObligatoire: !!editType.notaireObligatoire,
        mutationFonciere: !!editType.mutationFonciere,
        enregistrementAEvaluer: !!editType.enregistrementAEvaluer,
        qualificationObligatoire: !!editType.qualificationObligatoire,
        validationAvocat: !!editType.validationAvocat,
        sensible: !!editType.sensible,
        nbExemplaires: Number(editType.nbExemplaires) || 2,
        delaiRelanceJours: Number(editType.delaiRelanceJours) || 15,
        avertissement: editType.avertissement || null,
        actif: editType.actif !== false,
      };
      if (editType.id) {
        const updated = await call(`/api/transactions/types/${editType.id}`, "PATCH", payload);
        setTypes(types.map((t) => (t.id === updated.id ? { ...t, ...updated } : t)));
      } else {
        if (!editType.code?.trim()) { setError("Code obligatoire."); return; }
        const created = await call("/api/transactions/types", "POST", {
          ...payload,
          code: editType.code.trim(),
        });
        setTypes([...types, { ...created, pieces: [], _count: { transactions: 0 } }]);
      }
      setEditType(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    }
  }

  async function addPiece(typeId: string) {
    if (!newPiece.code.trim() || !newPiece.libelle.trim()) {
      setError("Code et libellé de la pièce obligatoires.");
      return;
    }
    try {
      const piece = await call(`/api/transactions/types/${typeId}/pieces`, "POST", {
        ...newPiece,
        condition: newPiece.condition || null,
        ordre: (types.find((t) => t.id === typeId)?.pieces?.length || 0) + 1,
      });
      setTypes(types.map((t) =>
        t.id === typeId ? { ...t, pieces: [...t.pieces, piece] } : t
      ));
      setNewPiece({ code: "", libelle: "", categorie: "PIECE_CLIENT", niveau: "OBLIGATOIRE", partieConcernee: "TOUTES", sourceAttendue: "CLIENT", condition: "" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    }
  }

  async function patchPiece(typeId: string, piece: any, patch: any) {
    try {
      const updated = await call(
        `/api/transactions/types/${typeId}/pieces/${piece.id}`,
        "PATCH",
        patch
      );
      setTypes(types.map((t) =>
        t.id === typeId
          ? { ...t, pieces: t.pieces.map((p: any) => (p.id === piece.id ? updated : p)) }
          : t
      ));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    }
  }

  async function saveModele() {
    if (!editModele) return;
    try {
      const payload = {
        titre: editModele.titre,
        typeId: editModele.typeId || null,
        validationMinimale: editModele.validationMinimale || null,
        contenu: editModele.contenu,
        ordre: Number(editModele.ordre) || 0,
        actif: editModele.actif !== false,
      };
      if (editModele.id) {
        const updated = await call(`/api/transactions/modeles/${editModele.id}`, "PATCH", payload);
        setModeles(modeles.map((m) => (m.id === updated.id ? { ...m, ...updated } : m)));
      } else {
        if (!editModele.code?.trim()) { setError("Code obligatoire (TPL_*)."); return; }
        const created = await call("/api/transactions/modeles", "POST", {
          ...payload,
          code: editModele.code.trim(),
        });
        setModeles([...modeles, { ...created, type: types.find((t) => t.id === created.typeId) || null }]);
      }
      setEditModele(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    }
  }

  const TABS = [
    { key: "types", label: `Types de transactions (${types.length})` },
    { key: "modeles", label: `Modèles de contrats (${modeles.length})` },
  ] as const;

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
              tab === t.key ? "bg-cabinet-700 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {tab === "types" && (
        <div className="space-y-3">
          {estAdmin && (
            <div className="flex justify-end">
              <button type="button" className="btn-primary" onClick={() => setEditType({ ...EMPTY_TYPE })}>
                + Nouveau type
              </button>
            </div>
          )}
          {types.map((t) => (
            <div key={t.id} className={`card p-4 ${t.actif === false ? "opacity-60" : ""}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-cabinet-100 px-2 py-0.5 font-mono text-xs text-cabinet-800">{t.code}</span>
                    <span className="font-semibold">{t.libelle}</span>
                    <span className="text-xs text-gray-400">{FAMILLE_LABELS[t.famille] || t.famille}</span>
                    <span className="rounded bg-gray-100 px-2 py-0.5 text-xs">{WORKFLOW_LABELS[t.workflow] || t.workflow}</span>
                    {t.actif === false && <span className="rounded bg-gray-200 px-2 py-0.5 text-xs">Inactif</span>}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-gray-500">
                    <span>{t.pieces?.filter((p: any) => p.actif !== false).length || 0} pièce(s)</span>
                    <span>{t._count?.transactions || 0} transaction(s)</span>
                    {t.notaireObligatoire && <span className="text-violet-700">notaire requis</span>}
                    {t.mutationFonciere && <span className="text-indigo-700">mutation livre foncier</span>}
                    {t.enregistrementAEvaluer && <span>enregistrement à évaluer</span>}
                    {t.validationAvocat && <span className="text-amber-700">validation avocat</span>}
                    {t.sensible && <span className="text-red-700">sensible</span>}
                  </div>
                  {t.circuitPrincipal && (
                    <div className="mt-1 text-xs text-gray-400">Circuit : {t.circuitPrincipal}</div>
                  )}
                </div>
                <div className="flex gap-2">
                  <button type="button" className="btn-secondary px-3 py-1 text-xs"
                    onClick={() => setOpenTypeId(openTypeId === t.id ? null : t.id)}>
                    {openTypeId === t.id ? "Masquer" : "Check-list"}
                  </button>
                  {estAdmin && (
                    <button type="button" className="btn-secondary px-3 py-1 text-xs"
                      onClick={() => setEditType({ ...t })}>
                      Modifier
                    </button>
                  )}
                </div>
              </div>
              {t.avertissement && (
                <div className="mt-2 rounded border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-800">
                  ⚠️ {t.avertissement}
                </div>
              )}

              {openTypeId === t.id && (
                <div className="mt-3 overflow-x-auto border-t pt-3">
                  <table className="w-full text-left text-xs">
                    <thead className="text-gray-500">
                      <tr>
                        <th className="px-2 py-1">Pièce</th>
                        <th className="px-2 py-1">Catégorie</th>
                        <th className="px-2 py-1">Niveau</th>
                        <th className="px-2 py-1">Partie</th>
                        <th className="px-2 py-1">Source</th>
                        <th className="px-2 py-1">Condition</th>
                        <th className="px-2 py-1">Active</th>
                      </tr>
                    </thead>
                    <tbody>
                      {t.pieces.map((p: any) => (
                        <tr key={p.id} className={`border-t ${p.actif === false ? "opacity-50 line-through" : ""}`}>
                          <td className="px-2 py-1">{p.libelle}</td>
                          <td className="px-2 py-1">
                            {estAdmin ? (
                              <select className="rounded border px-1 py-0.5" value={p.categorie}
                                onChange={(e) => patchPiece(t.id, p, { categorie: e.target.value })}>
                                {TRX_PIECE_CATEGORIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
                              </select>
                            ) : CATEGORIE_LABELS[p.categorie] || p.categorie}
                          </td>
                          <td className="px-2 py-1">
                            {estAdmin ? (
                              <select className="rounded border px-1 py-0.5" value={p.niveau}
                                onChange={(e) => patchPiece(t.id, p, { niveau: e.target.value })}>
                                {PIECE_NIVEAUX.map((n) => <option key={n.code} value={n.code}>{n.label}</option>)}
                              </select>
                            ) : p.niveau}
                          </td>
                          <td className="px-2 py-1">
                            {estAdmin ? (
                              <select className="rounded border px-1 py-0.5" value={p.partieConcernee || "TOUTES"}
                                onChange={(e) => patchPiece(t.id, p, { partieConcernee: e.target.value })}>
                                {["TOUTES", ...TRX_PARTIE_ROLES.map((r) => r.code), "CABINET", "NOTAIRE"].map((r) => (
                                  <option key={r} value={r}>{r}</option>
                                ))}
                              </select>
                            ) : p.partieConcernee}
                          </td>
                          <td className="px-2 py-1">
                            {estAdmin ? (
                              <select className="rounded border px-1 py-0.5" value={p.sourceAttendue || "CLIENT"}
                                onChange={(e) => patchPiece(t.id, p, { sourceAttendue: e.target.value })}>
                                {PIECE_SOURCES.map((s) => <option key={s.code} value={s.code}>{s.label}</option>)}
                              </select>
                            ) : p.sourceAttendue}
                          </td>
                          <td className="px-2 py-1">
                            {estAdmin ? (
                              <input className="w-32 rounded border px-1 py-0.5" defaultValue={p.condition || ""}
                                onBlur={(e) => e.target.value !== (p.condition || "") && patchPiece(t.id, p, { condition: e.target.value || null })} />
                            ) : p.condition || "—"}
                          </td>
                          <td className="px-2 py-1">
                            {estAdmin ? (
                              <input type="checkbox" checked={p.actif !== false}
                                onChange={(e) => patchPiece(t.id, p, { actif: e.target.checked })} />
                            ) : (p.actif !== false ? "✓" : "—")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {estAdmin && (
                    <div className="mt-2 grid gap-2 border-t pt-2 sm:grid-cols-7">
                      <input className={inputCls} placeholder="Code" value={newPiece.code}
                        onChange={(e) => setNewPiece({ ...newPiece, code: e.target.value })} />
                      <input className={`${inputCls} sm:col-span-2`} placeholder="Libellé" value={newPiece.libelle}
                        onChange={(e) => setNewPiece({ ...newPiece, libelle: e.target.value })} />
                      <select className={inputCls} value={newPiece.categorie}
                        onChange={(e) => setNewPiece({ ...newPiece, categorie: e.target.value })}>
                        {TRX_PIECE_CATEGORIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
                      </select>
                      <select className={inputCls} value={newPiece.niveau}
                        onChange={(e) => setNewPiece({ ...newPiece, niveau: e.target.value })}>
                        {PIECE_NIVEAUX.map((n) => <option key={n.code} value={n.code}>{n.label}</option>)}
                      </select>
                      <select className={inputCls} value={newPiece.partieConcernee}
                        onChange={(e) => setNewPiece({ ...newPiece, partieConcernee: e.target.value })}>
                        {["TOUTES", ...TRX_PARTIE_ROLES.map((r) => r.code), "CABINET", "NOTAIRE"].map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                      <button type="button" className="btn-secondary px-3 py-1 text-xs" onClick={() => addPiece(t.id)}>
                        + Ajouter
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === "modeles" && (
        <div className="space-y-3">
          {estAdmin && (
            <div className="flex justify-end">
              <button type="button" className="btn-primary"
                onClick={() => setEditModele({ code: "TPL_", titre: "", typeId: "", contenu: "", ordre: 0, actif: true })}>
                + Nouveau modèle
              </button>
            </div>
          )}
          {modeles.map((m) => (
            <div key={m.id} className={`card p-4 ${m.actif === false ? "opacity-60" : ""}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-gray-100 px-2 py-0.5 font-mono text-xs">{m.code}</span>
                    <span className="font-semibold">{m.titre}</span>
                    {m.type
                      ? <span className="rounded bg-cabinet-100 px-2 py-0.5 text-xs text-cabinet-700">{m.type.code}</span>
                      : <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">Transversal</span>}
                    {m.actif === false && <span className="rounded bg-gray-200 px-2 py-0.5 text-xs">Inactif</span>}
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    {extractTemplateVariables(m.contenu).length} variable(s) ·
                    validation {m.validationMinimale || "juriste"}
                    {m.contenu?.includes("INTERVENTION DU CABINET") && (
                      <span className="ml-2 text-emerald-700">clause cabinet ✓</span>
                    )}
                  </div>
                </div>
                {estAdmin && (
                  <button type="button" className="btn-secondary px-3 py-1 text-xs"
                    onClick={() => setEditModele({ ...m, typeId: m.typeId || "" })}>
                    Modifier
                  </button>
                )}
              </div>
            </div>
          ))}
          {modeles.length === 0 && (
            <div className="card p-4 text-center text-sm text-gray-400">
              Aucun modèle. Lancez `node scripts/seed-transactions.js`.
            </div>
          )}
        </div>
      )}

      {/* Modal édition type */}
      {editType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold">
              {editType.id ? `Modifier ${editType.code}` : "Nouveau type de transaction"}
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {!editType.id && (
                <div>
                  <label className={labelCls}>Code *</label>
                  <input className={inputCls} value={editType.code}
                    onChange={(e) => setEditType({ ...editType, code: e.target.value })}
                    placeholder="BAIL_SAISONNIER" />
                </div>
              )}
              <div>
                <label className={labelCls}>Libellé *</label>
                <input className={inputCls} value={editType.libelle}
                  onChange={(e) => setEditType({ ...editType, libelle: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>Famille</label>
                <select className={inputCls} value={editType.famille}
                  onChange={(e) => setEditType({ ...editType, famille: e.target.value })}>
                  {TRANSACTION_FAMILLES.map((f) => <option key={f.code} value={f.code}>{f.label}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Workflow</label>
                <select className={inputCls} value={editType.workflow}
                  onChange={(e) => setEditType({ ...editType, workflow: e.target.value })}>
                  {TRANSACTION_WORKFLOWS.map((w) => <option key={w.code} value={w.code}>{w.label}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>Circuit principal</label>
                <input className={inputCls} value={editType.circuitPrincipal || ""}
                  onChange={(e) => setEditType({ ...editType, circuitPrincipal: e.target.value })}
                  placeholder="Notaire → Conservation → DGID…" />
              </div>
              <div className="sm:col-span-2 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                {[
                  ["bienRequis", "Bien requis"],
                  ["notaireObligatoire", "Notaire requis"],
                  ["mutationFonciere", "Mutation livre foncier"],
                  ["enregistrementAEvaluer", "Enregistrement à évaluer"],
                  ["qualificationObligatoire", "Qualification requise"],
                  ["validationAvocat", "Validation avocat"],
                  ["sensible", "Sensible"],
                  ["actif", "Actif"],
                ].map(([k, l]) => (
                  <label key={k} className="flex items-center gap-2">
                    <input type="checkbox"
                      checked={k === "actif" ? editType.actif !== false : !!editType[k as string]}
                      onChange={(e) =>
                        setEditType({ ...editType, [k as string]: e.target.checked })
                      } />
                    {l}
                  </label>
                ))}
              </div>
              <div>
                <label className={labelCls}>Exemplaires</label>
                <input type="number" className={inputCls} value={editType.nbExemplaires}
                  onChange={(e) => setEditType({ ...editType, nbExemplaires: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>Relance (jours)</label>
                <input type="number" className={inputCls} value={editType.delaiRelanceJours}
                  onChange={(e) => setEditType({ ...editType, delaiRelanceJours: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>Avertissement affiché</label>
                <textarea className={inputCls} rows={2} value={editType.avertissement || ""}
                  onChange={(e) => setEditType({ ...editType, avertissement: e.target.value })} />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setEditType(null)}>Annuler</button>
              <button type="button" className="btn-primary" onClick={saveType}
                disabled={!editType.libelle?.trim()}>Enregistrer</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal édition modèle */}
      {editModele && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold">
              {editModele.id ? `Modifier ${editModele.code}` : "Nouveau modèle"}
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {!editModele.id && (
                <div>
                  <label className={labelCls}>Code *</label>
                  <input className={inputCls} value={editModele.code}
                    onChange={(e) => setEditModele({ ...editModele, code: e.target.value })}
                    placeholder="TPL_…" />
                </div>
              )}
              <div>
                <label className={labelCls}>Titre *</label>
                <input className={inputCls} value={editModele.titre}
                  onChange={(e) => setEditModele({ ...editModele, titre: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>Type de transaction</label>
                <select className={inputCls} value={editModele.typeId || ""}
                  onChange={(e) => setEditModele({ ...editModele, typeId: e.target.value })}>
                  <option value="">Transversal</option>
                  {types.map((t) => <option key={t.id} value={t.id}>{t.code} — {t.libelle}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Validation minimale</label>
                <select className={inputCls} value={editModele.validationMinimale || ""}
                  onChange={(e) => setEditModele({ ...editModele, validationMinimale: e.target.value })}>
                  <option value="">Juriste</option>
                  <option value="AVOCAT">Avocat</option>
                  <option value="ASSISTANT">Assistant</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>
                  Contenu — variables {"{{cle|Libellé}}"} ou [Libellé]. La clause « INTERVENTION DU
                  CABINET » est obligatoire dans les contrats.
                </label>
                <textarea className={`${inputCls} font-mono text-xs`} rows={14} value={editModele.contenu}
                  onChange={(e) => setEditModele({ ...editModele, contenu: e.target.value })} />
                {editModele.contenu && !editModele.contenu.includes("INTERVENTION DU CABINET") && (
                  <p className="mt-1 text-xs text-amber-700">
                    ⚠️ La clause « INTERVENTION DU CABINET » est absente de ce modèle.
                  </p>
                )}
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={editModele.actif !== false}
                  onChange={(e) => setEditModele({ ...editModele, actif: e.target.checked })} />
                Actif
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setEditModele(null)}>Annuler</button>
              <button type="button" className="btn-primary" onClick={saveModele}
                disabled={!editModele.titre?.trim() || !editModele.contenu?.trim()}>Enregistrer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
