import Link from "next/link";
import { getServerAuth } from "@/lib/server-auth";
import { hasPermission } from "@/lib/rbac";
import { tableSearchWhere } from "@/lib/search";
import { SearchInput } from "@/components/search-input";
import { PaginatedRows } from "@/components/pagination";
import { BIEN_NATURES, BIEN_TYPES_DROIT } from "@/lib/transactions";
import { BienFormClient } from "./bien-form-client";

function demandeurLabel(d: any) {
  if (!d) return "—";
  return d.typePersonne === "MORALE"
    ? d.raisonSociale || d.nom
    : [d.civilite, d.prenoms, d.nom].filter(Boolean).join(" ");
}

export default async function BiensPage({
  searchParams,
}: {
  searchParams: { q?: string; nature?: string };
}) {
  const auth = await getServerAuth();
  const canWrite = auth.estAdmin || hasPermission(auth.role, "transactions", "write");

  const q = (searchParams.q || "").trim();
  const nature = searchParams.nature || "";

  const [biens, demandeurs, parcelles] = await Promise.all([
    auth.prisma.bien.findMany({
      where: {
        ...(nature ? { nature } : {}),
        ...tableSearchWhere(q, [
          "designation",
          "referenceBien",
          "adresse",
          "quartier",
          "commune",
          "referenceDroit",
          "proprietaire.nom",
          "proprietaire.prenoms",
          "proprietaire.raisonSociale",
          "parcelle.nicad",
          "parcelle.titreFoncier",
        ]),
      },
      include: {
        proprietaire: true,
        parcelle: { select: { id: true, nicad: true, titreFoncier: true, commune: true } },
        _count: { select: { transactions: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 300,
    }),
    auth.prisma.demandeur.findMany({ orderBy: { nom: "asc" }, take: 300 }),
    auth.prisma.parcelle.findMany({
      orderBy: { updatedAt: "desc" },
      take: 300,
      select: { id: true, nicad: true, titreFoncier: true, commune: true },
    }),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Biens</h1>
        <p className="text-sm text-gray-500">
          Référentiel des biens objets des transactions : immeubles, terrains,
          locaux, meubles. Rattachables aux parcelles et aux propriétaires
          (demandeurs) existants.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="w-full sm:w-1/2">
          <SearchInput placeholder="Désignation, adresse, commune, NICAD, TF…" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-500">Nature</label>
          <form method="get">
            <input type="hidden" name="q" value={q} />
            <select name="nature" defaultValue={nature} className="input text-sm">
              <option value="">Toutes</option>
              {BIEN_NATURES.map((n) => (
                <option key={n.code} value={n.code}>
                  {n.label}
                </option>
              ))}
            </select>
            <button type="submit" className="btn-secondary ml-2 px-3 py-2 text-xs">
              Filtrer
            </button>
          </form>
        </div>
      </div>

      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-cabinet-100 text-cabinet-900">
              <tr>
                <th className="px-3 py-3 text-xs">Désignation</th>
                <th className="px-3 py-3 text-xs">Nature</th>
                <th className="px-3 py-3 text-xs">Localisation</th>
                <th className="px-3 py-3 text-xs">Droit / référence</th>
                <th className="px-3 py-3 text-xs">Propriétaire</th>
                <th className="px-3 py-3 text-xs">Parcelle</th>
                <th className="px-3 py-3 text-xs">Transactions</th>
              </tr>
            </thead>
            <tbody>
              {biens.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-500">
                    Aucun bien enregistré.
                  </td>
                </tr>
              )}
              <PaginatedRows colSpan={7} pageSize={20}>
                {biens.map((b) => (
                  <tr key={b.id} className="border-b hover:bg-gray-50">
                    <td className="px-3 py-3">
                      <div className="font-medium">{b.designation}</div>
                      {b.referenceBien && (
                        <div className="text-xs text-gray-500">{b.referenceBien}</div>
                      )}
                    </td>
                    <td className="px-3 py-3 text-xs">
                      {BIEN_NATURES.find((n) => n.code === b.nature)?.label || b.nature}
                    </td>
                    <td className="px-3 py-3 text-xs">
                      {[b.adresse, b.quartier, b.commune].filter(Boolean).join(", ") || "—"}
                      {b.superficie ? (
                        <div className="text-gray-500">
                          {b.superficie.toLocaleString("fr-FR")} {b.uniteSuperficie || "m²"}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 text-xs">
                      {BIEN_TYPES_DROIT.find((d) => d.code === b.typeDroit)?.label || b.typeDroit || "—"}
                      {b.referenceDroit && <div className="text-gray-500">{b.referenceDroit}</div>}
                    </td>
                    <td className="px-3 py-3 text-xs">{demandeurLabel(b.proprietaire)}</td>
                    <td className="px-3 py-3 text-xs">
                      {b.parcelle ? (
                        <>
                          {b.parcelle.titreFoncier && <div>TF {b.parcelle.titreFoncier}</div>}
                          {b.parcelle.nicad && <div>NICAD {b.parcelle.nicad}</div>}
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-3 text-center text-xs">
                      {b._count.transactions > 0 ? (
                        <Link href={`/cabinet/dossiers/transactions`} className="text-cabinet-700 underline">
                          {b._count.transactions}
                        </Link>
                      ) : (
                        "0"
                      )}
                    </td>
                  </tr>
                ))}
              </PaginatedRows>
            </tbody>
          </table>
        </div>
      </div>

      {canWrite && (
        <BienFormClient
          demandeurs={JSON.parse(JSON.stringify(demandeurs))}
          parcelles={JSON.parse(JSON.stringify(parcelles))}
        />
      )}
    </div>
  );
}
