import { prisma } from "@/lib/prisma";
import {
  getServerDossierFilter,
  getServerClientFilter,
  getServerDossierScopedFilter,
} from "@/lib/server-auth";
import Link from "next/link";
import { FactureForm } from "./facture-form";

export default async function NewFacturePage() {
  const [dossierFilter, clientFilter, tacheFilter, missionFilter] = await Promise.all([
    getServerDossierFilter(),
    getServerClientFilter(),
    getServerDossierScopedFilter("taches"),
    getServerDossierScopedFilter("missions"),
  ]);

  const [dossiers, clients, tvaRates, taches, missions] = await Promise.all([
    prisma.dossier.findMany({
      where: dossierFilter,
      take: 200,
      orderBy: { referenceInterne: "asc" },
      select: {
        id: true,
        referenceInterne: true,
        clientId: true,
        client: { select: { raisonSociale: true } },
      },
    }),
    prisma.client.findMany({
      where: clientFilter,
      take: 200,
      orderBy: { raisonSociale: "asc" },
      select: { id: true, raisonSociale: true },
    }),
    prisma.tvaRate.findMany({
      where: { isActive: true },
      orderBy: { rate: "asc" },
    }),
    prisma.tache.findMany({
      where: tacheFilter,
      take: 200,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        titre: true,
        dossierId: true,
        dossier: { select: { referenceInterne: true } },
      },
    }),
    prisma.missionHuissier.findMany({
      where: missionFilter,
      take: 200,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        typeActe: true,
        dossierId: true,
        dossier: { select: { referenceInterne: true } },
      },
    }),
  ]);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Nouvelle facture</h1>
        <Link href="/cabinet/factures" className="text-sm text-cabinet-700 hover:underline">
          ← Retour aux factures
        </Link>
      </div>
      <FactureForm
        dossiers={dossiers}
        clients={clients}
        tvaRates={tvaRates}
        taches={taches}
        missions={missions}
      />
    </div>
  );
}
