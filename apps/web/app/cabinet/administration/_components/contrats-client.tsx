"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  TRANSACTION_FAMILLES,
  TRANSACTION_STATUT_LABELS,
} from "@/lib/transactions";
import {
  extractTemplateVariables,
  renderDocumentTemplate,
} from "@/lib/document-template";

const FAMILLE_LABELS = Object.fromEntries(
  TRANSACTION_FAMILLES.map((f) => [f.code, f.label])
);
const FAMILLE_ORDRE: string[] = TRANSACTION_FAMILLES.map((f) => f.code);

/// Valeurs d'exemple (données fictives sénégalaises) utilisées pour
/// prévisualiser chaque modèle rempli.
const EXEMPLES: Record<string, string> = {
  reference_transaction: "CTX-2026-00042",
  cabinet_nom: "Cabinet FASS & Associés",
  cabinet_adresse: "64X HLM Fass, Dakar",
  cabinet_telephone: "+221 33 800 00 00",
  lieu_signature: "Dakar",
  date_signature: "15/10/2026",
  date_debut: "01/11/2026",
  nb_originaux: "3",
  bailleur_nom: "Mamadou FALL",
  bailleur_adresse: "HLM Grand Yoff, Dakar",
  bailleur_telephone: "+221 77 555 12 34",
  locataire_nom: "Aminata NDIAYE",
  locataire_adresse: "Sacré-Cœur 3, Dakar",
  locataire_telephone: "+221 77 123 45 67",
  vendeur_nom: "Ibrahima SARR",
  acheteur_nom: "Fatou DIAGNE",
  mandant_nom: "Ousmane BA",
  mandant_adresse: "Médina, Dakar",
  mandant_telephone: "+221 77 765 43 21",
  mandataire_nom: "AGENCE IMMO FASS",
  mandataire_adresse: "64X HLM Fass, Dakar",
  mandataire_telephone: "+221 77 712 61 39",
  employeur_nom: "SENBUSINESS SARL",
  salarie_nom: "Marième CISSE",
  stagiaire_nom: "Adama NDIAYE",
  prestataire_nom: "NEXA SERVICES SARL",
  donneur_ordre_nom: "DISTRIMED SARL",
  apporteur_nom: "Modou GUEYE",
  cedant_nom: "Cheikh NDIAYE",
  cessionnaire_nom: "SOPRAMEC SARL",
  debiteur_nom: "Moussa THIAM",
  creancier_nom: "Aïssatou DIALLO",
  caution_nom: "Abdoulaye KANE",
  associe_nom: "Seynabou LO",
  notaire_nom: "Me Astou MBENGUE, notaire à Dakar",
  nature_mandat: "exclusif",
};

function valeurExemple(cle: string, label: string): string {
  if (EXEMPLES[cle]) return EXEMPLES[cle];
  const k = `${cle} ${label}`.toLowerCase();
  if (/adresse/.test(k)) return "Avenue Cheikh Anta Diop, Dakar";
  if (/telephone|tel\b|tél/.test(k)) return "+221 77 123 45 67";
  if (/email|mail/.test(k)) return "contact@exemple.sn";
  if (/rccm/.test(k)) return "SN DKR 2026 B 12345";
  if (/ninea/.test(k)) return "0123456789";
  if (/cni|identite|passeport/.test(k)) return "CNI n° 1 234 567 8901";
  if (/cnss|matricule/.test(k)) return "n° 12345678";
  if (/date/.test(k)) return "15/10/2026";
  if (/duree|delai|preavis/.test(k)) return "12 mois";
  if (/taux|pourcentage|commission|remuneration/.test(k)) return "10 %";
  if (/loyer/.test(k)) return "250 000";
  if (/salaire|remuneration/.test(k)) return "350 000";
  if (/prix|valeur/.test(k)) return "25 000 000";
  if (/montant|honoraires|provision|caution|depot|creance|dette|pret|versement|reverse|frais/.test(k))
    return "150 000";
  if (/superficie|surface/.test(k)) return "150 m²";
  if (/nb_|nombre|quantite/.test(k)) return "3";
  if (/devise/.test(k)) return "F CFA";
  if (/ville|lieu|localisation|commune/.test(k)) return "Dakar";
  if (/nom|raison|signataire|partie/.test(k)) return "Mamadou FALL";
  if (/clauses|conditions|observations|particuliere/.test(k))
    return "Selon les modalités convenues entre les parties.";
  return `« ${label} »`;
}

function exempleRendu(contenu: string): string {
  const vals: Record<string, string> = {};
  for (const v of extractTemplateVariables(contenu)) {
    vals[v.cle] = valeurExemple(v.cle, v.label);
  }
  return renderDocumentTemplate(contenu, vals);
}

