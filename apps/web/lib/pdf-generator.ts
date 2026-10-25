import {
  PDFDocument,
  StandardFonts,
  degrees,
  rgb,
  type PDFFont,
  type PDFPage,
  type PDFImage,
} from "pdf-lib";
import { resolvePdfThemeText } from "@/lib/pdf-theme-text";

export interface PdfThemeConfig {
  primaryColor: string;
  secondaryColor: string;
  fontFamily: "Helvetica" | "Times-Roman" | "Courier";
  fontSize: number;
  headerText: string;
  footerText: string;
}

export interface CabinetInfo {
  raisonSociale: string;
  slogan?: string;
  adresse?: string;
  telephone?: string;
  telephoneSecondaire?: string;
  email?: string;
  siteWeb?: string;
  identifiantFiscal?: string;
  identificationLegale?: string;
  logoUrl?: string | null;
}

export interface LegalDocumentData {
  title: string;
  reference?: string;
  date?: string;
  recipient?: string;
  subject?: string;
  dossier?: string;
  columns?: { left: string; right: string };
  body: string;
  signature?: string;
  signature2?: string;
  signatureImage?: Uint8Array;
  /** Filigrane diagonal appliqué sur toutes les pages (ex. « BROUILLON »). */
  watermark?: string;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;
  return { r: isNaN(r) ? 0 : r, g: isNaN(g) ? 0 : g, b: isNaN(b) ? 0 : b };
}

function getFont(doc: PDFDocument, family: string): Promise<PDFFont> {
  switch (family) {
    case "Times-Roman":
      return doc.embedFont(StandardFonts.TimesRoman);
    case "Courier":
      return doc.embedFont(StandardFonts.Courier);
    default:
      return doc.embedFont(StandardFonts.Helvetica);
  }
}

function getBoldFont(doc: PDFDocument, family: string): Promise<PDFFont> {
  switch (family) {
    case "Times-Roman":
      return doc.embedFont(StandardFonts.TimesRomanBold);
    case "Courier":
      return doc.embedFont(StandardFonts.CourierBold);
    default:
      return doc.embedFont(StandardFonts.HelveticaBold);
  }
}

const PAGE_WIDTH = 595.28; // A4
const PAGE_HEIGHT = 841.89;
const MARGIN = 50;
const HEADER_HEIGHT = 120;
const FOOTER_HEIGHT = 50;

// Les chaînes produites par Intl.NumberFormat("fr-FR") ou copiées depuis le web
// contiennent souvent des caractères non encodables en WinAnsi (espace fine
// insécable  , espaces insécables, apostrophes typographiques…), ce qui fait
// échouer pdf-lib (« WinAnsi cannot encode »). On remplace chaque caractère
// non encodable par un équivalent ASCII sûr.
const PDF_CHAR_FALLBACKS = new Map<number, string>([
  [0x00a0, " "], [0x202f, " "], [0x2007, " "], [0x2009, " "],
  [0x2013, "-"], [0x2014, "-"], [0x2015, "-"],
  [0x2018, "'"], [0x2019, "'"], [0x201a, "'"], [0x2039, "'"], [0x203a, "'"],
  [0x201c, '"'], [0x201d, '"'], [0x00ab, '"'], [0x00bb, '"'],
  [0x2026, "..."], [0x0153, "oe"], [0x0152, "OE"],
  [0x2022, "-"], [0x00b7, "-"],
]);

function sanitizePdfText(text: string, font: PDFFont): string {
  let changed = false;
  let result = "";
  for (const ch of text) {
    try {
      font.encodeText(ch);
      result += ch;
    } catch {
      result += PDF_CHAR_FALLBACKS.get(ch.codePointAt(0)!) ?? "?";
      changed = true;
    }
  }
  return changed ? result : text;
}

// Proxy qui assainit automatiquement le texte passé à page.drawText.
function wrapPdfPage(page: PDFPage): PDFPage {
  return new Proxy(page, {
    get(target, prop) {
      if (prop === "drawText") {
        return (text: string, options?: { font?: PDFFont } & Record<string, unknown>) => {
          const f = options?.font;
          return target.drawText(f ? sanitizePdfText(text, f) : text, options);
        };
      }
      const v = (target as unknown as Record<string | symbol, unknown>)[prop];
      return typeof v === "function" ? (v as (...args: unknown[]) => unknown).bind(target) : v;
    },
  });
}

// Proxy qui assainit le texte passé à font.widthOfTextAtSize.
function wrapPdfFont(font: PDFFont): PDFFont {
  return new Proxy(font, {
    get(target, prop) {
      if (prop === "widthOfTextAtSize") {
        return (text: string, size: number) =>
          target.widthOfTextAtSize(sanitizePdfText(text, target), size);
      }
      const v = (target as unknown as Record<string | symbol, unknown>)[prop];
      return typeof v === "function" ? (v as (...args: unknown[]) => unknown).bind(target) : v;
    },
  });
}

// En-tête en tableau 2 colonnes × 2 lignes :
//   Colonne 1, Lignes 1+2 fusionnées → Logo
//   Colonne 2, Ligne 1               → Nom du cabinet
//   Colonne 2, Ligne 2               → Slogan
const LOGO_CELL_WIDTH = 80;
const HEADER_ROW_HEIGHT = 35;

async function embedSignatureImage(doc: PDFDocument, imageBytes: Uint8Array): Promise<PDFImage | null> {
  try {
    return await doc.embedPng(imageBytes);
  } catch {
    try {
      return await doc.embedJpg(imageBytes);
    } catch {
      return null;
    }
  }
}

async function embedLogo(doc: PDFDocument, logoUrl: string): Promise<PDFImage | null> {
  try {
    if (logoUrl.startsWith("data:image/png") || logoUrl.startsWith("data:application/octet-stream;base64")) {
      const base64 = logoUrl.split(",")[1];
      if (!base64) return null;
      return await doc.embedPng(Buffer.from(base64, "base64"));
    }
    if (logoUrl.startsWith("data:image/jpeg") || logoUrl.startsWith("data:image/jpg")) {
      const base64 = logoUrl.split(",")[1];
      if (!base64) return null;
      return await doc.embedJpg(Buffer.from(base64, "base64"));
    }
    if (logoUrl.startsWith("data:image/svg")) {
      // pdf-lib ne supporte pas le SVG nativement ; on ignore le logo SVG.
      return null;
    }
    if (logoUrl.startsWith("http://") || logoUrl.startsWith("https://")) {
      const res = await fetch(logoUrl);
      const buf = Buffer.from(await res.arrayBuffer());
      if (logoUrl.toLowerCase().endsWith(".png")) return await doc.embedPng(buf);
      if (logoUrl.toLowerCase().endsWith(".jpg") || logoUrl.toLowerCase().endsWith(".jpeg")) return await doc.embedJpg(buf);
      // Tenter PNG puis JPG
      try { return await doc.embedPng(buf); } catch { return await doc.embedJpg(buf); }
    }
    return null;
  } catch (e) {
    console.error("embedLogo error", e);
    return null;
  }
}

