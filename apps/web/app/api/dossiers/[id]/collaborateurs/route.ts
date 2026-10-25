import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { guard, ensureDossierAccess } from "@/lib/api-guard";
import { logAudit } from "@/lib/audit";
import { reassignerTachesIntervenants } from "@/lib/tache-affectation";

const addCollaborateurSchema = z.object({
  userId: z.string().uuid(),
  roleRACI: z.enum(["R", "A", "C", "I"]),
  discipline: z.string().max(100).optional(),
  /// Tâches attendues : tableau de titres (rétrocompatible chaîne seule).
  tacheAttendue: z
    .union([
      z.array(z.string().min(1).max(500)).max(50),
      z.string().max(500).transform((s) => (s ? [s] : [])),
    ])
    .optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await guard(req, { resource: "dossiers", action: "read" });
  if (ctx instanceof NextResponse) return ctx;

  const access = await ensureDossierAccess(ctx, params.id, "read");
  if (access !== true) return access;

  const collaborateurs = await ctx.prisma.dossierCollaborateur.findMany({
    where: { dossierId: params.id },
    include: {
      // Pas de relation directe avec User (champ libre), on récupère les users séparément
    },
  });

  // Récupère les infos utilisateurs
  const userIds = collaborateurs.map((c) => c.userId);
  const users = await ctx.prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, prenom: true, nom: true, role: { select: { nom: true, estClient: true } } },
  });
  const userMap = new Map(users.map((u) => [u.id, u]));

  return NextResponse.json(
    collaborateurs.map((c) => ({
      ...c,
      user: userMap.get(c.userId),
    }))
  );
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await guard(req, { resource: "dossiers", action: "write" });
  if (ctx instanceof NextResponse) return ctx;

  const access = await ensureDossierAccess(ctx, params.id, "write");
  if (access !== true) return access;

  // La matrice RACI est modifiable uniquement par l'administrateur et le créateur du dossier.
  const dossier = await ctx.prisma.dossier.findUnique({
    where: { id: params.id },
    select: { createurId: true },
  });
  if (!dossier) {
    return NextResponse.json({ error: "Dossier non trouvé" }, { status: 404 });
  }
  if (!ctx.roleInfo.estAdmin && dossier.createurId !== ctx.userId) {
    return NextResponse.json(
      { error: "Seuls l'administrateur et le créateur du dossier peuvent modifier la matrice RACI" },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const parsed = addCollaborateurSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    // Vérifie l'unicité (dossierId + userId)
    const existing = await ctx.prisma.dossierCollaborateur.findUnique({
      where: {
        dossierId_userId: {
          dossierId: params.id,
          userId: parsed.data.userId,
        },
      },
    });

    if (existing) {
      // Met à jour le rôle
      const updated = await ctx.prisma.dossierCollaborateur.update({
        where: { id: existing.id },
        data: {
          roleRACI: parsed.data.roleRACI,
          discipline: parsed.data.discipline,
          tacheAttendue: (parsed.data.tacheAttendue?.length ? parsed.data.tacheAttendue : null) as any,
        },
      });
      await reassignerTachesIntervenants(ctx.prisma, params.id);
      return NextResponse.json(updated);
    }

    const collaborateur = await ctx.prisma.dossierCollaborateur.create({
      data: {
        dossierId: params.id,
        userId: parsed.data.userId,
        roleRACI: parsed.data.roleRACI,
        discipline: parsed.data.discipline,
        tacheAttendue: (parsed.data.tacheAttendue?.length ? parsed.data.tacheAttendue : null) as any,
      },
    });

    // Réaffecte les tâches du dossier selon les tâches cochées par intervenant.
    await reassignerTachesIntervenants(ctx.prisma, params.id);

    await logAudit(ctx.prisma, ctx.userId, "collaborateur_raci_added", "dossier_collaborateur", collaborateur.id, {
      dossierId: params.id,
    });

    return NextResponse.json(collaborateur, { status: 201 });
  } catch (error) {
    console.error("Add collaborateur error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await guard(req, { resource: "dossiers", action: "write" });
  if (ctx instanceof NextResponse) return ctx;

  // La matrice RACI est modifiable uniquement par l'administrateur et le créateur du dossier.
  const dossier = await ctx.prisma.dossier.findUnique({
    where: { id: params.id },
    select: { createurId: true },
  });
  if (!dossier) {
    return NextResponse.json({ error: "Dossier non trouvé" }, { status: 404 });
  }
  if (!ctx.roleInfo.estAdmin && dossier.createurId !== ctx.userId) {
    return NextResponse.json(
      { error: "Seuls l'administrateur et le créateur du dossier peuvent modifier la matrice RACI" },
      { status: 403 }
    );
  }

  const access = await ensureDossierAccess(ctx, params.id, "write");
  if (access !== true) return access;

  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "userId requis" }, { status: 400 });
    }

    await ctx.prisma.dossierCollaborateur.delete({
      where: {
        dossierId_userId: {
          dossierId: params.id,
          userId,
        },
      },
    });

    // Les tâches déchargées sur cet intervenant retombent sur le responsable.
    await reassignerTachesIntervenants(ctx.prisma, params.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete collaborateur error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
