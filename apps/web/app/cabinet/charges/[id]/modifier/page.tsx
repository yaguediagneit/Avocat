import { prisma } from "@/lib/prisma";
import { serverHasPermission } from "@/lib/server-auth";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ChargeEditForm } from "./charge-edit-form";

export default async function EditChargePage({ params }: { params: { id: string } }) {
  if (!(await serverHasPermission("comptabilite", "write"))) {
    redirect("/cabinet/charges");
  }

  const charge = await prisma.charge.findUnique({
    where: { id: params.id },
    include: { category: true, tvaRate: { select: { code: true, rate: true } }, lines: { orderBy: { ordre: "asc" } } },
  });

  if (!charge) notFound();

  const [categories, tvaRates] = await Promise.all([
    prisma.chargeCategory.findMany({ orderBy: { label: "asc" } }),
    prisma.tvaRate.findMany({ orderBy: { rate: "asc" } }),
  ]);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Modifier la charge</h1>
        <Link href="/cabinet/charges" className="text-sm text-cabinet-700 hover:underline">
          ← Retour aux charges
        </Link>
      </div>
      <ChargeEditForm charge={charge} categories={categories} tvaRates={tvaRates} />
    </div>
  );
}
