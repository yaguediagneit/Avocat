import { Prisma, PrismaClient } from "@prisma/client";

/// Filtre Prisma des dossiers visibles depuis l'espace client :
/// - tous les dossiers du compte client connecté (dossier.clientId = clientId) ;
/// - dossiers où l'utilisateur figure comme intervenant (matrice RACI).
export function clientDossierFilter(userId: string, clientId?: string): Prisma.DossierWhereInput {
  // Un client connecté voit tous les dossiers rattachés à son propre compte client.
  if (clientId) {
    return { clientId };
  }
  // Fallback : utilisateur sans compte client explicitement lié mais présent en RACI.
  return { collaborateursRACI: { some: { userId } } };
}

/// Vérifie qu'un dossier précis est visible par l'utilisateur client.
export async function canClientAccessDossier(
  prisma: PrismaClient,
  userId: string,
  clientId: string | undefined,
  dossierId: string
): Promise<boolean> {
  const count = await prisma.dossier.count({
    where: { id: dossierId, ...clientDossierFilter(userId, clientId) },
  });
  return count > 0;
}
