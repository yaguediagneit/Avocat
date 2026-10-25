"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface FaqItem {
  question: string;
  answer: string;
}

const FAQ_ITEMS: FaqItem[] = [
  {
    question: "Mes données et dossiers clients sont-ils sécurisés et conformes à la CDP Sénégal ?",
    answer:
      "Absolument. La plateforme applique un chiffrement fort AES-256 pour les pièces jointes, TLS 1.3 en transit, et une isolation multi-tenant stricte de la base de données. Chaque action fait l'objet d'une piste d'audit immuable, dans le strict respect de la Commission de Protection des Données Personnelles (CDP) du Sénégal.",
  },
  {
    question: "Quels rôles et professionnels du droit peuvent collaborer sur la plateforme ?",
    answer:
      "Le système est conçu pour tous les acteurs du cabinet : avocats associés, collaborateurs internes, huissiers de justice partenaires (pour la signification des actes et les missions externes), assistants juridiques, comptables et clients via leur espace dédié sécurisé.",
  },
  {
    question: "La comptabilité est-elle conforme aux normes OHADA ?",
    answer:
      "Oui. Le module de gestion financière est nativement conforme au système comptable SYSCOHADA révisé. Les écritures de facturation et de charges sont automatisées, avec génération du Bilan, Compte de résultat, SIG, tableaux de flux et suivi des dotations aux amortissements.",
  },
  {
    question: "Puis-je personnaliser la vitrine web et les modèles d'actes pour mon cabinet ?",
    answer:
      "Tout à fait. Chaque cabinet dispose d'un site vitrine haut de gamme configurable (couleurs de marque, typographie, carrousel d'accueil, expertises, valeurs, coordonnées) ainsi que d'un moteur de génération de documents PDF et Word avec fusion automatique des variables du dossier.",
  },
  {
    question: "Comment se déroule la migration de nos dossiers et contacts existants ?",
    answer:
      "Nous proposons des modèles d'importation structurés et une assistance technique pour intégrer facilement votre portefeuille de clients, vos affaires en cours et vos modèles de procédure sans interruption d'activité.",
  },
  {
    question: "Comment fonctionne la période d'essai ?",
    answer:
      "Vous bénéficiez d'une période d'essai gratuit selon le plan choisi, avec accès à toutes les fonctionnalités clés. Vous pouvez configurer vos premiers dossiers, inviter votre équipe et évaluer la solution en conditions réelles.",
  },
];

export function LandingFaq() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggle = (idx: number) => {
    setOpenIndex((curr) => (curr === idx ? null : idx));
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {FAQ_ITEMS.map((item, idx) => {
        const isOpen = openIndex === idx;
        return (
          <div
            key={idx}
            className={cn(
              "rounded-2xl border transition-all duration-300 backdrop-blur-sm",
              isOpen
                ? "border-gold-400/40 bg-white shadow-md shadow-cabinet-900/5 ring-1 ring-gold-400/20"
                : "border-cabinet-200/80 bg-white/70 hover:border-cabinet-300 hover:bg-white"
            )}
          >
            <button
              type="button"
              onClick={() => toggle(idx)}
              aria-expanded={isOpen}
              className="flex w-full items-center justify-between gap-4 p-5 sm:p-6 text-left"
            >
              <span className="font-display text-base font-semibold text-cabinet-950 sm:text-lg">
                {item.question}
              </span>
              <span
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-all duration-300",
                  isOpen
                    ? "border-gold-400 bg-gold-400 text-cabinet-950 rotate-180"
                    : "border-cabinet-200 bg-cabinet-50 text-cabinet-600"
                )}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </span>
            </button>

            {isOpen && (
              <div className="px-5 pb-5 pt-0 sm:px-6 sm:pb-6 text-sm sm:text-base leading-relaxed text-cabinet-700 animate-fade-in">
                <div className="h-px w-full bg-cabinet-100 mb-4" />
                <p>{item.answer}</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