function drawHeader(
  page: PDFPage,
  cabinet: CabinetInfo,
  theme: PdfThemeConfig,
  font: PDFFont,
  boldFont: PDFFont,
  logo: PDFImage | null
) {
  const primary = hexToRgb(theme.primaryColor);
  const secondary = hexToRgb(theme.secondaryColor);

  // Bande de couleur principale en haut
  page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - 8,
    width: PAGE_WIDTH,
    height: 8,
    color: rgb(primary.r, primary.g, primary.b),
  });

  // Layout tableau en-tête :
  //   Ligne 1 (y top)    : Col1=Logo(fusion)  Col2=Raison sociale
  //   Ligne 2 (y below)  : Col1=Logo(fusion)  Col2=Slogan
  const tableTop = PAGE_HEIGHT - 18;
  const row1Y = tableTop - HEADER_ROW_HEIGHT;
  const row2Y = row1Y - HEADER_ROW_HEIGHT;
  const col1X = MARGIN;
  const col2X = MARGIN + LOGO_CELL_WIDTH + 8;
  const col2Width = PAGE_WIDTH - MARGIN - col2X;

  // Bordures du tableau (filets fins)
  // Ligne verticale entre colonne 1 et 2
  page.drawLine({
    start: { x: col2X - 4, y: tableTop },
    end: { x: col2X - 4, y: row2Y },
    thickness: 0.5,
    color: rgb(secondary.r, secondary.g, secondary.b),
  });
  // Ligne horizontale entre ligne 1 et ligne 2 (colonne 2 uniquement)
  page.drawLine({
    start: { x: col2X - 4, y: row1Y },
    end: { x: PAGE_WIDTH - MARGIN, y: row1Y },
    thickness: 0.5,
    color: rgb(secondary.r, secondary.g, secondary.b),
  });

  // Colonne 1 — Logo fusionné sur les 2 lignes
  const logoCellHeight = HEADER_ROW_HEIGHT * 2;
  if (logo) {
    const scale = Math.min(LOGO_CELL_WIDTH / logo.width, logoCellHeight / logo.height, 1);
    const drawW = logo.width * scale;
    const drawH = logo.height * scale;
    const logoX = col1X + (LOGO_CELL_WIDTH - drawW) / 2;
    const logoY = row2Y + (logoCellHeight - drawH) / 2;
    page.drawImage(logo, {
      x: logoX,
      y: logoY,
      width: drawW,
      height: drawH,
    });
  }

  // Colonne 2, Ligne 1 — Nom du cabinet
  const nameSize = 15;
  const nameY = row1Y + (HEADER_ROW_HEIGHT - nameSize) / 2 + 2;
  page.drawText(cabinet.raisonSociale, {
    x: col2X,
    y: nameY,
    size: nameSize,
    font: boldFont,
    color: rgb(primary.r, primary.g, primary.b),
    maxWidth: col2Width,
  });

  // Colonne 2, Ligne 2 — Slogan
  const sloganSize = 9;
  const sloganY = row2Y + (HEADER_ROW_HEIGHT - sloganSize) / 2 + 2;
  const slogan = cabinet.slogan || "";
  if (slogan) {
    // Tronquer si trop long
    let displaySlogan = slogan;
    while (boldFont.widthOfTextAtSize(displaySlogan, sloganSize) > col2Width && displaySlogan.length > 0) {
      displaySlogan = displaySlogan.slice(0, -1);
    }
    if (displaySlogan.length < slogan.length) {
      displaySlogan = displaySlogan.slice(0, -3) + "…";
    }
    page.drawText(displaySlogan, {
      x: col2X,
      y: sloganY,
      size: sloganSize,
      font,
      color: rgb(secondary.r, secondary.g, secondary.b),
    });
  }

  // Coordonnées du cabinet (sous le tableau, côté droit)
  const coordLines: string[] = [];
  if (cabinet.adresse) coordLines.push(cabinet.adresse);
  if (cabinet.telephone) coordLines.push(`Tél: ${cabinet.telephone}`);
  if (cabinet.email) coordLines.push(cabinet.email);
  coordLines.forEach((line, i) => {
    const t = truncateToWidth(line, font, 7, PAGE_WIDTH - 2 * MARGIN);
    page.drawText(t, {
      x: PAGE_WIDTH - MARGIN - font.widthOfTextAtSize(t, 7),
      y: row2Y - 12 - i * 9,
      size: 7,
      font,
      color: rgb(0.45, 0.45, 0.45),
    });
  });

  // Texte d'en-tête personnalisé (sous le tableau, côté gauche)
  if (theme.headerText) {
    page.drawText(truncateToWidth(resolvePdfThemeText(theme.headerText), font, 7, PAGE_WIDTH - 2 * MARGIN), {
      x: MARGIN,
      y: row2Y - 12,
      size: 7,
      font,
      color: rgb(secondary.r, secondary.g, secondary.b),
    });
  }

  // Filet de séparation bas du tableau
  page.drawLine({
    start: { x: MARGIN, y: row2Y - 4 },
    end: { x: PAGE_WIDTH - MARGIN, y: row2Y - 4 },
    thickness: 1,
    color: rgb(secondary.r, secondary.g, secondary.b),
  });
}

function drawFooter(
  page: PDFPage,
  cabinet: CabinetInfo,
  theme: PdfThemeConfig,
  font: PDFFont,
  pageNumber: number,
  totalPages: number
) {
  const secondary = hexToRgb(theme.secondaryColor);

  // Filet de séparation
  page.drawLine({
    start: { x: MARGIN, y: FOOTER_HEIGHT },
    end: { x: PAGE_WIDTH - MARGIN, y: FOOTER_HEIGHT },
    thickness: 0.5,
    color: rgb(secondary.r, secondary.g, secondary.b),
  });

  // Texte de pied de page personnalisé (à gauche) + numéro de page (à droite)
  if (theme.footerText) {
    page.drawText(truncateToWidth(resolvePdfThemeText(theme.footerText), font, 7, PAGE_WIDTH - 2 * MARGIN - 60), {
      x: MARGIN,
      y: FOOTER_HEIGHT - 14,
      size: 7,
      font,
      color: rgb(0.4, 0.4, 0.4),
    });
  }

  const pageStr = `Page ${pageNumber} / ${totalPages}`;
  page.drawText(pageStr, {
    x: PAGE_WIDTH - MARGIN - font.widthOfTextAtSize(pageStr, 7),
    y: FOOTER_HEIGHT - 14,
    size: 7,
    font,
    color: rgb(0.4, 0.4, 0.4),
  });

  // Coordonnées du cabinet centrées sur deux lignes :
  //   Ligne 1 : Adresse — Tél — Email
  //   Ligne 2 : Identification légale — N° fiscal — Site web
  const infoLine1 = [
    cabinet.adresse,
    cabinet.telephone
      ? `Tél: ${cabinet.telephone}${cabinet.telephoneSecondaire ? ` / ${cabinet.telephoneSecondaire}` : ""}`
      : cabinet.telephoneSecondaire
        ? `Tél: ${cabinet.telephoneSecondaire}`
        : "",
    cabinet.email,
  ]
    .filter(Boolean)
    .join("  |  ");
  const infoLine2 = [
    cabinet.identificationLegale,
    cabinet.identifiantFiscal ? `N° fiscal : ${cabinet.identifiantFiscal}` : "",
    cabinet.siteWeb,
  ]
    .filter(Boolean)
    .join("  |  ");

  [infoLine1, infoLine2].forEach((line, i) => {
    if (!line) return;
    const t = truncateToWidth(line, font, 7, PAGE_WIDTH - 2 * MARGIN);
    page.drawText(t, {
      x: Math.max(MARGIN, (PAGE_WIDTH - font.widthOfTextAtSize(t, 7)) / 2),
      y: FOOTER_HEIGHT - 24 - i * 10,
      size: 7,
      font,
      color: rgb(0.4, 0.4, 0.4),
    });
  });
}

