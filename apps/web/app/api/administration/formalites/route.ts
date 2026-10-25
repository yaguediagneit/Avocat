import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";
import { z } from "zod";

const formalitySchema = z.object({
  title: z.string().min(1),
  type: z.enum(["tribunal", "administration"]),
  entity: z.string().min(1),
  status: z.enum(["en_cours", "soumis", "finalise", "rejete"]).optional(),
  dueDate: z.string().datetime().optional().nullable(),
  completedDate: z.string().datetime().optional().nullable(),
  dossierId: z.string().uuid().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function GET(req: NextRequest) {
  const ctx = await guard(req);
  if (ctx instanceof NextResponse) return ctx;

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") || undefined;
  const status = searchParams.get("status") || undefined;

  const where: any = {};
  if (type) where.type = type;
  if (status) where.status = status;

  const formalities = await ctx.prisma.courtFormality.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return NextResponse.json(formalities);
}

export async function POST(req: NextRequest) {
  const ctx = await guard(req);
  if (ctx instanceof NextResponse) return ctx;

  try {
    const body = await req.json();
    const parsed = formalitySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const created = await ctx.prisma.courtFormality.create({
      data: {
        ...parsed.data,
        dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
        completedDate: parsed.data.completedDate ? new Date(parsed.data.completedDate) : null,
        createdBy: ctx.userId,
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("Create court formality error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
