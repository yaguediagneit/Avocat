"use client";

import { useRouter, useSearchParams, useParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";

const PROFESSIONS: Record<string, { label: string; intervenantLabel: string }> = {
  architecte: { label: "Nouvelle mission d'architecte", intervenantLabel: "Architecte" },
  "conseiller-juridique": { label: "Nouvelle mission de conseiller juridique", intervenantLabel: "Conseiller juridique" },
  clerc: { label: "Nouvelle mission de clerc", intervenantLabel: "Clerc" },
};

function NewMissionForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams();
  const professionKey = typeof params.profession === "string" ? params.profession : "";
  const profession = PROFESSIONS[professionKey];
  const dossierIdParam = searchParams.get("dossierId") || "";

  const [dossierInfo, setDossierInfo] = useState<{
    referenceInterne: string;
    client?: { raisonSociale: string } | null;
  } | null>(null);
  const [intervenants, setIntervenants] = useState<{ id: string; prenom: string; nom: string }[]>([]);

  const [form, setForm] = useState({
    dossierId: dossierIdParam,
    typeActe: "",
    intervenantId: "",
    adresseSignification: "",
    destinataire: "",
    datePrevue: "",
    fraisDeplacement: "",
    debours: "",
  });

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
    if (!profession) return;
    fetch(`/api/intervenants?role=${encodeURIComponent(profession.intervenantLabel)}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setIntervenants(data))
      .catch(() => {});
  }, [profession]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch(`/api/missions/profession/${professionKey}`, {
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
      router.push(dossierIdParam ? `/cabinet/dossiers/${dossierIdParam}` : `/cabinet/missions/profession/${professionKey}`);
    } else {
      const data = await res.json().catch(() => ({}));
      const msg = typeof data.error === "string" ? data.error : "Erreur lors de la création de la mission";
      alert(msg);
    }
  }

  if (!profession) {
    return <div className="text-sm text-red-600">Profession inconnue</div>;
  }

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-6 text-2xl font-bold">{profession.label}</h1>
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
            <input
              value={form.dossierId}
              onChange={(e) => setForm({ ...form, dossierId: e.target.value })}
              className="input"
              placeholder="ID du dossier"
              required
            />
          )}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Type d&apos;intervention</label>
          <input
            value={form.typeActe}
            onChange={(e) => setForm({ ...form, typeActe: e.target.value })}
            className="input"
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">{profession.intervenantLabel}</label>
          <select
            value={form.intervenantId}
            onChange={(e) => setForm({ ...form, intervenantId: e.target.value })}
            className="input"
            required
          >
            <option value="">{intervenants.length === 0 ? "Chargement…" : `Sélectionner un ${profession.intervenantLabel.toLowerCase()}`}</option>
            {intervenants.map((i) => (
              <option key={i.id} value={i.id}>
                {i.prenom} {i.nom}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Adresse</label>
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

export default function NewMissionProfessionPage() {
  return (
    <Suspense fallback={null}>
      <NewMissionForm />
    </Suspense>
  );
}
