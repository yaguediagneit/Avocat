import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await guard(req, { resource: "dossiers", action: "write" });
  if (ctx instanceof NextResponse) return ctx;

  try {
    const existing = await ctx.prisma.notification.findUnique({
      where: { id: params.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Notification introuvable" }, { status: 404 });
    }

    // Isolation : on ne peut marquer que ses propres notifications.
    if (existing.userId !== ctx.userId) {
      return NextResponse.json({ error: "Accès interdit" }, { status: 403 });
    }

    const notification = await ctx.prisma.notification.update({
      where: { id: params.id },
      data: {
        lu: true,
        luLe: new Date(),
      },
    });

    return NextResponse.json(notification);
  } catch (error) {
    console.error("Mark notification read error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
