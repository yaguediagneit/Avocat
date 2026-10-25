function getClientInfo(req: { headers: Headers }) {
  const forwarded = req.headers.get("x-forwarded-for");
  const adresseIp =
    (forwarded ? forwarded.split(",")[0].trim() : req.headers.get("x-real-ip")) ||
    "127.0.0.1";
  const userAgent = req.headers.get("user-agent") || "unknown";
  return { adresseIp, userAgent };
}

export async function logAudit(
  prisma: any,
  userId: string | null,
  action: string,
  entite: string,
  entiteId?: string | null,
  details?: Record<string, unknown> | null,
  req?: { headers: Headers } | null
) {
  try {
    const { adresseIp, userAgent } = req ? getClientInfo(req) : { adresseIp: "127.0.0.1", userAgent: "unknown" };
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        entite,
        entiteId: entiteId ?? undefined,
        details: (details as any) ?? {},
        adresseIp,
        userAgent,
      },
    });
  } catch (e) {
    // Ne jamais bloquer une action à cause d'un problème d'audit
    console.error("Audit log failed", e);
  }
}
