export interface LandingTheme {
  primary: string;
  accent: string;
  headingFont: string;
  bodyFont: string;
}

export const DEFAULT_THEME: LandingTheme = {
  primary: "#4a6fa5",
  accent: "#c78124",
  headingFont: "'Playfair Display', Georgia, serif",
  bodyFont: "Inter, system-ui, sans-serif",
};

export const THEME_FONTS = [
  { name: "Inter", family: "Inter, system-ui, sans-serif" },
  { name: "Playfair Display", family: "'Playfair Display', Georgia, serif" },
  { name: "Arial", family: "Arial, sans-serif" },
  { name: "Georgia", family: "Georgia, serif" },
  { name: "Helvetica", family: "Helvetica, Arial, sans-serif" },
  { name: "Times New Roman", family: "'Times New Roman', Times, serif" },
  { name: "Verdana", family: "Verdana, Geneva, sans-serif" },
  { name: "Cambria", family: "Cambria, Georgia, serif" },
  { name: "Garamond", family: "Garamond, Baskerville, serif" },
  { name: "Palatino", family: "'Palatino Linotype', 'Book Antiqua', serif" },
  { name: "Trebuchet MS", family: "'Trebuchet MS', sans-serif" },
  { name: "Tahoma", family: "Tahoma, Geneva, sans-serif" },
];

export const THEME_PRESET_COLORS = [
  { name: "Cabinet", code: "#4a6fa5" },
  { name: "Minuit", code: "#0f1b2e" },
  { name: "Bordeaux", code: "#7c2c3b" },
  { name: "Forêt", code: "#2c5f4a" },
  { name: "Sable", code: "#8c6a3a" },
  { name: "Indigo", code: "#4f46e5" },
  { name: "Rouille", code: "#b45a2a" },
  { name: "Orchidée", code: "#7c3aed" },
  { name: "Or", code: "#c78124" },
  { name: "Slate", code: "#475569" },
];

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace("#", "");
  const bigint = parseInt(clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean, 16);
  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255,
  };
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rf = r / 255;
  const gf = g / 255;
  const bf = b / 255;
  const max = Math.max(rf, gf, bf);
  const min = Math.min(rf, gf, bf);
  const l = (max + min) / 2;
  let s = 0;
  let h = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rf:
        h = (gf - bf) / d + (gf < bf ? 6 : 0);
        break;
      case gf:
        h = (bf - rf) / d + 2;
        break;
      default:
        h = (rf - gf) / d + 4;
        break;
    }
    h /= 6;
  }
  return { h: h * 360, s, l };
}

function normalizeHex(hex: string): string {
  const m = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return "#4a6fa5";
  const raw = m[1];
  const full = raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw;
  return `#${full.toLowerCase()}`;
}

type ColorScale = Record<number, { h: number; s: number; l: number }>;

function buildScale(hex: string): ColorScale {
  const base = rgbToHsl(...Object.values(hexToRgb(normalizeHex(hex))) as [number, number, number]);
  const targets: Record<number, number> = {
    50: 0.96,
    100: 0.9,
    200: 0.8,
    300: 0.7,
    400: 0.6,
    500: base.l,
    600: 0.4,
    700: 0.3,
    800: 0.2,
    900: 0.12,
    950: 0.06,
  };
  const scale: ColorScale = {};
  for (const levelS of Object.keys(targets)) {
    const level = Number(levelS);
    const l = Math.max(0.02, Math.min(0.98, targets[level]));
    const dist = Math.abs(l - base.l);
    const s = Math.max(0, Math.min(1, base.s * (1 - dist * 0.5)));
    scale[level] = { h: base.h, s, l };
  }
  return scale;
}

function cssColor(scale: ColorScale, level: number, alpha = 1): string {
  const c = scale[level];
  return `hsla(${Math.round(c.h)}, ${Math.round(c.s * 100)}%, ${Math.round(c.l * 100)}%, ${alpha})`;
}

