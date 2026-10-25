import { getMissionTemplateNotes } from "./mission-templates";

export type MissionFormData = Record<string, string | boolean>;

function slugify(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 50);
}

function cleanLabel(raw: string): string {
  return raw
    .replace(/[\[\]]/g, "")
    .replace(/[\(\)–\-:;.,!/?]+$/g, "")
    .replace(/^[\(\)–\-:;.,!/?]+/g, "")
    .trim();
}

function extractLastSegment(preText: string): string {
  const parts = preText.split(/[:–\-]/).map(cleanLabel).filter(Boolean);
  return parts.pop() || cleanLabel(preText);
}

function makeUniqueKey(label: string, used: Set<string>): string {
  let base = slugify(label) || "valeur";
  if (!used.has(base)) {
    used.add(base);
    return base;
  }
  let i = 2;
  while (used.has(`${base}_${i}`)) i++;
  const key = `${base}_${i}`;
  used.add(key);
  return key;
}

export interface MissionFormFieldItem {
  kind: "field";
  key: string;
  label: string;
  type: "text" | "textarea" | "date";
}

export interface MissionFormCheckboxItem {
  kind: "checkbox";
  key: string;
  label: string;
}

export type MissionFormItem = MissionFormFieldItem | MissionFormCheckboxItem;

export interface ParsedMissionTemplate {
  items: MissionFormItem[];
}

const TEXTAREA_HINTS = /ex\.?\s*:|détaillée|description|commentaire|préciser|exemple/i;

const DATE_HINTS = /date|jj\/mm/i;

const CONNECTOR_WORD = /^(le|la|les|de|du|des|d|l|à|a|au|aux|et|en|par|pour|sur|sous|dans)$/i;

function isDotOnly(content: string): boolean {
  return /^[.…\s]+$/.test(content);
}

