/**
 * Génération de la présentation PowerPoint Avocat.sn
 * Design cinématographique, palette cabinet/gold, slides modernes.
 *
 * Usage : node scripts/generate-presentation.mjs
 * Sortie : presentation/Avocat.sn-Presentation.pptx
 */
const pptxgen = require("pptxgenjs");
const { join } = require("path");
const { mkdir } = require("fs/promises");

const pptx = new pptxgen();

// ── Configuration globale ──────────────────────────────────────────
pptx.defineLayout({ name: "WIDE", width: 13.333, height: 7.5 });
pptx.layout = "WIDE";
pptx.author = "Avocat.sn";
pptx.company = "Avocat.sn";
pptx.subject = "Plateforme de gestion juridique";
pptx.title = "Avocat.sn — Présentation de la plateforme";

// ── Palette ───────────────────────────────────────────────────────
const C = {
  cabinet950: "0F1B2E",
  cabinet900: "1A2E4C",
  cabinet800: "263F67",
  cabinet700: "2C4C7C",
  cabinet600: "385A8C",
  cabinet500: "4A6FA5",
  cabinet400: "7E9BBF",
  cabinet300: "A9BBD4",
  cabinet200: "CDD7E6",
  cabinet100: "E4E9F0",
  cabinet50:  "F5F7FA",
  gold400:    "E1A045",
  gold300:    "EABF73",
  gold500:    "C78124",
  white:      "FFFFFF",
  light:      "F8FAFC",
  emerald:    "059669",
  emeraldL:   "D1FAE5",
  purple:     "7C3AED",
  purpleL:    "EDE9FE",
  amber:      "D97706",
  amberL:     "FEF3C7",
  blue:       "2563EB",
  blueL:      "DBEAFE",
  rose:       "E11D48",
  roseL:      "FFE4E6",
  teal:       "0D9488",
  tealL:      "CCFBF1",
  cyan:       "0891B2",
  cyanL:      "CFFAFE",
  slate:      "475569",
  slateL:     "F1F5F9",
  grayText:   "64748B",
  grayMid:    "94A3B8",
};

// ── Helpers ───────────────────────────────────────────────────────
function darkBg(slide) {
  slide.background = { color: C.cabinet950 };
}
function lightBg(slide) {
  slide.background = { color: C.light };
}
function addAurora(slide) {
  // Cercles flous colorés pour l'effet aurora
  slide.addShape("ellipse", {
    x: -1.5, y: -1.5, w: 5.5, h: 5.5,
    fill: { color: C.cabinet600, transparency: 82 },
    line: { type: "none" },
  });
  slide.addShape("ellipse", {
    x: 9, y: 3.5, w: 5, h: 5,
    fill: { color: C.cabinet500, transparency: 85 },
    line: { type: "none" },
  });
  slide.addShape("ellipse", {
    x: 4, y: 1.5, w: 3, h: 3,
    fill: { color: C.gold400, transparency: 90 },
    line: { type: "none" },
  });
}
function addGridOverlay(slide) {
  // Lignes de grille subtiles
  for (let i = 0; i <= 13; i += 0.5) {
    slide.addShape("line", {
      x: i, y: 0, w: 0.01, h: 7.5,
      line: { color: C.white, width: 0.25, transparency: 94 },
    });
  }
  for (let j = 0; j <= 7.5; j += 0.5) {
    slide.addShape("line", {
      x: 0, y: j, w: 13.333, h: 0.01,
      line: { color: C.white, width: 0.25, transparency: 94 },
    });
  }
}
function sectionLabel(slide, text, color = C.gold300, x = 0.8, y = 0.6) {
  slide.addText(text.toUpperCase(), {
    x, y, w: 6, h: 0.4,
    fontFace: "Inter",
    fontSize: 11,
    bold: true,
    charSpacing: 3,
    color,
  });
}
function slideNumber(slide, n, total) {
  slide.addText(`${String(n).padStart(2, "0")} / ${String(total).padStart(2, "0")}`, {
    x: 11.5, y: 7.0, w: 1.5, h: 0.35,
    fontFace: "Inter", fontSize: 9, color: C.grayMid, align: "right",
  });
}
function footer(slide, dark = true) {
  const col = dark ? "5A6B85" : C.grayText;
  slide.addText("Avocat.sn  ·  Plateforme juridique — Sénégal", {
    x: 0.8, y: 7.0, w: 6, h: 0.35,
    fontFace: "Inter", fontSize: 9, color: col,
  });
}

const TOTAL = 14;

// ═══════════════════════════════════════════════════════════════════
// SLIDE 01 — Titre
// ═══════════════════════════════════════════════════════════════════
{
  const s = pptx.addSlide();
  darkBg(s);
  addAurora(s);
  addGridOverlay(s);

  // Badge
  s.addShape("roundRect", {
    x: 0.8, y: 1.2, w: 3.2, h: 0.45,
    rectRadius: 0.22,
    fill: { color: C.cabinet800, transparency: 40 },
    line: { color: C.gold400, width: 1, transparency: 30 },
  });
  s.addText("PLATEFORME JURIDIQUE  ·  SÉNÉGAL", {
    x: 0.8, y: 1.2, w: 3.2, h: 0.45,
    fontFace: "Inter", fontSize: 10, bold: true, charSpacing: 2,
    color: C.gold300, align: "center", valign: "middle",
  });

  // Titre principal
  s.addText("Le droit,", {
    x: 0.8, y: 2.0, w: 11, h: 1.3,
    fontFace: "Georgia", fontSize: 60, bold: true,
    color: C.white, charSpacing: -1,
  });
  s.addText("orchestré.", {
    x: 0.8, y: 3.1, w: 11, h: 1.3,
    fontFace: "Georgia", fontSize: 60, bold: true,
    color: C.gold400, charSpacing: -1,
  });

  // Sous-titre
  s.addText(
    "Avocat.sn réunit avocats, huissiers de justice, assistants juridiques et fonctions administratives dans un espace unique, sécurisé et souverain. Du dossier à la facture, chaque acte juridique devient un geste précis.",
    {
      x: 0.8, y: 4.5, w: 7.5, h: 1.2,
      fontFace: "Inter", fontSize: 15, color: C.cabinet300,
      lineSpacingMultiple: 1.4,
    }
  );

  // Ligne décorative
  s.addShape("line", {
    x: 0.8, y: 6.0, w: 2.0, h: 0,
    line: { color: C.gold400, width: 2.5 },
  });
  s.addText("Avocat.sn  ·  Présentation de la plateforme  ·  2026", {
    x: 0.8, y: 6.15, w: 8, h: 0.4,
    fontFace: "Inter", fontSize: 11, color: "5A6B85",
  });

  // Icône balance à droite
  s.addText("⚖", {
    x: 10.5, y: 2.3, w: 2.3, h: 2.3,
    fontSize: 80, color: C.gold400, align: "center", valign: "middle",
    transparency: 30,
  });
}

