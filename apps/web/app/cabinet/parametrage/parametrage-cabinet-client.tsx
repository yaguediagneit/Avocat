"use client";

import { useMemo, useRef, useState } from "react";
import { defaultHero } from "@/components/landing/landing-defaults";
import { DEFAULT_THEME, getThemeCss, THEME_FONTS, THEME_PRESET_COLORS, type LandingTheme } from "@/lib/theme";

interface PdfTheme {
  primaryColor: string;
  secondaryColor: string;
  fontFamily: "Helvetica" | "Times-Roman" | "Courier";
  fontSize: number;
  headerText: string;
  footerText: string;
}

const DEFAULT_PDF_THEME: PdfTheme = {
  primaryColor: "#2c4c7c",
  secondaryColor: "#c78124",
  fontFamily: "Helvetica",
  fontSize: 11,
  headerText: "",
  footerText: "",
};

interface CabinetSettings {
  id: string;
  raisonSociale: string;
  description: string;
  slogan: string;
  adresse: string;
  identifiantFiscal: string;
  identificationLegale: string;
  telephonePrincipal: string;
  telephoneSecondaire: string;
  email: string;
  siteWeb: string;
  logoUrl: string;
  cachetUrl: string;
  presentationImage: string;
  presentationTexte: string;
  landingImages: string[];
  valeurs: { titre: string; description: string }[];
  temoignages: { auteur: string; role: string; texte: string }[];
  hero: { titre: string; detail: string; couleur: string; police: string; tailleTitre: string; tailleDetail: string; cta?: string }[];
  theme: LandingTheme;
  pdfTheme: PdfTheme;
}

interface ParametrageCabinetClientProps {
  initialData: CabinetSettings;
}

const HERO_COLORS = [
  { name: "Blanc", code: "#ffffff" },
  { name: "Cabinet 50", code: "#f5f7fa" },
  { name: "Cabinet 100", code: "#e4e9f0" },
  { name: "Cabinet 200", code: "#cdd7e6" },
  { name: "Cabinet 300", code: "#a9bbd4" },
  { name: "Cabinet 400", code: "#7e9bbf" },
  { name: "Cabinet 500", code: "#4a6fa5" },
  { name: "Cabinet 600", code: "#385a8c" },
  { name: "Cabinet 700", code: "#2c4c7c" },
  { name: "Cabinet 800", code: "#263f67" },
  { name: "Cabinet 900", code: "#1a2e4c" },
  { name: "Cabinet 950", code: "#0f1b2e" },
  { name: "Gold 300", code: "#eabf73" },
  { name: "Gold 400", code: "#e1a045" },
  { name: "Gold 500", code: "#c78124" },
  { name: "Gold 600", code: "#a8651b" },
  { name: "Noir", code: "#000000" },
];

