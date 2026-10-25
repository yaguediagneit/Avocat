import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";

export async function GET(req: NextRequest) {
  const ctx = await guard(req, { resource: "comptabilite", action: "read" });
  if (ctx instanceof NextResponse) return ctx;

  const [users, employees] = await Promise.all([
    ctx.prisma.user.findMany({
      where: {
        actif: true,
        clientId: null,
        role: { estClient: false },
      },
      include: { role: { select: { estClient: true } } },
      orderBy: [{ nom: "asc" }, { prenom: "asc" }],
    }),
    ctx.prisma.employee.findMany({
      where: { isActive: true },
      select: { email: true },
    }),
  ]);

  const usedEmails = new Set(employees.map((e: any) => e.email).filter(Boolean));
  const available = users.filter((u: any) => !usedEmails.has(u.email));

  return NextResponse.json(
    available.map((u: any) => ({
      id: u.id,
      prenom: u.prenom,
      nom: u.nom,
      email: u.email,
    }))
  );
}
