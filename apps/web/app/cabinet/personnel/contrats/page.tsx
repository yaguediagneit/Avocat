import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { serverHasPermission, getServerAuth } from "@/lib/server-auth";
import { ContratsClient } from "./contrats-client";

export default async function ContratsPage() {
  if (!(await serverHasPermission("comptabilite", "read"))) {
    redirect("/cabinet");
  }

  const auth = await getServerAuth();
  const role = auth.role.nom.toLowerCase();
  const canManage =
    auth.role.estAdmin ||
    role.includes("rh") ||
    role.includes("directeur") ||
    role.includes("associé") ||
    role.includes("associe");
  const canValidate =
    auth.role.estAdmin ||
    role.includes("directeur") ||
    role.includes("associé") ||
    role.includes("associe");

  const [employeesRaw, contracts, approbateursRaw] = await Promise.all([
    prisma.employee.findMany({
      where: { isActive: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: {
        id: true,
        employeeCode: true,
        firstName: true,
        lastName: true,
        position: true,
        department: true,
        baseSalary: true,
        hireDate: true,
        contractEndDate: true,
        contractType: true,
      },
    }),
    prisma.employmentContract.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            position: true,
            department: true,
            baseSalary: true,
            hireDate: true,
            contractEndDate: true,
            contractType: true,
          },
        },
      },
    }),
    prisma.user.findMany({
      where: { actif: true },
      include: {
        role: { select: { id: true, nom: true, estAdmin: true } },
      },
      orderBy: [{ nom: "asc" }, { prenom: "asc" }],
    }),
  ]);

  const approbateurs = approbateursRaw
    .filter((u) => {
      const role = u.role.nom.toLowerCase();
      return u.role.estAdmin || role.includes("directeur") || role.includes("associé") || role.includes("associe");
    })
    .map((u) => ({
      id: u.id,
      prenom: u.prenom,
      nom: u.nom,
      roleNom: u.role.nom,
    }));

  const employees = employeesRaw.map((e) => ({
    ...e,
    hireDate: e.hireDate.toISOString().split("T")[0],
    contractEndDate: e.contractEndDate ? e.contractEndDate.toISOString().split("T")[0] : null,
  }));

  const formattedContracts = contracts.map((c) => ({
    ...c,
    dateDebut: c.dateDebut.toISOString().split("T")[0],
    dateFin: c.dateFin ? c.dateFin.toISOString().split("T")[0] : "",
    documentPath: c.documentPath,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    employee: {
      ...c.employee,
      hireDate: c.employee.hireDate.toISOString().split("T")[0],
      contractEndDate: c.employee.contractEndDate ? c.employee.contractEndDate.toISOString().split("T")[0] : null,
    },
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Contrats de travail</h1>
      </div>
      <ContratsClient employees={employees} contracts={formattedContracts} approbateurs={approbateurs} canManage={canManage} canValidate={canValidate} />
    </div>
  );
}
