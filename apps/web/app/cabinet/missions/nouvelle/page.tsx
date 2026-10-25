"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { ParametreSelect } from "@/components/parametre-select";

function NewMissionForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dossierIdParam = searchParams.get("dossierId") || "";
  const [dossierInfo, setDossierInfo] = useState<{
    referenceInterne: string;
    client?: { raisonSociale: string } | null;
  } | null>(null);
  const [huissiers, setHuissiers] = useState<{ id: string; prenom: string; nom: string }[]>([]);
  const [dossiers, setDossiers] = useState<
    { id: string; referenceInterne: string; client?: { raisonSociale: string } | null }[]
  >([]);
  const [form, setForm] = useState({
    dossierId: dossierIdParam,
    typeActe: "signification",
    huissierId: "",
    adresseSignification: "",
    destinataire: "",
    datePrevue: "",
    fraisDeplacement: "",
    debours: "",
  });

  // La mission est liée au dossier d'origine : on récupère sa référence pour l'afficher.
  useEffect(() => {
    if (!dossierIdParam) return;
    fetch(`/api/dossiers/${dossierIdParam}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setDossierInfo(data);
      })
      .catch(() => {});
  }, [dossierIdParam]);

  useEffect(() => {
    fetch("/api/huissiers")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setHuissiers(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/dossiers")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setDossiers(data))
      .catch(() => {});
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/missions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        datePrevue: form.datePrevue ? new Date(form.datePrevue).toISOString() : null,
        fraisDeplacement: form.fraisDeplacement ? parseInt(form.fraisDeplacement) : null,
        debours: form.debours ? parseInt(form.debours) : null,
      }),
    });
    if (res.ok) {
      router.push(dossierIdParam ? `/cabinet/dossiers/${dossierIdParam}` : "/cabinet/missions");
    } else {
      const data = await res.json().catch(() => ({}));
      const msg = typeof data.error === "string" ? data.error : "Erreur lors de la création de la mission";
      alert(msg);
    }
  }

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-6 text-2xl font-bold">Nouvelle mission d'huissier</h1>
      <form onSubmit={onSubmit} className="card space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Dossier</label>
          {dossierIdParam ? (
            <div className="input flex items-center justify-between bg-gray-50">
              <span>
                {dossierInfo
                  ? `${dossierInfo.referenceInterne}${dossierInfo.client ? ` — ${dossierInfo.client.raisonSociale}` : ""}`
                  : "Chargement…"}
              </span>
              <Link
                href={`/cabinet/dossiers/${dossierIdParam}`}
                className="text-xs text-cabinet-700 hover:underline"
              >
                Voir le dossier
              </Link>
            </div>
          ) : (
            <select
              value={form.dossierId}
              onChange={(e) => setForm({ ...form, dossierId: e.target.value })}
              className="input"
              required
            >
              <option value="">
                {dossiers.length === 0 ? "Chargement…" : "Sélectionner un dossier"}
              </option>
              {dossiers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.referenceInterne}
                  {d.client ? ` — ${d.client.raisonSociale}` : ""}
                </option>
              ))}
            </select>
          )}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Type d'acte</label>
          <ParametreSelect
            categorie="type_acte_huissier"
            value={form.typeActe}
            onChange={(value) => setForm({ ...form, typeActe: value })}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Huissier</label>
          <select
            value={form.huissierId}
            onChange={(e) => setForm({ ...form, huissierId: e.target.value })}
            className="input"
            required
          >
            <option value="">
              {huissiers.length === 0 ? "Chargement…" : "Sélectionner un huissier"}
            </option>
            {huissiers.map((h) => (
              <option key={h.id} value={h.id}>
                {h.id} — {h.prenom} {h.nom}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Adresse de signification</label>
          <textarea
            value={form.adresseSignification}
            onChange={(e) => setForm({ ...form, adresseSignification: e.target.value })}
            className="input"
            rows={2}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Destinataire</label>
          <input
            value={form.destinataire}
            onChange={(e) => setForm({ ...form, destinataire: e.target.value })}
            className="input"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Date prévue</label>
          <input
            type="datetime-local"
            value={form.datePrevue}
            onChange={(e) => setForm({ ...form, datePrevue: e.target.value })}
            className="input"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Frais déplacement</label>
            <input
              type="number"
              value={form.fraisDeplacement}
              onChange={(e) => setForm({ ...form, fraisDeplacement: e.target.value })}
              className="input"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Débours</label>
            <input
              type="number"
              value={form.debours}
              onChange={(e) => setForm({ ...form, debours: e.target.value })}
              className="input"
            />
          </div>
        </div>
        <button type="submit" className="btn-primary w-full">
          Créer la mission
        </button>
      </form>
    </div>
  );
}

export default function NewMissionPage() {
  return (
    <Suspense fallback={null}>
      <NewMissionForm />
    </Suspense>
  );
}
