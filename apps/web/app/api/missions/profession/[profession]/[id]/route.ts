import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { guard } from "@/lib/api-guard";
import { canAccessDossier } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";

const missionStatuts = ["En préparation", "Tentée", "Remise", "Annulée", "Échouée"] as const;

const updateMissionSchema = z.object({
  statut: z.enum(missionStatuts).optional(),
  resultat: z.string().max(5000).optional(),
  dateTentative: z.string().datetime().nullable().optional(),
  dateRemise: z.string().datetime().nullable().optional(),
  actif: z.boolean().optional(),
});

const PROFESSIONS: Record<string, { model: string; intervenantKey: string; audit: string }> = {
  architecte: { model: "missionArchitecte", intervenantKey: "architecteId", audit: "mission_architecte" },
  "conseiller-juridique": { model: "missionConseillerJuridique", intervenantKey: "conseillerJuridiqueId", audit: "mission_conseiller_juridique" },
  clerc: { model: "missionClerc", intervenantKey: "clercId", audit: "mission_clerc" },
};

export async function PATCH(
  req: NextRequest,
  { params }: { params: { profession: string; id: string } }
) {
  const ctx = await guard(req, { resource: "missions", action: "write" });
  if (ctx instanceof NextResponse) return ctx;

  const profession = PROFESSIONS[params.profession];
  if (!profession) {
    return NextResponse.json({ error: "Profession inconnue" }, { status: 400 });
  }

  const delegate = (ctx.prisma as any)[profession.model];
  const select: Record<string, boolean> = {
    id: true,
    dossierId: true,
    typeActe: true,
    statut: true,
    resultat: true,
    dateTentative: true,
    dateRemise: true,
    actif: true,
  };
  select[profession.intervenantKey] = true;

  const mission = await delegate.findUnique({
    where: { id: params.id },
    select,
  });

  if (!mission) {
    return NextResponse.json({ error: "Mission non trouvée" }, { status: 404 });
  }

  const dossierReadOk = await canAccessDossier(ctx.prisma, ctx.userId, ctx.roleInfo, mission.dossierId, "read");
  if (!dossierReadOk) {
    return NextResponse.json({ error: "Accès interdit à ce dossier" }, { status: 403 });
  }

  const canEdit =
    ctx.roleInfo.estAdmin ||
    ctx.userId === mission[profession.intervenantKey] ||
    (await canAccessDossier(ctx.prisma, ctx.userId, ctx.roleInfo, mission.dossierId, "write"));

  if (!canEdit) {
    return NextResponse.json({ error: "Vous ne pouvez pas modifier cette mission" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const parsed = updateMissionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const data: Record<string, unknown> = {};
    if (parsed.data.actif !== undefined) data.actif = parsed.data.actif;
    if (parsed.data.statut !== undefined) data.statut = parsed.data.statut;
    if (parsed.data.resultat !== undefined) data.resultat = parsed.data.resultat;
    if (parsed.data.dateTentative !== undefined) {
      data.dateTentative = parsed.data.dateTentative ? new Date(parsed.data.dateTentative) : null;
    }
    if (parsed.data.dateRemise !== undefined) {
      data.dateRemise = parsed.data.dateRemise ? new Date(parsed.data.dateRemise) : null;
    }

    const isToggleOnly = parsed.data.actif !== undefined && parsed.data.statut === undefined;

    const updated = await delegate.update({
      where: { id: params.id },
      data,
    });

    if (!isToggleOnly) {
      await logAudit(ctx.prisma, ctx.userId, `${profession.audit}_updated`, "mission", updated.id, {
        dossierId: mission.dossierId,
        changements: parsed.data,
      });
    } else {
      await logAudit(ctx.prisma, ctx.userId, `${profession.audit}_toggled`, "mission", updated.id, { actif: parsed.data.actif });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error(`Update ${params.profession} mission error`, error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { profession: string; id: string } }
) {
  const ctx = await guard(req, { resource: "missions", action: "delete" });
  if (ctx instanceof NextResponse) return ctx;

  if (!ctx.roleInfo.estAdmin) {
    return NextResponse.json({ error: "Seul un administrateur peut désactiver une mission" }, { status: 403 });
  }

  const profession = PROFESSIONS[params.profession];
  if (!profession) {
    return NextResponse.json({ error: "Profession inconnue" }, { status: 400 });
  }

  const delegate = (ctx.prisma as any)[profession.model];
  const mission = await delegate.findUnique({
    where: { id: params.id },
    select: { dossierId: true },
  });
  if (!mission) {
    return NextResponse.json({ error: "Mission non trouvée" }, { status: 404 });
  }

  const dossierOk = await canAccessDossier(ctx.prisma, ctx.userId, ctx.roleInfo, mission.dossierId, "write");
  if (!dossierOk) {
    return NextResponse.json({ error: "Accès interdit à ce dossier" }, { status: 403 });
  }

  try {
    await delegate.update({ where: { id: params.id }, data: { actif: false } });
    await logAudit(ctx.prisma, ctx.userId, `${profession.audit}_deactivated`, "mission", params.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(`Delete ${params.profession} mission error`, error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
