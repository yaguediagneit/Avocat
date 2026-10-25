import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";

export async function GET(req: NextRequest) {
  const ctx = await guard(req, { resource: "comptabilite", action: "read" });
  if (ctx instanceof NextResponse) return ctx;

  const { searchParams } = new URL(req.url);
  const classe = searchParams.get("classe");
  const q = searchParams.get("q")?.trim();
  const rawTake = Number(searchParams.get("take") || "200");
  const take = Math.min(Math.max(rawTake, 1), 2000);

  const accounts = await ctx.prisma.accountingAccount.findMany({
    where: {
      ...(classe ? { class: Number(classe) } : {}),
      ...(q
        ? {
            OR: [
              { accountCode: { contains: q, mode: "insensitive" } },
              { label: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ class: "asc" }, { accountCode: "asc" }],
    take,
  });

  return NextResponse.json(accounts);
}
