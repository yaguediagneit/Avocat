import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { EcritureForm } from "./ecriture-form";

export default async function NewEcriturePage() {
  const [journals, exercises, accounts] = await Promise.all([
    prisma.accountingJournal.findMany({
      where: { isActive: true },
      orderBy: { code: "asc" },
    }),
    prisma.accountingExercise.findMany({
      where: { isClosed: false },
      orderBy: { year: "desc" },
    }),
    prisma.accountingAccount.findMany({
      where: { isActive: true },
      orderBy: [{ class: "asc" }, { accountCode: "asc" }],
      take: 2000,
    }),
  ]);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Nouvelle écriture comptable</h1>
        <Link href="/cabinet/comptabilite/ecritures" className="text-sm text-cabinet-700 hover:underline">
          ← Retour aux écritures
        </Link>
      </div>
      <EcritureForm journals={journals} exercises={exercises} accounts={accounts} />
    </div>
  );
}
