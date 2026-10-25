import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import {
  getServerDossierFilter,
  getServerClientFilter,
  getServerDossierScopedFilter,
} from "@/lib/server-auth";
import Link from "next/link";
import { SpotlightCard } from "@/components/landing/spotlight-card";
import { AnimatedCounter } from "@/components/landing/animated-counter";
import { PaginatedList } from "@/components/pagination";

const TYPE_LABELS: Record<string, string> = {
  contentieux_contractuel: "Contentieux contractuel",
  contentieux_immobilier: "Contentieux immobilier",
  recouvrement: "Recouvrement de créances",
  procedure_civile: "Procédure civile / commerciale",
  conseil: "Conseil / Consultation",
  expulsion: "Expulsion et recouvrement",
  bail: "Baux commerciaux et d'habitation",
  foncier: "Litiges fonciers",
  signification: "Signification / Actes d'huissier",
  constat: "Constats et procès-verbaux",
  saisie: "Saisies et mesures d'exécution",
  negociation: "Négociation / Règlement amiable",
};

const TACHE_STATUT_BADGES: Record<string, string> = {
  "À faire": "bg-gray-100 text-gray-700",
  "En cours": "bg-cabinet-100 text-cabinet-800",
  "Terminée": "bg-emerald-100 text-emerald-700",
  "Annulée": "bg-red-100 text-red-700",
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  audience: "Audience",
  echeance: "Échéance",
  rdv: "Rendez-vous",
  signification: "Signification",
  deadline: "Deadline",
  journal: "Journal",
};

const NON_SIGNATAIRE_ROLES = ["Client", "Huissier de justice", "Architecte"];

const EVENT_TYPE_BADGES: Record<string, string> = {
  audience: "bg-cabinet-100 text-cabinet-800",
  echeance: "bg-amber-100 text-amber-700",
  rdv: "bg-blue-100 text-blue-700",
  signification: "bg-purple-100 text-purple-700",
  deadline: "bg-red-100 text-red-700",
  journal: "bg-slate-100 text-slate-700",
};

function FolderIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
      <line x1="16" x2="16" y1="2" y2="6" />
      <line x1="8" x2="8" y1="2" y2="6" />
      <line x1="3" x2="21" y1="10" y2="10" />
    </svg>
  );
}

function CheckSquareIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 11 2 2 4-4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l4 4Z" />
    </svg>
  );
}

function StatCard({
  label,
  value,
  href,
  icon,
  colorClass,
}: {
  label: string;
  value: number;
  href: string;
  icon: React.ReactNode;
  colorClass: string;
}) {
  return (
    <Link href={href} className="group block">
      <SpotlightCard variant="light" className="h-full p-4">
        <div className="flex items-center gap-3">
          <div className={`rounded-xl p-2 ${colorClass}`}>{icon}</div>
          <p className="text-2xl font-semibold text-cabinet-900">
            <AnimatedCounter value={value} />
          </p>
          <p className="truncate text-sm font-medium text-cabinet-600">{label}</p>
          <span className="ml-auto text-xs font-medium text-cabinet-400 opacity-0 transition-opacity group-hover:opacity-100">
            →
          </span>
        </div>
      </SpotlightCard>
    </Link>
  );
}

