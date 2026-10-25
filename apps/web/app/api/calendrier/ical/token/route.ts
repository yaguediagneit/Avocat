import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";
import { logAudit } from "@/lib/audit";
import { randomBytes } from "crypto";

function generateToken(): string {
  return randomBytes(32).toString("hex");
}

export async function POST(req: NextRequest) {
  const ctx = await guard(req, { resource: "rendezVous", action: "read" });
  if (ctx instanceof NextResponse) return ctx;

  try {
    const currentUser = await ctx.prisma.user.findUnique({
      where: { id: ctx.userId },
      select: { calendarToken: true },
    });

    let token = currentUser?.calendarToken;

    if (!token) {
      token = generateToken();
      let existing = await ctx.prisma.user.findUnique({
        where: { calendarToken: token },
        select: { id: true },
      });
      let attempts = 0;
      while (existing && attempts < 5) {
        token = generateToken();
        existing = await ctx.prisma.user.findUnique({
          where: { calendarToken: token },
          select: { id: true },
        });
        attempts++;
      }

      if (existing) {
        return NextResponse.json(
          { error: "Impossible de générer un token unique" },
          { status: 500 }
        );
      }

      await ctx.prisma.user.update({
        where: { id: ctx.userId },
        data: { calendarToken: token },
      });

      await logAudit(
        ctx.prisma,
        ctx.userId,
        "calendar_token_generated",
        "user",
        ctx.userId,
        { tenantId: ctx.tenantId }
      );
    }

    const url = `${req.nextUrl.origin}/api/calendrier/ical?tenantId=${ctx.tenantId}&token=${token}`;

    return NextResponse.json({ url, token });
  } catch (error) {
    console.error("Generate calendar token error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
