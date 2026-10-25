import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";
import { z } from "zod";
import { createAndSendMfaCode, MfaRateLimitError } from "@/lib/mfa-email";
import { tooManyRequests } from "@/lib/rate-limit";

const schema = z.object({
  email: z.string().email(),
  purpose: z.enum(["login", "password-reset"]),
});

export async function POST(req: NextRequest) {
  const ctx = await guard(req);
  if (ctx instanceof NextResponse) return ctx;

  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    if (parsed.data.email.toLowerCase() !== ctx.email.toLowerCase()) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    await createAndSendMfaCode(ctx.prisma, ctx.email, parsed.data.purpose);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof MfaRateLimitError) {
      return tooManyRequests({ ok: false, remaining: 0, retryAfter: error.retryAfter });
    }
    console.error("Send MFA email error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
