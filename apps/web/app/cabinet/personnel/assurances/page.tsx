import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { serverHasPermission, getServerAuth } from "@/lib/server-auth";
import { hasPermission } from "@/lib/rbac";
import { AssurancesClient } from "./assurances-client";

export default async function AssurancesPage() {
  if (!(await serverHasPermission("comptabilite", "read"))) {
    redirect("/cabinet");
  }

  const auth = await getServerAuth();
  const canWrite = hasPermission(auth.role, "comptabilite", "write");
  const canApprove = auth.role.nom.toLowerCase().includes("comptable") || auth.role.estAdmin;
  const canManage = auth.role.estAdmin ||
    auth.role.nom.toLowerCase().includes("comptable") ||
    auth.role.nom.toLowerCase().includes("directeur") ||
    auth.role.nom.toLowerCase().includes("associé") ||
    auth.role.nom.toLowerCase().includes("associe");
  const canApproveAdvance = auth.role.estAdmin ||
    auth.role.nom.toLowerCase().includes("directeur") ||
    auth.role.nom.toLowerCase().includes("associé") ||
    auth.role.nom.toLowerCase().includes("associe");
  const canPay = auth.role.nom.toLowerCase().includes("comptable");

  const [insurers, contracts, employees, dependents, providers, invoices] = await Promise.all([
    prisma.insurer.findMany({ orderBy: [{ statut: "asc" }, { nom: "asc" }] }),
    prisma.insuranceContract.findMany({
      include: {
        insurer: true,
        payments: {
          select: {
            id: true,
            typePaiement: true,
            statut: true,
            montant: true,
            datePaiement: true,
            paidBy: true,
            paidAt: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { dateDebut: "desc" },
    }),
    prisma.insuredEmployee.findMany({
      where: { statut: "actif" },
      include: { employee: true, contract: { include: { insurer: true } } },
      orderBy: { employee: { lastName: "asc" } },
    }),
    prisma.employeeDependent.findMany({
      where: { statut: "actif" },
      include: { employee: true, insuredEmployee: true },
      orderBy: { nom: "asc" },
    }),
    prisma.medicalProvider.findMany({
      where: { statut: "actif" },
      orderBy: { nom: "asc" },
    }),
    prisma.medicalInvoice.findMany({
      where: { statut: { not: "annulee" } },
      include: {
        insuredEmployee: { include: { employee: true } },
        dependent: true,
        provider: true,
        contract: { include: { insurer: true } },
      },
      orderBy: { dateSoins: "desc" },
    }),
  ]);

  const totals = invoices.reduce(
    (acc, inv) => {
      acc.totalFactures += inv.montantTotal;
      acc.totalPartEmploye += inv.partEmploye;
      acc.totalPayeEmploye += inv.montantPayeEmploye;
      acc.totalResteEmploye += inv.resteAPayerEmploye;
      acc.totalPartCabinet += inv.partCabinet;
      return acc;
    },
    { totalFactures: 0, totalPartEmploye: 0, totalPayeEmploye: 0, totalResteEmploye: 0, totalPartCabinet: 0 }
  );

  const totalsByEmployee: Record<string, { id: string; nom: string; count: number; total: number; partEmploye: number; paye: number; reste: number; partCabinet: number }> = {};
  for (const inv of invoices) {
    const key = inv.insuredEmployee.employee.id;
    const nom = `${inv.insuredEmployee.employee.firstName} ${inv.insuredEmployee.employee.lastName}`;
    if (!totalsByEmployee[key]) {
      totalsByEmployee[key] = { id: key, nom, count: 0, total: 0, partEmploye: 0, paye: 0, reste: 0, partCabinet: 0 };
    }
    const t = totalsByEmployee[key];
    t.count += 1;
    t.total += inv.montantTotal;
    t.partEmploye += inv.partEmploye;
    t.paye += inv.montantPayeEmploye;
    t.reste += inv.resteAPayerEmploye;
    t.partCabinet += inv.partCabinet;
  }

  const activeContractIds = contracts.filter((c) => c.statut === "actif" || c.statut === "brouillon").map((c) => c.id);
  const advances = await prisma.insurerPayment.aggregate({
    _sum: { montant: true },
    where: { contractId: { in: activeContractIds }, typePaiement: "avance", statut: { in: ["paye", "valide"] } },
  });
  const totalAvances = advances._sum.montant || 0;

  const employeesList = await prisma.employee.findMany({
    where: { isActive: true },
    select: { id: true, firstName: true, lastName: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  const clientInsurers = insurers.map((i) => ({
    id: i.id,
    nom: i.nom,
    adresse: i.adresse,
    telephone: i.telephone,
    telephoneSecondaire: i.telephoneSecondaire,
    email: i.email,
    siteWeb: i.siteWeb,
    referenceInterne: i.referenceInterne,
    statut: i.statut,
    observations: i.observations,
    managerNom: i.managerNom,
    managerFonction: i.managerFonction,
    managerTelephone: i.managerTelephone,
    managerEmail: i.managerEmail,
    createdAt: i.createdAt.toISOString(),
    updatedAt: i.updatedAt.toISOString(),
  }));

  const clientContracts = contracts.map((c) => ({
    id: c.id,
    insurerId: c.insurerId,
    reference: c.reference,
    dateDebut: c.dateDebut.toISOString(),
    dateFin: c.dateFin.toISOString(),
    typeCouverture: c.typeCouverture,
    devise: c.devise,
    tauxGeneral: c.tauxGeneral,
    montantAvance: c.montantAvance,
    datePaiementAvance: c.datePaiementAvance ? c.datePaiementAvance.toISOString() : null,
    modePaiementAvance: c.modePaiementAvance,
    referencePaiementAvance: c.referencePaiementAvance,
    statut: c.statut,
    conditions: c.conditions,
    documentPath: c.documentPath,
    factureAssureurPath: c.factureAssureurPath,
    chequePath: c.chequePath,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    insurer: { id: c.insurer.id, nom: c.insurer.nom },
    payments: c.payments.map((p) => ({
      id: p.id,
      typePaiement: p.typePaiement,
      statut: p.statut,
      montant: p.montant,
      datePaiement: p.datePaiement ? p.datePaiement.toISOString() : null,
      paidBy: p.paidBy,
      paidAt: p.paidAt ? p.paidAt.toISOString() : null,
    })),
  }));

  const clientEmployees = employees.map((ie) => ({
    id: ie.id,
    employeeId: ie.employeeId,
    contractId: ie.contractId,
    numeroAdherent: ie.numeroAdherent,
    dateAdhesion: ie.dateAdhesion.toISOString(),
    dateFinCouverture: ie.dateFinCouverture ? ie.dateFinCouverture.toISOString() : null,
    formule: ie.formule,
    tauxParticulier: ie.tauxParticulier,
    plafondIndividuel: ie.plafondIndividuel,
    statut: ie.statut,
    createdAt: ie.createdAt.toISOString(),
    updatedAt: ie.updatedAt.toISOString(),
    employee: { id: ie.employee.id, firstName: ie.employee.firstName, lastName: ie.employee.lastName },
    contract: { id: ie.contract.id, reference: ie.contract.reference, tauxGeneral: ie.contract.tauxGeneral, insurer: { id: ie.contract.insurer.id, nom: ie.contract.insurer.nom } },
  }));

  const clientDependents = dependents.map((d) => ({
    id: d.id,
    employeeId: d.employeeId,
    insuredEmployeeId: d.insuredEmployeeId,
    nom: d.nom,
    prenom: d.prenom,
    sexe: d.sexe,
    dateNaissance: d.dateNaissance ? d.dateNaissance.toISOString() : null,
    lienFamilial: d.lienFamilial,
    numeroAdherent: d.numeroAdherent,
    dateDebutCouverture: d.dateDebutCouverture ? d.dateDebutCouverture.toISOString() : null,
    dateFinCouverture: d.dateFinCouverture ? d.dateFinCouverture.toISOString() : null,
    tauxParticulier: d.tauxParticulier,
    plafondParticulier: d.plafondParticulier,
    statut: d.statut,
    justificatifPath: d.justificatifPath,
    observations: d.observations,
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
    employee: { id: d.employee.id, firstName: d.employee.firstName, lastName: d.employee.lastName },
    insuredEmployee: d.insuredEmployee ? { id: d.insuredEmployee.id } : null,
  }));

  const clientProviders = providers.map((p) => ({
    id: p.id,
    nom: p.nom,
    adresse: p.adresse,
    telephone: p.telephone,
    email: p.email,
    typePrestataire: p.typePrestataire,
    statut: p.statut,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  }));

  const clientInvoices = invoices.map((inv) => ({
    id: inv.id,
    referenceInterne: inv.referenceInterne,
    numeroFacture: inv.numeroFacture,
    insuredEmployeeId: inv.insuredEmployeeId,
    dependentId: inv.dependentId,
    contractId: inv.contractId,
    providerId: inv.providerId,
    dateSoins: inv.dateSoins.toISOString(),
    dateFacture: inv.dateFacture.toISOString(),
    typeSoin: inv.typeSoin,
    montantTotal: inv.montantTotal,
    tauxApplique: inv.tauxApplique,
    partCabinet: inv.partCabinet,
    partEmploye: inv.partEmploye,
    montantPayeEmploye: inv.montantPayeEmploye,
    resteAPayerEmploye: inv.resteAPayerEmploye,
    statut: inv.statut,
    statutPaiementEmploye: inv.statutPaiementEmploye,
    commentaire: inv.commentaire,
    justificatifPath: inv.justificatifPath,
    factureAssureurPath: inv.factureAssureurPath,
    chequePath: inv.chequePath,
    insuredEmployee: { employee: { id: inv.insuredEmployee.employee.id, firstName: inv.insuredEmployee.employee.firstName, lastName: inv.insuredEmployee.employee.lastName } },
    dependent: inv.dependent ? { id: inv.dependent.id, prenom: inv.dependent.prenom, nom: inv.dependent.nom } : null,
    provider: { id: inv.provider.id, nom: inv.provider.nom },
    contract: { id: inv.contract.id, reference: inv.contract.reference, insurer: { id: inv.contract.insurer.id, nom: inv.contract.insurer.nom } },
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Assurance et Prises en Charges</h1>
        <Link
          href="/cabinet/personnel"
          className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-300"
        >
          Retour au personnel
        </Link>
      </div>
      <AssurancesClient
        canWrite={canWrite}
        canApprove={canApprove}
        canManage={canManage}
        canApproveAdvance={canApproveAdvance}
        canPay={canPay}
        initialData={{
          insurers: clientInsurers,
          contracts: clientContracts,
          employees: clientEmployees,
          dependents: clientDependents,
          providers: clientProviders,
          invoices: clientInvoices,
          totals,
          totalsByEmployee: Object.values(totalsByEmployee),
          totalAvances,
          soldeAPayer: Math.max(0, totals.totalPartCabinet - totalAvances),
        }}
        employeesList={employeesList}
      />
    </div>
  );
}
