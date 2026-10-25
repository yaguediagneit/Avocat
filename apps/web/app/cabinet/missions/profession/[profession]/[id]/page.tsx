"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";

const PROFESSIONS: Record<string, { label: string; intervenantLabel: string; idField: string }> = {
  architecte: { label: "Mission d'architecte", intervenantLabel: "Architecte", idField: "architecteId" },
  "conseiller-juridique": { label: "Mission de conseiller juridique", intervenantLabel: "Conseiller juridique", idField: "conseillerJuridiqueId" },
  clerc: { label: "Mission de clerc", intervenantLabel: "Clerc", idField: "clercId" },
};

const STATUTS = ["En préparation", "Tentée", "Remise", "Annulée", "Échouée"] as const;

const STATUT_BADGES: Record<string, string> = {
  "En préparation": "bg-gray-100 text-gray-700",
  "Tentée": "bg-amber-100 text-amber-700",
  "Remise": "bg-emerald-100 text-emerald-700",
  "Annulée": "bg-red-100 text-red-700",
  "Échouée": "bg-red-100 text-red-700",
};

function toDatetimeLocal(date: string | null): string {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 16);
}

interface DossierInfo {
  referenceInterne: string;
  client?: { raisonSociale: string } | null;
}

interface User {
  id: string;
  prenom: string;
  nom: string;
}

