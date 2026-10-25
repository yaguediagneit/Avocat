import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";
import { z } from "zod";
import crypto from "crypto";
import { resolveMissionTemplateKey } from "@/lib/mission-templates";

const missionSchema = z.object({
  profession: z.string().trim().min(1, "Veuillez sélectionner une profession").max(100),
  providerName: z.string().min(1),
  reference: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  status: z.enum(["a_faire", "en_cours", "termine", "facture", "paye"]).optional(),
  amount: z.coerce.number().int().nonnegative().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
  completedDate: z.string().datetime().optional().nullable(),
  dossierId: z.string().uuid().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function GET(req: NextRequest) {
  const ctx = await guard(req);
  if (ctx instanceof NextResponse) return ctx;

  const { searchParams } = new URL(req.url);
  const profession = searchParams.get("profession") || undefined;
  const status = searchParams.get("status") || undefined;

  const where: any = {};
  if (profession) {
    // Les anciennes missions stockent le code (« huissier »), les nouvelles
    // le nom du rôle (« Huissier de justice ») : on matche les deux.
    const key = resolveMissionTemplateKey(profession);
    where.profession = key !== profession ? { in: [profession, key] } : profession;
  }
  if (status) where.status = status;

  const missions = await ctx.prisma.providerMission.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return NextResponse.json(missions);
}

export async function POST(req: NextRequest) {
  const ctx = await guard(req);
  if (ctx instanceof NextResponse) return ctx;

  try {
    const body = await req.json();
    const parsed = missionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const reference = parsed.data.reference || `ORD-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

    const created = await ctx.prisma.providerMission.create({
      data: {
        ...parsed.data,
        reference,
        dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
        completedDate: parsed.data.completedDate ? new Date(parsed.data.completedDate) : null,
        createdBy: ctx.userId,
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("Create provider mission error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
