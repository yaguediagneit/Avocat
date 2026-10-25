import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { guard } from "@/lib/api-guard";
import { canAccessDossier } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";

async function ensureTacheDossierAccess(
  ctx: Awaited<ReturnType<typeof guard>>,
  tacheId: string,
  required: "read" | "write" = "read"
): Promise<true | NextResponse> {
  if (ctx instanceof NextResponse) return ctx;
  const tache = await ctx.prisma.tache.findUnique({
    where: { id: tacheId },
    select: { dossierId: true },
  });
  if (!tache) {
    return NextResponse.json({ error: "Tâche non trouvée" }, { status: 404 });
  }
  const ok = await canAccessDossier(ctx.prisma, ctx.userId, ctx.roleInfo, tache.dossierId, required);
  if (!ok) {
    return NextResponse.json({ error: "Accès interdit à cette tâche" }, { status: 403 });
  }
  return true;
}

/// Vérifie que l'utilisateur peut intervenir sur la tâche (modifier/supprimer).
/// Règle : admin OU responsable OU créateur de la tâche OU responsable du
/// dossier (avocat / huissier) — une tâche déchargée sur un intervenant reste
/// exécutable par le responsable du dossier.
async function ensureTacheEditAccess(
  ctx: Awaited<ReturnType<typeof guard>>,
  tacheId: string
): Promise<true | NextResponse> {
  if (ctx instanceof NextResponse) return ctx;
  if (ctx.roleInfo.estAdmin) return true;
  const tache = await ctx.prisma.tache.findUnique({
    where: { id: tacheId },
    select: {
      responsableId: true,
      createurId: true,
      dossier: { select: { avocatResponsableId: true, huissierResponsableId: true } },
    },
  });
  if (!tache) {
    return NextResponse.json({ error: "Tâche non trouvée" }, { status: 404 });
  }
  const estResponsableDossier =
    tache.dossier.avocatResponsableId === ctx.userId ||
    tache.dossier.huissierResponsableId === ctx.userId;
  if (
    tache.responsableId !== ctx.userId &&
    tache.createurId !== ctx.userId &&
    !estResponsableDossier
  ) {
    return NextResponse.json(
      { error: "Vous ne pouvez intervenir que sur les tâches qui vous sont affectées" },
      { status: 403 }
    );
  }
  return true;
}

