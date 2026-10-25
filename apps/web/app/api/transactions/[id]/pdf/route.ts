import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";
import { canAccessDossier } from "@/lib/rbac";
import { publicPrisma } from "@/lib/prisma";
import { uploadDocument, getDocumentBuffer } from "@/lib/s3";
import { logAudit } from "@/lib/audit";
import { generateLegalPdf, type PdfThemeConfig, type CabinetInfo } from "@/lib/pdf-generator";
import { renderDocumentTemplate, suggestVariableValues, extractTemplateVariables } from "@/lib/document-template";
import { TRX_PARTIE_ROLES } from "@/lib/transactions";
import { encryptDocumentServerSide } from "@/lib/pdf-encrypt";
import crypto from "crypto";

const DEFAULT_PDF_THEME: PdfThemeConfig = {
  primaryColor: "#2c4c7c",
  secondaryColor: "#c78124",
  fontFamily: "Helvetica",
  fontSize: 11,
  headerText: "",
  footerText: "",
};

function partieLabel(p: any): string {
  if (!p) return "";
  if (p.demandeur) {
    const d = p.demandeur;
    return d.typePersonne === "MORALE"
      ? d.raisonSociale || d.nom
      : [d.civilite, d.prenoms, d.nom].filter(Boolean).join(" ");
  }
  return p.client?.raisonSociale || p.nomLibre || "";
}

function bienLabel(b: any): string {
  if (!b) return "";
  return [
    b.designation,
    [b.adresse, b.quartier, b.commune].filter(Boolean).join(", "),
    b.superficie ? `${b.superficie} ${b.uniteSuperficie || "m²"}` : null,
  ]
    .filter(Boolean)
    .join(" — ");
}

