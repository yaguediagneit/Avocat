import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { guard } from "@/lib/api-guard";
import { verifyTotp } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

const schema = z.object({ token: z.string().length(6) });

/**
 * POST — désactive le TOTP : exige un code valide de l'application
 * d'authentification avant de supprimer le secret.
 */
export async function POST(req: NextRequest) {
  const ctx = await guard(req);
  if (ctx instanceof NextResponse) return ctx;

  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Code invalide" }, { status: 400 });
    }

    const user = await ctx.prisma.user.findUnique({
      where: { id: ctx.userId },
      select: { mfaSecret: true, mfaEnabled: true },
    });
    if (!user?.mfaEnabled || !user.mfaSecret) {
      return NextResponse.json({ error: "Le TOTP n'est pas activé." }, { status: 400 });
    }

    if (!verifyTotp(user.mfaSecret, parsed.data.token)) {
      return NextResponse.json({ error: "Code incorrect" }, { status: 401 });
    }

    await ctx.prisma.user.update({
      where: { id: ctx.userId },
      data: { mfaEnabled: false, mfaSecret: null },
    });

    await logAudit(ctx.prisma, ctx.userId, "totp_disabled", "user", ctx.userId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("TOTP disable error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