// ═══════════════════════════════════════════════════════════════════
// SLIDE 02 — Vision / Problématique
// ═══════════════════════════════════════════════════════════════════
{
  const s = pptx.addSlide();
  darkBg(s);
  addAurora(s);
  sectionLabel(s, "La vision");
  footer(s); slideNumber(s, 2, TOTAL);

  s.addText("Une plateforme collaborative pour les professionnels du droit au Sénégal.", {
    x: 0.8, y: 1.2, w: 11.5, h: 1.5,
    fontFace: "Georgia", fontSize: 36, bold: true,
    color: C.white, lineSpacingMultiple: 1.1,
  });

  s.addText(
    "Concevoir et développer une plateforme web collaborative de gestion des dossiers, procédures, actes, documents, échéances et facturation pour un cabinet regroupant avocats, huissiers de justice, assistants juridiques et fonctions administratives.",
    {
      x: 0.8, y: 3.0, w: 7.0, h: 1.8,
      fontFace: "Inter", fontSize: 14, color: C.cabinet300,
      lineSpacingMultiple: 1.5,
    }
  );

  // Cartes défi à droite
  const defis = [
    { t: "Dossiers éparpillés", d: "Excel, papier, e-mails — le suivi se perd." },
    { t: "Sécurité du secret professionnel", d: "Aucun outil adapté aux exigences du barreau." },
    { t: "Collaboration complexe", d: "Avocats, huissiers, clients — chacun dans son coin." },
  ];
  defis.forEach((d, i) => {
    const y = 3.0 + i * 1.25;
    s.addShape("roundRect", {
      x: 8.3, y, w: 4.3, h: 1.05,
      rectRadius: 0.12,
      fill: { color: C.cabinet800, transparency: 55 },
      line: { color: C.cabinet600, width: 1, transparency: 40 },
    });
    s.addText(d.t, {
      x: 8.5, y: y + 0.12, w: 4.0, h: 0.4,
      fontFace: "Inter", fontSize: 13, bold: true, color: C.gold300,
    });
    s.addText(d.d, {
      x: 8.5, y: y + 0.5, w: 4.0, h: 0.5,
      fontFace: "Inter", fontSize: 11, color: C.cabinet300,
    });
  });
}

// ═══════════════════════════════════════════════════════════════════
// SLIDE 03 — Chiffres clés
// ═══════════════════════════════════════════════════════════════════
{
  const s = pptx.addSlide();
  lightBg(s);
  sectionLabel(s, "En chiffres", C.cabinet600);
  footer(s, false); slideNumber(s, 3, TOTAL);

  s.addText("Une plateforme complète, mesurable.", {
    x: 0.8, y: 1.1, w: 11.5, h: 0.9,
    fontFace: "Georgia", fontSize: 32, bold: true, color: C.cabinet900,
  });

  const stats = [
    { v: "13", l: "Modules métier", c: C.cabinet700 },
    { v: "20+", l: "Statuts de dossier", c: C.emerald },
    { v: "14", l: "Types d'affaire", c: C.gold500 },
    { v: "11", l: "Rôles & profils", c: C.purple },
    { v: "AES-256", l: "Chiffrement", c: C.cyan },
    { v: "100%", l: "Conformité CDP", c: C.rose },
  ];
  stats.forEach((st, i) => {
    const x = 0.8 + i * 2.02;
    s.addShape("roundRect", {
      x, y: 2.6, w: 1.85, h: 2.6,
      rectRadius: 0.15,
      fill: { color: C.white },
      line: { color: C.cabinet200, width: 1 },
      shadow: { type: "outer", color: "000000", blur: 6, offset: 2, angle: 90, opacity: 0.08 },
    });
    s.addText(st.v, {
      x, y: 2.9, w: 1.85, h: 1.1,
      fontFace: "Georgia", fontSize: 38, bold: true, color: st.c, align: "center",
    });
    s.addText(st.l, {
      x, y: 4.1, w: 1.85, h: 0.8,
      fontFace: "Inter", fontSize: 12, color: C.grayText, align: "center",
      lineSpacingMultiple: 1.2,
    });
  });

  s.addText("Chaque dimension de la pratique juridique est couverte — sans tableur, sans rupture.", {
    x: 0.8, y: 5.6, w: 11.5, h: 0.6,
    fontFace: "Inter", fontSize: 14, italic: true, color: C.cabinet600, align: "center",
  });
}

