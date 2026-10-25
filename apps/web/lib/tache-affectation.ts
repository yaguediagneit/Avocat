import { PrismaClient } from "@prisma/client";
import { findSpecialiteForTypeAffaire } from "./specialite";
import { stringListOf } from "./string-list";

type Tx = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

const norm = (s: string) => s.trim().toLowerCase();

/**
 * Construit la correspondance titre de tâche (normalisé) -> userId de
 * l'intervenant désigné, à partir des tâches attendues des collaborateurs
 * du dossier (`tacheAttendue`, multi-choix).
 */
export function mapTachesParIntervenant(
  collaborateurs: { userId: string; tacheAttendue?: unknown }[]
): Map<string, string> {
  const map = new Map<string, string>();
  for (const c of collaborateurs) {
    for (const titre of stringListOf(c.tacheAttendue)) {
      map.set(norm(titre), c.userId);
    }
  }
  return map;
}

/**
 * Réaffecte les tâches actives d'un dossier selon les « tâches attendues »
 * cochées pour les intervenants :
 * - une tâche dont le titre est coché pour un intervenant lui est affectée ;
 * - une tâche précédemment déchargée sur un intervenant qui n'est plus cochée
 *   retombe sur le responsable par défaut (huissier si le template l'attend,
 *   sinon l'avocat responsable).
 *
 * Renvoie le nombre de tâches réaffectées.
 */
export async function reassignerTachesIntervenants(
  prisma: Tx,
  dossierId: string
): Promise<number> {
  const dossier = await prisma.dossier.findUnique({
    where: { id: dossierId },
    select: { typeAffaire: true, avocatResponsableId: true, huissierResponsableId: true },
  });
  if (!dossier) return 0;

  const collaborateurs = await prisma.dossierCollaborateur.findMany({
    where: { dossierId },
    select: { userId: true, tacheAttendue: true },
  });
  const tacheParIntervenant = mapTachesParIntervenant(collaborateurs);
  const intervenantIds = new Set(collaborateurs.map((c) => c.userId));

  // Rôle attendu par défaut de chaque titre de tâche (templates de la spécialité).
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
  const templates = specialite
    ? await prisma.tacheTemplate.findMany({
        where: { specialiteId: specialite.id, actif: true },
        select: { titre: true, roleAttendu: true },
      })
    : [];
  const roleAttenduParTitre = new Map(templates.map((t) => [norm(t.titre), t.roleAttendu]));

  const responsableParDefaut = (titre: string) =>
    roleAttenduParTitre.get(norm(titre)) === "huissier" && dossier.huissierResponsableId
      ? dossier.huissierResponsableId
      : dossier.avocatResponsableId;

  const taches = await prisma.tache.findMany({
    where: { dossierId, actif: true },
    select: { id: true, titre: true, responsableId: true },
  });

  let updated = 0;
  for (const t of taches) {
    const intervenant = tacheParIntervenant.get(norm(t.titre));
    let cible: string | null = null;
    if (intervenant) {
      // Tâche déchargée sur l'intervenant.
      cible = intervenant;
    } else if (intervenantIds.has(t.responsableId)) {
      // Plus cochée pour cet intervenant : retour au responsable par défaut.
      cible = responsableParDefaut(t.titre);
    }
    if (cible && cible !== t.responsableId) {
      await prisma.tache.update({
        where: { id: t.id },
        data: { responsableId: cible },
      });
      updated++;
    }
  }
  return updated;
}
