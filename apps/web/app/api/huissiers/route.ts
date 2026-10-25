import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";

export async function GET(req: NextRequest) {
  const ctx = await guard(req, { resource: "missions", action: "read" });
  if (ctx instanceof NextResponse) return ctx;

  const users = await ctx.prisma.user.findMany({
    where: {
      actif: true,
      role: { nom: "Huissier de justice" },
    },
    select: { id: true, prenom: true, nom: true },
    orderBy: { nom: "asc" },
  });

  return NextResponse.json(users);
}
