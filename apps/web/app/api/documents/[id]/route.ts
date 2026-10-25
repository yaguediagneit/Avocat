import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { guard } from "@/lib/api-guard";
import { canAccessDossier, estIntervenantExterne } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { getPresignedDownloadUrl } from "@/lib/s3";

/// Vérifie l'accès au dossier lié à un document. Renvoie `true` ou une
/// NextResponse (403/404). `required` correspond au niveau d'accès requis.
async function ensureDocumentDossierAccess(
  ctx: Awaited<ReturnType<typeof guard>>,
  documentId: string,
  required: "read" | "write" | "validate"
): Promise<true | NextResponse> {
  if (ctx instanceof NextResponse) return ctx;
  const document = await ctx.prisma.document.findUnique({
    where: { id: documentId },
    select: { dossierId: true, partageExterne: true },
  });
  if (!document) {
    return NextResponse.json({ error: "Document non trouvé" }, { status: 404 });
  }
  const ok = await canAccessDossier(ctx.prisma, ctx.userId, ctx.roleInfo, document.dossierId, required);
  if (!ok) {
    return NextResponse.json({ error: "Accès interdit à ce document" }, { status: 403 });
  }
  // Les intervenants externes ne voient que les documents partagés avec eux.
  if (required === "read" && estIntervenantExterne(ctx.roleInfo) && !document.partageExterne) {
    return NextResponse.json({ error: "Accès interdit à ce document" }, { status: 403 });
  }
  return true;
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await guard(req, { resource: "documents", action: "read" });
  if (ctx instanceof NextResponse) return ctx;

  const access = await ensureDocumentDossierAccess(ctx, params.id, "read");
  if (access !== true) return access;

  try {
    const document = await ctx.prisma.document.findUnique({
      where: { id: params.id },
      include: {
        dossier: { select: { referenceInterne: true, clientId: true } },
        versions: { orderBy: { numeroVersion: "desc" } },
      },
    });

    if (!document) {
      return NextResponse.json({ error: "Document non trouvé" }, { status: 404 });
    }

    const downloadUrl = await getPresignedDownloadUrl(document.s3KeyChiffre, 300);

    return NextResponse.json({
      ...document,
      downloadUrl,
    });
  } catch (error) {
    console.error("Get document error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

const validationSchema = z.object({
  statutValidation: z.enum(["brouillon", "en_relecture", "valide", "rejete"]),
  relecteurId: z.string().uuid().optional(),
  note: z.string().max(1000).optional(),
});

const metadataSchema = z.object({
  dossierId: z.string().uuid().optional(),
  nom: z.string().min(1).optional(),
  categorie: z.string().min(1).optional(),
  publieClient: z.boolean().optional(),
  partageExterne: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await guard(req, { resource: "documents", action: "write" });
  if (ctx instanceof NextResponse) return ctx;

  const access = await ensureDocumentDossierAccess(ctx, params.id, "write");
  if (access !== true) return access;

  try {
    const body = await req.json();

    // Activation / désactivation rapide
    if (typeof body.actif === "boolean") {
      const document = await ctx.prisma.document.update({
        where: { id: params.id },
        data: { actif: body.actif },
      });
      await logAudit(ctx.prisma, ctx.userId, "document_toggled", "document", params.id, { actif: body.actif });
      return NextResponse.json(document);
    }

    // Mise à jour des métadonnées
    if ("nom" in body || "categorie" in body || "dossierId" in body || "publieClient" in body || "partageExterne" in body) {
      const parsed = metadataSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
      }
      const data: Prisma.DocumentUpdateInput = { ...parsed.data };
      if (parsed.data.publieClient === true) {
        const current = await ctx.prisma.document.findUnique({
          where: { id: params.id },
          select: { datePublication: true },
        });
        if (!current?.datePublication) data.datePublication = new Date();
      }
      const document = await ctx.prisma.document.update({
        where: { id: params.id },
        data,
      });
      await logAudit(ctx.prisma, ctx.userId, "document_updated", "document", params.id);
      return NextResponse.json(document);
    }

    const parsed = validationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const existing = await ctx.prisma.document.findUnique({
      where: { id: params.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Document non trouvé" }, { status: 404 });
    }

    const { statutValidation, note } = parsed.data;

    // Met à jour le circuit de validation (historique des transitions)
    const circuit = (existing.circuitValidation as any[]) || [];
    const user = await ctx.prisma.user.findUnique({
      where: { id: ctx.userId },
      select: { prenom: true, nom: true },
    });

    circuit.push({
      action: statutValidation,
      userId: ctx.userId,
      userName: user ? `${user.prenom} ${user.nom}` : ctx.userId,
      date: new Date().toISOString(),
      note: note || null,
    });

    const document = await ctx.prisma.document.update({
      where: { id: params.id },
      data: {
        statutValidation,
        relecteurId: statutValidation === "en_relecture" ? (parsed.data.relecteurId || ctx.userId) : existing.relecteurId,
        dateRelecture: statutValidation === "valide" || statutValidation === "rejete" ? new Date() : existing.dateRelecture,
        circuitValidation: circuit,
        // Si validé, on publie automatiquement si c'était en attente
        validePar: statutValidation === "valide" ? ctx.userId : existing.validePar,
      },
    });

    await logAudit(ctx.prisma, ctx.userId, "document_validation_updated", "document", params.id, {
      statutValidation,
      note,
    });

    return NextResponse.json(document);
  } catch (error) {
    console.error("Update document validation error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await guard(req, { resource: "documents", action: "delete" });
  if (ctx instanceof NextResponse) return ctx;

  if (!ctx.roleInfo.estAdmin) {
    return NextResponse.json({ error: "Seul un administrateur peut supprimer un document" }, { status: 403 });
  }

  const access = await ensureDocumentDossierAccess(ctx, params.id, "write");
  if (access !== true) return access;

  try {
    // Supprime d'abord les versions car la relation n'a pas de cascade.
    await ctx.prisma.versionDocument.deleteMany({ where: { documentId: params.id } });
    await ctx.prisma.document.delete({ where: { id: params.id } });
    await logAudit(ctx.prisma, ctx.userId, "document_deleted", "document", params.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Delete document error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
