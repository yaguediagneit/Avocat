import Link from "next/link";
import { HeroCarousel } from "@/components/landing/hero-carousel";
import { HeroSlides } from "@/components/landing/hero-slides";
import { LandingImage } from "@/components/landing/landing-image";
import { ScrollReveal } from "@/components/landing/scroll-reveal";
import { SpotlightCard } from "@/components/landing/spotlight-card";
import { Marquee } from "@/components/landing/marquee";
import { AnimatedCounter } from "@/components/landing/animated-counter";
import { CabinetNavHeader } from "@/components/landing/cabinet-nav-header";
import { defaultHero, type HeroSlide } from "@/components/landing/landing-defaults";
import { cn } from "@/lib/utils";
import { getThemeCss, type LandingTheme } from "@/lib/theme";

interface CabinetLandingProps {
  cabinet: {
    raisonSociale: string;
    description: string;
    slogan: string;
    presentationImage: string;
    presentationTexte: string;
    adresse?: string | null;
    identifiantFiscal?: string | null;
    identificationLegale?: string;
    logoUrl?: string | null;
    telephonePrincipal?: string;
    telephoneSecondaire?: string;
    email?: string;
    siteWeb?: string;
    landingImages: string[];
    valeurs: { titre: string; description: string }[];
    temoignages: { auteur: string; role: string; texte: string }[];
    hero?: HeroSlide[];
    theme?: LandingTheme;
    specialites: { id: string; code: string; libelle: string; description: string | null }[];
  };
}

/**
 * Landing page d'un cabinet — Server Component. Seules les parties animées
 * (`HeroSlides`, `HeroCarousel`, `ScrollReveal`, `SpotlightCard`, `AnimatedCounter`,
 * `CabinetNavHeader`) sont des Client Components ; le reste est rendu côté serveur.
 */
