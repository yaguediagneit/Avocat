import { prisma } from "@/lib/prisma";
import { serverHasPermission } from "@/lib/server-auth";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { EmployeeEditForm } from "./employee-edit-form";

export default async function EditEmployeePage({ params }: { params: { id: string } }) {
  if (!(await serverHasPermission("comptabilite", "write"))) {
    redirect("/cabinet/personnel");
  }

  const employee = await prisma.employee.findUnique({
    where: { id: params.id },
    include: { histories: { orderBy: { changedAt: "desc" } } },
  });

  if (!employee) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Modifier l&apos;employé</h1>
        <Link href="/cabinet/personnel" className="text-sm text-cabinet-700 hover:underline">
          ← Retour au personnel
        </Link>
      </div>
      <EmployeeEditForm employee={employee} />
    </div>
  );
}
