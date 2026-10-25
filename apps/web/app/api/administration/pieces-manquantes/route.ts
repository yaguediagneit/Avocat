import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";
import { z } from "zod";

const missingSchema = z.object({
  dossierId: z.string().uuid(),
  types: z.array(z.string().min(1)).min(1),
  description: z.string().optional().nullable(),
  status: z.enum(["manquant", "relance", "reçu", "annule"]).optional().default("manquant"),
  relanceDate: z.preprocess((val) => (val ? new Date(String(val)) : null), z.date().nullable()).optional(),
  notes: z.string().optional().nullable(),
});

export async function GET(req: NextRequest) {
  const ctx = await guard(req);
  if (ctx instanceof NextResponse) return ctx;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") || undefined;

  const missing = await ctx.prisma.missingDocument.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return NextResponse.json(missing);
}

export async function POST(req: NextRequest) {
  const ctx = await guard(req);
  if (ctx instanceof NextResponse) return ctx;

  try {
    const body = await req.json();
    const parsed = missingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const relanceDate = parsed.data.relanceDate ? new Date(parsed.data.relanceDate) : null;

    await ctx.prisma.missingDocument.createMany({
      data: parsed.data.types.map((t) => ({
        dossierId: parsed.data.dossierId,
        typeDocument: t,
        description: parsed.data.description,
        status: parsed.data.status,
        relanceDate,
        notes: parsed.data.notes,
        createdBy: ctx.userId,
      })),
      skipDuplicates: true,
    });

    return NextResponse.json({ count: parsed.data.types.length }, { status: 201 });
  } catch (error) {
    console.error("Create missing document error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
