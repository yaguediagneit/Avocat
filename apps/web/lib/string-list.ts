/// Normalise une valeur Json en tableau de chaînes non vides.
/// Tolère un tableau, une chaîne seule (valeurs historiques) ou vide.
export function stringListOf(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === "string" && v.length > 0);
  }
  if (typeof value === "string" && value) return [value];
  return [];
}
