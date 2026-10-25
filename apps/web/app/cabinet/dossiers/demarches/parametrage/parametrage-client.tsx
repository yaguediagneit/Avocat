"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  DEMARCHE_FAMILLES,
  PIECE_CATEGORIES,
  PIECE_NIVEAUX,
  PIECE_SOURCES,
  AUTORITE_TYPES,
} from "@/lib/demarches";
import { extractTemplateVariables } from "@/lib/document-template";

const inputCls = "input";
const labelCls = "mb-1 block text-xs font-medium text-gray-600";

const FAMILLE_LABELS = Object.fromEntries(DEMARCHE_FAMILLES.map((f) => [f.code, f.label]));
const CATEGORIE_LABELS = Object.fromEntries(PIECE_CATEGORIES.map((c) => [c.code, c.label]));
const NIVEAU_LABELS = Object.fromEntries(PIECE_NIVEAUX.map((n) => [n.code, n.label]));
const SOURCE_LABELS = Object.fromEntries(PIECE_SOURCES.map((s) => [s.code, s.label]));
const AUTORITE_TYPE_LABELS = Object.fromEntries(AUTORITE_TYPES.map((t) => [t.code, t.label]));

function sousTypesToText(st: any): string {
  return Array.isArray(st)
    ? st.map((s: any) => `${s.code} : ${s.libelle}`).join("\n")
    : "";
}
function textToSousTypes(text: string): { code: string; libelle: string }[] | null {
  const out = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [code, ...rest] = l.split(":");
      return { code: code.trim().replace(/\s+/g, "_").toUpperCase(), libelle: rest.join(":").trim() || code.trim() };
    })
    .filter((s) => s.code && s.libelle);
  return out.length ? out : null;
}

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
  famille: "TRANSVERSAL",
  autoritePrincipale: "",
  natureResultat: "",
  sousTypesText: "",
  qualificationObligatoire: false,
  parcelleRequise: false,
  validationAvocat: false,
  sensible: false,
  nbExemplaires: 2,
  delaiRelanceJours: 15,
  delaiLegalJours: "",
  avertissement: "",
};

