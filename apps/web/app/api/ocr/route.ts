import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";
import { extractTextFromImage } from "@/lib/ocr";

export async function POST(req: NextRequest) {
  const ctx = await guard(req, { resource: "documents", action: "read" });
  if (ctx instanceof NextResponse) return ctx;

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Fichier manquant" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const text = await extractTextFromImage(buffer);

    return NextResponse.json({ text });
  } catch (error) {
    console.error("OCR error", error);
    return NextResponse.json({ error: "Erreur OCR" }, { status: 500 });
  }
}
