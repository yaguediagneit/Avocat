import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getServerDossierScopedFilter } from "@/lib/server-auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import { NotificationsPanel } from "../notifications-panel";
import { PaginatedUl } from "@/components/pagination";

const TACHE_STATUT_BADGES: Record<string, string> = {
  "À faire": "bg-gray-100 text-gray-700",
  "En cours": "bg-cabinet-100 text-cabinet-800",
  "Terminée": "bg-emerald-100 text-emerald-700",
  "Annulée": "bg-red-100 text-red-700",
};

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export default async function AlertesPage() {
  const session = await getSession();

  if (!session.userId || session.isClient || !session.mfaVerified) {
    redirect("/login");
  }

  const maintenant = new Date();
  const dans7jours = addDays(maintenant, 7);

  // Filtres d'isolation par rôle.
  const [tacheFilter, evenementFilter, factureFilter] = await Promise.all([
    getServerDossierScopedFilter("taches"),
    getServerDossierScopedFilter("rendezVous"),
    getServerDossierScopedFilter("factures"),
  ]);

  const [tachesUrgentes, evenementsProchains, facturesEnRetard] = await Promise.all([
    prisma.tache.findMany({
      where: {
        ...tacheFilter,
        echeance: { lte: dans7jours },
        statut: { notIn: ["Terminée", "Annulée"] },
      },
      orderBy: { echeance: "asc" },
      take: 50,
      include: { dossier: { select: { referenceInterne: true } } },
    }),
    prisma.evenement.findMany({
      where: {
        AND: [
          { OR: [{ type: "journal" }, evenementFilter] },
          { dateDebut: { gte: maintenant, lte: dans7jours } },
        ],
      },
      orderBy: { dateDebut: "asc" },
      take: 50,
      include: { dossier: { select: { referenceInterne: true } } },
    }),
    prisma.facture.findMany({
      where: {
        ...factureFilter,
        dateEcheance: { lt: maintenant },
        statut: { not: "Payée" },
      },
      orderBy: { dateEcheance: "asc" },
      take: 50,
      include: {
        dossier: { select: { referenceInterne: true } },
        client: { select: { raisonSociale: true } },
      },
    }),
  ]);

  const tachesRetard = tachesUrgentes.filter((t) => t.echeance && new Date(t.echeance) < maintenant);
  const tachesAVenir = tachesUrgentes.filter((t) => t.echeance && new Date(t.echeance) >= maintenant);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Alertes et échéances</h1>
          <p className="text-sm text-gray-600">Vue synthétique des urgences des 7 prochains jours.</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card p-5">
          <p className="text-sm font-medium text-cabinet-600">Tâches urgentes</p>
          <p className="mt-2 text-3xl font-semibold text-cabinet-900">{tachesUrgentes.length}</p>
        </div>
        <div className="card p-5">
          <p className="text-sm font-medium text-cabinet-600">Événements à venir</p>
          <p className="mt-2 text-3xl font-semibold text-cabinet-900">{evenementsProchains.length}</p>
        </div>
        <div className="card p-5">
          <p className="text-sm font-medium text-cabinet-600">Factures en retard</p>
          <p className="mt-2 text-3xl font-semibold text-cabinet-900">{facturesEnRetard.length}</p>
        </div>
      </div>

      <div className="card space-y-4">
        <h2 className="font-semibold">Tâches en retard ou à venir</h2>
        {tachesUrgentes.length === 0 ? (
          <p className="text-sm text-gray-500">Aucune tâche urgente.</p>
        ) : (
          <ul className="space-y-2">
            <PaginatedUl>
            {tachesUrgentes.map((t) => {
              const isLate = t.echeance && new Date(t.echeance) < maintenant;
              return (
                <li
                  key={t.id}
                  className="flex items-center justify-between rounded-xl border border-cabinet-100 bg-cabinet-50/50 px-4 py-3 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-cabinet-900">{t.titre}</p>
                    <p className="truncate text-xs text-cabinet-500">
                      {t.dossier.referenceInterne}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        TACHE_STATUT_BADGES[t.statut] || "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {t.statut}
                    </span>
                    <span className={`text-xs ${isLate ? "text-red-600" : "text-cabinet-500"}`}>
                      {t.echeance ? new Date(t.echeance).toLocaleDateString("fr-FR") : "—"}
                    </span>
                  </div>
                </li>
              );
            })}
            </PaginatedUl>
          </ul>
        )}
      </div>

      <div className="card space-y-4">
        <h2 className="font-semibold">Prochains événements</h2>
        {evenementsProchains.length === 0 ? (
          <p className="text-sm text-gray-500">Aucun événement prévu.</p>
        ) : (
          <ul className="space-y-2">
            <PaginatedUl>
            {evenementsProchains.map((e) => (
              <li
                key={e.id}
                className="flex items-center justify-between rounded-xl border border-cabinet-100 bg-cabinet-50/50 px-4 py-3 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-cabinet-900">{e.titre}</p>
                  <p className="truncate text-xs text-cabinet-500">
                    {e.dossier?.referenceInterne ?? "Journal"} · {e.type}
                  </p>
                </div>
                <span className="text-xs text-cabinet-500">
                  {new Date(e.dateDebut).toLocaleString("fr-FR")}
                </span>
              </li>
            ))}
            </PaginatedUl>
          </ul>
        )}
      </div>

      <div className="card space-y-4">
        <h2 className="font-semibold">Factures en retard de paiement</h2>
        {facturesEnRetard.length === 0 ? (
          <p className="text-sm text-gray-500">Aucune facture en retard.</p>
        ) : (
          <ul className="space-y-2">
            <PaginatedUl>
            {facturesEnRetard.map((f) => (
              <li
                key={f.id}
                className="flex items-center justify-between rounded-xl border border-cabinet-100 bg-cabinet-50/50 px-4 py-3 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <Link href={`/cabinet/factures/${f.id}`} className="font-medium text-cabinet-700 hover:underline">
                    {f.numero}
                  </Link>
                  <p className="truncate text-xs text-cabinet-500">
                    {f.client.raisonSociale} · {f.dossier?.referenceInterne ?? "—"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-medium">{Number(f.totalTtc).toLocaleString("fr-FR")} FCFA</p>
                  <p className="text-xs text-red-600">
                    échue le {f.dateEcheance ? new Date(f.dateEcheance).toLocaleDateString("fr-FR") : "—"}
                  </p>
                </div>
              </li>
            ))}
            </PaginatedUl>
          </ul>
        )}
      </div>

      <NotificationsPanel />
    </div>
  );
}
