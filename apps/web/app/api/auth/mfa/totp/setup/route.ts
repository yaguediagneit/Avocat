import { NextRequest, NextResponse } from "next/server";
import * as speakeasy from "speakeasy";
import QRCode from "qrcode";
import { guard } from "@/lib/api-guard";
import { getSessionFromRequest } from "@/lib/session";

/**
 * POST — démarre l'activation du TOTP (Google/Microsoft Authenticator).
 * Génère un secret provisoire stocké en session ; l'utilisateur le confirme
 * avec un premier code via `/api/auth/mfa/totp/enable`.
 */
export async function POST(req: NextRequest) {
  const ctx = await guard(req);
  if (ctx instanceof NextResponse) return ctx;
  const res = ctx.res;

  try {
    const secret = speakeasy.generateSecret({
      name: `Avocat (${ctx.email})`,
      issuer: "Avocat",
      length: 32,
    });

    const session = await getSessionFromRequest(req, res);
    session.totpPendingSecret = secret.base32;
    await session.save();

    const qrDataUrl = await QRCode.toDataURL(secret.otpauth_url || "", { margin: 1 });

    return NextResponse.json(
      {
        otpauthUrl: secret.otpauth_url,
        secret: secret.base32,
        qrDataUrl,
      },
      { headers: res.headers }
    );
  } catch (error) {
    console.error("TOTP setup error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
