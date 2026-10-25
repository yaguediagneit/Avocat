import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { guard } from "@/lib/api-guard";
import { logAudit } from "@/lib/audit";

const partageSchema = z.object({ partage: z.boolean() });

/// Partage du dossier avec le client (espace client).
/// Réservé au créateur du dossier, aux responsables (avocat/huissier) ou à
/// l'administrateur.
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await guard(req, { resource: "dossiers", action: "read" });
  if (ctx instanceof NextResponse) return ctx;

  try {
    const body = await req.json();
    const parsed = partageSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Paramètre invalide" }, { status: 400 });
    }

    const dossier = await ctx.prisma.dossier.findUnique({
      where: { id: params.id },
      select: {
        createurId: true,
        avocatResponsableId: true,
        huissierResponsableId: true,
      },
    });
    if (!dossier) {
      return NextResponse.json({ error: "Dossier non trouvé" }, { status: 404 });
    }

    const estAutorise =
      ctx.roleInfo.estAdmin ||
      dossier.createurId === ctx.userId ||
      dossier.avocatResponsableId === ctx.userId ||
      dossier.huissierResponsableId === ctx.userId;
    if (!estAutorise) {
      return NextResponse.json(
        { error: "Seuls le créateur, le responsable ou l'administrateur peuvent partager ce dossier." },
        { status: 403 }
      );
    }

    const updated = await ctx.prisma.dossier.update({
      where: { id: params.id },
      data: { partageClient: parsed.data.partage },
      select: { id: true, partageClient: true },
    });

    await logAudit(
      ctx.prisma,
      ctx.userId,
      parsed.data.partage ? "dossier_partage_client" : "dossier_partage_client_retire",
      "dossier",
      params.id
    );

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Partage dossier error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
