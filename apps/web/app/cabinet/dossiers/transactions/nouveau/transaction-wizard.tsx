"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  TRX_PARTIE_ROLES,
  TRANSACTION_WORKFLOWS,
  CHARGES_MODES,
  MODES_PAIEMENT,
  TYPES_MANDAT,
  COMMISSION_TYPES,
  CLAUSES_STANDARD_BAIL,
  CLAUSES_STANDARD_VENTE,
} from "@/lib/transactions";

const inputCls = "input";
const labelCls = "mb-1 block text-xs font-medium text-gray-600";

interface PartieForm {
  role: string;
  demandeurId: string;
  nomLibre: string;
  qualite: string;
}

/// Date de fin de bail = date d'effet + N mois.
function dateFinBail(dateEffet: string, mois: number): string {
  const d = new Date(dateEffet);
  d.setMonth(d.getMonth() + mois);
  return d.toISOString().slice(0, 10);
}

/// Rôles proposés par défaut : par code de type d'abord, sinon par famille.
const ROLES_PAR_TYPE: Record<string, string[]> = {
  TRAVAIL_STAGE: ["EMPLOYEUR", "STAGIAIRE"],
  PROCURATION: ["MANDANT", "MANDATAIRE"],
  MANDAT_GESTION_LOCATIVE: ["MANDANT", "MANDATAIRE"],
  MANDAT_VENTE_IMMO: ["MANDANT", "MANDATAIRE"],
  CAUTIONNEMENT: ["CREANCIER", "CAUTION"],
  PACTE_ASSOCIES: ["ASSOCIE"],
  APPORTEUR_AFFAIRES: ["DONNEUR_ORDRE", "APPORTEUR"],
  NDA_CONFIDENTIALITE: ["AUTRE", "AUTRE"],
  TRANSACTION_AMIABLE: ["AUTRE", "AUTRE"],
  CONVENTION_HONORAIRES: ["MANDANT"],
  LETTRE_MISSION: ["MANDANT"],
};

const ROLES_PAR_FAMILLE: Record<string, string[]> = {
  VENTE_IMMOBILIER: ["VENDEUR", "ACHETEUR"],
  VENTE_AUTRE: ["VENDEUR", "ACHETEUR"],
  BAIL: ["BAILLEUR", "LOCATAIRE"],
  AVENANT_RESILIATION: ["BAILLEUR", "LOCATAIRE"],
  ETAT_LIEUX: ["BAILLEUR", "LOCATAIRE"],
  MANDAT: ["MANDANT"],
  CONTRAT_TRAVAIL: ["EMPLOYEUR", "SALARIE"],
  CONTRAT_SERVICES: ["PRESTATAIRE", "DONNEUR_ORDRE"],
  CONTRAT_SOCIETES: ["CEDANT", "CESSIONNAIRE"],
  CONTRAT_OBLIGATIONS: ["CREANCIER", "DEBITEUR"],
  CONTRAT_CABINET: ["MANDANT"],
};

function rolesSuggeres(t: { code: string; famille: string }): string[] {
  return ROLES_PAR_TYPE[t.code] || ROLES_PAR_FAMILLE[t.famille] || [];
}

