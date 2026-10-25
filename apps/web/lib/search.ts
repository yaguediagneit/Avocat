import { MeiliSearch } from "meilisearch";
import { PrismaClient } from "@prisma/client";
import {
  estIntervenantExterne,
  getAccessibleDossierIds,
  getClientAccessFilter,
  getDossierAccessFilter,
  getDossierScopedAccessFilter,
  hasPermission,
  RoleInfo,
} from "./rbac";
import { clientDossierFilter } from "./client-access";

export const SEARCH_SCOPES = [
  "clients",
  "dossiers",
  "documents",
  "taches",
  "missions",
  "factures",
  "charges",
  "users",
  "evenements",
  "employes",
  "conges",
  "contrats",
  "paie",
  "assurances",
  "courrier",
  "audiences",
  "demandes",
  "pieces",
  "formalites",
  "prestataires",
  "ecritures",
  "comptes",
  "parametres",
] as const;

export type SearchScope = (typeof SEARCH_SCOPES)[number];

export function emptySearchResults(): Record<SearchScope, SearchResult[]> {
  return Object.fromEntries(SEARCH_SCOPES.map((s) => [s, []])) as unknown as Record<
    SearchScope,
    SearchResult[]
  >;
}

export interface SearchResult {
  id: string;
  type: SearchScope | "client" | "dossier";
  title: string;
  subtitle: string;
  href: string;
  dossierId?: string;
}

export interface SearchFilters {
  q: string;
  scopes?: SearchScope[];
  limit?: number;
}

export interface SearchContext {
  prisma: PrismaClient;
  userId: string;
  role: RoleInfo;
  isClient: boolean;
  clientId?: string;
}

let meiliClient: MeiliSearch | null = null;
let meiliChecked = false;

function getMeiliClient(): MeiliSearch | null {
  if (meiliChecked) return meiliClient;
  meiliChecked = true;
  const rawHost = process.env.MEILISEARCH_HOST;
  if (!rawHost) return null;
  const host = rawHost.replace("//localhost:", "//127.0.0.1:");
  try {
    meiliClient = new MeiliSearch({
      host,
      apiKey: process.env.MEILISEARCH_API_KEY,
    });
    return meiliClient;
  } catch {
    meiliClient = null;
    return null;
  }
}

function normalizeQuery(q: string): string {
  return q.trim().toLowerCase();
}

function makeTerms(q: string): string[] {
  return q.split(/\s+/).filter(Boolean);
}

function nest(path: string, leaf: any): any {
  const parts = path.split(".");
  let obj: any = leaf;
  for (let i = parts.length - 1; i >= 0; i--) {
    obj = { [parts[i]]: obj };
  }
  return obj;
}

function fieldContains(path: string, term: string): any {
  return nest(path, { contains: term, mode: "insensitive" });
}

/// Variante pour une relation to-many : "lines.libelle" devient
/// { lines: { some: { libelle: { contains: term } } } }.
function fieldSomeContains(path: string, term: string): any {
  const parts = path.split(".");
  const last = parts.pop()!;
  let obj: any = { some: { [last]: { contains: term, mode: "insensitive" } } };
  for (let i = parts.length - 1; i >= 0; i--) {
    obj = { [parts[i]]: obj };
  }
  return obj;
}

function termSomeOr(paths: string[], q: string): any {
  const terms = makeTerms(q);
  if (terms.length === 0) return {};
  return terms.flatMap((t) => paths.map((p) => fieldSomeContains(p, t)));
}

function termOr(fields: string[], q: string): any {
  const terms = makeTerms(q);
  if (terms.length === 0) return {};
  return terms.flatMap((t) => fields.map((f) => fieldContains(f, t)));
}

/* ------------------------------------------------------------------ */
/* Recherche des tables de liste (SearchInput ?q=)                      */
/* ------------------------------------------------------------------ */

/// Recherche multi-mots pour les listes : la requête est découpée en mots
/// et CHAQUE mot doit matcher au moins un champ (AND entre mots, OR entre
/// champs) — « diop divorce » retrouve le dossier de Diop en divorce.
/// `fields` accepte les chemins imbriqués ("client.raisonSociale") et les
/// relations to-many via ".some." ("lines.some.description").
/// `extra` permet d'ajouter des clauses par mot (codes de libellés,
/// égalités numériques, IDs utilisateurs…).
export function tableSearchWhere(
  q: string,
  fields: string[],
  extra?: (term: string) => any[]
): { AND?: { OR: any[] }[] } {
  const terms = makeTerms(q);
  if (!terms.length) return {};
  return {
    AND: terms.map((t) => ({
      OR: [...fields.map((f) => fieldContains(f, t)), ...(extra?.(t) ?? [])],
    })),
  };
}

/// Codes dont le code ou le libellé affiché contient le terme — permet de
/// retrouver une ligne par le libellé français d'une colonne qui stocke un
/// code (« Signification » → typeActe "signification", « Correspondance » →
/// categorie "correspondance"…).
export function codesMatchingLabel(
  term: string,
  labels: Record<string, string>
): string[] {
  const t = term.toLowerCase();
  return Object.keys(labels).filter(
    (c) => c.toLowerCase().includes(t) || labels[c].toLowerCase().includes(t)
  );
}

