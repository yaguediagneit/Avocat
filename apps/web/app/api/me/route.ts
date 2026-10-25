import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";

export async function GET(req: NextRequest) {
  const ctx = await guard(req);
  if (ctx instanceof NextResponse) return ctx;

  const user = await ctx.prisma.user.findUnique({
    where: { id: ctx.userId },
    select: {
      id: true,
      prenom: true,
      nom: true,
      email: true,
      role: { select: { nom: true, estAdmin: true, estClient: true } },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "Utilisateur non trouvé" }, { status: 404 });
  }

  return NextResponse.json(user);
}
