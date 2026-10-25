import { getServerAuth } from "@/lib/server-auth";
import { hasPermission } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { TransactionsParametrage } from "./parametrage-client";

export default async function TransactionsParametragePage() {
  const auth = await getServerAuth();
  const canWrite = auth.estAdmin || hasPermission(auth.role, "transactions", "write");
  if (!canWrite) redirect("/cabinet/dossiers/transactions");

  const [types, modeles] = await Promise.all([
    auth.prisma.transactionType.findMany({
      include: {
        pieces: { orderBy: { ordre: "asc" } },
        _count: { select: { transactions: true } },
      },
      orderBy: [{ ordre: "asc" }, { libelle: "asc" }],
    }),
    auth.prisma.transactionModele.findMany({
      include: { type: { select: { code: true, libelle: true } } },
      orderBy: [{ ordre: "asc" }, { titre: "asc" }],
    }),
  ]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Paramétrage des transactions &amp; contrats</h1>
      <p className="text-sm text-gray-500">
        Catalogue des types de transactions, check-lists de pièces et modèles de
        contrats / courriers. Les workflows (vente sous titre foncier, bail,
        générique) sont codés ; le circuit notarial et la mutation au livre
        foncier sont exigés par la loi — ces garde-fous ne se désactivent pas.
      </p>
      <TransactionsParametrage
        types={JSON.parse(JSON.stringify(types))}
        modeles={JSON.parse(JSON.stringify(modeles))}
        estAdmin={auth.estAdmin}
      />
    </div>
  );
}
