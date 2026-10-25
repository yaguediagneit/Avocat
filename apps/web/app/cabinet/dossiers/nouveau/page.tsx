import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getServerClientFilter } from "@/lib/server-auth";
import Link from "next/link";
import { DossierForm } from "./dossier-form";

export default async function NewDossierPage({
  searchParams,
}: {
  searchParams: { clientId?: string };
}) {
  const session = await getSession();
  const clientFilter = await getServerClientFilter();

  const [clients, users, currentUser] = await Promise.all([
    prisma.client.findMany({
      where: clientFilter,
      take: 500,
      select: { id: true, raisonSociale: true, type: true },
      orderBy: { raisonSociale: "asc" },
    }),
    prisma.user.findMany({
      take: 200,
      where: { actif: true },
      select: {
        id: true,
        prenom: true,
        nom: true,
        role: { select: { nom: true, estClient: true } },
      },
      orderBy: { nom: "asc" },
    }),
    session.userId
      ? prisma.user.findUnique({
          where: { id: session.userId },
          select: {
            id: true,
            prenom: true,
            nom: true,
            role: { select: { nom: true, estClient: true } },
          },
        })
      : null,
  ]);

  // Spécialités du cabinet (sélectionnées ; sinon toutes les actives) pour le
  // type d'affaire + les modèles de tâches associés à chaque spécialité.
  const [specialitesSelectionnees, specialitesActives, naturesMission, typeAffaireParams, niveauxConfidentialite, tacheTemplates] =
    await Promise.all([
      prisma.specialite.findMany({
        where: { actif: true, selectionnee: true },
        select: { id: true, code: true, libelle: true },
        orderBy: [{ ordre: "asc" }, { libelle: "asc" }],
      }),
      prisma.specialite.findMany({
        where: { actif: true },
        select: { id: true, code: true, libelle: true },
        orderBy: [{ ordre: "asc" }, { libelle: "asc" }],
      }),
      prisma.parametre.findMany({
        where: { categorie: "nature_mission", actif: true },
        select: { code: true, libelle: true },
        orderBy: [{ ordre: "asc" }, { libelle: "asc" }],
      }),
      prisma.parametre.findMany({
        where: { categorie: "type_affaire", actif: true },
        select: { code: true, libelle: true },
      }),
      prisma.parametre.findMany({
        where: { categorie: "niveau_confidentialite", actif: true },
        select: { code: true, libelle: true },
        orderBy: [{ ordre: "asc" }, { libelle: "asc" }],
      }),
      prisma.tacheTemplate.findMany({
        where: { actif: true },
        select: { specialiteId: true, titre: true },
        orderBy: [{ ordre: "asc" }, { titre: "asc" }],
      }),
    ]);

  const specialites = specialitesSelectionnees.length ? specialitesSelectionnees : specialitesActives;

  const tachesParSpecialite: Record<string, string[]> = {};
  for (const t of tacheTemplates) {
    (tachesParSpecialite[t.specialiteId] ??= []).push(t.titre);
  }
  const typeAffaireParamLibelles = Object.fromEntries(
    typeAffaireParams.map((p) => [p.code, p.libelle])
  );

  // Présélection du client via ?clientId= (ex. depuis la fiche client ou la
  // liste des clients). Ignoré si l'id n'est pas dans les clients accessibles.
  const preselectedClientId =
    searchParams.clientId && clients.some((c) => c.id === searchParams.clientId)
      ? searchParams.clientId
      : undefined;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Nouveau dossier</h1>
        <Link href="/cabinet/dossiers" className="text-sm text-cabinet-700 hover:underline">
          ← Retour aux dossiers
        </Link>
      </div>
      <DossierForm
        clients={clients}
        users={users}
        currentUser={currentUser}
        specialites={specialites}
        toutesSpecialites={specialitesActives}
        naturesMission={naturesMission}
        typeAffaireParamLibelles={typeAffaireParamLibelles}
        niveauxConfidentialite={niveauxConfidentialite}
        tachesParSpecialite={tachesParSpecialite}
        mode="create"
        initialData={preselectedClientId ? { clientId: preselectedClientId } : undefined}
        submitLabel="Ouvrir le dossier"
        successHref="/cabinet/dossiers"
        cancelHref="/cabinet/dossiers"
      />
    </div>
  );
}
