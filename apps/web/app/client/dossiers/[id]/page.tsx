import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { clientDossierFilter } from "@/lib/client-access";
import { naturesMissionOf } from "@/lib/nature-mission";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ClientDocumentUpload } from "@/app/client/documents/client-document-upload";
import {
  NIVEAU_LABELS,
  PROCEDURE_STATUT_LABELS,
  TYPE_DECISION_LABELS,
  SENS_DECISION_LABELS,
  TYPE_RECOURS_LABELS,
  ORIGINE_LABELS,
  RECOURS_STATUT_LABELS,
  RECOURS_STATUT_BADGES,
  PROCEDURE_STATUT_BADGES,
  ISSUE_LABELS,
} from "@/lib/recours";

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

const CATEGORIE_LABELS: Record<string, string> = {
  correspondance: "Correspondance",
  contrat: "Contrat",
  conclusions: "Conclusions",
  pv: "Procès-verbal",
  facture: "Facture",
  titre_foncier: "Titre foncier",
  assignation: "Assignation",
  note_interne: "Note interne",
  autre: "Autre",
};

const STATUT_BADGES: Record<string, string> = {
  Prospect: "bg-gray-100 text-gray-700",
  Nouveau: "bg-cabinet-100 text-cabinet-800",
  "En cours d'analyse": "bg-cabinet-100 text-cabinet-800",
  "En cours": "bg-cabinet-100 text-cabinet-800",
  Clôturé: "bg-emerald-100 text-emerald-700",
  Archivé: "bg-gray-200 text-gray-700",
};

