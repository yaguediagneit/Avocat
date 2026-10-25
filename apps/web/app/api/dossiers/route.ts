import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { guard } from "@/lib/api-guard";
import { getDossierAccessFilter } from "@/lib/rbac";
import { findSpecialiteForTypeAffaire } from "@/lib/specialite";
import { mapTachesParIntervenant } from "@/lib/tache-affectation";
import { logAudit } from "@/lib/audit";

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

const dossierSchema = z.object({
  referenceInterne: z.string().min(1),
  typeAffaire: z.string().min(1),
  natureMission: natureMissionSchema,
  clientId: z.string().min(1, "Veuillez sélectionner un client").uuid("Client invalide"),
  avocatResponsableId: z.string().min(1, "Veuillez sélectionner un avocat responsable").uuid("Avocat invalide"),
  huissierResponsableId: optionalUuid(),
  niveauConfidentialite: z.coerce.number().int().min(0).max(3).default(1),
  dateEcheance: optionalDate(),
  statut: z.string().default("Nouveau"),
  genererTachesWorkflow: z.boolean().default(true),
  partiesAdverses: z.array(
    z.object({
      nom: z.string().optional(),
      prenom: z.string().optional(),
      raisonSociale: z.string().optional(),
      qualite: z.string().optional(),
    })
  ).optional(),
  /// Associés / Intervenants ajoutés à l'ouverture du dossier.
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
  conflitsAcceptes: z.boolean().default(false),
});

export async function GET(req: NextRequest) {
  const ctx = await guard(req, { resource: "dossiers", action: "read" });
  if (ctx instanceof NextResponse) return ctx;

  const accessFilter = await getDossierAccessFilter(ctx.prisma, ctx.userId, ctx.roleInfo);
  const dossiers = await ctx.prisma.dossier.findMany({
    where: accessFilter,
    take: 100,
    include: { client: { select: { raisonSociale: true, coordonnees: true } } },
  });
  return NextResponse.json(
    dossiers.map((d) => ({
      ...d,
      client: d.client
        ? {
            raisonSociale: d.client.raisonSociale,
            telephone: (d.client.coordonnees as { telephone?: string } | null)?.telephone || "",
          }
        : null,
    }))
  );
}

