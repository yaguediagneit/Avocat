import type { Metadata } from "next";
import { AideClient } from "./aide-client";

export const metadata: Metadata = {
  title: "Aide & Guide — Plateforme de gestion juridique",
  description:
    "Guide complet d'utilisation de la plateforme de gestion juridique multidisciplinaire : dossiers, clients, tâches, calendrier, comptabilité, facturation, espace client.",
};

export default function AidePage() {
  return <AideClient />;
}
