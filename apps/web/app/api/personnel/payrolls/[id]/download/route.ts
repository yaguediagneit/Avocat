import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getRoleByName, hasPermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { getPresignedDownloadUrl } from "@/lib/s3";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session.userId || !session.mfaVerified) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const [user, payroll] = await Promise.all([
      prisma.user.findUnique({
        where: { id: session.userId },
        select: { email: true, role: { select: { nom: true } } },
      }),
      prisma.payroll.findUnique({
        where: { id: params.id },
        include: { employee: { select: { email: true } } },
      }),
    ]);

    if (!user || !payroll) {
      return NextResponse.json({ error: "Non trouvé" }, { status: 404 });
    }

    const role = await getRoleByName(prisma as any, user.role.nom);
    const isOwner = payroll.employee?.email && payroll.employee.email === user.email;
    const canRead = role && hasPermission(role, "comptabilite", "read");

    if (!isOwner && !canRead) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    if (!payroll.signedDocumentUrl) {
      return NextResponse.json({ error: "Aucun bulletin signé disponible" }, { status: 404 });
    }

    const url = await getPresignedDownloadUrl(payroll.signedDocumentUrl, 300);
    return NextResponse.redirect(url);
  } catch (error) {
    console.error("Download payslip error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
