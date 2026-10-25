import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { serverHasPermission, getServerAuth } from "@/lib/server-auth";
import { getEmployeeLeaveBalance } from "@/lib/leave";
import { CongesClient } from "./conges-client";

export default async function CongesPage() {
  const auth = await getServerAuth();
  const currentUser = await prisma.user.findUnique({ where: { id: auth.userId }, select: { email: true } });
  const canRead = await serverHasPermission("comptabilite", "read");

  const ownConditions: Prisma.LeaveRequestWhereInput[] = [{ createdBy: auth.userId }];
  if (currentUser?.email) ownConditions.push({ employee: { email: currentUser.email } });
  const ownWhere: Prisma.LeaveRequestWhereInput = { OR: ownConditions };

  if (!canRead) {
    const hasOwn = await prisma.leaveRequest.count({ where: ownWhere });
    if (hasOwn === 0) redirect("/cabinet");
  }

  const canWrite = canRead ? await serverHasPermission("comptabilite", "write") : false;
  if (canWrite) {
    const defaultTypes = [
      { code: "conge_annuel", libelle: "Congés annuels", deduitSoldeConge: true, necessiteJustificatif: false },
      { code: "maladie", libelle: "Raisons médicales", deduitSoldeConge: false, necessiteJustificatif: true },
      { code: "raisons_personnelles", libelle: "Autorisation sans solde / raisons personnelles", deduitSoldeConge: false, necessiteJustificatif: false },
      { code: "raisons_familiales", libelle: "Raisons familiales (autre)", deduitSoldeConge: false, necessiteJustificatif: true },
      { code: "mariage_travailleur", libelle: "Mariage du travailleur", deduitSoldeConge: false, necessiteJustificatif: true },
      { code: "mariage_proche", libelle: "Mariage d’un enfant, frère ou sœur", deduitSoldeConge: false, necessiteJustificatif: true },
      { code: "deces_conjoint_enfant", libelle: "Décès du conjoint ou d’un descendant", deduitSoldeConge: false, necessiteJustificatif: true },
      { code: "deces_ascendant_frere_soeur", libelle: "Décès d’un ascendant, frère ou sœur", deduitSoldeConge: false, necessiteJustificatif: true },
      { code: "deces_beau_parent", libelle: "Décès d’un beau-père ou belle-mère", deduitSoldeConge: false, necessiteJustificatif: true },
      { code: "naissance", libelle: "Naissance d’un enfant", deduitSoldeConge: false, necessiteJustificatif: true },
      { code: "bapteme", libelle: "Baptême d’un enfant", deduitSoldeConge: false, necessiteJustificatif: true },
      { code: "premiere_communion", libelle: "Première communion", deduitSoldeConge: false, necessiteJustificatif: true },
      { code: "hospitalisation_proche", libelle: "Hospitalisation du conjoint ou d’un enfant", deduitSoldeConge: false, necessiteJustificatif: true },
      { code: "stage_sportif", libelle: "Stage sportif officiel", deduitSoldeConge: false, necessiteJustificatif: true },
      { code: "congres_syndical", libelle: "Congrès syndical", deduitSoldeConge: false, necessiteJustificatif: true },
    ];

    await Promise.all(
      defaultTypes.map((t) =>
        prisma.leaveType.upsert({
          where: { code: t.code },
          update: { libelle: t.libelle, deduitSoldeConge: t.deduitSoldeConge },
          create: {
            ...t,
            necessiteValidation: true,
            remuneree: false,
            actif: true,
          },
        })
      )
    );

    await prisma.leavePolicy.updateMany({
      where: { actif: true },
      data: { joursParMois: 2.5, compterSamedi: false, compterDimanche: false },
    });
    const activePolicyCount = await prisma.leavePolicy.count({ where: { actif: true } });
    if (activePolicyCount === 0) {
      await prisma.leavePolicy.create({
        data: {
          nom: "Politique par défaut",
          joursParMois: 2.5,
          compterSamedi: false,
          compterDimanche: false,
          exclureJoursFeries: true,
          actif: true,
        },
      });
    }

    const defaultParams = [
      { categorie: "conges", code: "conges_jours_par_mois", libelle: "2.5" },
      { categorie: "conges", code: "conges_compter_samedi", libelle: "false" },
      { categorie: "conges", code: "conges_compter_dimanche", libelle: "false" },
      { categorie: "conges", code: "conges_exclure_jours_feries", libelle: "true" },
      { categorie: "conges", code: "conges_plafond_famille", libelle: "15" },
      { categorie: "conges", code: "conges_plafond_personnel", libelle: "15" },
      { categorie: "conges", code: "conges_max_mariage_travailleur", libelle: "3" },
      { categorie: "conges", code: "conges_max_mariage_proche", libelle: "1" },
      { categorie: "conges", code: "conges_max_deces_conjoint_enfant", libelle: "4" },
      { categorie: "conges", code: "conges_max_deces_ascendant_frere_soeur", libelle: "2" },
      { categorie: "conges", code: "conges_max_deces_beau_parent", libelle: "2" },
      { categorie: "conges", code: "conges_max_naissance", libelle: "1" },
      { categorie: "conges", code: "conges_max_bapteme", libelle: "1" },
      { categorie: "conges", code: "conges_max_premiere_communion", libelle: "1" },
      { categorie: "conges", code: "conges_max_hospitalisation_proche", libelle: "2" },
      { categorie: "conges", code: "conges_max_raisons_familiales", libelle: "15" },
    ];

    await Promise.all(
      defaultParams.map((p) =>
        prisma.parametre.upsert({
          where: { categorie_code: { categorie: "conges", code: p.code } },
          update: { libelle: p.libelle },
          create: { ...p, ordre: 0, actif: true },
        })
      )
    );
  }

  const [employees, leaveTypes, requests, approvers] = await Promise.all([
    prisma.employee.findMany({
      where: { isActive: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: { id: true, employeeCode: true, firstName: true, lastName: true, email: true },
    }),
    prisma.leaveType.findMany({ where: { actif: true }, select: { id: true, code: true, libelle: true, deduitSoldeConge: true } }),
    prisma.leaveRequest.findMany({
      where: canRead ? {} : ownWhere,
      orderBy: { createdAt: "desc" },
      include: {
        employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true, email: true } },
        leaveType: { select: { id: true, code: true, libelle: true, deduitSoldeConge: true } },
      },
    }),
    prisma.user.findMany({
      where: {
        actif: true,
        role: {
          OR: [
            { estAdmin: true },
            { nom: { contains: "directeur", mode: "insensitive" } },
            { nom: { contains: "associé", mode: "insensitive" } },
          ],
        },
      },
      select: { id: true, prenom: true, nom: true },
      orderBy: [{ nom: "asc" }, { prenom: "asc" }],
    }),
  ]);

  const requestsWithBalance = await Promise.all(
    requests.map(async (r) => {
      const fullEmployee = await prisma.employee.findUnique({ where: { id: r.employee.id } });
      const balance = fullEmployee ? await getEmployeeLeaveBalance(prisma, fullEmployee) : { acquis: 0, consommes: 0, reserves: 0, restants: 0, policy: null as any };
      return {
        ...r,
        dateDebut: r.dateDebut.toISOString().split("T")[0],
        dateFin: r.dateFin.toISOString().split("T")[0],
        submittedAt: r.submittedAt ? r.submittedAt.toISOString().split("T")[0] : "",
        approverId: r.approverId ?? "",
        balance: { acquis: balance.acquis, consommes: balance.consommes, reserves: balance.reserves, restants: balance.restants },
      };
    })
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Congés & Absences</h1>
      </div>
      <CongesClient
        employees={employees}
        leaveTypes={leaveTypes}
        requests={requestsWithBalance}
        approvers={approvers}
        currentUserId={auth.userId}
        currentUserEmail={currentUser?.email ?? ""}
        isAdmin={auth.estAdmin}
      />
    </div>
  );
}
