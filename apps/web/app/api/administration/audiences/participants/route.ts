import { NextRequest, NextResponse } from "next/server";
import { guard, ensureDossierAccess } from "@/lib/api-guard";

export async function GET(req: NextRequest) {
  const ctx = await guard(req, { resource: "dossiers", action: "read" });
  if (ctx instanceof NextResponse) return ctx;

  const { searchParams } = new URL(req.url);
  const dossierId = searchParams.get("dossierId");

  if (!dossierId) {
    return NextResponse.json({ error: "dossierId requis" }, { status: 400 });
  }

  const access = await ensureDossierAccess(ctx, dossierId, "read");
  if (access !== true) return access;

  const dossier = await ctx.prisma.dossier.findUnique({
    where: { id: dossierId },
    include: { client: true },
  });

  if (!dossier) {
    return NextResponse.json({ error: "Dossier non trouvé" }, { status: 404 });
  }

  const collaborateurs = await ctx.prisma.dossierCollaborateur.findMany({
    where: { dossierId },
    select: { userId: true },
  });

  const responsableIds = new Set(
    [dossier.avocatResponsableId, dossier.huissierResponsableId].filter(Boolean) as string[]
  );
  const intervenantIds = new Set(collaborateurs.map((c) => c.userId));
  const userIds = Array.from(new Set([...responsableIds, ...intervenantIds]));

  const users = await ctx.prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, prenom: true, nom: true, role: { select: { nom: true } } },
  });

  const participants = users.map((u) => ({
    id: u.id,
    prenom: u.prenom || "",
    nom: u.nom || "",
    role: responsableIds.has(u.id) ? "Responsable" : "Intervenant",
    roleNom: u.role?.nom || "",
  }));

  if (dossier.client) {
    participants.push({
      id: dossier.clientId,
      prenom: "",
      nom: dossier.client.raisonSociale || "Client",
      role: "Participant",
      roleNom: "",
    });
  }

  return NextResponse.json(participants);
}
