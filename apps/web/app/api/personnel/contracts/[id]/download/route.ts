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
    const [user, contract] = await Promise.all([
      prisma.user.findUnique({
        where: { id: session.userId },
        select: { email: true, role: { select: { nom: true } } },
      }),
      prisma.employmentContract.findUnique({
        where: { id: params.id },
        include: { employee: { select: { email: true } } },
      }),
    ]);

    if (!user || !contract) {
      return NextResponse.json({ error: "Non trouvé" }, { status: 404 });
    }

    const role = await getRoleByName(prisma as any, user.role.nom);
    const isOwner = contract.employee?.email && contract.employee.email === user.email;
    const canRead = role && hasPermission(role, "comptabilite", "read");

    if (!isOwner && !canRead) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    if (!contract.documentPath) {
      return NextResponse.json({ error: "Aucun contrat signé disponible" }, { status: 404 });
    }

    const url = await getPresignedDownloadUrl(contract.documentPath, 300);
    return NextResponse.redirect(url);
  } catch (error) {
    console.error("Download contract error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
