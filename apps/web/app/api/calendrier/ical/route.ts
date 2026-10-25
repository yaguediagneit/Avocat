import { NextRequest, NextResponse } from "next/server";
import { getTenantPrisma } from "@/lib/prisma";
import { getDossierScopedAccessFilter, RoleInfo } from "@/lib/rbac";
import { Prisma } from "@prisma/client";

function escapeIcs(str: string | null | undefined): string {
  if (!str) return "";
  return str
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "");
}

function toIcsDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

function formatIcsEvent(
  uid: string,
  start: Date,
  end: Date,
  summary: string,
  description: string,
  location: string
): string[] {
  const lines = [
    "BEGIN:VEVENT",
    `UID:${uid}@avocat`,
    `DTSTAMP:${toIcsDate(new Date())}`,
    `DTSTART:${toIcsDate(start)}`,
    `DTEND:${toIcsDate(end)}`,
    `SUMMARY:${escapeIcs(summary)}`,
  ];
  if (description) {
    lines.push(`DESCRIPTION:${escapeIcs(description)}`);
  }
  if (location) {
    lines.push(`LOCATION:${escapeIcs(location)}`);
  }
  lines.push("END:VEVENT");
  return lines;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tenantId = searchParams.get("tenantId");
  const token = searchParams.get("token");

  if (!tenantId || !token) {
    return new NextResponse("Paramètres manquants", { status: 400 });
  }

  try {
    const prisma = await getTenantPrisma(tenantId);
    const user = await prisma.user.findUnique({
      where: { calendarToken: token },
      include: { role: true },
    });

    if (!user || !user.actif) {
      return new NextResponse("Token invalide", { status: 401 });
    }

    const roleInfo: RoleInfo = {
      id: user.roleId,
      nom: user.role.nom,
      estAdmin: user.role.estAdmin,
      estClient: user.role.estClient,
      niveauConfidentialiteMax: user.role.niveauConfidentialiteMax,
      permissions: user.role.permissions as Record<string, string[]>,
    };

    const accessFilterRendezVous = await getDossierScopedAccessFilter(
      prisma,
      user.id,
      roleInfo,
      "rendezVous"
    );
    const accessFilterTaches = await getDossierScopedAccessFilter(
      prisma,
      user.id,
      roleInfo,
      "taches"
    );

    const baseWhereEvenement: Prisma.EvenementWhereInput =
      Object.keys(accessFilterRendezVous).length === 0
        ? {}
        : { OR: [{ dossierId: null }, accessFilterRendezVous] };

    const [evenements, taches] = await Promise.all([
      prisma.evenement.findMany({
        where: baseWhereEvenement,
        take: 1000,
        orderBy: { dateDebut: "asc" },
        include: { dossier: { select: { referenceInterne: true } } },
      }),
      prisma.tache.findMany({
        where: {
          ...(accessFilterTaches as any),
          echeance: { not: null },
        },
        take: 1000,
        orderBy: { echeance: "asc" },
        include: { dossier: { select: { referenceInterne: true } } },
      }),
    ]);

    const lines: string[] = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Avocat//FR",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
      "X-PUBLISHED-TTL:PT1H",
    ];

    for (const e of evenements) {
      const start = e.dateDebut;
      const end =
        e.dateFin ??
        new Date(new Date(e.dateDebut).getTime() + 60 * 60 * 1000);
      const dossier = e.dossier ? `Dossier ${e.dossier.referenceInterne}` : "";
      const description = [e.type, dossier].filter(Boolean).join(" - ");
      lines.push(
        ...formatIcsEvent(
          `${e.id}-evenement`,
          start,
          end,
          e.titre,
          description,
          e.lieu ?? ""
        )
      );
    }

    for (const t of taches) {
      const start = t.echeance!;
      const end = new Date(start.getTime() + 60 * 60 * 1000);
      const dossier = t.dossier ? `Dossier ${t.dossier.referenceInterne}` : "";
      const description = [t.statut, t.priorite, dossier]
        .filter(Boolean)
        .join(" - ");
      lines.push(
        ...formatIcsEvent(
          `${t.id}-tache`,
          start,
          end,
          `[Tâche] ${t.titre}`,
          description,
          ""
        )
      );
    }

    lines.push("END:VCALENDAR");
    const body = lines.join("\r\n") + "\r\n";

    return new NextResponse(body, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'inline; filename="calendrier.ics"',
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  } catch (error) {
    console.error("Generate ICS error", error);
    return new NextResponse("Erreur serveur", { status: 500 });
  }
}