/// Terme numérique (« 150000 », « 150 000 », « 150000,50 ») → nombre,
/// sinon null. Sert à ajouter une égalité sur les colonnes montant.
export function numericTerm(term: string): number | null {
  const n = Number(term.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/// Égalités numériques sur les champs listés (chemins imbriqués et
/// ".some." acceptés) quand le terme est un nombre.
export function numericClauses(term: string, fields: string[]): any[] {
  const n = numericTerm(term);
  if (n === null) return [];
  return fields.map((f) => nest(f, { equals: n }));
}

/// Terme date → intervalle [gte, lt). Formats acceptés : « 2025 » (année),
/// « 03/2025 » ou « 2025-03 » (mois), « 15/03/2025 » / « 15-03-2025 » /
/// « 15.03.2025 » / « 2025-03-15 » (jour).
export function dateTerm(term: string): { gte: Date; lt: Date } | null {
  const t = term.trim();
  let m = t.match(/^(\d{4})$/);
  if (m) {
    const y = Number(m[1]);
    return y >= 1900 && y <= 2100
      ? { gte: new Date(y, 0, 1), lt: new Date(y + 1, 0, 1) }
      : null;
  }
  m =
    t.match(/^(\d{1,2})[/.\-](\d{4})$/) ||
    t.match(/^(\d{4})[/.\-](\d{1,2})$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    const [month, year] = a > 100 ? [b, a] : [a, b];
    if (month >= 1 && month <= 12 && year >= 1900 && year <= 2100) {
      return { gte: new Date(year, month - 1, 1), lt: new Date(year, month, 1) };
    }
    return null;
  }
  m = t.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/);
  if (m) {
    const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
      return { gte: new Date(y, mo - 1, d), lt: new Date(y, mo - 1, d + 1) };
    }
    return null;
  }
  m = t.match(/^(\d{4})[/.\-](\d{1,2})[/.\-](\d{1,2})$/);
  if (m) {
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
      return { gte: new Date(y, mo - 1, d), lt: new Date(y, mo - 1, d + 1) };
    }
  }
  return null;
}

/// Intervalles de dates sur les champs listés quand le terme est une date —
/// rend cherchables les colonnes de dates (soumis, échéance, émission…).
export function dateClauses(term: string, fields: string[]): any[] {
  const range = dateTerm(term);
  if (!range) return [];
  return fields.map((f) => nest(f, range));
}

/// Égalités booléennes sur les champs listés quand le terme est un mot-clé.
/// Défaut : « oui »/« non » (+ yes/no, vrai/faux, true/false) ; `words`
/// permet des libellés métier (« payée »/« impayée », « immobilisation »…).
export function boolClauses(
  term: string,
  fields: string[],
  words?: { true?: string[]; false?: string[] }
): any[] {
  const t = term.toLowerCase();
  const tW = words?.true ?? ["oui", "yes", "vrai", "true"];
  const fW = words?.false ?? ["non", "no", "faux", "false"];
  const b = tW.includes(t) ? true : fW.includes(t) ? false : null;
  if (b === null) return [];
  return fields.map((f) => nest(f, { equals: b }));
}

/// Utilisateurs dont le prénom, le nom ou l'email matche au moins un mot de
/// la requête — pré-chargé une fois puis filtré par mot via
/// userIdsMatchingTerm. Sert à chercher sur les colonnes userId sans relation
/// Prisma (responsableId, huissierId, creePar…).
export async function usersMatchingQuery(prisma: PrismaClient, q: string) {
  const terms = makeTerms(normalizeQuery(q));
  if (!terms.length) return [];
  return prisma.user.findMany({
    where: {
      OR: terms.flatMap((t) => [
        fieldContains("prenom", t),
        fieldContains("nom", t),
        fieldContains("email", t),
      ]),
    },
    select: { id: true, prenom: true, nom: true, email: true },
    take: 200,
  });
}

/// IDs des utilisateurs (extraits de usersMatchingQuery) dont le nom complet
/// ou l'email contient le terme. Liste vide → la clause `{ in: [] }` ne
/// matche rien.
export function userIdsMatchingTerm(
  users: { id: string; prenom: string; nom: string; email?: string | null }[],
  term: string
): string[] {
  const t = term.toLowerCase();
  return users
    .filter((u) =>
      `${u.prenom} ${u.nom} ${u.email || ""}`.toLowerCase().includes(t)
    )
    .map((u) => u.id);
}

/// Clause de recherche multi-mots du journal d'audit : action, entité,
/// ID d'entité, adresse IP et utilisateur (par nom ou email, via userId).
/// Partagée entre /api/audit et /api/audit/export.
export async function auditSearchWhere(prisma: PrismaClient, q: string) {
  const users = await usersMatchingQuery(prisma, q);
  return tableSearchWhere(
    q,
    ["action", "entite", "entiteId", "adresseIp", "userId"],
    (t) => [
      { userId: { in: userIdsMatchingTerm(users, t) } },
      ...dateClauses(t, ["createdAt"]),
    ]
  );
}

function jsonTermOr(paths: string[], q: string): any {
  const terms = makeTerms(q);
  if (terms.length === 0) return {};
  return terms.flatMap((t) =>
    paths.map((path) => ({
      metadata: { path: [path], string_contains: t },
    }))
  );
}

