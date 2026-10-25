import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { findSpecialiteForTypeAffaire } from "@/lib/specialite";
import Link from "next/link";
import { redirect } from "next/navigation";
import { TacheForm } from "./tache-form";

export default async function NewTachePage({
  searchParams,
}: {
  searchParams?: { dossierId?: string };
}) {
  const session = await getSession();

  const [allDossiers, users, currentUser] = await Promise.all([
    prisma.dossier.findMany({
      take: 200,
      orderBy: { referenceInterne: "asc" },
      select: {
        id: true,
        referenceInterne: true,
        avocatResponsableId: true,
        client: { select: { raisonSociale: true } },
      },
    }),
    prisma.user.findMany({
      take: 200,
      where: { actif: true, clientId: null, role: { estClient: false } },
      select: { id: true, prenom: true, nom: true, titre: true },
      orderBy: { nom: "asc" },
    }),
    session.userId
      ? prisma.user.findUnique({
          where: { id: session.userId },
          select: { id: true, prenom: true, nom: true, titre: true, role: { select: { estAdmin: true } } },
        })
      : null,
  ]);

  if (!currentUser) {
    redirect("/login");
  }

  const isAdmin = currentUser.role.estAdmin === true;

  const dossiers = (isAdmin
    ? allDossiers
    : allDossiers.filter((d) => d.avocatResponsableId === currentUser.id)
  ).map(({ id, referenceInterne, client }) => ({ id, referenceInterne, client }));

  // Quand la tâche est créée depuis un dossier, on propose les modèles de
  // tâches de la spécialité correspondante (paramétrage).
  let tacheTemplates: {
    id: string;
    titre: string;
    description: string | null;
    priorite: string;
    delaiJours: number;
  }[] = [];
  let dossierDateOuverture: string | undefined;
  if (searchParams?.dossierId) {
    const dossier = await prisma.dossier.findUnique({
      where: { id: searchParams.dossierId },
      select: { typeAffaire: true, dateOuverture: true, avocatResponsableId: true },
    });
    if (dossier && !isAdmin && dossier.avocatResponsableId !== currentUser.id) {
      redirect("/cabinet/taches");
    }
    if (dossier) {
      dossierDateOuverture = dossier.dateOuverture?.toISOString();
      const [paramType, specialites] = await Promise.all([
        prisma.parametre.findFirst({
          where: { categorie: "type_affaire", code: dossier.typeAffaire },
          select: { libelle: true },
        }),
        prisma.specialite.findMany({
          where: { actif: true },
          select: { id: true, code: true, libelle: true },
        }),
      ]);
      const specialite = findSpecialiteForTypeAffaire(
        dossier.typeAffaire,
        paramType?.libelle,
        specialites
      );
      if (specialite) {
        tacheTemplates = await prisma.tacheTemplate.findMany({
          where: { specialiteId: specialite.id, actif: true },
          orderBy: { ordre: "asc" },
          select: { id: true, titre: true, description: true, priorite: true, delaiJours: true },
        });
      }
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Nouvelle tâche</h1>
        <Link href="/cabinet/taches" className="text-sm text-cabinet-700 hover:underline">
          ← Retour aux tâches
        </Link>
      </div>
      <TacheForm
        dossiers={dossiers}
        users={users}
        currentUser={currentUser}
        defaultDossierId={searchParams?.dossierId}
        tacheTemplates={tacheTemplates}
        dossierDateOuverture={dossierDateOuverture}
      />
    </div>
  );
}
