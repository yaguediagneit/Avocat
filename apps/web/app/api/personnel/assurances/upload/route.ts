import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";
import { uploadDocument } from "@/lib/s3";

export async function POST(req: NextRequest) {
  const ctx = await guard(req, { resource: "comptabilite", action: "write" });
  if (ctx instanceof NextResponse) return ctx;

  try {
    const formData = await req.formData().catch(() => null);
    if (!formData) return NextResponse.json({ error: "Aucun fichier reçu" }, { status: 400 });

    const file = formData.get("file");
    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: "Fichier invalide" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = (file as any).name?.split(".").pop() || "pdf";
    const key = `assurances/insurance-contracts/${Date.now()}.${ext}`;

    await uploadDocument(key, buffer, file.type || "application/pdf");

    return NextResponse.json({ key });
  } catch (error) {
    console.error("Upload insurance file error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
