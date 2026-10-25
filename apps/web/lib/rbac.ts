import { PrismaClient, Prisma } from "@prisma/client";

export interface PermissionCheck {
  resource: string;
  action: "read" | "write" | "validate" | "delete";
}

/// Informations de rôle résolues et réutilisables pour l'isolation.
export interface RoleInfo {
  id: string;
  nom: string;
  estAdmin: boolean;
  estClient: boolean;
  niveauConfidentialiteMax: number;
  permissions: Record<string, string[]>;
}

/// Résout un rôle par son nom et renvoie une vue exploitable côté isolation.
export async function getRoleByName(
  prisma: PrismaClient,
  roleName: string
): Promise<RoleInfo | null> {
  const role = await prisma.role.findUnique({ where: { nom: roleName } });
  if (!role) return null;
  return {
    id: role.id,
    nom: role.nom,
    estAdmin: role.estAdmin,
    estClient: role.estClient,
    niveauConfidentialiteMax: role.niveauConfidentialiteMax,
    permissions: (role.permissions as Record<string, string[]>) || {},
  };
}

export async function checkRolePermission(
  prisma: PrismaClient,
  roleName: string,
  resource: string,
  action: string
): Promise<boolean> {
  const role = await getRoleByName(prisma, roleName);
  if (!role) return false;
  return hasPermission(role, resource, action);
}

/// Variante pure (sans rechargement du rôle) de la vérification de permission.
export function hasPermission(
  role: RoleInfo,
  resource: string,
  action: string
): boolean {
  // Les administrateurs (associés / directeurs) ont un accès complet.
  if (role.estAdmin) return true;
  const allowed = role.permissions[resource] || [];
  return allowed.includes(action) || allowed.includes("*");
}

/// Indique si le rôle correspond à un intervenant externe au cabinet
/// (huissier de justice, architecte, collaborateur externe...) : ces rôles
/// ont accès aux dossiers/missions mais pas la permission `documents`.
/// Ils ne voient que les documents explicitement partagés (`partageExterne`).
export function estIntervenantExterne(role: RoleInfo): boolean {
  if (role.estAdmin || role.estClient) return false;
  return !hasPermission(role, "documents", "read");
}

/// Renvoie l'ensemble des identifiants de dossiers accessibles à un utilisateur.
/// `all: true` signifie que l'utilisateur voit tous les dossiers (administrateur).
/// Sinon `ids` contient la liste explicite des dossiers visibles.
export async function getAccessibleDossierIds(
  prisma: PrismaClient,
  userId: string,
  role: RoleInfo
): Promise<{ ids: string[]; all: boolean }> {
  if (role.estAdmin) return { ids: [], all: true };

  const [asAvocat, asHuissier, asCreateur, asCollab, asPerm] = await Promise.all([
    prisma.dossier.findMany({
      where: { avocatResponsableId: userId },
      select: { id: true },
    }),
    prisma.dossier.findMany({
      where: { huissierResponsableId: userId },
      select: { id: true },
    }),
    prisma.dossier.findMany({
      where: { createurId: userId },
      select: { id: true },
    }),
    prisma.dossierCollaborateur.findMany({
      where: { userId },
      select: { dossierId: true },
    }),
    prisma.permissionDossier.findMany({
      where: { userId },
      select: { dossierId: true },
    }),
  ]);

  // Déduplication sans itération de Set (compatible target ES5).
  const seen: Record<string, true> = {};
  const ids: string[] = [];
  const push = (id: string) => {
    if (id && !seen[id]) {
      seen[id] = true;
      ids.push(id);
    }
  };
  asAvocat.forEach((d) => push(d.id));
  asHuissier.forEach((d) => push(d.id));
  asCreateur.forEach((d) => push(d.id));
  asCollab.forEach((c) => push(c.dossierId));
  asPerm.forEach((p) => push(p.dossierId));

  return { ids, all: false };
}

/// Construit un filtre Prisma (`where`) pour `Dossier.findMany` restreignant
/// la liste aux dossiers visibles par l'utilisateur (accès + niveau de
/// confidentialité). Les administrateurs reçoivent `{}` (tout voir).
export async function getDossierAccessFilter(
  prisma: PrismaClient,
  userId: string,
  role: RoleInfo
): Promise<Prisma.DossierWhereInput> {
  if (role.estAdmin) return {};

  const { ids } = await getAccessibleDossierIds(prisma, userId, role);
  return {
    id: { in: ids },
    niveauConfidentialite: { lte: role.niveauConfidentialiteMax },
  };
}

