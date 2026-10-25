import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";
import { logAudit } from "@/lib/audit";
import { uploadDocument, deleteDocument, getPresignedDownloadUrl } from "@/lib/s3";
import crypto from "crypto";

const ALLOWED_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};
const MAX_SIZE = 2 * 1024 * 1024;

export async function GET(req: NextRequest) {
  const ctx = await guard(req);
  if (ctx instanceof NextResponse) return ctx;

  const user = await ctx.prisma.user.findUnique({
    where: { id: ctx.userId },
    select: { signatureKey: true },
  });

  if (!user?.signatureKey) {
    return NextResponse.json({ url: null });
  }

  const url = await getPresignedDownloadUrl(user.signatureKey, 300);
  return NextResponse.json({ url });
}

export async function POST(req: NextRequest) {
  const ctx = await guard(req);
  if (ctx instanceof NextResponse) return ctx;

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Fichier requis" }, { status: 400 });
    }

    const ext = ALLOWED_TYPES[file.type];
    if (!ext) {
      return NextResponse.json(
        { error: "Format non supporté. Utilisez PNG, JPEG ou WebP." },
        { status: 400 }
      );
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    if (bytes.length === 0 || bytes.length > MAX_SIZE) {
      return NextResponse.json(
        { error: "Le fichier doit faire entre 1 octet et 2 Mo." },
        { status: 400 }
      );
    }

    const hash = crypto.createHash("sha256").update(bytes).digest("hex");
    const s3Key = `tenants/${ctx.tenantId}/signatures/${ctx.userId}/${hash}.${ext}`;

    const existing = await ctx.prisma.user.findUnique({
      where: { id: ctx.userId },
      select: { signatureKey: true },
    });

    await uploadDocument(s3Key, bytes, file.type);

    await ctx.prisma.user.update({
      where: { id: ctx.userId },
      data: { signatureKey: s3Key },
    });

    if (existing?.signatureKey && existing.signatureKey !== s3Key) {
      await deleteDocument(existing.signatureKey).catch(() => {});
    }

    await logAudit(ctx.prisma, ctx.userId, "signature_uploaded", "user", ctx.userId);

    const url = await getPresignedDownloadUrl(s3Key, 300);
    return NextResponse.json({ url }, { status: 201 });
  } catch (error) {
    console.error("Upload signature error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const ctx = await guard(req);
  if (ctx instanceof NextResponse) return ctx;

  try {
    const user = await ctx.prisma.user.findUnique({
      where: { id: ctx.userId },
      select: { signatureKey: true },
    });

    if (user?.signatureKey) {
      await deleteDocument(user.signatureKey).catch(() => {});
      await ctx.prisma.user.update({
        where: { id: ctx.userId },
        data: { signatureKey: null },
      });
      await logAudit(ctx.prisma, ctx.userId, "signature_deleted", "user", ctx.userId);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Delete signature error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
