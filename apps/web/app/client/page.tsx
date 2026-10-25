import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { clientDossierFilter } from "@/lib/client-access";
import Link from "next/link";
import { SpotlightCard } from "@/components/landing/spotlight-card";
import { AnimatedCounter } from "@/components/landing/animated-counter";
import { ClientDocumentUpload } from "@/app/client/documents/client-document-upload";

const STATUT_BADGES: Record<string, string> = {
  Prospect: "bg-gray-100 text-gray-700",
  Nouveau: "bg-cabinet-100 text-cabinet-800",
  "En cours d'analyse": "bg-cabinet-100 text-cabinet-800",
  "En cours": "bg-cabinet-100 text-cabinet-800",
  Clôturé: "bg-emerald-100 text-emerald-700",
  Archivé: "bg-gray-200 text-gray-700",
};

const CATEGORIE_LABELS: Record<string, string> = {
  correspondance: "Correspondance",
  contrat: "Contrat",
  conclusions: "Conclusions",
  pv: "Procès-verbal",
  facture: "Facture",
  titre_foncier: "Titre foncier",
  assignation: "Assignation",
  note_interne: "Note interne",
  autre: "Autre",
};

function BriefcaseIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="14" x="2" y="7" rx="2" ry="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
    </svg>
  );
}

function ReceiptIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1-2-1Z" />
      <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" />
    </svg>
  );
}

function WalletIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
      <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
      <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
    </svg>
  );
}

function StatCard({
  label,
  value,
  href,
  icon,
  colorClass,
  suffix,
}: {
  label: string;
  value: number;
  href: string;
  icon: React.ReactNode;
  colorClass: string;
  suffix?: string;
}) {
  return (
    <Link href={href} className="group block">
      <SpotlightCard variant="light" className="h-full">
        <div className="flex items-start justify-between">
          <div className={`rounded-xl p-3 ${colorClass}`}>{icon}</div>
          <span className="text-xs font-medium text-cabinet-400 opacity-0 transition-opacity group-hover:opacity-100">
            Voir tout →
          </span>
        </div>
        <p className="mt-4 text-3xl font-semibold text-cabinet-900">
          <AnimatedCounter value={value} suffix={suffix} />
        </p>
        <p className="mt-1 text-sm font-medium text-cabinet-600">{label}</p>
      </SpotlightCard>
    </Link>
  );
}

