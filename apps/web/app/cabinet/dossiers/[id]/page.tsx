import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getServerAuth, serverCanAccessDossier } from "@/lib/server-auth";
import { estIntervenantExterne, hasPermission } from "@/lib/rbac";
import { notFound } from "next/navigation";
import Link from "next/link";
import { DossierTabs } from "./dossier-tabs";
import { StatutSelect } from "./statut-select";
import { FilDiscussion } from "./fil-discussion";
import { MatriceRACI } from "./matrice-raci";
import { PartageClientToggle } from "./partage-client-toggle";
import { ChecklistCloture } from "./checklist-cloture";
import { findSpecialiteForTypeAffaire } from "@/lib/specialite";
import { naturesMissionOf } from "@/lib/nature-mission";
import { DossierPdfButton } from "./dossier-pdf-button";
import { PaginatedUl } from "@/components/pagination";

const TYPE_LABELS: Record<string, string> = {
  contentieux_contractuel: "Contentieux contractuel",
  contentieux_immobilier: "Contentieux immobilier",
  recouvrement: "Recouvrement de créances",
  procedure_civile: "Procédure civile / commerciale",
  conseil: "Conseil / Consultation",
  expulsion: "Expulsion et recouvrement",
  bail: "Baux commerciaux et d'habitation",
  foncier: "Litiges fonciers",
  signification: "Signification / Actes d'huissier",
  constat: "Constats et procès-verbaux",
  saisie: "Saisies et mesures d'exécution",
  negociation: "Négociation / Règlement amiable",
};

interface PartieAdverse {
  nom?: string;
  prenom?: string;
  raisonSociale?: string;
  qualite?: string;
}