/// Statuts où le document peut être considéré « final » (signé / validé).
const STATUTS_DOCUMENT_FINAL = [
  "ACTE_NOTARIE_SIGNE",
  "MUTATION_INSCRITE",
  "ETAT_DROITS_REELS_FINAL_RECU",
  "BAIL_EN_COURS",
  "SUIVI_LOYERS_ET_QUITTANCES",
  "EXECUTION_EN_COURS",
  "DOSSIER_REMIS_CLIENT",
  "CLOTURE",
];

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await guard(req, { resource: "transactions", action: "write" });
  if (ctx instanceof NextResponse) return ctx;

  const transaction = await ctx.prisma.transaction.findUnique({
    where: { id: params.id },
    include: {
      type: true,
      dossier: { include: { client: true } },
      parties: { include: { demandeur: true, client: true }, orderBy: { ordre: "asc" } },
      biens: { include: { bien: { include: { parcelle: true } } } },
      pieces: { orderBy: { ordre: "asc" } },
      paiements: { orderBy: { date: "desc" } },
    },
  });
  if (!transaction) return NextResponse.json({ error: "Transaction non trouvée" }, { status: 404 });

  const ok = await canAccessDossier(ctx.prisma, ctx.userId, ctx.roleInfo, transaction.dossierId, "write");
  if (!ok) return NextResponse.json({ error: "Accès interdit" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { modeleId, variables, publieClient, apercu, confidentiel } = body as {
    modeleId?: string;
    variables?: Record<string, string>;
    publieClient?: boolean;
    /** Aperçu simple : le PDF est renvoyé sans être archivé en GED. */
    apercu?: boolean;
    /** Version confidentielle : les sections encadrées par
     *  [[CONFIDENTIEL]] ... [[/CONFIDENTIEL]] dans le modèle sont retirées
     *  (ex. article de rémunération du cabinet, comme « Imprimer sans
     *  Article 4 » de GESTIMMO). */
    confidentiel?: boolean;
  };

  const modele = modeleId
    ? await ctx.prisma.transactionModele.findUnique({ where: { id: modeleId } })
    : null;
  if (modeleId && !modele) {
    return NextResponse.json({ error: "Modèle non trouvé" }, { status: 404 });
  }

  const tenant = await publicPrisma.tenant.findUnique({ where: { id: ctx.tenantId } });
  if (!tenant) return NextResponse.json({ error: "Cabinet non trouvé" }, { status: 404 });
  const config = (tenant.configuration as Record<string, unknown>) || {};
  const pdfTheme = (config.pdfTheme as Partial<PdfThemeConfig>) || {};
  const theme: PdfThemeConfig = { ...DEFAULT_PDF_THEME, ...pdfTheme };
  const cabinetInfo: CabinetInfo = {
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

  const partiesByRole = (role: string) =>
    transaction.parties.filter((p) => p.role === role).map(partieLabel).filter(Boolean);
  const bien = transaction.biens[0]?.bien || null;
  const piecesLabels = transaction.pieces
    .map((p, i) => `${i + 1}. ${p.libelle} (${p.statut})`)
    .join("\n");

  // Variables canoniques pré-remplies depuis la transaction.
  const auto: Record<string, string> = {
    reference_transaction: transaction.reference,
    reference: transaction.reference,
    date: new Date().toLocaleDateString("fr-FR"),
    date_signature: transaction.acteSigneLe
      ? new Date(transaction.acteSigneLe).toLocaleDateString("fr-FR")
      : new Date().toLocaleDateString("fr-FR"),
    type_transaction: transaction.type.libelle,
    objet_transaction: transaction.objet || transaction.type.libelle,
    cabinet_nom: tenant.raisonSociale,
    cabinet_adresse: tenant.adresse || "",
    vendeur_nom: partiesByRole("VENDEUR").join(" et "),
    acheteur_nom: partiesByRole("ACHETEUR").join(" et "),
    bailleur_nom: partiesByRole("BAILLEUR").join(" et "),
    locataire_nom: partiesByRole("LOCATAIRE").join(" et "),
    garant_nom: partiesByRole("GARANT").join(" et "),
    mandant_nom: partiesByRole("MANDANT").join(" et "),
    notaire_nom: transaction.notaireNom || "",
    notaire_etude: transaction.notaireEtude || "",
    designation_bien: bienLabel(bien),
    adresse_bien:
      [bien?.adresse, bien?.quartier, bien?.commune].filter(Boolean).join(", ") || "",
    superficie: bien?.superficie ? `${bien.superficie} ${bien.uniteSuperficie || "m²"}` : "",
    nicad: bien?.parcelle?.nicad || "",
    titre_foncier: bien?.parcelle?.titreFoncier || "",
    reference_droit: bien?.referenceDroit || bien?.parcelle?.referenceDroit || "",
    type_droit: bien?.typeDroit || "",
    prix_vente: transaction.prix ? transaction.prix.toLocaleString("fr-FR") : "",
    devise: transaction.devise || "XOF",
    loyer: transaction.loyer ? transaction.loyer.toLocaleString("fr-FR") : "",
    depot_garantie: transaction.depotGarantie
      ? transaction.depotGarantie.toLocaleString("fr-FR")
      : "",
    avance_loyer: transaction.avanceLoyer
      ? transaction.avanceLoyer.toLocaleString("fr-FR")
      : "",
    duree: transaction.dureeMois ? `${transaction.dureeMois} mois` : "",
    date_effet: transaction.dateEffet
      ? new Date(transaction.dateEffet).toLocaleDateString("fr-FR")
      : "",
    jour_echeance: transaction.jourEcheanceLoyer ? String(transaction.jourEcheanceLoyer) : "",
    charges_mensuelles: transaction.chargesMensuelles
      ? transaction.chargesMensuelles.toLocaleString("fr-FR")
      : "",
    charges_incluses: transaction.chargesIncluses ? "incluses dans le loyer" : "",
    mode_paiement: transaction.modePaiementLoyer || "",
    commission:
      transaction.commissionValeur != null
        ? `${transaction.commissionValeur}${transaction.commissionType === "POURCENTAGE" ? " %" : ` ${transaction.devise}`}${transaction.commissionBase ? ` ${transaction.commissionBase}` : ""}`
        : "",
    type_mandat: transaction.typeMandat || "",
    net_vendeur: transaction.netVendeur ? transaction.netVendeur.toLocaleString("fr-FR") : "",
    honoraires_agence: transaction.honorairesAgence
      ? transaction.honorairesAgence.toLocaleString("fr-FR")
      : "",
    tva: transaction.tva ? transaction.tva.toLocaleString("fr-FR") : "",
    taxes_municipales: transaction.taxesMunicipales
      ? transaction.taxesMunicipales.toLocaleString("fr-FR")
      : "",
    frais_notaire: transaction.fraisNotaire
      ? transaction.fraisNotaire.toLocaleString("fr-FR")
      : "",
    clauses_particulieres: Array.isArray(transaction.clausesParticulieres)
      ? (transaction.clausesParticulieres as string[]).map((c) => `• ${c}`).join("\n")
      : "",
    conditions_suspensives: transaction.conditionsSuspensives || "",
    liste_pieces: piecesLabels,
    nb_originaux: String(transaction.type.nbExemplaires || 2),
    nb_exemplaires: String(transaction.type.nbExemplaires || 2),
    dossier: transaction.dossier.referenceInterne,
    client: transaction.dossier.client.raisonSociale,
    signataire_nom: "",
    signataire_qualite: "",
  };

  // Variables génériques par rôle : {{employeur_nom}}, {{cedant_nom}},
  // {{prestataire_nom}}… — pré-remplies pour tout rôle déclaré sur la
  // transaction (plusieurs parties de même rôle → « A et B »).
  const nomsParRole = new Map<string, string[]>();
  for (const p of transaction.parties) {
    const label = partieLabel(p);
    if (!label) continue;
    const cle = String(p.role).toLowerCase();
    nomsParRole.set(cle, [...(nomsParRole.get(cle) || []), label]);
  }
  for (const [role, noms] of nomsParRole) {
    const cle = `${role}_nom`;
    if (!auto[cle]) auto[cle] = noms.join(" et ");
  }
  // Liste consolidée des parties pour les préambules génériques.
  auto.liste_parties = transaction.parties
    .map((p) => {
      const roleLabel =
        TRX_PARTIE_ROLES.find((r) => r.code === p.role)?.label || p.role;
      return `${roleLabel} : ${partieLabel(p)}${p.qualite ? ` (${p.qualite})` : ""}`;
    })
    .join("\n");

  const variablesMap: Record<string, string> = { ...auto, ...(variables || {}) };

  if (modele?.contenu) {
    const user = await ctx.prisma.user.findUnique({
      where: { id: ctx.userId },
      select: { prenom: true, nom: true, titre: true },
    });
    const suggestions = suggestVariableValues(extractTemplateVariables(modele.contenu), {
      cabinet: {
        raisonSociale: tenant.raisonSociale,
        adresse: tenant.adresse ?? undefined,
        telephone: String(config.telephonePrincipal ?? ""),
        email: String(config.email ?? ""),
      },
      user: user ? { prenom: user.prenom, nom: user.nom, titre: user.titre ?? undefined } : undefined,
      dossier: transaction.dossier,
      client: {
        raisonSociale: transaction.dossier.client.raisonSociale,
        adresse: transaction.dossier.client.adresse ?? undefined,
        coordonnees: transaction.dossier.client.coordonnees,
        representants: transaction.dossier.client.representants,
      },
    });
    for (const [k, v] of Object.entries(suggestions)) {
      if (!variablesMap[k]?.trim()) variablesMap[k] = v;
    }
    if (!variablesMap.signataire_nom) {
      variablesMap.signataire_nom = [user?.prenom, user?.nom].filter(Boolean).join(" ");
    }
    if (!variablesMap.signataire_qualite) {
      variablesMap.signataire_qualite = user?.titre || "";
    }
  }

  const docTitle = modele?.titre || `Document — ${transaction.type.libelle}`;
  // Version confidentielle : suppression des blocs [[CONFIDENTIEL]]…[[/CONFIDENTIEL]]
  // (article de rémunération…) AVANT le rendu — sinon les marqueurs seraient
  // déjà retirés par renderDocumentTemplate.
  let contenuBrut = modele?.contenu || "";
  if (confidentiel && contenuBrut) {
    contenuBrut = contenuBrut
      .replace(/\[\[CONFIDENTIEL\]\][\s\S]*?\[\[\/CONFIDENTIEL\]\]/g, "")
      .replace(/\n{3,}/g, "\n\n");
  }
  const docContent = contenuBrut
    ? renderDocumentTemplate(contenuBrut, variablesMap)
    : `Objet : ${transaction.type.libelle}\n\n${transaction.objet || ""}`;

  // Une version confidentielle (sans article rémunération) n'est jamais
  // publiée sur l'espace client : ce variant sert à être remis à des tiers.
  const publie = confidentiel ? false : publieClient;

  // Filigrane BROUILLON tant que la transaction n'a pas atteint un statut
  // « document final » (signature / exécution).
  const finalise = STATUTS_DOCUMENT_FINAL.includes(transaction.statut) || apercu !== true && transaction.statut === "CLOTURE";
  const watermark = apercu || !finalise ? "BROUILLON" : undefined;

  let signatureImage: Uint8Array | undefined;
  try {
    const currentUser = await ctx.prisma.user.findUnique({
      where: { id: ctx.userId },
      select: { signatureKey: true },
    });
    if (currentUser?.signatureKey) {
      const buffer = await getDocumentBuffer(currentUser.signatureKey);
      signatureImage = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    }
  } catch (err) {
    console.error("Signature utilisateur illisible", err);
  }

  try {
    const pdfBytes = await generateLegalPdf(
      {
        title: docTitle,
        reference: transaction.reference,
        date: new Date().toLocaleDateString("fr-FR"),
        recipient: transaction.notaireNom || "",
        body: docContent,
        signature: signatureImage ? " " : "",
        signatureImage,
        watermark,
      },
      cabinetInfo,
      theme
    );

    const pdfBuffer = Buffer.from(pdfBytes);
    const fileName = `${docTitle} - ${transaction.reference}.pdf`;

    // Mode aperçu : PDF retourné sans archivage ni événement.
    if (apercu) {
      return new NextResponse(pdfBuffer, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="${encodeURIComponent(fileName)}"`,
          "Cache-Control": "no-store",
        },
      });
    }

    const tenantKey = await publicPrisma.tenantKey.findFirst({
      where: { tenantId: ctx.tenantId },
    });
    if (!tenantKey) {
      return NextResponse.json({ error: "Clé du cabinet manquante" }, { status: 500 });
    }
    const publicKeyJwk = JSON.parse(tenantKey.publicKey) as JsonWebKey;
    const { encryptedFile, encryptedDek, iv } = await encryptDocumentServerSide(pdfBuffer, publicKeyJwk);

    const hash = crypto.createHash("sha256").update(pdfBuffer).digest("hex");
    const s3Key = `tenants/${ctx.tenantId}/dossiers/${transaction.dossierId}/${hash}`;
    await uploadDocument(s3Key, encryptedFile, "application/pdf");

    const document = await ctx.prisma.document.create({
      data: {
        dossierId: transaction.dossierId,
        nom: fileName,
        categorie: "contrat",
        s3KeyChiffre: s3Key,
        hashSha256: hash,
        taille: pdfBuffer.length,
        publieClient: publie === true,
        datePublication: publie === true ? new Date() : null,
        creePar: ctx.userId,
        metadata: {
          description: docTitle,
          originalType: "application/pdf",
          iv: iv.toString("base64"),
          encryptedDek: encryptedDek.toString("base64"),
          chiffre: true,
          source: "transaction",
          transactionId: transaction.id,
          transactionReference: transaction.reference,
          modeleId: modele?.id || null,
          modeleCode: modele?.code || null,
          brouillon: !!watermark,
          confidentiel: !!confidentiel,
        } as any,
      },
    });

    await ctx.prisma.transactionEvenement.create({
      data: {
        transactionId: transaction.id,
        type: "NOTE",
        description: `Document généré : ${docTitle} (${modele?.code || "libre"})${watermark ? " — brouillon" : ""}${confidentiel ? " — version confidentielle" : ""}`,
        details: { documentId: document.id, modeleCode: modele?.code },
        creePar: ctx.userId,
      },
    });

    await logAudit(ctx.prisma, ctx.userId, "transaction_pdf_generated", "transaction", transaction.id, {
      modeleId: modele?.id || null,
      documentId: document.id,
    });

    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${encodeURIComponent(fileName)}"`,
        "Cache-Control": "no-store",
        "X-Document-Id": document.id,
        "X-Document-Saved": "true",
      },
    });
  } catch (error) {
    console.error("Transaction PDF generation error", error);
    return NextResponse.json({ error: "Erreur lors de la génération du PDF" }, { status: 500 });
  }
}