export async function searchAll(
  ctx: SearchContext,
  filters: SearchFilters
): Promise<Record<SearchScope, SearchResult[]>> {
  const q = normalizeQuery(filters.q);
  if (!q || q.length < 2) {
    return emptySearchResults();
  }

  const scopes = filters.scopes || [...SEARCH_SCOPES];
  const limit = Math.min(filters.limit || 20, 100);

  const meili = getMeiliClient();
  if (meili) {
    try {
      // L'index ne couvre que MEILI_SCOPES : les autres scopes sont
      // complétés en SQL et fusionnés dans le même objet de résultat.
      const meiliScopes = scopes.filter((s) =>
        (MEILI_SCOPES as readonly string[]).includes(s)
      );
      const sqlScopes = scopes.filter(
        (s) => !(MEILI_SCOPES as readonly string[]).includes(s)
      );
      const results = meiliScopes.length
        ? await searchMeili(ctx, q, meiliScopes, limit, meili)
        : emptySearchResults();
      if (sqlScopes.length) {
        const sqlResults = await searchSql(ctx, q, sqlScopes, limit);
        for (const s of sqlScopes) results[s] = sqlResults[s];
      }
      return results;
    } catch (e) {
      console.warn("Meilisearch search failed, falling back to SQL:", e);
    }
  }

  return await searchSql(ctx, q, scopes, limit);
}

/// Scopes présents dans l'index Meilisearch (cf. scripts/index-meilisearch.ts).
const MEILI_SCOPES = [
  "clients",
  "dossiers",
  "documents",
  "taches",
  "missions",
  "factures",
  "charges",
] as const;

/// Ressource RBAC associée à chaque scope indexé (miroir du chemin SQL).
const MEILI_RESOURCE: Record<string, string> = {
  clients: "clients",
  dossiers: "dossiers",
  documents: "documents",
  taches: "taches",
  missions: "missions",
  factures: "factures",
  charges: "comptabilite",
};

async function searchMeili(
  ctx: SearchContext,
  q: string,
  scopes: SearchScope[],
  limit: number,
  client: MeiliSearch
): Promise<Record<SearchScope, SearchResult[]>> {
  const { prisma, role, userId, isClient, clientId } = ctx;
  const results = emptySearchResults();

  const index = client.index("search");
  const { hits } = await index.search(q, {
    limit: limit * 3,
    attributesToRetrieve: ["id", "type", "title", "subtitle", "href", "dossierId"],
  });
  const typedHits = hits as unknown as SearchResult[];

  // L'index Meilisearch n'applique pas l'isolation : les hits sont filtrés
  // ici comme le ferait le chemin SQL (dossiers accessibles + confidentialité,
  // clients liés aux dossiers visibles, clients → leurs dossiers uniquement).
  let dossierSet: Set<string> | null = null;
  let clientSet: Set<string> | null = null;
  const canReadDossiers = hasPermission(role, "dossiers", "read");

  if (isClient) {
    const ds = await prisma.dossier.findMany({
      where: clientDossierFilter(userId, clientId),
      select: { id: true },
    });
    dossierSet = new Set(ds.map((d) => d.id));
  } else if (!role.estAdmin) {
    const { ids } = await getAccessibleDossierIds(prisma, userId, role);
    const visible = ids.length
      ? await prisma.dossier.findMany({
          where: {
            id: { in: ids },
            niveauConfidentialite: { lte: role.niveauConfidentialiteMax },
          },
          select: { id: true },
        })
      : [];
    dossierSet = new Set(visible.map((d) => d.id));

    const clientHitIds = typedHits
      .filter((h) => h.type === "clients")
      .map((h) => String(h.id).replace(/^client-/, ""));
    if (clientHitIds.length) {
      const cf = await getClientAccessFilter(prisma, userId, role);
      const ok = await prisma.client.findMany({
        where: { ...cf, id: { in: clientHitIds } },
        select: { id: true },
      });
      clientSet = new Set(ok.map((c) => c.id));
    }
  }

  for (const hit of typedHits) {
    const type = hit.type as SearchScope;
    if (!scopes.includes(type) || !(MEILI_SCOPES as readonly string[]).includes(type))
      continue;
    // L'index existant contient encore /cabinet/taches/{id} (route inexistante) :
    // on reconstruit le lien vers la page de modification.
    if (type === "taches" && hit.id) {
      hit.href = `/cabinet/taches/${String(hit.id).replace(/^tache-/, "")}/modifier`;
    }
    if (isClient) {
      // Espace client : seules les ressources de ses propres dossiers.
      if (!hit.dossierId || !dossierSet!.has(hit.dossierId)) continue;
    } else if (dossierSet) {
      const fonctionnel =
        hasPermission(role, MEILI_RESOURCE[type] || "", "read") &&
        !canReadDossiers;
      if (!fonctionnel) {
        if (hit.dossierId) {
          if (!dossierSet.has(hit.dossierId)) continue;
        } else if (type === "clients") {
          if (clientSet && !clientSet.has(String(hit.id).replace(/^client-/, "")))
            continue;
        } else continue;
      }
    }
    if (results[type].length < limit) results[type].push(hit);
  }

  return results;
}