export default async function DossierDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getSession();
  const auth = await getServerAuth();
  const externe = estIntervenantExterne(auth.role);
  const dossier = await prisma.dossier.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      referenceInterne: true,
      typeAffaire: true,
      natureMission: true,
      dateOuverture: true,
      statut: true,
      clientId: true,
      createurId: true,
      avocatResponsableId: true,
      huissierResponsableId: true,
      niveauConfidentialite: true,
      partiesAdverses: true,
      dateEcheance: true,
      partageClient: true,
      client: { select: { id: true, raisonSociale: true } },
      // Les intervenants externes ne voient que les documents partagés avec eux.
      documents: {
        where: externe ? { partageExterne: true } : {},
        orderBy: { createdAt: "desc" },
        take: 50,
      },
      taches: {
        orderBy: { echeance: "asc" },
        take: 50,
      },
      evenements: {
        orderBy: { dateDebut: "asc" },
        take: 5,
      },
      missions: {
        orderBy: { createdAt: "desc" },
        take: 5,
      },
      missionsArchitecte: {
        orderBy: { createdAt: "desc" },
        take: 5,
      },
      missionsConseillerJuridique: {
        orderBy: { createdAt: "desc" },
        take: 5,
      },
      missionsClerc: {
        orderBy: { createdAt: "desc" },
        take: 5,
      },
      demarches: {
        select: {
          id: true,
          reference: true,
          statut: true,
          objet: true,
          createdAt: true,
          type: { select: { code: true, libelle: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
      transactions: {
        select: {
          id: true,
          reference: true,
          statut: true,
          objet: true,
          prix: true,
          loyer: true,
          devise: true,
          createdAt: true,
          archiveLe: true,
          type: { select: { code: true, libelle: true, mutationFonciere: true } },
          parties: {
            select: {
              role: true,
              nomLibre: true,
              demandeur: { select: { nom: true, prenoms: true, raisonSociale: true, typePersonne: true } },
            },
            orderBy: { ordre: "asc" as const },
            take: 4,
          },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
      conflitsInteret: {
        include: {
          dossierConflit: { select: { id: true, referenceInterne: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!dossier) {
    notFound();
  }

  const canAccess = await serverCanAccessDossier(params.id, "read");
  if (!canAccess) {
    notFound();
  }

  /// Seuls l'administrateur et le créateur du dossier peuvent modifier la matrice RACI.
  const canEditRACI = auth.estAdmin || auth.userId === dossier.createurId;

  const parametres = await prisma.parametre.findMany({
    where: { categorie: { in: ["nature_mission", "niveau_confidentialite"] }, actif: true },
  });

  const natureMissionLabels: Record<string, string> = {};
  const confidentialiteLabels: Record<number, string> = {};
  for (const p of parametres) {
    if (p.categorie === "nature_mission") {
      natureMissionLabels[p.code] = p.libelle;
    } else if (p.categorie === "niveau_confidentialite") {
      confidentialiteLabels[parseInt(p.code, 10)] = p.libelle;
    }
  }

  const users = await prisma.user.findMany({
    take: 200,
    where: { actif: true },
    select: { id: true, prenom: true, nom: true, role: { select: { nom: true, estClient: true } } },
  });
  const userMap = new Map(users.map((u) => [u.id, `${u.prenom} ${u.nom}`]));

  const [parametreTypeAffaire, specialites] = await Promise.all([
    prisma.parametre.findFirst({
      where: { categorie: "type_affaire", code: dossier.typeAffaire, actif: true },
      select: { libelle: true },
    }),
    prisma.specialite.findMany({
      where: { actif: true },
      select: { id: true, code: true, libelle: true },
    }),
  ]);

  const specialite = findSpecialiteForTypeAffaire(
    dossier.typeAffaire,
    parametreTypeAffaire?.libelle,
    specialites
  );

  // Types de documents attendus pour la spécialité du dossier.
  const typesDocumentsAttendus = specialite
    ? await prisma.typeDocumentSpecialite.findMany({
        where: { specialiteId: specialite.id, actif: true },
        orderBy: [{ ordre: "asc" }, { libelle: "asc" }],
        select: { code: true, libelle: true, obligatoire: true },
      })
    : [];

  const tacheTemplateData = specialite
    ? await prisma.tacheTemplate.findMany({
        where: { specialiteId: specialite.id, actif: true },
        select: { id: true, titre: true, wordTemplateKey: true },
      })
    : [];
  const tacheTemplateIds = Object.fromEntries(
    tacheTemplateData.map((t) => [t.titre, t.id])
  );
  const tacheTemplateWordByTitre = Object.fromEntries(
    tacheTemplateData.map((t) => [t.titre, !!t.wordTemplateKey])
  );

  const parties = (dossier.partiesAdverses as PartieAdverse[] | null) || [];

  // Partage client : réservé au créateur, au responsable ou à l'administrateur.
  const canPartagerClient =
    auth.estAdmin ||
    dossier.createurId === auth.userId ||
    dossier.avocatResponsableId === auth.userId ||
    dossier.huissierResponsableId === auth.userId;

  // Droit de modifier (activer/désactiver) les documents du dossier.
  const canEditDocuments = hasPermission(auth.role, "documents", "write");

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{dossier.referenceInterne}</h1>
          <p className="text-sm text-gray-600">
            {TYPE_LABELS[dossier.typeAffaire] || parametreTypeAffaire?.libelle || specialite?.libelle || dossier.typeAffaire} ·{" "}
            {naturesMissionOf(dossier.natureMission).map((c) => natureMissionLabels[c] || c).join(" · ") || "—"} · ouvert le{" "}
            {new Date(dossier.dateOuverture).toLocaleDateString("fr-FR")}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <StatutSelect dossierId={dossier.id} current={dossier.statut} />
          <DossierPdfButton dossierId={dossier.id} />
          <Link href={`/cabinet/dossiers/${dossier.id}/modifier`} className="btn-secondary">
            Modifier
          </Link>
        </div>
      </div>

      <DossierTabs
        dossier={dossier}
        userMap={Object.fromEntries(userMap)}
        currentUserId={auth.userId}
        estAdmin={auth.estAdmin}
        tacheTemplateIds={tacheTemplateIds}
        tacheTemplateWordByTitre={tacheTemplateWordByTitre}
        typesDocumentsAttendus={typesDocumentsAttendus}
        canEditDocuments={canEditDocuments}
      />

      <div className="card space-y-4">
        <h2 className="font-semibold">Résumé</h2>
        <div className="grid gap-4 text-sm md:grid-cols-2">
          <div>
            <span className="text-gray-500">Client principal</span>
            <p>
              <Link href={`/cabinet/clients/${dossier.clientId}`} className="text-cabinet-700 hover:underline">
                {dossier.client.raisonSociale}
              </Link>
            </p>
          </div>
          <div>
            <span className="text-gray-500">Avocat responsable</span>
            <p>{userMap.get(dossier.avocatResponsableId) || dossier.avocatResponsableId}</p>
          </div>
          <div>
            <span className="text-gray-500">Huissier responsable</span>
            <p>{userMap.get(dossier.huissierResponsableId || "") || dossier.huissierResponsableId || "—"}</p>
          </div>
          <div>
            <span className="text-gray-500">Niveau de confidentialité</span>
            <p>
              {confidentialiteLabels[dossier.niveauConfidentialite] || dossier.niveauConfidentialite}
            </p>
          </div>
          {canPartagerClient && (
            <PartageClientToggle
              dossierId={dossier.id}
              initialPartage={dossier.partageClient}
            />
          )}
          {dossier.dateEcheance && (
            <div>
              <span className="text-gray-500">Échéance</span>
              <p>{new Date(dossier.dateEcheance).toLocaleDateString("fr-FR")}</p>
            </div>
          )}
          <div className="md:col-span-2">
            <span className="text-gray-500">Parties adverses</span>
            {parties.length === 0 ? (
              <p className="text-gray-500">—</p>
            ) : (
              <ul className="mt-1 space-y-1">
                <PaginatedUl>
                {parties.map((p, i) => {
                  const nom = p.raisonSociale || `${p.prenom || ""} ${p.nom || ""}`.trim() || "Partie";
                  return (
                    <li key={i} className="text-sm">
                      {nom}
                      {p.qualite && <span className="text-gray-500"> — {p.qualite}</span>}
                    </li>
                  );
                })}
                </PaginatedUl>
              </ul>
            )}
          </div>
        </div>
      </div>

      <div className="card space-y-4">
        <h2 className="font-semibold">Historique récent</h2>
        <p className="text-sm text-gray-600">
          Les événements d&apos;audit pour ce dossier seront affichés ici.
        </p>
      </div>

      {dossier.conflitsInteret.length > 0 && (
        <div className="card space-y-3">
          <h2 className="font-semibold">Conflits d&apos;intérêts</h2>
          <ul className="space-y-2">
            <PaginatedUl>
            {dossier.conflitsInteret.map((c) => (
              <li key={c.id} className="flex items-center justify-between rounded-md border border-gray-100 bg-gray-50 p-3 text-sm">
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        c.statut === "detecte"
                          ? "bg-amber-100 text-amber-700"
                          : c.statut === "ignore"
                            ? "bg-gray-100 text-gray-700"
                            : c.statut === "valide"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-blue-100 text-blue-700"
                      }`}
                    >
                      {c.statut}
                    </span>
                    <Link
                      href={`/cabinet/dossiers/${c.dossierConflitId}`}
                      className="font-medium text-cabinet-700 hover:underline"
                    >
                      {c.dossierConflit.referenceInterne}
                    </Link>
                  </div>
                  {(c.details as { description?: string })?.description && (
                    <p className="mt-1 text-xs text-gray-600">
                      {(c.details as { description?: string }).description}
                    </p>
                  )}
                </div>
              </li>
            ))}
            </PaginatedUl>
          </ul>
        </div>
      )}

      {session.userId && (
        <FilDiscussion dossierId={dossier.id} currentUserId={session.userId} />
      )}

      <MatriceRACI
        dossierId={dossier.id}
        users={users as any}
        tachesAttendues={Object.keys(tacheTemplateIds)}
        canEdit={canEditRACI}
        dossier={{
          client: dossier.client,
          avocatResponsableId: dossier.avocatResponsableId,
          huissierResponsableId: dossier.huissierResponsableId,
        } as any}
      />

      <ChecklistCloture dossierId={dossier.id} />
    </div>
  );
}
