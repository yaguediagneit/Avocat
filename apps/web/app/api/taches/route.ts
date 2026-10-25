import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { guard } from "@/lib/api-guard";
import { getDossierScopedAccessFilter, canAccessDossier } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";

const tacheSchema = z.object({
  dossierId: z.string().uuid(),
  titre: z.string().min(1),
  description: z.string().optional(),
  responsableId: z.string().uuid(),
  echeance: z.string().datetime().nullable().optional(),
  priorite: z.enum(["basse", "moyenne", "haute", "critique"]).default("moyenne"),
  statut: z.enum(["En cours", "À faire", "Terminée", "Annulée"]).optional(),
});

export async function GET(req: NextRequest) {
  const ctx = await guard(req, { resource: "taches", action: "read" });
  if (ctx instanceof NextResponse) return ctx;

  try {
    const accessFilter = await getDossierScopedAccessFilter(ctx.prisma, ctx.userId, ctx.roleInfo, "taches");
    // Les tâches visibles sont celles des dossiers accessibles à l'utilisateur.
    // getDossierScopedAccessFilter inclut : avocat responsable, huissier responsable,
    // collaborateurs (matrice RACI / associés / intervenants), permissions explicites.
    const taches = await ctx.prisma.tache.findMany({
      where: accessFilter,
      take: 100,
      orderBy: { echeance: "asc" },
      include: { dossier: { select: { referenceInterne: true } } },
    });
    return NextResponse.json(taches);
  } catch (error) {
    console.error("List taches error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const ctx = await guard(req, { resource: "taches", action: "write" });
  if (ctx instanceof NextResponse) return ctx;

  try {
    const body = await req.json();
    const parsed = tacheSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    // Vérifie l'accès en écriture au dossier cible.
    const dossierOk = await canAccessDossier(ctx.prisma, ctx.userId, ctx.roleInfo, parsed.data.dossierId, "write");
    if (!dossierOk) {
      return NextResponse.json({ error: "Accès interdit à ce dossier" }, { status: 403 });
    }

    // Seul le créateur du dossier (avocat responsable) ou un administrateur
    // peut créer des tâches.
    const dossier = await ctx.prisma.dossier.findUnique({
      where: { id: parsed.data.dossierId },
      select: { avocatResponsableId: true },
    });
    if (!ctx.roleInfo.estAdmin && dossier?.avocatResponsableId !== ctx.userId) {
      return NextResponse.json(
        { error: "Seul le créateur du dossier ou un administrateur peut créer une tâche" },
        { status: 403 }
      );
    }

    // Un compte client ne peut pas être responsable d'une tâche.
    const responsable = await ctx.prisma.user.findUnique({
      where: { id: parsed.data.responsableId },
      include: { role: { select: { estClient: true } } },
    });
    if (!responsable || responsable.clientId || responsable.role.estClient) {
      return NextResponse.json(
        { error: "Le responsable doit être un utilisateur du cabinet (pas un client)." },
        { status: 400 }
      );
    }

    const tache = await ctx.prisma.tache.create({
      data: {
        dossierId: parsed.data.dossierId,
        titre: parsed.data.titre,
        description: parsed.data.description,
        responsableId: parsed.data.responsableId,
        createurId: ctx.userId,
        echeance: parsed.data.echeance ? new Date(parsed.data.echeance) : null,
        priorite: parsed.data.priorite,
        statut: parsed.data.statut || "En cours",
      },
    });

    await logAudit(ctx.prisma, ctx.userId, "tache_created", "tache", tache.id);
    return NextResponse.json(tache, { status: 201 });
  } catch (error) {
    console.error("Create tache error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
