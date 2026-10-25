// Liste des tiers (comptes tiers) utilisables dans les écritures comptables :
// clients, employés, collaborateurs externes (huissiers, conseillers
// juridiques, clercs, architectes...), fournisseurs et charges.
// `type` est stocké dans `AccountingEntryLine.thirdPartyType` et `id` dans
// `thirdPartyId`.
import { estIntervenantExterne, type RoleInfo } from "./rbac";

export type TiersType = "client" | "fournisseur" | "employe" | "collaborateur" | "charge";

export interface TiersItem {
  type: TiersType;
  id: string;
  label: string;
  /// Code du compte comptable associé au tiers.
  accountCode?: string | null;
}

/// Mapping tières → compte parent SYSCOHADA (via AccountMapping actif ou fallback).
const TIERS_PARENTS: Record<TiersType, { mappingCode: string; fallbacks: string[] }> = {
  client: { mappingCode: "CUSTOMER_RECEIVABLE", fallbacks: ["411"] },
  fournisseur: { mappingCode: "SUPPLIER_PAYABLE", fallbacks: ["401"] },
  employe: { mappingCode: "SALARIES_PAYABLE", fallbacks: ["422"] },
  collaborateur: { mappingCode: "EXTERNAL_COLLABORATOR", fallbacks: ["467", "46"] },
  charge: { mappingCode: "", fallbacks: ["605"] },
};

/// Construit le libellé utilisé pour le compte auxiliaire d'une charge.
export function chargeAuxiliaryLabel(categoryLabel: string, supplierName?: string | null, description?: string | null) {
  const suffix = supplierName || description || "";
  return suffix ? `${categoryLabel} - ${suffix}` : categoryLabel;
}

export const TIERS_TYPES: { value: TiersType; label: string }[] = [
  { value: "client", label: "Client" },
  { value: "fournisseur", label: "Fournisseur" },
  { value: "employe", label: "Employé" },
  { value: "collaborateur", label: "Collaborateur externe" },
  { value: "charge", label: "Charge" },
];

export function tiersLabelOf(type: string): string {
  return TIERS_TYPES.find((t) => t.value === type)?.label ?? type;
}

/// Trouve ou crée un compte auxiliaire SYSCOHADA dédié au tiers
/// (ex. 41101 "Abdou Diouf" sous le compte parent 411).
export async function ensureAuxiliaryAccount(
  prisma: any,
  parentCodes: string[],
  label: string
): Promise<string | null> {
  let parent: any = null;
  for (const code of parentCodes) {
    parent = await prisma.accountingAccount.findUnique({ where: { accountCode: code } });
    if (parent) break;
  }
  if (!parent) return null;

  const existing = await prisma.accountingAccount.findFirst({
    where: { parentId: parent.id, label },
    select: { accountCode: true },
  });
  if (existing) return existing.accountCode;

  // Code suivant : compte parent + suffixe numérique (41101, 41102...)
  const siblings = await prisma.accountingAccount.findMany({
    where: { parentId: parent.id, accountCode: { startsWith: parent.accountCode } },
    select: { accountCode: true },
  });
  let maxSuffix = 0;
  for (const s of siblings) {
    const suffix = String(s.accountCode).slice(parent.accountCode.length);
    if (/^\d+$/.test(suffix)) maxSuffix = Math.max(maxSuffix, parseInt(suffix, 10));
  }
  const accountCode = `${parent.accountCode}${String(maxSuffix + 1).padStart(2, "0")}`;

  // Le parent est un compte collectif ; l'enfant est un compte auxiliaire.
  if ((parent.nature ?? "mouvementable") !== "collectif") {
    await prisma.accountingAccount.update({
      where: { id: parent.id },
      data: { nature: "collectif" },
    });
  }

  await prisma.accountingAccount.create({
    data: {
      accountCode,
      label,
      class: parent.class,
      subClass: parent.subClass,
      accountType: parent.accountType,
      level: (parent.level ?? 0) + 1,
      parentId: parent.id,
      isAuxiliary: true,
      nature: "auxiliaire",
      isActive: true,
    },
  });
  return accountCode;
}

/// Trouve ou crée le compte auxiliaire d'un tiers selon SYSCOHADA révisé
/// (ex. client "Abdou Diouf" → 41101).
export async function ensureTiersAccount(
  prisma: any,
  type: TiersType,
  label: string,
  extraParentCodes: string[] = []
): Promise<string | null> {
  const conf = TIERS_PARENTS[type];
  let mappedParent = "";
  if (conf.mappingCode) {
    const mapping = await prisma.accountMapping.findFirst({
      where: { isActive: true, code: conf.mappingCode },
      select: { accountCode: true },
    });
    mappedParent = mapping?.accountCode || "";
  }
  const parentCodes = [mappedParent, ...extraParentCodes, ...conf.fallbacks].filter(Boolean);
  return ensureAuxiliaryAccount(prisma, parentCodes, label);
}

