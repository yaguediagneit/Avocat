import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";
import { getDossierScopedAccessFilter, canAccessDossier } from "@/lib/rbac";
import { tableSearchWhere } from "@/lib/search";
import { logAudit } from "@/lib/audit";
import {
  TRANSACTION_STATUT_LABELS,
  formatTransactionReference,
  genererEcheancierBail,
} from "@/lib/transactions";
import { transactionSchema, transactionData } from "@/lib/transactions-schemas";

export async function GET(req: NextRequest) {
  const ctx = await guard(req);
  if (ctx instanceof NextResponse) return ctx;

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || "";
  const statut = searchParams.get("statut") || "";
  const typeId = searchParams.get("typeId") || "";
  const dossierId = searchParams.get("dossierId") || "";
  const famille = searchParams.get("famille") || "";

  const scopeFilter = await getDossierScopedAccessFilter(
    ctx.prisma,
    ctx.userId,
    ctx.roleInfo,
    "transactions"
  );

  const transactions = await ctx.prisma.transaction.findMany({
    where: {
      ...scopeFilter,
      archiveLe: null,
      ...(statut ? { statut } : {}),
      ...(typeId ? { typeId } : {}),
      ...(dossierId ? { dossierId } : {}),
      ...(famille ? { type: { famille } } : {}),
      ...tableSearchWhere(q, [
        "reference",
        "objet",
        "statut",
        "sousType",
        "type.libelle",
        "notaireNom",
        "dossier.referenceInterne",
        "dossier.client.raisonSociale",
        "parties.nomLibre",
        "parties.demandeur.nom",
        "parties.demandeur.raisonSociale",
        "biens.bien.designation",
        "biens.bien.commune",
      ]),
    },
    include: {
      type: { select: { code: true, libelle: true, famille: true, workflow: true } },
      dossier: {
        select: { id: true, referenceInterne: true, client: { select: { raisonSociale: true } } },
      },
      parties: {
        select: {
          role: true,
          nomLibre: true,
          demandeur: { select: { nom: true, prenoms: true, raisonSociale: true } },
          client: { select: { raisonSociale: true } },
        },
        orderBy: { ordre: "asc" },
      },
      biens: {
        select: { bien: { select: { designation: true, commune: true, nature: true } } },
      },
      _count: { select: { formalites: true, paiements: true, demarches: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 300,
  });

  return NextResponse.json(transactions);
}

export async function POST(req: NextRequest) {
  const ctx = await guard(req, { resource: "transactions", action: "write" });
  if (ctx instanceof NextResponse) return ctx;

  try {
    const body = await req.json();
    const parsed = transactionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const data = parsed.data;

    const type = await ctx.prisma.transactionType.findUnique({
      where: { id: data.typeId },
      include: { pieces: { where: { actif: true }, orderBy: { ordre: "asc" } } },
    });
    if (!type || !type.actif) {
      return NextResponse.json({ error: "Type de transaction inconnu ou inactif" }, { status: 400 });
    }

    // Rattachement obligatoire à un dossier juridique (GED, RBAC,
    // confidentialité) — vérifié en écriture.
    const dossierOk = await canAccessDossier(
      ctx.prisma, ctx.userId, ctx.roleInfo, data.dossierId, "write"
    );
    if (!dossierOk) {
      return NextResponse.json({ error: "Accès interdit à ce dossier" }, { status: 403 });
    }

    // Statut initial selon le workflow.
    const statutInitial =
      type.workflow === "VENTE_TF"
        ? "OUVERTURE_TRANSACTION"
        : "BROUILLON";

    const annee = new Date().getFullYear();
    let transaction = null;
    // Référence séquentielle par année, avec reprise en cas de collision.
    for (let tentative = 0; tentative < 5 && !transaction; tentative++) {
      const compte = await ctx.prisma.transaction.count({
        where: { reference: { startsWith: `TRX-${annee}-` } },
      });
      const reference = formatTransactionReference(annee, compte + 1 + tentative);
      try {
        transaction = await ctx.prisma.$transaction(async (tx) => {
          const created = await tx.transaction.create({
            data: {
              ...(transactionData(data) as any),
              reference,
              statut: statutInitial,
              risque: type.sensible ? "ELEVE" : "STANDARD",
              creePar: ctx.userId,
            },
          });
          // La check-list du type est matérialisée sur la transaction.
          if (type.pieces.length) {
            await tx.transactionPiece.createMany({
              data: type.pieces.map((p) => ({
                transactionId: created.id,
                code: p.code,
                libelle: p.libelle,
                categorie: p.categorie,
                niveau: p.niveau,
                condition: p.condition,
                partieConcernee: p.partieConcernee,
                sourceAttendue: p.sourceAttendue,
                ordre: p.ordre,
              })),
            });
          }
          // Biens rattachés.
          if (data.biensIds?.length) {
            await tx.transactionBien.createMany({
              data: data.biensIds.map((bienId, i) => ({
                transactionId: created.id,
                bienId,
                role: i === 0 ? "PRINCIPAL" : "ANNEXE",
              })),
              skipDuplicates: true,
            });
          }
          // Parties déclarées à la création.
          if (data.parties?.length) {
            await tx.transactionPartie.createMany({
              data: data.parties.map((p, i) => ({
                transactionId: created.id,
                role: p.role,
                demandeurId: p.demandeurId || null,
                clientId: p.clientId || null,
                nomLibre: p.nomLibre || null,
                qualite: p.qualite || null,
                ordre: i,
              })),
            });
          }
          // Échéancier de bail généré à la demande (loyer + charges +
          // reversement bailleur net de commission).
          if (data.genererEcheances && type.workflow === "BAIL") {
            const bailleur = data.parties?.find(
              (p) => p.role === "BAILLEUR" || p.role === "bailleur"
            );
            let bailleurNom = bailleur?.nomLibre || null;
            if (!bailleurNom && bailleur?.demandeurId) {
              const d = await tx.demandeur.findUnique({
                where: { id: bailleur.demandeurId },
                select: { nom: true, prenoms: true, raisonSociale: true },
              });
              bailleurNom = d?.raisonSociale || [d?.prenoms, d?.nom].filter(Boolean).join(" ") || null;
            }
            const rows = genererEcheancierBail(
              { ...created, dateEffet: created.dateEffet },
              bailleurNom
            );
            if (rows.length) {
              await tx.transactionEcheance.createMany({
                data: rows.map((r) => ({
                  transactionId: created.id,
                  nature: r.nature,
                  periode: r.periode,
                  jourEcheance: r.jourEcheance,
                  montantDu: r.montantDu,
                  beneficiaire: r.beneficiaire,
                  creePar: ctx.userId,
                })),
              });
            }
          }
          await tx.transactionEvenement.create({
            data: {
              transactionId: created.id,
              type: "CHANGEMENT_STATUT",
              description: `Création de la transaction (${TRANSACTION_STATUT_LABELS[statutInitial] || statutInitial})`,
              details: { statut: statutInitial, typeCode: type.code },
              creePar: ctx.userId,
            },
          });
          return created;
        });
      } catch (e: any) {
        if (e?.code === "P2002") continue; // collision de référence
        throw e;
      }
    }

    if (!transaction) {
      return NextResponse.json({ error: "Impossible de générer la référence" }, { status: 500 });
    }

    await logAudit(ctx.prisma, ctx.userId, "transaction_created", "transaction", transaction.id, {
      reference: transaction.reference,
      typeCode: type.code,
      dossierId: data.dossierId,
    }, req);

    return NextResponse.json(transaction, { status: 201 });
  } catch (error) {
    console.error("Create transaction error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