export async function POST(req: NextRequest) {
  const ctx = await guard(req, { resource: "dossiers", action: "write" });
  if (ctx instanceof NextResponse) return ctx;

  try {
    const body = await req.json();
    const parsed = dossierSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { genererTachesWorkflow, conflitsAcceptes, partiesAdverses, collaborateurs, ...dossierData } = parsed.data;

    // --- Vérification des conflits d'intérêts ---
    const existingDossiers = await ctx.prisma.dossier.findMany({
      select: {
        id: true,
        referenceInterne: true,
        clientId: true,
        client: { select: { id: true, raisonSociale: true } },
        partiesAdverses: true,
      },
    });

    function normalize(s: string): string {
      return s.toLowerCase().trim().replace(/\s+/g, " ").replace(/[.,;:'"-]/g, "");
    }
    function partieName(p: { nom?: string; prenom?: string; raisonSociale?: string }): string {
      return (p.raisonSociale || `${p.prenom || ""} ${p.nom || ""}`.trim() || "").trim();
    }

    const newClient = await ctx.prisma.client.findUnique({
      where: { id: dossierData.clientId },
      select: { raisonSociale: true },
    });
    const newClientNorm = newClient ? normalize(newClient.raisonSociale) : "";
    const newPartiesNorm = (partiesAdverses || [])
      .map(partieName)
      .filter(Boolean)
      .map(normalize);

    const conflitsDetectes: {
      dossierConflitId: string;
      typeConflit: string;
      details: Record<string, unknown>;
    }[] = [];

    for (const d of existingDossiers) {
      const otherParties = ((d.partiesAdverses as any[] | null) || [])
        .map(partieName)
        .filter(Boolean)
        .map(normalize);

      if (newClientNorm && otherParties.includes(newClientNorm)) {
        conflitsDetectes.push({
          dossierConflitId: d.id,
          typeConflit: "client_vs_partie_adverse",
          details: {
            client: newClient?.raisonSociale,
            dossierConflit: d.referenceInterne,
            description: `Le client apparaît comme partie adverse dans le dossier ${d.referenceInterne}.`,
          },
        });
      }

      if (newPartiesNorm.length > 0 && newPartiesNorm.includes(normalize(d.client.raisonSociale))) {
        conflitsDetectes.push({
          dossierConflitId: d.id,
          typeConflit: "partie_adverse_vs_client",
          details: {
            partieAdverse: d.client.raisonSociale,
            dossierConflit: d.referenceInterne,
            description: `Une partie adverse du nouveau dossier est client dans le dossier ${d.referenceInterne}.`,
          },
        });
      }
    }

    // Si des conflits critiques sont détectés et non acceptés, on bloque
    const conflitsCritiques = conflitsDetectes.filter(
      (c) => c.typeConflit === "client_vs_partie_adverse" || c.typeConflit === "partie_adverse_vs_client"
    );

    if (conflitsCritiques.length > 0 && !conflitsAcceptes) {
      return NextResponse.json(
        {
          error: "conflits_detectes",
          conflits: conflitsDetectes,
          count: conflitsDetectes.length,
          message: `${conflitsCritiques.length} conflit(s) d'intérêts détecté(s). Veuillez confirmer pour poursuivre.`,
        },
        { status: 409 }
      );
    }

    // Ajustement du statut si conflits
    if (conflitsCritiques.length > 0) {
      dossierData.statut = "Conflit d'intérêts à vérifier";
    }

    // Création transactionnelle : dossier + collaborateurs + conflits + tâches
    // sont commités ensemble pour éviter tout dossier orphelin en cas d'erreur.
    const dossier = await ctx.prisma.$transaction(async (tx) => {
      const created = await tx.dossier.create({
        data: {
          ...dossierData,
          partiesAdverses: partiesAdverses || undefined,
          createurId: ctx.userId,
        },
      });

      await logAudit(tx, ctx.userId, "dossier_created", "dossier", created.id);

      // --- Enregistrement des associés / intervenants (matrice RACI + tâche attendue) ---
      const collaborateursValides = (collaborateurs || []).filter((c) => c.userId);
      if (collaborateursValides.length > 0) {
        // On exclut l'avocat responsable et l'huissier responsable s'ils sont déjà
        // désignés via les champs dédiés (rôle R forcé pour eux par les champs responsables).
        const idsDejaResponsables = new Set(
          [created.avocatResponsableId, created.huissierResponsableId].filter(Boolean) as string[]
        );
        const aCreer = collaborateursValides.filter((c) => !idsDejaResponsables.has(c.userId));

        if (aCreer.length > 0) {
          await tx.dossierCollaborateur.createMany({
            data: aCreer.map((c) => ({
              dossierId: created.id,
              userId: c.userId,
              roleRACI: c.roleRACI,
              discipline: c.discipline || null,
              tacheAttendue: (c.tacheAttendue?.length ? c.tacheAttendue : null) as any,
            })),
            skipDuplicates: true,
          });

          await logAudit(
            tx,
            ctx.userId,
            "collaborateurs_added_at_creation",
            "dossier",
            created.id,
            { count: aCreer.length }
          );
        }
      }

      // Enregistrement des conflits détectés
      if (conflitsDetectes.length > 0) {
        await tx.conflitInteret.createMany({
          data: conflitsDetectes.map((c) => ({
            dossierId: created.id,
            dossierConflitId: c.dossierConflitId,
            typeConflit: c.typeConflit,
            details: c.details as import("@prisma/client/runtime/library").InputJsonValue,
            statut: conflitsAcceptes ? "ignore" : "detecte",
            validePar: conflitsAcceptes ? ctx.userId : null,
            dateVerification: conflitsAcceptes ? new Date() : null,
          })),
        });

        await logAudit(
          tx,
          ctx.userId,
          "conflits_interet_detected",
          "dossier",
          created.id,
          { count: conflitsDetectes.length }
        );
      }

      // Génération automatique des tâches à partir des templates de la spécialité
      if (genererTachesWorkflow) {
        // Les codes specialite ne sont pas strictement égaux aux codes
        // type_affaire : on passe par une correspondance souple (code/libellé).
        const [paramType, specialites] = await Promise.all([
          tx.parametre.findFirst({
            where: { categorie: "type_affaire", code: created.typeAffaire },
            select: { libelle: true },
          }),
          tx.specialite.findMany({
            where: { actif: true },
            select: { id: true, code: true, libelle: true },
          }),
        ]);
        const specialite = findSpecialiteForTypeAffaire(
          created.typeAffaire,
          paramType?.libelle,
          specialites
        );
        const templates = specialite
          ? await tx.tacheTemplate.findMany({
              where: { specialiteId: specialite.id, actif: true },
              orderBy: { ordre: "asc" },
            })
          : [];

        if (templates.length > 0) {
          const now = new Date();
          // Intervenants ayant une tâche attendue : titre du template (insensible
          // à la casse / aux espaces) -> userId de l'affectataire.
          const tacheParIntervenant = mapTachesParIntervenant(collaborateursValides);
          const tachesData = templates.map((t) => ({
            dossierId: created.id,
            titre: t.titre,
            description: t.description,
            echeance: t.delaiJours > 0 ? new Date(now.getTime() + t.delaiJours * 86400000) : null,
            priorite: t.priorite,
            statut: "À faire",
            // Si un intervenant a été désigné pour cette tâche à l'ouverture du
            // dossier, c'est lui le responsable ; sinon on retombe sur
            // l'huissier (roleAttendu) ou l'avocat responsable.
            responsableId:
              tacheParIntervenant.get(t.titre.trim().toLowerCase()) ||
              (t.roleAttendu === "huissier" && created.huissierResponsableId
                ? created.huissierResponsableId
                : created.avocatResponsableId),
            createurId: ctx.userId,
          }));

          await tx.tache.createMany({ data: tachesData });

          await logAudit(
            tx,
            ctx.userId,
            "dossier_workflow_taches_generated",
            "dossier",
            created.id,
            { count: tachesData.length }
          );
        }
      }

      return created;
    });

    return NextResponse.json({ ...dossier, conflitsDetectes: conflitsDetectes.length }, { status: 201 });
  } catch (error) {
    console.error("Create dossier error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
