import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { guard } from "@/lib/api-guard";
import { canAccessDossier } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";

async function ensureEvenementDossierAccess(
  ctx: Awaited<ReturnType<typeof guard>>,
  evenementId: string,
  required: "read" | "write" = "read"
): Promise<true | NextResponse> {
  if (ctx instanceof NextResponse) return ctx;
  const evenement = await ctx.prisma.evenement.findUnique({
    where: { id: evenementId },
    select: { dossierId: true, type: true },
  });
  if (!evenement) {
    return NextResponse.json({ error: "Événement non trouvé" }, { status: 404 });
  }
  // Un événement journal sans dossier est visible par tous les utilisateurs ayant la permission rendezVous.
  if (evenement.type === "journal" || !evenement.dossierId) {
    return true;
  }
  const ok = await canAccessDossier(ctx.prisma, ctx.userId, ctx.roleInfo, evenement.dossierId, required);
  if (!ok) {
    return NextResponse.json({ error: "Accès interdit à cet événement" }, { status: 403 });
  }
  return true;
}

const commentaireSchema = z.object({
  contenu: z.string().min(1, "Le commentaire est requis"),
});

const evenementUpdateSchema = z
  .object({
    dossierId: z.string().uuid().optional().nullable(),
    type: z.enum(["audience", "echeance", "rdv", "signification", "deadline", "journal"]).optional(),
    titre: z.string().min(1).optional(),
    dateDebut: z.string().datetime().optional(),
    dateFin: z.string().datetime().nullable().optional(),
    lieu: z.string().optional(),
    estPublicClient: z.boolean().optional(),
    actif: z.boolean().optional(),
    commentaire: commentaireSchema.optional(),
  });

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await guard(req, { resource: "rendezVous", action: "read" });
  if (ctx instanceof NextResponse) return ctx;

  const access = await ensureEvenementDossierAccess(ctx, params.id, "read");
  if (access !== true) return access;

  const prisma = ctx.prisma;

  try {
    const evenement = await prisma.evenement.findUnique({
      where: { id: params.id },
      include: {
        dossier: { select: { referenceInterne: true } },
        createur: { select: { prenom: true, nom: true } },
      },
    });
    if (!evenement) {
      return NextResponse.json({ error: "Événement non trouvé" }, { status: 404 });
    }

    let createurNom = evenement.createur
      ? `${evenement.createur.prenom} ${evenement.createur.nom}`
      : undefined;

    if (!createurNom && evenement.createurId) {
      const u = await prisma.user.findUnique({
        where: { id: evenement.createurId },
        select: { prenom: true, nom: true },
      });
      if (u) createurNom = `${u.prenom} ${u.nom}`;
    }

    if (!createurNom) {
      const audit = await prisma.auditLog.findFirst({
        where: { entite: "evenement", entiteId: params.id, action: "evenement_created" },
        orderBy: { createdAt: "asc" },
        select: { userId: true },
      });
      if (audit?.userId) {
        const u = await prisma.user.findUnique({
          where: { id: audit.userId },
          select: { prenom: true, nom: true },
        });
        if (u) createurNom = `${u.prenom} ${u.nom}`;
      }
    }

    return NextResponse.json({
      ...evenement,
      createurNom: createurNom || "Inconnu",
    });
  } catch (error) {
    console.error("Get evenement error", error);
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

  const ctx = await guard(req, { resource: "rendezVous", action: isComment ? "read" : "write" });
  if (ctx instanceof NextResponse) return ctx;

  const access = await ensureEvenementDossierAccess(ctx, params.id, isComment ? "read" : "write");
  if (access !== true) return access;

  if (!isComment) {
    const existingEvenement = await ctx.prisma.evenement.findUnique({
      where: { id: params.id },
      select: { createurId: true },
    });
    if (!ctx.roleInfo.estAdmin && existingEvenement?.createurId !== ctx.userId) {
      return NextResponse.json(
        { error: "Seul un administrateur ou le créateur peut modifier cet événement" },
        { status: 403 }
      );
    }
  }

  try {
    const parsed = evenementUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { dateDebut, dateFin, commentaire, ...data } = parsed.data;

    if (commentaire) {
      const user = await ctx.prisma.user.findUnique({
        where: { id: ctx.userId },
        select: { prenom: true, nom: true },
      });
      const auteurNom = user ? `${user.prenom} ${user.nom}` : "Inconnu";
      const existing = await ctx.prisma.evenement.findUnique({
        where: { id: params.id },
        select: { commentaires: true },
      });
      const liste = (existing?.commentaires as any[] | null) ?? [];
      const nouveau = {
        id: crypto.randomUUID(),
        auteurId: ctx.userId,
        auteurNom,
        contenu: commentaire.contenu,
        date: new Date().toISOString(),
      };
      const evenement = await ctx.prisma.evenement.update({
        where: { id: params.id },
        data: { commentaires: [...liste, nouveau] as any },
      });
      await logAudit(ctx.prisma, ctx.userId, "evenement_commentaire_added", "evenement", params.id);
      return NextResponse.json({ commentaire: nouveau, evenement }, { status: 201 });
    }

    // Vérifie l'accès au nouveau dossier si le déplacement concerne un événement non-journal.
    if (data.dossierId && data.type !== "journal") {
      const dossierOk = await canAccessDossier(ctx.prisma, ctx.userId, ctx.roleInfo, data.dossierId, "write");
      if (!dossierOk) {
        return NextResponse.json({ error: "Accès interdit à ce dossier" }, { status: 403 });
      }
    }

    const { dossierId, ...rest } = data;
    const evenement = await ctx.prisma.evenement.update({
      where: { id: params.id },
      data: {
        ...rest,
        dossierId: dossierId === undefined ? undefined : dossierId,
        dateDebut: dateDebut ? new Date(dateDebut) : undefined,
        dateFin: dateFin === null ? null : dateFin ? new Date(dateFin) : undefined,
      },
    });

    await logAudit(ctx.prisma, ctx.userId, "evenement_updated", "evenement", params.id);
    return NextResponse.json(evenement);
  } catch (error) {
    console.error("Update evenement error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await guard(req, { resource: "rendezVous", action: "delete" });
  if (ctx instanceof NextResponse) return ctx;

  const access = await ensureEvenementDossierAccess(ctx, params.id, "write");
  if (access !== true) return access;

  const existingEvenement = await ctx.prisma.evenement.findUnique({
    where: { id: params.id },
    select: { createurId: true },
  });
  if (!ctx.roleInfo.estAdmin && existingEvenement?.createurId !== ctx.userId) {
    return NextResponse.json(
      { error: "Seul un administrateur ou le créateur peut supprimer cet événement" },
      { status: 403 }
    );
  }

  try {
    await ctx.prisma.evenement.delete({ where: { id: params.id } });
    await logAudit(ctx.prisma, ctx.userId, "evenement_deleted", "evenement", params.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Delete evenement error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
