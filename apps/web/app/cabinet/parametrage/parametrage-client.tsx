"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { PaginatedRows } from "@/components/pagination";
import { useTableSort } from "@/components/table-sort";

interface Parametre {
  id: string;
  categorie: string;
  code: string;
  libelle: string;
  ordre: number;
  actif: boolean;
}

interface ParametrageClientProps {
  parametres: Parametre[];
}

type FormMode = "create" | "edit";

export function ParametrageClient({ parametres }: ParametrageClientProps) {
  const router = useRouter();
  const { th: sortTh, sorted: sortRows } = useTableSort();

  const grouped = useMemo(() => {
    const map: Record<string, Parametre[]> = {};
    for (const p of parametres) {
      if (!map[p.categorie]) map[p.categorie] = [];
      map[p.categorie].push(p);
    }
    for (const cat of Object.keys(map)) {
      map[cat].sort((a, b) => a.ordre - b.ordre || a.libelle.localeCompare(b.libelle));
    }
    return map;
  }, [parametres]);

  const categories = useMemo(() => Object.keys(grouped).sort((a, b) => a.localeCompare(b)), [grouped]);

  const emptyForm = {
    id: "",
    categorie: "",
    code: "",
    libelle: "",
    ordre: 0,
    actif: true,
  };

  const [form, setForm] = useState(emptyForm);
  const [mode, setMode] = useState<FormMode>("create");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  function openCreate(categorie = "") {
    setForm({ ...emptyForm, categorie });
    setMode("create");
    setError("");
    setIsOpen(true);
  }

  function openEdit(p: Parametre) {
    setForm({
      id: p.id,
      categorie: p.categorie,
      code: p.code,
      libelle: p.libelle,
      ordre: p.ordre,
      actif: p.actif,
    });
    setMode("edit");
    setError("");
    setIsOpen(true);
  }

  function closeModal() {
    setForm(emptyForm);
    setMode("create");
    setError("");
    setIsOpen(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const categorie = form.categorie.trim();
    if (!categorie) {
      setError("La catégorie est obligatoire.");
      setLoading(false);
      return;
    }

    const body = {
      categorie,
      code: form.code.trim(),
      libelle: form.libelle.trim(),
      ordre: Number(form.ordre) || 0,
      actif: form.actif,
    };

    const url = mode === "edit" ? `/api/parametres/${form.id}` : "/api/parametres";
    const method = mode === "edit" ? "PATCH" : "POST";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const message =
          data?.error?.formErrors?.[0] ||
          (typeof data.error === "string" ? data.error : "Erreur lors de l'enregistrement.");
        setError(message);
        setLoading(false);
        return;
      }

      closeModal();
      router.refresh();
    } catch (err) {
      console.error(err);
      setError("Erreur réseau.");
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleActif(p: Parametre) {
    const res = await fetch(`/api/parametres/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actif: !p.actif }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || "Erreur lors du changement d'état.");
      return;
    }

    if (form.id === p.id) closeModal();
    router.refresh();
  }

  const contractEmployer = parametres.filter((p) => p.categorie === "contrat_obligation_employer").sort((a, b) => a.ordre - b.ordre);
  const contractEmployee = parametres.filter((p) => p.categorie === "contrat_obligation_employee").sort((a, b) => a.ordre - b.ordre);

  async function addObligation(categorie: string, libelle: string) {
    if (!libelle.trim()) return;
    setLoading(true);
    const body = { categorie, code: `obligation_${Date.now()}`, libelle: libelle.trim(), ordre: 0, actif: true };
    const res = await fetch("/api/parametres", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error?.formErrors?.[0] || "Erreur");
    }
    router.refresh();
    setLoading(false);
  }

  return (
    <div className="space-y-6">
      <section className="card p-0">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <h3 className="font-semibold text-cabinet-900">Contrats — Article 6 : Obligations des parties</h3>
        </div>
        <div className="grid gap-0 md:grid-cols-2">
          <div className="border-r border-gray-100 p-4">
            <div className="mb-2 flex items-center justify-between">
              <h4 className="font-medium text-cabinet-700">Obligations de l&apos;employeur</h4>
              <button
                type="button"
                onClick={() => {
                  const libelle = window.prompt("Nouvelle obligation de l'employeur");
                  if (libelle) addObligation("contrat_obligation_employer", libelle);
                }}
                className="text-sm font-medium text-cabinet-700 hover:underline"
              >
                + Ajouter
              </button>
            </div>
            <table className="w-full text-left text-sm">
              <tbody>
                {contractEmployer.length === 0 && (
                  <tr><td className="py-2 text-gray-500">Aucune obligation.</td></tr>
                )}
                <PaginatedRows colSpan={2}>
                {contractEmployer.map((p) => (
                  <tr key={p.id} className="border-b hover:bg-gray-50">
                    <td className="py-2">{p.libelle}</td>
                    <td className="py-2 text-right">
                      <button onClick={() => openEdit(p)} title="Modifier" className="mr-2 text-cabinet-700 hover:underline">✎</button>
                      <button onClick={() => handleToggleActif(p)} title={p.actif ? "Désactiver" : "Activer"} className={`hover:underline ${p.actif ? "text-red-700" : "text-emerald-700"}`}>⏻</button>
                    </td>
                  </tr>
                ))}
                </PaginatedRows>
              </tbody>
            </table>
          </div>
          <div className="p-4">
            <div className="mb-2 flex items-center justify-between">
              <h4 className="font-medium text-cabinet-700">Obligations du salarié</h4>
              <button
                type="button"
                onClick={() => {
                  const libelle = window.prompt("Nouvelle obligation du salarié");
                  if (libelle) addObligation("contrat_obligation_employee", libelle);
                }}
                className="text-sm font-medium text-cabinet-700 hover:underline"
              >
                + Ajouter
              </button>
            </div>
            <table className="w-full text-left text-sm">
              <tbody>
                {contractEmployee.length === 0 && (
                  <tr><td className="py-2 text-gray-500">Aucune obligation.</td></tr>
                )}
                <PaginatedRows colSpan={2}>
                {contractEmployee.map((p) => (
                  <tr key={p.id} className="border-b hover:bg-gray-50">
                    <td className="py-2">{p.libelle}</td>
                    <td className="py-2 text-right">
                      <button onClick={() => openEdit(p)} title="Modifier" className="mr-2 text-cabinet-700 hover:underline">✎</button>
                      <button onClick={() => handleToggleActif(p)} title={p.actif ? "Désactiver" : "Activer"} className={`hover:underline ${p.actif ? "text-red-700" : "text-emerald-700"}`}>⏻</button>
                    </td>
                  </tr>
                ))}
                </PaginatedRows>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {categories.length === 0 && (
        <div className="card text-center">
          <p className="text-sm text-gray-500">Aucune liste déroulante configurée.</p>
          <button type="button" onClick={() => openCreate()} className="btn-primary mt-4">
            + Nouvelle catégorie
          </button>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {categories.map((categorie) => (
          <section key={categorie} className="card p-0">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
              <h3 className="font-semibold text-cabinet-900">{categorie}</h3>
              <button
                type="button"
                onClick={() => openCreate(categorie)}
                className="text-sm font-medium text-cabinet-700 hover:underline"
              >
                + Ajouter
              </button>
            </div>
            <table className="w-full text-left text-sm">
              <thead className="bg-cabinet-50 text-cabinet-900">
                <tr>
                  {sortTh(categorie, "code", "Code", "px-4 py-2")}
                  {sortTh(categorie, "libelle", "Libellé", "px-4 py-2")}
                  {sortTh(categorie, "ordre", "Ordre", "px-4 py-2")}
                  {sortTh(categorie, "actif", "Actif", "px-4 py-2")}
                  <th className="px-4 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                <PaginatedRows colSpan={5}>
                {sortRows(categorie, grouped[categorie], {
                  code: (p) => p.code,
                  libelle: (p) => p.libelle,
                  ordre: (p) => p.ordre,
                  actif: (p) => (p.actif ? "Oui" : "Non"),
                }).map((p) => (
                  <tr key={p.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-2 font-mono text-xs">{p.code}</td>
                    <td className="px-4 py-2">{p.libelle}</td>
                    <td className="px-4 py-2">{p.ordre}</td>
                    <td className="px-4 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          p.actif ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {p.actif ? "Oui" : "Non"}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => openEdit(p)}
                        className="mr-2 text-sm text-cabinet-700 hover:underline"
                      >
                        Modifier
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleActif(p)}
                        className={`text-sm hover:underline ${p.actif ? "text-red-700" : "text-emerald-700"}`}
                      >
                        {p.actif ? "Désactiver" : "Activer"}
                      </button>
                    </td>
                  </tr>
                ))}
                </PaginatedRows>
              </tbody>
            </table>
          </section>
        ))}
      </div>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-cabinet-950/60 p-4 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div className="card w-full max-w-lg">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {mode === "edit" ? "Modifier une valeur" : "Ajouter une valeur"}
              </h2>
              <button
                type="button"
                onClick={closeModal}
                className="text-2xl leading-none text-gray-500 hover:text-gray-800"
                aria-label="Fermer"
              >
                ×
              </button>
            </div>

            {error && (
              <div className="mb-4 rounded-md bg-red-100 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm font-medium">Catégorie</label>
                  <input
                    type="text"
                    list="categories-list"
                    value={form.categorie}
                    onChange={(e) => setForm({ ...form, categorie: e.target.value })}
                    className="input"
                    placeholder="Ex. type_affaire, statut_dossier..."
                    required
                  />
                  <datalist id="categories-list">
                    {categories.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                  <p className="mt-1 text-xs text-gray-500">
                    Saisis une catégorie existante ou crées-en une nouvelle.
                  </p>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">Code</label>
                  <input
                    type="text"
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    className="input"
                    placeholder="Valeur stockée"
                    required
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm font-medium">Libellé</label>
                  <textarea
                    value={form.libelle}
                    onChange={(e) => setForm({ ...form, libelle: e.target.value })}
                    className="input w-full"
                    rows={4}
                    placeholder="Texte affiché"
                    required
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">Ordre</label>
                  <input
                    type="number"
                    value={form.ordre}
                    onChange={(e) => setForm({ ...form, ordre: parseInt(e.target.value || "0", 10) })}
                    className="input"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="actif"
                    checked={form.actif}
                    onChange={(e) => setForm({ ...form, actif: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300 text-cabinet-700 focus:ring-cabinet-500"
                  />
                  <label htmlFor="actif" className="text-sm font-medium">
                    Actif
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button type="button" onClick={closeModal} className="btn-secondary">
                  Annuler
                </button>
                <button type="submit" disabled={loading} className="btn-primary">
                  {loading ? "Enregistrement..." : mode === "edit" ? "Mettre à jour" : "Ajouter"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
