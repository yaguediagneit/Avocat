import { NextRequest, NextResponse } from "next/server";
import { guard, ensureDossierAccess } from "@/lib/api-guard";
import { getDossierScopedAccessFilter, canAccessDossier } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { uploadDocument } from "@/lib/s3";
import { getPresignedDownloadUrl } from "@/lib/s3";
import crypto from "crypto";

export async function GET(req: NextRequest) {
  const ctx = await guard(req, { resource: "documents", action: "read" });
  if (ctx instanceof NextResponse) return ctx;

  const accessFilter = await getDossierScopedAccessFilter(ctx.prisma, ctx.userId, ctx.roleInfo, "documents");
  const documents = await ctx.prisma.document.findMany({
    where: accessFilter,
    take: 100,
    orderBy: { createdAt: "desc" },
    include: { dossier: { select: { referenceInterne: true } } },
  });

  return NextResponse.json(documents);
}

export async function POST(req: NextRequest) {
  const ctx = await guard(req, { resource: "dossiers", action: "read" });
  if (ctx instanceof NextResponse) return ctx;

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const dossierId = formData.get("dossierId") as string;
    const categorie = formData.get("categorie") as string;

    if (!file || !dossierId || !categorie) {
      return NextResponse.json({ error: "Fichier, dossier et catégorie requis" }, { status: 400 });
    }

    const rawNom = (formData.get("nom") as string) || file.name || "document";
    const dotIndex = file.name.lastIndexOf(".");
    const fileExt = dotIndex > 0 && dotIndex < file.name.length - 1
      ? file.name.slice(dotIndex).toLowerCase()
      : "";
    const nom = fileExt && !rawNom.toLowerCase().endsWith(fileExt)
      ? `${rawNom}${fileExt}`
      : rawNom;
    const description = (formData.get("description") as string) || "";
    const publieClient = formData.get("publieClient") === "true";
    const partageExterne = formData.get("partageExterne") === "true";
    const typeDocument = (formData.get("typeDocument") as string) || null;
    const tacheId = (formData.get("tacheId") as string) || null;

    const encryptedDek = formData.get("encryptedDek") as File | null;
    const iv = formData.get("iv") as string | null;

    // Vérifie l'accès en lecture au dossier cible avant tout upload (consulté peut déposer).
    const dossierOk = await canAccessDossier(ctx.prisma, ctx.userId, ctx.roleInfo, dossierId, "read");
    if (!dossierOk) {
      return NextResponse.json({ error: "Accès interdit à ce dossier" }, { status: 403 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const hash = crypto.createHash("sha256").update(bytes).digest("hex");

    const s3Key = `tenants/${ctx.tenantId}/dossiers/${dossierId}/${hash}`;
    await uploadDocument(s3Key, bytes, file.type || "application/octet-stream");

    const metadata: Record<string, unknown> = { description, originalType: file.type || null };
    if (typeDocument) metadata.typeDocument = typeDocument;
    if (tacheId) metadata.tacheId = tacheId;
    if (iv && encryptedDek) {
      const dekBytes = Buffer.from(await encryptedDek.arrayBuffer());
      metadata.iv = iv;
      metadata.encryptedDek = dekBytes.toString("base64");
      metadata.chiffre = true;
    }

    const document = await ctx.prisma.document.create({
      data: {
        dossierId,
        nom,
        categorie,
        s3KeyChiffre: s3Key,
        hashSha256: hash,
        taille: bytes.length,
        publieClient,
        partageExterne,
        datePublication: publieClient ? new Date() : null,
        creePar: ctx.userId,
        metadata: metadata as any,
      },
    });

    await logAudit(ctx.prisma, ctx.userId, "document_uploaded", "document", document.id);
    return NextResponse.json(document, { status: 201 });
  } catch (error) {
    console.error("Upload document error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
