import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { guard } from "@/lib/api-guard";
import { getDossierScopedAccessFilter, canAccessDossier } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";

const lineSchema = z.object({
  description: z.string().min(1),
  quantite: z.number().int().min(0).default(1),
  prixUnitaire: z.number().int().min(0).default(0),
  tauxTva: z.number().min(0).max(100).default(0),
  totalHt: z.number().int().min(0).default(0),
  totalTva: z.number().int().min(0).default(0),
  totalTtc: z.number().int().min(0).default(0),
  ordre: z.number().int().default(0),
});

const factureSchema = z.object({
  dossierId: z.string().uuid().optional().nullable(),
  tacheId: z.string().uuid().optional().nullable(),
  missionId: z.string().uuid().optional().nullable(),
  clientId: z.string().uuid(),
  numero: z.string().min(1),
  libelle: z.string().min(1),
  designation: z.string().optional(),
  dateEcheance: z.string().datetime().nullable().optional(),
  tvaEnabled: z.boolean().default(false),
  tvaRateId: z.string().uuid().nullable().optional(),
  lines: z.array(lineSchema).min(1),
});

export async function GET(req: NextRequest) {
  const ctx = await guard(req, { resource: "factures", action: "read" });
  if (ctx instanceof NextResponse) return ctx;

  const accessFilter = await getDossierScopedAccessFilter(ctx.prisma, ctx.userId, ctx.roleInfo, "factures");
  const dossierIds = (accessFilter as any).dossierId?.in as string[] | undefined;

  const where =
    !dossierIds || dossierIds.length === 0
      ? {}
      : {
          OR: [
            { dossierId: { in: dossierIds } },
            { tache: { dossierId: { in: dossierIds } } },
            { missionHuissier: { dossierId: { in: dossierIds } } },
          ],
        };

  const factures = await ctx.prisma.facture.findMany({
    where,
    take: 100,
    include: {
      dossier: { select: { referenceInterne: true } },
      tache: { select: { titre: true } },
      missionHuissier: { select: { typeActe: true } },
      client: { select: { raisonSociale: true } },
      paiements: true,
      lines: { orderBy: { ordre: "asc" } },
    },
    orderBy: { dateEmission: "desc" },
  });
  return NextResponse.json(factures);
}

export async function POST(req: NextRequest) {
  const ctx = await guard(req, { resource: "factures", action: "write" });
  if (ctx instanceof NextResponse) return ctx;

  try {
    const body = await req.json();
    const parsed = factureSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { lines, tvaEnabled, tvaRateId, tacheId, missionId, ...factureData } = parsed.data;

    // Détermine le dossier cible et vérifie l'accès en écriture.
    let dossierId = factureData.dossierId;
    let resolvedClientId = factureData.clientId;

    if (!dossierId && tacheId) {
      const tache = await ctx.prisma.tache.findUnique({
        where: { id: tacheId },
        select: { dossierId: true, dossier: { select: { clientId: true } } },
      });
      if (!tache) {
        return NextResponse.json({ error: "Tâche non trouvée" }, { status: 404 });
      }
      dossierId = tache.dossierId;
      if (!resolvedClientId) resolvedClientId = tache.dossier.clientId;
    } else if (!dossierId && missionId) {
      const mission = await ctx.prisma.missionHuissier.findUnique({
        where: { id: missionId },
        select: { dossierId: true, dossier: { select: { clientId: true } } },
      });
      if (!mission) {
        return NextResponse.json({ error: "Mission non trouvée" }, { status: 404 });
      }
      dossierId = mission.dossierId;
      if (!resolvedClientId) resolvedClientId = mission.dossier.clientId;
    }

    if (dossierId) {
      const dossierOk = await canAccessDossier(ctx.prisma, ctx.userId, ctx.roleInfo, dossierId, "write");
      if (!dossierOk) {
        return NextResponse.json({ error: "Accès interdit à ce dossier" }, { status: 403 });
      }
    }

    if (!resolvedClientId) {
      return NextResponse.json({ error: "Un client est requis" }, { status: 400 });
    }

    const totalHt = lines.reduce((sum, l) => sum + l.totalHt, 0);
    const totalTva = lines.reduce((sum, l) => sum + l.totalTva, 0);
    const totalTtc = lines.reduce((sum, l) => sum + l.totalTtc, 0);

    const dossier = dossierId
      ? await ctx.prisma.dossier.findUnique({
          where: { id: dossierId },
          select: { avocatResponsableId: true, huissierResponsableId: true },
        })
      : null;

    const intervenantIds = [dossier?.avocatResponsableId, dossier?.huissierResponsableId].filter(Boolean) as string[];
    const users = intervenantIds.length
      ? await ctx.prisma.user.findMany({
          where: { id: { in: intervenantIds } },
          select: { id: true, prenom: true, nom: true, role: { select: { nom: true } } },
        })
      : [];

    const intervenants = users.map((u) => ({
      id: u.id,
      prenom: u.prenom,
      nom: u.nom,
      role: u.role.nom,
    }));

    const facture = await ctx.prisma.$transaction(async (tx) => {
      const f = await tx.facture.create({
        data: {
          ...factureData,
          clientId: resolvedClientId,
          dossierId,
          tacheId: tacheId || null,
          missionHuissierId: missionId || null,
          tvaEnabled,
          tvaRateId,
          totalHt,
          totalTva,
          totalTtc,
          statut: "Emise",
          intervenants: intervenants.length ? (intervenants as any) : null,
          dateEcheance: factureData.dateEcheance ? new Date(factureData.dateEcheance) : null,
          lines: {
            create: lines.map((l) => ({
              description: l.description,
              quantite: l.quantite,
              prixUnitaire: l.prixUnitaire,
              tauxTva: l.tauxTva,
              totalHt: l.totalHt,
              totalTva: l.totalTva,
              totalTtc: l.totalTtc,
              ordre: l.ordre,
            })),
          },
        },
        include: { lines: true },
      });

      return f;
    });

    await logAudit(ctx.prisma, ctx.userId, "facture_created", "facture", facture.id);
    return NextResponse.json(facture, { status: 201 });
  } catch (error) {
    console.error("Create facture error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
