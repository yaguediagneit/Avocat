/// Correspondance souple entre le code `type_affaire` d'un dossier et les
/// spécialités paramétrées. Les codes ne sont pas strictement identiques en
/// base (ex. "signification" vs "significations", "bail" vs
/// "baux_commerciaux_habitation"), donc on compare aussi les libellés.

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export interface SpecialiteLike {
  code: string;
  libelle: string;
}

/**
 * Retourne la spécialité correspondant à un type d'affaire de dossier.
 * Ordre de tentative : code exact → code préfixe/contenu → libellé normalisé
 * identique au libellé du paramètre `type_affaire`.
 */
export function findSpecialiteForTypeAffaire<T extends SpecialiteLike>(
  typeAffaire: string,
  typeAffaireLibelle: string | undefined,
  specialites: T[]
): T | undefined {
  const tCode = normalize(typeAffaire);
  if (!tCode) return undefined;

  const byExact = specialites.find((s) => normalize(s.code) === tCode);
  if (byExact) return byExact;

  const byPrefix = specialites.find((s) => {
    const c = normalize(s.code);
    return c.startsWith(tCode) || tCode.startsWith(c);
  });
  if (byPrefix) return byPrefix;

  const byWord = specialites.find((s) =>
    normalize(s.code).split(" ").includes(tCode)
  );
  if (byWord) return byWord;

  const tLib = normalize(typeAffaireLibelle || "");
  if (tLib) {
    const byLibelle = specialites.find((s) => normalize(s.libelle) === tLib);
    if (byLibelle) return byLibelle;
  }

  return undefined;
}
