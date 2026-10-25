import { prisma } from "@/lib/prisma";
import { serverCanAccessDossier, getServerAuth } from "@/lib/server-auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import { MissionUpdateForm } from "./mission-update-form";

const TYPE_LABELS: Record<string, string> = {
  signification: "Signification",
  sommation: "Sommation",
  mise_en_demeure: "Mise en demeure",
  constat: "Constat",
  saisie: "Saisie",
  convocation: "Convocation",
};

const TYPE_BADGES: Record<string, string> = {
  signification: "bg-cabinet-100 text-cabinet-800",
  sommation: "bg-amber-100 text-amber-700",
  mise_en_demeure: "bg-red-100 text-red-700",
  constat: "bg-blue-100 text-blue-700",
  saisie: "bg-purple-100 text-purple-700",
  convocation: "bg-emerald-100 text-emerald-700",
};

const STATUT_BADGES: Record<string, string> = {
  "En préparation": "bg-gray-100 text-gray-700",
  "Tentée": "bg-amber-100 text-amber-700",
  "Remise": "bg-emerald-100 text-emerald-700",
  "Annulée": "bg-red-100 text-red-700",
  "Échouée": "bg-red-100 text-red-700",
};

export default async function MissionDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const mission = await prisma.missionHuissier.findUnique({
    where: { id: params.id },
    include: { dossier: { select: { referenceInterne: true } } },
  });

  if (!mission) {
    notFound();
  }

  // Isolation : vérifie l'accès au dossier lié à la mission.
  const canAccess = await serverCanAccessDossier(mission.dossierId, "read");
  if (!canAccess) {
    notFound();
  }

  const auth = await getServerAuth();
  const canEdit =
    auth.estAdmin ||
    auth.userId === mission.huissierId ||
    (await serverCanAccessDossier(mission.dossierId, "write"));

  const huissier = mission.huissierId
    ? await prisma.user.findUnique({
        where: { id: mission.huissierId },
        select: { prenom: true, nom: true },
      })
    : null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Mission d&apos;huissier</h1>
          <p className="text-sm text-gray-600">
            {TYPE_LABELS[mission.typeActe] || mission.typeActe} ·{" "}
            {new Date(mission.createdAt).toLocaleDateString("fr-FR")}
          </p>
        </div>
        <Link href="/cabinet/missions" className="text-sm text-cabinet-700 hover:underline">
          ← Retour aux missions
        </Link>
      </div>

      <div className="card grid gap-4 text-sm">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <span className="text-gray-500">Dossier</span>
            <p>
              <Link href={`/cabinet/dossiers/${mission.dossierId}`} className="text-cabinet-700 hover:underline">
                {mission.dossier.referenceInterne}
              </Link>
            </p>
          </div>
          <div>
            <span className="text-gray-500">Type d&apos;acte</span>
            <p>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  TYPE_BADGES[mission.typeActe] || "bg-gray-100 text-gray-700"
                }`}
              >
                {TYPE_LABELS[mission.typeActe] || mission.typeActe}
              </span>
            </p>
          </div>
          <div>
            <span className="text-gray-500">Huissier</span>
            <p>{huissier ? `${huissier.prenom} ${huissier.nom}` : mission.huissierId || "—"}</p>
          </div>
          <div>
            <span className="text-gray-500">Destinataire</span>
            <p>{mission.destinataire || "—"}</p>
          </div>
          <div className="md:col-span-2">
            <span className="text-gray-500">Adresse de signification</span>
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

      <MissionUpdateForm
        mission={{
          id: mission.id,
          statut: mission.statut,
          resultat: mission.resultat,
          dateTentative: mission.dateTentative ? mission.dateTentative.toISOString() : null,
          dateRemise: mission.dateRemise ? mission.dateRemise.toISOString() : null,
        }}
        canEdit={canEdit}
      />
    </div>
  );
}
