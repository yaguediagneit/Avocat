import type { PrismaClient, Employee, LeavePolicy, LeaveRequest } from "@prisma/client";

export type LeaveStatus =
  | "brouillon"
  | "soumise"
  | "en_correction"
  | "approuvee"
  | "rejetee"
  | "annulee"
  | "terminee";

export interface DayCounts {
  acquis: number;
  consommes: number;
  reserves: number;
  restants: number;
}

function startOfDay(d: Date): Date {
  const date = new Date(d);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

export function differenceInMonths(hireDate: Date, asOf: Date): number {
  const h = startOfDay(hireDate);
  const a = startOfDay(asOf);
  let months = (a.getUTCFullYear() - h.getUTCFullYear()) * 12 + (a.getUTCMonth() - h.getUTCMonth());
  if (a.getUTCDate() < h.getUTCDate()) months -= 1;
  return Math.max(0, months);
}

export async function getActivePolicy(
  prisma: PrismaClient,
  employeeId: string
): Promise<LeavePolicy & { joursParMois: number; dateDebutAcquisition: Date; autoriserAnticipation: boolean; plafondFamille: number; plafondPersonnel: number; maxByEvent: Record<string, number> }> {
  const setting = await prisma.employeeLeaveSetting.findUnique({
    where: { employeeId },
    include: { policy: true, employee: true },
  });

  const fallback = await prisma.leavePolicy.findFirst({ where: { actif: true } });

  const policy = setting?.policy ?? fallback;
  if (!policy) {
    throw new Error("Aucune politique de congés active définie");
  }

  const employee = setting?.employee ?? (await prisma.employee.findUnique({ where: { id: employeeId } }));
  if (!employee) throw new Error("Employé introuvable");

  const parametres = await prisma.parametre.findMany({ where: { categorie: "conges", actif: true } });
  const byCode = Object.fromEntries(parametres.map((p) => [p.code, p.libelle]));

  const numberParam = (code: string, def: number) => {
    const raw = byCode[code]?.trim();
    if (!raw) return def;
    const n = Number(raw);
    return Number.isNaN(n) ? def : n;
  };
  const boolParam = (code: string, def: boolean) => {
    const raw = byCode[code]?.trim().toLowerCase();
    if (raw === "true" || raw === "1") return true;
    if (raw === "false" || raw === "0") return false;
    return def;
  };

  const maxByEvent: Record<string, number> = { ...FAMILY_EVENT_MAX };
  for (const p of parametres) {
    if (p.code.startsWith("conges_max_")) {
      const eventCode = p.code.replace("conges_max_", "");
      const n = Number(p.libelle);
      if (!Number.isNaN(n)) maxByEvent[eventCode] = n;
    }
  }

  return {
    ...policy,
    joursParMois: numberParam("conges_jours_par_mois", setting?.joursParMois ?? policy.joursParMois),
    compterSamedi: boolParam("conges_compter_samedi", policy.compterSamedi),
    compterDimanche: boolParam("conges_compter_dimanche", policy.compterDimanche),
    exclureJoursFeries: boolParam("conges_exclure_jours_feries", policy.exclureJoursFeries),
    plafondFamille: numberParam("conges_plafond_famille", 15),
    plafondPersonnel: numberParam("conges_plafond_personnel", 15),
    maxByEvent,
    dateDebutAcquisition: setting?.dateDebutAcquisition ?? (policy.debutAcquisition === "annee_civile" ? new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1)) : employee.hireDate),
    autoriserAnticipation: setting?.autoriserAnticipation ?? policy.autoriserAnticipation,
  };
}

export function isWorkingDay(
  date: Date,
  policy: Pick<LeavePolicy, "compterSamedi" | "compterDimanche" | "exclureJoursFeries">,
  holidays: Date[]
): boolean {
  const d = startOfDay(date);
  const day = d.getUTCDay();

  if (day === 0 && !policy.compterDimanche) return false;
  if (day === 6 && !policy.compterSamedi) return false;

  if (policy.exclureJoursFeries) {
    const iso = d.toISOString().split("T")[0];
    for (const h of holidays) {
      if (startOfDay(h).toISOString().split("T")[0] === iso) return false;
    }
  }
  return true;
}

