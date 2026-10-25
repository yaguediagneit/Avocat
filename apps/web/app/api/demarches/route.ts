import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";
import { getDossierScopedAccessFilter, canAccessDossier } from "@/lib/rbac";
import { tableSearchWhere } from "@/lib/search";
import { logAudit } from "@/lib/audit";
import {
  DEMARCHE_STATUTS,
  formatDemarcheReference,
  qualificationComplete,
} from "@/lib/demarches";
import { z } from "zod";

const createSchema = z.object({
  typeCode: z.string().min(1),
  sousType: z.string().optional().nullable(),
  dossierId: z.string().uuid(),
  demandeurId: z.string().uuid().optional().nullable(),
  mandataireId: z.string().uuid().optional().nullable(),
  parcelleId: z.string().uuid().optional().nullable(),
  autoriteId: z.string().uuid().optional().nullable(),
  autoriteLibre: z.string().optional().nullable(),
  adresseDepot: z.string().optional().nullable(),
  contactAutorite: z.string().optional().nullable(),
  objet: z.string().optional().nullable(),
  finalite: z.string().optional().nullable(),
  fondement: z.string().optional().nullable(),
  referenceActes: z.string().optional().nullable(),
  qualification: z.record(z.string(), z.any()).optional().nullable(),
  urgent: z.boolean().optional(),
  dateLimite: z.string().optional().nullable(),
  priorite: z.enum(["BASSE", "NORMALE", "HAUTE", "URGENTE"]).optional(),
  risque: z.enum(["STANDARD", "ELEVE"]).optional(),
  responsableId: z.string().uuid().optional().nullable(),
  assistanteId: z.string().uuid().optional().nullable(),
  agentLiaisonId: z.string().uuid().optional().nullable(),
  honoraires: z.number().int().optional(),
  debours: z.number().int().optional(),
  taxes: z.number().int().optional(),
  timbres: z.number().int().optional(),
  avancesRecues: z.number().int().optional(),
  coDemandeurs: z.array(z.string().uuid()).optional(),
});