// ═══════════════════════════════════════════════════════════════════
// SLIDE 04 — Modules (vue d'ensemble)
// ═══════════════════════════════════════════════════════════════════
{
  const s = pptx.addSlide();
  lightBg(s);
  sectionLabel(s, "Modules", C.cabinet600);
  footer(s, false); slideNumber(s, 4, TOTAL);

  s.addText("Treize modules. Une seule plateforme.", {
    x: 0.8, y: 1.1, w: 11.5, h: 0.9,
    fontFace: "Georgia", fontSize: 32, bold: true, color: C.cabinet900,
  });

  const mods = [
    { t: "Dossiers", d: "Workflow & statuts", c: C.cabinet700, bg: C.cabinet100 },
    { t: "Clients", d: "Parties & conflits", c: C.emerald, bg: C.emeraldL },
    { t: "Documents", d: "OCR & versions", c: C.amber, bg: C.amberL },
    { t: "Tâches", d: "Checklists & échéances", c: C.blue, bg: C.blueL },
    { t: "Missions Huissier", d: "Significations & PV", c: C.purple, bg: C.purpleL },
    { t: "Facturation", d: "Devis & relances", c: C.rose, bg: C.roseL },
    { t: "Comptabilité OHADA", d: "CR · SIG · Bilan", c: C.teal, bg: C.tealL },
    { t: "Charges & Immo.", d: "Amortissements", c: "4F46E5", bg: "E0E7FF" },
    { t: "Calendrier", d: "Audiences & RDV", c: "EA580C", bg: "FFEDD5" },
    { t: "Espace Client", d: "Portail sécurisé", c: C.cyan, bg: C.cyanL },
    { t: "Personnel", d: "Rôles & RBAC", c: C.slate, bg: C.slateL },
    { t: "Paramétrage", d: "Spécialités & thèmes", c: "C026D3", bg: "FAE8FF" },
    { t: "Alertes", d: "Notifications", c: "DC2626", bg: "FEE2E2" },
  ];
  mods.forEach((m, i) => {
    const col = i % 7;
    const row = Math.floor(i / 7);
    const x = 0.8 + col * 1.72;
    const y = 2.4 + row * 2.1;
    s.addShape("roundRect", {
      x, y, w: 1.6, h: 1.9,
      rectRadius: 0.12,
      fill: { color: m.bg },
      line: { type: "none" },
      shadow: { type: "outer", color: "000000", blur: 4, offset: 1, angle: 90, opacity: 0.06 },
    });
    s.addShape("roundRect", {
      x: x + 0.15, y: y + 0.2, w: 0.5, h: 0.5,
      rectRadius: 0.1,
      fill: { color: m.c },
      line: { type: "none" },
    });
    s.addText(m.t, {
      x: x + 0.1, y: y + 0.85, w: 1.4, h: 0.5,
      fontFace: "Inter", fontSize: 12, bold: true, color: C.cabinet900,
      lineSpacingMultiple: 1.0,
    });
    s.addText(m.d, {
      x: x + 0.1, y: y + 1.3, w: 1.4, h: 0.5,
      fontFace: "Inter", fontSize: 9.5, color: C.grayText,
      lineSpacingMultiple: 1.1,
    });
  });
}

// ═══════════════════════════════════════════════════════════════════
// SLIDE 05 — Module Dossiers (focus)
// ═══════════════════════════════════════════════════════════════════
{
  const s = pptx.addSlide();
  darkBg(s);
  addAurora(s);
  sectionLabel(s, "Module en focus");
  footer(s); slideNumber(s, 5, TOTAL);

  s.addText("Dossiers maîtrisés", {
    x: 0.8, y: 1.1, w: 7, h: 1,
    fontFace: "Georgia", fontSize: 38, bold: true, color: C.white,
  });
  s.addText("Suivi complet des affaires, workflow de validation, statuts et historique immuable pour ne jamais perdre le fil.", {
    x: 0.8, y: 2.1, w: 6.5, h: 1.2,
    fontFace: "Inter", fontSize: 14, color: C.cabinet300, lineSpacingMultiple: 1.5,
  });

  // Liste de fonctionnalités
  const feats = [
    "20+ statuts de dossier (Prospect → Archivé)",
    "Types d'affaire : contentieux, foncier, recouvrement, bail…",
    "Matrice RACI : responsable, collaborateurs, huissier",
    "Spécialités du cabinet sélectionnables",
    "Fiche immobilière (titre foncier, bien, propriétaire)",
    "Historisation systématique dans le journal d'audit",
  ];
  feats.forEach((f, i) => {
    const y = 3.5 + i * 0.5;
    s.addShape("ellipse", {
      x: 0.85, y: y + 0.07, w: 0.18, h: 0.18,
      fill: { color: C.gold400 }, line: { type: "none" },
    });
    s.addText(f, {
      x: 1.2, y, w: 6.3, h: 0.4,
      fontFace: "Inter", fontSize: 12.5, color: C.cabinet200,
    });
  });

  // Carte visuelle à droite — mockup dossier
  s.addShape("roundRect", {
    x: 8.0, y: 1.5, w: 4.7, h: 5.2,
    rectRadius: 0.15,
    fill: { color: C.cabinet800, transparency: 50 },
    line: { color: C.cabinet600, width: 1, transparency: 30 },
  });
  s.addText("DOSSIER N° 2026-0142", {
    x: 8.2, y: 1.7, w: 4.3, h: 0.4,
    fontFace: "Inter", fontSize: 10, bold: true, charSpacing: 2, color: C.gold300,
  });
  s.addText("Contentieux immobilier — Dakar", {
    x: 8.2, y: 2.15, w: 4.3, h: 0.5,
    fontFace: "Georgia", fontSize: 18, bold: true, color: C.white,
  });
  // Badge statut
  s.addShape("roundRect", {
    x: 8.2, y: 2.8, w: 1.8, h: 0.4,
    rectRadius: 0.2,
    fill: { color: C.emerald, transparency: 60 },
    line: { color: C.emerald, width: 1 },
  });
  s.addText("● En cours d'analyse", {
    x: 8.2, y: 2.8, w: 1.8, h: 0.4,
    fontFace: "Inter", fontSize: 10, bold: true, color: C.emeraldL, align: "center", valign: "middle",
  });
  // Timeline verticale
  const steps = ["Ouverture", "Constitution", "Analyse", "Rédaction", "Audience"];
  steps.forEach((st, i) => {
    const y = 3.5 + i * 0.6;
    const done = i <= 2;
    s.addShape("ellipse", {
      x: 8.3, y: y + 0.05, w: 0.22, h: 0.22,
      fill: { color: done ? C.gold400 : C.cabinet700 },
      line: { color: done ? C.gold400 : C.cabinet600, width: 1 },
    });
    s.addText(st, {
      x: 8.65, y, w: 3.5, h: 0.35,
      fontFace: "Inter", fontSize: 12,
      color: done ? C.white : "5A6B85",
      bold: done,
    });
    if (i < steps.length - 1) {
      s.addShape("line", {
        x: 8.41, y: y + 0.27, w: 0, h: 0.35,
        line: { color: done ? C.gold400 : C.cabinet700, width: 1.5 },
      });
    }
  });
}