export function TransactionWizard({
  types,
  dossiers,
  biens,
  demandeurs,
  users,
  initial,
}: {
  types: any[];
  dossiers: any[];
  biens: any[];
  demandeurs: any[];
  users: any[];
  initial: { dossierId: string; typeCode: string; objet: string; origine: string };
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [typeId, setTypeId] = useState(
    types.find((t) => t.code === initial.typeCode)?.id || ""
  );
  const type = types.find((t) => t.id === typeId) || null;

  const [form, setForm] = useState({
    dossierId: initial.dossierId,
    sousType: "",
    objet: initial.objet,
    priorite: "NORMALE",
    responsableId: "",
    prix: "",
    loyer: "",
    depotGarantie: "",
    avanceLoyer: "",
    devise: "XOF",
    dateEffet: "",
    dureeMois: "",
    conditionsSuspensives: "",
    notaireNom: "",
    notaireEtude: "",
    honoraires: "",
    // Bail détaillé
    chargesMensuelles: "",
    chargesMode: "FIXE",
    jourEcheanceLoyer: "5",
    modePaiementLoyer: "VIREMENT",
    genererEcheances: true,
    // Mandat
    typeMandat: "GESTION",
    commissionType: "POURCENTAGE",
    commissionValeur: "",
    // Vente — décomposition
    honorairesAgence: "",
    tva: "",
    taxesMunicipales: "",
    fraisNotaire: "",
    netVendeur: "",
    // Paiement initial (dépôt, 1er loyer…)
    paiementInitialNature: "DEPOT_GARANTIE",
    paiementInitialMontant: "",
    paiementInitialMode: "ESPECES",
  });
  const [clauses, setClauses] = useState<string[]>([]);
  const [clauseCustom, setClauseCustom] = useState("");
  const [parties, setParties] = useState<PartieForm[]>([]);
  const [biensIds, setBiensIds] = useState<string[]>([]);
  const [bienLibre, setBienLibre] = useState({ designation: "", nature: "IMMEUBLE", adresse: "", commune: "", typeDroit: "", referenceDroit: "", superficie: "" });

  const dossier = dossiers.find((d) => d.id === form.dossierId);

  // Quand le type change : proposer les rôles de parties attendus.
  function selectType(id: string) {
    setTypeId(id);
    const t = types.find((x) => x.id === id);
    if (t && parties.length === 0) {
      setParties(
        rolesSuggeres(t).map((role) => ({
          role,
          demandeurId: "",
          nomLibre: "",
          qualite: "",
        }))
      );
    }
  }

  const demandeurLabel = (d: any) =>
    d.typePersonne === "MORALE"
      ? d.raisonSociale || d.nom
      : [d.civilite, d.prenoms, d.nom].filter(Boolean).join(" ");

  const steps = ["Type", "Dossier", "Parties", "Bien", "Conditions"];
  const canNext = useMemo(() => {
    if (step === 0) return !!typeId;
    if (step === 1) return !!form.dossierId;
    return true;
  }, [step, typeId, form.dossierId]);

  async function submit() {
    setBusy(true);
    setError("");
    try {
      // Bien décrit librement : création de la fiche puis rattachement.
      let ids = [...biensIds];
      if (ids.length === 0 && bienLibre.designation.trim()) {
        const rb = await fetch("/api/transactions/biens", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            designation: bienLibre.designation,
            nature: bienLibre.nature,
            adresse: bienLibre.adresse || null,
            commune: bienLibre.commune || null,
            typeDroit: bienLibre.typeDroit || null,
            referenceDroit: bienLibre.referenceDroit || null,
            superficie: bienLibre.superficie ? parseFloat(bienLibre.superficie) : null,
            uniteSuperficie: bienLibre.superficie ? "m2" : null,
          }),
        });
        if (rb.ok) {
          const b = await rb.json();
          ids = [b.id];
        }
      }
      const isBail = type?.famille === "BAIL";
      const isVente = type?.famille === "VENTE_IMMOBILIER" || type?.famille === "VENTE_AUTRE";
      const isMandat = type?.famille === "MANDAT";
      // Prix total calculé si la décomposition est renseignée.
      const prixDecompose = [form.netVendeur, form.honorairesAgence, form.tva, form.taxesMunicipales, form.fraisNotaire]
        .reduce((s, v) => s + (parseInt(v, 10) || 0), 0);
      const prixFinal = form.prix ? parseInt(form.prix, 10) : (isVente && prixDecompose ? prixDecompose : null);
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          typeId,
          dossierId: form.dossierId,
          sousType: form.sousType || null,
          objet: form.objet || null,
          priorite: form.priorite,
          responsableId: form.responsableId || null,
          prix: prixFinal,
          loyer: form.loyer ? parseInt(form.loyer, 10) : null,
          depotGarantie: form.depotGarantie ? parseInt(form.depotGarantie, 10) : null,
          avanceLoyer: form.avanceLoyer ? parseInt(form.avanceLoyer, 10) : null,
          devise: form.devise,
          dateEffet: form.dateEffet || null,
          dateFin: isBail && form.dateEffet && form.dureeMois
            ? dateFinBail(form.dateEffet, parseInt(form.dureeMois, 10))
            : null,
          dureeMois: form.dureeMois ? parseInt(form.dureeMois, 10) : null,
          conditionsSuspensives: form.conditionsSuspensives || null,
          notaireNom: form.notaireNom || null,
          notaireEtude: form.notaireEtude || null,
          honoraires: form.honoraires ? parseInt(form.honoraires, 10) : 0,
          // Bail détaillé — en mode POURCENTAGE, le champ saisi est un %
          // du loyer : on stocke le montant calculé.
          chargesMensuelles: (() => {
            if (!isBail || form.chargesMode === "INCLUSES" || !form.chargesMensuelles) return null;
            const v = parseFloat(form.chargesMensuelles) || 0;
            return form.chargesMode === "POURCENTAGE"
              ? Math.round(((parseInt(form.loyer, 10) || 0) * v) / 100)
              : Math.round(v);
          })(),
          chargesMode: isBail ? form.chargesMode : null,
          chargesIncluses: isBail && form.chargesMode === "INCLUSES",
          jourEcheanceLoyer: isBail && form.jourEcheanceLoyer ? parseInt(form.jourEcheanceLoyer, 10) : null,
          modePaiementLoyer: isBail ? form.modePaiementLoyer : null,
          genererEcheances: isBail && form.genererEcheances,
          clausesParticulieres: clauses.length ? clauses : null,
          // Mandat
          typeMandat: isMandat ? form.typeMandat : null,
          commissionType: isMandat && form.commissionValeur ? form.commissionType : null,
          commissionValeur: isMandat && form.commissionValeur ? parseFloat(form.commissionValeur) : null,
          commissionBase: isMandat && form.commissionType === "POURCENTAGE" ? "Loyers encaissés TTC" : null,
          // Vente — décomposition
          honorairesAgence: isVente && form.honorairesAgence ? parseInt(form.honorairesAgence, 10) : null,
          tva: isVente && form.tva ? parseInt(form.tva, 10) : null,
          taxesMunicipales: isVente && form.taxesMunicipales ? parseInt(form.taxesMunicipales, 10) : null,
          fraisNotaire: isVente && form.fraisNotaire ? parseInt(form.fraisNotaire, 10) : null,
          netVendeur: isVente && form.netVendeur ? parseInt(form.netVendeur, 10) : null,
          biensIds: ids,
          parties: parties
            .filter((p) => p.demandeurId || p.nomLibre.trim())
            .map((p) => ({
              role: p.role,
              demandeurId: p.demandeurId || null,
              nomLibre: p.nomLibre || null,
              qualite: p.qualite || null,
            })),
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(typeof j.error === "string" ? j.error : "Erreur de création");
      }
      const created = await res.json();
      // Paiement initial (dépôt de garantie, premier loyer…) enregistré
      // immédiatement, comme dans GESTIMMO.
      if (form.paiementInitialMontant && parseInt(form.paiementInitialMontant, 10) > 0) {
        const benef = parties.find((p) => p.role === "BAILLEUR" || p.role === "VENDEUR");
        await fetch(`/api/transactions/${created.id}/paiements`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nature: form.paiementInitialNature,
            montant: parseInt(form.paiementInitialMontant, 10),
            beneficiaire: benef?.nomLibre || "Séquestre cabinet",
            mode: form.paiementInitialMode,
          }),
        }).catch(() => {});
      }
      router.push(`/cabinet/dossiers/transactions/${created.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
      setBusy(false);
    }
  }

  const workflowLabel = TRANSACTION_WORKFLOWS.find((w) => w.code === type?.workflow)?.label;

  return (
    <div className="card space-y-6 p-6">
      {/* Étapes */}
      <ol className="flex flex-wrap gap-2 text-xs">
        {steps.map((s, i) => (
          <li
            key={s}
            className={`rounded-full px-3 py-1 ${
              i === step
                ? "bg-cabinet-800 text-white"
                : i < step
                  ? "bg-cabinet-100 text-cabinet-800"
                  : "bg-gray-100 text-gray-500"
            }`}
          >
            {i + 1}. {s}
          </li>
        ))}
      </ol>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Étape 1 : type */}
      {step === 0 && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Choisissez le type de transaction — la check-list de pièces, le
            circuit et les modèles de contrat en dépendent.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {types.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => selectType(t.id)}
                className={`rounded-lg border p-4 text-left transition ${
                  typeId === t.id
                    ? "border-cabinet-700 bg-cabinet-50 ring-2 ring-cabinet-200"
                    : "border-gray-200 hover:border-cabinet-300"
                }`}
              >
                <div className="font-medium text-sm">{t.libelle}</div>
                <div className="mt-1 text-xs text-gray-500">{t.circuitPrincipal}</div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {t.mutationFonciere && (
                    <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] text-indigo-800">
                      Livre foncier
                    </span>
                  )}
                  {t.notaireObligatoire && (
                    <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] text-violet-800">
                      Notaire requis
                    </span>
                  )}
                  {t.validationAvocat && (
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-800">
                      Validation avocat
                    </span>
                  )}
                  <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600">
                    {t.pieces.length} pièces
                  </span>
                </div>
              </button>
            ))}
          </div>
          {type?.avertissement && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              ⚠️ {type.avertissement}
            </div>
          )}
          {type && (
            <p className="text-xs text-gray-500">
              Workflow : {workflowLabel} — {type.pieces.length} pièce(s) en check-list.
            </p>
          )}
        </div>
      )}

      {/* Étape 2 : dossier */}
      {step === 1 && (
        <div className="space-y-4">
          <div>
            <label className={labelCls}>Dossier juridique de rattachement *</label>
            <select
              className={inputCls}
              value={form.dossierId}
              onChange={(e) => setForm({ ...form, dossierId: e.target.value })}
            >
              <option value="">— Choisir un dossier —</option>
              {dossiers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.referenceInterne} — {d.client.raisonSociale}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">
              La transaction hérite de la GED, des permissions et de la
              confidentialité du dossier.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Objet de la transaction</label>
              <input
                className={inputCls}
                value={form.objet}
                onChange={(e) => setForm({ ...form, objet: e.target.value })}
                placeholder="Vente de la villa de…, bail du local…"
              />
            </div>
            <div>
              <label className={labelCls}>Sous-type / précision</label>
              <input
                className={inputCls}
                value={form.sousType}
                onChange={(e) => setForm({ ...form, sousType: e.target.value })}
              />
            </div>
            <div>
              <label className={labelCls}>Priorité</label>
              <select
                className={inputCls}
                value={form.priorite}
                onChange={(e) => setForm({ ...form, priorite: e.target.value })}
              >
                <option value="BASSE">Basse</option>
                <option value="NORMALE">Normale</option>
                <option value="HAUTE">Haute</option>
                <option value="URGENTE">Urgente</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Responsable interne</label>
              <select
                className={inputCls}
                value={form.responsableId}
                onChange={(e) => setForm({ ...form, responsableId: e.target.value })}
              >
                <option value="">—</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.prenom} {u.nom} ({u.role?.nom})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Étape 3 : parties */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Parties au contrat : vendeur, acheteur, bailleur, locataire, garant…
              Le cabinet n&apos;est jamais partie — il est conseil / intermédiaire.
            </p>
            <button
              type="button"
              className="btn-secondary px-3 py-1.5 text-xs"
              onClick={() =>
                setParties([...parties, { role: "AUTRE", demandeurId: "", nomLibre: "", qualite: "" }])
              }
            >
              + Ajouter une partie
            </button>
          </div>
          {parties.length === 0 && (
            <div className="rounded-lg border border-dashed border-gray-300 px-4 py-6 text-center text-sm text-gray-500">
              Aucune partie — elles pourront être ajoutées ensuite.
            </div>
          )}
          {parties.map((p, i) => (
            <div key={i} className="grid items-end gap-3 rounded-lg border border-gray-200 p-3 sm:grid-cols-5">
              <div>
                <label className={labelCls}>Rôle</label>
                <select
                  className={inputCls}
                  value={p.role}
                  onChange={(e) =>
                    setParties(parties.map((x, j) => (j === i ? { ...x, role: e.target.value } : x)))
                  }
                >
                  {TRX_PARTIE_ROLES.map((r) => (
                    <option key={r.code} value={r.code}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>Demandeur existant</label>
                <select
                  className={inputCls}
                  value={p.demandeurId}
                  onChange={(e) =>
                    setParties(
                      parties.map((x, j) => (j === i ? { ...x, demandeurId: e.target.value } : x))
                    )
                  }
                >
                  <option value="">— ou nom libre —</option>
                  {demandeurs.map((d) => (
                    <option key={d.id} value={d.id}>
                      {demandeurLabel(d)}
                      {d.client ? ` (client : ${d.client.raisonSociale})` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Nom libre</label>
                <input
                  className={inputCls}
                  value={p.nomLibre}
                  onChange={(e) =>
                    setParties(parties.map((x, j) => (j === i ? { ...x, nomLibre: e.target.value } : x)))
                  }
                  placeholder="Si pas de fiche demandeur"
                />
              </div>
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label className={labelCls}>Qualité</label>
                  <input
                    className={inputCls}
                    value={p.qualite}
                    onChange={(e) =>
                      setParties(parties.map((x, j) => (j === i ? { ...x, qualite: e.target.value } : x)))
                    }
                    placeholder="propriétaire, représenté par…"
                  />
                </div>
                <button
                  type="button"
                  className="text-xs text-red-600 hover:underline"
                  onClick={() => setParties(parties.filter((_, j) => j !== i))}
                >
                  Retirer
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Étape 4 : bien */}
      {step === 3 && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Rattachez un bien existant du registre ou décrivez-le librement
            {type?.bienRequis ? " (requis pour ce type)." : "."}
          </p>
          <div>
            <label className={labelCls}>Bien du registre</label>
            <select
              className={inputCls}
              value={biensIds[0] || ""}
              onChange={(e) => setBiensIds(e.target.value ? [e.target.value] : [])}
            >
              <option value="">— Aucun / à créer ensuite —</option>
              {biens.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.designation} — {b.commune || ""}
                  {b.referenceDroit ? ` (${b.referenceDroit})` : ""}
                </option>
              ))}
            </select>
          </div>
          {biensIds.length === 0 && (
            <div className="rounded-lg border border-gray-200 p-4">
              <p className="mb-3 text-xs font-medium text-gray-600">
                Ou décrire le bien (une fiche sera créée au besoin depuis la transaction)
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className={labelCls}>Désignation</label>
                  <input className={inputCls} value={bienLibre.designation}
                    onChange={(e) => setBienLibre({ ...bienLibre, designation: e.target.value })} />
                </div>
                <div>
                  <label className={labelCls}>Commune</label>
                  <input className={inputCls} value={bienLibre.commune}
                    onChange={(e) => setBienLibre({ ...bienLibre, commune: e.target.value })} />
                </div>
                <div>
                  <label className={labelCls}>Référence du droit</label>
                  <input className={inputCls} value={bienLibre.referenceDroit}
                    onChange={(e) => setBienLibre({ ...bienLibre, referenceDroit: e.target.value })}
                    placeholder="TF n°, bail, NICAD…" />
                </div>
              </div>
            </div>
          )}
          {type?.notaireObligatoire && (
            <div className="rounded-lg border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-800">
              ⚖️ Circuit notarial obligatoire : la mutation ne sera achevée
              qu&apos;après inscription de l&apos;acquéreur au livre foncier.
            </div>
          )}
        </div>
      )}

      {/* Étape 5 : conditions */}
      {step === 4 && (
        <div className="space-y-5">
          {/* ── Vente : décomposition financière (style GESTIMMO) ── */}
          {(type?.famille === "VENTE_IMMOBILIER" || type?.famille === "VENTE_AUTRE") && (
            <div className="rounded-lg border border-gray-200 p-4">
              <h3 className="mb-3 text-sm font-semibold">Conditions financières</h3>
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className={labelCls}>Net vendeur (prix du bien)</label>
                  <input className={inputCls} type="number" value={form.netVendeur}
                    onChange={(e) => setForm({ ...form, netVendeur: e.target.value })} />
                </div>
                <div>
                  <label className={labelCls}>Honoraires agence / cabinet</label>
                  <input className={inputCls} type="number" value={form.honorairesAgence}
                    onChange={(e) => {
                      const h = e.target.value;
                      setForm({ ...form, honorairesAgence: h, tva: h ? String(Math.round(parseInt(h, 10) * 0.18)) : "" });
                    }} />
                </div>
                <div>
                  <label className={labelCls}>TVA (calculée 18 %)</label>
                  <input className={inputCls} type="number" value={form.tva}
                    onChange={(e) => setForm({ ...form, tva: e.target.value })} />
                </div>
                <div>
                  <label className={labelCls}>Taxes municipales</label>
                  <input className={inputCls} type="number" value={form.taxesMunicipales}
                    onChange={(e) => setForm({ ...form, taxesMunicipales: e.target.value })} />
                </div>
                <div>
                  <label className={labelCls}>Frais de notaire</label>
                  <input className={inputCls} type="number" value={form.fraisNotaire}
                    onChange={(e) => setForm({ ...form, fraisNotaire: e.target.value })} />
                </div>
                <div>
                  <label className={labelCls}>Prix total de vente (calculé)</label>
                  <input className={`${inputCls} bg-gray-50 font-semibold`} readOnly
                    value={[
                      form.netVendeur, form.honorairesAgence, form.tva,
                      form.taxesMunicipales, form.fraisNotaire,
                    ].reduce((s, v) => s + (parseInt(v, 10) || 0), 0) || ""}
                    placeholder="—" />
                </div>
              </div>
              <p className="mt-2 text-xs text-gray-500">
                Prix total = net vendeur + honoraires + TVA + taxes + frais de notaire.
                Si aucune décomposition, saisissez le prix global ci-dessous.
              </p>
              <div className="mt-3 max-w-xs">
                <label className={labelCls}>Prix de vente (global, si pas de décomposition)</label>
                <input className={inputCls} type="number" value={form.prix}
                  onChange={(e) => setForm({ ...form, prix: e.target.value })} />
              </div>
            </div>
          )}

          {/* ── Mandat : type + commission ── */}
          {type?.famille === "MANDAT" && (
            <div className="rounded-lg border border-gray-200 p-4">
              <h3 className="mb-3 text-sm font-semibold">Type & conditions du mandat</h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {TYPES_MANDAT.map((m) => (
                  <button key={m.code} type="button"
                    onClick={() => setForm({ ...form, typeMandat: m.code })}
                    className={`rounded-lg border p-3 text-left text-xs transition ${
                      form.typeMandat === m.code
                        ? "border-cabinet-700 bg-cabinet-50 ring-2 ring-cabinet-200"
                        : "border-gray-200 hover:border-cabinet-300"
                    }`}>
                    <div className="font-medium">{m.label}</div>
                    <div className="mt-1 text-gray-500">{m.description}</div>
                  </button>
                ))}
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <div>
                  <label className={labelCls}>Mode de commission</label>
                  <select className={inputCls} value={form.commissionType}
                    onChange={(e) => setForm({ ...form, commissionType: e.target.value })}>
                    {COMMISSION_TYPES.map((c) => (
                      <option key={c.code} value={c.code}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>
                    Commission {form.commissionType === "POURCENTAGE" ? "(%)" : "(FCFA)"}
                  </label>
                  <input className={inputCls} type="number" step="0.01" value={form.commissionValeur}
                    onChange={(e) => setForm({ ...form, commissionValeur: e.target.value })} />
                </div>
                <div className="flex items-end pb-2 text-xs text-gray-500">
                  {form.commissionType === "POURCENTAGE" && form.commissionValeur
                    ? `${form.commissionValeur} % sur les loyers encaissés TTC`
                    : "L'un ou l'autre : % des loyers ou montant fixe."}
                </div>
              </div>
            </div>
          )}

          {/* ── Bail : période + finances + échéances (style GESTIMMO) ── */}
          {type?.famille === "BAIL" && (
            <>
              <div className="rounded-lg border border-gray-200 p-4">
                <h3 className="mb-3 text-sm font-semibold">Période du bail</h3>
                <div className="mb-3 flex flex-wrap gap-2">
                  {[["3 mois", 3], ["6 mois", 6], ["1 an", 12], ["2 ans", 24], ["3 ans", 36], ["Indéterminé", 0]].map(([l, m]) => (
                    <button key={l as string} type="button"
                      onClick={() => setForm({ ...form, dureeMois: m ? String(m) : "" })}
                      className={`rounded-full border px-3 py-1 text-xs ${
                        (m ? form.dureeMois === String(m) : !form.dureeMois)
                          ? "border-cabinet-700 bg-cabinet-50 text-cabinet-800"
                          : "border-gray-200 text-gray-600 hover:border-cabinet-300"
                      }`}>
                      {l as string}
                    </button>
                  ))}
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <label className={labelCls}>Date de début *</label>
                    <input className={inputCls} type="date" value={form.dateEffet}
                      onChange={(e) => setForm({ ...form, dateEffet: e.target.value })} />
                  </div>
                  <div>
                    <label className={labelCls}>Durée (mois)</label>
                    <input className={inputCls} type="number" value={form.dureeMois}
                      onChange={(e) => setForm({ ...form, dureeMois: e.target.value })} />
                  </div>
                  <div>
                    <label className={labelCls}>Date de fin (calculée)</label>
                    <input className={`${inputCls} bg-gray-50`} readOnly
                      value={form.dateEffet && form.dureeMois
                        ? dateFinBail(form.dateEffet, parseInt(form.dureeMois, 10))
                        : "Illimité"} />
                  </div>
                </div>
              </div>
              <div className="rounded-lg border border-gray-200 p-4">
                <h3 className="mb-3 text-sm font-semibold">Conditions financières</h3>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <label className={labelCls}>Loyer mensuel (FCFA) *</label>
                    <input className={inputCls} type="number" value={form.loyer}
                      onChange={(e) => setForm({ ...form, loyer: e.target.value })} />
                  </div>
                  <div>
                    <label className={labelCls}>
                      Charges mensuelles
                      {form.chargesMode === "POURCENTAGE" ? " (% du loyer)" : form.chargesMode === "INCLUSES" ? "" : " (FCFA)"}
                    </label>
                    <div className="flex gap-2">
                      <select className={`${inputCls} w-28`} value={form.chargesMode}
                        onChange={(e) => setForm({ ...form, chargesMode: e.target.value })}>
                        {CHARGES_MODES.map((c) => (
                          <option key={c.code} value={c.code}>{c.label}</option>
                        ))}
                      </select>
                      <input className={inputCls} type="number" step="0.1" value={form.chargesMensuelles}
                        disabled={form.chargesMode === "INCLUSES"}
                        placeholder={form.chargesMode === "POURCENTAGE" ? "ex. 10 %" : ""}
                        onChange={(e) => setForm({ ...form, chargesMensuelles: e.target.value })} />
                    </div>
                    {form.chargesMode === "POURCENTAGE" && form.chargesMensuelles && form.loyer && (
                      <p className="mt-1 text-xs text-gray-500">
                        = {Math.round(((parseInt(form.loyer, 10) || 0) * parseFloat(form.chargesMensuelles)) / 100).toLocaleString("fr-FR")} {form.devise}/mois
                      </p>
                    )}
                  </div>
                  <div>
                    <label className={labelCls}>Dépôt de garantie (FCFA)</label>
                    <input className={inputCls} type="number" value={form.depotGarantie}
                      onChange={(e) => setForm({ ...form, depotGarantie: e.target.value })}
                      placeholder="Généralement 1 à 2 mois de loyer" />
                  </div>
                  <div>
                    <label className={labelCls}>Avance de loyer (FCFA)</label>
                    <input className={inputCls} type="number" value={form.avanceLoyer}
                      onChange={(e) => setForm({ ...form, avanceLoyer: e.target.value })} />
                  </div>
                  <div>
                    <label className={labelCls}>Mode de paiement</label>
                    <select className={inputCls} value={form.modePaiementLoyer}
                      onChange={(e) => setForm({ ...form, modePaiementLoyer: e.target.value })}>
                      {MODES_PAIEMENT.map((m) => (
                        <option key={m.code} value={m.code}>{m.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Jour d&apos;échéance mensuelle</label>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">Le</span>
                      <input className={`${inputCls} w-20`} type="number" min={1} max={31}
                        value={form.jourEcheanceLoyer}
                        onChange={(e) => setForm({ ...form, jourEcheanceLoyer: e.target.value })} />
                      <span className="text-sm text-gray-500">du mois</span>
                    </div>
                  </div>
                </div>
                <label className="mt-3 flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.genererEcheances}
                    onChange={(e) => setForm({ ...form, genererEcheances: e.target.checked })} />
                  Générer automatiquement toutes les échéances
                  {form.loyer && (
                    <span className="text-xs text-gray-500">
                      ({form.dureeMois || 12} échéance(s) mensuelle(s) seront générées
                      {form.chargesMensuelles && form.chargesMode !== "INCLUSES" ? " + charges" : ""})
                    </span>
                  )}
                </label>
              </div>
              <div className="rounded-lg border border-gray-200 p-4">
                <h3 className="mb-3 text-sm font-semibold">Enregistrer un paiement initial</h3>
                <p className="mb-3 text-xs text-gray-500">
                  Dépôt de garantie, premier loyer… encaissé à la signature.
                </p>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <label className={labelCls}>Type de paiement</label>
                    <select className={inputCls} value={form.paiementInitialNature}
                      onChange={(e) => setForm({ ...form, paiementInitialNature: e.target.value })}>
                      <option value="DEPOT_GARANTIE">Dépôt de garantie</option>
                      <option value="LOYER">Loyer</option>
                      <option value="AVANCE_LOYER">Avance de loyer</option>
                      <option value="AUTRE">Autre</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Montant (FCFA)</label>
                    <input className={inputCls} type="number" value={form.paiementInitialMontant}
                      onChange={(e) => setForm({ ...form, paiementInitialMontant: e.target.value })} />
                  </div>
                  <div>
                    <label className={labelCls}>Mode</label>
                    <select className={inputCls} value={form.paiementInitialMode}
                      onChange={(e) => setForm({ ...form, paiementInitialMode: e.target.value })}>
                      <option value="ESPECES">Espèces</option>
                      <option value="VIREMENT">Virement</option>
                      <option value="CHEQUE">Chèque</option>
                      <option value="MOBILE_MONEY">Mobile money</option>
                    </select>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ── Clauses particulières (bail & vente) ── */}
          {(type?.famille === "BAIL" || type?.famille === "VENTE_IMMOBILIER" || type?.famille === "VENTE_AUTRE" || type?.famille === "MANDAT") && (
            <div className="rounded-lg border border-gray-200 p-4">
              <h3 className="mb-1 text-sm font-semibold">Clauses particulières</h3>
              <p className="mb-2 text-xs text-gray-500">Clauses standard — cliquez pour ajouter :</p>
              <div className="mb-3 flex flex-wrap gap-2">
                {(type?.famille === "BAIL" ? CLAUSES_STANDARD_BAIL : CLAUSES_STANDARD_VENTE).map((c) => (
                  <button key={c} type="button"
                    disabled={clauses.includes(c)}
                    onClick={() => setClauses([...clauses, c])}
                    className={`rounded-full border px-3 py-1 text-xs transition ${
                      clauses.includes(c)
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-gray-200 text-gray-600 hover:border-cabinet-300 hover:text-cabinet-800"
                    }`}>
                    {clauses.includes(c) ? "✓ " : "+ "}{c}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input className={inputCls} value={clauseCustom}
                  onChange={(e) => setClauseCustom(e.target.value)}
                  placeholder="Ajouter une clause personnalisée" />
                <button type="button" className="btn-secondary px-3 py-1.5 text-xs"
                  onClick={() => { if (clauseCustom.trim()) { setClauses([...clauses, clauseCustom.trim()]); setClauseCustom(""); } }}>
                  Ajouter
                </button>
              </div>
              {clauses.length > 0 && (
                <ul className="mt-3 space-y-1 text-sm">
                  {clauses.map((c, i) => (
                    <li key={i} className="flex items-start justify-between gap-2 rounded bg-gray-50 px-3 py-1.5">
                      <span>• {c}</span>
                      <button type="button" className="text-xs text-red-600 hover:underline"
                        onClick={() => setClauses(clauses.filter((_, j) => j !== i))}>
                        Retirer
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* ── Champs communs ── */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className={labelCls}>Devise</label>
              <select className={inputCls} value={form.devise}
                onChange={(e) => setForm({ ...form, devise: e.target.value })}>
                <option value="XOF">XOF (FCFA)</option>
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Honoraires du cabinet</label>
              <input className={inputCls} type="number" value={form.honoraires}
                onChange={(e) => setForm({ ...form, honoraires: e.target.value })} />
            </div>
          </div>
          {(type?.notaireObligatoire || type?.famille === "VENTE_IMMOBILIER") && (
            <div className="grid gap-4 rounded-lg border border-violet-200 p-4 sm:grid-cols-2">
              <div>
                <label className={labelCls}>Notaire territorialement compétent</label>
                <input className={inputCls} value={form.notaireNom}
                  onChange={(e) => setForm({ ...form, notaireNom: e.target.value })}
                  placeholder="Maître…" />
              </div>
              <div>
                <label className={labelCls}>Étude notariale</label>
                <input className={inputCls} value={form.notaireEtude}
                  onChange={(e) => setForm({ ...form, notaireEtude: e.target.value })} />
              </div>
            </div>
          )}
          <div>
            <label className={labelCls}>Conditions suspensives</label>
            <textarea className={inputCls} rows={3} value={form.conditionsSuspensives}
              onChange={(e) => setForm({ ...form, conditionsSuspensives: e.target.value })}
              placeholder="Financement bancaire, autorisation des Domaines, levée des charges…" />
          </div>

          {/* Récapitulatif live */}
          <div className="rounded-lg bg-gray-50 p-4 text-sm text-gray-600">
            <strong>Récapitulatif :</strong> {type?.libelle} · dossier{" "}
            {dossier ? `${dossier.referenceInterne} (${dossier.client.raisonSociale})` : "—"} ·{" "}
            {parties.filter((p) => p.demandeurId || p.nomLibre).length} partie(s) ·{" "}
            {biensIds.length ? "1 bien rattaché" : "bien à renseigner"}
            {type?.famille === "BAIL" && form.loyer && (
              <>
                {" "}· loyer {parseInt(form.loyer, 10).toLocaleString("fr-FR")} F/mois
                {form.chargesMensuelles && form.chargesMode !== "INCLUSES" &&
                  ` + ${parseInt(form.chargesMensuelles, 10).toLocaleString("fr-FR")} F charges`}
                {form.depotGarantie && ` · garantie ${parseInt(form.depotGarantie, 10).toLocaleString("fr-FR")} F`}
                {form.genererEcheances && ` · ${form.dureeMois || 12} échéances`}
              </>
            )}
            {type?.famille === "MANDAT" && form.commissionValeur && (
              <> · commission {form.commissionValeur}{form.commissionType === "POURCENTAGE" ? " %" : " F"}</>
            )}
            {" "}· statut initial :{" "}
            {type?.workflow === "VENTE_TF" ? "Ouverture de la transaction" : "Brouillon"}.
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between border-t pt-4">
        <button
          type="button"
          className="btn-secondary px-4 py-2 text-sm"
          disabled={step === 0 || busy}
          onClick={() => setStep(step - 1)}
        >
          ← Retour
        </button>
        {step < steps.length - 1 ? (
          <button
            type="button"
            className="btn-primary px-4 py-2 text-sm"
            disabled={!canNext}
            onClick={() => setStep(step + 1)}
          >
            Continuer →
          </button>
        ) : (
          <button
            type="button"
            className="btn-primary px-4 py-2 text-sm"
            disabled={busy || !typeId || !form.dossierId}
            onClick={submit}
          >
            {busy ? "Création…" : "Créer la transaction"}
          </button>
        )}
      </div>
    </div>
  );
}
