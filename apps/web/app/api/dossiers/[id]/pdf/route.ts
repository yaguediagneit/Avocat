import { NextRequest, NextResponse } from "next/server";
import { guard, ensureDossierAccess } from "@/lib/api-guard";
import { publicPrisma } from "@/lib/prisma";
import { generateDossierGlobalPdf, type DossierGlobalPdfData } from "@/lib/dossier-pdf";
import { logAudit } from "@/lib/audit";
import { naturesMissionOf } from "@/lib/nature-mission";
import { findSpecialiteForTypeAffaire } from "@/lib/specialite";
import { stringListOf } from "@/lib/string-list";
import { estIntervenantExterne } from "@/lib/rbac";
import type { PdfThemeConfig, CabinetInfo } from "@/lib/pdf-generator";

const DEFAULT_PDF_THEME: PdfThemeConfig = {
  primaryColor: "#2c4c7c",
  secondaryColor: "#c78124",
  fontFamily: "Helvetica",
  fontSize: 10,
  headerText: "",
  footerText: "",
};

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR");
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ctx = await guard(req, { resource: "dossiers", action: "read" });
  if (ctx instanceof NextResponse) return ctx;

  const access = await ensureDossierAccess(ctx, params.id, "read");
  if (access !== true) return access;

  const externe = estIntervenantExterne(ctx.roleInfo);

  const dossier = await ctx.prisma.dossier.findUnique({
    where: { id: params.id },
    include: {
      client: true,
      taches: { orderBy: { createdAt: "desc" } },
      evenements: { orderBy: { dateDebut: "asc" } },
      missions: { orderBy: { createdAt: "desc" } },
      missionsArchitecte: { orderBy: { createdAt: "desc" } },
      missionsConseillerJuridique: { orderBy: { createdAt: "desc" } },
      missionsClerc: { orderBy: { createdAt: "desc" } },
      commentaires: { orderBy: { createdAt: "desc" } },
      documents: {
        where: externe ? { partageExterne: true } : { actif: true },
        orderBy: { createdAt: "desc" },
      },
      factures: {
        orderBy: { dateEmission: "desc" },
        include: { paiements: { orderBy: { datePaiement: "desc" } } },
      },
      conflitsInteret: {
        include: { dossierConflit: { select: { id: true, referenceInterne: true } } },
        orderBy: { createdAt: "desc" },
      },
      collaborateursRACI: true,
    },
  });

  if (!dossier) {
    return NextResponse.json({ error: "Dossier non trouvé" }, { status: 404 });
  }

  const [avocat, huissier, users, parametres, specialites, tenant] = await Promise.all([
    ctx.prisma.user.findUnique({
      where: { id: dossier.avocatResponsableId },
      select: { prenom: true, nom: true, titre: true },
    }),
    dossier.huissierResponsableId
      ? ctx.prisma.user.findUnique({
          where: { id: dossier.huissierResponsableId },
          select: { prenom: true, nom: true, titre: true },
        })
      : null,
    ctx.prisma.user.findMany({
      where: { id: { in: Array.from(new Set([...dossier.taches.map((t) => t.responsableId), ...dossier.commentaires.map((c) => c.auteurId)])) } },
      select: { id: true, prenom: true, nom: true, titre: true },
    }),
    ctx.prisma.parametre.findMany({
      where: { categorie: { in: ["nature_mission", "type_affaire"] }, actif: true },
      select: { code: true, libelle: true, categorie: true },
    }),
    ctx.prisma.specialite.findMany({
      where: { actif: true },
      select: { id: true, code: true, libelle: true },
    }),
    publicPrisma.tenant.findUnique({
      where: { id: ctx.tenantId },
    }),
  ]);

  if (!tenant) {
    return NextResponse.json({ error: "Cabinet non trouvé" }, { status: 404 });
  }

  const userMap = new Map(users.map((u) => [u.id, `${u.titre ? u.titre + " " : ""}${u.prenom} ${u.nom}`]));
  const userName = (u: { prenom: string; nom: string; titre: string | null } | null) =>
    u ? `${u.titre ? u.titre + " " : ""}${u.prenom} ${u.nom}` : "—";

  const paramMap = new Map(parametres.map((p) => [p.code, p.libelle]));
  const parametreTypeAffaire = parametres.find((p) => p.categorie === "type_affaire" && p.code === dossier.typeAffaire);
  const specialite = findSpecialiteForTypeAffaire(
    dossier.typeAffaire,
    parametreTypeAffaire?.libelle,
    specialites
  );
  const typeAffaireLabel =
    parametreTypeAffaire?.libelle ||
    specialite?.libelle ||
    dossier.typeAffaire;

  const [typesDocumentsAttendus, tacheTemplates] = specialite
    ? await Promise.all([
        ctx.prisma.typeDocumentSpecialite.findMany({
          where: { specialiteId: specialite.id, actif: true },
          orderBy: [{ ordre: "asc" }, { libelle: "asc" }],
          select: { code: true, libelle: true, obligatoire: true },
        }),
        ctx.prisma.tacheTemplate.findMany({
          where: { specialiteId: specialite.id, actif: true },
          orderBy: [{ ordre: "asc" }, { titre: "asc" }],
          select: { id: true, titre: true },
        }),
      ])
    : [[], []];

  const natures = naturesMissionOf(dossier.natureMission)
    .map((c) => paramMap.get(c) || c);

  const collaborateurIds = dossier.collaborateursRACI.map((c) => c.userId);
  const collaborateursUsers =
    collaborateurIds.length > 0
      ? await ctx.prisma.user.findMany({
          where: { id: { in: collaborateurIds } },
          select: { id: true, prenom: true, nom: true },
        })
      : [];
  const collabUserMap = new Map(collaborateursUsers.map((u) => [u.id, `${u.prenom} ${u.nom}`]));

  const data: DossierGlobalPdfData = {
    reference: dossier.referenceInterne,
    typeAffaireLabel,
    naturesMission: natures,
    dateOuverture: dossier.dateOuverture,
    statut: dossier.statut,
    echeance: dossier.dateEcheance,
    client: {
      raisonSociale: dossier.client.raisonSociale,
      adresse: dossier.client.adresse,
      identifiant: dossier.client.identifiant,
    },
    avocat: userName(avocat),
    huissier: huissier ? userName(huissier) : null,
    partiesAdverses: (dossier.partiesAdverses as any[] | null) || [],
    collaborateurs: dossier.collaborateursRACI.map((c) => ({
      nom: collabUserMap.get(c.userId) || c.userId,
      roleRACI: c.roleRACI,
      discipline: c.discipline,
      tacheAttendue: stringListOf(c.tacheAttendue),
    })),
    evenements: dossier.evenements.map((e) => ({
      date: e.dateDebut,
      type: e.type,
      titre: e.titre,
      lieu: e.lieu,
      statut: e.actif ? "Actif" : "Inactif",
    })),
    taches: dossier.taches.map((t) => ({
      titre: t.titre,
      statut: t.statut,
      priorite: t.priorite,
      echeance: t.echeance,
      responsable: userMap.get(t.responsableId) || t.responsableId,
    })),
    missions: [
      ...dossier.missions.map((m) => ({
        type: m.typeActe,
        discipline: "Huissier",
        statut: m.statut,
        datePrevue: m.datePrevue,
        destinataire: m.destinataire,
      })),
      ...dossier.missionsArchitecte.map((m) => ({
        type: m.typeActe,
        discipline: "Architecte",
        statut: m.statut,
        datePrevue: m.datePrevue,
        destinataire: m.destinataire,
      })),
      ...dossier.missionsConseillerJuridique.map((m) => ({
        type: m.typeActe,
        discipline: "Conseiller juridique",
        statut: m.statut,
        datePrevue: m.datePrevue,
        destinataire: m.destinataire,
      })),
      ...dossier.missionsClerc.map((m) => ({
        type: m.typeActe,
        discipline: "Clerc",
        statut: m.statut,
        datePrevue: m.datePrevue,
        destinataire: m.destinataire,
      })),
    ],
    commentaires: dossier.commentaires.map((c) => ({
      auteur: userMap.get(c.auteurId) || c.auteurNom,
      date: c.createdAt,
      message: c.message,
    })),
    documents: dossier.documents.map((d) => ({
      nom: d.nom,
      categorie: d.categorie,
      date: d.createdAt,
      statut: d.publieClient ? "Publié client" : d.partageExterne ? "Partagé" : "Interne",
    })),
    typesDocumentsAttendus: typesDocumentsAttendus.map((t) => {
      const recus = dossier.documents.filter(
        (d) =>
          d.categorie === t.code ||
          ((d.metadata as { typeDocument?: string } | null)?.typeDocument === t.code)
      ).length;
      return { code: t.code, libelle: t.libelle, obligatoire: t.obligatoire, recus };
    }),
    tacheTemplates: tacheTemplates.map((tt) => ({
      titre: tt.titre,
      statut: dossier.taches.some((t) => t.titre === tt.titre) ? "Générée" : "Non générée",
    })),
    factures: dossier.factures.map((f) => ({
      numero: f.numero,
      date: f.dateEmission,
      totalTtc: f.totalTtc,
      statut: f.statut,
    })),
    paiements: dossier.factures.flatMap((f) =>
      f.paiements.map((p) => ({
        date: p.datePaiement,
        montant: p.montant,
        mode: p.mode,
        reference: p.reference || undefined,
        facture: f.numero,
      }))
    ),
    conflits: dossier.conflitsInteret.map((c) => ({
      reference: c.dossierConflit.referenceInterne,
      type: c.typeConflit,
      statut: c.statut,
    })),
  };

  const config = (tenant.configuration as Record<string, unknown>) || {};
  const pdfTheme = (config.pdfTheme as Partial<PdfThemeConfig>) || {};

  const cabinet: CabinetInfo = {
    raisonSociale: tenant.raisonSociale,
    slogan: String(config.slogan ?? ""),
    adresse: tenant.adresse ?? undefined,
    telephone: String(config.telephonePrincipal ?? ""),
    telephoneSecondaire: String(config.telephoneSecondaire ?? ""),
    email: String(config.email ?? ""),
    siteWeb: String(config.siteWeb ?? ""),
    identifiantFiscal: tenant.identifiantFiscal ?? undefined,
    identificationLegale: String(config.identificationLegale ?? ""),
    logoUrl: tenant.logoUrl,
  };

  const theme: PdfThemeConfig = {
    ...DEFAULT_PDF_THEME,
    ...pdfTheme,
    fontFamily: (pdfTheme.fontFamily as PdfThemeConfig["fontFamily"]) || "Helvetica",
    fontSize: Number(pdfTheme.fontSize) || 10,
  };

  const pdfBytes = await generateDossierGlobalPdf(data, cabinet, theme);

  await logAudit(ctx.prisma, ctx.userId, "dossier_pdf_global", "dossier", dossier.id);

  const filename = `Fiche-globale-${dossier.referenceInterne.replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`;

  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