export default async function ClientDossierDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getSession();

  if (!session.isClient || !session.clientId) {
    return (
      <div className="card p-6 text-center">
        <p className="text-gray-600">Veuillez vous connecter avec un compte client.</p>
        <Link href="/client/login" className="btn-primary mt-4 inline-block">
          Se connecter
        </Link>
      </div>
    );
  }

  const dossier = await prisma.dossier.findFirst({
    where: { id: params.id, ...clientDossierFilter(session.userId!, session.clientId) },
    include: {
      documents: {
        where: { publieClient: true },
        orderBy: { datePublication: "desc" },
        take: 50,
      },
      evenements: {
        where: { estPublicClient: true },
        orderBy: { dateDebut: "asc" },
        take: 50,
      },
      factures: {
        orderBy: { dateEmission: "desc" },
        take: 50,
        include: { paiements: true },
      },
      procedures: {
        where: { publieClient: true },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          niveau: true,
          juridiction: true,
          chambre: true,
          dateSaisine: true,
          datePrononce: true,
          typeDecision: true,
          decision: true,
          sensDecision: true,
          statut: true,
          recoursExerces: {
            select: {
              id: true,
              typeRecours: true,
              origine: true,
              juridictionCible: true,
              statut: true,
              dateLimite: true,
              dateDeclaration: true,
              issue: true,
            },
            orderBy: { createdAt: "asc" },
          },
        },
      },
    },
  });

  if (!dossier) {
    notFound();
  }

  // Les factures ne sont montrées qu'au client principal du dossier,
  // pas aux intervenants simplement informés via la matrice RACI.
  const isClientPrincipal = dossier.clientId === session.clientId;
  const factures = isClientPrincipal ? dossier.factures : [];

  const parametres = await prisma.parametre.findMany({
    where: { categorie: "nature_mission", actif: true },
  });
  const natureMissionLabels: Record<string, string> = {};
  for (const p of parametres) {
    natureMissionLabels[p.code] = p.libelle;
  }

  const users = await prisma.user.findMany({
    take: 200,
    select: { id: true, prenom: true, nom: true },
  });
  const userMap = new Map(users.map((u) => [u.id, `${u.prenom} ${u.nom}`]));

  const totalFactures = factures.reduce((acc, f) => acc + Number(f.totalTtc), 0);
  const totalPaye = factures.reduce(
    (acc, f) => acc + f.paiements.reduce((p, pay) => p + Number(pay.montant), 0),
    0
  );
  const solde = totalFactures - totalPaye;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{dossier.referenceInterne}</h1>
          <p className="text-sm text-gray-600">
            {TYPE_LABELS[dossier.typeAffaire] || dossier.typeAffaire} ·{" "}
            {naturesMissionOf(dossier.natureMission).map((c) => natureMissionLabels[c] || c).join(" · ") || "—"}
          </p>
        </div>
        <Link href="/client/dossiers" className="text-sm text-cabinet-700 hover:underline">
          ← Retour aux dossiers
        </Link>
      </div>

      <div className="card space-y-4">
        <h2 className="font-semibold">Résumé</h2>
        <div className="grid gap-4 text-sm md:grid-cols-2">
          <div>
            <span className="text-gray-500">Statut</span>
            <p>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  STATUT_BADGES[dossier.statut] || "bg-gray-100 text-gray-700"
                }`}
              >
                {dossier.statut}
              </span>
            </p>
          </div>
          <div>
            <span className="text-gray-500">Date d&apos;ouverture</span>
            <p>{new Date(dossier.dateOuverture).toLocaleDateString("fr-FR")}</p>
          </div>
          {dossier.dateEcheance && (
            <div>
              <span className="text-gray-500">Échéance</span>
              <p>{new Date(dossier.dateEcheance).toLocaleDateString("fr-FR")}</p>
            </div>
          )}
          <div>
            <span className="text-gray-500">Avocat responsable</span>
            <p>{userMap.get(dossier.avocatResponsableId) || dossier.avocatResponsableId}</p>
          </div>
          {dossier.huissierResponsableId && (
            <div>
              <span className="text-gray-500">Huissier responsable</span>
              <p>{userMap.get(dossier.huissierResponsableId) || dossier.huissierResponsableId}</p>
            </div>
          )}
          {isClientPrincipal && (
            <div>
              <span className="text-gray-500">Solde restant dû</span>
              <p className="font-medium">{solde.toLocaleString("fr-FR")} FCFA</p>
            </div>
          )}
        </div>
      </div>

      {dossier.procedures.length > 0 && (
        <div className="card space-y-4">
          <h2 className="font-semibold">Parcours judiciaire</h2>
          <ol className="relative space-y-4 border-l-2 border-cabinet-200 pl-5">
            {dossier.procedures.map((p, idx) => (
              <li key={p.id} className="relative">
                <span className="absolute -left-[27px] top-1 h-4 w-4 rounded-full border-2 border-cabinet-500 bg-white" />
                <div className="space-y-1 rounded-xl border border-cabinet-100 bg-cabinet-50/50 px-4 py-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">
                      {idx + 1}. {NIVEAU_LABELS[p.niveau] || p.niveau} — {p.juridiction}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${PROCEDURE_STATUT_BADGES[p.statut] || "bg-gray-100 text-gray-700"}`}>
                      {PROCEDURE_STATUT_LABELS[p.statut] || p.statut}
                    </span>
                  </div>
                  {p.chambre && <p className="text-xs text-gray-500">{p.chambre}</p>}
                  <p className="text-xs text-gray-500">
                    {p.dateSaisine && `Saisie le ${new Date(p.dateSaisine).toLocaleDateString("fr-FR")}`}
                    {p.datePrononce && ` · ${TYPE_DECISION_LABELS[p.typeDecision || ""] || "Décision"} du ${new Date(p.datePrononce).toLocaleDateString("fr-FR")} (${SENS_DECISION_LABELS[p.sensDecision] || p.sensDecision})`}
                  </p>
                  {p.recoursExerces.map((r) => {
                    const enCours = !["JUGE", "IRRECEVABLE", "ARCHIVE"].includes(r.statut);
                    const restants = r.dateLimite
                      ? Math.ceil((new Date(r.dateLimite).getTime() - Date.now()) / 86400000)
                      : null;
                    return (
                      <div key={r.id} className="mt-1 flex flex-wrap items-center gap-2 border-t border-cabinet-100 pt-1 text-xs">
                        <span className="font-medium">
                          {TYPE_RECOURS_LABELS[r.typeRecours] || r.typeRecours}
                          {r.juridictionCible ? ` — ${r.juridictionCible}` : ""}
                        </span>
                        <span className="text-gray-500">({ORIGINE_LABELS[r.origine] || r.origine})</span>
                        <span className={`rounded-full px-2 py-0.5 font-medium ${RECOURS_STATUT_BADGES[r.statut] || "bg-gray-100 text-gray-700"}`}>
                          {RECOURS_STATUT_LABELS[r.statut] || r.statut}
                        </span>
                        {r.issue && <span className="text-gray-600">· {ISSUE_LABELS[r.issue] || r.issue}</span>}
                        {enCours && r.dateLimite && restants !== null && !r.dateDeclaration && (
                          <span className={restants <= 3 ? "font-semibold text-red-700" : "text-amber-700"}>
                            {restants < 0 ? "délai dépassé" : restants === 0 ? "dernier jour" : `${restants} jour(s) restant(s)`}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      <ClientDocumentUpload
        dossiers={[{ id: dossier.id, referenceInterne: dossier.referenceInterne }]}
        defaultDossierId={dossier.id}
      />

      <div className="card space-y-4">
        <h2 className="font-semibold">Documents publiés</h2>
        {dossier.documents.length === 0 ? (
          <p className="text-sm text-gray-500">Aucun document publié pour ce dossier.</p>
        ) : (
          <ul className="space-y-2">
            {dossier.documents.map((doc) => (
              <li
                key={doc.id}
                className="flex items-center justify-between rounded-xl border border-cabinet-100 bg-cabinet-50/50 px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-medium">
                    {doc.nom}
                    {Boolean((doc.metadata as Record<string, unknown> | null)?.sourceClient) && (
                      <span className="ml-2 rounded-full bg-gold-100 px-2 py-0.5 text-xs font-medium text-cabinet-800">
                        Déposé par vous
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-gray-500">{CATEGORIE_LABELS[doc.categorie] || doc.categorie}</p>
                </div>
                <a
                  href={`/api/documents/${doc.id}/download`}
                  className="text-cabinet-700 hover:underline"
                >
                  Télécharger
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card space-y-4">
        <h2 className="font-semibold">Prochains rendez-vous et échéances</h2>
        {dossier.evenements.length === 0 ? (
          <p className="text-sm text-gray-500">Aucun événement public.</p>
        ) : (
          <ul className="space-y-2">
            {dossier.evenements.map((evt) => (
              <li
                key={evt.id}
                className="rounded-xl border border-cabinet-100 bg-cabinet-50/50 px-4 py-3 text-sm"
              >
                <p className="font-medium">{evt.titre}</p>
                <p className="text-xs text-gray-500">
                  {new Date(evt.dateDebut).toLocaleString("fr-FR")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {isClientPrincipal && (
      <div className="card space-y-4">
        <h2 className="font-semibold">Factures</h2>
        {factures.length === 0 ? (
          <p className="text-sm text-gray-500">Aucune facture.</p>
        ) : (
          <ul className="space-y-2">
            {factures.map((f) => {
              const paye = f.paiements.reduce((acc, p) => acc + Number(p.montant), 0);
              const reste = Number(f.totalTtc) - paye;
              return (
                <li
                  key={f.id}
                  className="flex items-center justify-between rounded-xl border border-cabinet-100 bg-cabinet-50/50 px-4 py-3 text-sm"
                >
                  <div>
                    <p className="font-medium">{f.numero}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(f.dateEmission).toLocaleDateString("fr-FR")}
                      {f.dateEcheance && ` · échéance ${new Date(f.dateEcheance).toLocaleDateString("fr-FR")}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{Number(f.totalTtc).toLocaleString("fr-FR")} FCFA</p>
                    {reste > 0 && <p className="text-xs text-amber-600">{reste.toLocaleString("fr-FR")} FCFA restant</p>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      )}
    </div>
  );
}
