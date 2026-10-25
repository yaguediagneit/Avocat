import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

const hearingSchema = z.object({
  type: z.enum(["audience", "reunion"]),
  title: z.string().min(1),
  date: z.coerce.date(),
  location: z.string().optional().nullable(),
  dossierId: z.string().uuid().optional().nullable(),
  attendees: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  status: z.enum(["planifie", "termine", "annule"]).optional(),
});

export async function GET(req: NextRequest) {
  const ctx = await guard(req);
  if (ctx instanceof NextResponse) return ctx;

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") || undefined;

  const hearings = await ctx.prisma.hearing.findMany({
    where: type ? { type } : undefined,
    orderBy: { date: "asc" },
    take: 200,
  });

  return NextResponse.json(hearings);
}

export async function POST(req: NextRequest) {
  const ctx = await guard(req);
  if (ctx instanceof NextResponse) return ctx;

  try {
    const body = await req.json();
    const parsed = hearingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { attendees, ...data } = parsed.data;
    const participants = (attendees || "")
      .split(",")
      .map((nom) => ({ nom: nom.trim() }))
      .filter((p) => p.nom);

    const created = await ctx.prisma.$transaction(async (tx) => {
      const hearing = await tx.hearing.create({
        data: {
          ...data,
          attendees,
          date: new Date(data.date),
          createdBy: ctx.userId,
        },
      });

      if (hearing.status !== "annule") {
        const dossier = hearing.dossierId
          ? await tx.dossier.findUnique({
              where: { id: hearing.dossierId },
              select: { id: true },
            })
          : null;
        const evenement = await tx.evenement.create({
          data: {
            createurId: ctx.userId,
            dossierId: dossier?.id ?? null,
            type: hearing.type === "reunion" ? "rdv" : "audience",
            titre: hearing.title,
            dateDebut: hearing.date,
            lieu: hearing.location,
            participants,
          },
        });
        await logAudit(tx, ctx.userId, "evenement_created", "evenement", evenement.id);
      }

      return hearing;
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("Create hearing error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
