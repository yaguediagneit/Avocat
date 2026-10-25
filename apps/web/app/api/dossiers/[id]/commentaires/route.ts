import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { guard, ensureDossierAccess } from "@/lib/api-guard";
import { logAudit } from "@/lib/audit";

const createCommentaireSchema = z.object({
  message: z.string().min(1).max(5000),
  type: z.enum(["commentaire", "decision", "note_interne"]).default("commentaire"),
});

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await guard(req, { resource: "dossiers", action: "read" });
  if (ctx instanceof NextResponse) return ctx;

  const access = await ensureDossierAccess(ctx, params.id, "read");
  if (access !== true) return access;

  const commentaires = await ctx.prisma.commentaireDossier.findMany({
    where: { dossierId: params.id },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(commentaires);
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await guard(req, { resource: "dossiers", action: "read" });
  if (ctx instanceof NextResponse) return ctx;

  const access = await ensureDossierAccess(ctx, params.id, "write");
  if (access !== true) return access;

  try {
    const body = await req.json();
    const parsed = createCommentaireSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    // Récupère le nom de l'auteur
    const user = await ctx.prisma.user.findUnique({
      where: { id: ctx.userId },
      select: { prenom: true, nom: true },
    });

    if (!user) {
      return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
    }

    const commentaire = await ctx.prisma.commentaireDossier.create({
      data: {
        dossierId: params.id,
        auteurId: ctx.userId,
        auteurNom: `${user.prenom} ${user.nom}`,
        message: parsed.data.message,
        type: parsed.data.type,
      },
    });

    await logAudit(ctx.prisma, ctx.userId, "commentaire_dossier_created", "commentaire_dossier", commentaire.id, {
      dossierId: params.id,
    });

    return NextResponse.json(commentaire, { status: 201 });
  } catch (error) {
    console.error("Create commentaire error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
