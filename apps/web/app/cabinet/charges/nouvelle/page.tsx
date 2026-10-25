import { prisma } from "@/lib/prisma";
import {
  getServerDossierFilter,
  getServerDossierScopedFilter,
} from "@/lib/server-auth";
import { serverHasPermission } from "@/lib/server-auth";
import { redirect } from "next/navigation";
import { ChargeForm } from "./charge-form";

export default async function NewChargePage() {
  if (!(await serverHasPermission("comptabilite", "write"))) {
    redirect("/cabinet");
  }

  const [dossierFilter, tacheFilter, missionFilter] = await Promise.all([
    getServerDossierFilter(),
    getServerDossierScopedFilter("taches"),
    getServerDossierScopedFilter("missions"),
  ]);

  const [dossiers, taches, missions, categories, tvaRates] = await Promise.all([
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
    prisma.chargeCategory.findMany({
      where: { isActive: true },
      orderBy: { ordre: "asc" },
      select: { id: true, code: true, label: true, accountCode: true },
    }),
    prisma.tvaRate.findMany({
      where: { isActive: true },
      orderBy: { rate: "asc" },
    }),
  ]);

  // Comptes d'immobilisation (classe 2) proposés quand la charge est amortie :
  // comptes à 2 ou 3 chiffres, hors amortissements (28x) et dépréciations (29x).
  const immoAccounts = await prisma.accountingAccount.findMany({
    where: {
      isActive: true,
      class: 2,
      level: { gte: 2, lte: 3 },
      NOT: [{ accountCode: { startsWith: "28" } }, { accountCode: { startsWith: "29" } }],
    },
    orderBy: { accountCode: "asc" },
    select: { accountCode: true, label: true },
  });

  return (
    <ChargeForm
      dossiers={dossiers}
      taches={taches}
      missions={missions}
      categories={categories}
      tvaRates={tvaRates}
      immoAccounts={immoAccounts}
    />
  );
}