export function DemarchesParametrage({
  types: initialTypes,
  autorites: initialAutorites,
  modeles: initialModeles,
}: {
  types: any[];
  autorites: any[];
  modeles: any[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"types" | "autorites" | "modeles">("types");
  const [types, setTypes] = useState(initialTypes);
  const [autorites, setAutorites] = useState(initialAutorites);
  const [modeles, setModeles] = useState(initialModeles);
  const [error, setError] = useState("");
  const [openTypeId, setOpenTypeId] = useState<string | null>(null);

  // Édition type
  const [editType, setEditType] = useState<any | null>(null);
  const [newPiece, setNewPiece] = useState({
    code: "", libelle: "", categorie: "PIECE_CLIENT",
    niveau: "OBLIGATOIRE", condition: "", sourceAttendue: "CLIENT",
  });

  // Édition autorité
  const [editAutorite, setEditAutorite] = useState<any | null>(null);

  // Édition modèle
  const [editModele, setEditModele] = useState<any | null>(null);

  async function saveType() {
    if (!editType) return;
    setError("");
    try {
      const payload = {
        libelle: editType.libelle,
        famille: editType.famille,
        autoritePrincipale: editType.autoritePrincipale || null,
        natureResultat: editType.natureResultat || null,
        sousTypes: textToSousTypes(editType.sousTypesText || ""),
        qualificationObligatoire: !!editType.qualificationObligatoire,
        parcelleRequise: !!editType.parcelleRequise,
        validationAvocat: !!editType.validationAvocat,
        sensible: !!editType.sensible,
        nbExemplaires: Number(editType.nbExemplaires) || 2,
        delaiRelanceJours: Number(editType.delaiRelanceJours) || 15,
        delaiLegalJours: editType.delaiLegalJours ? Number(editType.delaiLegalJours) : null,
        avertissement: editType.avertissement || null,
        actif: editType.actif !== false,
      };
      if (editType.id) {
        const updated = await call(`/api/demarches/types/${editType.id}`, "PATCH", payload);
        setTypes(types.map((t) => (t.id === updated.id ? { ...t, ...updated } : t)));
      } else {
        if (!editType.code.trim()) { setError("Code obligatoire."); return; }
        const created = await call("/api/demarches/types", "POST", { ...payload, code: editType.code.trim() });
        setTypes([...types, created]);
      }
      setEditType(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    }
  }

  async function addPiece(typeId: string) {
    if (!newPiece.code.trim() || !newPiece.libelle.trim()) return;
    try {
      const piece = await call(`/api/demarches/types/${typeId}`, "POST", {
        ...newPiece,
        ordre: (types.find((t) => t.id === typeId)?.pieces?.length || 0) + 1,
      });
      setTypes(types.map((t) => (t.id === typeId ? { ...t, pieces: [...t.pieces, piece] } : t)));
      setNewPiece({ code: "", libelle: "", categorie: "PIECE_CLIENT", niveau: "OBLIGATOIRE", condition: "", sourceAttendue: "CLIENT" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    }
  }

  async function patchPiece(typeId: string, piece: any, patch: any) {
    try {
      const updated = await call(`/api/demarches/types/${typeId}/pieces/${piece.id}`, "PATCH", patch);
      setTypes(types.map((t) =>
        t.id === typeId ? { ...t, pieces: t.pieces.map((p: any) => (p.id === piece.id ? updated : p)) } : t
      ));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    }
  }

  async function saveAutorite() {
    if (!editAutorite) return;
    try {
      const payload = {
        nom: editAutorite.nom,
        typeAutorite: editAutorite.typeAutorite,
        commune: editAutorite.commune || null,
        departement: editAutorite.departement || null,
        region: editAutorite.region || null,
        adresse: editAutorite.adresse || null,
        contact: editAutorite.contact || null,
        actif: editAutorite.actif !== false,
      };
      if (editAutorite.id) {
        const updated = await call(`/api/demarches/autorites/${editAutorite.id}`, "PATCH", payload);
        setAutorites(autorites.map((a) => (a.id === updated.id ? updated : a)));
      } else {
        const created = await call("/api/demarches/autorites", "POST", payload);
        setAutorites([...autorites, created]);
      }
      setEditAutorite(null);
      router.refresh();
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
        contenu: editModele.contenu,
        ordre: Number(editModele.ordre) || 0,
        actif: editModele.actif !== false,
      };
      if (editModele.id) {
        const updated = await call(`/api/demarches/modeles/${editModele.id}`, "PATCH", payload);
        setModeles(modeles.map((m) => (m.id === updated.id ? { ...m, ...updated } : m)));
      } else {
        if (!editModele.code?.trim()) { setError("Code obligatoire (TPL_*)."); return; }
        const created = await call("/api/demarches/modeles", "POST", { ...payload, code: editModele.code.trim() });
        setModeles([...modeles, { ...created, type: types.find((t) => t.id === created.typeId) || null }]);
      }
      setEditModele(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    }
  }

  const TABS = [
    { key: "types", label: `Types de démarches (${types.length})` },
    { key: "autorites", label: `Autorités (${autorites.length})` },
    { key: "modeles", label: `Modèles de documents (${modeles.length})` },
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

      {/* ---------- Onglet Types ---------- */}
      {tab === "types" && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button type="button" className="btn-primary" onClick={() => setEditType({ ...EMPTY_TYPE, sousTypesText: "" })}>
              + Nouveau type
            </button>
          </div>
          {types.map((t) => (
            <div key={t.id} className={`card ${t.actif === false ? "opacity-60" : ""}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-cabinet-100 px-2 py-0.5 font-mono text-xs text-cabinet-800">{t.code}</span>
                    <span className="font-semibold">{t.libelle}</span>
                    <span className="text-xs text-gray-400">{FAMILLE_LABELS[t.famille] || t.famille}</span>
                    {t.actif === false && <span className="rounded bg-gray-200 px-2 py-0.5 text-xs">Inactif</span>}
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    {t.autoritePrincipale} · {t.natureResultat || "résultat non précisé"} ·{" "}
                    {t.pieces?.length || 0} pièce(s) · relance {t.delaiRelanceJours} j
                    {t.qualificationObligatoire && " · qualification obligatoire"}
                    {t.parcelleRequise && " · parcelle requise"}
                    {t.validationAvocat && " · validation avocat"}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button type="button" className="btn-secondary px-3 py-1 text-xs"
                    onClick={() => setOpenTypeId(openTypeId === t.id ? null : t.id)}>
                    {openTypeId === t.id ? "Masquer" : "Check-list"}
                  </button>
                  <button type="button" className="btn-secondary px-3 py-1 text-xs"
                    onClick={() => setEditType({ ...t, sousTypesText: sousTypesToText(t.sousTypes) })}>
                    Modifier
                  </button>
                </div>
              </div>

              {openTypeId === t.id && (
                <div className="mt-3 border-t pt-3">
                  <table className="w-full text-left text-xs">
                    <thead className="text-gray-500">
                      <tr>
                        <th className="px-2 py-1">Pièce</th>
                        <th className="px-2 py-1">Catégorie</th>
                        <th className="px-2 py-1">Niveau</th>
                        <th className="px-2 py-1">Source</th>
                        <th className="px-2 py-1">Condition</th>
                        <th className="px-2 py-1">Active</th>
                      </tr>
                    </thead>
                    <tbody>
                      {t.pieces.map((p: any) => (
                        <tr key={p.id} className="border-t">
                          <td className="px-2 py-1">{p.libelle}</td>
                          <td className="px-2 py-1">
                            <select className="rounded border px-1 py-0.5" value={p.categorie}
                              onChange={(e) => patchPiece(t.id, p, { categorie: e.target.value })}>
                              {PIECE_CATEGORIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
                            </select>
                          </td>
                          <td className="px-2 py-1">
                            <select className="rounded border px-1 py-0.5" value={p.niveau}
                              onChange={(e) => patchPiece(t.id, p, { niveau: e.target.value })}>
                              {PIECE_NIVEAUX.map((n) => <option key={n.code} value={n.code}>{n.label}</option>)}
                            </select>
                          </td>
                          <td className="px-2 py-1">
                            <select className="rounded border px-1 py-0.5" value={p.sourceAttendue}
                              onChange={(e) => patchPiece(t.id, p, { sourceAttendue: e.target.value })}>
                              {PIECE_SOURCES.map((s) => <option key={s.code} value={s.code}>{s.label}</option>)}
                            </select>
                          </td>
                          <td className="px-2 py-1">
                            <input className="w-32 rounded border px-1 py-0.5" defaultValue={p.condition || ""}
                              onBlur={(e) => e.target.value !== (p.condition || "") && patchPiece(t.id, p, { condition: e.target.value || null })} />
                          </td>
                          <td className="px-2 py-1">
                            <input type="checkbox" checked={p.actif !== false}
                              onChange={(e) => patchPiece(t.id, p, { actif: e.target.checked })} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="mt-2 grid gap-2 border-t pt-2 sm:grid-cols-6">
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
                    <button type="button" className="btn-secondary px-3 py-1 text-xs" onClick={() => addPiece(t.id)}>
                      + Ajouter
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ---------- Onglet Autorités ---------- */}
      {tab === "autorites" && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button type="button" className="btn-primary"
              onClick={() => setEditAutorite({ nom: "", typeAutorite: "AUTRE", commune: "", departement: "", region: "", adresse: "", contact: "", actif: true })}>
              + Nouvelle autorité
            </button>
          </div>
          <div className="card overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs text-gray-600">
                <tr>
                  <th className="px-3 py-2">Nom</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Commune</th>
                  <th className="px-3 py-2">Région</th>
                  <th className="px-3 py-2">Contact</th>
                  <th className="px-3 py-2">Active</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {autorites.map((a) => (
                  <tr key={a.id} className="border-t">
                    <td className="px-3 py-2 font-medium">{a.nom}</td>
                    <td className="px-3 py-2">{AUTORITE_TYPE_LABELS[a.typeAutorite] || a.typeAutorite}</td>
                    <td className="px-3 py-2">{a.commune || "—"}</td>
                    <td className="px-3 py-2">{a.region || "—"}</td>
                    <td className="px-3 py-2">{a.contact || "—"}</td>
                    <td className="px-3 py-2">{a.actif !== false ? "✓" : "—"}</td>
                    <td className="px-3 py-2">
                      <button type="button" className="btn-secondary px-2 py-0.5 text-xs"
                        onClick={() => setEditAutorite({ ...a })}>
                        Modifier
                      </button>
                    </td>
                  </tr>
                ))}
                {autorites.length === 0 && (
                  <tr><td colSpan={7} className="px-3 py-6 text-center text-gray-400">Aucune autorité référencée.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ---------- Onglet Modèles ---------- */}
      {tab === "modeles" && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button type="button" className="btn-primary"
              onClick={() => setEditModele({ code: "TPL_", titre: "", typeId: "", contenu: "", ordre: 0, actif: true })}>
              + Nouveau modèle
            </button>
          </div>
          {modeles.map((m) => (
            <div key={m.id} className={`card ${m.actif === false ? "opacity-60" : ""}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-gray-100 px-2 py-0.5 font-mono text-xs">{m.code}</span>
                    <span className="font-semibold">{m.titre}</span>
                    {m.type
                      ? <span className="rounded bg-cabinet-100 px-2 py-0.5 text-xs text-cabinet-700">{m.type.code}</span>
                      : <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">Transversal</span>}
                    {m.actif === false && <span className="rounded bg-gray-200 px-2 py-0.5 text-xs">Inactif</span>}
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    {extractTemplateVariables(m.contenu).length} variable(s) détectée(s)
                  </div>
                </div>
                <button type="button" className="btn-secondary px-3 py-1 text-xs"
                  onClick={() => setEditModele({ ...m, typeId: m.typeId || "" })}>
                  Modifier
                </button>
              </div>
            </div>
          ))}
          {modeles.length === 0 && (
            <div className="card text-center text-sm text-gray-400">Aucun modèle. Lancez le seed des modèles TPL_*.</div>
          )}
        </div>
      )}

      {/* ---------- Modal édition type ---------- */}
      {editType && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
          <div className="card mt-8 w-full max-w-2xl space-y-3">
            <h3 className="font-semibold">{editType.id ? `Modifier ${editType.code}` : "Nouveau type de démarche"}</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={labelCls}>Code *</label>
                <input className={inputCls} disabled={!!editType.id} value={editType.code}
                  onChange={(e) => setEditType({ ...editType, code: e.target.value.toUpperCase() })}
                  placeholder="EX_MA_DEMARCHE" />
              </div>
              <div>
                <label className={labelCls}>Famille *</label>
                <select className={inputCls} value={editType.famille}
                  onChange={(e) => setEditType({ ...editType, famille: e.target.value })}>
                  {DEMARCHE_FAMILLES.map((f) => <option key={f.code} value={f.code}>{f.label}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>Libellé *</label>
                <input className={inputCls} value={editType.libelle}
                  onChange={(e) => setEditType({ ...editType, libelle: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>Autorité principale (texte)</label>
                <input className={inputCls} value={editType.autoritePrincipale || ""}
                  onChange={(e) => setEditType({ ...editType, autoritePrincipale: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>Nature du résultat</label>
                <input className={inputCls} value={editType.natureResultat || ""}
                  onChange={(e) => setEditType({ ...editType, natureResultat: e.target.value })}
                  placeholder="Autorisation, attestation, titre foncier…" />
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>Sous-types de qualification (un par ligne : « code : libellé »)</label>
                <textarea className={inputCls} rows={3} value={editType.sousTypesText || ""}
                  onChange={(e) => setEditType({ ...editType, sousTypesText: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>Exemplaires du paquet de dépôt</label>
                <input type="number" min={1} className={inputCls} value={editType.nbExemplaires}
                  onChange={(e) => setEditType({ ...editType, nbExemplaires: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>Relance interne (jours)</label>
                <input type="number" min={1} className={inputCls} value={editType.delaiRelanceJours}
                  onChange={(e) => setEditType({ ...editType, delaiRelanceJours: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>Délai légal (jours)</label>
                <input type="number" className={inputCls} value={editType.delaiLegalJours || ""}
                  onChange={(e) => setEditType({ ...editType, delaiLegalJours: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>Avertissement affiché</label>
                <textarea className={inputCls} rows={2} value={editType.avertissement || ""}
                  onChange={(e) => setEditType({ ...editType, avertissement: e.target.value })} />
              </div>
            </div>
            <div className="flex flex-wrap gap-4 text-sm">
              {([
                ["qualificationObligatoire", "Qualification obligatoire"],
                ["parcelleRequise", "Parcelle requise"],
                ["validationAvocat", "Validation avocat / fiscaliste"],
                ["sensible", "Dossier sensible"],
                ["actif", "Actif"],
              ] as const).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2">
                  <input type="checkbox" checked={editType[key] !== false && !!editType[key] || (key === "actif" && editType.actif !== false)}
                    onChange={(e) => setEditType({ ...editType, [key]: e.target.checked })} />
                  {label}
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-2 border-t pt-3">
              <button type="button" className="btn-secondary" onClick={() => setEditType(null)}>Annuler</button>
              <button type="button" className="btn-primary" onClick={saveType}>Enregistrer</button>
            </div>
          </div>
        </div>
      )}

      {/* ---------- Modal autorité ---------- */}
      {editAutorite && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
          <div className="card mt-8 w-full max-w-lg space-y-3">
            <h3 className="font-semibold">{editAutorite.id ? "Modifier l'autorité" : "Nouvelle autorité"}</h3>
            <div>
              <label className={labelCls}>Nom *</label>
              <input className={inputCls} value={editAutorite.nom}
                onChange={(e) => setEditAutorite({ ...editAutorite, nom: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Type</label>
              <select className={inputCls} value={editAutorite.typeAutorite}
                onChange={(e) => setEditAutorite({ ...editAutorite, typeAutorite: e.target.value })}>
                {AUTORITE_TYPES.map((t) => <option key={t.code} value={t.code}>{t.label}</option>)}
              </select>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><label className={labelCls}>Commune</label>
                <input className={inputCls} value={editAutorite.commune || ""}
                  onChange={(e) => setEditAutorite({ ...editAutorite, commune: e.target.value })} /></div>
              <div><label className={labelCls}>Département</label>
                <input className={inputCls} value={editAutorite.departement || ""}
                  onChange={(e) => setEditAutorite({ ...editAutorite, departement: e.target.value })} /></div>
              <div><label className={labelCls}>Région</label>
                <input className={inputCls} value={editAutorite.region || ""}
                  onChange={(e) => setEditAutorite({ ...editAutorite, region: e.target.value })} /></div>
              <div><label className={labelCls}>Contact</label>
                <input className={inputCls} value={editAutorite.contact || ""}
                  onChange={(e) => setEditAutorite({ ...editAutorite, contact: e.target.value })} /></div>
            </div>
            <div>
              <label className={labelCls}>Adresse de dépôt</label>
              <input className={inputCls} value={editAutorite.adresse || ""}
                onChange={(e) => setEditAutorite({ ...editAutorite, adresse: e.target.value })} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={editAutorite.actif !== false}
                onChange={(e) => setEditAutorite({ ...editAutorite, actif: e.target.checked })} />
              Active
            </label>
            <div className="flex justify-end gap-2 border-t pt-3">
              <button type="button" className="btn-secondary" onClick={() => setEditAutorite(null)}>Annuler</button>
              <button type="button" className="btn-primary" onClick={saveAutorite}>Enregistrer</button>
            </div>
          </div>
        </div>
      )}

      {/* ---------- Modal modèle ---------- */}
      {editModele && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
          <div className="card mt-8 w-full max-w-3xl space-y-3">
            <h3 className="font-semibold">{editModele.id ? "Modifier le modèle" : "Nouveau modèle de document"}</h3>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className={labelCls}>Code *</label>
                <input className={inputCls} disabled={!!editModele.id} value={editModele.code}
                  onChange={(e) => setEditModele({ ...editModele, code: e.target.value.toUpperCase() })} />
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>Titre *</label>
                <input className={inputCls} value={editModele.titre}
                  onChange={(e) => setEditModele({ ...editModele, titre: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>Type de démarche</label>
                <select className={inputCls} value={editModele.typeId || ""}
                  onChange={(e) => setEditModele({ ...editModele, typeId: e.target.value || null })}>
                  <option value="">— Transversal —</option>
                  {types.map((t) => <option key={t.id} value={t.id}>{t.code} — {t.libelle}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Ordre</label>
                <input type="number" className={inputCls} value={editModele.ordre || 0}
                  onChange={(e) => setEditModele({ ...editModele, ordre: e.target.value })} />
              </div>
              <label className="mt-6 flex items-center gap-2 text-sm">
                <input type="checkbox" checked={editModele.actif !== false}
                  onChange={(e) => setEditModele({ ...editModele, actif: e.target.checked })} />
                Actif
              </label>
            </div>
            <div>
              <label className={labelCls}>
                Contenu — variables : {"{{cle|Libellé}}"} ou [Libellé] ; blocs : {"{{#if cle == \"val\"}}…{{/if}}"}
              </label>
              <textarea className={`${inputCls} font-mono text-xs`} rows={14} value={editModele.contenu}
                onChange={(e) => setEditModele({ ...editModele, contenu: e.target.value })} />
              <div className="mt-1 text-xs text-gray-500">
                {extractTemplateVariables(editModele.contenu || "").length} variable(s) détectée(s) :
                {" "}{extractTemplateVariables(editModele.contenu || "").map((v) => v.cle).join(", ")}
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t pt-3">
              <button type="button" className="btn-secondary" onClick={() => setEditModele(null)}>Annuler</button>
              <button type="button" className="btn-primary" onClick={saveModele}>Enregistrer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
