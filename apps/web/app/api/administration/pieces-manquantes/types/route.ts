import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";
import { canAccessDossier } from "@/lib/rbac";
import { findSpecialiteForTypeAffaire } from "@/lib/specialite";

export async function GET(req: NextRequest) {
  const ctx = await guard(req, { resource: "dossiers", action: "read" });
  if (ctx instanceof NextResponse) return ctx;

  const { searchParams } = new URL(req.url);
  const dossierId = searchParams.get("dossierId");

  if (!dossierId) {
    return NextResponse.json([]);
  }

  const accessOk = await canAccessDossier(ctx.prisma, ctx.userId, ctx.roleInfo, dossierId, "read");
  if (!accessOk) {
    return NextResponse.json({ error: "Accès interdit" }, { status: 403 });
  }

  const dossier = await ctx.prisma.dossier.findUnique({
    where: { id: dossierId },
    select: { typeAffaire: true },
  });
  if (!dossier) {
    return NextResponse.json({ error: "Dossier introuvable" }, { status: 404 });
  }

  const [paramType, specialites] = await Promise.all([
    ctx.prisma.parametre.findFirst({
      where: { categorie: "type_affaire", code: dossier.typeAffaire },
      select: { libelle: true },
    }),
    ctx.prisma.specialite.findMany({
      where: { actif: true },
      select: { id: true, code: true, libelle: true },
    }),
  ]);

  const specialite = findSpecialiteForTypeAffaire(dossier.typeAffaire, paramType?.libelle, specialites);
  if (!specialite) {
    return NextResponse.json([]);
  }

  const types = await ctx.prisma.typeDocumentSpecialite.findMany({
    where: { specialiteId: specialite.id, actif: true },
    orderBy: [{ obligatoire: "desc" }, { ordre: "asc" }, { libelle: "asc" }],
    select: { id: true, code: true, libelle: true, description: true, obligatoire: true },
  });

  return NextResponse.json(types);
}