function wrapText(
  text: string,
  font: PDFFont,
  fontSize: number,
  maxWidth: number
): string[] {
  const paragraphs = text.split("\n");
  const lines: string[] = [];

  for (const para of paragraphs) {
    if (para.trim() === "") {
      lines.push("");
      continue;
    }
    const words = para.split(" ");
    let current = "";
    for (const word of words) {
      if (font.widthOfTextAtSize(word, fontSize) > maxWidth) {
        // Mot plus long que la largeur disponible : on le coupe caractère
        // par caractère pour éviter tout débordement de la marge droite.
        if (current) {
          lines.push(current);
          current = "";
        }
        let chunk = "";
        for (const ch of word) {
          const test = chunk + ch;
          if (chunk && font.widthOfTextAtSize(test, fontSize) > maxWidth) {
            lines.push(chunk);
            chunk = ch;
          } else {
            chunk = test;
          }
        }
        current = chunk;
        continue;
      }
      const test = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(test, fontSize) > maxWidth) {
        if (current) lines.push(current);
        current = word;
      } else {
        current = test;
      }
    }
    if (current) lines.push(current);
  }

  return lines;
}

/* ------------------------------------------------------------------ */
/* Mise en paragraphes du corps des lettres                            */
/* ------------------------------------------------------------------ */

// Marqueurs qui ouvrent un nouveau paragraphe même quand le texte source
// n'a pas de retours à la ligne. Les énumérations (« 1. », « a) », « IV. »)
// et les puces coupent n'importe où ; les formules usuelles des courriers
// (salutations, « Veuillez… », formules de politesse) ne coupent qu'après
// une fin de phrase, pour ne pas hacher « Veuillez agréer, Madame, … ».
const PARAGRAPH_MARKER =
  /\s+(?=\d{1,2}[.)]\s|[a-zA-Z]\)\s|[•–—*]\s|Article\s+\d|(?:I|II|III|IV|V|VI|VII|VIII|IX|X)[.)]\s)|(?<=[.!?…:;»])\s+(?=Objet\s*:|Pi[eè]ces?\s+jointes?\s*:|Veuillez\s|Nous\s+vous\s+prions|Dans\s+l'attente|(?:Bien\s+)?[Cc]ordialement|Sinc[eè]res\s+salutations|Salutations\s+distingu[ée]es|(?:Tr[eè]s\s+)?[Rr]espectueusement|Madame\s*,|Monsieur\s*,|Mesdames\s*,|Messieurs\s*,|Mademoiselle\s*,|Ma[îi]tre\s*,)/g;

// Salutation en tête de bloc (« Madame, Monsieur, ») : détachée du reste
// pour figurer seule sur sa ligne, comme dans un courrier bien formé.
const SALUTATION_PREFIX =
  /^(?:(?:Madame|Monsieur|Mesdames|Messieurs|Mademoiselle|Ma[îi]tre|Ch[eè]re?)\b[^,.!?]{0,50},(?:\s+|$))+/;

// Une ligne qui commence ainsi constitue son propre paragraphe (elle ne
// fusionne pas avec la ligne précédente lors de la réparation du texte).
const STANDALONE_LINE =
  /^(?:[-–—•*]\s|\d{1,2}[.)]\s|[a-zA-Z]\)\s|Objet\s*:|Pi[eè]ces?\s+jointes?\s*:|Veuillez\s|Nous\s+vous\s+prions|Dans\s+l'attente|(?:Bien\s+)?[Cc]ordialement|Sinc[eè]res\s+salutations|Salutations\s+distingu[ée]es|(?:Tr[eè]s\s+)?[Rr]espectueusement|(?:Madame|Monsieur|Mesdames|Messieurs|Mademoiselle|Ma[îi]tre)\s*,|(?:Cher|Ch[eè]re)\s)/;

const BODY_HEADING_REGEX =
  /^(Destinataire|Lieu\(x\) et durée|Frais et honoraires|Honoraires et modalités de paiement|Délivrables attendus|Étendue et limites de la mission|Confidentialité et déontologie|Confidentialité et éthique|Obligations déontologiques|Prestations attendues|Signature|Client concerné|Description détaillée|Motif de la mission)/i;

// Coupe un paragraphe aux marqueurs de structure (énumérations, formules
// de lettre) restés au milieu du texte faute de retours à la ligne.
function splitAtMarkers(para: string): string[] {
  const cuts: number[] = [];
  for (const m of para.matchAll(PARAGRAPH_MARKER)) cuts.push(m.index ?? 0);
  const out: string[] = [];
  let prev = 0;
  for (const i of cuts) {
    const piece = para.slice(prev, i).trim();
    if (piece) out.push(piece);
    prev = i;
  }
  const tail = para.slice(prev).trim();
  if (tail) out.push(tail);
  if (!out.length) return [para];
  // Une salutation en tête (« Madame, Monsieur, ») est détachée sur sa
  // propre ligne si du texte suit.
  const first = out[0].match(SALUTATION_PREFIX);
  if (first && first[0].trim().length < out[0].length - 10) {
    out.splice(0, 1, first[0].trim(), out[0].slice(first[0].length).trim());
  }
  return out.filter(Boolean);
}

