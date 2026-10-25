import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { guard } from "@/lib/api-guard";
import { getAccessibleDossierIds } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";

interface PartieAdverse {
  nom?: string;
  prenom?: string;
  raisonSociale?: string;
  qualite?: string;
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[.,;:'"-]/g, "");
}

function partieName(p: PartieAdverse): string {
  return (p.raisonSociale || `${p.prenom || ""} ${p.nom || ""}`.trim() || "").trim();
}

const checkSchema = z.object({
  clientId: z.string().uuid(),
  partiesAdverses: z.array(
    z.object({
      nom: z.string().optional(),
      prenom: z.string().optional(),
      raisonSociale: z.string().optional(),
      qualite: z.string().optional(),
    })
  ).optional().default([]),
  dossierId: z.string().uuid().optional(),
});

export async function GET(req: NextRequest) {
  const ctx = await guard(req, { resource: "dossiers", action: "read" });
  if (ctx instanceof NextResponse) return ctx;

  const { searchParams } = new URL(req.url);
  const dossierId = searchParams.get("dossierId");

  const where: Record<string, unknown> = {};

  // Isolation : restreindre aux dossiers accessibles (sauf administrateurs).
  if (!ctx.roleInfo.estAdmin) {
    const { ids } = await getAccessibleDossierIds(ctx.prisma, ctx.userId, ctx.roleInfo);
    where.OR = [
      { dossierId: { in: ids } },
      { dossierConflitId: { in: ids } },
    ];
  }

  if (dossierId) {
    // On combine avec le filtre explicite par dossier (intersection).
    const dossierClause = { OR: [{ dossierId }, { dossierConflitId: dossierId }] };
    where.AND = [dossierClause];
  }

  const conflits = await ctx.prisma.conflitInteret.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      dossier: {
        select: { id: true, referenceInterne: true, clientId: true, client: { select: { raisonSociale: true } } },
      },
      dossierConflit: {
        select: { id: true, referenceInterne: true, clientId: true, client: { select: { raisonSociale: true } } },
      },
    },
  });

  return NextResponse.json(conflits);
}

export async function POST(req: NextRequest) {
  const ctx = await guard(req, { resource: "dossiers", action: "write" });
  if (ctx instanceof NextResponse) return ctx;

  try {
    const body = await req.json();
    const parsed = checkSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { clientId, partiesAdverses, dossierId } = parsed.data;

    // Récupère tous les dossiers existants (sauf le dossier courant si édition)
    const existingDossiers = await ctx.prisma.dossier.findMany({
      where: dossierId ? { id: { not: dossierId } } : undefined,
      select: {
        id: true,
        referenceInterne: true,
        clientId: true,
        client: { select: { id: true, raisonSociale: true } },
        partiesAdverses: true,
        statut: true,
      },
    });

    const conflits: {
      dossierConflitId: string;
      referenceConflit: string;
      typeConflit: string;
      details: Record<string, unknown>;
    }[] = [];

    const newPartiesNorm = (partiesAdverses || [])
      .map(partieName)
      .filter(Boolean)
      .map(normalize);

    for (const d of existingDossiers) {
      // 1. Conflit : le client du nouveau dossier est déjà partie adverse dans un autre dossier
      const otherParties = ((d.partiesAdverses as PartieAdverse[] | null) || [])
        .map(partieName)
        .filter(Boolean)
        .map(normalize);

      const newClient = await ctx.prisma.client.findUnique({
        where: { id: clientId },
        select: { raisonSociale: true },
      });
      const newClientNorm = newClient ? normalize(newClient.raisonSociale) : "";

      if (newClientNorm && otherParties.includes(newClientNorm)) {
        conflits.push({
          dossierConflitId: d.id,
          referenceConflit: d.referenceInterne,
          typeConflit: "client_vs_partie_adverse",
          details: {
            client: newClient?.raisonSociale,
            dossierConflit: d.referenceInterne,
            description: `Le client du nouveau dossier apparaît comme partie adverse dans le dossier ${d.referenceInterne}.`,
          },
        });
      }

      // 2. Conflit : une partie adverse du nouveau dossier est client dans un autre dossier
      if (newPartiesNorm.length > 0) {
        if (newPartiesNorm.includes(normalize(d.client.raisonSociale))) {
          conflits.push({
            dossierConflitId: d.id,
            referenceConflit: d.referenceInterne,
            typeConflit: "partie_adverse_vs_client",
            details: {
              partieAdverse: d.client.raisonSociale,
              dossierConflit: d.referenceInterne,
              description: `Une partie adverse du nouveau dossier est client dans le dossier ${d.referenceInterne}.`,
            },
          });
        }
      }

      // 3. Conflit : le client est déjà client dans un autre dossier (client commun)
      if (d.clientId === clientId) {
        // Pas un conflit en soi, mais on signale le chevauchement
        // (uniquement si les dossiers sont de nature potentiellement contradictoire)
        // On l'ajoute comme "client_commun" pour information
        conflits.push({
          dossierConflitId: d.id,
          referenceConflit: d.referenceInterne,
          typeConflit: "client_commun",
          details: {
            client: d.client.raisonSociale,
            dossierConflit: d.referenceInterne,
            description: `Le client est déjà partie à un autre dossier (${d.referenceInterne}). À vérifier selon la nature des missions.`,
          },
        });
      }
    }

    // Déduplication : un même dossierConflitId peut apparaître plusieurs fois
    const seen = new Set<string>();
    const uniqueConflits = conflits.filter((c) => {
      const key = `${c.dossierConflitId}-${c.typeConflit}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return NextResponse.json({
      conflits: uniqueConflits,
      count: uniqueConflits.length,
      hasConflit: uniqueConflits.length > 0,
    });
  } catch (error) {
    console.error("Check conflits error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