export default function MissionProfessionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const professionKey = typeof params.profession === "string" ? params.profession : "";
  const id = typeof params.id === "string" ? params.id : "";
  const profession = PROFESSIONS[professionKey];

  const [mission, setMission] = useState<any>(null);
  const [dossierInfo, setDossierInfo] = useState<DossierInfo | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    statut: "",
    resultat: "",
    dateTentative: "",
    dateRemise: "",
  });

  useEffect(() => {
    if (!profession || !id) return;

    fetch(`/api/missions/profession/${professionKey}/${id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setMission(data);
          setForm({
            statut: data.statut,
            resultat: data.resultat || "",
            dateTentative: toDatetimeLocal(data.dateTentative),
            dateRemise: toDatetimeLocal(data.dateRemise),
          });
        } else {
          setError("Mission non trouvée");
        }
      })
      .catch(() => setError("Erreur de chargement"))
      .finally(() => setLoading(false));

    fetch("/api/huissiers")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setUsers(data))
      .catch(() => {});
  }, [profession, professionKey, id]);

  useEffect(() => {
    if (mission?.dossierId) {
      fetch(`/api/dossiers/${mission.dossierId}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data) setDossierInfo(data);
        })
        .catch(() => {});
    }
  }, [mission?.dossierId]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!profession) return;
    setSaving(true);
    setError("");

    const body: Record<string, unknown> = {
      statut: form.statut,
      resultat: form.resultat,
      dateTentative: form.dateTentative ? new Date(form.dateTentative).toISOString() : null,
      dateRemise: form.dateRemise ? new Date(form.dateRemise).toISOString() : null,
    };

    try {
      const res = await fetch(`/api/missions/profession/${professionKey}/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(typeof data.error === "string" ? data.error : "Erreur lors de la mise à jour");
        setSaving(false);
        return;
      }

      const updated = await res.json();
      setMission(updated);
    } catch (err) {
      setError("Erreur réseau");
    } finally {
      setSaving(false);
    }
  }

  if (!profession) {
    return <div className="text-sm text-red-600">Profession inconnue</div>;
  }

  if (loading) {
    return <p className="text-sm text-gray-500">Chargement…</p>;
  }

  if (!mission) {
    return <p className="text-sm text-red-600">{error || "Mission introuvable"}</p>;
  }

  const intervenant = users.find((u) => u.id === mission[profession.idField]);
  const intervenantName = intervenant ? `${intervenant.prenom} ${intervenant.nom}` : mission[profession.idField];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{profession.label}</h1>
          <p className="text-sm text-gray-600">
            {new Date(mission.createdAt).toLocaleDateString("fr-FR")}
          </p>
        </div>
        <Link href={`/cabinet/missions/profession/${professionKey}`} className="text-sm text-cabinet-700 hover:underline">
          ← Retour aux missions
        </Link>
      </div>

      <div className="card grid gap-4 text-sm">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <span className="text-gray-500">Dossier</span>
            <p>
              <Link href={`/cabinet/dossiers/${mission.dossierId}`} className="text-cabinet-700 hover:underline">
                {dossierInfo
                  ? `${dossierInfo.referenceInterne}${dossierInfo.client ? ` — ${dossierInfo.client.raisonSociale}` : ""}`
                  : mission.dossierId}
              </Link>
            </p>
          </div>
          <div>
            <span className="text-gray-500">Type d&apos;intervention</span>
            <p>{mission.typeActe}</p>
          </div>
          <div>
            <span className="text-gray-500">{profession.intervenantLabel}</span>
            <p>{intervenantName}</p>
          </div>
          <div>
            <span className="text-gray-500">Destinataire</span>
            <p>{mission.destinataire || "—"}</p>
          </div>
          <div className="md:col-span-2">
            <span className="text-gray-500">Adresse</span>
            <p className="whitespace-pre-line">{mission.adresseSignification || "—"}</p>
          </div>
          <div>
            <span className="text-gray-500">Date prévue</span>
            <p>{mission.datePrevue ? new Date(mission.datePrevue).toLocaleString("fr-FR") : "—"}</p>
          </div>
          <div>
            <span className="text-gray-500">Date de tentative</span>
            <p>{mission.dateTentative ? new Date(mission.dateTentative).toLocaleString("fr-FR") : "—"}</p>
          </div>
          <div>
            <span className="text-gray-500">Date de remise</span>
            <p>{mission.dateRemise ? new Date(mission.dateRemise).toLocaleString("fr-FR") : "—"}</p>
          </div>
          <div>
            <span className="text-gray-500">Frais de déplacement</span>
            <p>{mission.fraisDeplacement?.toLocaleString("fr-FR") || "—"} FCFA</p>
          </div>
          <div>
            <span className="text-gray-500">Débours</span>
            <p>{mission.debours?.toLocaleString("fr-FR") || "—"} FCFA</p>
          </div>
          <div className="md:col-span-2">
            <span className="text-gray-500">Résultat</span>
            <p className="whitespace-pre-line">{mission.resultat || "—"}</p>
          </div>
          <div className="md:col-span-2">
            <span className="text-gray-500">Statut</span>
            <p>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  STATUT_BADGES[mission.statut] || "bg-gray-100 text-gray-700"
                }`}
              >
                {mission.statut}
              </span>
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={onSubmit} className="card space-y-4">
        {error && <div className="rounded-md bg-red-100 p-3 text-sm text-red-700">{error}</div>}

        <h2 className="font-semibold">Mise à jour de la mission</h2>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">Statut</label>
            <select
              value={form.statut}
              onChange={(e) => setForm({ ...form, statut: e.target.value })}
              className="input w-full"
            >
              {STATUTS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">Date de tentative</label>
            <input
              type="datetime-local"
              value={form.dateTentative}
              onChange={(e) => setForm({ ...form, dateTentative: e.target.value })}
              className="input w-full"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Date de remise</label>
            <input
              type="datetime-local"
              value={form.dateRemise}
              onChange={(e) => setForm({ ...form, dateRemise: e.target.value })}
              className="input w-full"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Résultat / commentaire</label>
          <textarea
            value={form.resultat}
            onChange={(e) => setForm({ ...form, resultat: e.target.value })}
            rows={3}
            className="input w-full"
            placeholder="Décrivez le résultat de l'intervention..."
          />
        </div>

        <div className="flex justify-end">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? "Enregistrement..." : "Enregistrer"}
          </button>
        </div>
      </form>
    </div>
  );
}
