import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";
import { logAudit } from "@/lib/audit";
import { uploadDocument } from "@/lib/s3";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await guard(req, { resource: "comptabilite", action: "write" });
  if (ctx instanceof NextResponse) return ctx;

  try {
    const payroll = await ctx.prisma.payroll.findUnique({
      where: { id: params.id },
      select: { id: true, employee: { select: { firstName: true, lastName: true } } },
    });
    if (!payroll) return NextResponse.json({ error: "Bulletin introuvable" }, { status: 404 });

    const formData = await req.formData().catch(() => null);
    if (!formData) return NextResponse.json({ error: "Aucun fichier reçu" }, { status: 400 });

    const file = formData.get("file");
    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: "Fichier invalide" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = (file as any).name?.split(".").pop() || "pdf";
    const key = `payrolls/${params.id}/signed_${Date.now()}.${ext}`;

    await uploadDocument(key, buffer, file.type || "application/pdf");

    await ctx.prisma.payroll.update({
      where: { id: params.id },
      data: { signedDocumentUrl: key },
    });

    await logAudit(ctx.prisma, ctx.userId, "payroll_uploaded", "payroll", params.id);
    return NextResponse.json({ key });
  } catch (error) {
    console.error("Upload payslip error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
