/**
 * Génération de documents Word (.docx) à partir de modèles.
 *
 * Utilise docxtemplater pour substituer les variables {{cle}} dans un fichier
 * Word existant. Le modèle reste intact : on travaille sur une copie en
 * mémoire, le fichier original n'est jamais modifié.
 *
 * Les variables utilisent la même syntaxe que le système de modèles texte :
 *   - {{cle}}        → variable simple
 *   - {{cle|Libellé}} → variable avec libellé affiché (le libellé est ignoré
 *                      par docxtemplater, seule la clé est substituée)
 */

import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";

export interface DocxTemplateVariable {
  /** Identifiant unique de la variable (ex. `ville`, `nom_client`). */
  cle: string;
  /** Libellé affiché dans le formulaire. */
  label: string;
}

/// Délimiteurs {{ }} pour rester compatible avec le système de modèles texte.
const DELIMITERS = { start: "{{", end: "}}" };

/// Regex pour détecter les variables {{cle}} ou {{cle|Libellé}} dans le texte.
const VAR_REGEX = /\{\{\s*([A-Za-z0-9_]+)\s*(?:\|\s*([^{}]*?)\s*)?\}\}/g;

/**
 * Extrait la liste des variables {{cle}} présentes dans un fichier .docx.
 * Parcourt directement le XML des parties word/document.xml (et éventuellement
 * les en-têtes/pieds de page) sans dépendre du module Inspect de docxtemplater
 * (qui requiert lodash).
 */
export function extractDocxVariables(docxBuffer: Buffer): DocxTemplateVariable[] {
  try {
    const zip = new PizZip(docxBuffer);
    // Le corps du document + en-têtes/pieds de page
    const files = Object.keys(zip.files).filter(
      (name) =>
        name === "word/document.xml" ||
        /^word\/(header|footer)\d*\.xml$/.test(name)
    );
    const seen = new Set<string>();
    const variables: DocxTemplateVariable[] = [];
    for (const file of files) {
      const content = zip.file(file)?.asText() || "";
      for (const m of content.matchAll(VAR_REGEX)) {
        const cle = m[1];
        if (seen.has(cle)) continue;
        seen.add(cle);
        const label = (m[2]?.trim() || cle).replace(/_/g, " ");
        variables.push({
          cle,
          label: label.replace(/\b\w/g, (c) => c.toUpperCase()),
        });
      }
    }
    return variables;
  } catch {
    return [];
  }
}

/**
 * Substitue les variables {{cle}} d'un modèle .docx par les valeurs fournies.
 * Le buffer original n'est pas modifié : on travaille sur une copie.
 *
 * @returns Buffer du document .docx généré.
 */
export function renderDocxTemplate(
  docxBuffer: Buffer,
  valeurs: Record<string, string>
): Buffer {
  const zip = new PizZip(docxBuffer);
  const doc = new Docxtemplater(zip, {
    delimiters: DELIMITERS,
    paragraphLoop: true,
    linebreaks: true,
  });

  doc.render(valeurs);

  const generated = doc
    .getZip()
    .generate({ type: "nodebuffer", compression: "DEFLATE" });

  return Buffer.from(generated);
}