// ═══════════════════════════════════════════════════════════════════
// SLIDE 06 — Module Documents & Espace Client
// ═══════════════════════════════════════════════════════════════════
{
  const s = pptx.addSlide();
  lightBg(s);
  sectionLabel(s, "Module en focus", C.cabinet600);
  footer(s, false); slideNumber(s, 6, TOTAL);

  s.addText("Documents inviolables & espace client", {
    x: 0.8, y: 1.1, w: 11.5, h: 0.9,
    fontFace: "Georgia", fontSize: 30, bold: true, color: C.cabinet900,
  });

  // Colonne Documents
  s.addShape("roundRect", {
    x: 0.8, y: 2.3, w: 5.7, h: 4.4,
    rectRadius: 0.15,
    fill: { color: C.white },
    line: { color: C.cabinet200, width: 1 },
    shadow: { type: "outer", color: "000000", blur: 6, offset: 2, angle: 90, opacity: 0.06 },
  });
  s.addShape("roundRect", {
    x: 1.0, y: 2.5, w: 0.6, h: 0.6,
    rectRadius: 0.12,
    fill: { color: C.amber }, line: { type: "none" },
  });
  s.addText("📄", {
    x: 1.0, y: 2.5, w: 0.6, h: 0.6, fontSize: 22, align: "center", valign: "middle",
  });
  s.addText("Gestion documentaire", {
    x: 1.75, y: 2.55, w: 4.5, h: 0.5,
    fontFace: "Inter", fontSize: 16, bold: true, color: C.cabinet900,
  });
  const docFeats = [
    "Chiffrement AES-256 côté client avant upload",
    "Catégorisation par type (contrat, bail, titre foncier…)",
    "Versionnement et restauration des versions",
    "Prévisualisation PDF et images intégrée",
    "OCR et recherche plein texte (Tesseract.js)",
    "Partage externe avec intervenants du dossier",
    "Publication sécurisée vers l'espace client",
  ];
  docFeats.forEach((f, i) => {
    const y = 3.3 + i * 0.45;
    s.addText("✓", {
      x: 1.05, y, w: 0.35, h: 0.35,
      fontFace: "Inter", fontSize: 13, bold: true, color: C.emerald,
    });
    s.addText(f, {
      x: 1.45, y, w: 4.8, h: 0.35,
      fontFace: "Inter", fontSize: 11.5, color: C.cabinet700,
    });
  });

  // Colonne Espace Client
  s.addShape("roundRect", {
    x: 6.8, y: 2.3, w: 5.7, h: 4.4,
    rectRadius: 0.15,
    fill: { color: C.white },
    line: { color: C.cabinet200, width: 1 },
    shadow: { type: "outer", color: "000000", blur: 6, offset: 2, angle: 90, opacity: 0.06 },
  });
  s.addShape("roundRect", {
    x: 7.0, y: 2.5, w: 0.6, h: 0.6,
    rectRadius: 0.12,
    fill: { color: C.cyan }, line: { type: "none" },
  });
  s.addText("👤", {
    x: 7.0, y: 2.5, w: 0.6, h: 0.6, fontSize: 22, align: "center", valign: "middle",
  });
  s.addText("Espace client sécurisé", {
    x: 7.75, y: 2.55, w: 4.5, h: 0.5,
    fontFace: "Inter", fontSize: 16, bold: true, color: C.cabinet900,
  });
  const clientFeats = [
    "Consultation de l'état général des dossiers",
    "Dépôt et téléchargement de documents",
    "Visibilité limitée aux documents publiés (publieClient)",
    "Factures et solde visibles par le client principal",
    "Accès via /api/documents/[id]/download sécurisé",
    "Middleware isole les sessions client",
    "Aucun e-mail non sécurisé — tout passe par la plateforme",
  ];
  clientFeats.forEach((f, i) => {
    const y = 3.3 + i * 0.45;
    s.addText("✓", {
      x: 7.05, y, w: 0.35, h: 0.35,
      fontFace: "Inter", fontSize: 13, bold: true, color: C.cyan,
    });
    s.addText(f, {
      x: 7.45, y, w: 4.8, h: 0.35,
      fontFace: "Inter", fontSize: 11.5, color: C.cabinet700,
    });
  });
}

// ═══════════════════════════════════════════════════════════════════
// SLIDE 07 — Module Huissier & Facturation
// ═══════════════════════════════════════════════════════════════════
{
  const s = pptx.addSlide();
  darkBg(s);
  addAurora(s);
  sectionLabel(s, "Module en focus");
  footer(s); slideNumber(s, 7, TOTAL);

  s.addText("Huissier & Facturation", {
    x: 0.8, y: 1.1, w: 11, h: 0.9,
    fontFace: "Georgia", fontSize: 34, bold: true, color: C.white,
  });

  // Carte Huissier
  s.addShape("roundRect", {
    x: 0.8, y: 2.3, w: 5.7, h: 4.4,
    rectRadius: 0.15,
    fill: { color: C.cabinet800, transparency: 50 },
    line: { color: C.purple, width: 1, transparency: 30 },
  });
  s.addShape("roundRect", {
    x: 1.0, y: 2.5, w: 0.6, h: 0.6, rectRadius: 0.12,
    fill: { color: C.purple }, line: { type: "none" },
  });
  s.addText("⚖", {
    x: 1.0, y: 2.5, w: 0.6, h: 0.6, fontSize: 24, align: "center", valign: "middle",
  });
  s.addText("Missions d'huissier", {
    x: 1.75, y: 2.55, w: 4.5, h: 0.5,
    fontFace: "Inter", fontSize: 16, bold: true, color: C.white,
  });
  const huissierFeats = [
    "Significations et actes de sommation",
    "Constats et procès-verbaux",
    "Saisies et mesures d'exécution",
    "Suivi des frais de débours",
    "Retour de mission (PV / preuve de remise)",
    "Affectation automatique des tâches",
  ];
  huissierFeats.forEach((f, i) => {
    const y = 3.3 + i * 0.5;
    s.addShape("ellipse", {
      x: 1.05, y: y + 0.08, w: 0.16, h: 0.16,
      fill: { color: C.purple }, line: { type: "none" },
    });
    s.addText(f, {
      x: 1.35, y, w: 4.8, h: 0.4,
      fontFace: "Inter", fontSize: 12, color: C.cabinet200,
    });
  });

  // Carte Facturation
  s.addShape("roundRect", {
    x: 6.8, y: 2.3, w: 5.7, h: 4.4,
    rectRadius: 0.15,
    fill: { color: C.cabinet800, transparency: 50 },
    line: { color: C.rose, width: 1, transparency: 30 },
  });
  s.addShape("roundRect", {
    x: 7.0, y: 2.5, w: 0.6, h: 0.6, rectRadius: 0.12,
    fill: { color: C.rose }, line: { type: "none" },
  });
  s.addText("💳", {
    x: 7.0, y: 2.5, w: 0.6, h: 0.6, fontSize: 22, align: "center", valign: "middle",
  });
  s.addText("Facturation", {
    x: 7.75, y: 2.55, w: 4.5, h: 0.5,
    fontFace: "Inter", fontSize: 16, bold: true, color: C.white,
  });
  const factFeats = [
    "Lettres de mission & devis",
    "Factures PDF avec en-tête cabinet",
    "Provisions et paiements",
    "Relances automatiques",
    "Situation financière client",
    "Comptabilité OHADA intégrée",
  ];
  factFeats.forEach((f, i) => {
    const y = 3.3 + i * 0.5;
    s.addShape("ellipse", {
      x: 7.05, y: y + 0.08, w: 0.16, h: 0.16,
      fill: { color: C.rose }, line: { type: "none" },
    });
    s.addText(f, {
      x: 7.35, y, w: 4.8, h: 0.4,
      fontFace: "Inter", fontSize: 12, color: C.cabinet200,
    });
  });
}