export function ContratsClient() {
  const [types, setTypes] = useState<any[]>([]);
  const [modeles, setModeles] = useState<any[]>([]);
  const [contrats, setContrats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exempleType, setExempleType] = useState<any | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/transactions/types").then((r) => (r.ok ? r.json() : Promise.reject())),
      fetch("/api/transactions").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/transactions/modeles").then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([t, trx, m]) => {
        setTypes(t);
        setContrats(Array.isArray(trx) ? trx : []);
        setModeles(Array.isArray(m) ? m : []);
      })
      .catch(() => setError("Impossible de charger le référentiel de contrats."))
      .finally(() => setLoading(false));
  }, []);

  const parFamille = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const t of types) {
      if (!map.has(t.famille)) map.set(t.famille, []);
      map.get(t.famille)!.push(t);
    }
    return [...map.entries()].sort(
      (a, b) => FAMILLE_ORDRE.indexOf(a[0]) - FAMILLE_ORDRE.indexOf(b[0])
    );
  }, [types]);
  const modelesParType = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const m of modeles) {
      const key = m.type?.code;
      if (!key) continue;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    }
    return map;
  }, [modeles]);
  const recents = useMemo(() => contrats.slice(0, 10), [contrats]);

  if (loading) {
    return <div className="rounded-lg border bg-white p-8 text-center text-gray-500">Chargement…</div>;
  }
  if (error) {
    return <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>;
  }

  return (
    <div className="space-y-8">
      <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-4 text-sm text-gray-700">
        Le contrat est créé par l'assistant (type → dossier → parties → conditions),
        suit le circuit <em>rédaction → validation juridique → signature</em>, puis
        le PDF est généré depuis la fiche (onglet « Contrats & documents ») et versé
        chiffré dans la GED du dossier — filigrane « BROUILLON » avant la signature.
        L'acte est établi en autant d'exemplaires originaux que de parties.
      </div>

      {parFamille.map(([famille, liste]) => (
        <section key={famille} className="space-y-3">
          <h2 className="text-base font-semibold text-cabinet-900">
            {FAMILLE_LABELS[famille] || famille}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {liste.map((t) => (
              <div
                key={t.id}
                className="flex flex-col rounded-lg border border-gray-200 bg-white p-4 transition hover:shadow-sm"
              >
                <div className="font-medium text-sm">{t.libelle}</div>
                <div className="mt-1 text-xs text-gray-500">{t.circuitPrincipal}</div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {t.validationAvocat && (
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-800">
                      Validation avocat
                    </span>
                  )}
                  {t.enregistrementAEvaluer && (
                    <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] text-indigo-800">
                      Enregistrement
                    </span>
                  )}
                  <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600">
                    {t.pieces?.length ?? 0} pièces
                  </span>
                </div>
                {t.avertissement && (
                  <p className="mt-2 text-[11px] leading-snug text-amber-700">
                    ⚠ {t.avertissement}
                  </p>
                )}
                <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                  <Link
                    href={`/cabinet/dossiers/transactions/nouveau?typeCode=${t.code}`}
                    className="btn-primary px-3 py-1.5 text-xs"
                  >
                    Nouveau contrat →
                  </Link>
                  <div className="flex items-center gap-2">
                    {(modelesParType.get(t.code)?.length ?? 0) > 0 && (
                      <button
                        type="button"
                        onClick={() => setExempleType(t)}
                        className="text-[11px] text-cabinet-700 underline underline-offset-2 hover:text-cabinet-900"
                      >
                        Exemple
                      </button>
                    )}
                    <span className="text-[11px] text-gray-400">
                      {t._count?.transactions ?? 0} en cours · {t._count?.modeles ?? 0} modèle(s)
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-cabinet-900">Contrats en cours</h2>
          <div className="flex gap-3 text-sm">
            <Link href="/cabinet/dossiers/transactions" className="text-cabinet-700 hover:underline">
              Module transactions →
            </Link>
            <Link
              href="/cabinet/dossiers/transactions/parametrage"
              className="text-cabinet-700 hover:underline"
            >
              Types & modèles →
            </Link>
          </div>
        </div>
        <div className="overflow-x-auto rounded-lg border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-cabinet-100 text-cabinet-900">
              <tr>
                <th className="px-3 py-2 text-left">Référence</th>
                <th className="px-3 py-2 text-left">Type</th>
                <th className="px-3 py-2 text-left">Objet</th>
                <th className="px-3 py-2 text-left">Dossier / client</th>
                <th className="px-3 py-2 text-left">Statut</th>
                <th className="px-3 py-2 text-left">Créé le</th>
              </tr>
            </thead>
            <tbody>
              {recents.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-gray-500">
                    Aucun contrat en cours — créez-en un depuis le catalogue ci-dessus.
                  </td>
                </tr>
              )}
              {recents.map((t) => (
                <tr key={t.id} className="border-t hover:bg-gray-50">
                  <td className="px-3 py-2">
                    <Link
                      href={`/cabinet/dossiers/transactions/${t.id}`}
                      className="text-cabinet-700 hover:underline"
                    >
                      {t.reference}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{t.type?.libelle}</td>
                  <td className="px-3 py-2 max-w-[220px] truncate" title={t.objet || ""}>
                    {t.objet || "—"}
                  </td>
                  <td className="px-3 py-2">
                    {t.dossier?.referenceInterne} — {t.dossier?.client?.raisonSociale}
                  </td>
                  <td className="px-3 py-2">
                    {TRANSACTION_STATUT_LABELS[t.statut] || t.statut}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {t.createdAt ? new Date(t.createdAt).toLocaleDateString("fr-FR") : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {exempleType && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setExempleType(null)}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-lg bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div>
                <div className="text-sm font-semibold text-cabinet-900">
                  Exemple — {exempleType.libelle}
                </div>
                <div className="text-[11px] text-gray-500">
                  Aperçu du modèle rempli avec des données fictives, avant
                  validation juridique.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setExempleType(null)}
                className="rounded border px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
              >
                Fermer
              </button>
            </div>
            <div className="overflow-y-auto px-5 py-4">
              {(modelesParType.get(exempleType.code) ?? []).map((m) => (
                <div key={m.id} className="mb-6">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    {m.titre}
                  </div>
                  <pre className="whitespace-pre-wrap rounded border bg-gray-50 p-4 font-sans text-[13px] leading-relaxed text-gray-800">
                    {exempleRendu(m.contenu || "")}
                  </pre>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
