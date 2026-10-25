import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { guard } from "@/lib/api-guard";
import { requestSignature } from "@/lib/signature";
import { logAudit } from "@/lib/audit";

const signSchema = z.object({
  documentId: z.string().uuid(),
  signataires: z.array(
    z.object({
      email: z.string().email(),
      prenom: z.string(),
      nom: z.string(),
    })
  ),
  message: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const ctx = await guard(req, { resource: "documents", action: "validate" });
  if (ctx instanceof NextResponse) return ctx;

  try {
    const body = await req.json();
    const parsed = signSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const result = await requestSignature(parsed.data);

    await logAudit(
      ctx.prisma,
      ctx.userId,
      "signature_requested",
      "document",
      parsed.data.documentId,
      { demandeId: result.demandeId }
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("Signature error", error);
    return NextResponse.json({ error: "Erreur signature" }, { status: 500 });
  }
}