// Un paragraphe monobloc trop long est éclaté aux fins de phrase pour
// rester lisible (la présentation prime sur la structure du texte source).
function splitLongParagraph(para: string, maxLen = 620): string[] {
  if (para.length <= maxLen) return [para];
  const bounds: number[] = [];
  for (const m of para.matchAll(/[.!?…]["'»)\]]*\s+/g)) {
    const cut = (m.index ?? 0) + m[0].length;
    if (!/[A-ZÀ-ÖØ-Þ0-9]/.test(para[cut] ?? "")) continue;
    const prevWord = para.slice(0, m.index ?? 0).match(/[A-Za-zÀ-ÿ]+$/)?.[0] ?? "";
    if (prevWord.length <= 3) continue; // abréviation probable (M., Dr., art.…)
    bounds.push(cut);
  }
  const out: string[] = [];
  let start = 0;
  while (para.length - start > maxLen) {
    const limit = start + maxLen;
    const cands = bounds.filter((b) => b > start + 200 && b <= limit);
    let cut: number;
    if (cands.length) {
      cut = cands[cands.length - 1];
    } else {
      const later = bounds.find((b) => b > limit);
      if (later && later - start < maxLen * 1.5) {
        cut = later;
      } else {
        const sp = para.lastIndexOf(" ", limit);
        cut = sp > start ? sp + 1 : para.length;
      }
    }
    out.push(para.slice(start, cut).trim());
    start = cut;
  }
  const rest = para.slice(start).trim();
  if (rest) out.push(rest);
  return out;
}

// Reconstruit les paragraphes du corps : les lignes vides séparent les
// paragraphes, les lignes « autonomes » (intitulés, salutations, items de
// liste, formules de politesse) restent isolées, et les lignes successives
// ordinaires sont fusionnées pour réparer les retours à la ligne
// artificiels d'un texte mal formaté.
function bodyToParagraphs(text: string): string[] {
  const paragraphs: string[] = [];
  let buf: string[] = [];
  const flush = () => {
    if (!buf.length) return;
    const joined = buf.join(" ").replace(/\s+/g, " ").trim();
    buf = [];
    if (!joined) return;
    for (const piece of splitAtMarkers(joined)) {
      paragraphs.push(...splitLongParagraph(piece));
    }
  };
  for (const raw of text.replace(/\r\n?/g, "\n").split("\n")) {
    const t = raw.trim();
    if (!t) {
      flush();
      continue;
    }
    if (t.endsWith(":") || STANDALONE_LINE.test(t)) {
      flush();
      for (const piece of splitAtMarkers(t)) {
        paragraphs.push(...splitLongParagraph(piece));
      }
      continue;
    }
    buf.push(t);
  }
  flush();
  return paragraphs.filter(Boolean);
}

// Dessine une ligne justifiée : les espaces entre mots sont élargis pour
// aligner le texte sur la marge droite. On renonce (alignement à gauche)
// quand la ligne est déjà pleine, trop courte ou demanderait des espaces
// démesurés.
function drawJustifiedLine(
  page: PDFPage,
  line: string,
  font: PDFFont,
  fontSize: number,
  x: number,
  y: number,
  maxWidth: number,
  color: { r: number; g: number; b: number }
) {
  const rgbColor = rgb(color.r, color.g, color.b);
  const words = line.split(" ");
  if (words.length < 3) {
    page.drawText(line, { x, y, size: fontSize, font, color: rgbColor });
    return;
  }
  const spaceWidth = font.widthOfTextAtSize(" ", fontSize);
  const wordsWidth = words.reduce((s, w) => s + font.widthOfTextAtSize(w, fontSize), 0);
  const natural = wordsWidth + spaceWidth * (words.length - 1);
  // On vise légèrement moins que la marge droite : les métriques exactes
  // peuvent différer d'un point ou deux selon le lecteur PDF.
  const target = maxWidth - 2;
  const extra = target - natural;
  if (extra <= 0.5 || extra / (words.length - 1) > spaceWidth * 1.6 || natural < maxWidth * 0.5) {
    page.drawText(line, { x, y, size: fontSize, font, color: rgbColor });
    return;
  }
  const gap = spaceWidth + extra / (words.length - 1);
  let cx = x;
  for (const w of words) {
    page.drawText(w, { x: cx, y, size: fontSize, font, color: rgbColor });
    cx += font.widthOfTextAtSize(w, fontSize) + gap;
  }
}

function roundedRectPath(w: number, h: number, r: number): string {
  return `M ${r},0 H ${w - r} A ${r},${r} 0 0 1 ${w},${r} V ${h - r} A ${r},${r} 0 0 1 ${w - r},${h} H ${r} A ${r},${r} 0 0 1 0,${h - r} V ${r} A ${r},${r} 0 0 1 ${r},0 Z`;
}

function drawRoundedRect(
  page: PDFPage,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  borderColor: { r: number; g: number; b: number },
  filled = false
) {
  page.drawSvgPath(roundedRectPath(w, h, r), {
    x,
    y,
    ...(filled
      ? { color: rgb(0.95, 0.95, 0.95) }
      : { borderColor: rgb(borderColor.r, borderColor.g, borderColor.b), borderWidth: 1 }),
  });
}

function textBlockHeight(lines: string[], fontSize: number): number {
  return lines.reduce((sum, line, i) => {
    if (i === 0) return sum;
    return sum + (line === "" ? fontSize * 0.7 : fontSize * 1.4);
  }, 0);
}

function drawTwoColumnBlock(
  doc: PDFDocument,
  page: PDFPage,
  y: number,
  leftText: string,
  rightText: string,
  font: PDFFont,
  boldFont: PDFFont,
  fontSize: number,
  contentWidth: number,
  cabinet: CabinetInfo,
  theme: PdfThemeConfig,
  logo: PDFImage | null,
  currentPage: number,
  totalPages: number,
  heightFactor = 1,
  filled = false
): { page: PDFPage; y: number; currentPage: number } {
  const gutter = 20;
  const padding = 8;
  const colWidth = (contentWidth - gutter) / 2;
  const leftX = MARGIN;
  const rightX = MARGIN + colWidth + gutter;

  // La première ligne de chaque bloc est un intitulé dessiné en gras :
  // elle est mesurée avec la police grasse pour rester dans les marges.
  const wrapBlock = (text: string) => {
    const srcLines = text.split("\n");
    const lines: string[] = [];
    let headingCount = 0;
    srcLines.forEach((l, i) => {
      if (!l.trim()) {
        lines.push("");
        return;
      }
      const wrapped = wrapText(l, i === 0 ? boldFont : font, fontSize, colWidth - 2 * padding);
      if (i === 0) headingCount = wrapped.length;
      lines.push(...wrapped);
    });
    return { lines, headingCount };
  };
  const left = wrapBlock(leftText);
  const right = wrapBlock(rightText);
  const leftLines = left.lines;
  const rightLines = right.lines;
  const leftH = textBlockHeight(leftLines, fontSize);
  const rightH = textBlockHeight(rightLines, fontSize);
  const leftBoxH = (leftH + 2 * padding + fontSize) * heightFactor;
  const rightBoxH = (rightH + 2 * padding + fontSize) * heightFactor;
  const maxBoxH = Math.max(leftBoxH, rightBoxH);
  const primary = hexToRgb(theme.primaryColor);

  if (y - maxBoxH < FOOTER_HEIGHT + 30) {
    drawFooter(page, cabinet, theme, font, currentPage, totalPages);
    page = wrapPdfPage(doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]));
    drawHeader(page, cabinet, theme, font, boldFont, logo);
    y = PAGE_HEIGHT - HEADER_HEIGHT - 10;
    currentPage++;
  }

  const boxTop = y;
  drawRoundedRect(page, leftX, boxTop, colWidth, leftBoxH, 6, primary, filled);
  drawRoundedRect(page, rightX, boxTop, colWidth, rightBoxH, 6, primary, filled);

  let leftY = boxTop - padding - fontSize;
  let rightY = boxTop - padding - fontSize;

  const maxLines = Math.max(leftLines.length, rightLines.length);
  for (let i = 0; i < maxLines; i++) {
    const leftLine = leftLines[i];
    const rightLine = rightLines[i];

    if (leftLine !== undefined) {
      if (leftLine === "") {
        leftY -= fontSize * 0.7;
      } else {
        const isHeading = i < left.headingCount;
        page.drawText(leftLine, {
          x: leftX + padding,
          y: leftY,
          size: fontSize,
          font: isHeading ? boldFont : font,
          color: isHeading ? rgb(0, 0, 0) : rgb(0.15, 0.15, 0.15),
        });
        leftY -= fontSize * 1.4;
      }
    }

    if (rightLine !== undefined) {
      if (rightLine === "") {
        rightY -= fontSize * 0.7;
      } else {
        const isHeading = i < right.headingCount;
        page.drawText(rightLine, {
          x: rightX + padding,
          y: rightY,
          size: fontSize,
          font: isHeading ? boldFont : font,
          color: isHeading ? rgb(0, 0, 0) : rgb(0.15, 0.15, 0.15),
        });
        rightY -= fontSize * 1.4;
      }
    }
  }

  y = boxTop - maxBoxH - 10;
  return { page, y, currentPage };
}