// ═══════════════════════════════════════════════════════════════════
// SLIDE 08 — Comptabilité OHADA
// ═══════════════════════════════════════════════════════════════════
{
  const s = pptx.addSlide();
  lightBg(s);
  sectionLabel(s, "Module en focus", C.cabinet600);
  footer(s, false); slideNumber(s, 8, TOTAL);

  s.addText("Comptabilité OHADA intégrée", {
    x: 0.8, y: 1.1, w: 11, h: 0.9,
    fontFace: "Georgia", fontSize: 32, bold: true, color: C.cabinet900,
  });
  s.addText("Du compte de résultat au bilan, avec les SIG et les flux de trésorerie — sur la période choisie.", {
    x: 0.8, y: 2.0, w: 11, h: 0.6,
    fontFace: "Inter", fontSize: 14, color: C.cabinet600,
  });

  // Tableau synthétique CR
  s.addShape("roundRect", {
    x: 0.8, y: 2.8, w: 5.8, h: 3.8,
    rectRadius: 0.12,
    fill: { color: C.white },
    line: { color: C.cabinet200, width: 1 },
    shadow: { type: "outer", color: "000000", blur: 4, offset: 1, angle: 90, opacity: 0.06 },
  });
  s.addText("Compte de résultat (extrait)", {
    x: 1.0, y: 2.95, w: 5.4, h: 0.4,
    fontFace: "Inter", fontSize: 13, bold: true, color: C.cabinet900,
  });
  const crRows = [
    ["Produits d'exploitation", "12 450 000", C.emerald],
    ["Charges d'exploitation", "8 200 000", C.rose],
    ["Résultat d'exploitation", "4 250 000", C.cabinet700],
    ["Résultat net", "3 180 000", C.gold500],
  ];
  crRows.forEach((r, i) => {
    const y = 3.5 + i * 0.65;
    const bold = i >= 2;
    s.addText(r[0], {
      x: 1.0, y, w: 3.5, h: 0.45,
      fontFace: "Inter", fontSize: 12, bold, color: C.cabinet800,
    });
    s.addText(r[1] + " FCFA", {
      x: 4.5, y, w: 2.0, h: 0.45,
      fontFace: "Inter", fontSize: 12, bold, color: r[2], align: "right",
    });
    if (i < crRows.length - 1) {
      s.addShape("line", {
        x: 1.0, y: y + 0.55, w: 5.4, h: 0,
        line: { color: C.cabinet100, width: 1 },
      });
    }
  });

  // Cartes indicateurs à droite
  const indicators = [
    { t: "SIG", d: "Soldes intermédiaires de gestion", v: "9 niveaux", c: C.teal },
    { t: "Bilan", d: "Photo au dernier jour de la période", v: "Actif = Passif", c: C.cabinet700 },
    { t: "Flux", d: "Tableau de trésorerie OHADA", v: "3 flux", c: C.purple },
    { t: "Dotations", d: "Amortissements linéaires mensuels", v: "Auto", c: C.amber },
  ];
  indicators.forEach((ind, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 6.9 + col * 2.85;
    const y = 2.8 + row * 1.9;
    s.addShape("roundRect", {
      x, y, w: 2.65, h: 1.7,
      rectRadius: 0.12,
      fill: { color: C.white },
      line: { color: C.cabinet200, width: 1 },
      shadow: { type: "outer", color: "000000", blur: 4, offset: 1, angle: 90, opacity: 0.06 },
    });
    s.addShape("roundRect", {
      x: x + 0.15, y: y + 0.15, w: 0.45, h: 0.45, rectRadius: 0.1,
      fill: { color: ind.c }, line: { type: "none" },
    });
    s.addText(ind.t, {
      x: x + 0.7, y: y + 0.15, w: 1.8, h: 0.4,
      fontFace: "Inter", fontSize: 14, bold: true, color: C.cabinet900,
    });
    s.addText(ind.d, {
      x: x + 0.15, y: y + 0.7, w: 2.4, h: 0.5,
      fontFace: "Inter", fontSize: 10, color: C.grayText, lineSpacingMultiple: 1.2,
    });
    s.addText(ind.v, {
      x: x + 0.15, y: y + 1.2, w: 2.4, h: 0.4,
      fontFace: "Inter", fontSize: 13, bold: true, color: ind.c,
    });
  });
}