async function searchSql(
  ctx: SearchContext,
  q: string,
  scopes: SearchScope[],
  limit: number
): Promise<Record<SearchScope, SearchResult[]>> {
  const { prisma, role, userId, isClient, clientId } = ctx;
  const out = emptySearchResults();

  if (isClient) {
    const clientScopes = scopes.filter((s) =>
      ["dossiers", "documents", "taches", "missions", "factures", "evenements"].includes(s)
    );
    for (const scope of clientScopes) {
      const res = await searchClientScope(ctx, q, scope, limit);
      out[scope] = res;
    }
    return out;
  }

  if (scopes.includes("clients")) {
    const clientFilter = await getClientAccessFilter(prisma, userId, role);
    const clients = await prisma.client.findMany({
      where: {
        ...clientFilter,
        OR: termOr(["raisonSociale", "identifiant", "adresse"], q),
      },
      take: limit,
      orderBy: { raisonSociale: "asc" },
      select: { id: true, raisonSociale: true, type: true, identifiant: true },
    });
    out.clients = clients.map((c) => ({
      id: c.id,
      type: "clients",
      title: c.raisonSociale,
      subtitle: c.identifiant || c.type,
      href: `/cabinet/clients/${c.id}`,
    }));
  }

  if (scopes.includes("dossiers")) {
    const dossierFilter = await getDossierAccessFilter(prisma, userId, role);
    const dossiers = await prisma.dossier.findMany({
      where: {
        ...dossierFilter,
        OR: termOr(["referenceInterne", "typeAffaire", "statut", "client.raisonSociale"], q),
      },
      take: limit,
      orderBy: { dateOuverture: "desc" },
      include: { client: { select: { raisonSociale: true } } },
    });
    out.dossiers = dossiers.map((d) => ({
      id: d.id,
      type: "dossiers",
      title: d.referenceInterne,
      subtitle: `${d.client.raisonSociale} — ${d.typeAffaire}`,
      href: `/cabinet/dossiers/${d.id}`,
      dossierId: d.id,
    }));
  }

  if (scopes.includes("documents")) {
    const scopeFilter = await getDossierScopedAccessFilter(prisma, userId, role, "documents");
    const docs = await prisma.document.findMany({
      where: {
        ...scopeFilter,
        OR: [
          ...termOr(["nom", "categorie", "dossier.referenceInterne", "dossier.client.raisonSociale"], q),
          ...jsonTermOr(["typeDocument", "titre", "description", "objet", "reference", "motif"], q),
        ],
      },
      take: limit,
      orderBy: { createdAt: "desc" },
      include: { dossier: { select: { referenceInterne: true } } },
    });
    out.documents = docs.map((d) => ({
      id: d.id,
      type: "documents",
      title: d.nom,
      subtitle: `${d.dossier.referenceInterne} — ${d.categorie}`,
      href: `/cabinet/documents/${d.id}`,
      dossierId: d.dossierId,
    }));
  }

  if (scopes.includes("taches")) {
    const scopeFilter = await getDossierScopedAccessFilter(prisma, userId, role, "taches");
    const taches = await prisma.tache.findMany({
      where: {
        ...scopeFilter,
        OR: termOr(["titre", "description", "statut", "dossier.referenceInterne"], q),
      },
      take: limit,
      orderBy: { echeance: "asc" },
      include: { dossier: { select: { referenceInterne: true } } },
    });
    out.taches = taches.map((t) => ({
      id: t.id,
      type: "taches",
      title: t.titre,
      subtitle: `${t.dossier.referenceInterne} — ${t.statut}`,
      href: `/cabinet/taches/${t.id}/modifier`,
      dossierId: t.dossierId,
    }));
  }

  if (scopes.includes("missions")) {
    const scopeFilter = await getDossierScopedAccessFilter(prisma, userId, role, "missions");
    const baseWhere = {
      ...scopeFilter,
      OR: termOr(["typeActe", "destinataire", "statut", "dossier.referenceInterne"], q),
    };
    const [huissier, architecte, conseiller, clerc] = await Promise.all([
      prisma.missionHuissier.findMany({ where: baseWhere, take: limit, include: { dossier: { select: { referenceInterne: true } } } }),
      prisma.missionArchitecte.findMany({ where: baseWhere, take: limit, include: { dossier: { select: { referenceInterne: true } } } }),
      prisma.missionConseillerJuridique.findMany({ where: baseWhere, take: limit, include: { dossier: { select: { referenceInterne: true } } } }),
      prisma.missionClerc.findMany({ where: baseWhere, take: limit, include: { dossier: { select: { referenceInterne: true } } } }),
    ]);
    out.missions = [
      ...huissier.map((m: any) => toMissionResult(m, "Huissier", "/cabinet/missions/profession/huissier")),
      ...architecte.map((m: any) => toMissionResult(m, "Architecte", "/cabinet/missions/profession/architecte")),
      ...conseiller.map((m: any) => toMissionResult(m, "Conseiller juridique", "/cabinet/missions/profession/conseiller-juridique")),
      ...clerc.map((m: any) => toMissionResult(m, "Clerc", "/cabinet/missions/profession/clerc")),
    ].slice(0, limit);
  }

  if (scopes.includes("factures")) {
    const scopeFilter = await getDossierScopedAccessFilter(prisma, userId, role, "factures");
    const factures = await prisma.facture.findMany({
      where: {
        ...scopeFilter,
        OR: termOr(["numero", "libelle", "designation", "client.raisonSociale", "dossier.referenceInterne"], q),
      },
      take: limit,
      orderBy: { dateEmission: "desc" },
      include: { client: { select: { raisonSociale: true } }, dossier: { select: { referenceInterne: true } } },
    });
    out.factures = factures.map((f) => ({
      id: f.id,
      type: "factures",
      title: f.numero,
      subtitle: `${f.client.raisonSociale} — ${f.statut}`,
      href: `/cabinet/factures/${f.id}`,
      dossierId: f.dossierId || undefined,
    }));
  }

  if (scopes.includes("charges")) {
    if (role.estAdmin || hasPermission(role, "comptabilite", "read")) {
      const charges = await prisma.charge.findMany({
        where: {
          OR: termOr(["description", "supplierName", "supplierInvoiceRef", "category.label"], q),
        },
        take: limit,
        orderBy: { chargeDate: "desc" },
        include: { category: { select: { label: true } } },
      });
      out.charges = charges.map((c) => ({
        id: c.id,
        type: "charges",
        title: c.description || c.category?.label || "Charge",
        subtitle: `${c.supplierName || "—"} — ${(c.totalHt ?? 0) + (c.taxAmount ?? 0) || c.amount} €`,
        href: `/cabinet/charges/${c.id}`,
      }));
    }
  }

  if (scopes.includes("users")) {
    const users = await prisma.user.findMany({
      where: {
        actif: true,
        OR: termOr(["prenom", "nom", "email", "titre", "specialite", "role.nom"], q),
      },
      take: limit,
      orderBy: [{ nom: "asc" }, { prenom: "asc" }],
      include: { role: { select: { nom: true } } },
    });
    out.users = users.map((u) => ({
      id: u.id,
      type: "users",
      title: `${u.prenom} ${u.nom}`,
      subtitle: `${u.email}${u.titre ? ` — ${u.titre}` : ""}${u.role?.nom ? ` — ${u.role.nom}` : ""}`,
      href: "/cabinet/parametrage",
    }));
  }

  if (scopes.includes("evenements")) {
    const scopeFilter = await getDossierScopedAccessFilter(prisma, userId, role, "rendezVous");
    const events = await prisma.evenement.findMany({
      where: {
        AND: [
          { OR: [{ type: "journal" }, scopeFilter] },
          {
            OR: termOr(["titre", "lieu", "type", "dossier.referenceInterne"], q),
          },
        ],
      },
      take: limit,
      orderBy: { dateDebut: "desc" },
      include: { dossier: { select: { referenceInterne: true } } },
    });
    out.evenements = events.map((e) => ({
      id: e.id,
      type: "evenements",
      title: e.titre,
      subtitle: `${e.dossier?.referenceInterne ? `${e.dossier.referenceInterne} — ` : ""}${e.type} — ${new Date(e.dateDebut).toLocaleString("fr-FR")}`,
      href: e.dossierId ? `/cabinet/calendrier/${e.id}/modifier` : "/cabinet/calendrier",
      dossierId: e.dossierId || undefined,
    }));
  }

  // Domaines de la recherche : les domaines "comptabilité" (personnel, paie,
  // finances) suivent la même permission que leurs pages ; les domaines
  // "administration" suivent la permission dossiers utilisée par leurs API.
  const canCompta = role.estAdmin || hasPermission(role, "comptabilite", "read");
  const canDossiers =
    (role.estAdmin || hasPermission(role, "dossiers", "read")) &&
    !estIntervenantExterne(role);

  if (scopes.includes("employes") && canCompta) {
    const rows = await prisma.employee.findMany({
      where: {
        OR: termOr(
          ["firstName", "lastName", "employeeCode", "position", "department", "email", "phone", "cnssNumber", "ipresNumber"],
          q
        ),
      },
      take: limit,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: { id: true, firstName: true, lastName: true, employeeCode: true, position: true, isActive: true },
    });
    out.employes = rows.map((e) => ({
      id: e.id,
      type: "employes",
      title: `${e.firstName} ${e.lastName}`,
      subtitle: `${e.employeeCode}${e.position ? ` — ${e.position}` : ""}${e.isActive ? "" : " — Inactif"}`,
      href: `/cabinet/personnel/${e.id}`,
    }));
  }

  if (scopes.includes("paie") && canCompta) {
    const rows = await prisma.payroll.findMany({
      where: {
        OR: termOr(["employee.firstName", "employee.lastName", "employee.employeeCode"], q),
      },
      take: limit,
      orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }],
      include: { employee: { select: { firstName: true, lastName: true } } },
    });
    out.paie = rows.map((p) => ({
      id: p.id,
      type: "paie",
      title: `Bulletin ${p.periodMonth}/${p.periodYear} — ${p.employee.firstName} ${p.employee.lastName}`,
      subtitle: `Net ${p.netSalary.toLocaleString("fr-FR")} F — ${p.status}`,
      href: `/cabinet/personnel?m=${p.periodMonth}&y=${p.periodYear}#derniers-bulletins`,
    }));
  }

  if (scopes.includes("conges") && canCompta) {
    const rows = await prisma.leaveRequest.findMany({
      where: {
        OR: termOr(["employee.firstName", "employee.lastName", "leaveType.libelle", "motif", "statut"], q),
      },
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        employee: { select: { firstName: true, lastName: true } },
        leaveType: { select: { libelle: true } },
      },
    });
    out.conges = rows.map((l) => ({
      id: l.id,
      type: "conges",
      title: `${l.employee.firstName} ${l.employee.lastName} — ${l.leaveType.libelle}`,
      subtitle: `${new Date(l.dateDebut).toLocaleDateString("fr-FR")} → ${new Date(l.dateFin).toLocaleDateString("fr-FR")} — ${l.statut}`,
      href: "/cabinet/personnel/conges",
    }));
  }

  if (scopes.includes("contrats") && canCompta) {
    const rows = await prisma.employmentContract.findMany({
      where: {
        OR: termOr(
          ["typeContrat", "fonction", "service", "objet", "lieuTravail", "employee.firstName", "employee.lastName"],
          q
        ),
      },
      take: limit,
      orderBy: { createdAt: "desc" },
      include: { employee: { select: { firstName: true, lastName: true } } },
    });
    out.contrats = rows.map((c) => ({
      id: c.id,
      type: "contrats",
      title: `${c.employee.firstName} ${c.employee.lastName} — ${c.typeContrat}`,
      subtitle: `${c.fonction || c.service || "—"} — ${c.statut}`,
      href: `/cabinet/personnel/contrats/${c.id}/imprimer`,
    }));
  }

  if (scopes.includes("assurances") && canCompta) {
    const [insurers, providers, contracts, invoices] = await Promise.all([
      prisma.insurer.findMany({
        where: { OR: termOr(["nom", "referenceInterne", "email", "telephone", "managerNom"], q) },
        take: limit,
        select: { id: true, nom: true, statut: true, referenceInterne: true },
      }),
      prisma.medicalProvider.findMany({
        where: { OR: termOr(["nom", "email", "telephone", "typePrestataire"], q) },
        take: limit,
        select: { id: true, nom: true, statut: true, typePrestataire: true },
      }),
      prisma.insuranceContract.findMany({
        where: { OR: termOr(["reference", "insurer.nom"], q) },
        take: limit,
        include: { insurer: { select: { nom: true } } },
      }),
      prisma.medicalInvoice.findMany({
        where: {
          OR: termOr(
            ["referenceInterne", "numeroFacture", "typeSoin", "provider.nom", "insuredEmployee.employee.firstName", "insuredEmployee.employee.lastName"],
            q
          ),
        },
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          provider: { select: { nom: true } },
          insuredEmployee: { include: { employee: { select: { firstName: true, lastName: true } } } },
        },
      }),
    ]);
    out.assurances = [
      ...insurers.map((i) => ({
        id: i.id,
        type: "assurances" as const,
        title: i.nom,
        subtitle: `Assureur${i.referenceInterne ? ` — ${i.referenceInterne}` : ""} — ${i.statut}`,
        href: "/cabinet/personnel/assurances",
      })),
      ...providers.map((p) => ({
        id: p.id,
        type: "assurances" as const,
        title: p.nom,
        subtitle: `Prestataire de soins${p.typePrestataire ? ` — ${p.typePrestataire}` : ""} — ${p.statut}`,
        href: "/cabinet/personnel/assurances",
      })),
      ...contracts.map((c) => ({
        id: c.id,
        type: "assurances" as const,
        title: `Police ${c.reference}`,
        subtitle: `${c.insurer.nom} — ${c.typeCouverture}`,
        href: "/cabinet/personnel/assurances",
      })),
      ...invoices.map((m) => ({
        id: m.id,
        type: "assurances" as const,
        title: `Facture ${m.numeroFacture || m.referenceInterne}`,
        subtitle: `${m.insuredEmployee.employee.firstName} ${m.insuredEmployee.employee.lastName} — ${m.provider.nom} — ${m.statut}`,
        href: "/cabinet/personnel/assurances",
      })),
    ].slice(0, limit);
  }

  if (scopes.includes("courrier") && canDossiers) {
    const rows = await prisma.mail.findMany({
      where: {
        OR: termOr(["subject", "reference", "structure", "contact", "dossierLabel"], q),
      },
      take: limit,
      orderBy: { mailDate: "desc" },
      select: { id: true, subject: true, direction: true, structure: true, contact: true, status: true, mailDate: true },
    });
    out.courrier = rows.map((m) => ({
      id: m.id,
      type: "courrier",
      title: m.subject,
      subtitle: `${m.direction === "entrant" ? "Entrant" : "Sortant"} — ${m.structure || m.contact || "—"} — ${new Date(m.mailDate).toLocaleDateString("fr-FR")}`,
      href: "/cabinet/administration/courrier",
    }));
  }

  if (scopes.includes("audiences") && canDossiers) {
    const rows = await prisma.hearing.findMany({
      where: {
        OR: termOr(["title", "location", "attendees", "type", "notes"], q),
      },
      take: limit,
      orderBy: { date: "desc" },
      select: { id: true, title: true, type: true, location: true, date: true, status: true },
    });
    out.audiences = rows.map((h) => ({
      id: h.id,
      type: "audiences",
      title: h.title,
      subtitle: `${h.type === "reunion" ? "Réunion" : "Audience"}${h.location ? ` — ${h.location}` : ""} — ${new Date(h.date).toLocaleDateString("fr-FR")}`,
      href: "/cabinet/administration/audiences",
    }));
  }

  if (scopes.includes("demandes") && canDossiers) {
    const [requests, calls] = await Promise.all([
      prisma.clientRequest.findMany({
        where: {
          OR: termOr(["subject", "description", "requesterName", "requesterEmail", "requesterPhone"], q),
        },
        take: limit,
        orderBy: { createdAt: "desc" },
        select: { id: true, subject: true, type: true, requesterName: true, status: true },
      }),
      prisma.callLog.findMany({
        where: { OR: termOr(["contactName", "structure", "subject", "notes"], q) },
        take: limit,
        orderBy: { callDate: "desc" },
        select: { id: true, subject: true, contactName: true, structure: true, callDate: true, direction: true },
      }),
    ]);
    out.demandes = [
      ...requests.map((r) => ({
        id: r.id,
        type: "demandes" as const,
        title: r.subject,
        subtitle: `Demande ${r.type}${r.requesterName ? ` — ${r.requesterName}` : ""} — ${r.status}`,
        href: "/cabinet/administration/demandes",
      })),
      ...calls.map((c) => ({
        id: c.id,
        type: "demandes" as const,
        title: c.subject || `Appel ${c.direction === "entrant" ? "entrant" : "sortant"}`,
        subtitle: `${c.contactName || c.structure || "—"} — ${new Date(c.callDate).toLocaleDateString("fr-FR")}`,
        href: "/cabinet/administration/demandes",
      })),
    ].slice(0, limit);
  }

  if (scopes.includes("pieces") && canDossiers) {
    const scopeFilter = await getDossierScopedAccessFilter(prisma, userId, role, "dossiers");
    const rows = await prisma.missingDocument.findMany({
      where: {
        ...scopeFilter,
        OR: termOr(["typeDocument", "description", "notes"], q),
      },
      take: limit,
      orderBy: { createdAt: "desc" },
      select: { id: true, typeDocument: true, status: true, dossierId: true },
    });
    const dossierRefs = new Map(
      (
        await prisma.dossier.findMany({
          where: { id: { in: rows.map((r) => r.dossierId) } },
          select: { id: true, referenceInterne: true },
        })
      ).map((d) => [d.id, d.referenceInterne])
    );
    out.pieces = rows.map((m) => ({
      id: m.id,
      type: "pieces",
      title: m.typeDocument,
      subtitle: `${dossierRefs.get(m.dossierId) || "—"} — ${m.status}`,
      href: "/cabinet/administration/pieces-manquantes",
      dossierId: m.dossierId,
    }));
  }

  if (scopes.includes("formalites") && canDossiers) {
    const scopeFilter = await getDossierScopedAccessFilter(prisma, userId, role, "dossiers");
    const rows = await prisma.courtFormality.findMany({
      where: {
        AND: [
          Object.keys(scopeFilter).length === 0
            ? {}
            : { OR: [{ dossierId: null }, scopeFilter] },
          { OR: termOr(["title", "entity", "type", "notes"], q) },
        ],
      },
      take: limit,
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, entity: true, type: true, status: true, dossierId: true },
    });
    out.formalites = rows.map((f) => ({
      id: f.id,
      type: "formalites",
      title: f.title,
      subtitle: `${f.entity} — ${f.status}`,
      href: "/cabinet/administration/formalites",
      dossierId: f.dossierId || undefined,
    }));
  }

  if (scopes.includes("prestataires") && canDossiers) {
    const scopeFilter = await getDossierScopedAccessFilter(prisma, userId, role, "dossiers");
    const rows = await prisma.providerMission.findMany({
      where: {
        AND: [
          Object.keys(scopeFilter).length === 0
            ? {}
            : { OR: [{ dossierId: null }, scopeFilter] },
          { OR: termOr(["providerName", "reference", "description", "profession", "notes"], q) },
        ],
      },
      take: limit,
      orderBy: { createdAt: "desc" },
      select: { id: true, providerName: true, profession: true, reference: true, status: true, dossierId: true },
    });
    out.prestataires = rows.map((p) => ({
      id: p.id,
      type: "prestataires",
      title: p.providerName,
      subtitle: `${p.profession}${p.reference ? ` — ${p.reference}` : ""} — ${p.status}`,
      href: "/cabinet/administration/missions",
      dossierId: p.dossierId || undefined,
    }));
  }

  if (scopes.includes("ecritures") && canCompta) {
    const rows = await prisma.accountingEntry.findMany({
      where: {
        OR: [
          ...termOr(["libelle", "reference", "journal.code", "journal.label"], q),
          ...termSomeOr(["lines.libelle", "lines.reference"], q),
        ],
      },
      take: limit,
      orderBy: { entryDate: "desc" },
      include: { journal: { select: { code: true } } },
    });
    out.ecritures = rows.map((e) => ({
      id: e.id,
      type: "ecritures",
      title: `${e.journal.code} — ${e.libelle}`,
      subtitle: `${e.reference ? `${e.reference} — ` : ""}${new Date(e.entryDate).toLocaleDateString("fr-FR")} — ${e.totalDebit.toLocaleString("fr-FR")} F`,
      href: "/cabinet/comptabilite/ecritures",
    }));
  }

  if (scopes.includes("comptes") && canCompta) {
    const rows = await prisma.accountingAccount.findMany({
      where: {
        isActive: true,
        OR: termOr(["accountCode", "label"], q),
      },
      take: limit,
      orderBy: { accountCode: "asc" },
      select: { id: true, accountCode: true, label: true, class: true, accountType: true },
    });
    out.comptes = rows.map((a) => ({
      id: a.id,
      type: "comptes",
      title: `${a.accountCode} — ${a.label}`,
      subtitle: `Classe ${a.class} — ${a.accountType}`,
      href: "/cabinet/comptabilite/plan",
    }));
  }

  if (scopes.includes("parametres") && role.estAdmin) {
    const [parametres, specialites] = await Promise.all([
      prisma.parametre.findMany({
        where: { OR: termOr(["libelle", "code", "categorie"], q) },
        take: limit,
        orderBy: [{ categorie: "asc" }, { ordre: "asc" }],
        select: { id: true, libelle: true, code: true, categorie: true },
      }),
      prisma.specialite.findMany({
        where: { OR: termOr(["libelle", "code"], q) },
        take: limit,
        select: { id: true, libelle: true, code: true, selectionnee: true },
      }),
    ]);
    out.parametres = [
      ...parametres.map((p) => ({
        id: p.id,
        type: "parametres" as const,
        title: p.libelle,
        subtitle: `${p.categorie} — ${p.code}`,
        href: "/cabinet/parametrage",
      })),
      ...specialites.map((s) => ({
        id: s.id,
        type: "parametres" as const,
        title: s.libelle,
        subtitle: `Spécialité — ${s.code}${s.selectionnee ? "" : " (non sélectionnée)"}`,
        href: "/cabinet/parametrage",
      })),
    ].slice(0, limit);
  }

  return out;
}