export default async function ClientHomePage() {
  const session = await getSession();

  if (!session.isClient || !session.clientId) {
    return (
      <div className="card p-6 text-center">
        <h1 className="text-2xl font-bold">Espace client</h1>
        <p className="mt-2 text-sm text-gray-600">
          Veuillez vous connecter avec un compte client pour accéder à cette page.
        </p>
        <Link href="/client/login" className="btn-primary mt-4 inline-block">
          Se connecter
        </Link>
      </div>
    );
  }

  const maintenant = new Date();
  const dossierFilter = clientDossierFilter(session.userId!, session.clientId);

  const [
    client,
    dossiers,
    documents,
    factures,
    evenements,
  ] = await Promise.all([
    prisma.client.findUnique({
      where: { id: session.clientId },
      select: { raisonSociale: true },
    }),
    prisma.dossier.findMany({
      where: dossierFilter,
      take: 100,
      orderBy: { createdAt: "desc" },
    }),
    prisma.document.findMany({
      where: {
        publieClient: true,
        dossier: dossierFilter,
      },
      take: 5,
      orderBy: { datePublication: "desc" },
      include: { dossier: { select: { referenceInterne: true } } },
    }),
    prisma.facture.findMany({
      where: { clientId: session.clientId },
      take: 100,
      include: { paiements: true },
      orderBy: { dateEmission: "desc" },
    }),
    prisma.evenement.findMany({
      where: {
        AND: [
          { estPublicClient: true, dateDebut: { gte: maintenant } },
          { OR: [{ dossier: dossierFilter }, { dossierId: null }] },
        ],
      },
      take: 5,
      orderBy: { dateDebut: "asc" },
      include: { dossier: { select: { referenceInterne: true } } },
    }),
  ]);

  const dossiersCount = dossiers.length;
  const documentsCount = documents.length;
  const facturesCount = factures.length;

  const totalDu = factures.reduce(
    (acc, f) =>
      acc + Number(f.totalTtc) - f.paiements.reduce((p, pay) => p + Number(pay.montant), 0),
    0
  );

  const aujourdhui = maintenant.toLocaleDateString("fr-FR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-medium capitalize text-cabinet-500">{aujourdhui}</p>
        <h1 className="font-display text-3xl font-bold text-cabinet-900">
          Bienvenue, {client?.raisonSociale || "client"}
        </h1>
        <p className="mt-1 text-sm text-cabinet-600">
          Voici le suivi de vos dossiers auprès du cabinet.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Mes dossiers"
          value={dossiersCount}
          href="/client/dossiers"
          icon={<BriefcaseIcon />}
          colorClass="bg-cabinet-100 text-cabinet-700"
        />
        <StatCard
          label="Documents publiés"
          value={documentsCount}
          href="/client/documents"
          icon={<FileIcon />}
          colorClass="bg-emerald-100 text-emerald-700"
        />
        <StatCard
          label="Mes factures"
          value={facturesCount}
          href="/client/factures"
          icon={<ReceiptIcon />}
          colorClass="bg-amber-100 text-amber-700"
        />
        <StatCard
          label="Solde restant dû"
          value={totalDu}
          href="/client/factures"
          icon={<WalletIcon />}
          colorClass="bg-blue-100 text-blue-700"
          suffix=" FCFA"
        />
      </div>

      <ClientDocumentUpload
        dossiers={dossiers.map((d) => ({ id: d.id, referenceInterne: d.referenceInterne }))}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-cabinet-900">Dossiers récents</h2>
            <Link href="/client/dossiers" className="text-sm text-cabinet-700 hover:underline">
              Voir tout
            </Link>
          </div>
          <div className="space-y-3">
            {dossiers.length === 0 ? (
              <p className="text-sm text-cabinet-500">Aucun dossier.</p>
            ) : (
              dossiers.slice(0, 5).map((d) => (
                <div
                  key={d.id}
                  className="flex items-center justify-between rounded-xl border border-cabinet-100 bg-cabinet-50/50 px-4 py-3 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-cabinet-900">{d.referenceInterne}</p>
                    <p className="truncate text-xs text-cabinet-500">{d.typeAffaire}</p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      STATUT_BADGES[d.statut] || "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {d.statut}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-cabinet-900">Prochains rendez-vous et échéances</h2>
            <Link href="/client/evenements" className="text-sm text-cabinet-700 hover:underline">
              Voir tout
            </Link>
          </div>
          <div className="space-y-3">
            {evenements.length === 0 ? (
              <p className="text-sm text-cabinet-500">Aucun événement à venir.</p>
            ) : (
              evenements.map((e) => (
                <div
                  key={e.id}
                  className="rounded-xl border border-cabinet-100 bg-cabinet-50/50 px-4 py-3 text-sm"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-cabinet-900">{e.titre}</span>
                    <span className="text-xs text-cabinet-500">{e.dossier?.referenceInterne ?? "—"}</span>
                  </div>
                  <p className="text-xs text-cabinet-500">
                    {new Date(e.dateDebut).toLocaleString("fr-FR")}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-cabinet-900">Documents récents</h2>
            <Link href="/client/documents" className="text-sm text-cabinet-700 hover:underline">
              Voir tout
            </Link>
          </div>
          <div className="space-y-3">
            {documents.length === 0 ? (
              <p className="text-sm text-cabinet-500">Aucun document publié.</p>
            ) : (
              documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between rounded-xl border border-cabinet-100 bg-cabinet-50/50 px-4 py-3 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-cabinet-900">{doc.nom}</p>
                    <p className="truncate text-xs text-cabinet-500">
                      {CATEGORIE_LABELS[doc.categorie] || doc.categorie} · {doc.dossier.referenceInterne}
                    </p>
                  </div>
                  <a
                    href={`/api/documents/${doc.id}/download`}
                    className="text-cabinet-700 hover:underline"
                  >
                    Télécharger
                  </a>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-cabinet-900">Factures récentes</h2>
            <Link href="/client/factures" className="text-sm text-cabinet-700 hover:underline">
              Voir tout
            </Link>
          </div>
          <div className="space-y-3">
            {factures.slice(0, 5).length === 0 ? (
              <p className="text-sm text-cabinet-500">Aucune facture.</p>
            ) : (
              factures.slice(0, 5).map((f) => {
                const paye = f.paiements.reduce((acc, p) => acc + Number(p.montant), 0);
                const solde = Number(f.totalTtc) - paye;
                return (
                  <div
                    key={f.id}
                    className="flex items-center justify-between rounded-xl border border-cabinet-100 bg-cabinet-50/50 px-4 py-3 text-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-cabinet-900">{f.numero}</p>
                      <p className="text-xs text-cabinet-500">
                        {solde > 0 ? `${solde.toLocaleString("fr-FR")} FCFA restant dû` : "Payée"}
                      </p>
                    </div>
                    <span className="text-xs text-cabinet-500">
                      {new Date(f.dateEmission).toLocaleDateString("fr-FR")}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
