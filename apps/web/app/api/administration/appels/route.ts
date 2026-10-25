import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";
import { z } from "zod";

const callSchema = z.object({
  direction: z.enum(["entrant", "sortant"]),
  callDate: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/).optional().nullable(),
  channel: z.enum(["telephone", "visioconference", "autre"]).optional().default("telephone"),
  contactName: z.string().optional().nullable(),
  structure: z.string().optional().nullable(),
  subject: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  clientId: z.string().uuid().optional().nullable(),
  employeeId: z.string().uuid().optional().nullable(),
});

export async function GET(req: NextRequest) {
  const ctx = await guard(req);
  if (ctx instanceof NextResponse) return ctx;

  const calls = await ctx.prisma.callLog.findMany({
    orderBy: { callDate: "desc" },
    take: 100,
  });

  return NextResponse.json(calls);
}

export async function POST(req: NextRequest) {
  const ctx = await guard(req);
  if (ctx instanceof NextResponse) return ctx;

  try {
    const body = await req.json();
    const parsed = callSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const created = await ctx.prisma.callLog.create({
      data: {
        ...parsed.data,
        callDate: new Date(parsed.data.callDate),
        endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : null,
        createdBy: ctx.userId,
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("Create call log error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