export async function GET(req: NextRequest) {
  const ctx = await guard(req);
  if (ctx instanceof NextResponse) return ctx;

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || "";
  const statut = searchParams.get("statut") || "";
  const typeId = searchParams.get("typeId") || "";
  const dossierId = searchParams.get("dossierId") || "";

  const scopeFilter = await getDossierScopedAccessFilter(
    ctx.prisma,
    ctx.userId,
    ctx.roleInfo,
    "demarches"
  );

  const demarches = await ctx.prisma.demarche.findMany({
    where: {
      ...scopeFilter,
      archiveLe: null,
      ...(statut ? { statut } : {}),
      ...(typeId ? { typeId } : {}),
      ...(dossierId ? { dossierId } : {}),
      ...tableSearchWhere(q, [
        "reference",
        "objet",
        "statut",
        "sousType",
        "type.libelle",
        "dossier.referenceInterne",
        "dossier.client.raisonSociale",
        "demandeur.nom",
        "demandeur.raisonSociale",
        "autorite.nom",
        "parcelle.commune",
        "parcelle.nicad",
      ]),
    },
    include: {
      type: { select: { code: true, libelle: true, famille: true } },
      dossier: { select: { id: true, referenceInterne: true, client: { select: { raisonSociale: true } } } },
      demandeur: { select: { id: true, nom: true, prenoms: true, raisonSociale: true, typePersonne: true } },
      autorite: { select: { id: true, nom: true } },
      parcelle: { select: { id: true, commune: true, nicad: true, titreFoncier: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 300,
  });

  return NextResponse.json(demarches);
}

export async function POST(req: NextRequest) {
  const ctx = await guard(req, { resource: "demarches", action: "write" });
  if (ctx instanceof NextResponse) return ctx;

  try {
    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const data = parsed.data;

    const type = await ctx.prisma.demarcheType.findUnique({
      where: { code: data.typeCode },
      include: { pieces: { where: { actif: true }, orderBy: { ordre: "asc" } } },
    });
    if (!type || !type.actif) {
      return NextResponse.json({ error: "Type de démarche inconnu ou inactif" }, { status: 400 });
    }

    // Le rattachement à un dossier juridique est obligatoire : il porte la
    // GED, l'isolation RBAC et le niveau de confidentialité.
    const dossierOk = await canAccessDossier(
      ctx.prisma, ctx.userId, ctx.roleInfo, data.dossierId, "write"
    );
    if (!dossierOk) {
      return NextResponse.json({ error: "Accès interdit à ce dossier" }, { status: 403 });
    }

    if (type.parcelleRequise && !data.parcelleId) {
      // Toléré à la création : la parcelle peut être complétée pendant la
      // qualification, mais jamais avant le dépôt (contrôlé à la transition).
    }

    // Statut initial : A_QUALIFIER pour les démarches ambiguës dont la
    // qualification n'est pas complète, sinon BROUILLON.
    const statutInitial =
      type.qualificationObligatoire &&
      !qualificationComplete(
        {
          sousType: data.sousType ?? null,
          objet: data.objet ?? null,
          demandeurId: data.demandeurId ?? null,
          autoriteId: data.autoriteId ?? null,
          autoriteLibre: data.autoriteLibre ?? null,
        },
        type
      ).complete
        ? "A_QUALIFIER"
        : "BROUILLON";

    const annee = new Date().getFullYear();
    let demarche = null;
    // Référence séquentielle par année, avec reprise en cas de collision.
    for (let tentative = 0; tentative < 5 && !demarche; tentative++) {
      const compte = await ctx.prisma.demarche.count({
        where: { reference: { startsWith: `DEM-${annee}-` } },
      });
      const reference = formatDemarcheReference(annee, compte + 1 + tentative);
      try {
        demarche = await ctx.prisma.$transaction(async (tx) => {
          const created = await tx.demarche.create({
            data: {
              reference,
              typeId: type.id,
              sousType: data.sousType || null,
              statut: statutInitial,
              priorite: data.priorite || "NORMALE",
              risque: data.risque || (type.sensible ? "ELEVE" : "STANDARD"),
              dossierId: data.dossierId,
              demandeurId: data.demandeurId || null,
              mandataireId: data.mandataireId || null,
              parcelleId: data.parcelleId || null,
              autoriteId: data.autoriteId || null,
              autoriteLibre: data.autoriteLibre || null,
              adresseDepot: data.adresseDepot || null,
              contactAutorite: data.contactAutorite || null,
              objet: data.objet || null,
              finalite: data.finalite || null,
              fondement: data.fondement || null,
              referenceActes: data.referenceActes || null,
              qualification: (data.qualification as any) ?? null,
              urgent: data.urgent ?? false,
              dateLimite: data.dateLimite ? new Date(data.dateLimite) : null,
              responsableId: data.responsableId || null,
              assistanteId: data.assistanteId || null,
              agentLiaisonId: data.agentLiaisonId || null,
              honoraires: data.honoraires ?? 0,
              debours: data.debours ?? 0,
              taxes: data.taxes ?? 0,
              timbres: data.timbres ?? 0,
              avancesRecues: data.avancesRecues ?? 0,
              creePar: ctx.userId,
            },
          });
          // La check-list du type est matérialisée sur la démarche.
          if (type.pieces.length) {
            await tx.demarchePiece.createMany({
              data: type.pieces.map((p) => ({
                demarcheId: created.id,
                code: p.code,
                libelle: p.libelle,
                categorie: p.categorie,
                niveau: p.niveau,
                condition: p.condition,
                sourceAttendue: p.sourceAttendue,
                ordre: p.ordre,
              })),
            });
          }
          // Co-demandeurs / bénéficiaires éventuels.
          if (data.coDemandeurs?.length) {
            await tx.demarchePartie.createMany({
              data: data.coDemandeurs.map((demandeurId, i) => ({
                demarcheId: created.id,
                demandeurId,
                role: "CO_DEMANDEUR",
                ordre: i,
              })),
              skipDuplicates: true,
            });
          }
          await tx.demarcheEvenement.create({
            data: {
              demarcheId: created.id,
              type: "CHANGEMENT_STATUT",
              description: `Création de la démarche (${DEMARCHE_STATUTS.includes(statutInitial as any) ? statutInitial : statutInitial})`,
              details: { statut: statutInitial, typeCode: type.code },
              creePar: ctx.userId,
            },
          });
          return created;
        });
      } catch (e: any) {
        if (e?.code === "P2002") continue; // collision de référence
        throw e;
      }
    }

    if (!demarche) {
      return NextResponse.json({ error: "Impossible de générer la référence" }, { status: 500 });
    }

    await logAudit(ctx.prisma, ctx.userId, "demarche_created", "demarche", demarche.id, {
      reference: demarche.reference,
      typeCode: type.code,
      dossierId: data.dossierId,
    }, req);

    return NextResponse.json(demarche, { status: 201 });
  } catch (error) {
    console.error("Create demarche error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
