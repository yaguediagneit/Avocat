import { prisma } from "@/lib/prisma";
import { publicPrisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { serverHasPermission } from "@/lib/server-auth";
import { redirect } from "next/navigation";
import { DEFAULT_THEME, type LandingTheme } from "@/lib/theme";
import { ParametrageClient } from "./parametrage-client";
import { ParametrageCabinetClient } from "./parametrage-cabinet-client";
import { ParametrageRolesClient } from "./parametrage-roles-client";
import { ParametrageUsersClient } from "./parametrage-users-client";
import { ParametrageSpecialitesClient } from "./parametrage-specialites-client";
import { ParametrageComptabiliteClient } from "./parametrage-comptabilite-client";
import { ParametrageTacheTemplatesClient } from "./parametrage-tache-templates-client";
import { ParametrageModelesDocumentsClient } from "./parametrage-modeles-documents-client";
import { ParametrageAuditClient } from "./parametrage-audit-client";
import { ParametrageTabs } from "./parametrage-tabs";

const sectionIconPaths: Record<string, string> = {
  cabinet: "M3 21h18M5 21V7l8-4 8 4v14M9 21v-6h6v6",
  specialites: "M12 2l2.4 7.2h7.6l-6 4.8 2.4 7.2-6-4.8-6 4.8 2.4-7.2-6-4.8h7.6z",
  taches: "M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11",
  roles: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  utilisateurs:
    "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75",
  parametres:
    "M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.9 1.9 0 00.5 1.7l.1.1a1.9 1.9 0 01-2.7 2.7l-.1-.1a1.9 1.9 0 00-1.7-.5 1.9 1.9 0 00-1.1 1.1 1.9 1.9 0 01-3.7 0 1.9 1.9 0 00-1.1-1.1 1.9 1.9 0 00-1.7.5l-.1.1a1.9 1.9 0 01-2.7-2.7l.1-.1a1.9 1.9 0 00.5-1.7 1.9 1.9 0 00-1.1-1.1 1.9 1.9 0 010-3.7 1.9 1.9 0 001.1-1.1 1.9 1.9 0 00-.5-1.7l-.1-.1a1.9 1.9 0 012.7-2.7l.1.1a1.9 1.9 0 001.7.5 1.9 1.9 0 001.1-1.1 1.9 1.9 0 013.7 0 1.9 1.9 0 001.1 1.1 1.9 1.9 0 001.7-.5l.1-.1a1.9 1.9 0 012.7 2.7l-.1.1a1.9 1.9 0 00-.5 1.7 1.9 1.9 0 001.1 1.1 1.9 1.9 0 010 3.7z",
  comptabilite: "M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6",
  audit: "M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8",
  presentation: "M3 3h18v18H3zM8 8h8M8 12h8M8 16h5",
};

export default async function ParametragePage() {
  // Isolation : réservé aux administrateurs (permission parametres).
  if (!(await serverHasPermission("parametres", "read"))) {
    redirect("/cabinet");
  }

  const session = await getSession();

  const canWriteParams = await serverHasPermission("parametres", "write");
  if (canWriteParams) {
    const defaultCongesParams = [
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
      defaultCongesParams.map((p) =>
        prisma.parametre.upsert({
          where: { categorie_code: { categorie: "conges", code: p.code } },
          update: { libelle: p.libelle },
          create: { ...p, ordre: 0, actif: true },
        })
      )
    );

    const defaultContratClauses = [
      { categorie: "contrats", code: "clause_confidentialite", libelle: "" },
      { categorie: "contrats", code: "clause_non_concurrence", libelle: "" },
    ];
    await Promise.all(
      defaultContratClauses.map((p) =>
        prisma.parametre.upsert({
          where: { categorie_code: { categorie: p.categorie, code: p.code } },
          update: {},
          create: { ...p, ordre: 0, actif: true },
        })
      )
    );
  }

  const tenantId = session.tenantId || process.env.DEFAULT_TENANT_ID || "";

  const [parametres, roles, users, tenant, specialites, chargeCategories, tvaRates, payrollRubrics, accountMappings, tacheTemplates, auditLogs, clients, linkedClients, employees] = await Promise.all([
    prisma.parametre.findMany({
      orderBy: [{ categorie: "asc" }, { ordre: "asc" }, { libelle: "asc" }],
    }),
    prisma.role.findMany({
      orderBy: { nom: "asc" },
    }),
    prisma.user.findMany({
      include: { role: { select: { id: true, nom: true } } },
      orderBy: { nom: "asc" },
      take: 500,
    }),
    tenantId
      ? publicPrisma.tenant.findUnique({ where: { id: tenantId } })
      : null,
    prisma.specialite.findMany({
      where: { actif: true },
      orderBy: [{ ordre: "asc" }, { libelle: "asc" }],
      include: {
        typesDocuments: {
          where: { actif: true },
          orderBy: [{ ordre: "asc" }, { libelle: "asc" }],
        },
        workflowEtapes: {
          where: { actif: true },
          orderBy: [{ ordre: "asc" }],
        },
      },
    }),
    prisma.chargeCategory.findMany({ orderBy: [{ ordre: "asc" }, { label: "asc" }] }),
    prisma.tvaRate.findMany({ orderBy: { rate: "asc" } }),
    prisma.payrollRubric.findMany({ orderBy: [{ sortOrder: "asc" }, { label: "asc" }] }),
    prisma.accountMapping.findMany({ orderBy: { code: "asc" } }),
    prisma.tacheTemplate.findMany({
      where: { actif: true },
      orderBy: [{ ordre: "asc" }, { titre: "asc" }],
      include: {
        workflowEtape: { select: { id: true, code: true, libelle: true } },
      },
      // wordTemplateKey est inclus par défaut dans le select
    }),
    prisma.auditLog.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
    }),
    prisma.client.findMany({
      where: { actif: true },
      orderBy: { raisonSociale: "asc" },
      select: { id: true, type: true, raisonSociale: true, representants: true },
      take: 500,
    }),
    prisma.user.findMany({
      where: { clientId: { not: null } },
      select: { clientId: true },
    }),
    prisma.employee.findMany({
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      take: 500,
    }),
  ]);

  // Join manuel audit -> users pour afficher le nom au lieu de l'ID
  const auditUserIds = [...new Set((auditLogs as any[]).map((l) => l.userId).filter(Boolean) as string[])];
  const auditUsers = auditUserIds.length > 0
    ? await prisma.user.findMany({
        where: { id: { in: auditUserIds } },
        select: { id: true, prenom: true, nom: true },
      })
    : [];
  const auditUserMap = new Map(auditUsers.map((u) => [u.id, `${u.prenom} ${u.nom}`]));
  const auditLogsDto = (auditLogs as any[]).map((l) => ({
    ...l,
    userNom: l.userId ? auditUserMap.get(l.userId) || "Utilisateur supprimé" : null,
  }));

  const parametresDto = parametres.map((p: any) => ({
    id: p.id,
    categorie: p.categorie,
    code: p.code,
    libelle: p.libelle,
    ordre: p.ordre,
    actif: p.actif,
  }));

  const rolesDto = roles.map((r: any) => ({
    id: r.id,
    nom: r.nom,
    estAdmin: r.estAdmin,
    estClient: r.estClient,
    permissions: (r.permissions as Record<string, string[]>) || {},
  }));

  const usersDto = users.map((u: any) => ({
    id: u.id,
    prenom: u.prenom,
    nom: u.nom,
    titre: u.titre || "",
    specialite: u.specialite || "",
    email: u.email,
    roleId: u.roleId,
    role: u.role || { id: "", nom: "" },
    actif: u.actif,
    signatureKey: u.signatureKey,
  }));

  const linkedClientIds = new Set((linkedClients as any[]).map((u) => u.clientId).filter(Boolean));
  const availableClients = (clients as any[]).filter((c) => !linkedClientIds.has(c.id));

  const availableEmployees = (employees as any[]).filter(
    (e) => !e.email || !usersDto.some((u: any) => u.email === e.email)
  );

  const config = (tenant?.configuration as Record<string, unknown> | null) || {};

  const cabinetSettings = {
    id: tenant?.id || "",
    raisonSociale: tenant?.raisonSociale || "",
    description: String(config.description || "Cabinet Juridique Multidisciplinaire"),
    slogan: String(config.slogan || "Un accompagnement juridique rigoureux et confidentiel."),
    adresse: tenant?.adresse || "",
    identifiantFiscal: tenant?.identifiantFiscal || "",
    identificationLegale: String(config.identificationLegale || ""),
    telephonePrincipal: String(config.telephonePrincipal || ""),
    telephoneSecondaire: String(config.telephoneSecondaire || ""),
    email: String(config.email || ""),
    siteWeb: String(config.siteWeb || ""),
    logoUrl: tenant?.logoUrl || "",
    cachetUrl: String(config.cachetUrl || ""),
    presentationImage: String(config.presentationImage || ""),
    presentationTexte: String(config.presentationTexte || ""),
    landingImages: Array.isArray(config.landingImages) ? (config.landingImages as string[]) : [],
    valeurs: Array.isArray(config.valeurs) ? (config.valeurs as { titre: string; description: string }[]) : [],
    temoignages: Array.isArray(config.temoignages) ? (config.temoignages as { auteur: string; role: string; texte: string }[]) : [],
    hero: Array.isArray(config.hero)
      ? (config.hero as { titre: string; detail: string; couleur?: string; police?: string; tailleTitre?: string; tailleDetail?: string; cta?: string }[])
      : undefined,
    theme: (config.theme as LandingTheme | undefined) ?? DEFAULT_THEME,
    pdfTheme: (config.pdfTheme as any) ?? undefined,
  };

  const sections = [
    { id: "cabinet", label: "Cabinet & Présentation", icon: sectionIconPaths.cabinet, couleur: "#2563EB" },
    { id: "specialites", label: "Spécialités", icon: sectionIconPaths.specialites, couleur: "#D97706" },
    { id: "taches", label: "Modèles de tâches", icon: sectionIconPaths.taches, couleur: "#059669" },
    { id: "modeles", label: "Bibliothèque documents", icon: sectionIconPaths.presentation, couleur: "#0891B2" },
    { id: "roles", label: "Rôles", icon: sectionIconPaths.roles, couleur: "#0EA5E9" },
    { id: "utilisateurs", label: "Utilisateurs", icon: sectionIconPaths.utilisateurs, couleur: "#0284C7" },
    { id: "parametres", label: "Paramètres", icon: sectionIconPaths.parametres, couleur: "#64748B" },
    { id: "comptabilite", label: "Comptabilité", icon: sectionIconPaths.comptabilite, couleur: "#16A34A" },
    { id: "audit", label: "Audit", icon: sectionIconPaths.audit, couleur: "#DC2626" },
  ];

  return (
    <div className="space-y-6">
      <header className="print:hidden">
        <h1 className="font-display text-3xl font-bold text-cabinet-950">Paramétrage</h1>
        <p className="mt-1 text-sm text-cabinet-600/80">
          Gérez le cabinet, les rôles, les utilisateurs, les listes déroulantes et la comptabilité.
          Cliquez sur une feuille du classeur pour ouvrir la section correspondante.
        </p>
      </header>

      <ParametrageTabs sections={sections}>
        <ParametrageCabinetClient initialData={cabinetSettings as any} />

        <ParametrageSpecialitesClient initialSpecialites={specialites as any} />

        <ParametrageTacheTemplatesClient
          initialSpecialites={specialites as any}
          initialTemplates={tacheTemplates as any}
        />

        <ParametrageModelesDocumentsClient
          initialSpecialites={specialites as any}
          initialTemplates={tacheTemplates as any}
        />

        <div className="card space-y-4">
          <h2 className="text-lg font-semibold">Rôles et permissions</h2>
          <ParametrageRolesClient initialRoles={rolesDto as any} />
        </div>

        <ParametrageUsersClient initialUsers={usersDto as any} roles={rolesDto as any} clients={availableClients as any} employees={availableEmployees as any} />

        <ParametrageClient parametres={parametresDto} />

        <ParametrageComptabiliteClient
          initialChargeCategories={chargeCategories as any}
          initialTvaRates={tvaRates as any}
          initialPayrollRubrics={payrollRubrics as any}
          initialAccountMappings={accountMappings as any}
        />

        <ParametrageAuditClient initialLogs={auditLogsDto as any} />
      </ParametrageTabs>
    </div>
  );
}
