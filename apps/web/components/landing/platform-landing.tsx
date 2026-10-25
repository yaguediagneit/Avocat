import Link from "next/link";
import { AuroraBackground } from "@/components/landing/aurora";
import { HeroVisual } from "@/components/landing/hero-visual";
import { NavHeader } from "@/components/landing/nav-header";
import { ScrollReveal } from "@/components/landing/scroll-reveal";
import { SpotlightCard } from "@/components/landing/spotlight-card";
import { FeatureIcon } from "@/components/landing/feature-icon";
import { Marquee } from "@/components/landing/marquee";
import { AnimatedCounter } from "@/components/landing/animated-counter";
import { LandingFaq } from "@/components/landing/landing-faq";

export interface PlanData {
  id: string;
  nom: string;
  joursEssai: number;
  modules: string[];
  nbUtilisateurs: number | null;
  support: { mail?: boolean; telephone?: boolean; prioritaire?: boolean };
  prixMensuel: number;
  prixAnnuel: number;
}

export function PlatformLanding({ plans }: { plans: PlanData[] }) {
  const formattedPrice = (p: number) => p.toLocaleString("fr-FR");
  return (
    <div className="landing-root">
      <NavHeader />
      <main className="overflow-x-hidden">
        <section className="relative flex min-h-[85vh] items-center overflow-hidden bg-cabinet-950 pt-20 text-white">
          <AuroraBackground />
          <div className="pointer-events-none absolute inset-0 bg-grid opacity-40" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-cabinet-950/0 via-cabinet-950/30 to-cabinet-950" />

          <div className="relative mx-auto grid w-full max-w-7xl items-center gap-8 px-6 py-12 lg:grid-cols-2">
            <ScrollReveal className="flex flex-col items-start gap-6" duration={1}>
              <span className="section-label text-gold-300/80">
                Cabinet juridique — Sénégal
              </span>
              <h1 className="font-display text-5xl font-medium leading-[1.05] tracking-tight text-balance md:text-7xl lg:text-8xl">
                La gestion des dossiers, <span className="gradient-text">réinventée.</span>
              </h1>
              <p className="max-w-xl text-lg leading-relaxed text-cabinet-100/80 md:text-xl">
                Une plateforme collaborative pensée pour avocats, huissiers de justice, assistants juridiques et fonctions administratives au Sénégal.
              </p>
              <div className="flex flex-col gap-4 sm:flex-row">
                <Link href="/login" className="btn-primary px-8 py-3 text-base">
                  Accéder au cabinet
                </Link>
                <a
                  href="#fonctionnalites"
                  className="inline-flex items-center justify-center rounded-lg border border-white/20 bg-white/10 px-8 py-3 text-base font-medium text-white backdrop-blur-sm transition hover:bg-white/15 active:scale-[0.98]"
                >
                  Découvrir
                </a>
              </div>
            </ScrollReveal>

            <div className="hidden h-[22rem] lg:block">
              <HeroVisual />
            </div>
          </div>

          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-cabinet-300 animate-bounce">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14" />
              <path d="m19 12-7 7-7-7" />
            </svg>
          </div>
        </section>

        <section className="border-y border-cabinet-200 bg-white py-4">
          <div className="mx-auto max-w-7xl px-6">
            <p className="mb-5 text-center text-xs font-semibold uppercase tracking-widest text-cabinet-500">
              Conçu pour les professionnels du droit
            </p>
            <Marquee pauseOnHover>
              {["Avocats", "Huissiers", "Assistants juridiques", "Greffiers", "Conseils juridiques", "Clercs"].map((item) => (
                <span key={item} className="inline-flex items-center rounded-full border border-cabinet-100 bg-cabinet-50 px-5 py-2 text-sm font-medium text-cabinet-700">
                  {item}
                </span>
              ))}
            </Marquee>
          </div>
        </section>

        <section id="fonctionnalites" className="relative bg-cabinet-50 py-14">
          <div className="mx-auto max-w-7xl px-6">
            <div className="mx-auto mb-20 max-w-3xl text-center">
              <ScrollReveal>
                <span className="section-label mb-4 inline-flex text-cabinet-600">Fonctionnalités</span>
                <h2 className="font-display text-3xl font-medium tracking-tight text-cabinet-900 md:text-5xl">
                  Tout ce qui fait tenir un cabinet, dans un seul outil.
                </h2>
                <p className="mt-4 text-cabinet-600">
                  Gestion des dossiers, clients, documents, échéances, audiences et facturation.
                </p>
              </ScrollReveal>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {features.map((feature, i) => (
                <ScrollReveal key={feature.title} delay={i * 100} duration={0.7}>
                  <SpotlightCard className={`h-full border ${feature.border} ${feature.bg}`}>
                    <div className={`mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl ${feature.iconBg} ${feature.iconColor} transition duration-500`}>
                      <FeatureIcon name={feature.icon} />
                    </div>
                    <h3 className={`text-lg font-semibold ${feature.titleColor}`}>{feature.title}</h3>
                    <p className={`mt-2 text-sm leading-relaxed ${feature.descColor}`}>{feature.desc}</p>
                  </SpotlightCard>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        <section id="securite" className="relative overflow-hidden bg-cabinet-950 py-14 text-white">
          <AuroraBackground />
          <div className="pointer-events-none absolute inset-0 bg-grid opacity-30" />
          <div className="relative mx-auto max-w-7xl px-6">
            <div className="grid items-center gap-16 lg:grid-cols-2">
              <ScrollReveal>
                <span className="section-label mb-4 inline-flex text-cabinet-300/80">Sécurité</span>
                <h2 className="font-display text-3xl font-medium leading-tight tracking-tight md:text-5xl">
                  Souveraineté et conformité, par conception.
                </h2>
                <p className="mt-6 max-w-xl leading-relaxed text-cabinet-100/70">
                  Chiffrement AES-256, RBAC granulaire, journal d&apos;audit immuable et conformité CDP Sénégal. Vos données restent sous votre contrôle.
                </p>
                <Link href="/login" className="btn-primary mt-8 px-8 py-3 text-base">
                  Explorer la sécurité
                </Link>
              </ScrollReveal>

              <div className="grid gap-6 sm:grid-cols-2">
                {security.map((item, i) => (
                  <ScrollReveal key={item.title} delay={i * 100} duration={0.7}>
                    <SpotlightCard variant="dark" className="h-full">
                      <div className="mb-3 text-3xl font-semibold text-white">
                        {item.value}
                      </div>
                      <h4 className="text-sm font-semibold text-cabinet-100">{item.title}</h4>
                      <p className="mt-1 text-sm leading-relaxed text-cabinet-200/60">{item.desc}</p>
                    </SpotlightCard>
                  </ScrollReveal>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white py-14">
          <div className="mx-auto max-w-7xl px-6">
            <div className="mx-auto mb-20 max-w-3xl text-center">
              <ScrollReveal>
                <span className="section-label mb-4 inline-flex text-cabinet-600">Comment ça marche</span>
                <h2 className="font-display text-3xl font-medium tracking-tight text-cabinet-900 md:text-5xl">
                  Déployez votre cabinet en trois étapes.
                </h2>
              </ScrollReveal>
            </div>

            <div className="relative grid gap-8 md:grid-cols-3">
              {steps.map((step, i) => (
                <ScrollReveal key={step.title} delay={i * 120}>
                  <div className="relative h-full rounded-2xl border border-cabinet-100 bg-cabinet-50 p-8">
                    <span className="mb-6 block font-display text-6xl font-medium text-cabinet-200">{step.number}</span>
                    <h3 className="text-lg font-semibold text-cabinet-900">{step.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-cabinet-600">{step.desc}</p>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-cabinet-200/80 bg-cabinet-50/50 py-16">
          <div className="mx-auto max-w-7xl px-6">
            <div className="grid grid-cols-2 gap-6 md:grid-cols-4 md:gap-8">
              <ScrollReveal delay={0}>
                <div className="flex flex-col items-center text-center p-6 rounded-2xl bg-white border border-cabinet-100 shadow-sm">
                  <span className="font-display text-4xl sm:text-5xl font-bold text-cabinet-900">
                    <AnimatedCounter value={5000} prefix="+" />
                  </span>
                  <span className="mt-2 text-xs sm:text-sm font-semibold text-cabinet-600 uppercase tracking-wider">
                    Dossiers & Actes gérés
                  </span>
                </div>
              </ScrollReveal>
              <ScrollReveal delay={100}>
                <div className="flex flex-col items-center text-center p-6 rounded-2xl bg-white border border-cabinet-100 shadow-sm">
                  <span className="font-display text-4xl sm:text-5xl font-bold text-gold-500">
                    <AnimatedCounter value={100} suffix="%" />
                  </span>
                  <span className="mt-2 text-xs sm:text-sm font-semibold text-cabinet-600 uppercase tracking-wider">
                    SYSCOHADA & CDP Sénégal
                  </span>
                </div>
              </ScrollReveal>
              <ScrollReveal delay={200}>
                <div className="flex flex-col items-center text-center p-6 rounded-2xl bg-white border border-cabinet-100 shadow-sm">
                  <span className="font-display text-4xl sm:text-5xl font-bold text-cabinet-900">
                    <AnimatedCounter value={99} suffix=".9%" />
                  </span>
                  <span className="mt-2 text-xs sm:text-sm font-semibold text-cabinet-600 uppercase tracking-wider">
                    Disponibilité Haute Sécurité
                  </span>
                </div>
              </ScrollReveal>
              <ScrollReveal delay={300}>
                <div className="flex flex-col items-center text-center p-6 rounded-2xl bg-white border border-cabinet-100 shadow-sm">
                  <span className="font-display text-4xl sm:text-5xl font-bold text-gold-500">
                    <AnimatedCounter value={3} prefix="x" />
                  </span>
                  <span className="mt-2 text-xs sm:text-sm font-semibold text-cabinet-600 uppercase tracking-wider">
                    Rapidité de traitement
                  </span>
                </div>
              </ScrollReveal>
            </div>
          </div>
        </section>

        <section id="faq" className="bg-white py-20">
          <div className="mx-auto max-w-7xl px-6">
            <div className="mx-auto mb-16 max-w-3xl text-center">
              <ScrollReveal>
                <span className="section-label mb-4 inline-flex text-cabinet-600">FAQ</span>
                <h2 className="font-display text-3xl font-medium tracking-tight text-cabinet-900 md:text-5xl">
                  Questions fréquentes.
                </h2>
                <p className="mt-4 text-cabinet-600 text-base">
                  Retrouvez les réponses aux interrogations courantes des cabinets d&apos;avocats et professionnels du droit.
                </p>
              </ScrollReveal>
            </div>
            <ScrollReveal delay={100}>
              <LandingFaq />
            </ScrollReveal>
          </div>
        </section>

        <section id="offre" className="relative overflow-hidden bg-cabinet-900 py-16 text-white">
          <AuroraBackground />
          <div className="pointer-events-none absolute inset-0 bg-grid opacity-20" />
          <div className="relative mx-auto max-w-7xl px-6">
            <div className="mx-auto mb-14 max-w-3xl text-center">
              <ScrollReveal>
                <span className="section-label mb-4 inline-flex text-cabinet-300/80">Tarification transparente</span>
                <h2 className="font-display text-3xl font-medium tracking-tight md:text-5xl">
                  Choisissez votre plan
                </h2>
                <p className="mt-4 text-cabinet-100/70">
                  Sans engagement. Passez au plan supérieur à tout moment.
                </p>
              </ScrollReveal>
            </div>

            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3 items-stretch">
              {plans.map((plan, i) => {
                const isFeatured = i === 1 || plan.nom.toLowerCase().includes("cabinet");
                const theme = PLAN_THEMES[i % PLAN_THEMES.length];
                return (
                  <ScrollReveal key={plan.id} delay={i * 100} className="h-full">
                    <div
                      className={`relative flex h-full flex-col rounded-3xl border p-8 shadow-2xl backdrop-blur-xl transition-all duration-300 ${
                        isFeatured ? "ring-2 ring-gold-400 scale-[1.02]" : ""
                      } ${theme.card}`}
                    >
                      {isFeatured && (
                        <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-gold-400 px-4 py-1 text-[11px] font-bold uppercase tracking-wider text-cabinet-950 shadow-md">
                          Le plus choisi
                        </span>
                      )}
                      <div className={`mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl ${theme.iconBg}`}>
                        {theme.icon}
                      </div>
                      <h3 className={`text-center text-xl font-semibold ${theme.title}`}>{plan.nom}</h3>
                      <div className="mt-6 text-center">
                        <span className={`font-display text-4xl font-medium ${theme.price}`}>
                          {plan.prixMensuel > 0 ? `${formattedPrice(plan.prixMensuel)} XOF` : "Sur devis"}
                        </span>
                        <span className={theme.muted}>{plan.prixMensuel > 0 ? " / mois" : ""}</span>
                      </div>
                      {plan.joursEssai > 0 && (
                        <p className={`mt-2 text-center text-xs ${theme.muted}`}>
                          {plan.joursEssai} jours d&apos;essai gratuit
                        </p>
                      )}
                      <div className="mt-3 text-center text-xs">
                        <span className={theme.muted}>
                          {plan.nbUtilisateurs === null || plan.nbUtilisateurs === undefined
                            ? "Utilisateurs illimités"
                            : `Jusqu'à ${plan.nbUtilisateurs} utilisateurs`}
                        </span>
                      </div>
                      {Object.values(plan.support || {}).some(Boolean) && (
                        <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-[10px]">
                          {plan.support.mail && <span className={`rounded-full px-2 py-0.5 ${theme.iconBg} ${theme.iconColor}`}>Support par mail</span>}
                          {plan.support.telephone && <span className={`rounded-full px-2 py-0.5 ${theme.iconBg} ${theme.iconColor}`}>Support téléphone</span>}
                          {plan.support.prioritaire && <span className={`rounded-full px-2 py-0.5 ${theme.iconBg} ${theme.iconColor}`}>Prioritaire</span>}
                        </div>
                      )}
                      <ul className={`mt-8 flex-1 space-y-3 text-sm ${theme.list}`}>
                        {plan.modules.length === 0 ? (
                          <li className={theme.muted}>Modules personnalisables.</li>
                        ) : (
                          plan.modules.map((module, idx) => (
                            <li key={idx} className="flex items-center gap-3">
                              <svg className={`h-5 w-5 shrink-0 ${theme.check}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 12 2 2 4-4" /></svg>
                              <span>{module}</span>
                            </li>
                          ))
                        )}
                      </ul>
                      <Link href="/login" className={`mt-8 w-full rounded-xl py-3 text-center text-base font-medium transition active:scale-[0.98] ${theme.button}`}>
                        Commencer l&apos;essai
                      </Link>
                    </div>
                  </ScrollReveal>
                );
              })}
            </div>
          </div>
        </section>

        <section className="bg-cabinet-950 pb-14 pt-10 text-white">
          <div className="mx-auto max-w-7xl px-6">
            <div className="grid gap-12 lg:grid-cols-2">
              <ScrollReveal>
                <h3 className="font-display text-3xl font-medium leading-tight md:text-4xl">
                  Modernisez votre pratique dès aujourd&apos;hui.
                </h3>
              </ScrollReveal>
              <ScrollReveal delay={100}>
                <div className="flex flex-col gap-4 sm:flex-row">
                  <Link href="/login" className="btn-primary px-8 py-3 text-base">
                    Accéder au cabinet
                  </Link>
                  <a href="#fonctionnalites" className="inline-flex items-center justify-center rounded-lg border border-white/20 bg-white/10 px-8 py-3 text-base font-medium text-white backdrop-blur-sm transition hover:bg-white/15 active:scale-[0.98]">
                    Voir les fonctionnalités
                  </a>
                </div>
              </ScrollReveal>
            </div>
          </div>
        </section>

        <footer className="border-t border-white/10 bg-cabinet-950 py-10 text-cabinet-300/60">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 text-sm md:flex-row">
            <p>&copy; 2026 cabinet-avocat.sn. Tous droits réservés.</p>
            <p className="pointer-events-none select-none text-center text-[10px] font-medium leading-relaxed tracking-[0.2em] text-cabinet-300/25 md:text-right">
              Conception : yaguediagne.it@gmail.com | +221 77 514 74 41 | +221 77 712 61 39
            </p>
            <div className="flex gap-6 text-xs text-cabinet-300/80">
              <a href="#securite" className="transition hover:text-white">Confidentialité & Sécurité</a>
              <a href="#faq" className="transition hover:text-white">Conditions & FAQ</a>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}

const PLAN_THEMES = [
  {
    card: "border-cabinet-200 bg-white text-cabinet-900 shadow-cabinet-200/30",
    iconBg: "bg-cabinet-100 text-cabinet-700",
    iconColor: "text-cabinet-700",
    icon: <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>,
    title: "text-cabinet-900",
    price: "text-cabinet-900",
    muted: "text-cabinet-500",
    list: "text-cabinet-700",
    check: "text-cabinet-600",
    button: "border border-cabinet-900 text-cabinet-900 hover:bg-cabinet-100",
  },
  {
    card: "border-indigo-500/50 bg-indigo-600 text-white shadow-indigo-900/40",
    iconBg: "bg-white/20 text-white",
    iconColor: "text-white",
    icon: <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg>,
    title: "text-white",
    price: "text-white",
    muted: "text-indigo-100",
    list: "text-indigo-100",
    check: "text-white",
    button: "bg-white text-indigo-600 hover:bg-indigo-50",
  },
  {
    card: "border-gold-400/50 bg-cabinet-900 text-white shadow-cabinet-950/40",
    iconBg: "bg-gold-400/20 text-gold-300",
    iconColor: "text-gold-300",
    icon: <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
    title: "text-white",
    price: "text-white",
    muted: "text-cabinet-300",
    list: "text-cabinet-100",
    check: "text-gold-400",
    button: "bg-gold-400 text-cabinet-900 hover:bg-gold-300",
  },
];

const features = [
  {
    title: "Tableau de bord",
    desc: "Vue d'ensemble instantanée : dossiers actifs, clients, événements à venir et tâches en cours.",
    icon: "dashboard" as const,
    bg: "bg-blue-50/50",
    border: "border-blue-200",
    iconBg: "bg-blue-100",
    iconColor: "text-blue-700",
    titleColor: "text-blue-900",
    descColor: "text-blue-700",
  },
  {
    title: "Clients",
    desc: "Base de données clients, conflits d'intérêts, contacts et représentants.",
    icon: "users" as const,
    bg: "bg-emerald-50/50",
    border: "border-emerald-200",
    iconBg: "bg-emerald-100",
    iconColor: "text-emerald-700",
    titleColor: "text-emerald-900",
    descColor: "text-emerald-700",
  },
  {
    title: "Dossiers",
    desc: "Cœur du métier juridique : affaires, workflow, statuts et historique immuable.",
    icon: "dossiers" as const,
    bg: "bg-cabinet-50/50",
    border: "border-cabinet-200",
    iconBg: "bg-cabinet-100",
    iconColor: "text-cabinet-700",
    titleColor: "text-cabinet-900",
    descColor: "text-cabinet-700",
  },
  {
    title: "Tâches",
    desc: "Suivi des tâches, génération de documents PDF et modèles personnalisables.",
    icon: "taches" as const,
    bg: "bg-amber-50/50",
    border: "border-amber-200",
    iconBg: "bg-amber-100",
    iconColor: "text-amber-700",
    titleColor: "text-amber-900",
    descColor: "text-amber-700",
  },
  {
    title: "Calendrier",
    desc: "Audiences, échéances, rendez-vous et significations centralisés.",
    icon: "calendrier" as const,
    bg: "bg-rose-50/50",
    border: "border-rose-200",
    iconBg: "bg-rose-100",
    iconColor: "text-rose-700",
    titleColor: "text-rose-900",
    descColor: "text-rose-700",
  },
  {
    title: "Missions",
    desc: "Actes d'huissier, missions externes et suivis auprès des tribunaux.",
    icon: "missions" as const,
    bg: "bg-purple-50/50",
    border: "border-purple-200",
    iconBg: "bg-purple-100",
    iconColor: "text-purple-700",
    titleColor: "text-purple-900",
    descColor: "text-purple-700",
  },
  {
    title: "Documents",
    desc: "Gestion, partage, chiffrement et audit de consultation des documents.",
    icon: "documents" as const,
    bg: "bg-cyan-50/50",
    border: "border-cyan-200",
    iconBg: "bg-cyan-100",
    iconColor: "text-cyan-700",
    titleColor: "text-cyan-900",
    descColor: "text-cyan-700",
  },
  {
    title: "Facturation",
    desc: "Factures, paiements, relances et suivi de la trésorerie.",
    icon: "factures" as const,
    bg: "bg-green-50/50",
    border: "border-green-200",
    iconBg: "bg-green-100",
    iconColor: "text-green-700",
    titleColor: "text-green-900",
    descColor: "text-green-700",
  },
  {
    title: "Administration",
    desc: "Demandes clients et appels, pièces manquantes, audiences, formalités, missions et courrier.",
    icon: "administration" as const,
    bg: "bg-gold-50/50",
    border: "border-gold-200",
    iconBg: "bg-gold-100",
    iconColor: "text-cabinet-800",
    titleColor: "text-cabinet-900",
    descColor: "text-cabinet-700",
  },
  {
    title: "Comptabilité Syscohada",
    desc: "Écritures automatisées, rapports comptables, rapports annuels et mensuels.",
    icon: "comptabilite" as const,
    bg: "bg-indigo-50/50",
    border: "border-indigo-200",
    iconBg: "bg-indigo-100",
    iconColor: "text-indigo-700",
    titleColor: "text-indigo-900",
    descColor: "text-indigo-700",
  },
  {
    title: "Gestion du personnel",
    desc: "Employés, fiches de paie, bulletins et suivi salarial.",
    icon: "personnel" as const,
    bg: "bg-teal-50/50",
    border: "border-teal-200",
    iconBg: "bg-teal-100",
    iconColor: "text-teal-700",
    titleColor: "text-teal-900",
    descColor: "text-teal-700",
  },
  {
    title: "Portail Web",
    desc: "Landing page stylée, cinématographique et entièrement paramétrable pour chaque cabinet.",
    icon: "portail" as const,
    bg: "bg-rose-50/50",
    border: "border-rose-200",
    iconBg: "bg-rose-100",
    iconColor: "text-rose-700",
    titleColor: "text-rose-900",
    descColor: "text-rose-700",
  },
];

const security = [
  { value: "AES-256", title: "Chiffrement", desc: "Au repos et en transit, sans compromis." },
  { value: "CDP", title: "Conformité Sénégal", desc: "Aligné à la Commission de Protection des Données." },
  { value: "MFA", title: "Authentification", desc: "TOTP et second facteur pour chaque compte." },
  { value: "TLS 1.3", title: "Transport", desc: "Canaux sécurisés pour toutes les communications." },
];

const steps = [
  { number: "01", title: "Créez votre cabinet", desc: "Configurez votre structure, vos utilisateurs et vos rôles en quelques minutes." },
  { number: "02", title: "Importez vos dossiers", desc: "Migrer vos affaires existantes ou démarrez un nouveau dossier structuré." },
  { number: "03", title: "Travaillez sereinement", desc: "Gérez, partagez et suivez chaque étape avec une traçabilité complète." },
];
