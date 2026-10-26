"use client";

import { useState } from "react";
import Link from "next/link";
import { DEMARCHE_STATUT_BADGES, DEMARCHE_STATUT_LABELS } from "@/lib/demarches";
import { TRANSACTION_STATUT_BADGES, TRANSACTION_STATUT_LABELS } from "@/lib/transactions";
import { DossierTaches } from "./dossier-taches";
import { DossierProcedures } from "./dossier-procedures";
import { ItemDiscussion } from "@/components/item-discussion";
import { RowActions } from "@/components/row-actions";
import { PaginatedRows, PaginatedUl } from "@/components/pagination";
import { useTableSort } from "@/components/table-sort";

interface DossierTabsProps {
  dossier: {
    id: string;
    matiere?: string | null;
    avocatResponsableId: string;
    huissierResponsableId?: string | null;
    documents: { id: string; nom: string; categorie: string; publieClient: boolean; partageExterne: boolean; actif: boolean; creePar: string; createdAt: Date; metadata?: unknown }[];
    taches: {
      id: string;
      titre: string;
      statut: string;
      echeance: Date | null;
      createdAt: Date;
      priorite: string;
      responsableId: string;
      createurId: string;
      description?: string | null;
    }[];
    evenements: { id: string; type: string; titre: string; dateDebut: Date }[];
    missions: { id: string; typeActe: string; statut: string; datePrevue: Date | null }[];
    missionsArchitecte: { id: string; typeActe: string; statut: string; datePrevue: Date | null }[];
    missionsConseillerJuridique: { id: string; typeActe: string; statut: string; datePrevue: Date | null }[];
    missionsClerc: { id: string; typeActe: string; statut: string; datePrevue: Date | null }[];
    demarches?: {
      id: string;
      reference: string;
      statut: string;
      objet: string | null;
      createdAt: Date;
      type: { code: string; libelle: string };
    }[];
    transactions?: {
      id: string;
      reference: string;
      statut: string;
      objet: string | null;
      prix: number | null;
      loyer: number | null;
      devise: string;
      createdAt: Date;
      archiveLe: Date | null;
      type: { code: string; libelle: string; mutationFonciere: boolean };
      parties: {
        role: string;
        nomLibre: string | null;
        demandeur: { nom: string; prenoms: string | null; raisonSociale: string | null; typePersonne: string } | null;
      }[];
    }[];
    procedures?: {
      id: string;
      niveau: string;
      juridiction: string;
      chambre: string | null;
      greffe: string | null;
      referenceRg: string | null;
      dateSaisine: Date | null;
      datePrononce: Date | null;
      dateSignification: Date | null;
      typeDecision: string | null;
      decision: string | null;
      sensDecision: string;
      statut: string;
      publieClient: boolean;
      notes: string | null;
      recoursExerces: {
        id: string;
        typeRecours: string;
        origine: string;
        juridictionCible: string | null;
        pointDepart: string | null;
        delaiJours: number | null;
        dateReference: Date | null;
        dateLimite: Date | null;
        dateDeclaration: Date | null;
        dateSignification: Date | null;
        dateConsignation: Date | null;
        dateMemoire: Date | null;
        statut: string;
        issue: string | null;
        avocatId: string | null;
        notes: string | null;
      }[];
    }[];
  };
  /// Utilisateurs actifs (sélecteur avocat en charge d'un recours).
  usersLite?: { id: string; nom: string }[];
  userMap?: Record<string, string>;
  currentUserId?: string;
  estAdmin?: boolean;
  tacheTemplateIds?: Record<string, string>;
  tacheTemplateWordByTitre?: Record<string, boolean>;
  /// Types de documents attendus selon la spécialité du dossier.
  typesDocumentsAttendus?: { code: string; libelle: string; obligatoire: boolean }[];
  /// L'utilisateur courant peut modifier les documents (documents:write).
  canEditDocuments?: boolean;
}

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

const TACHE_STATUT_BADGES: Record<string, string> = {
  "À faire": "bg-gray-100 text-gray-700",
  "En cours": "bg-cabinet-100 text-cabinet-800",
  "Terminée": "bg-emerald-100 text-emerald-700",
  "Annulée": "bg-red-100 text-red-700",
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  audience: "Audience",
  echeance: "Échéance",
  rdv: "Rendez-vous",
  signification: "Signification",
  deadline: "Deadline procédurale",
};

const EVENT_TYPE_BADGES: Record<string, string> = {
  audience: "bg-cabinet-100 text-cabinet-800",
  echeance: "bg-amber-100 text-amber-700",
  rdv: "bg-blue-100 text-blue-700",
  signification: "bg-purple-100 text-purple-700",
  deadline: "bg-red-100 text-red-700",
};