export async function generateLegalPdf(
  data: LegalDocumentData,
  cabinet: CabinetInfo,
  theme: PdfThemeConfig
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = wrapPdfFont(await getFont(doc, theme.fontFamily));
  const boldFont = wrapPdfFont(await getBoldFont(doc, theme.fontFamily));
  const primary = hexToRgb(theme.primaryColor);
  const secondary = hexToRgb(theme.secondaryColor);
  const fontSize = theme.fontSize;
  const contentWidth = PAGE_WIDTH - 2 * MARGIN;

  // Embed le logo une seule fois pour toutes les pages
  const logo = cabinet.logoUrl ? await embedLogo(doc, cabinet.logoUrl) : null;

  // Le corps est découpé en paragraphes : le texte source n'est pas
  // toujours bien formaté, on répare sa structure avant le rendu.
  const bodyParagraphs = bodyToParagraphs(data.body);
  const paragraphIsHeading = (p: string) =>
    p.trim().endsWith(":") || BODY_HEADING_REGEX.test(p.trim());

  // Estimer le nombre de pages pour la pagination
  const bodyLineCount = bodyParagraphs.reduce(
    (n, p) =>
      n + wrapText(p, paragraphIsHeading(p) ? boldFont : font, fontSize, contentWidth).length + 1,
    0
  );
  const estimatedLinesPerPage = Math.floor(
    (PAGE_HEIGHT - HEADER_HEIGHT - FOOTER_HEIGHT - 100) / (fontSize * 1.4)
  );
  const totalPages = Math.max(1, Math.ceil(bodyLineCount / estimatedLinesPerPage));

  let page = wrapPdfPage(doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]));
  drawHeader(page, cabinet, theme, font, boldFont, logo);
  let y = PAGE_HEIGHT - HEADER_HEIGHT - 10;
  let currentPage = 1;

  // Référence et date (en haut à droite)
  if (data.reference || data.date) {
    const refLines: string[] = [];
    if (data.reference) refLines.push(`Réf: ${data.reference}`);
    if (data.date) refLines.push(`Date: ${data.date}`);
    refLines.forEach((line, i) => {
      const t = truncateToWidth(line, font, fontSize - 1, contentWidth);
      page.drawText(t, {
        x: PAGE_WIDTH - MARGIN - font.widthOfTextAtSize(t, fontSize - 1),
        y: y - i * (fontSize * 1.3),
        size: fontSize - 1,
        font,
        color: rgb(0.3, 0.3, 0.3),
      });
    });
    y -= refLines.length * (fontSize * 1.3) + 10;
  }

  // Titre du document (replié dans les marges si nécessaire)
  if (data.title?.trim()) {
    const titleSize = fontSize + 6;
    for (const titleLine of wrapText(data.title.trim(), boldFont, titleSize, contentWidth)) {
      page.drawText(titleLine, {
        x: MARGIN,
        y,
        size: titleSize,
        font: boldFont,
        color: rgb(primary.r, primary.g, primary.b),
      });
      y -= titleSize * 1.25;
    }
    y -= titleSize * 0.25;

    // Filet sous le titre
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: PAGE_WIDTH - MARGIN, y },
      thickness: 1.5,
      color: rgb(secondary.r, secondary.g, secondary.b),
    });
    y -= 8 + fontSize * 1.4;
  }

  // Destinataire
  if (data.recipient) {
    page.drawText("À l'attention de :", {
      x: MARGIN,
      y,
      size: fontSize - 2,
      font,
      color: rgb(0.4, 0.4, 0.4),
    });
    y -= fontSize * 1.3;
    const recipientLines = wrapText(data.recipient, boldFont, fontSize, contentWidth);
    for (const line of recipientLines) {
      page.drawText(line, {
        x: MARGIN,
        y,
        size: fontSize,
        font: boldFont,
        color: rgb(0.2, 0.2, 0.2),
      });
      y -= fontSize * 1.4;
    }
    y -= fontSize * 1.4 * 2;
  }

  // Objet
  if (data.subject) {
    page.drawText("Objet : ", {
      x: MARGIN,
      y,
      size: fontSize,
      font: boldFont,
      color: rgb(0, 0, 0),
    });
    const subjectText = data.subject;
    const subjectLines = wrapText(subjectText, boldFont, fontSize, contentWidth - boldFont.widthOfTextAtSize("Objet : ", fontSize));
    subjectLines.forEach((line, i) => {
      if (i === 0) {
        page.drawText(line, {
          x: MARGIN + boldFont.widthOfTextAtSize("Objet : ", fontSize),
          y,
          size: fontSize,
          font: boldFont,
          color: rgb(0, 0, 0),
        });
      } else {
        page.drawText(line, {
          x: MARGIN,
          y,
          size: fontSize,
          font: boldFont,
          color: rgb(0, 0, 0),
        });
      }
      y -= fontSize * 1.4;
    });
    y -= 8;
  }

  // Dossier
  if (data.dossier) {
    const dossierLabel = "Dossier : ";
    page.drawText(dossierLabel, {
      x: MARGIN,
      y,
      size: fontSize,
      font: boldFont,
      color: rgb(0, 0, 0),
    });
    const dossierLines = wrapText(data.dossier, boldFont, fontSize, contentWidth - boldFont.widthOfTextAtSize(dossierLabel, fontSize));
    dossierLines.forEach((line, i) => {
      page.drawText(line, {
        x: MARGIN + (i === 0 ? boldFont.widthOfTextAtSize(dossierLabel, fontSize) : 0),
        y,
        size: fontSize,
        font: boldFont,
        color: rgb(0, 0, 0),
      });
      y -= fontSize * 1.4;
    });
    y -= 8;
  }

  // Blocs côte-à-côte Cabinet / Professionnel
  if (data.columns) {
    y -= 8;
    const col = drawTwoColumnBlock(
      doc,
      page,
      y,
      data.columns.left,
      data.columns.right,
      font,
      boldFont,
      fontSize,
      contentWidth,
      cabinet,
      theme,
      logo,
      currentPage,
      totalPages
    );
    page = col.page;
    y = col.y;
    currentPage = col.currentPage;
    y -= fontSize * 2.8;
  }

  // Corps du document : paragraphes espacés, lignes justifiées dans les
  // marges (sauf la dernière ligne de chaque paragraphe), intitulés en gras.
  const bodyColor = { r: 0.15, g: 0.15, b: 0.15 };
  let firstParagraph = true;
  for (const para of bodyParagraphs) {
    const heading = paragraphIsHeading(para);
    const pFont = heading ? boldFont : font;
    const lines = wrapText(para, pFont, fontSize, contentWidth);
    if (!lines.length) continue;

    if (!firstParagraph && heading) y -= fontSize * 0.4;
    firstParagraph = false;

    for (let i = 0; i < lines.length; i++) {
      if (y < FOOTER_LIMIT) {
        drawFooter(page, cabinet, theme, font, currentPage, totalPages);
        page = wrapPdfPage(doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]));
        drawHeader(page, cabinet, theme, font, boldFont, logo);
        y = PAGE_HEIGHT - HEADER_HEIGHT - 10;
        currentPage++;
      }
      const line = lines[i];
      if (heading) {
        page.drawText(line, {
          x: MARGIN,
          y,
          size: fontSize,
          font: boldFont,
          color: rgb(0, 0, 0),
        });
      } else if (i === lines.length - 1) {
        page.drawText(line, {
          x: MARGIN,
          y,
          size: fontSize,
          font,
          color: rgb(bodyColor.r, bodyColor.g, bodyColor.b),
        });
      } else {
        drawJustifiedLine(page, line, font, fontSize, MARGIN, y, contentWidth, bodyColor);
      }
      y -= fontSize * 1.4;
    }
    y -= fontSize * 0.9; // espace entre paragraphes
  }

  // Signature
  if (data.signature2 && data.signature) {
    y -= 8;
    const col = drawTwoColumnBlock(
      doc,
      page,
      y,
      data.signature,
      data.signature2,
      font,
      boldFont,
      fontSize,
      contentWidth,
      cabinet,
      theme,
      logo,
      currentPage,
      totalPages,
      2,
      true
    );
    page = col.page;
    y = col.y;
    currentPage = col.currentPage;
  } else if (data.signature) {
    y -= 8;
    if (y < FOOTER_HEIGHT + 60) {
      drawFooter(page, cabinet, theme, font, currentPage, totalPages);
      page = wrapPdfPage(doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]));
      drawHeader(page, cabinet, theme, font, boldFont, logo);
      y = PAGE_HEIGHT - HEADER_HEIGHT - 10;
      currentPage++;
    }
    const signatureLines = data.signature
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    const sigX = PAGE_WIDTH - MARGIN - 200;
    for (const rawLine of signatureLines) {
      for (const line of wrapText(rawLine, font, fontSize, 200)) {
        if (y < FOOTER_LIMIT) {
          drawFooter(page, cabinet, theme, font, currentPage, totalPages);
          page = wrapPdfPage(doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]));
          drawHeader(page, cabinet, theme, font, boldFont, logo);
          y = PAGE_HEIGHT - HEADER_HEIGHT - 10;
          currentPage++;
        }
        page.drawText(line, {
          x: sigX,
          y,
          size: fontSize,
          font,
          color: rgb(0.2, 0.2, 0.2),
        });
        y -= fontSize * 1.4;
      }
    }
    y -= 15;

    if (data.signatureImage) {
      const signatureImg = await embedSignatureImage(doc, data.signatureImage);
      if (signatureImg) {
        // Signature affichée à 50 % de la largeur maximale initiale (réduction de 50 %).
        const imgMaxWidth = 75;
        const scale = Math.min(imgMaxWidth / signatureImg.width, 1);
        const drawW = signatureImg.width * scale;
        const drawH = signatureImg.height * scale;
        if (y - drawH < FOOTER_HEIGHT + 20) {
          drawFooter(page, cabinet, theme, font, currentPage, totalPages);
          page = wrapPdfPage(doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]));
          drawHeader(page, cabinet, theme, font, boldFont, logo);
          y = PAGE_HEIGHT - HEADER_HEIGHT - 10;
          currentPage++;
        }
        page.drawImage(signatureImg, {
          x: PAGE_WIDTH - MARGIN - 200,
          y: y - drawH,
          width: drawW,
          height: drawH,
        });
        y -= drawH + 10;
      }
    }

    y -= 10;
    page.drawLine({
      start: { x: PAGE_WIDTH - MARGIN - 200, y },
      end: { x: PAGE_WIDTH - MARGIN, y },
      thickness: 0.5,
      color: rgb(0.5, 0.5, 0.5),
    });
  }

  drawFooter(page, cabinet, theme, font, currentPage, totalPages);

  // Filigrane diagonal (ex. « BROUILLON » avant validation du document).
  if (data.watermark?.trim()) {
    const text = data.watermark.trim().toUpperCase();
    const wmSize = 64;
    for (const p of doc.getPages()) {
      const { width, height } = p.getSize();
      const textWidth = boldFont.widthOfTextAtSize(text, wmSize);
      p.drawText(text, {
        x: (width - textWidth) / 2,
        y: height / 2,
        size: wmSize,
        font: boldFont,
        color: rgb(0.75, 0.2, 0.2),
        opacity: 0.12,
        rotate: degrees(38),
      });
    }
  }

  return doc.save();
}

