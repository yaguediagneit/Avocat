import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { guard } from "@/lib/api-guard";
import { getSessionFromRequest } from "@/lib/session";
import { verifyTotp } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

const schema = z.object({ token: z.string().length(6) });

/**
 * POST — confirme l'activation TOTP : vérifie le premier code produit par
 * l'application d'authentification puis enregistre le secret sur le compte.
 */
export async function POST(req: NextRequest) {
  const ctx = await guard(req);
  if (ctx instanceof NextResponse) return ctx;
  const res = new NextResponse();

  try {
    const session = await getSessionFromRequest(req, res);
    const pending = session.totpPendingSecret;
    if (!pending) {
      return NextResponse.json(
        { error: "Aucune activation TOTP en cours. Recommencez." },
        { status: 400 }
      );
    }

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Code invalide" }, { status: 400 });
    }

    if (!verifyTotp(pending, parsed.data.token)) {
      return NextResponse.json({ error: "Code incorrect" }, { status: 401 });
    }

    await ctx.prisma.user.update({
      where: { id: ctx.userId },
      data: { mfaSecret: pending, mfaEnabled: true },
    });

    delete session.totpPendingSecret;
    session.totpSetupRequired = false;
    await session.save();

    await logAudit(ctx.prisma, ctx.userId, "totp_enabled", "user", ctx.userId);
    return NextResponse.json({ ok: true, isClient: ctx.isClient }, { headers: res.headers });
  } catch (error) {
    console.error("TOTP enable error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