const MISSION_TYPE_LABELS: Record<string, string> = {
  signification: "Signification",
  sommation: "Sommation",
  mise_en_demeure: "Mise en demeure",
  constat: "Constat",
  saisie: "Saisie",
  convocation: "Convocation",
  commandement: "Commandement",
  recouvrement: "Recouvrement",
  pv: "Procès-verbal",
};

const MISSION_STATUT_BADGES: Record<string, string> = {
  "En préparation": "bg-gray-100 text-gray-700",
  "Tentée": "bg-amber-100 text-amber-700",
  "Remise": "bg-emerald-100 text-emerald-700",
  "Annulée": "bg-red-100 text-red-700",
  "Échouée": "bg-red-100 text-red-700",
};

const TAB_LABELS: Record<string, string> = {
  documents: "Documents",
  procedures: "Procédures & recours",
  taches: "Tâches",
  missions: "Missions",
  demarches: "Démarches",
  transactions: "Transactions",
  evenements: "Événements",
};

const TAB_COLORS: Record<string, { active: string; inactive: string }> = {
  documents: { active: "border-b-2 border-blue-600 text-blue-600", inactive: "text-gray-500 hover:text-blue-600" },
  procedures: { active: "border-b-2 border-rose-600 text-rose-600", inactive: "text-gray-500 hover:text-rose-600" },
  taches: { active: "border-b-2 border-amber-600 text-amber-600", inactive: "text-gray-500 hover:text-amber-600" },
  missions: { active: "border-b-2 border-emerald-600 text-emerald-600", inactive: "text-gray-500 hover:text-emerald-600" },
  demarches: { active: "border-b-2 border-indigo-600 text-indigo-600", inactive: "text-gray-500 hover:text-indigo-600" },
  transactions: { active: "border-b-2 border-violet-600 text-violet-600", inactive: "text-gray-500 hover:text-violet-600" },
  evenements: { active: "border-b-2 border-red-600 text-red-600", inactive: "text-gray-500 hover:text-red-600" },
};

function ConversationIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function MissionSection({
  title,
  missions,
  addHref,
  viewHref,
  detailHrefPrefix,
  canCreate = false,
}: {
  title: string;
  missions: DossierTabsProps["dossier"]["missions"];
  addHref: string;
  viewHref: string;
  detailHrefPrefix: string;
  canCreate?: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="flex justify-between">
        <h3 className="font-medium">{title}</h3>
        <div className="flex gap-4">
          {canCreate && (
            <Link href={addHref} className="text-sm text-cabinet-700 hover:underline">
              + Ajouter
            </Link>
          )}
          <Link href={viewHref} className="text-sm text-cabinet-700 hover:underline">
            Voir tout
          </Link>
        </div>
      </div>
      {missions.length === 0 ? (
        <p className="text-sm text-gray-500">Aucune mission.</p>
      ) : (
        <ul className="space-y-2">
          <PaginatedUl>
          {missions.map((mission) => (
            <li key={mission.id} className="flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between">
              <Link href={`${detailHrefPrefix}${mission.id}`} className="text-cabinet-700 hover:underline">
                {MISSION_TYPE_LABELS[mission.typeActe] || mission.typeActe}
              </Link>
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    MISSION_STATUT_BADGES[mission.statut] || "bg-gray-100 text-gray-700"
                  }`}
                >
                  {mission.statut}
                </span>
                <span className="text-gray-500">
                  {mission.datePrevue
                    ? new Date(mission.datePrevue).toLocaleDateString("fr-FR")
                    : "—"}
                </span>
              </div>
            </li>
          ))}
          </PaginatedUl>
        </ul>
      )}
    </div>
  );
}

/// Indique si un document du dossier couvre un type attendu : soit par sa
/// catégorie, soit par le type de document déclaré à l'upload (metadata).
function documentCouvre(doc: DossierTabsProps["dossier"]["documents"][number], code: string): boolean {
  if (doc.categorie === code) return true;
  const meta = (doc.metadata as { typeDocument?: string } | null) || null;
  return meta?.typeDocument === code;
}

export function DossierTabs({ dossier, userMap = {}, currentUserId = "", estAdmin = false, tacheTemplateIds = {}, tacheTemplateWordByTitre = {}, typesDocumentsAttendus = [], canEditDocuments = false, usersLite = [] }: DossierTabsProps) {
  const { th: sortTh, sorted: sortRows } = useTableSort();
  const canCreate = estAdmin || currentUserId === dossier.avocatResponsableId;
  const canEditProcedures =
    estAdmin ||
    currentUserId === dossier.avocatResponsableId ||
    currentUserId === dossier.huissierResponsableId;

  const [active, setActive] = useState<"documents" | "procedures" | "taches" | "missions" | "demarches" | "transactions" | "evenements">("documents");
  const [discussion, setDiscussion] = useState<{ id: string; titre: string; kind: "tache" | "evenement" } | null>(null);
  const demarches = dossier.demarches || [];
  const transactions = dossier.transactions || [];

  return (
    <div className="card p-0">
      <div className="flex overflow-x-auto border-b border-gray-200">
        {(["documents", "procedures", "taches", "missions", "demarches", "transactions", "evenements"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActive(tab)}
            className={`px-6 py-3 text-sm font-medium ${
              active === tab
                ? TAB_COLORS[tab].active
                : TAB_COLORS[tab].inactive
            }`}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      <div className="p-6">
        {active === "documents" && (
          <div className="space-y-3">
            <div className="flex justify-between">
              <h3 className="font-medium">Documents</h3>
              <div className="flex gap-4">
                <Link
                  href={`/cabinet/documents/nouveau?dossierId=${dossier.id}`}
                  className="text-sm text-cabinet-700 hover:underline"
                >
                  + Ajouter
                </Link>
                <Link href="/cabinet/documents" className="text-sm text-cabinet-700 hover:underline">
                  Voir tout
                </Link>
              </div>
            </div>
            {typesDocumentsAttendus.length > 0 && (
              <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Documents attendus (spécialité)
                </h4>
                <ul className="space-y-1.5">
                  <PaginatedUl>
                  {typesDocumentsAttendus.map((t) => {
                    const recus = dossier.documents.filter((d) => documentCouvre(d, t.code)).length;
                    return (
                      <li key={t.code} className="flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between">
                        <span className="flex flex-wrap items-center gap-2">
                          {t.libelle}
                          {t.obligatoire && (
                            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                              Obligatoire
                            </span>
                          )}
                          {recus > 0 ? (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                              Reçu{recus > 1 ? ` (${recus})` : ""}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">Manquant</span>
                          )}
                        </span>
                        <Link
                          href={`/cabinet/documents/nouveau?dossierId=${dossier.id}&typeDocument=${encodeURIComponent(t.code)}&categorie=${encodeURIComponent(t.code)}&nom=${encodeURIComponent(t.libelle)}`}
                          className="text-xs font-medium text-cabinet-700 hover:underline"
                        >
                          Téléverser
                        </Link>
                      </li>
                    );
                  })}
                  </PaginatedUl>
                </ul>
              </div>
            )}
            {dossier.documents.length === 0 ? (
              <p className="text-sm text-gray-500">Aucun document.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-cabinet-50 text-cabinet-900">
                    <tr>
                      {sortTh("documents", "nom", "Nom", "px-3 py-2")}
                      {sortTh("documents", "categorie", "Catégorie", "px-3 py-2")}
                      {sortTh("documents", "televerse", "Téléversé par", "px-3 py-2")}
                      {sortTh("documents", "dateUpload", "Date d'upload", "px-3 py-2")}
                      {sortTh("documents", "client", "Client", "px-3 py-2")}
                      {sortTh("documents", "externe", "Externe", "px-3 py-2")}
                      <th className="px-3 py-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <PaginatedRows colSpan={7}>
                    {sortRows("documents", dossier.documents, {
                      nom: (d) => d.nom,
                      categorie: (d) => CATEGORIE_LABELS[d.categorie] || d.categorie,
                      televerse: (d) => userMap[d.creePar],
                      dateUpload: (d) => d.createdAt,
                      client: (d) => (d.publieClient ? "Oui" : "Non"),
                      externe: (d) => (d.partageExterne ? "Oui" : "Non"),
                    }).map((doc) => (
                      <tr key={doc.id} className="border-t hover:bg-gray-50">
                        <td className="px-3 py-2 font-medium">
                          <Link href={`/cabinet/documents/${doc.id}`} className="text-cabinet-700 hover:underline">
                            {doc.nom}
                          </Link>
                        </td>
                        <td className="px-3 py-2 text-gray-600">
                          {CATEGORIE_LABELS[doc.categorie] || doc.categorie}
                        </td>
                        <td className="px-3 py-2 text-gray-600">
                          {userMap[doc.creePar] || "—"}
                        </td>
                        <td className="px-3 py-2 text-gray-600">
                          {new Date(doc.createdAt).toLocaleDateString("fr-FR")}
                        </td>
                        <td className="px-3 py-2">
                          {doc.publieClient ? (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                              Oui
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">Non</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {doc.partageExterne ? (
                            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                              Oui
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">Non</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <RowActions
                            resource="documents"
                            id={doc.id}
                            active={doc.actif}
                            isAdmin={estAdmin}
                            canEdit={canEditDocuments}
                            editHref={`/cabinet/documents/${doc.id}/modifier`}
                            entityLabel={doc.nom}
                          />
                        </td>
                      </tr>
                    ))}
                    </PaginatedRows>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {active === "procedures" && (
          <DossierProcedures
            dossierId={dossier.id}
            matiere={dossier.matiere || null}
            procedures={(dossier.procedures || []) as any}
            users={usersLite}
            canEdit={canEditProcedures}
          />
        )}

        {active === "taches" && (
          <DossierTaches
            dossierId={dossier.id}
            taches={dossier.taches}
            userMap={userMap}
            currentUserId={currentUserId}
            estAdmin={estAdmin}
            tacheTemplateIds={tacheTemplateIds}
            tacheTemplateWordByTitre={tacheTemplateWordByTitre}
            canCreate={canCreate}
            dossierResponsableIds={
              [dossier.avocatResponsableId, dossier.huissierResponsableId].filter(
                (id): id is string => Boolean(id)
              )
            }
          />
        )}

        {active === "missions" && (
          <div className="space-y-6">
            <MissionSection
              title="Missions d'huissier"
              canCreate={canCreate}
              missions={dossier.missions}
              addHref={`/cabinet/missions/nouvelle?dossierId=${dossier.id}`}
              viewHref="/cabinet/missions"
              detailHrefPrefix="/cabinet/missions/"
            />
            <MissionSection
              title="Missions d'architecte"
              canCreate={canCreate}
              missions={dossier.missionsArchitecte}
              addHref={`/cabinet/missions/profession/architecte/nouvelle?dossierId=${dossier.id}`}
              viewHref="/cabinet/missions/profession/architecte"
              detailHrefPrefix="/cabinet/missions/profession/architecte/"
            />
            <MissionSection
              title="Missions de conseiller juridique"
              canCreate={canCreate}
              missions={dossier.missionsConseillerJuridique}
              addHref={`/cabinet/missions/profession/conseiller-juridique/nouvelle?dossierId=${dossier.id}`}
              viewHref="/cabinet/missions/profession/conseiller-juridique"
              detailHrefPrefix="/cabinet/missions/profession/conseiller-juridique/"
            />
            <MissionSection
              title="Missions de clerc"
              canCreate={canCreate}
              missions={dossier.missionsClerc}
              addHref={`/cabinet/missions/profession/clerc/nouvelle?dossierId=${dossier.id}`}
              viewHref="/cabinet/missions/profession/clerc"
              detailHrefPrefix="/cabinet/missions/profession/clerc/"
            />
          </div>
        )}

        {active === "demarches" && (
          <div className="space-y-3">
            <div className="flex justify-between">
              <h3 className="font-medium">Démarches administratives</h3>
              <div className="flex gap-4">
                <Link
                  href={`/cabinet/dossiers/demarches/nouveau?dossierId=${dossier.id}`}
                  className="text-sm text-cabinet-700 hover:underline"
                >
                  + Ajouter
                </Link>
                <Link href="/cabinet/dossiers/demarches" className="text-sm text-cabinet-700 hover:underline">
                  Voir tout
                </Link>
              </div>
            </div>
            {demarches.length === 0 ? (
              <p className="text-sm text-gray-500">Aucune démarche administrative pour ce dossier.</p>
            ) : (
              <ul className="space-y-2">
                <PaginatedUl>
                {demarches.map((d) => (
                  <li key={d.id} className="flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/cabinet/dossiers/demarches/${d.id}`} className="font-medium text-cabinet-700 hover:underline">
                        {d.reference}
                      </Link>
                      <span className="text-gray-700">{d.type.libelle}</span>
                      {d.objet && <span className="text-gray-500">— {d.objet}</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          DEMARCHE_STATUT_BADGES[d.statut] || "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {DEMARCHE_STATUT_LABELS[d.statut] || d.statut}
                      </span>
                      <span className="text-gray-500">
                        {new Date(d.createdAt).toLocaleDateString("fr-FR")}
                      </span>
                    </div>
                  </li>
                ))}
                </PaginatedUl>
              </ul>
            )}
          </div>
        )}

        {active === "transactions" && (
          <div className="space-y-3">
            <div className="flex justify-between">
              <h3 className="font-medium">Transactions &amp; contrats</h3>
              <div className="flex gap-4">
                <Link
                  href={`/cabinet/dossiers/transactions/nouveau?dossierId=${dossier.id}`}
                  className="text-sm text-cabinet-700 hover:underline"
                >
                  + Nouvelle transaction
                </Link>
                <Link href="/cabinet/dossiers/transactions" className="text-sm text-cabinet-700 hover:underline">
                  Voir tout
                </Link>
              </div>
            </div>
            {transactions.length === 0 ? (
              <p className="text-sm text-gray-500">
                Aucune transaction rattachée — ventes, baux, promesses et mandats
                pilotés par le cabinet apparaîtront ici.
              </p>
            ) : (
              <ul className="space-y-2">
                <PaginatedUl>
                {transactions.map((t) => (
                  <li key={t.id} className="flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/cabinet/dossiers/transactions/${t.id}`} className="font-medium text-cabinet-700 hover:underline">
                        {t.reference}
                      </Link>
                      <span className="text-gray-700">{t.type.libelle}</span>
                      {t.type.mutationFonciere && (
                        <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] text-indigo-800" title="Mutation au livre foncier à suivre">
                          TF
                        </span>
                      )}
                      {t.objet && <span className="text-gray-500">— {t.objet}</span>}
                      {t.parties.length > 0 && (
                        <span className="text-xs text-gray-400">
                          {t.parties
                            .map((p) =>
                              p.demandeur
                                ? p.demandeur.typePersonne === "MORALE"
                                  ? p.demandeur.raisonSociale
                                  : [p.demandeur.prenoms, p.demandeur.nom].filter(Boolean).join(" ")
                                : p.nomLibre
                            )
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {t.prix != null && (
                        <span className="text-xs text-gray-600">
                          {t.prix.toLocaleString("fr-FR")} {t.devise}
                        </span>
                      )}
                      {t.loyer != null && (
                        <span className="text-xs text-gray-600">
                          {t.loyer.toLocaleString("fr-FR")} {t.devise}/mois
                        </span>
                      )}
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          TRANSACTION_STATUT_BADGES[t.statut] || "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {TRANSACTION_STATUT_LABELS[t.statut] || t.statut}
                      </span>
                      <span className="text-gray-500">
                        {new Date(t.createdAt).toLocaleDateString("fr-FR")}
                      </span>
                    </div>
                  </li>
                ))}
                </PaginatedUl>
              </ul>
            )}
          </div>
        )}

        {active === "evenements" && (
          <div className="space-y-3">
            <div className="flex justify-between">
              <h3 className="font-medium">Événements</h3>
              <div className="flex gap-4">
                <Link
                  href={`/cabinet/calendrier/nouveau?dossierId=${dossier.id}`}
                  className="text-sm text-cabinet-700 hover:underline"
                >
                  + Ajouter
                </Link>
                <Link href="/cabinet/calendrier" className="text-sm text-cabinet-700 hover:underline">
                  Voir tout
                </Link>
              </div>
            </div>
            {dossier.evenements.length === 0 ? (
              <p className="text-sm text-gray-500">Aucun événement.</p>
            ) : (
              <ul className="space-y-2">
                <PaginatedUl>
                {dossier.evenements.map((evt) => (
                  <li key={evt.id} className="flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          EVENT_TYPE_BADGES[evt.type] || "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {EVENT_TYPE_LABELS[evt.type] || evt.type}
                      </span>
                      <span>{evt.titre}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setDiscussion({ id: evt.id, titre: evt.titre, kind: "evenement" })}
                        className="text-cabinet-700 transition-colors hover:text-cabinet-900"
                        aria-label="Fil de discussion"
                        title="Fil de discussion"
                      >
                        <ConversationIcon />
                      </button>
                      <span className="text-gray-500">
                        {new Date(evt.dateDebut).toLocaleString("fr-FR")}
                      </span>
                    </div>
                  </li>
                ))}
                </PaginatedUl>
              </ul>
            )}
          </div>
        )}
      </div>

      {discussion && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setDiscussion(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between">
              <h3 className="text-lg font-bold text-cabinet-900">{discussion.titre}</h3>
              <button
                onClick={() => setDiscussion(null)}
                className="text-2xl text-gray-500 hover:text-gray-700"
                aria-label="Fermer"
              >
                &times;
              </button>
            </div>
            <ItemDiscussion
              id={discussion.id}
              kind={discussion.kind}
            />
          </div>
        </div>
      )}
    </div>
  );
}
