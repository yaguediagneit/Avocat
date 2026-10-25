import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";
import { z } from "zod";

const mailSchema = z.object({
  direction: z.enum(["entrant", "sortant"]),
  mailDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
  reference: z.string().optional().nullable(),
  structure: z.string().optional().nullable(),
  contact: z.string().optional().nullable(),
  subject: z.string().min(1),
  body: z.string().optional().nullable(),
  status: z.enum(["recu", "a_traiter", "traite", "envoye", "brouillon", "signe"]).optional(),
  dossierId: z.string().uuid().optional().nullable(),
  dossierLabel: z.string().optional().nullable(),
  signataireId: z.string().uuid().optional().nullable(),
});

export async function GET(req: NextRequest) {
  const ctx = await guard(req);
  if (ctx instanceof NextResponse) return ctx;

  const { searchParams } = new URL(req.url);
  const direction = searchParams.get("direction") || undefined;
  const status = searchParams.get("status") || undefined;

  const where: any = {};
  if (direction) where.direction = direction;
  if (status) where.status = status;

  const mails = await ctx.prisma.mail.findMany({
    where,
    orderBy: { mailDate: "desc" },
    take: 200,
  });

  return NextResponse.json(mails);
}

export async function POST(req: NextRequest) {
  const ctx = await guard(req);
  if (ctx instanceof NextResponse) return ctx;

  try {
    const body = await req.json();
    const parsed = mailSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { mailDate, ...rest } = parsed.data;
    const refDate = new Date(`${mailDate}T00:00:00.000Z`);
    const datePrefix = [
      refDate.getUTCFullYear(),
      String(refDate.getUTCMonth() + 1).padStart(2, "0"),
      String(refDate.getUTCDate()).padStart(2, "0"),
    ].join("");

    let reference = rest.reference;
    if (!reference) {
      const count = await ctx.prisma.mail.count({
        where: {
          mailDate: { gte: refDate, lt: new Date(refDate.getTime() + 24 * 60 * 60 * 1000) },
        },
      });
      reference = `${datePrefix}-${String(count + 1).padStart(3, "0")}`;
    }

    const created = await ctx.prisma.mail.create({
      data: {
        ...rest,
        reference,
        mailDate: refDate,
        createdBy: ctx.userId,
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("Create mail error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
