/**
 * Substitution des variables dynamiques dans les textes du thème PDF
 * (`pdfTheme.headerText` / `pdfTheme.footerText`), évaluée au moment du
 * rendu du document :
 *   - `{{annee}}` (alias : `{{année}}`, `{{year}}`) → année en cours
 *   - `{{date}}` → date du jour au format français (ex. 20/09/2026)
 * Module sans dépendance : importable aussi bien côté serveur
 * (pdf-generator) que côté client (fenêtres d'impression).
 */
const PDF_THEME_PLACEHOLDER =
  /\{\{\s*(ann[ée]e|year|date)\s*\}\}/gi;

export function resolvePdfThemeText(text: string): string {
  if (!text || !text.includes("{{")) return text;
  return text.replace(PDF_THEME_PLACEHOLDER, (_m, cle: string) => {
    const now = new Date();
    return cle.toLowerCase() === "date"
      ? now.toLocaleDateString("fr-FR")
      : String(now.getFullYear());
  });
}