/* ------------------------------------------------------------------ */
/* Génération de rapports tabulaires (même en-tête / pied de page)     */
/* ------------------------------------------------------------------ */

export interface ReportColumn {
  label: string;
  align?: "left" | "center" | "right";
  /** Largeur relative (poids). Défaut : 1 */
  weight?: number;
}

export interface ReportRow {
  cells: string[];
  /** normal | group (ligne de section fusionnée) | total (gras, fond teinté) | bold */
  style?: "normal" | "group" | "total" | "bold";
  /** Couleurs de texte optionnelles par cellule (hexadécimales) */
  cellColors?: (string | undefined)[];
}

export interface ReportTable {
  columns: ReportColumn[];
  rows: ReportRow[];
}

export interface ReportStat {
  label: string;
  value: string;
  color?: "primary" | "green" | "red" | "gray";
}

export type ReportBlock =
  | { type: "sectionTitle"; text: string; keepTogether?: boolean }
  | { type: "paragraph"; text: string; keepTogether?: boolean }
  | { type: "stats"; items: ReportStat[]; keepTogether?: boolean }
  | { type: "table"; table: ReportTable; keepTogether?: boolean }
  | { type: "spacer"; height?: number; keepTogether?: boolean }
  | { type: "pageBreak" }
  | { type: "section"; title: string; blocks: ReportBlock[]; keepTogether?: boolean }
  | { type: "signatures"; items: { role: string; name: string }[]; keepTogether?: boolean };

