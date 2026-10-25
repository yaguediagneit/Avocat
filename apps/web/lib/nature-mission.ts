import { stringListOf } from "./string-list";

/// Normalise la nature de mission d'un dossier. Stockée en Json sous forme de
/// tableau de codes (paramètre `nature_mission`) ; les anciennes lignes
/// peuvent contenir une simple chaîne.
export function naturesMissionOf(value: unknown): string[] {
  return stringListOf(value);
}
