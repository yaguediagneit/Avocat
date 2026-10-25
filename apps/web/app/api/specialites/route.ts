import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { guard } from "@/lib/api-guard";
import { logAudit } from "@/lib/audit";

const updateSelectionSchema = z.object({
  selectionneeIds: z.array(z.string().min(1)),
});

const createSpecialiteSchema = z.object({
  code: z.string().min(1).max(50),
  libelle: z.string().min(1).max(100),
  description: z.string().max(500).optional().nullable(),
});

export async function GET(req: NextRequest) {
  const ctx = await guard(req, { resource: "parametres", action: "read" });
  if (ctx instanceof NextResponse) return ctx;

  const { searchParams } = new URL(req.url);
  const selectionnee = searchParams.get("selectionnee");

  const where: Record<string, unknown> = { actif: true };
  if (selectionnee !== null) {
    where.selectionnee = selectionnee === "true";
  }

  const specialites = await ctx.prisma.specialite.findMany({
    where,
    orderBy: [{ ordre: "asc" }, { libelle: "asc" }],
    include: {
      typesDocuments: {
        where: { actif: true },
        orderBy: [{ ordre: "asc" }, { libelle: "asc" }],
      },
      workflowEtapes: {
        where: { actif: true },
        orderBy: [{ ordre: "asc" }],
      },
    },
  });

  return NextResponse.json(specialites);
}

export async function PATCH(req: NextRequest) {
  const ctx = await guard(req, { resource: "parametres", action: "write" });
  if (ctx instanceof NextResponse) return ctx;

  try {
    const body = await req.json();
    const parsed = updateSelectionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { selectionneeIds } = parsed.data;

    await ctx.prisma.$transaction([
      ctx.prisma.specialite.updateMany({
        where: { id: { notIn: selectionneeIds } },
        data: { selectionnee: false },
      }),
      ctx.prisma.specialite.updateMany({
        where: { id: { in: selectionneeIds } },
        data: { selectionnee: true },
      }),
    ]);

    const updated = await ctx.prisma.specialite.findMany({
      where: { actif: true },
      orderBy: [{ ordre: "asc" }, { libelle: "asc" }],
      select: { id: true, code: true, libelle: true, selectionnee: true },
    });

    await logAudit(ctx.prisma, ctx.userId, "specialites_selection_updated", "specialite", undefined, {
      selectionneeIds,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Update specialites error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const ctx = await guard(req, { resource: "parametres", action: "write" });
  if (ctx instanceof NextResponse) return ctx;

  try {
    const body = await req.json();
    const parsed = createSpecialiteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { code, libelle, description } = parsed.data;

    const maxOrdre = await ctx.prisma.specialite.aggregate({
      _max: { ordre: true },
    });

    const specialite = await ctx.prisma.specialite.create({
      data: {
        code,
        libelle,
        description,
        ordre: (maxOrdre._max.ordre ?? 0) + 1,
        actif: true,
        selectionnee: false,
      },
      include: {
        typesDocuments: {
          where: { actif: true },
          orderBy: [{ ordre: "asc" }, { libelle: "asc" }],
        },
        workflowEtapes: {
          where: { actif: true },
          orderBy: [{ ordre: "asc" }],
        },
      },
    });

    await logAudit(ctx.prisma, ctx.userId, "specialite_created", "specialite", specialite.id, {
      code,
      libelle,
    });

    return NextResponse.json(specialite, { status: 201 });
  } catch (error) {
    console.error("Create specialite error", error);
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      return NextResponse.json({ error: "Ce code de spécialité existe déjà." }, { status: 409 });
    }
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
