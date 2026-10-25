import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { guard } from "@/lib/api-guard";
import { getDossierScopedAccessFilter, canAccessDossier } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";

const missionSchema = z.object({
  dossierId: z.string().uuid(),
  typeActe: z.enum([
    "signification",
    "sommation",
    "mise_en_demeure",
    "commandement",
    "constat",
    "pv",
    "saisie",
    "recouvrement",
    "convocation",
  ]),
  huissierId: z.string().uuid(),
  adresseSignification: z.string().optional(),
  destinataire: z.string().optional(),
  datePrevue: z.string().datetime().nullable().optional(),
  fraisDeplacement: z.number().int().nullish(),
  debours: z.number().int().nullish(),
});

export async function GET(req: NextRequest) {
  const ctx = await guard(req, { resource: "missions", action: "read" });
  if (ctx instanceof NextResponse) return ctx;

  const accessFilter = await getDossierScopedAccessFilter(ctx.prisma, ctx.userId, ctx.roleInfo, "missions");
  const missions = await ctx.prisma.missionHuissier.findMany({
    where: accessFilter,
    take: 100,
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(missions);
}

export async function POST(req: NextRequest) {
  const ctx = await guard(req, { resource: "missions", action: "write" });
  if (ctx instanceof NextResponse) return ctx;

  try {
    const body = await req.json();
    const parsed = missionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    // Vérifie l'accès en écriture au dossier cible.
    const dossierOk = await canAccessDossier(ctx.prisma, ctx.userId, ctx.roleInfo, parsed.data.dossierId, "write");
    if (!dossierOk) {
      return NextResponse.json({ error: "Accès interdit à ce dossier" }, { status: 403 });
    }

    // Seul le créateur du dossier (avocat responsable) ou un administrateur
    // peut créer des missions.
    const dossier = await ctx.prisma.dossier.findUnique({
      where: { id: parsed.data.dossierId },
      select: { avocatResponsableId: true },
    });
    if (!ctx.roleInfo.estAdmin && dossier?.avocatResponsableId !== ctx.userId) {
      return NextResponse.json(
        { error: "Seul le créateur du dossier ou un administrateur peut créer une mission" },
        { status: 403 }
      );
    }

    const mission = await ctx.prisma.missionHuissier.create({
      data: {
        ...parsed.data,
        datePrevue: parsed.data.datePrevue ? new Date(parsed.data.datePrevue) : null,
      },
    });

    await logAudit(ctx.prisma, ctx.userId, "mission_huissier_created", "mission", mission.id);
    return NextResponse.json(mission, { status: 201 });
  } catch (error) {
    console.error("Create mission error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