export function getThemeCss(theme: LandingTheme = DEFAULT_THEME): string {
  const primary = buildScale(theme.primary);
  const accent = buildScale(theme.accent);
  const p = (level: number, alpha = 1) => cssColor(primary, level, alpha);
  const a = (level: number, alpha = 1) => cssColor(accent, level, alpha);

  return `
.landing-theme {
  --theme-heading-font: ${theme.headingFont};
  --theme-body-font: ${theme.bodyFont};
  font-family: var(--theme-body-font);
}

.landing-theme .font-display {
  font-family: var(--theme-heading-font) !important;
}

.landing-theme .bg-cabinet-50 { background-color: ${p(50)} !important; }
.landing-theme .bg-cabinet-100 { background-color: ${p(100)} !important; }
.landing-theme .bg-cabinet-200 { background-color: ${p(200)} !important; }
.landing-theme .bg-cabinet-700 { background-color: ${p(700)} !important; }
.landing-theme .bg-cabinet-900 { background-color: ${p(900)} !important; }
.landing-theme .bg-cabinet-950 { background-color: ${p(950)} !important; }
.landing-theme .bg-cabinet-950\\/80 { background-color: ${p(950, 0.8)} !important; }

.landing-theme .text-cabinet-100 { color: ${p(100)} !important; }
.landing-theme .text-cabinet-100\\/80 { color: ${p(100, 0.8)} !important; }
.landing-theme .text-cabinet-200\\/70 { color: ${p(200, 0.7)} !important; }
.landing-theme .text-cabinet-300 { color: ${p(300)} !important; }
.landing-theme .text-cabinet-300\\/60 { color: ${p(300, 0.6)} !important; }
.landing-theme .text-cabinet-300\\/80 { color: ${p(300, 0.8)} !important; }
.landing-theme .text-cabinet-500 { color: ${p(500)} !important; }
.landing-theme .text-cabinet-600 { color: ${p(600)} !important; }
.landing-theme .text-cabinet-700 { color: ${p(700)} !important; }
.landing-theme .text-cabinet-800 { color: ${p(800)} !important; }
.landing-theme .text-cabinet-900 { color: ${p(900)} !important; }

.landing-theme .border-cabinet-100 { border-color: ${p(100)} !important; }
.landing-theme .border-cabinet-200 { border-color: ${p(200)} !important; }
.landing-theme .border-cabinet-200\\/40 { border-color: ${p(200, 0.4)} !important; }
.landing-theme .hover\\:border-cabinet-300:hover { border-color: ${p(300)} !important; }
.landing-theme .hover\\:border-cabinet-500\\/30:hover { border-color: ${p(500, 0.3)} !important; }

.landing-theme .border-gold-400 { border-color: ${a(400)} !important; }
.landing-theme .border-gold-400\\/20 { border-color: ${a(400, 0.2)} !important; }
.landing-theme .border-gold-400\\/30 { border-color: ${a(400, 0.3)} !important; }
.landing-theme .border-gold-400\\/40 { border-color: ${a(400, 0.4)} !important; }
.landing-theme .text-gold-300 { color: ${a(300)} !important; }
.landing-theme .text-gold-300\\/90 { color: ${a(300, 0.9)} !important; }
.landing-theme .text-gold-400 { color: ${a(400)} !important; }
.landing-theme .text-gold-500 { color: ${a(500)} !important; }
.landing-theme .text-gold-600 { color: ${a(600)} !important; }
.landing-theme .bg-gold-400 { background-color: ${a(400)} !important; }
.landing-theme .bg-gold-400\\/15 { background-color: ${a(400, 0.15)} !important; }
.landing-theme .bg-gold-400\\/20 { background-color: ${a(400, 0.2)} !important; }
.landing-theme .bg-gold-500 { background-color: ${a(500)} !important; }
.landing-theme .bg-gold-500\\/10 { background-color: ${a(500, 0.1)} !important; }
.landing-theme .bg-gold-500\\/15 { background-color: ${a(500, 0.15)} !important; }
.landing-theme .bg-gold-500\\/20 { background-color: ${a(500, 0.2)} !important; }

.landing-theme .from-cabinet-900 {
  --tw-gradient-from: ${p(900)} var(--tw-gradient-from-position) !important;
  --tw-gradient-to: ${p(900, 0)} var(--tw-gradient-to-position) !important;
}
.landing-theme .from-cabinet-950\\/30 {
  --tw-gradient-from: ${p(950, 0.3)} var(--tw-gradient-from-position) !important;
  --tw-gradient-to: ${p(950, 0)} var(--tw-gradient-to-position) !important;
}
.landing-theme .from-cabinet-950\\/40 {
  --tw-gradient-from: ${p(950, 0.4)} var(--tw-gradient-from-position) !important;
  --tw-gradient-to: ${p(950, 0)} var(--tw-gradient-to-position) !important;
}
.landing-theme .via-cabinet-950\\/10 {
  --tw-gradient-to: ${p(950, 0)} var(--tw-gradient-to-position) !important;
  --tw-gradient-stops: var(--tw-gradient-from), ${p(950, 0.1)} var(--tw-gradient-via-position), var(--tw-gradient-to) !important;
}
.landing-theme .via-cabinet-950\\/15 {
  --tw-gradient-to: ${p(950, 0)} var(--tw-gradient-to-position) !important;
  --tw-gradient-stops: var(--tw-gradient-from), ${p(950, 0.15)} var(--tw-gradient-via-position), var(--tw-gradient-to) !important;
}
.landing-theme .to-cabinet-950 {
  --tw-gradient-to: ${p(950)} var(--tw-gradient-to-position) !important;
}
.landing-theme .to-cabinet-950\\/45 {
  --tw-gradient-to: ${p(950, 0.45)} var(--tw-gradient-to-position) !important;
}
.landing-theme .to-cabinet-950\\/55 {
  --tw-gradient-to: ${p(950, 0.55)} var(--tw-gradient-to-position) !important;
}

.landing-theme .hover\\:shadow-cabinet-900\\/5:hover {
  --tw-shadow-color: ${p(900, 0.05)} !important;
}

.landing-theme .btn-primary {
  background-color: ${p(700)} !important;
  --tw-shadow-color: ${p(900, 0.2)} !important;
}
.landing-theme .btn-primary:hover {
  background-color: ${p(900)} !important;
  --tw-shadow-color: ${p(900, 0.25)} !important;
}

.landing-theme .spotlight-glow {
  background: radial-gradient(600px circle at var(--x, 50%) var(--y, 50%), ${p(500, 0.14)}, transparent 40%) !important;
}
`;
}
