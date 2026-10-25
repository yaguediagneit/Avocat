"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SearchInput } from "@/components/search-input";
import { PaginatedRows } from "@/components/pagination";

const inputCls = "input";
const labelCls = "mb-1 block text-xs font-medium text-gray-600";

const FIELDS_PHYSIQUE: [string, string][] = [
  ["civilite", "Civilité"],
  ["nom", "Nom *"],
  ["prenoms", "Prénoms"],
  ["dateNaissance", "Date de naissance"],
  ["lieuNaissance", "Lieu de naissance"],
  ["nationalite", "Nationalité"],
  ["profession", "Profession"],
  ["situationMatrimoniale", "Situation matrimoniale"],
  ["pieceIdentiteType", "Type de pièce (CNI / passeport)"],
  ["pieceIdentiteNumero", "N° de pièce"],
  ["pieceIdentiteExpiration", "Expiration de la pièce"],
];

const FIELDS_MORALE: [string, string][] = [
  ["raisonSociale", "Raison sociale *"],
  ["formeJuridique", "Forme juridique"],
  ["ninea", "NINEA"],
  ["rccm", "RCCM"],
  ["siegeSocial", "Siège social"],
  ["representantLegal", "Représentant légal"],
  ["qualiteSignataire", "Qualité du signataire"],
  ["piecePouvoir", "Pièce de pouvoir"],
];

const FIELDS_CONTACT: [string, string][] = [
  ["adresse", "Adresse"],
  ["commune", "Commune"],
  ["departement", "Département"],
  ["region", "Région"],
  ["telephone", "Téléphone"],
  ["whatsapp", "WhatsApp"],
  ["email", "E-mail"],
  ["adresseCorrespondance", "Adresse de correspondance"],
  ["centreFiscal", "Centre des services fiscaux"],
  ["numeroContribuable", "N° contribuable"],
];

const DATE_FIELDS = new Set(["dateNaissance", "pieceIdentiteExpiration"]);

function demandeurLabel(d: any) {
  return d.typePersonne === "MORALE"
    ? d.raisonSociale || d.nom
    : [d.civilite, d.prenoms, d.nom].filter(Boolean).join(" ") || d.nom;
}