// ═══════════════════════════════════════════════════════════════════
// SLIDE 09 — Workflow / Parcours
// ═══════════════════════════════════════════════════════════════════
{
  const s = pptx.addSlide();
  darkBg(s);
  addAurora(s);
  sectionLabel(s, "Le parcours");
  footer(s); slideNumber(s, 9, TOTAL);

  s.addText("Du conflit à la décision, sans perdre le fil.", {
    x: 0.8, y: 1.1, w: 11.5, h: 0.9,
    fontFace: "Georgia", fontSize: 30, bold: true, color: C.white,
  });

  const steps = [
    { n: "01", t: "Ouverture", d: "Client, type d'affaire,\nparties, conflits", c: C.cabinet400 },
    { n: "02", t: "Constitution", d: "Dépôt pièces, OCR,\ndocs attendus", c: C.gold400 },
    { n: "03", t: "Travail", d: "Tâches auto, rédaction,\nvalidation", c: C.emerald },
    { n: "04", t: "Huissier", d: "Significations, constats,\nsaisies, frais", c: C.purple },
    { n: "05", t: "Audiences", d: "Calendrier, échéances,\ndealines", c: "EA580C" },
    { n: "06", t: "Clôture", d: "Factures, écritures,\narchivage", c: C.rose },
  ];
  const cardW = 1.85;
  const gap = 0.18;
  const startX = 0.8;
  steps.forEach((st, i) => {
    const x = startX + i * (cardW + gap);
    // Carte
    s.addShape("roundRect", {
      x, y: 2.6, w: cardW, h: 3.5,
      rectRadius: 0.15,
      fill: { color: C.cabinet800, transparency: 55 },
      line: { color: st.c, width: 1, transparency: 30 },
    });
    // Numéro
    s.addText(st.n, {
      x: x + 0.15, y: 2.8, w: 1.5, h: 0.8,
      fontFace: "Georgia", fontSize: 36, bold: true, color: "FFFFFF", transparency: 75,
    });
    // Point coloré
    s.addShape("ellipse", {
      x: x + 0.15, y: 3.7, w: 0.3, h: 0.3,
      fill: { color: st.c }, line: { type: "none" },
    });
    // Titre
    s.addText(st.t, {
      x: x + 0.15, y: 4.1, w: cardW - 0.3, h: 0.5,
      fontFace: "Inter", fontSize: 15, bold: true, color: C.white,
    });
    // Desc
    s.addText(st.d, {
      x: x + 0.15, y: 4.65, w: cardW - 0.3, h: 1.2,
      fontFace: "Inter", fontSize: 11, color: C.cabinet300, lineSpacingMultiple: 1.3,
    });
    // Flèche entre cartes
    if (i < steps.length - 1) {
      s.addText("→", {
        x: x + cardW - 0.05, y: 4.0, w: gap + 0.1, h: 0.5,
        fontSize: 18, color: st.c, align: "center", valign: "middle", bold: true,
      });
    }
  });
}

// ═══════════════════════════════════════════════════════════════════
// SLIDE 10 — Rôles & Permissions
// ═══════════════════════════════════════════════════════════════════
{
  const s = pptx.addSlide();
  lightBg(s);
  sectionLabel(s, "Rôles & permissions", C.cabinet600);
  footer(s, false); slideNumber(s, 10, TOTAL);

  s.addText("Chacun voit ce qu'il doit voir.", {
    x: 0.8, y: 1.1, w: 11.5, h: 0.9,
    fontFace: "Georgia", fontSize: 32, bold: true, color: C.cabinet900,
  });
  s.addText("Un contrôle d'accès granulaire (RBAC) par rôle, par dossier et par document.", {
    x: 0.8, y: 2.0, w: 11, h: 0.5,
    fontFace: "Inter", fontSize: 14, color: C.cabinet600,
  });

  const roles = [
    { t: "Avocat responsable", d: "Pilote, valide, supervise", c: C.cabinet700, perms: ["dossiers:write", "actes:validate"] },
    { t: "Huissier de justice", d: "Missions, frais, PV", c: C.purple, perms: ["missions:write", "frais:write"] },
    { t: "Assistant juridique", d: "Prépare, rédige, gère", c: C.emerald, perms: ["actes:write", "documents:write"] },
    { t: "Comptable", d: "OHADA, écritures, rapports", c: C.teal, perms: ["comptabilite:write"] },
    { t: "Secrétaire", d: "Clients, RDV, contacts", c: C.amber, perms: ["clients:write", "evenements:write"] },
    { t: "Client", d: "Consulte, échange, paie", c: C.cyan, perms: ["dossiers:read", "documents:download"] },
  ];
  roles.forEach((r, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = 0.8 + col * 4.05;
    const y = 2.7 + row * 2.15;
    s.addShape("roundRect", {
      x, y, w: 3.85, h: 1.95,
      rectRadius: 0.12,
      fill: { color: C.white },
      line: { color: C.cabinet200, width: 1 },
      shadow: { type: "outer", color: "000000", blur: 5, offset: 2, angle: 90, opacity: 0.07 },
    });
    s.addShape("roundRect", {
      x: x + 0.2, y: y + 0.2, w: 0.55, h: 0.55, rectRadius: 0.1,
      fill: { color: r.c }, line: { type: "none" },
    });
    s.addText(r.t, {
      x: x + 0.9, y: y + 0.2, w: 2.8, h: 0.4,
      fontFace: "Inter", fontSize: 14, bold: true, color: C.cabinet900,
    });
    s.addText(r.d, {
      x: x + 0.9, y: y + 0.6, w: 2.8, h: 0.35,
      fontFace: "Inter", fontSize: 11, color: C.grayText,
    });
    r.perms.forEach((p, j) => {
      s.addText("🔑 " + p, {
        x: x + 0.2, y: y + 1.15 + j * 0.35, w: 3.5, h: 0.3,
        fontFace: "Consolas", fontSize: 10, color: r.c,
      });
    });
  });
}