export async function listTiers(prisma: any): Promise<TiersItem[]> {
  const [clients, employees, users, suppliers, charges, mappings] = await Promise.all([
    prisma.client.findMany({
      where: { actif: true },
      select: { id: true, raisonSociale: true },
      orderBy: { raisonSociale: "asc" },
    }),
    prisma.employee.findMany({
      where: { isActive: true },
      select: { id: true, firstName: true, lastName: true },
      orderBy: { lastName: "asc" },
    }),
    prisma.user.findMany({
      where: { actif: true },
      select: {
        id: true,
        prenom: true,
        nom: true,
        titre: true,
        role: {
          select: {
            id: true,
            nom: true,
            estAdmin: true,
            estClient: true,
            niveauConfidentialiteMax: true,
            permissions: true,
          },
        },
      },
    }),
    prisma.charge.findMany({
      where: { actif: true, supplierName: { not: null } },
      select: { supplierName: true },
      distinct: ["supplierName"],
    }),
    prisma.charge.findMany({
      where: { actif: true },
      select: {
        id: true,
        description: true,
        supplierName: true,
        category: { select: { label: true, accountCode: true } },
      },
      orderBy: { chargeDate: "desc" },
      take: 200,
    }),
    prisma.accountMapping.findMany({
      where: {
        isActive: true,
        code: {
          in: [
            "CUSTOMER_RECEIVABLE",
            "SUPPLIER_PAYABLE",
            "SALARIES_PAYABLE",
            "EXTERNAL_COLLABORATOR",
          ],
        },
      },
      select: { code: true, accountCode: true },
    }),
  ]);

  const mapCode = (code: string, fallback: string) =>
    mappings.find((m: any) => m.code === code)?.accountCode || fallback;

  const clientAccount = mapCode("CUSTOMER_RECEIVABLE", "411");
  const fournisseurAccount = mapCode("SUPPLIER_PAYABLE", "401");
  const employeAccount = mapCode("SALARIES_PAYABLE", "422");
  const collaborateurAccount = mapCode("EXTERNAL_COLLABORATOR", "467");

  const items: TiersItem[] = [];

  for (const c of clients) {
    const accountCode = await ensureAuxiliaryAccount(prisma, [clientAccount, "411"], c.raisonSociale);
    items.push({ type: "client", id: c.id, label: c.raisonSociale, accountCode });
  }

  for (const e of employees) {
    const accountCode = await ensureAuxiliaryAccount(prisma, [employeAccount, "422"], `${e.firstName} ${e.lastName}`);
    items.push({
      type: "employe",
      id: e.id,
      label: `${e.firstName} ${e.lastName}`,
      accountCode,
    });
  }

  for (const u of users) {
    const role: RoleInfo = {
      id: u.role.id,
      nom: u.role.nom,
      estAdmin: u.role.estAdmin,
      estClient: u.role.estClient,
      niveauConfidentialiteMax: u.role.niveauConfidentialiteMax,
      permissions: (u.role.permissions as Record<string, string[]>) || {},
    };
    if (!estIntervenantExterne(role)) continue;
    const name = [u.titre, u.prenom, u.nom].filter(Boolean).join(" ");
    const accountCode = await ensureAuxiliaryAccount(prisma, [collaborateurAccount, "467", "46"], name);
    items.push({
      type: "collaborateur",
      id: u.id,
      label: `${name} (${u.role.nom})`,
      accountCode,
    });
  }

  for (const s of suppliers) {
    const name = String(s.supplierName ?? "").trim();
    if (!name) continue;
    const accountCode = await ensureAuxiliaryAccount(prisma, [fournisseurAccount, "401"], name);
    items.push({ type: "fournisseur", id: name, label: name, accountCode });
  }

  for (const ch of charges) {
    const label = [
      ch.category?.label ?? "Charge",
      ch.supplierName || ch.description || "",
    ]
      .filter(Boolean)
      .join(" - ");
    const parentCode = ch.category?.accountCode ?? "605";
    const accountCode = await ensureAuxiliaryAccount(prisma, [parentCode, "605"], label);
    items.push({ type: "charge", id: ch.id, label, accountCode });
  }

  return items;
}

/// Construit une map `type:id` → label pour résoudre les libellés tiers
/// des lignes d'écriture.
export function tiersMapOf(tiers: TiersItem[]): Map<string, string> {
  return new Map(tiers.map((t) => [`${t.type}:${t.id}`, t.label]));
}