const tacheUpdateSchema = z.object({
  dossierId: z.string().uuid().optional(),
  titre: z.string().min(1).optional(),
  description: z.string().optional(),
  responsableId: z.string().uuid().optional(),
  echeance: z.string().datetime().nullable().optional(),
  priorite: z.enum(["basse", "moyenne", "haute", "critique"]).optional(),
  statut: z.enum(["À faire", "En cours", "Terminée", "Annulée"]).optional(),
  actif: z.boolean().optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await guard(req, { resource: "taches", action: "read" });
  if (ctx instanceof NextResponse) return ctx;

  const access = await ensureTacheDossierAccess(ctx, params.id, "read");
  if (access !== true) return access;

  const prisma = ctx.prisma;

  try {
    const tache = await prisma.tache.findUnique({
      where: { id: params.id },
      include: { dossier: { select: { referenceInterne: true } } },
    });
    if (!tache) {
      return NextResponse.json({ error: "Tâche non trouvée" }, { status: 404 });
    }

    async function nomUtilisateur(userId?: string | null): Promise<string | undefined> {
      if (!userId) return undefined;
      const u = await prisma.user.findUnique({
        where: { id: userId },
        select: { prenom: true, nom: true },
      });
      return u ? `${u.prenom} ${u.nom}` : undefined;
    }

    async function nomCreateurDepuisAudit(): Promise<string | undefined> {
      const audit = await prisma.auditLog.findFirst({
        where: { entite: "tache", entiteId: params.id, action: "tache_created" },
        orderBy: { createdAt: "asc" },
        select: { userId: true },
      });
      return audit?.userId ? await nomUtilisateur(audit.userId) : undefined;
    }

    let responsableNom = await nomUtilisateur(tache.responsableId);
    let createurNom = await nomUtilisateur(tache.createurId);
    if (!createurNom) {
      createurNom = await nomCreateurDepuisAudit();
    }

    return NextResponse.json({
      ...tache,
      responsableNom: responsableNom || "Inconnu",
      createurNom: createurNom || "Inconnu",
    });
  } catch (error) {
    console.error("Get tache error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await req.json().catch(() => ({}));
  const isComment =
    typeof body.commentaire === "object" &&
    body.commentaire !== null &&
    typeof body.commentaire.contenu === "string";

  const ctx = await guard(req, { resource: "taches", action: isComment ? "read" : "write" });
  if (ctx instanceof NextResponse) return ctx;

  const access = await ensureTacheDossierAccess(ctx, params.id, isComment ? "read" : "write");
  if (access !== true) return access;

  if (isComment) {
    const contenu = body.commentaire.contenu.trim();
    if (!contenu) {
      return NextResponse.json({ error: "Le commentaire est requis" }, { status: 400 });
    }
    const user = await ctx.prisma.user.findUnique({
      where: { id: ctx.userId },
      select: { prenom: true, nom: true },
    });
    const auteurNom = user ? `${user.prenom} ${user.nom}` : "Inconnu";
    const existing = await ctx.prisma.tache.findUnique({
      where: { id: params.id },
      select: { commentaires: true },
    });
    const liste = (existing?.commentaires as any[] | null) ?? [];
    const nouveau = {
      id: crypto.randomUUID(),
      auteurId: ctx.userId,
      auteurNom,
      contenu,
      date: new Date().toISOString(),
    };
    const tache = await ctx.prisma.tache.update({
      where: { id: params.id },
      data: { commentaires: [...liste, nouveau] as any },
    });
    await logAudit(ctx.prisma, ctx.userId, "tache_commentaire_added", "tache", params.id);
    return NextResponse.json({ commentaire: nouveau, tache }, { status: 201 });
  }

  const editAccess = await ensureTacheEditAccess(ctx, params.id);
  if (editAccess !== true) return editAccess;

  try {
    const parsed = tacheUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    // Modifier / désactiver (tout champ autre que le statut) est réservé à
    // l'administrateur et au créateur de la tâche.
    const onlyStatut = Object.keys(parsed.data).every((k) => k === "statut");
    if (!onlyStatut && !ctx.roleInfo.estAdmin) {
      const t = await ctx.prisma.tache.findUnique({
        where: { id: params.id },
        select: {
          createurId: true,
        },
      });
      const estCreateur = t && t.createurId === ctx.userId;
      if (!estCreateur) {
        return NextResponse.json(
          { error: "Seuls l'administrateur et le créateur de la tâche peuvent modifier ou désactiver une tâche" },
          { status: 403 }
        );
      }
    }

    const { echeance, ...data } = parsed.data;
    const tache = await ctx.prisma.tache.update({
      where: { id: params.id },
      data: {
        ...data,
        echeance: echeance === null ? null : echeance ? new Date(echeance) : undefined,
      },
    });

    await logAudit(ctx.prisma, ctx.userId, "tache_updated", "tache", params.id);
    return NextResponse.json(tache);
  } catch (error) {
    console.error("Update tache error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await guard(req, { resource: "taches", action: "delete" });
  if (ctx instanceof NextResponse) return ctx;

  if (!ctx.roleInfo.estAdmin) {
    return NextResponse.json({ error: "Seul un administrateur peut désactiver une tâche" }, { status: 403 });
  }

  const access = await ensureTacheDossierAccess(ctx, params.id, "write");
  if (access !== true) return access;

  try {
    await ctx.prisma.tache.update({ where: { id: params.id }, data: { actif: false } });
    await logAudit(ctx.prisma, ctx.userId, "tache_deactivated", "tache", params.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Deactivate tache error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
