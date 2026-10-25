import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";
import { uploadDocument, deleteDocument } from "@/lib/s3";

/**
 * GET — vérifie si un modèle Word existe pour ce TacheTemplate.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await guard(req, { resource: "parametres", action: "read" });
  if (ctx instanceof NextResponse) return ctx;

  const template = await ctx.prisma.tacheTemplate.findUnique({
    where: { id: params.id },
    select: { id: true, wordTemplateKey: true, titre: true },
  });

  if (!template) {
    return NextResponse.json({ error: "Modèle non trouvé" }, { status: 404 });
  }

  return NextResponse.json({ hasWordTemplate: !!template.wordTemplateKey });
}

/**
 * POST — téléverse un fichier .docx comme modèle Word pour ce TacheTemplate.
 * Le fichier est stocké dans MinIO et la clé S3 est enregistrée sur le template.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await guard(req, { resource: "parametres", action: "write" });
  if (ctx instanceof NextResponse) return ctx;

  const template = await ctx.prisma.tacheTemplate.findUnique({
    where: { id: params.id },
    select: { id: true, wordTemplateKey: true },
  });

  if (!template) {
    return NextResponse.json({ error: "Modèle non trouvé" }, { status: 404 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "Aucun fichier fourni" }, { status: 400 });
  }

  const fileName = file.name.toLowerCase();
  if (!fileName.endsWith(".docx")) {
    return NextResponse.json({ error: "Le fichier doit être au format .docx" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // Supprimer l'ancien modèle s'il existe
  if (template.wordTemplateKey) {
    try {
      await deleteDocument(template.wordTemplateKey);
    } catch {}
  }

  const s3Key = `tenants/${ctx.tenantId}/word-templates/${template.id}/${Date.now()}-${file.name}`;
  await uploadDocument(s3Key, buffer, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");

  await ctx.prisma.tacheTemplate.update({
    where: { id: template.id },
    data: { wordTemplateKey: s3Key },
  });

  return NextResponse.json({
    ok: true,
    wordTemplateKey: s3Key,
  });
}

/**
 * DELETE — supprime le modèle Word associé au TacheTemplate.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await guard(req, { resource: "parametres", action: "write" });
  if (ctx instanceof NextResponse) return ctx;

  const template = await ctx.prisma.tacheTemplate.findUnique({
    where: { id: params.id },
    select: { id: true, wordTemplateKey: true },
  });

  if (!template) {
    return NextResponse.json({ error: "Modèle non trouvé" }, { status: 404 });
  }

  if (template.wordTemplateKey) {
    try {
      await deleteDocument(template.wordTemplateKey);
    } catch {}
    await ctx.prisma.tacheTemplate.update({
      where: { id: template.id },
      data: { wordTemplateKey: null },
    });
  }

  return NextResponse.json({ ok: true });
}