/// Vérifie l'accès d'un utilisateur à un dossier précis, en tenant compte
/// du niveau de confidentialité du dossier et de la matrice RACI / responsables.
export async function checkDossierAccess(
  prisma: PrismaClient,
  userId: string,
  dossierId: string,
  required: "read" | "write" | "validate"
): Promise<boolean> {
  const dossier = await prisma.dossier.findUnique({
    where: { id: dossierId },
    select: {
      avocatResponsableId: true,
      huissierResponsableId: true,
      createurId: true,
      collaborateurs: true,
      niveauConfidentialite: true,
    },
  });

  if (!dossier) return false;

  // 1. Niveau de confidentialité : vérifié en amont par le rôle de l'utilisateur.
  //    (La responsabilité de ce filtre incombe au rôle résolu ; on l'applique
  //    ici également pour les appels directs à checkDossierAccess.)

  // 2. Accès direct via responsables et créateur.
  if (dossier.avocatResponsableId === userId) return true;
  if (dossier.huissierResponsableId === userId) return true;
  if (dossier.createurId === userId) return true;

  // 3. Matrice RACI (table dédiée).
  const collab = await prisma.dossierCollaborateur.findFirst({
    where: { dossierId, userId },
  });
  if (collab) {
    // R/A = write+validate, C = read, I = read
    if (required === "read") return true;
    if ((collab.roleRACI === "R" || collab.roleRACI === "A") && required === "write") {
      return true;
    }
    if (collab.roleRACI === "R" && required === "validate") return true;
  }

  // 4. PermissionDossier explicite (niveau read/write/validate).
  const permission = await prisma.permissionDossier.findFirst({
    where: { dossierId, userId },
  });

  if (!permission) return false;

  const niveaux = ["read", "write", "validate"];
  const requiredIndex = niveaux.indexOf(required);
  const userIndex = niveaux.indexOf(permission.niveau as any);

  return userIndex >= requiredIndex;
}

/// Vérifie l'accès à un dossier en intégrant le rôle (admin bypass + niveau
/// de confidentialité). À utiliser dans les routes API et les Server Components.
export async function canAccessDossier(
  prisma: PrismaClient,
  userId: string,
  role: RoleInfo,
  dossierId: string,
  required: "read" | "write" | "validate" = "read"
): Promise<boolean> {
  if (role.estAdmin) return true;

  const dossier = await prisma.dossier.findUnique({
    where: { id: dossierId },
    select: { niveauConfidentialite: true, statut: true },
  });
  if (!dossier) return false;

  if (dossier.niveauConfidentialite > role.niveauConfidentialiteMax) return false;

  // Un dossier clôturé ou archivé n'est accessible qu'à l'administrateur.
  if (dossier.statut === "Clôturé" || dossier.statut === "Archivé") return false;

  return checkDossierAccess(prisma, userId, dossierId, required);
}

/// Renvoie un filtre Prisma pour `Client.findMany` restreignant aux clients
/// ayant au moins un dossier accessible à l'utilisateur.
///
/// Règle d'isolation :
/// - Administrateurs : tous les clients.
/// - Fonctionnaires cabinet (permission `clients` sans `dossiers`, ex. Secrétaire) :
///   tous les clients (leur travail couvre tout le cabinet).
/// - Rôles métier dossier : clients des dossiers accessibles seulement.
export async function getClientAccessFilter(
  prisma: PrismaClient,
  userId: string,
  role: RoleInfo
): Promise<Prisma.ClientWhereInput> {
  if (role.estAdmin) return {};

  const canReadClients = hasPermission(role, "clients", "read");
  const canReadDossiers = hasPermission(role, "dossiers", "read");
  if (canReadClients && !canReadDossiers) return {};

  const { ids } = await getAccessibleDossierIds(prisma, userId, role);
  if (ids.length === 0) {
    // Aucun dossier accessible => aucun client visible.
    return { id: { in: [] } };
  }
  const dossiers = await prisma.dossier.findMany({
    where: {
      id: { in: ids },
      niveauConfidentialite: { lte: role.niveauConfidentialiteMax },
    },
    select: { clientId: true },
    distinct: ["clientId"],
  });
  return { id: { in: dossiers.map((d) => d.clientId) } };
}

/// Renvoie un filtre Prisma pour les ressources liées à un dossier
/// (Document, Tache, Evenement, MissionHuissier, Facture) restreignant
/// aux dossiers accessibles.
///
/// Règle d'isolation :
/// - Les administrateurs voient tout.
/// - Les rôles "fonctionnels cabinet" (qui ont la permission sur la ressource
///   mais PAS sur les dossiers — ex. Comptable, Secrétaire, Auditeur) voient
///   toutes les ressources de leur domaine (leur travail couvre tout le cabinet).
/// - Les rôles "métier dossier" (qui ont la permission `dossiers`) sont isolés
///   par dossier accessible + niveau de confidentialité.
export async function getDossierScopedAccessFilter(
  prisma: PrismaClient,
  userId: string,
  role: RoleInfo,
  resource: string
): Promise<{ dossierId: { in: string[] } } | {}> {
  if (role.estAdmin) return {};

  const canReadResource = hasPermission(role, resource, "read");
  const canReadDossiers = hasPermission(role, "dossiers", "read");

  // Fonctionnaire cabinet : permission sur la ressource mais pas sur les dossiers.
  if (canReadResource && !canReadDossiers) return {};

  const { ids } = await getAccessibleDossierIds(prisma, userId, role);
  if (ids.length === 0) {
    return { dossierId: { in: [] } };
  }
  // On restreint en plus par niveau de confidentialité du dossier.
  const visible = await prisma.dossier.findMany({
    where: {
      id: { in: ids },
      niveauConfidentialite: { lte: role.niveauConfidentialiteMax },
    },
    select: { id: true },
  });
  return { dossierId: { in: visible.map((d) => d.id) } };
}