// ═══════════════════════════════════════════════════════════════════
// SLIDE 11 — Sécurité & Souveraineté
// ═══════════════════════════════════════════════════════════════════
{
  const s = pptx.addSlide();
  darkBg(s);
  addAurora(s);
  sectionLabel(s, "Sécurité & souveraineté");
  footer(s); slideNumber(s, 11, TOTAL);

  s.addText("La confiance, par conception.", {
    x: 0.8, y: 1.1, w: 11, h: 0.9,
    fontFace: "Georgia", fontSize: 34, bold: true, color: C.white,
  });
  s.addText("Chaque couche de la plateforme est pensée pour protéger le secret professionnel. Vos données restent sous votre contrôle.", {
    x: 0.8, y: 2.0, w: 11, h: 0.7,
    fontFace: "Inter", fontSize: 14, color: C.cabinet300, lineSpacingMultiple: 1.4,
  });

  const sec = [
    { v: "AES-256", t: "Chiffrement", d: "Au repos et en transit. Documents chiffrés côté client." },
    { v: "CDP", t: "Conformité Sénégal", d: "Aligné sur la Commission de Protection des Données." },
    { v: "MFA", t: "Authentification", d: "TOTP et second facteur. Codes de secours." },
    { v: "TLS 1.3", t: "Transport", d: "Canaux chiffrés pour toutes les communications." },
    { v: "Audit", t: "Journal immuable", d: "Traçabilité : dossiers, documents, factures, paiements." },
    { v: "Multi-tenant", t: "Isolation", d: "Schéma PostgreSQL dédié par cabinet. Zéro fuite." },
  ];
  sec.forEach((item, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = 0.8 + col * 4.05;
    const y = 3.0 + row * 1.95;
    s.addShape("roundRect", {
      x, y, w: 3.85, h: 1.75,
      rectRadius: 0.12,
      fill: { color: C.cabinet800, transparency: 55 },
      line: { color: C.cabinet600, width: 1, transparency: 40 },
    });
    s.addText(item.v, {
      x: x + 0.2, y: y + 0.2, w: 3.5, h: 0.6,
      fontFace: "Georgia", fontSize: 24, bold: true, color: C.gold300,
    });
    s.addText(item.t, {
      x: x + 0.2, y: y + 0.8, w: 3.5, h: 0.35,
      fontFace: "Inter", fontSize: 13, bold: true, color: C.white,
    });
    s.addText(item.d, {
      x: x + 0.2, y: y + 1.15, w: 3.5, h: 0.5,
      fontFace: "Inter", fontSize: 10.5, color: C.cabinet300, lineSpacingMultiple: 1.3,
    });
  });
}

// ═══════════════════════════════════════════════════════════════════
// SLIDE 12 — Stack technique
// ═══════════════════════════════════════════════════════════════════
{
  const s = pptx.addSlide();
  lightBg(s);
  sectionLabel(s, "Architecture", C.cabinet600);
  footer(s, false); slideNumber(s, 12, TOTAL);

  s.addText("Une stack moderne, pensée pour durer.", {
    x: 0.8, y: 1.1, w: 11.5, h: 0.9,
    fontFace: "Georgia", fontSize: 32, bold: true, color: C.cabinet900,
  });

  const techs = [
    { n: "Next.js 14", c: "App Router, RSC", col: C.slate },
    { n: "React 18", c: "Server Components", col: C.cyan },
    { n: "TypeScript", c: "Typage strict", col: C.blue },
    { n: "Tailwind CSS", c: "Design system", col: C.teal },
    { n: "Prisma ORM", c: "Accès typé, migrations", col: C.purple },
    { n: "PostgreSQL", c: "Multi-tenant", col: C.blue },
    { n: "Argon2id", c: "Hachage mots de passe", col: C.emerald },
    { n: "Iron Session", c: "Sessions chiffrées", col: C.amber },
    { n: "TOTP / MFA", c: "Second facteur", col: C.rose },
    { n: "pdf-lib", c: "Génération PDF légale", col: "DC2626" },
    { n: "Tesseract.js", c: "OCR", col: C.purple },
    { n: "Meilisearch", c: "Recherche plein texte", col: "DB2777" },
    { n: "AWS S3 / MinIO", c: "Stockage chiffré", col: C.amber },
    { n: "Redis", c: "Cache & files", col: "DC2626" },
  ];
  techs.forEach((t, i) => {
    const col = i % 7;
    const row = Math.floor(i / 7);
    const x = 0.8 + col * 1.72;
    const y = 2.5 + row * 2.1;
    s.addShape("roundRect", {
      x, y, w: 1.6, h: 1.9,
      rectRadius: 0.12,
      fill: { color: C.white },
      line: { color: C.cabinet200, width: 1 },
      shadow: { type: "outer", color: "000000", blur: 4, offset: 1, angle: 90, opacity: 0.06 },
    });
    s.addShape("roundRect", {
      x: x + 0.15, y: y + 0.2, w: 0.55, h: 0.55, rectRadius: 0.1,
      fill: { color: t.col }, line: { type: "none" },
    });
    s.addText(t.n.charAt(0), {
      x: x + 0.15, y: y + 0.2, w: 0.55, h: 0.55,
      fontFace: "Georgia", fontSize: 20, bold: true, color: C.white, align: "center", valign: "middle",
    });
    s.addText(t.n, {
      x: x + 0.1, y: y + 0.85, w: 1.4, h: 0.5,
      fontFace: "Inter", fontSize: 12, bold: true, color: C.cabinet900, lineSpacingMultiple: 1.0,
    });
    s.addText(t.c, {
      x: x + 0.1, y: y + 1.3, w: 1.4, h: 0.5,
      fontFace: "Inter", fontSize: 9.5, color: C.grayText, lineSpacingMultiple: 1.1,
    });
  });
}

