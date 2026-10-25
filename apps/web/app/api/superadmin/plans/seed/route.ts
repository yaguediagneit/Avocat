import { NextRequest, NextResponse } from "next/server";
import { publicPrisma } from "@/lib/prisma";
import { guardSuperAdmin } from "@/lib/superadmin";

const MODULES = [
  "tableau",
  "dossiers",
  "clients",
  "calendrier",
  "taches",
  "missions",
  "documents",
  "factures",
  "comptabilite",
  "personnel",
  "charges",
  "rapports",
  "parametrage",
  "utilisateurs",
  "aide",
];

const DEFAULT_PLANS = [
  {
    code: "demarrage",
    nom: "Démarrage",
    joursEssai: 14,
    modules: ["tableau", "dossiers", "clients", "calendrier", "taches", "documents", "aide"],
    prixMensuel: 5000,
    prixAnnuel: 50000,
    ordre: 1,
  },
  {
    code: "pro",
    nom: "Pro",
    joursEssai: 14,
    modules: [...MODULES],
    prixMensuel: 25000,
    prixAnnuel: 250000,
    ordre: 2,
  },
  {
    code: "max",
    nom: "Max",
    joursEssai: 30,
    modules: [...MODULES],
    prixMensuel: 75000,
    prixAnnuel: 750000,
    ordre: 3,
  },
];

export async function POST(req: NextRequest) {
  const ok = await guardSuperAdmin(req);
  if (ok !== true) return ok;

  try {
    const created: unknown[] = [];
    for (const p of DEFAULT_PLANS) {
      const existing = await publicPrisma.plan.findUnique({ where: { code: p.code } });
      if (!existing) {
        const plan = await publicPrisma.plan.create({ data: { ...p, actif: true } });
        created.push(plan);
      }
    }
    return NextResponse.json({ created: created.length, plans: created }, { status: 201 });
  } catch (error) {
    console.error("Seed plans error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
