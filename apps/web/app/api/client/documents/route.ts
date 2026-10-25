import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getSessionFromRequest } from "@/lib/session";
import { getTenantPrisma } from "@/lib/prisma";
import { uploadDocument } from "@/lib/s3";
import { logAudit } from "@/lib/audit";
import { clientDossierFilter } from "@/lib/client-access";

/// Catégories qu'un client est autorisé à attribuer à ses propres dépôts.
const CLIENT_CATEGORIES = ["correspondance", "contrat", "pv", "facture", "titre_foncier", "assignation", "autre"];
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 Mo

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session.userId || !session.isClient || !session.clientId) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const tenantId = req.headers.get("x-tenant-id") || session.tenantId || "";
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant non résolu" }, { status: 400 });
  }
  const prisma = await getTenantPrisma(tenantId);

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const dossierId = formData.get("dossierId") as string;

    if (!file || !dossierId) {
      return NextResponse.json({ error: "Fichier et dossier requis" }, { status: 400 });
    }

    const categorie = (formData.get("categorie") as string) || "autre";
    const rawNom = (formData.get("nom") as string) || file.name || "document";
    const dotIndex = file.name.lastIndexOf(".");
    const fileExt = dotIndex > 0 && dotIndex < file.name.length - 1
      ? file.name.slice(dotIndex).toLowerCase()
      : "";
    const nom = fileExt && !rawNom.toLowerCase().endsWith(fileExt)
      ? `${rawNom}${fileExt}`
      : rawNom;
    const description = (formData.get("description") as string) || "";
    const encryptedDek = formData.get("encryptedDek") as File | null;
    const iv = formData.get("iv") as string | null;
    if (!CLIENT_CATEGORIES.includes(categorie)) {
      return NextResponse.json({ error: "Catégorie non autorisée" }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "Fichier trop volumineux (25 Mo maximum)" }, { status: 400 });
    }

    // Le client ne peut déposer que dans ses propres dossiers.
    const dossier = await prisma.dossier.findFirst({
      where: { id: dossierId, ...clientDossierFilter(session.userId, session.clientId) },
      select: {
        id: true,
        referenceInterne: true,
        avocatResponsableId: true,
        huissierResponsableId: true,
        client: { select: { raisonSociale: true } },
      },
    });
    if (!dossier) {
      return NextResponse.json({ error: "Accès interdit à ce dossier" }, { status: 403 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const hash = crypto.createHash("sha256").update(bytes).digest("hex");

    const s3Key = `tenants/${tenantId}/dossiers/${dossierId}/${hash}`;
    await uploadDocument(s3Key, bytes, file.type || "application/octet-stream");

    const metadata: Record<string, unknown> = {
      description,
      originalType: file.type || null,
      sourceClient: true,
      clientId: session.clientId,
    };
    if (iv && encryptedDek) {
      const dekBytes = Buffer.from(await encryptedDek.arrayBuffer());
      metadata.iv = iv;
      metadata.encryptedDek = dekBytes.toString("base64");
      metadata.chiffre = true;
    }

    const document = await prisma.document.create({
      data: {
        dossierId,
        nom,
        categorie,
        s3KeyChiffre: s3Key,
        hashSha256: hash,
        taille: bytes.length,
        // Un dépôt client reste visible par son auteur dans l'espace client.
        publieClient: true,
        datePublication: new Date(),
        creePar: session.userId,
        metadata: metadata as any,
      },
    });

    // Notifie l'avocat responsable (et l'huissier s'il y en a un) du dépôt client.
    const destinataires = Array.from(
      new Set([dossier.avocatResponsableId, dossier.huissierResponsableId].filter(Boolean) as string[])
    );
    if (destinataires.length) {
      try {
        await prisma.notification.createMany({
          data: destinataires.map((userId) => ({
            userId,
            dossierId,
            type: "depot_document_client",
            titre: `Nouveau document client : ${nom}`,
            message: `${dossier.client.raisonSociale} a déposé « ${nom} » sur le dossier ${dossier.referenceInterne}.${
              description ? ` Message : ${description}` : ""
            }`,
            severite: "info",
          })),
        });
      } catch (notifError) {
        console.error("Notification dépôt client:", notifError);
      }
    }

    await logAudit(prisma, session.userId, "document_uploaded_by_client", "document", document.id, {
      clientId: session.clientId,
      dossierId,
    });
    return NextResponse.json(document, { status: 201 });
  } catch (error) {
    console.error("Client upload document error", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