export function DemandeursClient({ demandeurs: initial, clients = [], canWrite }: { demandeurs: any[]; clients?: { id: string; raisonSociale: string }[]; canWrite: boolean }) {
  const router = useRouter();
  const [demandeurs, setDemandeurs] = useState(initial);
  const [filtreClient, setFiltreClient] = useState<"tous" | "clients" | "tiers">("tous");
  const [edit, setEdit] = useState<any | null>(null);
  const [mandat, setMandat] = useState<any>({});
  const [error, setError] = useState("");

  const filtered = demandeurs.filter((d) =>
    filtreClient === "tous" ? true : filtreClient === "clients" ? !!d.clientId : !d.clientId
  );

  function openEdit(d?: any) {
    setError("");
    setEdit(d ? { ...d } : { typePersonne: "PHYSIQUE", nom: "" });
    setMandat(d?.mandat || {});
  }

  async function save() {
    if (!edit) return;
    if (!edit.nom?.trim() && edit.typePersonne === "PHYSIQUE") { setError("Nom obligatoire."); return; }
    if (edit.typePersonne === "MORALE" && !edit.raisonSociale?.trim() && !edit.nom?.trim()) {
      setError("Raison sociale obligatoire."); return;
    }
    try {
      const payload: Record<string, unknown> = { ...edit, nom: edit.typePersonne === "MORALE" ? (edit.nom || edit.raisonSociale) : edit.nom };
      if (Object.keys(mandat).length) payload.mandat = mandat;
      const res = await fetch(
        edit.id ? `/api/demarches/demandeurs/${edit.id}` : "/api/demarches/demandeurs",
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
        setDemandeurs(demandeurs.map((d) => (d.id === saved.id ? saved : d)));
      } else {
        setDemandeurs([...demandeurs, saved]);
      }
      setEdit(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    }
  }

  function field(key: string, label: string) {
    const isDate = DATE_FIELDS.has(key);
    const value = isDate && edit?.[key] ? String(edit[key]).slice(0, 10) : edit?.[key] || "";
    return (
      <div key={key}>
        <label className={labelCls}>{label}</label>
        <input
          type={isDate ? "date" : "text"}
          className={inputCls}
          value={value}
          onChange={(e) => setEdit({ ...edit, [key]: e.target.value })}
        />
      </div>
    );
  }

  return (
    <div className="card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <SearchInput placeholder="Filtrer (nom, commune, téléphone, NINEA…)" />
          <div className="flex overflow-hidden rounded-md border border-gray-200 text-xs">
            {(
              [
                ["tous", "Tous"],
                ["clients", "Clients du cabinet"],
                ["tiers", "Tiers"],
              ] as const
            ).map(([k, l]) => (
              <button
                key={k}
                type="button"
                onClick={() => setFiltreClient(k)}
                className={`px-3 py-1.5 ${
                  filtreClient === k ? "bg-cabinet-700 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
        {canWrite && (
          <button type="button" className="btn-primary" onClick={() => openEdit()}>
            + Nouveau demandeur
          </button>
        )}
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs text-gray-600">
            <tr>
              <th className="px-3 py-2">Nom / Raison sociale</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Commune</th>
              <th className="px-3 py-2">Téléphone</th>
              <th className="px-3 py-2">Pièce d'identité / NINEA</th>
              <th className="px-3 py-2">Client du cabinet</th>
              <th className="px-3 py-2">Mandat</th>
              {canWrite && <th className="px-3 py-2" />}
            </tr>
          </thead>
          <tbody>
            <PaginatedRows colSpan={7} pageSize={15}>
              {filtered.map((d) => (
                <tr key={d.id} className="border-t">
                  <td className="px-3 py-2 font-medium">{demandeurLabel(d)}</td>
                  <td className="px-3 py-2 text-xs">{d.typePersonne === "MORALE" ? "Personne morale" : "Personne physique"}</td>
                  <td className="px-3 py-2">{d.commune || "—"}</td>
                  <td className="px-3 py-2">{d.telephone || "—"}</td>
                  <td className="px-3 py-2 text-xs">
                    {d.typePersonne === "MORALE" ? d.ninea || "—" : d.pieceIdentiteNumero || "—"}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {d.client?.raisonSociale || clients.find((c) => c.id === d.clientId)?.raisonSociale || "—"}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {d.mandat?.existe ? (
                      <span className="rounded bg-emerald-100 px-2 py-0.5 text-emerald-700">
                        Oui{d.mandat.date ? ` (${new Date(d.mandat.date).toLocaleDateString("fr-FR")})` : ""}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  {canWrite && (
                    <td className="px-3 py-2">
                      <button type="button" className="btn-secondary px-2 py-0.5 text-xs" onClick={() => openEdit(d)}>
                        Modifier
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="px-3 py-6 text-center text-gray-400">Aucun demandeur.</td></tr>
              )}
            </PaginatedRows>
          </tbody>
        </table>
      </div>

      {edit && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
          <div className="card mt-8 w-full max-w-3xl space-y-4">
            <h3 className="font-semibold">{edit.id ? "Modifier la fiche" : "Nouveau demandeur"}</h3>
            {error && <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={labelCls}>Type de personne</label>
                <select className={inputCls} value={edit.typePersonne}
                  onChange={(e) => setEdit({ ...edit, typePersonne: e.target.value })}>
                  <option value="PHYSIQUE">Personne physique</option>
                  <option value="MORALE">Personne morale</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Client du cabinet lié (optionnel)</label>
                <select className={inputCls} value={edit.clientId || ""}
                  onChange={(e) => setEdit({ ...edit, clientId: e.target.value || null })}>
                  <option value="">— Aucun —</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.raisonSociale}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {(edit.typePersonne === "MORALE" ? FIELDS_MORALE : FIELDS_PHYSIQUE).map(([k, l]) => field(k, l))}
            </div>

            <div className="border-t pt-3">
              <div className="mb-2 text-xs font-semibold text-gray-600">Coordonnées</div>
              <div className="grid gap-3 sm:grid-cols-3">
                {FIELDS_CONTACT.map(([k, l]) => field(k, l))}
              </div>
            </div>

            <div className="border-t pt-3">
              <div className="mb-2 text-xs font-semibold text-gray-600">Mandat / procuration</div>
              <label className="mb-2 flex items-center gap-2 text-sm">
                <input type="checkbox" checked={!!mandat.existe}
                  onChange={(e) => setMandat({ ...mandat, existe: e.target.checked })} />
                Un mandat existe
              </label>
              {mandat.existe && (
                <div className="grid gap-3 sm:grid-cols-3">
                  <div><label className={labelCls}>Date du mandat</label>
                    <input type="date" className={inputCls} value={mandat.date ? String(mandat.date).slice(0, 10) : ""}
                      onChange={(e) => setMandat({ ...mandat, date: e.target.value })} /></div>
                  <div><label className={labelCls}>Étendue</label>
                    <input className={inputCls} value={mandat.etendue || ""}
                      onChange={(e) => setMandat({ ...mandat, etendue: e.target.value })} /></div>
                  <div><label className={labelCls}>Signataire</label>
                    <input className={inputCls} value={mandat.signataire || ""}
                      onChange={(e) => setMandat({ ...mandat, signataire: e.target.value })} /></div>
                  <div><label className={labelCls}>Expiration</label>
                    <input type="date" className={inputCls} value={mandat.expiration ? String(mandat.expiration).slice(0, 10) : ""}
                      onChange={(e) => setMandat({ ...mandat, expiration: e.target.value })} /></div>
                  <div className="flex items-end">
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={!!mandat.originalDetenu}
                        onChange={(e) => setMandat({ ...mandat, originalDetenu: e.target.checked })} />
                      Original détenu
                    </label>
                  </div>
                </div>
              )}
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
