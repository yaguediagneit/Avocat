import { prisma } from "@/lib/prisma";
import { tableSearchWhere, codesMatchingLabel, dateClauses } from "@/lib/search";
import { getSession } from "@/lib/session";
import { clientDossierFilter } from "@/lib/client-access";
import Link from "next/link";
import { SearchInput } from "@/components/search-input";
import { SortableTh } from "@/components/sortable-th";
import { getSortSpec, sortRows } from "@/lib/table-sort";

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

const STATUT_BADGES: Record<string, string> = {
  Prospect: "bg-gray-100 text-gray-700",
  Nouveau: "bg-cabinet-100 text-cabinet-800",
  "En cours d'analyse": "bg-cabinet-100 text-cabinet-800",
  "En cours": "bg-cabinet-100 text-cabinet-800",
  Clôturé: "bg-emerald-100 text-emerald-700",
  Archivé: "bg-gray-200 text-gray-700",
};

export default async function ClientDossiersPage({
  searchParams,
}: {
  searchParams: { q?: string; sort?: string; dir?: string };
}) {
  const session = await getSession();
  const sort = getSortSpec(searchParams);
  const thProps = { path: "/client/dossiers", params: searchParams };

  if (!session.isClient || !session.clientId) {
    return (
      <div className="card p-6 text-center">
        <p className="text-gray-600">Veuillez vous connecter avec un compte client.</p>
        <Link href="/client/login" className="btn-primary mt-4 inline-block">
          Se connecter
        </Link>
      </div>
    );
  }

  const q = (searchParams.q || "").trim();
  // Libellés des types d'affaire (spécialités + paramètres) pour l'affichage
  // et la recherche par libellé (« Divorce » → code de spécialité).
  const [typeParametres, specialites] = await Promise.all([
    prisma.parametre.findMany({
      where: { categorie: "type_affaire" },
      select: { code: true, libelle: true },
    }),
    prisma.specialite.findMany({ select: { code: true, libelle: true } }),
  ]);
  const typeLabels: Record<string, string> = { ...TYPE_LABELS };
  for (const p of typeParametres) typeLabels[p.code] = p.libelle;
  for (const s of specialites) typeLabels[s.code] = s.libelle;

  const dossiers = await prisma.dossier.findMany({
    take: 100,
    where: {
      ...clientDossierFilter(session.userId!, session.clientId),
      ...tableSearchWhere(
        q,
        ["referenceInterne", "typeAffaire", "statut"],
        (t) => [
          { typeAffaire: { in: codesMatchingLabel(t, typeLabels) } },
          ...dateClauses(t, ["createdAt", "dateOuverture", "dateEcheance"]),
        ]
      ),
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Mes dossiers</h1>
        <Link href="/client" className="text-sm text-cabinet-700 hover:underline">
          ← Retour
        </Link>
      </div>
      <SearchInput placeholder="Filtrer mes dossiers..." />
      <div className="card overflow-hidden p-0">
        <table className="w-full text-left text-sm">
          <thead className="bg-cabinet-100 text-cabinet-900">
            <tr>
              <SortableTh {...thProps} column="reference" label="Référence" className="px-4 py-3" />
              <SortableTh {...thProps} column="type" label="Type d&apos;affaire" className="px-4 py-3" />
              <SortableTh {...thProps} column="statut" label="Statut" className="px-4 py-3" />
              <SortableTh {...thProps} column="ouvert" label="Ouvert le" className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {dossiers.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-sm text-gray-500">
                  Aucun dossier à afficher.
                </td>
              </tr>
            )}
            {sortRows(dossiers, sort, {
              reference: (d) => d.referenceInterne,
              type: (d) => typeLabels[d.typeAffaire] || d.typeAffaire,
              statut: (d) => d.statut,
              ouvert: (d) => d.createdAt,
            }).map((d) => (
              <tr key={d.id} className="border-b hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">
                  <Link href={`/client/dossiers/${d.id}`} className="text-cabinet-700 hover:underline">
                    {d.referenceInterne}
                  </Link>
                </td>
                <td className="px-4 py-3">{typeLabels[d.typeAffaire] || d.typeAffaire}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      STATUT_BADGES[d.statut] || "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {d.statut}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {new Date(d.createdAt).toLocaleDateString("fr-FR")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
