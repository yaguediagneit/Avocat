import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { guard } from "@/lib/api-guard";
import { getDossierScopedAccessFilter, canAccessDossier } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";

const evenementSchema = z.object({
  dossierId: z.string().uuid().optional().nullable(),
  type: z.enum(["audience", "echeance", "rdv", "signification", "deadline", "journal"]),
  titre: z.string().min(1),
  dateDebut: z.string().datetime(),
  dateFin: z.string().datetime().nullable().optional(),
  lieu: z.string().optional(),
  participants: z.array(z.record(z.string())).optional(),
  estPublicClient: z.boolean().default(false),
});

export async function GET(req: NextRequest) {
  const ctx = await guard(req, { resource: "rendezVous", action: "read" });
  if (ctx instanceof NextResponse) return ctx;

  try {
    const accessFilter = await getDossierScopedAccessFilter(ctx.prisma, ctx.userId, ctx.roleInfo, "rendezVous");
    const evenements = await ctx.prisma.evenement.findMany({
      where:
        Object.keys(accessFilter).length === 0
          ? {}
          : { OR: [{ dossierId: null }, accessFilter] },
      take: 200,
      orderBy: { dateDebut: "asc" },
      include: { dossier: { select: { referenceInterne: true } } },
    });
    return NextResponse.json(evenements);
  } catch (error) {
    console.error("List evenements error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const ctx = await guard(req, { resource: "rendezVous", action: "write" });
  if (ctx instanceof NextResponse) return ctx;

  try {
    const body = await req.json();
    const parsed = evenementSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    // Vérifie l'accès en écriture au dossier cible, sauf pour un journal non lié.
    if (parsed.data.dossierId) {
      const dossierOk = await canAccessDossier(ctx.prisma, ctx.userId, ctx.roleInfo, parsed.data.dossierId, "write");
      if (!dossierOk) {
        return NextResponse.json({ error: "Accès interdit à ce dossier" }, { status: 403 });
      }
    }

    const evenement = await ctx.prisma.evenement.create({
      data: {
        createurId: ctx.userId,
        ...(parsed.data.dossierId ? { dossierId: parsed.data.dossierId } : {}),
        type: parsed.data.type,
        titre: parsed.data.titre,
        dateDebut: new Date(parsed.data.dateDebut),
        dateFin: parsed.data.dateFin ? new Date(parsed.data.dateFin) : null,
        lieu: parsed.data.lieu,
        participants: parsed.data.participants || [],
        estPublicClient: parsed.data.estPublicClient,
      } as any,
    });

    await logAudit(ctx.prisma, ctx.userId, "evenement_created", "evenement", evenement.id);
    return NextResponse.json(evenement, { status: 201 });
  } catch (error) {
    console.error("Create evenement error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
