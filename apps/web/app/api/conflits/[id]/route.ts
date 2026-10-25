import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { guard } from "@/lib/api-guard";
import { canAccessDossier } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";

const updateConflitSchema = z.object({
  statut: z.enum(["valide", "ignore", "resolu"]),
  note: z.string().max(1000).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await guard(req, { resource: "dossiers", action: "write" });
  if (ctx instanceof NextResponse) return ctx;

  try {
    const body = await req.json();
    const parsed = updateConflitSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const existing = await ctx.prisma.conflitInteret.findUnique({
      where: { id: params.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Conflit introuvable" }, { status: 404 });
    }

    // Vérifie l'accès au dossier source du conflit.
    const dossierOk = await canAccessDossier(ctx.prisma, ctx.userId, ctx.roleInfo, existing.dossierId, "write");
    if (!dossierOk) {
      return NextResponse.json({ error: "Accès interdit à ce dossier" }, { status: 403 });
    }

    const conflit = await ctx.prisma.conflitInteret.update({
      where: { id: params.id },
      data: {
        statut: parsed.data.statut,
        note: parsed.data.note,
        validePar: ctx.userId,
        dateVerification: new Date(),
      },
    });

    await logAudit(ctx.prisma, ctx.userId, "conflit_interet_updated", "conflit_interet", conflit.id, {
      statut: conflit.statut,
    });

    return NextResponse.json(conflit);
  } catch (error) {
    console.error("Update conflit error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