export function parseTemplate(template: string): ParsedMissionTemplate {
  const lines = template.split("\n");
  const used = new Set<string>();
  const items: MissionFormItem[] = [];

  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    if (line.startsWith("<<<") && line.endsWith(">>>")) continue;

    const prevContext = lines
      .slice(0, li)
      .reverse()
      .find((l) => l.trim() && !l.includes("[") && !l.includes("]") && !(l.startsWith("<<<") && l.endsWith(">>>")));
    const context = prevContext ? cleanLabel(prevContext) : "";

    const tokens = [...line.matchAll(/\[([^\[\]]*)\]/g)];
    if (tokens.length === 0) continue;

    for (let ti = 0; ti < tokens.length; ti++) {
      const m = tokens[ti];
      const start = m.index!;
      const end = start + m[0].length;
      const content = m[1];
      const prevEnd = ti > 0 ? tokens[ti - 1].index! + tokens[ti - 1][0].length : 0;
      const tokenPreText = line.slice(prevEnd, start).trimStart();

      const cleanPreText = tokenPreText
        .replace(/^\[([ X])\]\s*/, "")
        .trim();

      const isCheckbox = content === " " || content === "X" || content === "";
      const nextStart = tokens[ti + 1]?.index ?? line.length;

      if (isCheckbox) {
        const rawLabel = line.slice(end, nextStart).trim();
        const label = cleanLabel(rawLabel.split(/[\[\(:;]/)[0]) || rawLabel || "Option";
        const key = makeUniqueKey(label, used);
        items.push({ kind: "checkbox", key, label });
      } else {
        let label: string;

        if (cleanPreText) {
          const seg = extractLastSegment(cleanPreText);
          const contentLabel = cleanLabel(content);
          label = CONNECTOR_WORD.test(seg) && contentLabel && !isDotOnly(content) ? contentLabel : seg;
        } else if (context) {
          label = context;
        } else {
          label = isDotOnly(content) ? "Valeur" : cleanLabel(content);
        }

        const key = makeUniqueKey(label, used);
        const type: MissionFormFieldItem["type"] =
          content.length > 40 ||
          TEXTAREA_HINTS.test(content) ||
          TEXTAREA_HINTS.test(label)
            ? "textarea"
            : DATE_HINTS.test(content) || DATE_HINTS.test(label)
              ? "date"
              : "text";

        items.push({ kind: "field", key, label, type });
      }
    }
  }

  return { items };
}

export function parseMissionTemplate(profession: string): ParsedMissionTemplate {
  return parseTemplate(getMissionTemplateNotes(profession));
}

export function getMissionFormDefaults(profession: string): MissionFormData {
  const { items } = parseMissionTemplate(profession);
  const defaults: MissionFormData = {};
  for (const item of items) {
    defaults[item.key] = item.kind === "field" ? "" : false;
  }
  return defaults;
}

export function renderTemplate(template: string, data: MissionFormData): string {
  const { items } = parseTemplate(template);
  const fields = items.filter((i) => i.kind === "field") as MissionFormFieldItem[];
  const checkboxes = items.filter((i) => i.kind === "checkbox") as MissionFormCheckboxItem[];

  let fieldIdx = 0;
  let body = template.replace(/\[([^\[\]]{2,})\]/g, () => {
    const field = fields[fieldIdx++];
    if (!field) return "";
    const value = data[field.key];
    return typeof value === "string" && value.trim() ? value : field.label ? `[${field.label}]` : "";
  });

  let cbIdx = 0;
  body = body
    .split("\n")
    .map((line) => {
      const cbMatch = line.match(/^(\[)([ X])(\])\s*(.+)$/);
      if (cbMatch) {
        const label = cbMatch[4].trim();
        const key = checkboxes[cbIdx]?.key;
        cbIdx++;
        const checked = key ? data[key] === true : false;
        return `[${checked ? "X" : " "}] ${label}`;
      }
      return line;
    })
    .join("\n");

  body = body
    .split("\n")
    .filter((l) => !(l.startsWith("<<<") && l.endsWith(">>>")))
    .map((line) => {
      const hasUnchecked = line.includes("[ ]");
      const hasChecked = line.includes("[X]");
      if (!hasUnchecked) return line;
      if (!hasChecked) return null;
      // une ligne mixte : on retire les [ ] ... tout en gardant les [X]
      return line
        .replace(/(\s*[\-–/]\s*)?\[ \](.+?)(?=\s*[\-–/]\s*(?:\[ \]|\[X\])|$)/g, "")
        .replace(/\s*[\-–/]\s*$/, "")
        .trim();
    })
    .filter((l): l is string => l !== null)
    .join("\n");

  body = body.replace(/\[\s*\]/g, "");
  return body;
}

export function buildMissionBody(profession: string, data: MissionFormData): string {
  return buildMissionSections(profession, data).body;
}

export interface MissionSections {
  body: string;
  cabinet: string;
  professionnel: string;
  signatureCabinet: string;
  signatureProfessionnel: string;
}

const MARKERS = {
  cabinet: "<<<CABINET>>>",
  professionnel: "<<<PROFESSIONNEL>>>",
  body: "<<<BODY>>>",
  signatures: "<<<SIGNATURES>>>",
  cabinetSign: "<<<CABINET-SIGN>>>",
  professionnelSign: "<<<PROFESSIONNEL-SIGN>>>",
};

function extractBetween(template: string, start: string, end: string): string {
  const s = template.indexOf(start);
  const e = template.indexOf(end, s + 1);
  if (s === -1 || e === -1) return "";
  return template.slice(s + start.length, e).trim();
}

export function buildMissionSections(profession: string, data: MissionFormData): MissionSections {
  const template = getMissionTemplateNotes(profession);

  if (!template.includes(MARKERS.cabinet)) {
    return {
      body: renderTemplate(template, data),
      cabinet: "",
      professionnel: "",
      signatureCabinet: "",
      signatureProfessionnel: "",
    };
  }

  const cabinet = extractBetween(template, MARKERS.cabinet, MARKERS.professionnel);
  const professionnel = extractBetween(template, MARKERS.professionnel, MARKERS.body);
  const bodyAndSignature = extractBetween(template, MARKERS.body, MARKERS.signatures);
  const signHeader = extractBetween(template, MARKERS.signatures, MARKERS.cabinetSign);
  const cabinetSign = extractBetween(template, MARKERS.cabinetSign, MARKERS.professionnelSign);

  const ps = template.indexOf(MARKERS.professionnelSign);
  const professionnelSign = ps === -1 ? "" : template.slice(ps + MARKERS.professionnelSign.length).trim();

  const body = bodyAndSignature + (signHeader ? "\n\n\n\n" + signHeader : "");

  return {
    body: renderTemplate(body, data),
    cabinet: renderTemplate(cabinet, data),
    professionnel: renderTemplate(professionnel, data),
    signatureCabinet: renderTemplate(cabinetSign, data),
    signatureProfessionnel: renderTemplate(professionnelSign, data),
  };
}
