import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";
import { canAccessDossier } from "@/lib/rbac";
import { z } from "zod";

const evtSchema = z.object({
  type: z.enum([
    "DEPOT",
    "RELANCE",
    "COMPLEMENT",
    "DECISION",
    "REMISE",
    "NOTE",
    "DEMANDE_PIECE_CLIENT",
  ]),
  date: z.string().optional().nullable(),
  description: z.string().min(1),
  details: z.record(z.string(), z.any()).optional().nullable(),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await guard(req, { resource: "demarches", action: "write" });
  if (ctx instanceof NextResponse) return ctx;

  const demarche = await ctx.prisma.demarche.findUnique({
    where: { id: params.id },
    select: { dossierId: true, type: { select: { delaiRelanceJours: true } } },
  });
  if (!demarche) return NextResponse.json({ error: "Démarche non trouvée" }, { status: 404 });
  const ok = await canAccessDossier(ctx.prisma, ctx.userId, ctx.roleInfo, demarche.dossierId, "write");
  if (!ok) return NextResponse.json({ error: "Accès interdit" }, { status: 403 });

  try {
    const parsed = evtSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const evt = await ctx.prisma.demarcheEvenement.create({
      data: {
        demarcheId: params.id,
        type: parsed.data.type,
        date: parsed.data.date ? new Date(parsed.data.date) : new Date(),
        description: parsed.data.description,
        details: (parsed.data.details as any) ?? null,
        creePar: ctx.userId,
      },
    });

    // Une relance manuelle décale la prochaine relance interne.
    if (parsed.data.type === "RELANCE") {
      const jours = demarche.type.delaiRelanceJours || 15;
      await ctx.prisma.demarche.update({
        where: { id: params.id },
        data: { prochaineRelance: new Date(Date.now() + jours * 86400000) },
      });
    }
    // Une remise au client est tracée sur la démarche.
    if (parsed.data.type === "REMISE") {
      await ctx.prisma.demarche.update({
        where: { id: params.id },
        data: { remisAuClientLe: evt.date },
      });
    }

    return NextResponse.json(evt, { status: 201 });
  } catch (error) {
    console.error("Add demarche evenement error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
