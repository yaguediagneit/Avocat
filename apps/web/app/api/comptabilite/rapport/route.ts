import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";
import { generateFinancialReport } from "@/lib/reporting";

export async function GET(req: NextRequest) {
  const ctx = await guard(req, { resource: "comptabilite", action: "read" });
  if (ctx instanceof NextResponse) return ctx;

  const { searchParams } = new URL(req.url);
  const exercice = parseInt(searchParams.get("exercice") || String(new Date().getFullYear()), 10);
  const mois = searchParams.get("mois");
  const debut = searchParams.get("debut");
  const fin = searchParams.get("fin");

  let dateDebut = new Date(`${exercice}-01-01`);
  let dateFin = new Date(`${exercice}-12-31T23:59:59`);

  if (debut && fin) {
    dateDebut = new Date(debut);
    dateFin = new Date(fin + "T23:59:59");
  } else if (mois) {
    const m = parseInt(mois, 10);
    dateDebut = new Date(`${exercice}-${String(m).padStart(2, "0")}-01`);
    dateFin = new Date(exercice, m, 0, 23, 59, 59);
  }

  const report = await generateFinancialReport(ctx.prisma, ctx.tenantId, { exercice, dateDebut, dateFin });
  return NextResponse.json(report);
}
