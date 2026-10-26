import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { guard, ensureDossierAccess } from "@/lib/api-guard";
import { logAudit } from "@/lib/audit";
import { reassignerTachesIntervenants } from "@/lib/tache-affectation";

function optionalUuid() {
  return z.preprocess(
    (val) => (val === "" || val === undefined ? null : val),
    z.string().uuid().nullable().optional()
  );
}

function optionalDate() {
  return z.preprocess(
    (val) => (val === "" || val === null || val === undefined ? null : val),
    z.coerce.date().nullable().optional()
  );
}

/// Natures de mission : tableau de codes (rétrocompatible avec une chaîne seule).
const natureMissionSchema = z.union([
  z.array(z.string().min(1)).min(1),
  z.string().min(1).transform((s) => [s]),
]);

const dossierUpdateSchema = z
  .object({
    referenceInterne: z.string().min(1),
    typeAffaire: z.string().min(1),
    natureMission: natureMissionSchema,
    clientId: z.string().min(1, "Veuillez sélectionner un client").uuid("Client invalide"),
    avocatResponsableId: z.string().min(1, "Veuillez sélectionner un avocat responsable").uuid("Avocat invalide"),
    huissierResponsableId: optionalUuid(),
    niveauConfidentialite: z.coerce.number().int().min(0).max(3),
    dateEcheance: optionalDate(),
    statut: z.string(),
    /// Matière juridique : pilote les délais de recours (lib/recours.ts).
    matiere: z
      .enum(["civil", "commercial", "social", "penal", "administratif", "fiscal"])
      .nullable()
      .optional(),
    actif: z.boolean().optional(),
    /// Associés / Intervenants (sync en édition).
    collaborateurs: z
      .array(
        z.object({
          userId: z.string().uuid("Intervenant invalide"),
          roleRACI: z.enum(["R", "A", "C", "I"]).default("C"),
          discipline: z.string().max(100).optional(),
          /// Tâches attendues : tableau de titres (rétrocompatible chaîne seule).
          tacheAttendue: z
            .union([
              z.array(z.string().min(1).max(500)).max(50),
              z.string().max(500).transform((s) => (s ? [s] : [])),
            ])
            .optional(),
        })
      )
      .optional(),
  })
  .partial();

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await guard(req, { resource: "dossiers", action: "read" });
  if (ctx instanceof NextResponse) return ctx;

  const access = await ensureDossierAccess(ctx, params.id, "read");
  if (access !== true) return access;

  const dossier = await ctx.prisma.dossier.findUnique({
    where: { id: params.id },
    include: { client: true },
  });

  if (!dossier) {
    return NextResponse.json({ error: "Dossier non trouvé" }, { status: 404 });
  }

  return NextResponse.json(dossier);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await guard(req, { resource: "dossiers", action: "write" });
  if (ctx instanceof NextResponse) return ctx;

  const access = await ensureDossierAccess(ctx, params.id, "write");
  if (access !== true) return access;

  try {
    const body = await req.json();
    const parsed = dossierUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { collaborateurs, ...dossierData } = parsed.data;

    const isTerminal = (s: string) => s === "Clôturé" || s === "Archivé";
    if (dossierData.statut && isTerminal(dossierData.statut) && !ctx.roleInfo.estAdmin) {
      return NextResponse.json(
        { error: "Seul un administrateur peut clôturer ou archiver un dossier" },
        { status: 403 }
      );
    }

    const dossier = await ctx.prisma.dossier.update({
      where: { id: params.id },
      data: dossierData,
    });

    await logAudit(ctx.prisma, ctx.userId, "dossier_updated", "dossier", dossier.id);

    // --- Synchronisation des associés / intervenants (matrice RACI + tâche attendue) ---
    if (collaborateurs) {
      const idsDejaResponsables = new Set(
        [dossier.avocatResponsableId, dossier.huissierResponsableId].filter(Boolean) as string[]
      );
      const soumis = collaborateurs.filter((c) => !idsDejaResponsables.has(c.userId));
      const soumisMap = new Map(soumis.map((c) => [c.userId, c]));

      const existants = await ctx.prisma.dossierCollaborateur.findMany({
        where: { dossierId: dossier.id },
        select: { id: true, userId: true },
      });

      // Supprimer ceux qui ne sont plus dans la liste soumise (hors responsables).
      const aSupprimer = existants.filter(
        (e) => !idsDejaResponsables.has(e.userId) && !soumisMap.has(e.userId)
      );
      if (aSupprimer.length > 0) {
        await ctx.prisma.dossierCollaborateur.deleteMany({
          where: { id: { in: aSupprimer.map((e) => e.id) } },
        });
      }

      // Upsert les soumis.
      for (const c of soumis) {
        const existing = existants.find((e) => e.userId === c.userId);
        if (existing) {
          await ctx.prisma.dossierCollaborateur.update({
            where: { id: existing.id },
            data: {
              roleRACI: c.roleRACI,
              discipline: c.discipline || null,
              tacheAttendue: (c.tacheAttendue?.length ? c.tacheAttendue : null) as any,
            },
          });
        } else {
          await ctx.prisma.dossierCollaborateur.create({
            data: {
              dossierId: dossier.id,
              userId: c.userId,
              roleRACI: c.roleRACI,
              discipline: c.discipline || null,
              tacheAttendue: (c.tacheAttendue?.length ? c.tacheAttendue : null) as any,
            },
          });
        }
      }

      // Réaffecte les tâches du dossier selon les tâches cochées par intervenant.
      const reaffectees = await reassignerTachesIntervenants(ctx.prisma, dossier.id);
      if (reaffectees > 0) {
        await logAudit(ctx.prisma, ctx.userId, "taches_reassigned", "dossier", dossier.id, {
          count: reaffectees,
        });
      }

      await logAudit(
        ctx.prisma,
        ctx.userId,
        "collaborateurs_synced",
        "dossier",
        dossier.id,
        { count: soumis.length }
      );
    }

    return NextResponse.json(dossier);
  } catch (error) {
    console.error("Update dossier error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await guard(req, { resource: "dossiers", action: "delete" });
  if (ctx instanceof NextResponse) return ctx;

  if (!ctx.roleInfo.estAdmin) {
    return NextResponse.json({ error: "Seul un administrateur peut désactiver un dossier" }, { status: 403 });
  }

  const access = await ensureDossierAccess(ctx, params.id, "write");
  if (access !== true) return access;

  try {
    await ctx.prisma.dossier.update({ where: { id: params.id }, data: { actif: false } });
    await logAudit(ctx.prisma, ctx.userId, "dossier_deactivated", "dossier", params.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Delete dossier error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
