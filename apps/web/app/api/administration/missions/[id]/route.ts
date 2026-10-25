import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";
import { z } from "zod";

const missionPatchSchema = z.object({
  profession: z.string().trim().min(1).max(100).optional(),
  providerName: z.string().min(1).optional(),
  reference: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  status: z.enum(["a_faire", "en_cours", "termine", "facture", "paye"]).optional(),
  amount: z.coerce.number().int().nonnegative().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
  completedDate: z.string().datetime().optional().nullable(),
  dossierId: z.string().uuid().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await guard(req);
  if (ctx instanceof NextResponse) return ctx;

  try {
    const body = await req.json();
    const parsed = missionPatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const data = parsed.data;
    const updateData: Record<string, unknown> = { ...data };
    if (data.dueDate !== undefined) {
      updateData.dueDate = data.dueDate ? new Date(data.dueDate) : null;
    }
    if (data.completedDate !== undefined) {
      updateData.completedDate = data.completedDate ? new Date(data.completedDate) : null;
    }

    const updated = await ctx.prisma.providerMission.update({
      where: { id: params.id },
      data: updateData,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Update provider mission error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