const HERO_FONTS = [
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

function normalizeHero(hero: CabinetSettings["hero"] | undefined) {
  return (hero?.length ? hero : defaultHero).map((h) => ({
    titre: h.titre ?? "",
    detail: h.detail ?? "",
    couleur: h.couleur ?? "#ffffff",
    police: h.police ?? "",
    tailleTitre: h.tailleTitre ?? "48px",
    tailleDetail: h.tailleDetail ?? "20px",
    cta: h.cta === undefined ? "Contactez-nous" : h.cta,
  }));
}

export function ParametrageCabinetClient({ initialData }: ParametrageCabinetClientProps) {
  const [form, setForm] = useState<CabinetSettings>({
    ...initialData,
    theme: initialData.theme ?? DEFAULT_THEME,
    pdfTheme: initialData.pdfTheme ?? DEFAULT_PDF_THEME,
    hero: normalizeHero(initialData.hero),
  });
  const previewCss = useMemo(() => getThemeCss(form.theme), [form.theme]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const cachetInputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess(false);

    const body = {
      raisonSociale: form.raisonSociale,
      description: form.description,
      slogan: form.slogan,
      adresse: form.adresse,
      identifiantFiscal: form.identifiantFiscal,
      identificationLegale: form.identificationLegale,
      telephonePrincipal: form.telephonePrincipal,
      telephoneSecondaire: form.telephoneSecondaire,
      email: form.email,
      siteWeb: form.siteWeb,
      logoUrl: form.logoUrl,
      cachetUrl: form.cachetUrl,
      presentationImage: form.presentationImage,
      presentationTexte: form.presentationTexte,
      landingImages: form.landingImages,
      valeurs: form.valeurs,
      temoignages: form.temoignages,
      hero: form.hero ?? [],
      theme: form.theme,
      pdfTheme: form.pdfTheme,
    };

    try {
      const res = await fetch("/api/parametres/cabinet", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const message =
          data?.error?.formErrors?.[0] ||
          (typeof data.error === "string" ? data.error : "Erreur lors de l'enregistrement.");
        setError(message);
        return;
      }

      setForm({
        ...data,
        theme: data.theme ?? DEFAULT_THEME,
        pdfTheme: data.pdfTheme ?? DEFAULT_PDF_THEME,
        hero: normalizeHero(data.hero),
      });
      setSuccess(true);
    } catch (err) {
      console.error(err);
      setError("Erreur réseau.");
    } finally {
      setLoading(false);
    }
  }

  function updateField<K extends keyof CabinetSettings>(field: K, value: CabinetSettings[K]) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function updateTheme(updates: Partial<LandingTheme>) {
    setForm((f) => ({ ...f, theme: { ...f.theme, ...updates } }));
  }

  function updatePdfTheme(updates: Partial<PdfTheme>) {
    setForm((f) => ({ ...f, pdfTheme: { ...f.pdfTheme, ...updates } }));
  }

  function handleImageChange(field: "logoUrl" | "cachetUrl" | "presentationImage", file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Veuillez sélectionner une image (PNG, JPG, GIF, WebP, SVG).");
      return;
    }
    const maxSize = 2 * 1024 * 1024;
    if (file.size > maxSize) {
      setError("L'image ne doit pas dépasser 2 Mo.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setError("");
      updateField(field, reader.result as string);
    };
    reader.onerror = () => setError("Erreur lors de la lecture de l'image.");
    reader.readAsDataURL(file);
  }

  function handleLandingImages(files: FileList | null) {
    if (!files) return;
    const remainingSlots = 10 - form.landingImages.length;
    if (remainingSlots <= 0) {
      setError("10 images maximum pour le carousel.");
      return;
    }
    const toProcess = Array.from(files).slice(0, remainingSlots);

    toProcess.forEach((file) => {
      if (!file.type.startsWith("image/")) {
        setError(`${file.name} n'est pas une image.`);
        return;
      }
      const maxSize = 2 * 1024 * 1024;
      if (file.size > maxSize) {
        setError(`${file.name} dépasse 2 Mo.`);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        setError("");
        setForm((f) => ({ ...f, landingImages: [...f.landingImages, reader.result as string] }));
      };
      reader.onerror = () => setError(`Erreur lors de la lecture de ${file.name}.`);
      reader.readAsDataURL(file);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Paramètres du cabinet</h2>
      </div>

      {error && <div className="rounded-md bg-red-100 p-3 text-sm text-red-700">{error}</div>}
      {success && (
        <div className="rounded-md bg-emerald-100 p-3 text-sm text-emerald-700">
          Paramètres enregistrés.
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className="mb-1 block text-sm font-medium">Nom du cabinet</label>
          <input
            type="text"
            value={form.raisonSociale}
            onChange={(e) => updateField("raisonSociale", e.target.value)}
            className="input"
            required
          />
        </div>

        <div className="md:col-span-2">
          <label className="mb-1 block text-sm font-medium">Description</label>
          <input
            type="text"
            value={form.description}
            onChange={(e) => updateField("description", e.target.value)}
            className="input"
          />
          <p className="mt-1 text-xs text-gray-500">
            Texte affiché après le nom du cabinet (ex. Cabinet Juridique Multidisciplinaire).
          </p>
        </div>

        <div className="md:col-span-2">
          <label className="mb-1 block text-sm font-medium">Slogan</label>
          <input
            type="text"
            value={form.slogan}
            onChange={(e) => updateField("slogan", e.target.value)}
            className="input"
          />
          <p className="mt-1 text-xs text-gray-500">
            Slogan affiché dans la section finale du landing page.
          </p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Téléphone principal</label>
          <input
            type="tel"
            value={form.telephonePrincipal}
            onChange={(e) => updateField("telephonePrincipal", e.target.value)}
            className="input"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Téléphone secondaire</label>
          <input
            type="tel"
            value={form.telephoneSecondaire}
            onChange={(e) => updateField("telephoneSecondaire", e.target.value)}
            className="input"
          />
        </div>

        <div className="md:col-span-2">
          <label className="mb-1 block text-sm font-medium">Adresse</label>
          <textarea
            value={form.adresse}
            onChange={(e) => updateField("adresse", e.target.value)}
            className="input"
            rows={2}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Identification légale</label>
          <input
            type="text"
            value={form.identificationLegale}
            onChange={(e) => updateField("identificationLegale", e.target.value)}
            className="input"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Identification fiscale</label>
          <input
            type="text"
            value={form.identifiantFiscal}
            onChange={(e) => updateField("identifiantFiscal", e.target.value)}
            className="input"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Email</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => updateField("email", e.target.value)}
            className="input"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Site web</label>
          <input
            type="url"
            value={form.siteWeb}
            onChange={(e) => updateField("siteWeb", e.target.value)}
            className="input"
          />
        </div>

        <div className="md:col-span-2">
          <label className="mb-1 block text-sm font-medium">Identité visuelle</label>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Logo</label>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => handleImageChange("logoUrl", e.target.files?.[0])}
                className="input"
              />
              {form.logoUrl && (
                <div className="mt-2 flex items-center gap-3">
                  <img
                    src={form.logoUrl}
                    alt="Logo"
                    className="h-20 rounded border border-gray-200 object-contain bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      updateField("logoUrl", "");
                      if (logoInputRef.current) logoInputRef.current.value = "";
                    }}
                    className="text-sm text-red-700 hover:underline"
                  >
                    Retirer
                  </button>
                </div>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Cachet</label>
              <input
                ref={cachetInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => handleImageChange("cachetUrl", e.target.files?.[0])}
                className="input"
              />
              {form.cachetUrl && (
                <div className="mt-2 flex items-center gap-3">
                  <img
                    src={form.cachetUrl}
                    alt="Cachet"
                    className="h-20 rounded border border-gray-200 object-contain bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      updateField("cachetUrl", "");
                      if (cachetInputRef.current) cachetInputRef.current.value = "";
                    }}
                    className="text-sm text-red-700 hover:underline"
                  >
                    Retirer
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div id="presentation" className="card space-y-4 p-0 scroll-mt-28">
        <div className="border-b border-gray-100 px-6 py-4">
          <h3 className="text-lg font-semibold">Présentation</h3>
          <p className="text-sm text-gray-500">Image et texte de présentation du cabinet affichés sur la page publique.</p>
        </div>

        <div className="space-y-6 px-6 pb-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Image de présentation</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleImageChange("presentationImage", e.target.files?.[0])}
                className="input"
              />
              <p className="mt-1 text-xs text-gray-500">Carrée, 2 Mo maximum.</p>
              {form.presentationImage && (
                <div className="mt-2 flex items-center gap-3">
                  <img
                    src={form.presentationImage}
                    alt="Présentation"
                    className="h-24 w-24 rounded-2xl border border-gray-200 object-cover bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => updateField("presentationImage", "")}
                    className="text-sm text-red-700 hover:underline"
                  >
                    Retirer
                  </button>
                </div>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Texte de présentation</label>
              <textarea
                value={form.presentationTexte}
                onChange={(e) => updateField("presentationTexte", e.target.value)}
                className="input"
                rows={5}
                placeholder="Présentez le cabinet, son histoire et ses valeurs..."
              />
              <p className="mt-1 text-xs text-gray-500">Texte formaté affiché à droite de l'image sur le landing page.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="card space-y-4 p-0">
        <div className="border-b border-gray-100 px-6 py-4">
          <h3 className="text-lg font-semibold">Landing page</h3>
          <p className="text-sm text-gray-500">Images, valeurs et témoignages affichés sur la page publique du cabinet.</p>
        </div>

        <div className="space-y-6 px-6 pb-6">
          <div>
            <label className="mb-2 block text-sm font-medium">
              Images du carousel ({form.landingImages.length}/10)
            </label>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => handleLandingImages(e.target.files)}
              className="input"
              disabled={form.landingImages.length >= 10}
            />
            <p className="mt-1 text-xs text-gray-500">Jusqu&apos;à 10 images. 2 Mo maximum par image.</p>
            {form.landingImages.length > 0 && (
              <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-5">
                {form.landingImages.map((src, index) => (
                  <div key={index} className="group relative aspect-square overflow-hidden rounded-lg border border-gray-200">
                    <img src={src} alt={`Carousel ${index + 1}`} className="h-full w-full object-cover" />
                    <span className="absolute left-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
                      {index + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          landingImages: f.landingImages.filter((_, i) => i !== index),
                        }))
                      }
                      className="absolute right-1 top-1 rounded bg-red-600 px-1.5 py-0.5 text-xs text-white opacity-0 transition group-hover:opacity-100"
                    >
                      ×
                    </button>
                    <div className="absolute inset-x-0 bottom-0 flex justify-center gap-1 bg-black/50 py-1 opacity-0 transition group-hover:opacity-100">
                      <button
                        type="button"
                        title="Déplacer vers la gauche"
                        disabled={index === 0}
                        onClick={() =>
                          setForm((f) => {
                            const imgs = [...f.landingImages];
                            [imgs[index - 1], imgs[index]] = [imgs[index], imgs[index - 1]];
                            return { ...f, landingImages: imgs };
                          })
                        }
                        className="rounded bg-white/90 px-1.5 py-0.5 text-xs text-gray-800 disabled:opacity-40"
                      >
                        ←
                      </button>
                      <button
                        type="button"
                        title="Déplacer vers la droite"
                        disabled={index === form.landingImages.length - 1}
                        onClick={() =>
                          setForm((f) => {
                            const imgs = [...f.landingImages];
                            [imgs[index], imgs[index + 1]] = [imgs[index + 1], imgs[index]];
                            return { ...f, landingImages: imgs };
                          })
                        }
                        className="rounded bg-white/90 px-1.5 py-0.5 text-xs text-gray-800 disabled:opacity-40"
                      >
                        →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium">Textes du hero</label>
              <button
                type="button"
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    hero: [
                      ...(f.hero ?? []),
                      {
                        titre: "",
                        detail: "",
                        couleur: "#ffffff",
                        police: "",
                        tailleTitre: "48px",
                        tailleDetail: "20px",
                        cta: "Contactez-nous",
                      },
                    ],
                  }))
                }
                className="text-sm text-cabinet-700 hover:underline"
              >
                + Ajouter
              </button>
            </div>
            <div className="space-y-3">
              {(form.hero ?? []).map((h, index) => (
                <div key={index} className="grid gap-3 rounded-lg border border-gray-200 p-3 md:grid-cols-2">
                  <input
                    type="text"
                    value={h.titre}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        hero: (f.hero ?? []).map((item, i) => (i === index ? { ...item, titre: e.target.value } : item)),
                      }))
                    }
                    placeholder="Titre"
                    className="input"
                  />
                  <input
                    type="text"
                    value={h.detail}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        hero: (f.hero ?? []).map((item, i) => (i === index ? { ...item, detail: e.target.value } : item)),
                      }))
                    }
                    placeholder="Détail"
                    className="input"
                  />
                  <input
                    type="text"
                    value={h.cta ?? ""}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        hero: (f.hero ?? []).map((item, i) => (i === index ? { ...item, cta: e.target.value } : item)),
                      }))
                    }
                    placeholder="Texte du bouton (ex. Contactez-nous)"
                    className="input md:col-span-2"
                  />
                  <div className="flex items-center gap-2">
                    <select
                      value={h.couleur}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          hero: (f.hero ?? []).map((item, i) => (i === index ? { ...item, couleur: e.target.value } : item)),
                        }))
                      }
                      className="input"
                    >
                      {HERO_COLORS.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.name} ({c.code})
                        </option>
                      ))}
                    </select>
                    <div
                      className="h-9 w-9 shrink-0 rounded-none border border-gray-200 bg-gray-100 shadow-sm transition-colors duration-200"
                      style={h.couleur ? { backgroundColor: h.couleur } : undefined}
                      aria-label="Aperçu de la couleur"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={h.police}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          hero: (f.hero ?? []).map((item, i) => (i === index ? { ...item, police: e.target.value } : item)),
                        }))
                      }
                      className="input"
                    >
                      {HERO_FONTS.map((f) => (
                        <option key={f.name} value={f.family}>
                          {f.name}
                        </option>
                      ))}
                    </select>
                    <span
                      className="shrink-0 rounded border border-gray-200 bg-white px-2 py-1 text-sm text-cabinet-900"
                      style={{ fontFamily: h.police }}
                      aria-label="Aperçu de la police"
                    >
                      Aa
                    </span>
                  </div>
                  <input
                    type="text"
                    value={h.tailleTitre}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        hero: (f.hero ?? []).map((item, i) => (i === index ? { ...item, tailleTitre: e.target.value } : item)),
                      }))
                    }
                    placeholder="Taille du titre (ex. 48px)"
                    className="input"
                  />
                  <input
                    type="text"
                    value={h.tailleDetail}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        hero: (f.hero ?? []).map((item, i) => (i === index ? { ...item, tailleDetail: e.target.value } : item)),
                      }))
                    }
                    placeholder="Taille du détail (ex. 20px)"
                    className="input"
                  />
                  <div className="md:col-span-2 text-right">
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, hero: (f.hero ?? []).filter((_, i) => i !== index) }))}
                      className="text-sm text-red-700 hover:underline"
                    >
                      Retirer
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-5 rounded-lg border border-gray-200 p-4">
            <div>
              <h4 className="text-sm font-medium">Thème du landing page</h4>
              <p className="text-xs text-gray-500">Couleurs et polices appliquées à la page publique.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="block text-xs font-medium">Couleur principale</label>
                <div className="flex flex-wrap items-center gap-2">
                  {THEME_PRESET_COLORS.map((c) => (
                    <button
                      key={c.code}
                      type="button"
                      onClick={() => updateTheme({ primary: c.code })}
                      className={`h-8 w-8 rounded-full border-2 ${form.theme.primary === c.code ? "border-cabinet-900" : "border-transparent"}`}
                      style={{ backgroundColor: c.code }}
                      title={c.name}
                    />
                  ))}
                  <input
                    type="color"
                    value={form.theme.primary}
                    onChange={(e) => updateTheme({ primary: e.target.value })}
                    className="h-8 w-8 cursor-pointer rounded border border-gray-300 p-0"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="block text-xs font-medium">Couleur d'accent</label>
                <div className="flex flex-wrap items-center gap-2">
                  {THEME_PRESET_COLORS.map((c) => (
                    <button
                      key={c.code}
                      type="button"
                      onClick={() => updateTheme({ accent: c.code })}
                      className={`h-8 w-8 rounded-full border-2 ${form.theme.accent === c.code ? "border-cabinet-900" : "border-transparent"}`}
                      style={{ backgroundColor: c.code }}
                      title={c.name}
                    />
                  ))}
                  <input
                    type="color"
                    value={form.theme.accent}
                    onChange={(e) => updateTheme({ accent: e.target.value })}
                    className="h-8 w-8 cursor-pointer rounded border border-gray-300 p-0"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="block text-xs font-medium">Police des titres</label>
                <select
                  value={form.theme.headingFont}
                  onChange={(e) => updateTheme({ headingFont: e.target.value })}
                  className="input"
                >
                  {THEME_FONTS.map((f) => (
                    <option key={f.name} value={f.family}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="block text-xs font-medium">Police du corps</label>
                <select
                  value={form.theme.bodyFont}
                  onChange={(e) => updateTheme({ bodyFont: e.target.value })}
                  className="input"
                >
                  {THEME_FONTS.map((f) => (
                    <option key={f.name} value={f.family}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="landing-theme rounded-lg border border-gray-200 p-4">
              <style dangerouslySetInnerHTML={{ __html: previewCss }} />
              <h4 className="font-display text-lg font-medium">Aperçu du thème</h4>
              <p className="mt-1 text-sm text-cabinet-600">Le rendu s'appliquera sur la page publique du cabinet.</p>
              <div className="mt-3 inline-flex rounded-lg bg-cabinet-700 px-4 py-2 text-sm text-white">Bouton principal</div>
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium">Nos valeurs</label>
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, valeurs: [...f.valeurs, { titre: "", description: "" }] }))}
                className="text-sm text-cabinet-700 hover:underline"
              >
                + Ajouter
              </button>
            </div>
            <div className="space-y-3">
              {form.valeurs.map((v, index) => (
                <div key={index} className="grid gap-3 rounded-lg border border-gray-200 p-3 md:grid-cols-2">
                  <input
                    type="text"
                    value={v.titre}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        valeurs: f.valeurs.map((item, i) => (i === index ? { ...item, titre: e.target.value } : item)),
                      }))
                    }
                    placeholder="Titre"
                    className="input"
                  />
                  <input
                    type="text"
                    value={v.description}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        valeurs: f.valeurs.map((item, i) => (i === index ? { ...item, description: e.target.value } : item)),
                      }))
                    }
                    placeholder="Description"
                    className="input"
                  />
                  <div className="md:col-span-2 text-right">
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, valeurs: f.valeurs.filter((_, i) => i !== index) }))}
                      className="text-sm text-red-700 hover:underline"
                    >
                      Retirer
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium">Témoignages</label>
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, temoignages: [...f.temoignages, { auteur: "", role: "", texte: "" }] }))}
                className="text-sm text-cabinet-700 hover:underline"
              >
                + Ajouter
              </button>
            </div>
            <div className="space-y-3">
              {form.temoignages.map((t, index) => (
                <div key={index} className="space-y-3 rounded-lg border border-gray-200 p-3">
                  <div className="grid gap-3 md:grid-cols-2">
                    <input
                      type="text"
                      value={t.auteur}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          temoignages: f.temoignages.map((item, i) => (i === index ? { ...item, auteur: e.target.value } : item)),
                        }))
                      }
                      placeholder="Auteur"
                      className="input"
                    />
                    <input
                      type="text"
                      value={t.role}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          temoignages: f.temoignages.map((item, i) => (i === index ? { ...item, role: e.target.value } : item)),
                        }))
                      }
                      placeholder="Rôle / Qualité"
                      className="input"
                    />
                  </div>
                  <textarea
                    value={t.texte}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        temoignages: f.temoignages.map((item, i) => (i === index ? { ...item, texte: e.target.value } : item)),
                      }))
                    }
                    placeholder="Texte du témoignage"
                    className="input"
                    rows={3}
                  />
                  <div className="text-right">
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, temoignages: f.temoignages.filter((_, i) => i !== index) }))}
                      className="text-sm text-red-700 hover:underline"
                    >
                      Retirer
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="card space-y-4 p-0">
        <div className="border-b border-gray-100 px-6 py-4">
          <h3 className="text-lg font-semibold">Thème PDF</h3>
          <p className="text-sm text-gray-500">Couleurs et polices appliquées aux documents PDF générés (fiches de tâches, documents juridiques).</p>
        </div>
        <div className="space-y-4 px-6 pb-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="block text-xs font-medium">Couleur principale (en-tête, titres)</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.pdfTheme.primaryColor}
                  onChange={(e) => updatePdfTheme({ primaryColor: e.target.value })}
                  className="h-9 w-12 cursor-pointer rounded border border-gray-300 p-0"
                />
                <input
                  type="text"
                  value={form.pdfTheme.primaryColor}
                  onChange={(e) => updatePdfTheme({ primaryColor: e.target.value })}
                  className="input flex-1"
                  placeholder="#2c4c7c"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-medium">Couleur secondaire (accents, filets)</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.pdfTheme.secondaryColor}
                  onChange={(e) => updatePdfTheme({ secondaryColor: e.target.value })}
                  className="h-9 w-12 cursor-pointer rounded border border-gray-300 p-0"
                />
                <input
                  type="text"
                  value={form.pdfTheme.secondaryColor}
                  onChange={(e) => updatePdfTheme({ secondaryColor: e.target.value })}
                  className="input flex-1"
                  placeholder="#c78124"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-medium">Police du document</label>
              <select
                value={form.pdfTheme.fontFamily}
                onChange={(e) => updatePdfTheme({ fontFamily: e.target.value as PdfTheme["fontFamily"] })}
                className="input"
              >
                <option value="Helvetica">Helvetica (sans-serif)</option>
                <option value="Times-Roman">Times Roman (serif)</option>
                <option value="Courier">Courier (monospace)</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-medium">Taille de police (pt)</label>
              <input
                type="number"
                min={8}
                max={16}
                value={form.pdfTheme.fontSize}
                onChange={(e) => updatePdfTheme({ fontSize: parseInt(e.target.value, 10) || 11 })}
                className="input"
              />
            </div>
            <div className="md:col-span-2 space-y-2">
              <label className="block text-xs font-medium">Texte d&apos;en-tête (optionnel)</label>
              <input
                type="text"
                value={form.pdfTheme.headerText}
                onChange={(e) => updatePdfTheme({ headerText: e.target.value })}
                className="input"
                placeholder="Ex. Cabinet Me Ndiaye & Associés — Document confidentiel"
              />
            </div>
            <div className="md:col-span-2 space-y-2">
              <label className="block text-xs font-medium">Texte de pied de page (optionnel)</label>
              <input
                type="text"
                value={form.pdfTheme.footerText}
                onChange={(e) => updatePdfTheme({ footerText: e.target.value })}
                className="input"
                placeholder="Ex. © {{annee}} Me Ndiaye & Associés — Tous droits réservés"
              />
              <p className="text-xs text-gray-500">
                Variables disponibles (en-tête et pied de page) :{" "}
                <code>{"{{annee}}"}</code> = année en cours, <code>{"{{date}}"}</code> = date du jour.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? "Enregistrement..." : "Enregistrer les paramètres"}
        </button>
      </div>
    </form>
  );
}