function toMissionResult(
  m: any,
  profession: string,
  baseHref: string
): SearchResult {
  return {
    id: m.id,
    type: "missions",
    title: m.typeActe,
    subtitle: `${m.dossier.referenceInterne} — ${profession} — ${m.statut}`,
    href: `${baseHref}/${m.id}`,
    dossierId: m.dossierId,
  };
}

async function searchClientScope(
  ctx: SearchContext,
  q: string,
  scope: SearchScope,
  limit: number
): Promise<SearchResult[]> {
  const { prisma, userId, clientId } = ctx;
  const dossierFilter = clientDossierFilter(userId, clientId);

  if (scope === "dossiers") {
    const dossiers = await prisma.dossier.findMany({
      where: {
        ...dossierFilter,
        OR: termOr(["referenceInterne", "typeAffaire", "statut"], q),
      },
      take: limit,
      include: { client: { select: { raisonSociale: true } } },
    });
    return dossiers.map((d) => ({
      id: d.id,
      type: "dossiers",
      title: d.referenceInterne,
      subtitle: `${d.client.raisonSociale} — ${d.typeAffaire}`,
      href: `/client/dossiers/${d.id}`,
      dossierId: d.id,
    }));
  }

  if (scope === "documents") {
    const dossiers = await prisma.dossier.findMany({
      where: dossierFilter,
      select: { id: true },
    });
    const dossierIds = dossiers.map((d) => d.id);
    const docs = await prisma.document.findMany({
      where: {
        dossierId: { in: dossierIds },
        publieClient: true,
        OR: [
          ...termOr(["nom", "categorie"], q),
          ...jsonTermOr(["typeDocument", "titre", "description"], q),
        ],
      },
      take: limit,
      include: { dossier: { select: { referenceInterne: true } } },
    });
    return docs.map((d) => ({
      id: d.id,
      type: "documents",
      title: d.nom,
      subtitle: `${d.dossier.referenceInterne} — ${d.categorie}`,
      href: `/client/documents/${d.id}`,
      dossierId: d.dossierId,
    }));
  }

  if (scope === "taches") {
    const dossiers = await prisma.dossier.findMany({
      where: dossierFilter,
      select: { id: true },
    });
    const taches = await prisma.tache.findMany({
      where: {
        dossierId: { in: dossiers.map((d) => d.id) },
        OR: termOr(["titre", "description", "statut"], q),
      },
      take: limit,
      include: { dossier: { select: { referenceInterne: true } } },
    });
    return taches.map((t) => ({
      id: t.id,
      type: "taches",
      title: t.titre,
      subtitle: `${t.dossier.referenceInterne} — ${t.statut}`,
      href: `/client/dossiers/${t.dossierId}`,
      dossierId: t.dossierId,
    }));
  }

  if (scope === "missions") {
    const dossiers = await prisma.dossier.findMany({
      where: dossierFilter,
      select: { id: true },
    });
    const baseWhere = {
      dossierId: { in: dossiers.map((d) => d.id) },
      OR: termOr(["typeActe", "destinataire", "statut"], q),
    };
    const [huissier, architecte, conseiller, clerc] = await Promise.all([
      prisma.missionHuissier.findMany({ where: baseWhere, take: limit, include: { dossier: { select: { referenceInterne: true } } } }),
      prisma.missionArchitecte.findMany({ where: baseWhere, take: limit, include: { dossier: { select: { referenceInterne: true } } } }),
      prisma.missionConseillerJuridique.findMany({ where: baseWhere, take: limit, include: { dossier: { select: { referenceInterne: true } } } }),
      prisma.missionClerc.findMany({ where: baseWhere, take: limit, include: { dossier: { select: { referenceInterne: true } } } }),
    ]);
    return [
      ...huissier.map((m: any) => toMissionResult(m, "Huissier", "/client/dossiers")),
      ...architecte.map((m: any) => toMissionResult(m, "Architecte", "/client/dossiers")),
      ...conseiller.map((m: any) => toMissionResult(m, "Conseiller juridique", "/client/dossiers")),
      ...clerc.map((m: any) => toMissionResult(m, "Clerc", "/client/dossiers")),
    ]
      .slice(0, limit)
      .map((r) => ({ ...r, href: r.dossierId ? `${r.href}/${r.dossierId}` : r.href }));
  }

  if (scope === "factures") {
    const dossiers = await prisma.dossier.findMany({
      where: dossierFilter,
      select: { id: true },
    });
    const factures = await prisma.facture.findMany({
      where: {
        dossierId: { in: dossiers.map((d) => d.id) },
        OR: termOr(["numero", "libelle", "designation"], q),
      },
      take: limit,
      include: { client: { select: { raisonSociale: true } } },
    });
    return factures.map((f) => ({
      id: f.id,
      type: "factures",
      title: f.numero,
      subtitle: `${f.client.raisonSociale} — ${f.statut}`,
      href: `/client/factures/${f.id}`,
      dossierId: f.dossierId || undefined,
    }));
  }

  if (scope === "evenements") {
    const dossiers = await prisma.dossier.findMany({
      where: dossierFilter,
      select: { id: true },
    });
    const dossierIds = dossiers.map((d) => d.id);
    const events = await prisma.evenement.findMany({
      where: {
        estPublicClient: true,
        AND: [
          { OR: [{ dossierId: { in: dossierIds } }, { dossierId: null }] },
          {
            OR: termOr(["titre", "lieu", "type"], q),
          },
        ],
      },
      take: limit,
      orderBy: { dateDebut: "desc" },
      include: { dossier: { select: { referenceInterne: true } } },
    });
    return events.map((e) => ({
      id: e.id,
      type: "evenements",
      title: e.titre,
      subtitle: `${e.type} — ${new Date(e.dateDebut).toLocaleString("fr-FR")}`,
      href: e.dossierId ? `/client/dossiers/${e.dossierId}` : "/client",
      dossierId: e.dossierId || undefined,
    }));
  }

  return [];
}
