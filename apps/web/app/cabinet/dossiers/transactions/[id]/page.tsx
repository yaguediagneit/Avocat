import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerAuth, serverCanAccessDossier } from "@/lib/server-auth";
import { hasPermission } from "@/lib/rbac";
import { TransactionDetailClient } from "./transaction-detail-client";

export default async function TransactionDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const auth = await getServerAuth();
  const canWrite = auth.estAdmin || hasPermission(auth.role, "transactions", "write");
  const canValidate = auth.estAdmin || hasPermission(auth.role, "transactions", "validate");

  const transaction = await auth.prisma.transaction.findUnique({
    where: { id: params.id },
    include: {
      type: { include: { pieces: { where: { actif: true }, orderBy: { ordre: "asc" } } } },
      dossier: {
        select: {
          id: true,
          referenceInterne: true,
          statut: true,
          client: { select: { id: true, raisonSociale: true } },
        },
      },
      parties: {
        include: {
          demandeur: true,
          client: { select: { id: true, raisonSociale: true } },
        },
        orderBy: { ordre: "asc" },
      },
      biens: {
        include: {
          bien: {
            include: {
              parcelle: { select: { id: true, nicad: true, titreFoncier: true, commune: true } },
              proprietaire: { select: { id: true, nom: true, prenoms: true, raisonSociale: true } },
            },
          },
        },
      },
      pieces: { orderBy: [{ ordre: "asc" }, { createdAt: "asc" }] },
      formalites: {
        include: {
          demarche: {
            select: { id: true, reference: true, statut: true, type: { select: { libelle: true } } },
          },
        },
        orderBy: { createdAt: "asc" },
      },
      demarches: {
        select: {
          id: true,
          reference: true,
          statut: true,
          objet: true,
          type: { select: { libelle: true } },
        },
        orderBy: { createdAt: "asc" },
      },
      paiements: { orderBy: { date: "desc" } },
      evenements: { orderBy: { date: "desc" }, take: 200 },
    },
  });
  if (!transaction) return notFound();

  const ok = await serverCanAccessDossier(transaction.dossierId, "read");
  if (!ok) redirect("/cabinet/dossiers/transactions");

  const [documents, modeles, demandeurs, biens, users, validePar, demarchesDossier] =
    await Promise.all([
      auth.prisma.document.findMany({
        where: { dossierId: transaction.dossierId, actif: true },
        select: { id: true, nom: true, categorie: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
      auth.prisma.transactionModele.findMany({
        where: { actif: true, OR: [{ typeId: transaction.typeId }, { typeId: null }] },
        orderBy: { ordre: "asc" },
      }),
      auth.prisma.demandeur.findMany({ orderBy: { nom: "asc" }, take: 300 }),
      auth.prisma.bien.findMany({ orderBy: { updatedAt: "desc" }, take: 300 }),
      auth.prisma.user.findMany({
        where: { actif: true },
        select: { id: true, prenom: true, nom: true, role: { select: { nom: true } } },
        orderBy: { nom: "asc" },
      }),
      transaction.valideParId
        ? auth.prisma.user.findUnique({
            where: { id: transaction.valideParId },
            select: { prenom: true, nom: true },
          })
        : null,
      // Démarches du dossier pouvant porter les formalités externes.
      auth.prisma.demarche.findMany({
        where: { dossierId: transaction.dossierId, archiveLe: null },
        select: { id: true, reference: true, statut: true, type: { select: { libelle: true } } },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
    ]);

  const userNames = Object.fromEntries(users.map((u) => [u.id, `${u.prenom} ${u.nom}`]));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Link href="/cabinet/dossiers/transactions" className="text-sm text-cabinet-700 hover:underline">
          ← Transactions
        </Link>
      </div>
      <TransactionDetailClient
        transaction={JSON.parse(JSON.stringify(transaction))}
        documents={JSON.parse(JSON.stringify(documents))}
        modeles={JSON.parse(JSON.stringify(modeles))}
        demandeurs={JSON.parse(JSON.stringify(demandeurs))}
        biens={JSON.parse(JSON.stringify(biens))}
        demarchesDossier={JSON.parse(JSON.stringify(demarchesDossier))}
        users={JSON.parse(JSON.stringify(users))}
        userNames={userNames}
        canWrite={canWrite}
        canValidate={canValidate}
        valideParNom={validePar ? `${validePar.prenom} ${validePar.nom}` : null}
      />
    </div>
  );
}
