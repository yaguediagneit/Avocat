import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";
import { z } from "zod";

const requestSchema = z.object({
  type: z.enum(["info", "dossier", "rendezvous", "document", "autre"]),
  subject: z.string().min(1),
  description: z.string().optional(),
  clientId: z.string().uuid().optional().nullable(),
  requesterName: z.string().min(1),
  requesterPhone: z.string().min(1),
  requesterEmail: z.string().email(),
  requestDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
  responseStatus: z.enum(["en_attente", "repondu"]).optional().default("en_attente"),
  responseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  responseDetail: z.string().optional().nullable(),
});

export async function GET(req: NextRequest) {
  const ctx = await guard(req);
  if (ctx instanceof NextResponse) return ctx;

  const requests = await ctx.prisma.clientRequest.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json(requests);
}

export async function POST(req: NextRequest) {
  const ctx = await guard(req);
  if (ctx instanceof NextResponse) return ctx;

  try {
    const body = await req.json();
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const created = await ctx.prisma.clientRequest.create({
      data: {
        ...parsed.data,
        requestDate: new Date(parsed.data.requestDate),
        responseDate: parsed.data.responseDate ? new Date(parsed.data.responseDate) : null,
        createdBy: ctx.userId,
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("Create client request error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
