import Link from "next/link";
import { notFound } from "next/navigation";
import { cn } from "@/lib/utils";
import { DemandesAppelsClient } from "../_components/demandes-appels-client";
import { PiecesManquantesClient } from "../_components/pieces-manquantes-client";
import { AudiencesClient } from "../_components/audiences-client";
import { FormalitesClient } from "../_components/formalites-client";
import { MissionsClient } from "../_components/missions-client";
import { CourrierClient } from "../_components/courrier-client";
import { ContratsClient } from "../_components/contrats-client";

const SECTIONS: Record<string, string> = {
  demandes: "Demandes clients et registre des appels",
  "pieces-manquantes": "Suivi des pièces manquantes et relances",
  audiences: "Préparation des audiences et réunions",
  formalites: "Suivi des formalités auprès des tribunaux et administrations",
  missions: "Gestion des missions confiées aux huissiers, experts et autres prestataires",
  courrier: "Gestion du courrier (réception, sortants, création de lettres)",
  contrats: "Contrats & actes — catalogue et création de contrats juridiques",
};

export default function AdministrationSectionPage({
  params,
}: {
  params: { section: string };
}) {
  const label = SECTIONS[params.section];
  if (!label) return notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{label}</h1>
        <Link href="/cabinet" className="text-sm text-cabinet-700 hover:underline">
          ← Retour
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Object.entries(SECTIONS).map(([slug, title]) => (
          <Link
            key={slug}
            href={`/cabinet/administration/${slug}`}
            className={cn(
              "rounded-lg border p-4 transition hover:shadow-sm",
              slug === params.section
                ? "border-gold-400 bg-gold-50"
                : "border-gray-200 bg-white hover:bg-gray-50"
            )}
          >
            <h2 className="font-medium">{title}</h2>
          </Link>
        ))}
        <Link
          href="/cabinet/dossiers/demarches"
          className="rounded-lg border border-indigo-200 bg-indigo-50/50 p-4 transition hover:shadow-sm"
        >
          <h2 className="font-medium">
            Démarches administratives (foncier, urbanisme, fiscalité) →
          </h2>
          <p className="mt-1 text-xs text-gray-500">
            Cadastre, DGID, Domaines, Conservation foncière, mairies, Urbanisme — module dédié.
          </p>
        </Link>
      </div>

      {params.section === "demandes" ? (
        <DemandesAppelsClient />
      ) : params.section === "pieces-manquantes" ? (
        <PiecesManquantesClient />
      ) : params.section === "audiences" ? (
        <AudiencesClient />
      ) : params.section === "formalites" ? (
        <FormalitesClient />
      ) : params.section === "missions" ? (
        <MissionsClient />
      ) : params.section === "courrier" ? (
        <CourrierClient />
      ) : params.section === "contrats" ? (
        <ContratsClient />
      ) : (
        <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-gray-500">
          Module en cours d&apos;intégration.
        </div>
      )}
    </div>
  );
}
