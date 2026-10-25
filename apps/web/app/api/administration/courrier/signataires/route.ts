import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";

const ALLOWED_ROLES = ["Avocat collaborateur", "Avocat responsable", "Associé / directeur"];

export async function GET(req: NextRequest) {
  const ctx = await guard(req);
  if (ctx instanceof NextResponse) return ctx;

  const users = await ctx.prisma.user.findMany({
    where: {
      actif: true,
      OR: [
        { role: { nom: { in: ALLOWED_ROLES } } },
        { role: { estAdmin: true } },
      ],
    },
    select: {
      id: true,
      prenom: true,
      nom: true,
      email: true,
      role: { select: { nom: true } },
    },
    orderBy: { nom: "asc" },
  });

  return NextResponse.json(users);
}
