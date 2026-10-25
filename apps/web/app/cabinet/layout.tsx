import { prisma, publicPrisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getRoleByName, hasPermission, RoleInfo } from "@/lib/rbac";
import { isSuperAdmin } from "@/lib/superadmin";
import { CabinetShell, ShellNavGroup } from "@/components/cabinet-shell";

interface NavItemDef {
  href: string;
  label: string;
  exact?: boolean;
  /// Permission requise (resource + action) pour afficher le lien.
  /// `null`/absent = visible par tout utilisateur authentifié du cabinet.
  permission?: { resource: string; action: "read" | "write" } | null;
}

interface NavGroupDef {
  id: string;
  label: string;
  icon: string;
  items: NavItemDef[];
}

const TOP_ITEMS: NavItemDef[] = [
  { href: "/cabinet", label: "Tableau de bord", exact: true, permission: null },
];

const NAV_GROUPS: NavGroupDef[] = [
  {
    id: "pilotage",
    label: "Pilotage",
    icon: "pilotage",
    items: [
      { href: "/cabinet/alertes", label: "Alertes", permission: null },
      { href: "/cabinet/calendrier", label: "Calendrier", permission: { resource: "rendezVous", action: "read" } },
      { href: "/cabinet/taches", label: "Tâches", permission: null },
    ],
  },
  {
    id: "cabinet",
    label: "Cabinet",
    icon: "📁",
    items: [
      { href: "/cabinet/dossiers", label: "Dossiers", permission: { resource: "dossiers", action: "read" } },
      { href: "/cabinet/clients", label: "Clients", permission: { resource: "clients", action: "read" } },
      { href: "/cabinet/missions", label: "Missions", permission: { resource: "missions", action: "read" } },
      { href: "/cabinet/documents", label: "Documents", permission: { resource: "documents", action: "read" } },
    ],
  },
  {
    id: "personnel",
    label: "Personnel",
    icon: "personnel",
    items: [
      { href: "/cabinet/personnel", label: "Employés & Paie", exact: true, permission: { resource: "comptabilite", action: "read" } },
      { href: "/cabinet/personnel/conges", label: "Congés", permission: { resource: "comptabilite", action: "read" } },
      { href: "/cabinet/personnel/contrats", label: "Contrats", permission: { resource: "comptabilite", action: "read" } },
      { href: "/cabinet/personnel/assurances", label: "Assurances", permission: { resource: "comptabilite", action: "read" } },
    ],
  },
  {
    id: "comptabilite",
    label: "Comptabilité",
    icon: "💰",
    items: [
      { href: "/cabinet/comptabilite", label: "Pilotage", exact: true, permission: { resource: "comptabilite", action: "read" } },
      { href: "/cabinet/charges", label: "Charges", permission: { resource: "comptabilite", action: "read" } },
      { href: "/cabinet/factures", label: "Factures", permission: { resource: "factures", action: "read" } },
      { href: "/cabinet/paiements-intervenants", label: "Paiements intervenants", permission: { resource: "comptabilite", action: "read" } },
      { href: "/cabinet/comptabilite/versements", label: "Versements sociaux et fiscaux", permission: { resource: "comptabilite", action: "read" } },
      { href: "/cabinet/comptabilite/rapport", label: "Rapport financier", permission: { resource: "comptabilite", action: "read" } },
      { href: "/cabinet/comptabilite/ecritures", label: "Écritures", permission: { resource: "comptabilite", action: "read" } },
      { href: "/cabinet/comptabilite/journaux", label: "Journaux", permission: { resource: "comptabilite", action: "read" } },
      { href: "/cabinet/comptabilite/plan", label: "Plan comptable", permission: { resource: "comptabilite", action: "read" } },
      { href: "/cabinet/comptabilite/tiers", label: "Tiers", permission: { resource: "comptabilite", action: "read" } },
      { href: "/cabinet/comptabilite/grand-livre", label: "Grand livre", permission: { resource: "comptabilite", action: "read" } },
      { href: "/cabinet/comptabilite/bilan", label: "Bilan", permission: { resource: "comptabilite", action: "read" } },
      { href: "/cabinet/comptabilite/resultat", label: "Compte de résultat", permission: { resource: "comptabilite", action: "read" } },
    ],
  },
  {
    id: "administration",
    label: "Administration",
    icon: "🏢",
    items: [
      { href: "/cabinet/administration/demandes", label: "Demandes clients" },
      { href: "/cabinet/administration/pieces-manquantes", label: "Pièces manquantes" },
      { href: "/cabinet/administration/audiences", label: "Audiences & réunions" },
      { href: "/cabinet/administration/formalites", label: "Formalités tribunaux" },
      { href: "/cabinet/administration/missions", label: "Missions prestataires" },
      { href: "/cabinet/administration/contrats", label: "Contrats & actes" },
      { href: "/cabinet/administration/courrier", label: "Courrier" },
    ],
  },
];

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  const tenantId = session.tenantId || process.env.DEFAULT_TENANT_ID || "";
  const tenant = tenantId
    ? await publicPrisma.tenant.findUnique({
        where: { id: tenantId },
        select: { raisonSociale: true, logoUrl: true, configuration: true },
      })
    : null;
  const tenantConfig = (tenant?.configuration as Record<string, unknown> | null) || {};
  const tenantSlogan = String(tenantConfig.slogan || "");

  const user = session.userId
    ? await prisma.user.findUnique({
        where: { id: session.userId },
        select: { prenom: true, nom: true, roleId: true, role: { select: { nom: true, estAdmin: true, permissions: true, estClient: true, niveauConfidentialiteMax: true } } },
      })
    : null;

  // Résolution du rôle pour filtrer la navigation selon les permissions.
  let roleInfo: RoleInfo | null = null;
  if (user?.role) {
    roleInfo = {
      id: user.roleId || "",
      nom: user.role.nom,
      estAdmin: user.role.estAdmin,
      estClient: user.role.estClient,
      niveauConfidentialiteMax: user.role.niveauConfidentialiteMax,
      permissions: (user.role.permissions as Record<string, string[]>) || {},
    };
  }

  const permitted = (l: NavItemDef) => {
    if (!l.permission) return true;
    if (!roleInfo) return false;
    return hasPermission(roleInfo, l.permission.resource, l.permission.action);
  };

  const topItems = TOP_ITEMS.filter(permitted).map(({ href, label, exact }) => ({ href, label, exact }));
  const groups: ShellNavGroup[] = NAV_GROUPS.map((g) => ({
    id: g.id,
    label: g.label,
    icon: g.icon,
    items: g.items.filter(permitted).map(({ href, label, exact }) => ({ href, label, exact })),
  })).filter((g) => g.items.length > 0);

  const estSuperAdmin = await isSuperAdmin(session.email || "");

  return (
    <CabinetShell
      tenantName={tenant?.raisonSociale || "Cabinet"}
      tenantLogoUrl={tenant?.logoUrl || null}
      tenantSlogan={tenantSlogan}
      userName={user ? `${user.prenom} ${user.nom}` : "Utilisateur"}
      userRole={user?.role?.nom || ""}
      userInitials={user ? `${user.prenom.charAt(0)}${user.nom.charAt(0)}` : "?"}
      topItems={topItems}
      groups={groups}
      showParametrage={!!user?.role?.estAdmin}
      estSuperAdmin={estSuperAdmin}
    >
      {children}
    </CabinetShell>
  );
}
