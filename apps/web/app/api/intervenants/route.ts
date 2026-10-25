import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";

export async function GET(req: NextRequest) {
  const ctx = await guard(req);
  if (ctx instanceof NextResponse) return ctx;

  const { searchParams } = new URL(req.url);
  const role = searchParams.get("role") || "";

  if (!role) {
    return NextResponse.json([], { status: 400 });
  }

  const users = await ctx.prisma.user.findMany({
    where: {
      actif: true,
      OR: [
        { role: { nom: { contains: role, mode: "insensitive" } } },
        { specialite: { contains: role, mode: "insensitive" } },
      ],
    },
    select: { id: true, prenom: true, nom: true },
    orderBy: [{ nom: "asc" }, { prenom: "asc" }],
  });

  return NextResponse.json(users);
}