// ═══════════════════════════════════════════════════════════════════
// SLIDE 13 — Roadmap / Phases
// ═══════════════════════════════════════════════════════════════════
{
  const s = pptx.addSlide();
  darkBg(s);
  addAurora(s);
  sectionLabel(s, "Roadmap");
  footer(s); slideNumber(s, 13, TOTAL);

  s.addText("Du socle à l'industrialisation.", {
    x: 0.8, y: 1.1, w: 11, h: 0.9,
    fontFace: "Georgia", fontSize: 32, bold: true, color: C.white,
  });

  const phases = [
    { n: "P0", t: "Fondation", d: "Architecture, stack, maquettes, conformité CDP", dur: "2 sem.", c: C.cabinet400 },
    { n: "P1", t: "Socle sécurisé", d: "Utilisateurs, rôles, cabinets, clients, dossiers, documents, audit", dur: "6 sem.", c: C.cabinet500 },
    { n: "P2", t: "Travail juridique", d: "Tâches, échéances, audiences, workflow, modèles d'actes, espace client", dur: "5 sem.", c: C.emerald },
    { n: "P3", t: "Huissier", d: "Missions, significations, constats, PV, saisies, frais, retours", dur: "4 sem.", c: C.purple },
    { n: "P4", t: "Financière", d: "Lettres de mission, devis, factures, provisions, paiements, relances", dur: "4 sem.", c: C.rose },
    { n: "P5", t: "Industrialisation", d: "Recherche plein texte, OCR, signature, PWA, API, dashboards", dur: "6 sem.", c: C.gold400 },
  ];
  // Timeline horizontale
  const barY = 4.2;
  s.addShape("line", {
    x: 0.8, y: barY, w: 11.7, h: 0,
    line: { color: C.cabinet700, width: 2 },
  });
  phases.forEach((p, i) => {
    const x = 0.8 + i * 1.95;
    // Point
    s.addShape("ellipse", {
      x: x + 0.7, y: barY - 0.15, w: 0.3, h: 0.3,
      fill: { color: p.c }, line: { color: C.cabinet950, width: 2 },
    });
    // Carte au-dessus (alternance haut/bas)
    const above = i % 2 === 0;
    const cardY = above ? 2.3 : 4.7;
    s.addShape("roundRect", {
      x: x, y: cardY, w: 1.8, h: 1.6,
      rectRadius: 0.1,
      fill: { color: C.cabinet800, transparency: 55 },
      line: { color: p.c, width: 1, transparency: 30 },
    });
    s.addText(p.n, {
      x: x + 0.1, y: cardY + 0.1, w: 0.6, h: 0.35,
      fontFace: "Inter", fontSize: 11, bold: true, color: p.c,
    });
    s.addText(p.dur, {
      x: x + 1.2, y: cardY + 0.1, w: 0.55, h: 0.35,
      fontFace: "Inter", fontSize: 9, color: C.grayMid, align: "right",
    });
    s.addText(p.t, {
      x: x + 0.1, y: cardY + 0.5, w: 1.6, h: 0.4,
      fontFace: "Inter", fontSize: 13, bold: true, color: C.white,
    });
    s.addText(p.d, {
      x: x + 0.1, y: cardY + 0.9, w: 1.6, h: 0.65,
      fontFace: "Inter", fontSize: 9, color: C.cabinet300, lineSpacingMultiple: 1.2,
    });
    // Connecteur
    if (above) {
      s.addShape("line", {
        x: x + 0.85, y: cardY + 1.6, w: 0, h: barY - cardY - 1.6,
        line: { color: p.c, width: 1, transparency: 50 },
      });
    } else {
      s.addShape("line", {
        x: x + 0.85, y: barY, w: 0, h: cardY - barY,
        line: { color: p.c, width: 1, transparency: 50 },
      });
    }
  });
}

// ═══════════════════════════════════════════════════════════════════
// SLIDE 14 — CTA / Clôture
// ═══════════════════════════════════════════════════════════════════
{
  const s = pptx.addSlide();
  darkBg(s);
  addAurora(s);
  addGridOverlay(s);
  slideNumber(s, 14, TOTAL);

  s.addText("Prêt à transformer votre cabinet ?", {
    x: 0.8, y: 1.8, w: 11.5, h: 1.2,
    fontFace: "Georgia", fontSize: 44, bold: true, color: C.white, align: "center",
  });
  s.addText("Rejoignez la première plateforme juridique conçue pour les professionnels du Sénégal.", {
    x: 0.8, y: 3.0, w: 11.5, h: 0.7,
    fontFace: "Inter", fontSize: 16, color: C.cabinet300, align: "center",
  });

  // Carte offre
  s.addShape("roundRect", {
    x: 4.5, y: 3.9, w: 4.3, h: 2.8,
    rectRadius: 0.18,
    fill: { color: C.cabinet800, transparency: 40 },
    line: { color: C.gold400, width: 1.5, transparency: 20 },
    shadow: { type: "outer", color: "000000", blur: 12, offset: 4, angle: 90, opacity: 0.3 },
  });
  s.addText("Découverte", {
    x: 4.5, y: 4.05, w: 4.3, h: 0.5,
    fontFace: "Inter", fontSize: 18, bold: true, color: C.white, align: "center",
  });
  s.addText("Gratuit", {
    x: 4.5, y: 4.5, w: 4.3, h: 0.8,
    fontFace: "Georgia", fontSize: 40, bold: true, color: C.white, align: "center",
  });
  s.addText("/ 14 jours", {
    x: 4.5, y: 5.25, w: 4.3, h: 0.35,
    fontFace: "Inter", fontSize: 13, color: C.cabinet300, align: "center",
  });
  const offer = [
    "Gestion illimitée des dossiers",
    "Module huissier & missions",
    "Facturation & comptabilité OHADA",
    "Espace client sécurisé",
    "Chiffrement AES-256",
  ];
  offer.forEach((o, i) => {
    const y = 5.65 + i * 0.22;
    s.addText("✓  " + o, {
      x: 4.8, y, w: 3.7, h: 0.22,
      fontFace: "Inter", fontSize: 10, color: C.cabinet200,
    });
  });

  // Ligne décorative + signature
  s.addShape("line", {
    x: 5.67, y: 6.9, w: 2.0, h: 0,
    line: { color: C.gold400, width: 2.5 },
  });
  s.addText("Avocat.sn  ·  2026", {
    x: 0.8, y: 7.0, w: 11.5, h: 0.35,
    fontFace: "Inter", fontSize: 11, color: "5A6B85", align: "center",
  });
}

// ── Génération ────────────────────────────────────────────────────
const outDir = join(__dirname, "..", "..", "..", "presentation");
const outFile = join(outDir, "Avocat.sn-Presentation.pptx");

(async () => {
  await mkdir(outDir, { recursive: true });
  await pptx.writeFile({ fileName: outFile });
  console.log("✓ Présentation générée :", outFile);
  console.log("  Slides :", TOTAL);
})();