export async function countWorkingDays(
  prisma: PrismaClient,
  start: Date,
  end: Date,
  policy: Pick<LeavePolicy, "compterSamedi" | "compterDimanche" | "exclureJoursFeries">
): Promise<number> {
  const s = startOfDay(start);
  const e = startOfDay(end);
  if (s > e) return 0;

  const holidays = policy.exclureJoursFeries
    ? await prisma.holiday.findMany({ where: { actif: true }, select: { dateJour: true } }).then((rows) => rows.map((r) => r.dateJour))
    : [];

  let total = 0;
  const cursor = new Date(s);
  while (cursor <= e) {
    if (isWorkingDay(cursor, policy, holidays)) total += 1;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return total;
}

export function getAccruedDays(hireDate: Date, asOf: Date, joursParMois: number): number {
  return Math.max(0, differenceInMonths(hireDate, asOf) * joursParMois);
}

type DeductibleRequestInput = {
  id?: string;
  dateDebut: Date;
  nombreJours: number;
  statut: string;
  leaveType: { code: string; deduitSoldeConge: boolean };
};

const FAMILY_EVENT_MAX: Record<string, number> = {
  mariage_travailleur: 3,
  mariage_proche: 1,
  deces_conjoint_enfant: 4,
  deces_ascendant_frere_soeur: 2,
  deces_beau_parent: 2,
  naissance: 1,
  bapteme: 1,
  premiere_communion: 1,
  hospitalisation_proche: 2,
  raisons_familiales: 15,
};

const PERSONAL_15_CODES = new Set(["raisons_personnelles", "stage_sportif", "congres_syndical"]);

function computeDeductibles(requests: DeductibleRequestInput[], ref: Date, policy: Awaited<ReturnType<typeof getActivePolicy>>) {
  const sorted = [...requests].sort((a, b) => startOfDay(a.dateDebut).getTime() - startOfDay(b.dateDebut).getTime());
  const yearlyFamily: Record<number, number> = {};
  const yearlyPersonal: Record<number, number> = {};
  const byId = new Map<string, number>();

  let consommes = 0;
  let reserves = 0;

  for (const r of sorted) {
    const de = startOfDay(r.dateDebut);
    const raw = Number(r.nombreJours);
    const code = r.leaveType.code;
    let deductible = 0;

    if (PERSONAL_15_CODES.has(code)) {
      const year = de.getUTCFullYear();
      const used = yearlyPersonal[year] ?? 0;
      const allowed = Math.max(0, Math.min(raw, policy.plafondPersonnel - used));
      deductible = Math.max(0, raw - allowed);
      yearlyPersonal[year] = used + allowed;
    } else if (policy.maxByEvent[code] !== undefined) {
      const year = de.getUTCFullYear();
      const used = yearlyFamily[year] ?? 0;
      const maxForEvent = policy.maxByEvent[code];
      const allowed = Math.max(0, Math.min(raw, maxForEvent, policy.plafondFamille - used));
      deductible = Math.max(0, raw - allowed);
      yearlyFamily[year] = used + allowed;
    } else if (r.leaveType.deduitSoldeConge) {
      deductible = raw;
    }

    if (r.id) byId.set(r.id, deductible);

    if (r.statut === "approuvee" && de <= ref) {
      consommes += deductible;
    } else if ((r.statut === "soumise" || r.statut === "approuvee") && de > ref) {
      reserves += deductible;
    }
  }

  return { consommes, reserves, byId };
}

export async function getEmployeeLeaveBalance(
  prisma: PrismaClient,
  employee: Pick<Employee, "id" | "hireDate">,
  asOf = new Date()
): Promise<DayCounts & { policy: LeavePolicy }> {
  const policy = await getActivePolicy(prisma, employee.id);
  const ref = startOfDay(asOf);

  const acquis = getAccruedDays(policy.dateDebutAcquisition, ref, policy.joursParMois);

  const requests = await prisma.leaveRequest.findMany({
    where: {
      employeeId: employee.id,
      statut: { in: ["approuvee", "soumise"] },
      leaveType: { code: { not: "maladie" } },
    },
    include: { leaveType: true },
    orderBy: { dateDebut: "asc" },
  });

  const { consommes, reserves } = computeDeductibles(requests, ref, policy);

  const restants = policy.autoriserAnticipation
    ? acquis - consommes - reserves
    : Math.max(0, acquis - consommes - reserves);

  return { acquis, consommes, reserves, restants, policy };
}

export async function getDeductibleForNewRequest(
  prisma: PrismaClient,
  employeeId: string,
  newRequest: DeductibleRequestInput,
  excludeRequestId?: string
): Promise<number> {
  const policy = await getActivePolicy(prisma, employeeId);
  const existing = await prisma.leaveRequest.findMany({
    where: {
      employeeId,
      id: excludeRequestId ? { not: excludeRequestId } : undefined,
      statut: { in: ["approuvee", "soumise"] },
      leaveType: { code: { not: "maladie" } },
    },
    include: { leaveType: true },
    orderBy: { dateDebut: "asc" },
  });

  const inputs = existing.map((r) => ({
    id: r.id,
    dateDebut: r.dateDebut,
    nombreJours: r.nombreJours,
    statut: r.statut,
    leaveType: r.leaveType,
  })) as DeductibleRequestInput[];
  inputs.push({ ...newRequest, id: "__new__" });

  const { byId } = computeDeductibles(inputs, startOfDay(new Date()), policy);
  return byId.get("__new__") ?? 0;
}

export async function getDeductibleForRequest(
  prisma: PrismaClient,
  employeeId: string,
  requestId: string
): Promise<number> {
  const policy = await getActivePolicy(prisma, employeeId);
  const existing = await prisma.leaveRequest.findMany({
    where: {
      employeeId,
      statut: { in: ["approuvee", "soumise"] },
      leaveType: { code: { not: "maladie" } },
    },
    include: { leaveType: true },
    orderBy: { dateDebut: "asc" },
  });

  const { byId } = computeDeductibles(existing, startOfDay(new Date()), policy);
  return byId.get(requestId) ?? 0;
}

export async function canApprove(
  prisma: PrismaClient,
  request: LeaveRequest & { employee: Employee },
  actorId: string
): Promise<boolean> {
  if (request.employeeId === actorId) return false; // un employé ne valide pas sa propre demande
  const employee = await prisma.employee.findUnique({ where: { id: actorId } });
  if (!employee) return false;
  if (employee.isActive === false) return false; // côté admin du cabinet
  // Le responsable direct est le manager ou n'importe quel utilisateur autre que l'employé
  return true;
}