export function CabinetLanding({ cabinet }: CabinetLandingProps) {
  const heroSlides = (cabinet.hero?.length ? cabinet.hero : defaultHero).filter(
    (s) => s.titre?.trim() || s.detail?.trim() || s.cta?.trim()
  );

  const hasContact =
    Boolean(cabinet.telephonePrincipal || cabinet.email || cabinet.adresse || cabinet.siteWeb);

  const specialitesLabels = cabinet.specialites.map((s) => s.libelle);
  const hasSpecialites = cabinet.specialites.length > 0;
  const hasValeurs = cabinet.valeurs.length > 0;
  const temoignages = cabinet.temoignages.filter((t) => t.texte.trim());
  const hasTemoignages = temoignages.length > 0;
  const hasPresentation =
    cabinet.presentationTexte.trim().length > 0 || cabinet.presentationImage.trim().length > 0;
  const themeCss = cabinet.theme ? getThemeCss(cabinet.theme) : "";
  const ctaHref = cabinet.email ? `mailto:${cabinet.email}` : "#contact";

  // Première section cible pour la flèche de défilement
  const firstSectionHref = hasSpecialites
    ? "#specialites-bandeau"
    : hasPresentation
    ? "#presentation"
    : hasValeurs
    ? "#valeurs"
    : "#contact";

  return (
    <div className={cn("landing-root", cabinet.theme && "landing-theme")}>
      {cabinet.theme && <style dangerouslySetInnerHTML={{ __html: themeCss }} />}

      {/* En-tête responsive moderne avec menu d'ancres et tiroir mobile */}
      <CabinetNavHeader
        raisonSociale={cabinet.raisonSociale}
        slogan={cabinet.slogan}
        description={cabinet.description}
        logoUrl={cabinet.logoUrl}
        telephonePrincipal={cabinet.telephonePrincipal}
        email={cabinet.email}
        hasPresentation={hasPresentation}
        hasSpecialites={hasSpecialites}
        hasValeurs={hasValeurs}
        hasTemoignages={hasTemoignages}
        hasContact={hasContact}
      />

      <main className="overflow-x-hidden">
        {/* Hero Section immersif */}
        <section className="relative flex min-h-[90vh] sm:min-h-[92vh] items-center justify-center overflow-hidden bg-cabinet-950 pt-24 pb-10 text-white">
          <HeroCarousel images={cabinet.landingImages} className="z-0" />

          <div className="relative z-20 mx-auto w-full max-w-5xl px-6 py-6 md:py-8 text-center">
            <HeroSlides slides={heroSlides} ctaHref={ctaHref} />
          </div>

          {/* Flèche interactive de défilement */}
          <a
            href={firstSectionHref}
            aria-label="Faire défiler vers les contenus"
            className="absolute bottom-6 left-1/2 z-20 -translate-x-1/2 flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/20 text-gold-300 backdrop-blur-sm transition-all duration-300 hover:border-gold-400 hover:bg-white/10 hover:text-white animate-bounce"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 5v14" />
              <path d="m19 12-7 7-7-7" />
            </svg>
          </a>
        </section>

        {/* Bandeau défilant des spécialités avec flux continu */}
        {hasSpecialites && (
          <section id="specialites-bandeau" className="border-y border-cabinet-200 bg-white py-4 shadow-sm">
            <div className="mx-auto max-w-7xl px-6">
              <p className="mb-3 text-center text-xs font-semibold uppercase tracking-widest text-cabinet-500">
                Domaines d&apos;intervention
              </p>
              <Marquee pauseOnHover repeat={6}>
                {specialitesLabels.map((item) => (
                  <span
                    key={item}
                    className="inline-flex items-center gap-2 rounded-full border border-cabinet-100 bg-cabinet-50/80 px-5 py-2 text-sm font-medium text-cabinet-800 transition hover:border-gold-400/60 hover:bg-gold-50/50"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-gold-500" />
                    {item}
                  </span>
                ))}
              </Marquee>
            </div>
          </section>
        )}

        {/* Chiffres Clés du Cabinet */}
        <section className="relative border-b border-cabinet-200/60 bg-white py-12">
          <div className="mx-auto max-w-7xl px-6">
            <div className="grid grid-cols-2 gap-6 md:grid-cols-4 md:gap-8">
              <ScrollReveal delay={0}>
                <div className="flex flex-col items-center text-center p-4 rounded-2xl bg-cabinet-50/70 border border-cabinet-100">
                  <span className="font-display text-3xl sm:text-4xl md:text-5xl font-bold text-cabinet-900">
                    <AnimatedCounter value={Math.max(cabinet.specialites.length, 6)} suffix="+" />
                  </span>
                  <span className="mt-2 text-xs sm:text-sm font-semibold text-cabinet-600 uppercase tracking-wider">
                    Spécialités juridiques
                  </span>
                </div>
              </ScrollReveal>

              <ScrollReveal delay={100}>
                <div className="flex flex-col items-center text-center p-4 rounded-2xl bg-cabinet-50/70 border border-cabinet-100">
                  <span className="font-display text-3xl sm:text-4xl md:text-5xl font-bold text-gold-500">
                    <AnimatedCounter value={100} suffix="%" />
                  </span>
                  <span className="mt-2 text-xs sm:text-sm font-semibold text-cabinet-600 uppercase tracking-wider">
                    Secret & Confidentialité
                  </span>
                </div>
              </ScrollReveal>

              <ScrollReveal delay={200}>
                <div className="flex flex-col items-center text-center p-4 rounded-2xl bg-cabinet-50/70 border border-cabinet-100">
                  <span className="font-display text-3xl sm:text-4xl md:text-5xl font-bold text-cabinet-900">
                    <AnimatedCounter value={24} suffix="h" />
                  </span>
                  <span className="mt-2 text-xs sm:text-sm font-semibold text-cabinet-600 uppercase tracking-wider">
                    Réactivité moyenne
                  </span>
                </div>
              </ScrollReveal>

              <ScrollReveal delay={300}>
                <div className="flex flex-col items-center text-center p-4 rounded-2xl bg-cabinet-50/70 border border-cabinet-100">
                  <span className="font-display text-3xl sm:text-4xl md:text-5xl font-bold text-gold-500">
                    <AnimatedCounter value={98} suffix="%" />
                  </span>
                  <span className="mt-2 text-xs sm:text-sm font-semibold text-cabinet-600 uppercase tracking-wider">
                    Satisfaction client
                  </span>
                </div>
              </ScrollReveal>
            </div>
          </div>
        </section>

        {/* Section Présentation rééquilibrée */}
        {hasPresentation && (
          <section id="presentation" className="relative overflow-hidden bg-cabinet-50/60 py-16 md:py-24">
            <div className="pointer-events-none absolute inset-0 bg-grid opacity-[0.03]" />
            <div className="relative mx-auto max-w-7xl px-6">
              {cabinet.presentationImage ? (
                /* Grille 2 colonnes avec image */
                <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
                  <ScrollReveal>
                    <div className="relative mx-auto aspect-square w-full max-w-md overflow-hidden rounded-3xl border-4 border-white shadow-2xl ring-1 ring-black/5">
                      <LandingImage
                        src={cabinet.presentationImage}
                        alt="Présentation du cabinet"
                        fill
                        sizes="(min-width: 1024px) 28rem, 100vw"
                        className="object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-cabinet-950/40 via-transparent to-transparent" />
                    </div>
                  </ScrollReveal>

                  <ScrollReveal delay={150}>
                    <div className="space-y-6 text-left">
                      <span className="section-label inline-flex border-cabinet-500/30 text-cabinet-600">
                        Présentation
                      </span>
                      <h2 className="font-display text-3xl font-medium tracking-tight text-cabinet-950 md:text-4xl">
                        {cabinet.slogan || "Une vocation d'excellence au service de vos droits."}
                      </h2>
                      <div className="whitespace-pre-line text-base sm:text-lg leading-relaxed text-cabinet-700">
                        {cabinet.presentationTexte}
                      </div>
                      <div className="pt-2">
                        <a
                          href="#contact"
                          className="btn-primary inline-flex items-center gap-2 px-6 py-3 text-sm"
                        >
                          <span>Solliciter une consultation</span>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                            <path d="M5 12h14" />
                            <path d="m12 5 7 7-7 7" />
                          </svg>
                        </a>
                      </div>
                    </div>
                  </ScrollReveal>
                </div>
              ) : (
                /* Affichage centré élégant sans image pour éviter le vide */
                <ScrollReveal>
                  <div className="mx-auto max-w-3xl text-center space-y-6">
                    <span className="section-label inline-flex border-cabinet-500/30 text-cabinet-600">
                      Présentation
                    </span>
                    <h2 className="font-display text-3xl font-medium tracking-tight text-cabinet-950 md:text-5xl">
                      {cabinet.slogan || "Une pratique juridique rigoureuse et humaine."}
                    </h2>
                    <div className="relative mx-auto max-w-2xl py-4">
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute -top-4 left-1/2 -translate-x-1/2 font-display text-8xl leading-none text-cabinet-200/80 select-none"
                      >
                        &ldquo;
                      </span>
                      <div className="whitespace-pre-line text-lg sm:text-xl font-medium leading-relaxed text-cabinet-800">
                        {cabinet.presentationTexte}
                      </div>
                    </div>
                    <div className="pt-4">
                      <a
                        href="#contact"
                        className="btn-primary inline-flex items-center gap-2 px-7 py-3 text-sm"
                      >
                        <span>Prendre contact</span>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                          <path d="M5 12h14" />
                          <path d="m12 5 7 7-7 7" />
                        </svg>
                      </a>
                    </div>
                  </div>
                </ScrollReveal>
              )}
            </div>
          </section>
        )}

        {/* Section Nos Valeurs */}
        {hasValeurs && (
          <section id="valeurs" className="relative bg-white py-20">
            <div className="mx-auto max-w-7xl px-6">
              <div className="mx-auto mb-16 max-w-3xl text-center">
                <ScrollReveal>
                  <span className="section-label mb-4 inline-flex border-cabinet-500/30 text-cabinet-600">
                    Nos engagements
                  </span>
                  <h2 className="font-display text-3xl font-medium tracking-tight text-cabinet-900 md:text-5xl">
                    Les principes qui guident notre pratique quotidienne.
                  </h2>
                </ScrollReveal>
              </div>

              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {cabinet.valeurs.map((v, i) => (
                  <ScrollReveal key={i} delay={i * 80}>
                    <SpotlightCard className="h-full border border-cabinet-200/70 bg-gradient-to-b from-white to-cabinet-50/40 p-8 shadow-sm">
                      <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-gold-400/15 text-gold-600 ring-1 ring-gold-400/30">
                        <span className="font-display text-lg font-bold">0{i + 1}</span>
                      </div>
                      <h3 className="text-xl font-semibold text-cabinet-900">{v.titre}</h3>
                      <p className="mt-3 text-sm sm:text-base leading-relaxed text-cabinet-600">{v.description}</p>
                    </SpotlightCard>
                  </ScrollReveal>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Section Spécialités & Expertises */}
        {hasSpecialites && (
          <section id="specialites" className="relative overflow-hidden bg-cabinet-950 py-20 text-white">
            <div className="pointer-events-none absolute inset-0 bg-grid opacity-20" />
            <div className="relative mx-auto max-w-7xl px-6">
              <div className="mx-auto mb-16 max-w-3xl text-center">
                <ScrollReveal>
                  <span className="section-label mb-4 inline-flex border-gold-400/30 text-gold-300">
                    Expertises
                  </span>
                  <h2 className="font-display text-3xl font-medium tracking-tight md:text-5xl">
                    Nos domaines d&apos;intervention.
                  </h2>
                  <p className="mt-4 text-cabinet-200/80 max-w-xl mx-auto text-base">
                    Une expertise pointue pour anticiper, conseiller et défendre vos intérêts devant toutes les juridictions.
                  </p>
                </ScrollReveal>
              </div>

              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {cabinet.specialites.map((s, i) => (
                  <ScrollReveal key={s.id} delay={i * 80}>
                    <SpotlightCard variant="dark" className="flex h-full flex-col justify-between border-white/10 bg-white/[0.04] p-7 transition-all duration-300 hover:border-gold-400/40">
                      <div>
                        <div className="mb-4 flex items-center justify-between">
                          <span className="inline-flex items-center rounded-lg bg-gold-500/15 px-3 py-1 text-xs font-semibold text-gold-300 ring-1 ring-gold-400/20">
                            Expertise
                          </span>
                          <span className="text-xs text-cabinet-400">Réf. {s.code}</span>
                        </div>
                        <h3 className="font-display text-xl font-semibold text-white">{s.libelle}</h3>
                        {s.description && (
                          <p className="mt-3 text-sm leading-relaxed text-cabinet-200/80">{s.description}</p>
                        )}
                      </div>

                      <div className="mt-6 pt-4 border-t border-white/10">
                        <a
                          href={`mailto:${cabinet.email || ""}?subject=${encodeURIComponent(`Demande d'information — ${s.libelle}`)}`}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-gold-300 hover:text-white transition-colors"
                        >
                          <span>Consulter sur ce domaine</span>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
                            <path d="M5 12h14" />
                            <path d="m12 5 7 7-7 7" />
                          </svg>
                        </a>
                      </div>
                    </SpotlightCard>
                  </ScrollReveal>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Section Témoignages */}
        {hasTemoignages && (
          <section id="temoignages" className="relative bg-cabinet-50/70 py-20">
            <div className="mx-auto max-w-7xl px-6">
              <div className="mx-auto mb-16 max-w-3xl text-center">
                <ScrollReveal>
                  <span className="section-label mb-4 inline-flex border-cabinet-500/30 text-cabinet-600">
                    Témoignages
                  </span>
                  <h2 className="font-display text-3xl font-medium tracking-tight text-cabinet-900 md:text-5xl">
                    La confiance de nos clients.
                  </h2>
                </ScrollReveal>
              </div>

              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {temoignages.map((t, i) => (
                  <ScrollReveal key={i} delay={i * 100}>
                    <SpotlightCard className="flex h-full flex-col justify-between border border-cabinet-200/70 bg-white p-8 shadow-sm">
                      <div>
                        {/* 5 étoiles de satisfaction */}
                        <div className="mb-4 flex items-center gap-1 text-gold-500">
                          {Array.from({ length: 5 }).map((_, starIdx) => (
                            <svg key={starIdx} viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                            </svg>
                          ))}
                        </div>
                        <p className="text-sm sm:text-base leading-relaxed text-cabinet-700 italic">
                          &laquo; {t.texte} &raquo;
                        </p>
                      </div>

                      <div className="mt-6 flex items-center gap-3 border-t border-cabinet-100 pt-4">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cabinet-100 font-display font-semibold text-cabinet-800">
                          {t.auteur.charAt(0).toUpperCase()}
                        </span>
                        <div>
                          <p className="font-semibold text-cabinet-900 text-sm">{t.auteur}</p>
                          <p className="text-xs text-cabinet-500">{t.role}</p>
                        </div>
                      </div>
                    </SpotlightCard>
                  </ScrollReveal>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Section Contact & Rendez-vous */}
        {hasContact && (
          <section id="contact" className="relative bg-cabinet-900 py-20 text-white">
            <div className="pointer-events-none absolute inset-0 bg-grid opacity-20" />
            <div className="relative mx-auto max-w-7xl px-6">
              <div className="mx-auto mb-16 max-w-3xl text-center">
                <ScrollReveal>
                  <span className="section-label mb-4 inline-flex border-gold-400/30 text-gold-300">
                    Contact & Rendez-vous
                  </span>
                  <h2 className="font-display text-3xl font-medium tracking-tight md:text-5xl">
                    Échangeons sur votre situation.
                  </h2>
                  <p className="mt-4 text-cabinet-200/80 text-base max-w-lg mx-auto">
                    Notre équipe est à votre écoute pour vous conseiller et définir la stratégie juridique la plus adaptée.
                  </p>
                </ScrollReveal>
              </div>

              {/* Cartes d'information contact */}
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-12">
                {cabinet.adresse && (
                  <ScrollReveal>
                    <SpotlightCard variant="dark" className="h-full border-white/10 bg-white/[0.04]">
                      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-gold-400/20 text-gold-300">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                          <circle cx="12" cy="10" r="3" />
                        </svg>
                      </div>
                      <h3 className="text-sm font-semibold uppercase tracking-wider text-cabinet-300">Adresse</h3>
                      <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-cabinet-100">
                        {cabinet.adresse}
                      </p>
                    </SpotlightCard>
                  </ScrollReveal>
                )}

                {cabinet.telephonePrincipal && (
                  <ScrollReveal delay={100}>
                    <SpotlightCard variant="dark" className="h-full border-white/10 bg-white/[0.04]">
                      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-gold-400/20 text-gold-300">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
                        </svg>
                      </div>
                      <h3 className="text-sm font-semibold uppercase tracking-wider text-cabinet-300">Téléphone</h3>
                      <a
                        href={`tel:${cabinet.telephonePrincipal.replace(/\s+/g, "")}`}
                        className="mt-2 block text-base font-medium text-cabinet-100 hover:text-gold-300 transition-colors"
                      >
                        {cabinet.telephonePrincipal}
                      </a>
                      {cabinet.telephoneSecondaire && (
                        <p className="mt-1 text-sm text-cabinet-300/80">{cabinet.telephoneSecondaire}</p>
                      )}
                    </SpotlightCard>
                  </ScrollReveal>
                )}

                {cabinet.email && (
                  <ScrollReveal delay={200}>
                    <SpotlightCard variant="dark" className="h-full border-white/10 bg-white/[0.04]">
                      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-gold-400/20 text-gold-300">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                          <rect x="2" y="4" width="20" height="16" rx="2" />
                          <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                        </svg>
                      </div>
                      <h3 className="text-sm font-semibold uppercase tracking-wider text-cabinet-300">Email</h3>
                      <a
                        href={`mailto:${cabinet.email}`}
                        className="mt-2 block text-sm font-medium text-cabinet-100 hover:text-gold-300 transition-colors break-all"
                      >
                        {cabinet.email}
                      </a>
                      <p className="mt-1 text-xs text-cabinet-400">Réponse sous 24h ouvrées</p>
                    </SpotlightCard>
                  </ScrollReveal>
                )}

                {cabinet.siteWeb && (
                  <ScrollReveal delay={300}>
                    <SpotlightCard variant="dark" className="h-full border-white/10 bg-white/[0.04]">
                      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-gold-400/20 text-gold-300">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                          <circle cx="12" cy="12" r="10" />
                          <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
                          <path d="M2 12h20" />
                        </svg>
                      </div>
                      <h3 className="text-sm font-semibold uppercase tracking-wider text-cabinet-300">Site web</h3>
                      <a
                        href={cabinet.siteWeb}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 block text-sm font-medium text-cabinet-100 hover:text-gold-300 transition-colors break-all"
                      >
                        {cabinet.siteWeb.replace(/^https?:\/\//, "")}
                      </a>
                    </SpotlightCard>
                  </ScrollReveal>
                )}
              </div>

              {/* Bloc d'action directe de contact / prise de RDV */}
              <ScrollReveal delay={250}>
                <div className="rounded-3xl border border-gold-400/30 bg-gradient-to-r from-cabinet-950/90 via-cabinet-900 to-cabinet-950/90 p-8 md:p-10 shadow-2xl backdrop-blur-xl">
                  <div className="flex flex-col items-center justify-between gap-6 text-center md:flex-row md:text-left">
                    <div className="space-y-2">
                      <h3 className="font-display text-2xl font-medium text-white md:text-3xl">
                        Besoin d&apos;une consultation juridique ?
                      </h3>
                      <p className="text-sm sm:text-base text-cabinet-200/80 max-w-xl">
                        Adressez-nous les éléments clés de votre dossier ou contactez notre secrétariat pour convenir d&apos;un créneau d&apos;échange.
                      </p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3 shrink-0">
                      {cabinet.telephonePrincipal && (
                        <a
                          href={`tel:${cabinet.telephonePrincipal.replace(/\s+/g, "")}`}
                          className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-6 py-3 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/20 active:scale-[0.98]"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
                          </svg>
                          <span>Appeler</span>
                        </a>
                      )}
                      {cabinet.email && (
                        <a
                          href={`mailto:${cabinet.email}?subject=${encodeURIComponent(`Demande de consultation — ${cabinet.raisonSociale}`)}`}
                          className="inline-flex items-center justify-center gap-2 rounded-xl bg-gold-400 px-6 py-3 text-sm font-semibold text-cabinet-950 shadow-lg shadow-gold-500/20 transition hover:bg-gold-300 active:scale-[0.98]"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                            <rect x="2" y="4" width="20" height="16" rx="2" />
                            <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                          </svg>
                          <span>Écrire par email</span>
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </ScrollReveal>
            </div>
          </section>
        )}

        {/* Bannière de conclusion avec le slogan */}
        <section className="border-t border-white/10 bg-cabinet-950 py-14 text-white">
          <div className="mx-auto max-w-7xl px-6 text-center">
            <ScrollReveal>
              <h3 className="font-display text-2xl sm:text-3xl md:text-4xl font-medium leading-tight max-w-3xl mx-auto">
                {cabinet.slogan || "Un accompagnement juridique rigoureux et confidentiel."}
              </h3>
              <p className="mt-3 text-sm text-cabinet-400">
                {cabinet.description || "Cabinet Juridique Multidisciplinaire"}
              </p>
            </ScrollReveal>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-white/10 bg-cabinet-950 py-10 text-cabinet-300/70">
          <div className="mx-auto max-w-7xl px-6 text-center space-y-3">
            <p className="text-xs sm:text-sm">
              &copy; {new Date().getFullYear()} {cabinet.raisonSociale}. Tous droits réservés.
            </p>
            {cabinet.identifiantFiscal && (
              <p className="text-[11px] text-cabinet-400/80">
                Identifiant fiscal : {cabinet.identifiantFiscal}
              </p>
            )}
            <p className="pointer-events-none select-none text-[10px] font-medium leading-relaxed tracking-[0.2em] text-cabinet-400/30 pt-2">
              Conception : yaguediagne.it@gmail.com | +221 77 514 74 41 | +221 77 712 61 39
            </p>
          </div>
        </footer>
      </main>
    </div>
  );
}

