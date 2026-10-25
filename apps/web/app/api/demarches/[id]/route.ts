import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";
import { canAccessDossier, hasPermission } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

const patchSchema = z.object({
  sousType: z.string().optional().nullable(),
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
  noteRecevabilite: z.string().optional().nullable(),
  remisAuClientLe: z.string().optional().nullable(),
  /// Validation juridique (avocat/fiscaliste) : réservée aux rôles
  /// détenant l'action `validate` sur la ressource `demarches`.
  valider: z.boolean().optional(),
  /// Dérogation motivée à une pièce obligatoire : { pieceId, motif }.
  derogation: z
    .object({ pieceId: z.string().uuid(), motif: z.string().min(3) })
    .optional(),
});

async function loadDemarche(ctx: any, id: string) {
  return ctx.prisma.demarche.findUnique({
    where: { id },
    include: {
      type: { include: { pieces: { where: { actif: true }, orderBy: { ordre: "asc" } } } },
      dossier: { select: { id: true, referenceInterne: true, client: { select: { id: true, raisonSociale: true } } } },
      demandeur: true,
      mandataire: true,
      parcelle: true,
      autorite: true,
      pieces: { orderBy: { ordre: "asc" } },
      parties: { include: { demandeur: true }, orderBy: { ordre: "asc" } },
      evenements: { orderBy: { date: "desc" }, take: 100 },
      frais: { orderBy: { date: "desc" } },
    },
  });
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await guard(req);
  if (ctx instanceof NextResponse) return ctx;

  const demarche = await loadDemarche(ctx, params.id);
  if (!demarche) return NextResponse.json({ error: "Démarche non trouvée" }, { status: 404 });

  const ok = await canAccessDossier(ctx.prisma, ctx.userId, ctx.roleInfo, demarche.dossierId, "read");
  if (!ok) return NextResponse.json({ error: "Accès interdit" }, { status: 403 });

  return NextResponse.json(demarche);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await guard(req, { resource: "demarches", action: "write" });
  if (ctx instanceof NextResponse) return ctx;

  const demarche = await ctx.prisma.demarche.findUnique({
    where: { id: params.id },
    include: { type: true },
  });
  if (!demarche) return NextResponse.json({ error: "Démarche non trouvée" }, { status: 404 });

  const ok = await canAccessDossier(ctx.prisma, ctx.userId, ctx.roleInfo, demarche.dossierId, "write");
  if (!ok) return NextResponse.json({ error: "Accès interdit" }, { status: 403 });

  try {
    const body = await req.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const data = parsed.data;

    const update: Record<string, unknown> = {};
    for (const key of [
      "sousType", "demandeurId", "mandataireId", "parcelleId", "autoriteId",
      "autoriteLibre", "adresseDepot", "contactAutorite", "objet", "finalite",
      "fondement", "referenceActes", "noteRecevabilite",
    ] as const) {
      if (key in data) update[key] = data[key] || null;
    }
    if ("qualification" in data) update.qualification = data.qualification ?? null;
    if ("urgent" in data) update.urgent = data.urgent;
    if ("dateLimite" in data) update.dateLimite = data.dateLimite ? new Date(data.dateLimite) : null;
    if ("priorite" in data) update.priorite = data.priorite;
    if ("risque" in data) update.risque = data.risque;
    if ("responsableId" in data) update.responsableId = data.responsableId || null;
    if ("assistanteId" in data) update.assistanteId = data.assistanteId || null;
    if ("agentLiaisonId" in data) update.agentLiaisonId = data.agentLiaisonId || null;
    for (const key of ["honoraires", "debours", "taxes", "timbres", "avancesRecues"] as const) {
      if (key in data && data[key] !== undefined) update[key] = data[key];
    }
    if ("remisAuClientLe" in data)
      update.remisAuClientLe = data.remisAuClientLe ? new Date(data.remisAuClientLe) : null;

    // Validation juridique : réservée aux rôles avec l'action `validate`.
    if (data.valider) {
      const peutValider =
        ctx.roleInfo.estAdmin || hasPermission(ctx.roleInfo, "demarches", "validate");
      if (!peutValider) {
        return NextResponse.json(
          { error: "Seul un avocat / fiscaliste habilité peut valider cette démarche." },
          { status: 403 }
        );
      }
      update.valideParId = ctx.userId;
      update.valideLe = new Date();
    }

    // Dérogation motivée à une pièce obligatoire manquante : journalisée.
    if (data.derogation) {
      const piece = await ctx.prisma.demarchePiece.findFirst({
        where: { id: data.derogation.pieceId, demarcheId: demarche.id },
      });
      if (!piece) {
        return NextResponse.json({ error: "Pièce introuvable" }, { status: 404 });
      }
      const derogations = Array.isArray(demarche.derogations)
        ? [...(demarche.derogations as any[])]
        : [];
      derogations.push({
        pieceId: piece.id,
        libelle: piece.libelle,
        motif: data.derogation.motif,
        validePar: ctx.userId,
        date: new Date().toISOString(),
      });
      update.derogations = derogations;
      await ctx.prisma.demarcheEvenement.create({
        data: {
          demarcheId: demarche.id,
          type: "NOTE",
          description: `Dérogation accordée pour la pièce « ${piece.libelle} » : ${data.derogation.motif}`,
          creePar: ctx.userId,
        },
      });
    }

    const updated = await ctx.prisma.demarche.update({
      where: { id: demarche.id },
      data: update,
    });

    if (data.valider) {
      await ctx.prisma.demarcheEvenement.create({
        data: {
          demarcheId: demarche.id,
          type: "VALIDATION",
          description: "Validation juridique de la démarche",
          creePar: ctx.userId,
        },
      });
    }

    await logAudit(ctx.prisma, ctx.userId, "demarche_updated", "demarche", demarche.id, {
      champs: Object.keys(update),
    }, req);

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Update demarche error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
