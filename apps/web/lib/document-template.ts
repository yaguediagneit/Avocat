/**
 * Modèles de documents à variables.
 *
 * Le contenu fixe d'un `TacheTemplate.contenuDocument` peut contenir des
 * variables sous deux formes :
 *   - `{{cle}}` ou `{{cle|Libellé affiché}}` (clé explicite)
 *   - `[Texte libre]` : le texte entre crochets devient le libellé du champ
 *     et sa clé est déduite automatiquement (slug).
 * Ces variables sont détectées et présentées sous forme de champs éditables
 * dans le formulaire de génération PDF ; le reste du texte reste non
 * modifiable. Quand un dossier est sélectionné, les champs reconnus sont
 * pré-remplis à partir des informations du dossier, du client, du cabinet
 * et de l'utilisateur connecté.
 */

export interface DocumentTemplateVariable {
  /** Identifiant unique de la variable (ex. `ville`, `adresse_complete_2`). */
  cle: string;
  /** Libellé affiché dans le formulaire. */
  label: string;
  /** true si le champ est long (zone de texte plutôt qu'input). */
  multiline: boolean;
}

const MUSTACHE_REGEX = /\{\{\s*([A-Za-z0-9_]+)\s*(?:\|\s*([^{}]*?)\s*)?\}\}/g;
const BRACKET_REGEX = /\[([^\[\]\n]{2,160})\]/g;
/// Bloc conditionnel : {{#if cle == "valeur"}}...{{/if}} (ou !=).
/// Permet les variantes par type (ex. type_contrat == "prestation") dans un
/// même modèle : seul le bloc correspondant est conservé dans le rendu.
const CONDITIONAL_REGEX =
  /\{\{#if\s+([A-Za-z0-9_]+)\s*(==|!=)\s*"([^"]*)"\s*\}\}([\s\S]*?)\{\{\/if\}\}/g;

/** Transforme un libellé en clé exploitable : « Nom du client » → `nom_du_client`. */
export function slugifyLabel(label: string): string {
  return label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60) || "champ";
}

/**
 * Extrait la liste des variables uniques présentes dans un modèle.
 * Si deux libellés entre crochets produisent la même clé (ex. deux fois
 * « [Adresse complète] »), chaque occurrence reçoit une clé suffixée
 * (`_2`, `_3`, …) pour rester un champ distinct.
 */
export function extractTemplateVariables(
  contenu: string | null | undefined
): DocumentTemplateVariable[] {
  if (!contenu) return [];

  interface RawVar {
    index: number;
    cle: string;
    label: string;
    kind: "mustache" | "bracket";
  }
  const raw: RawVar[] = [];

  for (const m of contenu.matchAll(MUSTACHE_REGEX)) {
    raw.push({
      index: m.index ?? 0,
      cle: m[1],
      label: m[2]?.trim() || m[1],
      kind: "mustache",
    });
  }
  for (const m of contenu.matchAll(BRACKET_REGEX)) {
    const label = m[1].trim();
    raw.push({
      index: m.index ?? 0,
      cle: slugifyLabel(label),
      label,
      kind: "bracket",
    });
  }

  raw.sort((a, b) => a.index - b.index);

  const seenMustache = new Set<string>();
  const seenBracket = new Map<string, number>();
  const variables: DocumentTemplateVariable[] = [];
  for (const v of raw) {
    if (v.kind === "mustache") {
      // Un {{cle}} répété désigne le même champ.
      if (seenMustache.has(v.cle)) continue;
      seenMustache.add(v.cle);
      variables.push({ cle: v.cle, label: v.label, multiline: v.label.length > 60 });
    } else {
      // Un [libellé] répété (ex. « Adresse complète ») devient un champ
      // distinct suffixé : adresse_complete, adresse_complete_2…
      const count = (seenBracket.get(v.cle) ?? 0) + 1;
      seenBracket.set(v.cle, count);
      const cle = count === 1 ? v.cle : `${v.cle}_${count}`;
      variables.push({ cle, label: v.label, multiline: v.label.length > 60 });
    }
  }
  return variables;
}

/**
 * Substitue les variables du modèle par les valeurs fournies.
 * Une variable sans valeur est remplacée par une ligne de saisie `____`.
 */
export function renderDocumentTemplate(
  contenu: string,
  valeurs: Record<string, string>
): string {
  // Compteurs par clé de base pour gérer les doublons de crochets
  // (`[Adresse complète]` × 2 → `adresse_complete`, `adresse_complete_2`).
  const counters = new Map<string, number>();

  function valeurPour(cleBase: string, label: string): string {
    const count = (counters.get(cleBase) ?? 0) + 1;
    counters.set(cleBase, count);
    const cle = count === 1 ? cleBase : `${cleBase}_${count}`;
    const valeur = valeurs[cle]?.trim();
    return valeur || `____ [${label}] ____`;
  }

  // Résolution des blocs conditionnels avant la substitution des variables.
  let result = contenu.replace(
    CONDITIONAL_REGEX,
    (_m, cle: string, op: string, attendu: string, bloc: string) => {
      const actuel = (valeurs[cle] ?? "").trim().toLowerCase();
      const ok = op === "==" ? actuel === attendu.trim().toLowerCase() : actuel !== attendu.trim().toLowerCase();
      return ok ? bloc : "";
    }
  );
  result = result.replace(
    MUSTACHE_REGEX,
    (_m, cle: string, label?: string) => {
      const v = valeurs[cle]?.trim();
      return v || `____ [${(label ?? cle).trim()}] ____`;
    }
  );
  result = result.replace(BRACKET_REGEX, (_m, label: string) =>
    valeurPour(slugifyLabel(label.trim()), label.trim())
  );
  // Marqueurs de section confidentielle : retirés du rendu normal (le
  // contenu est conservé ; la suppression du contenu est gérée en amont
  // par l'appelant — ex. option « version confidentielle » des contrats).
  result = result.replace(/\[\[\/?CONFIDENTIEL\]\]/g, "");
  return result;
}

/* ------------------------------------------------------------------ */
/* Suggestions automatiques depuis le dossier / cabinet / utilisateur */
/* ------------------------------------------------------------------ */

export interface TemplateFillContext {
  cabinet?: {
    raisonSociale?: string;
    adresse?: string;
    telephone?: string;
    email?: string;
    siteWeb?: string;
  };
  user?: { prenom?: string; nom?: string; titre?: string };
  dossier?: {
    referenceInterne?: string;
    typeAffaire?: string;
    partiesAdverses?: unknown;
  };
  client?: {
    raisonSociale?: string;
    adresse?: string;
    coordonnees?: unknown;
    representants?: unknown;
  };
}

function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export function firstJsonText(v: unknown): string {
  if (Array.isArray(v) && v.length > 0) {
    const first = v[0];
    if (typeof first === "string") return first;
    if (first && typeof first === "object") {
      const o = first as Record<string, unknown>;
      return String(o.nom ?? o.raisonSociale ?? o.name ?? "");
    }
  }
  if (typeof v === "string") return v;
  return "";
}

function clientTelephone(c: TemplateFillContext["client"]): string {
  const coord = c?.coordonnees;
  if (coord && typeof coord === "object") {
    const o = coord as Record<string, unknown>;
    return String(o.telephone ?? o.tel ?? "");
  }
  return "";
}

/**
 * Propose une valeur pour chaque variable selon son libellé, à partir des
 * informations disponibles (cabinet, utilisateur, dossier, client).
 */
export function suggestVariableValues(
  variables: DocumentTemplateVariable[],
  ctx: TemplateFillContext
): Record<string, string> {
  const out: Record<string, string> = {};
  const today = new Date().toLocaleDateString("fr-FR");
  let adresseSeen = 0;

  for (const v of variables) {
    const l = norm(`${v.label} ${v.cle}`);
    let val = "";

    if (/reference|ref_dossier|dossier_ref/.test(l)) {
      val = ctx.dossier?.referenceInterne ?? "";
    } else if (/en_tete|entete/.test(l)) {
      val = ctx.cabinet?.raisonSociale ?? "";
    } else if (/nom_du_cabinet|cabinet|raison_sociale/.test(l)) {
      val = ctx.cabinet?.raisonSociale || "";
    } else if (/telephone|tel_/.test(l)) {
      val = ctx.cabinet?.telephone || clientTelephone(ctx.client);
    } else if (/email|e_mail|mail/.test(l)) {
      val = ctx.cabinet?.email ?? "";
    } else if (/site_web|siteweb|\bsite\b/.test(l)) {
      val = ctx.cabinet?.siteWeb ?? "";
    } else if (/ville/.test(l)) {
      // Extrait la ville depuis l'adresse du cabinet si possible
      const adr = ctx.cabinet?.adresse ?? "";
      const parts = adr.split(",").map((p) => p.trim()).filter(Boolean);
      val = parts.length > 1 ? parts[parts.length - 1] : "";
    } else if (v.cle === "date") {
      // Uniquement la date du courrier, pas les dates de séance (date_2…)
      val = today;
    } else if (/destinataire|adverse|votre_partie|votre_societe|partie/.test(l)) {
      val = firstJsonText(ctx.dossier?.partiesAdverses);
    } else if (/notre_client|votre_client|notre_societe|client/.test(l)) {
      val = ctx.client?.raisonSociale ?? "";
    } else if (/adresse/.test(l)) {
      // Première occurrence = adresse du cabinet (en-tête), les suivantes
      // (destinataire…) restent à saisir.
      adresseSeen += 1;
      val = adresseSeen === 1 ? ctx.cabinet?.adresse || ctx.client?.adresse || "" : "";
    } else if (/nom_et_prenom|prenom|signataire/.test(l)) {
      val = [ctx.user?.prenom, ctx.user?.nom].filter(Boolean).join(" ");
    } else if (/fonction|qualite/.test(l)) {
      // Ne pré-remplit que la fonction du signataire (pas celle du
      // destinataire) : libellé évoquant l'auteur du courrier.
      if (/avocat|directeur|juridique|associe|signataire|ex_/.test(l)) {
        val = ctx.user?.titre ?? "";
      }
    } else if (/objet|type_affaire|typeaffaire/.test(l)) {
      val = ctx.dossier?.typeAffaire ?? "";
    }

    if (val) out[v.cle] = val;
  }
  return out;
}
