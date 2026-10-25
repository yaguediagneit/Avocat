import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { guard } from "@/lib/api-guard";

const schema = z.object({
  code: z.string().min(1),
  label: z.string().min(1),
  accountCode: z.string().min(1),
  journalCode: z.string().optional(),
  isActive: z.boolean().default(true),
});

export async function GET(req: NextRequest) {
  const ctx = await guard(req, { resource: "parametres", action: "read" });
  if (ctx instanceof NextResponse) return ctx;

  const mappings = await ctx.prisma.accountMapping.findMany({
    orderBy: { code: "asc" },
  });
  return NextResponse.json(mappings);
}

export async function POST(req: NextRequest) {
  const ctx = await guard(req, { resource: "parametres", action: "write" });
  if (ctx instanceof NextResponse) return ctx;

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const created = await ctx.prisma.accountMapping.create({ data: parsed.data });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur création mapping" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const ctx = await guard(req, { resource: "parametres", action: "write" });
  if (ctx instanceof NextResponse) return ctx;

  const body = await req.json();
  const { id, ...data } = body;
  if (!id) return NextResponse.json({ error: "ID requis" }, { status: 400 });

  try {
    const updated = await ctx.prisma.accountMapping.update({
      where: { id },
      data: { ...data, updatedAt: new Date() },
    });
    return NextResponse.json(updated);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur mise à jour" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const ctx = await guard(req, { resource: "parametres", action: "delete" });
  if (ctx instanceof NextResponse) return ctx;

  if (!ctx.roleInfo.estAdmin) {
    return NextResponse.json({ error: "Seul un administrateur peut supprimer un mapping comptable" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID requis" }, { status: 400 });

  try {
    // Désactivation (soft delete) : le mapping est conservé pour la traçabilité.
    await ctx.prisma.accountMapping.update({ where: { id }, data: { isActive: false } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur suppression" }, { status: 500 });
  }
}