export default async function DashboardPage() {
  const session = await getSession();
  const maintenant = new Date();

  const user = session?.userId
    ? await prisma.user.findUnique({
        where: { id: session.userId },
        select: { id: true, prenom: true, nom: true, role: { select: { nom: true, estAdmin: true } } },
      })
    : null;

  const isSignataire = !!user && !NON_SIGNATAIRE_ROLES.includes(user.role?.nom || "");
  const isApprover =
    !!user &&
    (user.role?.estAdmin ||
      /directeur|associé|associe/i.test(user.role?.nom || ""));

  // Filtres d'isolation par rôle (résolus une fois, réutilisés partout).
  const [dossierFilter, clientFilter, tacheFilter, evenementFilter] = await Promise.all([
    getServerDossierFilter(),
    getServerClientFilter(),
    getServerDossierScopedFilter("taches"),
    getServerDossierScopedFilter("rendezVous"),
  ]);

  // Construire le filtre événement comme le calendrier : si le filtre est vide
  // (admin), on ne restreint pas ; sinon on inclut les événements sans dossier.
  const evenementWhere =
    Object.keys(evenementFilter).length === 0
      ? {}
      : { OR: [{ dossierId: null }, evenementFilter] };

  const [
    totalDossiers,
    dossiersActifs,
    totalClients,
    evenementsAVenir,
    tachesEnCours,
    dossiersRecents,
    tachesUrgentes,
    clientsRecents,
    evenementsProchains,
    lettresASigner,
    pendingLeaves,
    pendingContracts,
    pendingInsurance,
    myLeaves,
    pendingInsuranceAdvances,
  ] = await Promise.all([
    prisma.dossier.count({ where: dossierFilter }),
    prisma.dossier.count({
      where: { ...dossierFilter, statut: { notIn: ["Clôturé", "Archivé"] } },
    }),
    prisma.client.count({ where: clientFilter }),
    prisma.evenement.count({
      where: {
        AND: [
          evenementWhere,
          { dateDebut: { gte: maintenant } },
        ],
      },
    }),
    prisma.tache.count({
      where: { ...tacheFilter, statut: { not: "Terminée" } },
    }),
    prisma.dossier.findMany({
      where: dossierFilter,
      take: 6,
      orderBy: { createdAt: "desc" },
      include: { client: { select: { raisonSociale: true } } },
    }),
    prisma.tache.findMany({
      where: { ...tacheFilter, echeance: { gte: maintenant } },
      take: 5,
      orderBy: { echeance: "asc" },
      include: { dossier: { select: { referenceInterne: true } } },
    }),
    prisma.client.findMany({
      where: clientFilter,
      take: 5,
      orderBy: { createdAt: "desc" },
    }),
    prisma.evenement.findMany({
      where: {
        AND: [
          evenementWhere,
          { dateDebut: { gte: maintenant } },
        ],
      },
      take: 5,
      orderBy: { dateDebut: "asc" },
      include: { dossier: { select: { referenceInterne: true } } },
    }),
    isSignataire
      ? prisma.mail.findMany({
          where: { signataireId: user!.id, status: "brouillon" },
          orderBy: { createdAt: "desc" },
          take: 10,
          select: {
            id: true,
            reference: true,
            subject: true,
            structure: true,
            contact: true,
            mailDate: true,
            dossierId: true,
          },
        })
      : [],
    isApprover
      ? prisma.leaveRequest.findMany({
          where: { statut: "soumise" },
          take: 10,
          orderBy: { createdAt: "desc" },
          include: {
            employee: { select: { firstName: true, lastName: true } },
            leaveType: { select: { libelle: true } },
          },
        })
      : [],
    isApprover
      ? prisma.employmentContract.findMany({
          where: { statut: { in: ["brouillon", "rejeté"] } },
          take: 10,
          orderBy: { createdAt: "desc" },
          include: {
            employee: { select: { firstName: true, lastName: true } },
          },
        })
      : [],
    isApprover
      ? prisma.medicalInvoice.findMany({
          where: { statut: "validee" },
          take: 10,
          orderBy: { createdAt: "desc" },
          include: {
            insuredEmployee: { include: { employee: { select: { firstName: true, lastName: true } } } },
            provider: { select: { nom: true } },
          },
        })
      : [],
    user
      ? prisma.leaveRequest.findMany({
          where: { createdBy: user.id },
          take: 10,
          orderBy: { createdAt: "desc" },
          include: {
            employee: { select: { firstName: true, lastName: true } },
            leaveType: { select: { libelle: true } },
          },
        })
      : [],
    isApprover
      ? prisma.insurerPayment.findMany({
          where: { typePaiement: "avance", statut: "brouillon" },
          take: 10,
          orderBy: { createdAt: "desc" },
          include: {
            contract: {
              select: { reference: true, insurer: { select: { nom: true } } },
            },
          },
        })
      : [],
  ]);

  /// Fusionner tâches et événements pour la section "Prochains événements",
  /// comme le fait le calendrier (tâches avec échéance + événements).
  type ProchainItem = {
    id: string;
    kind: "tache" | "evenement";
    titre: string;
    date: Date;
    type?: string;
    statut?: string;
    dossier: { referenceInterne: string } | null;
  };
  const prochainsItems: ProchainItem[] = [
    ...tachesUrgentes.map((t) => ({
      id: t.id,
      kind: "tache" as const,
      titre: t.titre,
      date: t.echeance!,
      statut: t.statut,
      dossier: t.dossier,
    })),
    ...evenementsProchains.map((e) => ({
      id: e.id,
      kind: "evenement" as const,
      titre: e.titre,
      date: e.dateDebut,
      type: e.type,
      dossier: e.dossier,
    })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime()).slice(0, 8);

  const aujourdhui = maintenant.toLocaleDateString("fr-FR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium capitalize text-cabinet-500">{aujourdhui}</p>
          <h1 className="font-display text-3xl font-bold text-cabinet-900">
            Bonjour, {user ? `${user.prenom} ${user.nom}` : "cabinet"}
          </h1>
          <p className="mt-1 text-sm text-cabinet-600">
            {user?.role.nom || "Vue d'ensemble"} · Tableau de bord
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/cabinet/dossiers/nouveau" className="btn-primary">
            + Nouveau dossier
          </Link>
          <Link href="/cabinet/clients/nouveau" className="btn-secondary">
            + Nouveau client
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Dossiers actifs"
          value={dossiersActifs}
          href="/cabinet/dossiers"
          icon={<FolderIcon />}
          colorClass="bg-cabinet-100 text-cabinet-700"
        />
        <StatCard
          label="Clients"
          value={totalClients}
          href="/cabinet/clients"
          icon={<UsersIcon />}
          colorClass="bg-emerald-100 text-emerald-700"
        />
        <StatCard
          label="Événements à venir"
          value={evenementsAVenir}
          href="/cabinet/calendrier"
          icon={<CalendarIcon />}
          colorClass="bg-amber-100 text-amber-700"
        />
        <StatCard
          label="Tâches en cours"
          value={tachesEnCours}
          href="/cabinet/taches"
          icon={<CheckSquareIcon />}
          colorClass="bg-blue-100 text-blue-700"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-cabinet-900">Dossiers récents</h2>
            <Link href="/cabinet/dossiers" className="text-sm text-cabinet-700 hover:underline">
              Voir tout
            </Link>
          </div>
          <div className="space-y-3">
            {dossiersRecents.length === 0 ? (
              <p className="text-sm text-cabinet-500">Aucun dossier.</p>
            ) : (
              <PaginatedList>
              {dossiersRecents.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center justify-between rounded-xl border border-cabinet-100 bg-cabinet-50/50 px-4 py-3 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <Link href={`/cabinet/dossiers/${d.id}`} className="font-medium text-cabinet-700 hover:underline">
                      {d.referenceInterne}
                    </Link>
                    <p className="truncate text-xs text-cabinet-500">{d.client.raisonSociale}</p>
                  </div>
                  <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-cabinet-700 shadow-sm">
                    {d.statut}
                  </span>
                </div>
              ))}
              </PaginatedList>
            )}
          </div>
        </div>

        <div className="card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-cabinet-900">Tâches à venir</h2>
            <Link href="/cabinet/taches" className="text-sm text-cabinet-700 hover:underline">
              Voir tout
            </Link>
          </div>
          <div className="space-y-3">
            {tachesUrgentes.length === 0 ? (
              <p className="text-sm text-cabinet-500">Aucune tâche à venir.</p>
            ) : (
              <PaginatedList>
              {tachesUrgentes.map((t) => (
                <div key={t.id} className="space-y-1 rounded-xl border border-cabinet-100 bg-cabinet-50/50 px-4 py-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-cabinet-900">{t.titre}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        TACHE_STATUT_BADGES[t.statut] || "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {t.statut}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-cabinet-500">
                    <span>{t.dossier.referenceInterne}</span>
                    <span>{t.echeance ? new Date(t.echeance).toLocaleDateString("fr-FR") : "—"}</span>
                  </div>
                </div>
              ))}
              </PaginatedList>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-cabinet-900">Prochains événements</h2>
            <Link href="/cabinet/calendrier" className="text-sm text-cabinet-700 hover:underline">
              Voir tout
            </Link>
          </div>
          <div className="space-y-3">
            {prochainsItems.length === 0 ? (
              <p className="text-sm text-cabinet-500">Aucun événement à venir.</p>
            ) : (
              <PaginatedList>
              {prochainsItems.map((item) => (
                <div key={`${item.kind}-${item.id}`} className="flex items-center justify-between rounded-xl border border-cabinet-100 bg-cabinet-50/50 px-4 py-3 text-sm">
                  <div className="flex items-center gap-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        item.kind === "tache"
                          ? TACHE_STATUT_BADGES[item.statut || ""] || "bg-gray-100 text-gray-700"
                          : EVENT_TYPE_BADGES[item.type || ""] || "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {item.kind === "tache"
                        ? item.statut || "Tâche"
                        : EVENT_TYPE_LABELS[item.type || ""] || item.type || "Événement"}
                    </span>
                    <span className="font-medium text-cabinet-900">{item.titre}</span>
                  </div>
                  <div className="flex flex-col items-end text-xs text-cabinet-500">
                    <span>{item.dossier?.referenceInterne || "—"}</span>
                    <span>{new Date(item.date).toLocaleString("fr-FR")}</span>
                  </div>
                </div>
              ))}
              </PaginatedList>
            )}
          </div>
        </div>

        <div className="card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-cabinet-900">Clients récents</h2>
            <Link href="/cabinet/clients" className="text-sm text-cabinet-700 hover:underline">
              Voir tout
            </Link>
          </div>
          <div className="space-y-3">
            {clientsRecents.length === 0 ? (
              <p className="text-sm text-cabinet-500">Aucun client.</p>
            ) : (
              <PaginatedList>
              {clientsRecents.map((c) => (
                <Link
                  key={c.id}
                  href={`/cabinet/clients/${c.id}`}
                  className="flex items-center justify-between rounded-xl border border-cabinet-100 bg-cabinet-50/50 px-4 py-3 text-sm transition hover:border-cabinet-300"
                >
                  <span className="font-medium text-cabinet-900">{c.raisonSociale}</span>
                  <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-cabinet-700 shadow-sm capitalize">
                    {c.type}
                  </span>
                </Link>
              ))}
              </PaginatedList>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
      {isSignataire && (
        <div className="card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-cabinet-900">Lettres à signer</h2>
            <span className="text-sm text-cabinet-500">{lettresASigner.length} en attente</span>
          </div>
          <div className="space-y-3">
            {lettresASigner.length === 0 ? (
              <p className="text-sm text-cabinet-500">Aucune lettre à signer.</p>
            ) : (
              <PaginatedList>
              {lettresASigner.map((m) => (
                <div
                  key={m.id}
                  className="flex flex-col gap-2 rounded-xl border border-cabinet-100 bg-cabinet-50/50 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-cabinet-900">{m.subject}</p>
                    <p className="truncate text-xs text-cabinet-500">
                      {m.structure || "—"} · {m.contact || "—"} · {new Date(m.mailDate).toLocaleDateString("fr-FR")}
                    </p>
                  </div>
                  <Link
                    href={`/cabinet/administration/courrier?signer=${m.id}`}
                    className="btn-primary text-center text-xs"
                  >
                    Signer
                  </Link>
                </div>
              ))}
              </PaginatedList>
            )}
          </div>
        </div>
      )}

      {isApprover && (
        <div className="card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-cabinet-900">Absences et Congés à approuver</h2>
            <Link href="/cabinet/personnel/conges" className="text-sm text-cabinet-700 hover:underline">
              Voir tout
            </Link>
          </div>
          <div className="space-y-3">
            {pendingLeaves.length === 0 ? (
              <p className="text-sm text-cabinet-500">Aucune demande à approuver.</p>
            ) : (
              <PaginatedList>
              {pendingLeaves.map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-xl border border-cabinet-100 bg-cabinet-50/50 px-4 py-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-cabinet-900">
                      {r.employee.firstName} {r.employee.lastName}
                    </p>
                    <p className="truncate text-xs text-cabinet-500">
                      {r.leaveType.libelle} · {r.dateDebut.toISOString().split("T")[0]} → {r.dateFin.toISOString().split("T")[0]}
                    </p>
                  </div>
                  <Link href={`/cabinet/personnel/conges`} className="btn-primary text-center text-xs">
                    Approuver
                  </Link>
                </div>
              ))}
              </PaginatedList>
            )}
          </div>
        </div>
      )}

      {isApprover && (
        <div className="card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-cabinet-900">Contrats à approuver</h2>
            <Link href="/cabinet/personnel/contrats" className="text-sm text-cabinet-700 hover:underline">
              Voir tout
            </Link>
          </div>
          <div className="space-y-3">
            {pendingContracts.length === 0 ? (
              <p className="text-sm text-cabinet-500">Aucun contrat à approuver.</p>
            ) : (
              <PaginatedList>
              {pendingContracts.map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded-xl border border-cabinet-100 bg-cabinet-50/50 px-4 py-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-cabinet-900">
                      {c.employee.firstName} {c.employee.lastName}
                    </p>
                    <p className="truncate text-xs text-cabinet-500">
                      {c.typeContrat} · {c.dateDebut.toLocaleDateString("fr-FR")} {c.dateFin ? `→ ${c.dateFin.toLocaleDateString("fr-FR")}` : ""} · {c.statut}
                    </p>
                  </div>
                  <Link href={`/cabinet/personnel/contrats/${c.id}/imprimer`} className="btn-primary text-center text-xs">
                    Voir
                  </Link>
                </div>
              ))}
              </PaginatedList>
            )}
          </div>
        </div>
      )}

      {isApprover && (
        <div className="card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-cabinet-900">Assurance à payer</h2>
            <Link href="/cabinet/personnel/assurances" className="text-sm text-cabinet-700 hover:underline">
              Voir tout
            </Link>
          </div>
          <div className="space-y-3">
            {pendingInsurance.length === 0 ? (
              <p className="text-sm text-cabinet-500">Aucune assurance à payer.</p>
            ) : (
              <PaginatedList>
              {pendingInsurance.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between rounded-xl border border-cabinet-100 bg-cabinet-50/50 px-4 py-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-cabinet-900">
                      {inv.insuredEmployee.employee.firstName} {inv.insuredEmployee.employee.lastName}
                    </p>
                    <p className="truncate text-xs text-cabinet-500">
                      {inv.provider.nom} · {inv.typeSoin} · {inv.montantTotal.toLocaleString("fr-FR")} FCFA · {inv.statut}
                    </p>
                  </div>
                  <Link href="/cabinet/personnel/assurances" className="btn-primary text-center text-xs">
                    Approuver
                  </Link>
                </div>
              ))}
              </PaginatedList>
            )}
          </div>
        </div>
      )}

      {isApprover && (
        <div className="card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-cabinet-900">Avances Assureur à approuver</h2>
            <Link href="/cabinet/personnel/assurances" className="text-sm text-cabinet-700 hover:underline">
              Voir tout
            </Link>
          </div>
          <div className="space-y-3">
            {pendingInsuranceAdvances.length === 0 ? (
              <p className="text-sm text-cabinet-500">Aucune avance à approuver.</p>
            ) : (
              <PaginatedList>
              {pendingInsuranceAdvances.map((a) => (
                <div key={a.id} className="flex items-center justify-between rounded-xl border border-cabinet-100 bg-cabinet-50/50 px-4 py-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-cabinet-900">
                      {a.contract?.reference} · {a.contract?.insurer?.nom || "Assureur"}
                    </p>
                    <p className="truncate text-xs text-cabinet-500">
                      {a.montant.toLocaleString("fr-FR")} FCFA · {a.datePaiement ? new Date(a.datePaiement).toLocaleDateString("fr-FR") : "—"} · {a.statut}
                    </p>
                  </div>
                  <Link href="/cabinet/personnel/assurances" className="btn-primary text-center text-xs">
                    Approuver
                  </Link>
                </div>
              ))}
              </PaginatedList>
            )}
          </div>
        </div>
      )}

      {!!user && (
        <div className="card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-cabinet-900">Mes Absences et Congés</h2>
            <Link href="/cabinet/personnel/conges" className="text-sm text-cabinet-700 hover:underline">
              Voir tout
            </Link>
          </div>
          <div className="space-y-3">
            {myLeaves.length === 0 ? (
              <p className="text-sm text-cabinet-500">Aucune demande enregistrée.</p>
            ) : (
              <PaginatedList>
              {myLeaves.map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-xl border border-cabinet-100 bg-cabinet-50/50 px-4 py-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-cabinet-900">
                      {r.employee.firstName} {r.employee.lastName}
                    </p>
                    <p className="truncate text-xs text-cabinet-500">
                      {r.leaveType.libelle} · {r.dateDebut.toISOString().split("T")[0]} → {r.dateFin.toISOString().split("T")[0]} · {r.statut}
                    </p>
                  </div>
                  <Link href={`/cabinet/personnel/conges`} className="text-xs text-cabinet-700 hover:underline">
                    Voir
                  </Link>
                </div>
              ))}
              </PaginatedList>
            )}
          </div>
        </div>
      )}
      </div>

    </div>
  );
}