const FOOTER_LIMIT = FOOTER_HEIGHT + 30;
const TABLE_ROW_HEIGHT = 14;

function truncateToWidth(text: string, font: PDFFont, size: number, maxWidth: number): string {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  let t = text;
  while (t.length > 0 && font.widthOfTextAtSize(t + "…", size) > maxWidth) {
    t = t.slice(0, -1);
  }
  return t.length < text.length ? t + "…" : t;
}

/**
 * Génère un PDF multi-sections (titres, paragraphes, statistiques, tableaux)
 * en réutilisant exactement le même en-tête et pied de page que
 * {@link generateLegalPdf}. Les pieds de page (avec pagination « Page X / N »)
 * sont dessinés à la fin, une fois le nombre total de pages connu.
 */
export async function generateReportPdf(
  docTitle: string,
  docSubtitle: string | undefined,
  blocks: ReportBlock[],
  cabinet: CabinetInfo,
  theme: PdfThemeConfig
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = wrapPdfFont(await getFont(doc, theme.fontFamily));
  const boldFont = wrapPdfFont(await getBoldFont(doc, theme.fontFamily));
  const primary = hexToRgb(theme.primaryColor);
  const secondary = hexToRgb(theme.secondaryColor);
  const fontSize = theme.fontSize;
  const contentWidth = PAGE_WIDTH - 2 * MARGIN;
  const logo = cabinet.logoUrl ? await embedLogo(doc, cabinet.logoUrl) : null;

  const pages: PDFPage[] = [];
  let page = wrapPdfPage(doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]));
  pages.push(page);
  drawHeader(page, cabinet, theme, font, boldFont, logo);
  let y = PAGE_HEIGHT - HEADER_HEIGHT - 10;

  const newPage = () => {
    page = wrapPdfPage(doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]));
    pages.push(page);
    drawHeader(page, cabinet, theme, font, boldFont, logo);
    y = PAGE_HEIGHT - HEADER_HEIGHT - 10;
  };
  const ensureSpace = (needed: number) => {
    if (y - needed < FOOTER_LIMIT) newPage();
  };

  // Titre du document (même style que generateLegalPdf)
  const titleSize = fontSize + 6;
  page.drawText(docTitle, {
    x: MARGIN,
    y,
    size: titleSize,
    font: boldFont,
    color: rgb(primary.r, primary.g, primary.b),
  });
  y -= titleSize * 1.5;
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_WIDTH - MARGIN, y },
    thickness: 1.5,
    color: rgb(secondary.r, secondary.g, secondary.b),
  });
  y -= 18;

  if (docSubtitle) {
    for (const line of wrapText(docSubtitle, font, fontSize - 2, contentWidth)) {
      page.drawText(line, {
        x: MARGIN,
        y,
        size: fontSize - 2,
        font,
        color: rgb(0.4, 0.4, 0.4),
      });
      y -= (fontSize - 2) * 1.4;
    }
    y -= 8;
  }

  const statColors: Record<NonNullable<ReportStat["color"]>, [number, number, number]> = {
    primary: [primary.r, primary.g, primary.b],
    green: [0.02, 0.55, 0.32],
    red: [0.8, 0.15, 0.15],
    gray: [0.35, 0.35, 0.35],
  };

  function estimateBlockHeight(block: ReportBlock, font: PDFFont, boldFont: PDFFont): number {
    switch (block.type) {
      case "sectionTitle":
        return fontSize + 26;
      case "paragraph":
        return wrapText(block.text, font, fontSize - 1, contentWidth).length * (fontSize - 1) * 1.4 + 4;
      case "spacer":
        return block.height ?? 12;
      case "stats": {
        const perRow = 3;
        const rows = Math.ceil(block.items.length / perRow);
        return rows * 52;
      }
      case "table": {
        const { rows } = block.table;
        return TABLE_ROW_HEIGHT * (rows.length + 1) + 10;
      }
      case "pageBreak":
        return 0;
      case "section":
        return fontSize + 26 + estimateBlocksHeight(block.blocks, font, boldFont);
      case "signatures":
        return 90;
      default:
        return 0;
    }
  }

  function estimateBlocksHeight(blocks: ReportBlock[], font: PDFFont, boldFont: PDFFont): number {
    return blocks.reduce((sum, b) => sum + estimateBlockHeight(b, font, boldFont), 0);
  }

  const renderBlocks = (blocks: ReportBlock[]) => {
    for (const block of blocks) {
      if (block.type !== "pageBreak" && block.keepTogether) {
        const needed = estimateBlockHeight(block, font, boldFont);
        if (y - needed < FOOTER_LIMIT) newPage();
      }

      switch (block.type) {
      case "pageBreak":
        newPage();
        break;

      case "spacer":
        y -= block.height ?? 12;
        if (y < FOOTER_LIMIT) newPage();
        break;

      case "sectionTitle": {
        ensureSpace(fontSize * 3);
        y -= 6;
        page.drawText(block.text, {
          x: MARGIN,
          y,
          size: fontSize + 2,
          font: boldFont,
          color: rgb(primary.r, primary.g, primary.b),
        });
        y -= fontSize + 6;
        page.drawLine({
          start: { x: MARGIN, y },
          end: { x: PAGE_WIDTH - MARGIN, y },
          thickness: 0.5,
          color: rgb(secondary.r, secondary.g, secondary.b),
        });
        y -= 14;
        break;
      }

      case "paragraph": {
        for (const line of wrapText(block.text, font, fontSize - 1, contentWidth)) {
          ensureSpace(fontSize * 1.4);
          page.drawText(line, {
            x: MARGIN,
            y,
            size: fontSize - 1,
            font,
            color: rgb(0.2, 0.2, 0.2),
          });
          y -= (fontSize - 1) * 1.4;
        }
        y -= 4;
        break;
      }

      case "stats": {
        const perRow = 3;
        const gap = 8;
        const boxW = (contentWidth - gap * (perRow - 1)) / perRow;
        const boxH = 42;
        for (let i = 0; i < block.items.length; i += perRow) {
          ensureSpace(boxH + 10);
          const rowItems = block.items.slice(i, i + perRow);
          rowItems.forEach((item, j) => {
            if (!item.label && !item.value) return;
            const bx = MARGIN + j * (boxW + gap);
            page.drawRectangle({
              x: bx,
              y: y - boxH + 6,
              width: boxW,
              height: boxH,
              borderColor: rgb(0.8, 0.8, 0.8),
              borderWidth: 0.5,
            });
            const label = truncateToWidth(item.label, font, 7, boxW - 10);
            page.drawText(label, {
              x: bx + (boxW - font.widthOfTextAtSize(label, 7)) / 2,
              y: y - 8,
              size: 7,
              font,
              color: rgb(0.45, 0.45, 0.45),
            });
            const [cr, cg, cb] = statColors[item.color ?? "primary"];
            const value = truncateToWidth(item.value, boldFont, 11, boxW - 10);
            page.drawText(value, {
              x: bx + (boxW - boldFont.widthOfTextAtSize(value, 11)) / 2,
              y: y - 26,
              size: 11,
              font: boldFont,
              color: rgb(cr, cg, cb),
            });
          });
          y -= boxH + 10;
        }
        break;
      }

      case "table": {
        const { columns, rows } = block.table;
        const totalWeight = columns.reduce((s, c) => s + (c.weight ?? 1), 0);
        const colWidths = columns.map((c) => ((c.weight ?? 1) / totalWeight) * contentWidth);
        const colX: number[] = [];
        let cx = MARGIN;
        for (const w of colWidths) {
          colX.push(cx);
          cx += w;
        }
        const cellSize = fontSize - 2;

        const drawTableHeader = () => {
          ensureSpace(TABLE_ROW_HEIGHT * 2);
          columns.forEach((col, i) => {
            const label = truncateToWidth(col.label, boldFont, cellSize - 1, colWidths[i] - 4);
            let tx = colX[i] + 2;
            if (col.align === "right") tx = colX[i] + colWidths[i] - 2 - boldFont.widthOfTextAtSize(label, cellSize - 1);
            else if (col.align === "center") tx = colX[i] + (colWidths[i] - boldFont.widthOfTextAtSize(label, cellSize - 1)) / 2;
            page.drawText(label, {
              x: tx,
              y,
              size: cellSize - 1,
              font: boldFont,
              color: rgb(0.4, 0.4, 0.4),
            });
          });
          y -= 6;
          page.drawLine({
            start: { x: MARGIN, y },
            end: { x: PAGE_WIDTH - MARGIN, y },
            thickness: 0.7,
            color: rgb(0.6, 0.6, 0.6),
          });
          y -= TABLE_ROW_HEIGHT - 6;
        };

        drawTableHeader();
        for (const row of rows) {
          // Répéter l'en-tête du tableau après un saut de page
          const pagesBefore = pages.length;
          ensureSpace(TABLE_ROW_HEIGHT);
          if (pages.length > pagesBefore) drawTableHeader();
          const style = row.style ?? "normal";

          if (style === "group") {
            page.drawRectangle({
              x: MARGIN,
              y: y - 3,
              width: contentWidth,
              height: TABLE_ROW_HEIGHT,
              color: rgb(0.93, 0.93, 0.93),
            });
            page.drawText(truncateToWidth(row.cells[0] ?? "", boldFont, cellSize, contentWidth - 6), {
              x: MARGIN + 3,
              y: y + 1,
              size: cellSize,
              font: boldFont,
              color: rgb(0.25, 0.25, 0.25),
            });
            y -= TABLE_ROW_HEIGHT;
            continue;
          }

          if (style === "total") {
            page.drawRectangle({
              x: MARGIN,
              y: y - 3,
              width: contentWidth,
              height: TABLE_ROW_HEIGHT + 2,
              color: rgb(
                0.85 + secondary.r * 0.15,
                0.85 + secondary.g * 0.15,
                0.85 + secondary.b * 0.15
              ),
            });
          }

          const rowFont = style === "total" || style === "bold" ? boldFont : font;
          row.cells.forEach((cell, i) => {
            if (i >= columns.length) return;
            const col = columns[i];
            const text = truncateToWidth(cell ?? "", rowFont, cellSize, colWidths[i] - 4);
            let tx = colX[i] + 2;
            if (col.align === "right") tx = colX[i] + colWidths[i] - 2 - rowFont.widthOfTextAtSize(text, cellSize);
            else if (col.align === "center") tx = colX[i] + (colWidths[i] - rowFont.widthOfTextAtSize(text, cellSize)) / 2;
            const cellColorHex = row.cellColors?.[i];
            const cellColor = cellColorHex ? hexToRgb(cellColorHex) : null;
            page.drawText(text, {
              x: tx,
              y: y + 1,
              size: cellSize,
              font: rowFont,
              color: cellColor ? rgb(cellColor.r, cellColor.g, cellColor.b) : rgb(0.15, 0.15, 0.15),
            });
          });
          y -= TABLE_ROW_HEIGHT;
          page.drawLine({
            start: { x: MARGIN, y },
            end: { x: PAGE_WIDTH - MARGIN, y },
            thickness: 0.3,
            color: rgb(0.88, 0.88, 0.88),
          });
        }
        y -= 10;
        break;
      }

      case "section": {
        ensureSpace(fontSize * 3);
        y -= 6;
        page.drawText(block.title, {
          x: MARGIN,
          y,
          size: fontSize + 2,
          font: boldFont,
          color: rgb(primary.r, primary.g, primary.b),
        });
        y -= fontSize + 6;
        page.drawLine({
          start: { x: MARGIN, y },
          end: { x: PAGE_WIDTH - MARGIN, y },
          thickness: 0.5,
          color: rgb(secondary.r, secondary.g, secondary.b),
        });
        y -= 14;
        renderBlocks(block.blocks);
        break;
      }

      case "signatures": {
        const items = block.items;
        const colW = contentWidth / items.length;
        const sigH = 80;
        ensureSpace(sigH);
        const startY = y - 10;
        items.forEach((item, i) => {
          const cx = MARGIN + i * colW;
          const centerX = cx + colW / 2;
          let cy = startY;

          // Role
          const roleText = item.role;
          const roleW = boldFont.widthOfTextAtSize(roleText, fontSize - 1);
          page.drawText(roleText, {
            x: centerX - roleW / 2,
            y: cy,
            size: fontSize - 1,
            font: boldFont,
            color: rgb(0.2, 0.2, 0.2),
          });
          cy -= (fontSize - 1) * 1.4;

          // Name
          const nameText = item.name;
          const nameW = font.widthOfTextAtSize(nameText, fontSize - 2);
          page.drawText(nameText, {
            x: centerX - nameW / 2,
            y: cy,
            size: fontSize - 2,
            font,
            color: rgb(0.4, 0.4, 0.4),
          });
          cy -= 50;

          // Cachet et signature
          const cachetText = "Cachet et signature";
          const cachetW = font.widthOfTextAtSize(cachetText, fontSize - 2);
          page.drawText(cachetText, {
            x: centerX - cachetW / 2,
            y: cy,
            size: fontSize - 2,
            font,
            color: rgb(0.6, 0.6, 0.6),
          });
        });
        y = startY - sigH;
        break;
      }
      }
    }
  };

  renderBlocks(blocks);

  // Pieds de page sur toutes les pages (pagination exacte)
  pages.forEach((p, i) => drawFooter(p, cabinet, theme, font, i + 1, pages.length));

  return doc.save();
}
