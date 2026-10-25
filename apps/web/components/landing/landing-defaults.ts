export interface HeroSlide {
  titre: string;
  detail: string;
  couleur?: string;
  police?: string;
  tailleTitre?: string;
  tailleDetail?: string;
  cta?: string;
}

export const defaultHero: HeroSlide[] = [
  {
    titre: "Un partenaire de confiance",
    detail:
      "Nous construisons avec chaque client une relation fondée sur l’écoute, la transparence et la fiabilité.",
    couleur: "",
    police: "",
    tailleTitre: "",
    tailleDetail: "",
    cta: "Contactez-nous",
  },
  {
    titre: "Votre défense, notre priorité",
    detail:
      "Une expertise juridique complète et adaptée à vos besoins, avec une équipe dévouée à votre service.",
    couleur: "",
    police: "",
    tailleTitre: "",
    tailleDetail: "",
    cta: "Contactez-nous",
  },
  {
    titre: "Expertise & innovation juridique",
    detail:
      "Nous intégrons les outils modernes dans notre pratique pour anticiper et sécuriser vos solutions juridiques.",
    couleur: "",
    police: "",
    tailleTitre: "",
    tailleDetail: "",
    cta: "Contactez-nous",
  },
];
