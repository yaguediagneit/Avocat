import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";
import { z } from "zod";

const mailUpdateSchema = z.object({
  mailDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  reference: z.string().optional().nullable(),
  structure: z.string().optional().nullable(),
  contact: z.string().optional().nullable(),
  subject: z.string().min(1).optional(),
  body: z.string().optional().nullable(),
  status: z.enum(["recu", "a_traiter", "traite", "envoye", "brouillon", "signe"]).optional(),
  dossierId: z.string().uuid().optional().nullable(),
  dossierLabel: z.string().optional().nullable(),
  signataireId: z.string().uuid().optional().nullable(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await guard(req);
  if (ctx instanceof NextResponse) return ctx;

  try {
    const body = await req.json();
    const parsed = mailUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { id } = params;
    const existing = await ctx.prisma.mail.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Courrier non trouvé" }, { status: 404 });
    }

    const data: Record<string, unknown> = { ...parsed.data };
    if (parsed.data.mailDate) {
      data.mailDate = new Date(`${parsed.data.mailDate}T00:00:00.000Z`);
    }

    const updated = await ctx.prisma.mail.update({
      where: { id },
      data,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Update mail error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
