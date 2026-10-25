import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { guard, ensureDossierAccess } from "@/lib/api-guard";
import { logAudit } from "@/lib/audit";

const DEFAULT_CHECKLIST = [
  "Toutes les tâches sont terminées",
  "Toutes les factures sont émises et réglées",
  "Les pièces essentielles sont archivées",
  "La note de synthèse est rédigée",
  "Le client a été informé de la clôture",
  "Les actes de procédure sont archivés",
  "Le rapport de mission est disponible",
];

const addItemSchema = z.object({
  libelle: z.string().min(1).max(300),
  ordre: z.number().int().optional(),
});

const toggleItemSchema = z.object({
  coche: z.boolean(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await guard(req, { resource: "dossiers", action: "read" });
  if (ctx instanceof NextResponse) return ctx;

  const access = await ensureDossierAccess(ctx, params.id, "read");
  if (access !== true) return access;

  let items = await ctx.prisma.checklistCloture.findMany({
    where: { dossierId: params.id },
    orderBy: { ordre: "asc" },
  });

  // Génère la check-list par défaut si elle n'existe pas encore
  if (items.length === 0) {
    const dossier = await ctx.prisma.dossier.findUnique({
      where: { id: params.id },
      select: { statut: true },
    });

    // On génère la check-list dès qu'on y accède (proactif)
    items = await Promise.all(
      DEFAULT_CHECKLIST.map((libelle, i) =>
        ctx.prisma.checklistCloture.create({
          data: {
            dossierId: params.id,
            libelle,
            ordre: i,
          },
        })
      )
    );

    await logAudit(ctx.prisma, ctx.userId, "checklist_cloture_generated", "dossier", params.id);
  }

  return NextResponse.json(items);
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await guard(req, { resource: "dossiers", action: "write" });
  if (ctx instanceof NextResponse) return ctx;

  const access = await ensureDossierAccess(ctx, params.id, "write");
  if (access !== true) return access;

  try {
    const body = await req.json();
    const parsed = addItemSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const maxOrdre = await ctx.prisma.checklistCloture.aggregate({
      where: { dossierId: params.id },
      _max: { ordre: true },
    });

    const item = await ctx.prisma.checklistCloture.create({
      data: {
        dossierId: params.id,
        libelle: parsed.data.libelle,
        ordre: parsed.data.ordre ?? (maxOrdre._max.ordre ?? 0) + 1,
      },
    });

    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error("Add checklist item error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await guard(req, { resource: "dossiers", action: "write" });
  if (ctx instanceof NextResponse) return ctx;

  const access = await ensureDossierAccess(ctx, params.id, "write");
  if (access !== true) return access;

  try {
    const { searchParams } = new URL(req.url);
    const itemId = searchParams.get("itemId");

    if (!itemId) {
      return NextResponse.json({ error: "itemId requis" }, { status: 400 });
    }

    const body = await req.json();
    const parsed = toggleItemSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const item = await ctx.prisma.checklistCloture.update({
      where: { id: itemId },
      data: {
        coche: parsed.data.coche,
        cochePar: parsed.data.coche ? ctx.userId : null,
        cocheLe: parsed.data.coche ? new Date() : null,
      },
    });

    // Vérifie si tous les items sont cochés → propose la clôture
    const allItems = await ctx.prisma.checklistCloture.findMany({
      where: { dossierId: params.id },
    });
    const allChecked = allItems.length > 0 && allItems.every((i) => i.coche);

    if (allChecked) {
      await logAudit(ctx.prisma, ctx.userId, "checklist_cloture_complete", "dossier", params.id);
    }

    return NextResponse.json({ ...item, allChecked });
  } catch (error) {
    console.error("Toggle checklist item error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await guard(req, { resource: "dossiers", action: "write" });
  if (ctx instanceof NextResponse) return ctx;

  if (!ctx.roleInfo.estAdmin) {
    return NextResponse.json({ error: "Seul un administrateur peut supprimer un élément de checklist" }, { status: 403 });
  }

  const access = await ensureDossierAccess(ctx, params.id, "write");
  if (access !== true) return access;

  try {
    const { searchParams } = new URL(req.url);
    const itemId = searchParams.get("itemId");

    if (!itemId) {
      return NextResponse.json({ error: "itemId requis" }, { status: 400 });
    }

    await ctx.prisma.checklistCloture.delete({
      where: { id: itemId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete checklist item error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
