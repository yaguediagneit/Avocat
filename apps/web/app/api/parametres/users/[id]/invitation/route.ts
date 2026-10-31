import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";
import { createInvitation, invitationUrl } from "@/lib/invitation";
import { logAudit } from "@/lib/audit";

/**
 * POST — génère (ou régénère) un lien d'invitation à usage unique pour
 * l'utilisateur. Les invitations précédentes sont invalidées.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await guard(req, { resource: "users", action: "write" });
  if (ctx instanceof NextResponse) return ctx;

  try {
    const user = await ctx.prisma.user.findUnique({
      where: { id: params.id },
      select: { id: true, email: true },
    });
    if (!user) {
      return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
    }

    const { token } = await createInvitation(ctx.prisma, user.id);
    const origin = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;

    await logAudit(ctx.prisma, ctx.userId, "user_invitation", "user", user.id);
    return NextResponse.json({
      invitationUrl: `${invitationUrl(origin, token)}?t=${ctx.tenantId}`,
      email: user.email,
    });
  } catch (error) {
    console.error("Create invitation error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
