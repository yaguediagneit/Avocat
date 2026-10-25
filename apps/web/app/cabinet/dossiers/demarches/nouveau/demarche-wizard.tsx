"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

interface TypeOption {
  id: string;
  code: string;
  libelle: string;
  famille: string;
  autoritePrincipale?: string | null;
  natureResultat?: string | null;
  sousTypes?: { code: string; libelle: string }[] | null;
  qualificationObligatoire: boolean;
  parcelleRequise: boolean;
  validationAvocat: boolean;
  sensible: boolean;
  avertissement?: string | null;
  pieces: { code: string; libelle: string; niveau: string; categorie: string }[];
}

interface DemandeurOption {
  id: string;
  typePersonne: string;
  nom: string;
  prenoms?: string | null;
  raisonSociale?: string | null;
  commune?: string | null;
  clientId?: string | null;
  client?: { id: string; raisonSociale: string } | null;
}

interface ParcelleOption {
  id: string;
  commune?: string | null;
  quartier?: string | null;
  nicad?: string | null;
  titreFoncier?: string | null;
  adresse?: string | null;
}

interface AutoriteOption {
  id: string;
  nom: string;
  typeAutorite: string;
  commune?: string | null;
}

interface DossierOption {
  id: string;
  referenceInterne: string;
  typeAffaire: string;
  client: { id: string; raisonSociale: string };
}

interface UserOption {
  id: string;
  prenom: string;
  nom: string;
  role: { nom: string };
}

const FAMILLE_LABELS: Record<string, string> = {
  URBANISME: "Urbanisme",
  CADASTRE: "Cadastre",
  FISCALITE: "Fiscalité",
  DOMAINES: "Domaines / foncier",
  LIVRE_FONCIER: "Livre foncier / conservation",
  TRANSVERSAL: "Transversal",
};

const ETAPES = [
  "Type de démarche",
  "Demandeur & mandataire",
  "Bien / parcelle",
  "Circuit & responsables",
  "Récapitulatif",
];

function demandeurLabel(d?: DemandeurOption | null) {
  if (!d) return "—";
  return d.typePersonne === "MORALE"
    ? d.raisonSociale || d.nom
    : [d.prenoms, d.nom].filter(Boolean).join(" ");
}

function parcelleLabel(p?: ParcelleOption | null) {
  if (!p) return "—";
  const loc = [p.adresse, p.quartier, p.commune].filter(Boolean).join(", ");
  const refs = [p.nicad && `NICAD ${p.nicad}`, p.titreFoncier && `TF ${p.titreFoncier}`]
    .filter(Boolean)
    .join(" / ");
  return [loc, refs].filter(Boolean).join(" — ") || p.id;
}

interface WizardInitial {
  dossierId?: string;
  objet?: string;
  demandeurNom?: string;
  demandeurTel?: string;
  demandeurEmail?: string;
  clientId?: string;
  origine?: string;
}

export function DemarcheWizard({
  types,
  demandeurs,
  parcelles,
  autorites,
  dossiers,
  users,
  initial,
}: {
  types: TypeOption[];
  demandeurs: DemandeurOption[];
  parcelles: ParcelleOption[];
  autorites: AutoriteOption[];
  dossiers: DossierOption[];
  users: UserOption[];
  initial?: WizardInitial;
}) {
  const router = useRouter();
  const [etape, setEtape] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Étape 1
  const [typeCode, setTypeCode] = useState("");
  const [sousType, setSousType] = useState("");
  const [sousTypeLibre, setSousTypeLibre] = useState("");
  const [objet, setObjet] = useState(initial?.objet || "");
  const [finalite, setFinalite] = useState("");
  const [fondement, setFondement] = useState("");
  const [referenceActes, setReferenceActes] = useState("");
  const [qualification, setQualification] = useState<Record<string, string>>({});
  const [priorite, setPriorite] = useState("NORMALE");
  const [urgent, setUrgent] = useState(false);
  const [dateLimite, setDateLimite] = useState("");

  // Étape 2
  const [demandeurId, setDemandeurId] = useState("");
  const [mandataireId, setMandataireId] = useState("");
  const [nouveauDemandeur, setNouveauDemandeur] = useState({
    typePersonne: "PHYSIQUE",
    nom: initial?.demandeurNom || "",
    prenoms: "",
    raisonSociale: "",
    telephone: initial?.demandeurTel || "",
    email: initial?.demandeurEmail || "",
    commune: "",
    pieceIdentiteNumero: "",
    clientId: initial?.clientId || "",
  });

  // Étape 3
  const [parcelleId, setParcelleId] = useState("");
  const [nouvelleParcelle, setNouvelleParcelle] = useState({
    commune: "",
    quartier: "",
    adresse: "",
    nicad: "",
    titreFoncier: "",
    referenceDroit: "",
    typeDroit: "",
    superficie: "",
  });

  // Étape 4
  const [dossierId, setDossierId] = useState(initial?.dossierId || "");
  const [autoriteId, setAutoriteId] = useState("");
  const [autoriteLibre, setAutoriteLibre] = useState("");
  const [adresseDepot, setAdresseDepot] = useState("");
  const [responsableId, setResponsableId] = useState("");
  const [assistanteId, setAssistanteId] = useState("");
  const [agentLiaisonId, setAgentLiaisonId] = useState("");
  const [honoraires, setHonoraires] = useState("");
  const [debours, setDebours] = useState("");
  const [taxes, setTaxes] = useState("");
  const [timbres, setTimbres] = useState("");
  const [avancesRecues, setAvancesRecues] = useState("");

  const type = useMemo(() => types.find((t) => t.code === typeCode), [types, typeCode]);
  const sousTypesList = (type?.sousTypes as { code: string; libelle: string }[] | null) || [];
  const sousTypeFinal = sousType === "__autre__" ? sousTypeLibre : sousType;
  const dossierChoisi = useMemo(() => dossiers.find((d) => d.id === dossierId), [dossiers, dossierId]);

  function prefillDemandeurClient() {
    const client = dossierChoisi?.client;
    if (!client) return;
    setNouveauDemandeur({
      ...nouveauDemandeur,
      typePersonne: "MORALE",
      raisonSociale: client.raisonSociale,
      nom: client.raisonSociale,
      clientId: client.id,
    });
  }

  const CHAMPS_QUALIFICATION: Record<string, { key: string; label: string }[]> = {
    CAD_AVIS_FAVORABLE: [
      { key: "objet_avis", label: "Objet précis de l'avis (conformité de plan, identification de parcelle, avis préalable, visa…)" },
      { key: "operation_concernee", label: "Opération concernée" },
    ],
    FON_RAD: [
      { key: "radiation_de", label: "Radiation de quoi ? (hypothèque, prénotation, saisie, inscription, servitude, bail…)" },
      { key: "reference_inscription", label: "Référence de l'inscription / du registre" },
      { key: "creancier", label: "Bénéficiaire / créancier" },
      { key: "motif_juridique", label: "Motif juridique de la radiation" },
    ],
    FON_MAINLEVEE: [
      { key: "type_mainlevee", label: "Mainlevée amiable ou judiciaire" },
      { key: "creancier", label: "Créancier bénéficiaire" },
      { key: "reference_surete", label: "Référence de la sûreté / inscription" },
      { key: "dette", label: "Dette ou obligation éteinte" },
    ],
    ADM_DUPLICATA: [
      { key: "nature_document", label: "Nature du document" },
      { key: "autorite_emettrice", label: "Administration émettrice" },
      { key: "motif_duplicata", label: "Motif (perte, vol, détérioration…)" },
      { key: "reference_document", label: "Référence / date du document si connue" },
    ],
    FIS_ENREG_PROC: [
      { key: "nature_acte", label: "Nature exacte de l'acte (bail, vente, donation, jugement, convention, mandat…)" },
      { key: "valeur_declaree", label: "Valeur / assiette déclarée" },
    ],
    FIS_DECES: [
      { key: "defunt", label: "Identité du défunt" },
      { key: "date_deces", label: "Date du décès" },
      { key: "heritiers", label: "Héritiers connus" },
      { key: "qualite_declarant", label: "Qualité du déclarant" },
      { key: "actifs_passifs", label: "Actifs / passifs principaux" },
    ],
    FIS_ACQUIESCEMENT: [
      { key: "decision_visee", label: "Décision fiscale concernée (avis, redressement, taxation…)" },
      { key: "periode", label: "Période concernée" },
      { key: "montant", label: "Montant" },
      { key: "portee", label: "Portée de l'acquiescement" },
    ],
  };
  const champsQualification = CHAMPS_QUALIFICATION[typeCode] || [];

  function etapeValide(): boolean {
    if (etape === 0) {
      if (!typeCode) return false;
      if (type?.qualificationObligatoire && !sousTypeFinal.trim()) return false;
      if (!objet.trim()) return false;
      return true;
    }
    if (etape === 1) {
      if (!demandeurId && !nouveauDemandeur.nom.trim()) return false;
      if (nouveauDemandeur.typePersonne === "MORALE" && !demandeurId && !nouveauDemandeur.raisonSociale.trim() && !nouveauDemandeur.nom.trim())
        return false;
      return true;
    }
    if (etape === 2) {
      if (type?.parcelleRequise && !parcelleId && !nouvelleParcelle.commune.trim() && !nouvelleParcelle.nicad.trim())
        return false;
      return true;
    }
    if (etape === 3) {
      if (!dossierId) return false;
      if (type?.qualificationObligatoire && !autoriteId && !autoriteLibre.trim()) return false;
      return true;
    }
    return true;
  }

  async function creerEntite(url: string, payload: Record<string, unknown>): Promise<string> {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j.error ? JSON.stringify(j.error) : "Erreur de création");
    }
    const j = await res.json();
    return j.id as string;
  }

  async function soumettre() {
    setLoading(true);
    setError("");
    try {
      // Création à la volée du demandeur / de la parcelle si saisis.
      let demandeurIdFinal = demandeurId || null;
      const nomDemandeur =
        nouveauDemandeur.typePersonne === "MORALE"
          ? nouveauDemandeur.raisonSociale.trim() || nouveauDemandeur.nom.trim()
          : nouveauDemandeur.nom.trim();
      if (!demandeurIdFinal && nomDemandeur) {
        demandeurIdFinal = await creerEntite("/api/demarches/demandeurs", {
          typePersonne: nouveauDemandeur.typePersonne,
          nom: nomDemandeur,
          prenoms: nouveauDemandeur.prenoms || null,
          raisonSociale: nouveauDemandeur.raisonSociale || null,
          telephone: nouveauDemandeur.telephone || null,
          email: nouveauDemandeur.email || null,
          commune: nouveauDemandeur.commune || null,
          pieceIdentiteNumero: nouveauDemandeur.pieceIdentiteNumero || null,
          clientId: nouveauDemandeur.clientId || null,
        });
      }
      let parcelleIdFinal = parcelleId || null;
      if (!parcelleIdFinal && (nouvelleParcelle.commune.trim() || nouvelleParcelle.nicad.trim())) {
        parcelleIdFinal = await creerEntite("/api/demarches/parcelles", {
          commune: nouvelleParcelle.commune || null,
          quartier: nouvelleParcelle.quartier || null,
          adresse: nouvelleParcelle.adresse || null,
          nicad: nouvelleParcelle.nicad || null,
          titreFoncier: nouvelleParcelle.titreFoncier || null,
          referenceDroit: nouvelleParcelle.referenceDroit || null,
          typeDroit: nouvelleParcelle.typeDroit || null,
          superficie: nouvelleParcelle.superficie ? Number(nouvelleParcelle.superficie) : null,
        });
      }

      const res = await fetch("/api/demarches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          typeCode,
          sousType: sousTypeFinal || null,
          dossierId,
          demandeurId: demandeurIdFinal,
          mandataireId: mandataireId || null,
          parcelleId: parcelleIdFinal,
          autoriteId: autoriteId || null,
          autoriteLibre: autoriteLibre || null,
          adresseDepot: adresseDepot || null,
          objet: objet || null,
          finalite: finalite || null,
          fondement: fondement || null,
          referenceActes: referenceActes || null,
          qualification: (() => {
            const q = { ...qualification };
            if (initial?.origine) q.origine = initial.origine;
            return Object.keys(q).length ? q : null;
          })(),
          urgent,
          dateLimite: dateLimite || null,
          priorite,
          responsableId: responsableId || null,
          assistanteId: assistanteId || null,
          agentLiaisonId: agentLiaisonId || null,
          honoraires: honoraires ? parseInt(honoraires, 10) : 0,
          debours: debours ? parseInt(debours, 10) : 0,
          taxes: taxes ? parseInt(taxes, 10) : 0,
          timbres: timbres ? parseInt(timbres, 10) : 0,
          avancesRecues: avancesRecues ? parseInt(avancesRecues, 10) : 0,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(typeof j.error === "string" ? j.error : "Erreur de création");
      }
      const demarche = await res.json();
      router.push(`/cabinet/dossiers/demarches/${demarche.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur de création");
      setLoading(false);
    }
  }

  const inputCls = "input";
  const labelCls = "mb-1 block text-xs font-medium text-gray-600";

  return (
    <div className="card space-y-6">
      {/* Étapes */}
      <div className="flex flex-wrap items-center gap-2">
        {ETAPES.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => i < etape && setEtape(i)}
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                i === etape
                  ? "bg-cabinet-700 text-white"
                  : i < etape
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-gray-100 text-gray-500"
              }`}
            >
              {i + 1}
            </button>
            <span className={`text-xs ${i === etape ? "font-semibold" : "text-gray-500"}`}>
              {label}
            </span>
            {i < ETAPES.length - 1 && <span className="text-gray-300">→</span>}
          </div>
        ))}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Étape 1 — Type */}
      {etape === 0 && (
        <div className="space-y-4">
          <div>
            <label className={labelCls}>Type de démarche *</label>
            <select className={inputCls} value={typeCode} onChange={(e) => { setTypeCode(e.target.value); setSousType(""); }}>
              <option value="">— Choisir —</option>
              {Object.entries(FAMILLE_LABELS).map(([fam, famLabel]) => (
                <optgroup key={fam} label={famLabel}>
                  {types.filter((t) => t.famille === fam).map((t) => (
                    <option key={t.code} value={t.code}>
                      {t.libelle}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {type && (
            <div className="rounded-lg border border-cabinet-200 bg-cabinet-50/50 p-4 text-sm space-y-1">
              <div><span className="font-medium">Autorité :</span> {type.autoritePrincipale || "—"}</div>
              <div><span className="font-medium">Résultat :</span> {type.natureResultat || "—"}</div>
              <div>
                <span className="font-medium">Pièces attendues :</span> {type.pieces.length}
                {type.validationAvocat && (
                  <span className="ml-2 rounded bg-purple-100 px-2 py-0.5 text-xs text-purple-700">
                    Validation avocat requise
                  </span>
                )}
                {type.sensible && (
                  <span className="ml-2 rounded bg-red-100 px-2 py-0.5 text-xs text-red-700">
                    Dossier sensible
                  </span>
                )}
              </div>
              {type.avertissement && (
                <div className="mt-1 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-amber-800">
                  {type.avertissement}
                </div>
              )}
            </div>
          )}

          {type?.qualificationObligatoire && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 space-y-3">
              <div className="text-sm font-semibold text-amber-900">
                Qualification obligatoire — démarche potentiellement ambiguë
              </div>
              <div>
                <label className={labelCls}>Sous-type / précision *</label>
                {sousTypesList.length > 0 ? (
                  <select className={inputCls} value={sousType} onChange={(e) => setSousType(e.target.value)}>
                    <option value="">— Choisir —</option>
                    {sousTypesList.map((s) => (
                      <option key={s.code} value={s.libelle}>{s.libelle}</option>
                    ))}
                    <option value="__autre__">Autre (préciser)</option>
                  </select>
                ) : (
                  <input className={inputCls} value={sousType} onChange={(e) => setSousType(e.target.value)} />
                )}
                {sousType === "__autre__" && (
                  <input
                    className={`${inputCls} mt-2`}
                    placeholder="Préciser le sous-type"
                    value={sousTypeLibre}
                    onChange={(e) => setSousTypeLibre(e.target.value)}
                  />
                )}
              </div>
              {champsQualification.map((c) => (
                <div key={c.key}>
                  <label className={labelCls}>{c.label}</label>
                  <input
                    className={inputCls}
                    value={qualification[c.key] || ""}
                    onChange={(e) => setQualification({ ...qualification, [c.key]: e.target.value })}
                  />
                </div>
              ))}
            </div>
          )}

          <div>
            <label className={labelCls}>Objet détaillé de la demande *</label>
            <textarea className={inputCls} rows={2} value={objet} onChange={(e) => setObjet(e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Finalité</label>
              <input className={inputCls} value={finalite} onChange={(e) => setFinalite(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Références des actes</label>
              <input className={inputCls} value={referenceActes} onChange={(e) => setReferenceActes(e.target.value)} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Fondement de la demande</label>
            <textarea className={inputCls} rows={2} value={fondement} onChange={(e) => setFondement(e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className={labelCls}>Priorité</label>
              <select className={inputCls} value={priorite} onChange={(e) => setPriorite(e.target.value)}>
                <option value="BASSE">Basse</option>
                <option value="NORMALE">Normale</option>
                <option value="HAUTE">Haute</option>
                <option value="URGENTE">Urgente</option>
              </select>
            </div>
            <div className="flex items-end gap-2 pb-2">
              <input id="urgent" type="checkbox" checked={urgent} onChange={(e) => setUrgent(e.target.checked)} />
              <label htmlFor="urgent" className="text-sm">Urgent</label>
            </div>
            <div>
              <label className={labelCls}>Date limite connue</label>
              <input type="date" className={inputCls} value={dateLimite} onChange={(e) => setDateLimite(e.target.value)} />
            </div>
          </div>
        </div>
      )}

      {/* Étape 2 — Demandeur */}
      {etape === 1 && (
        <div className="space-y-4">
          <div>
            <label className={labelCls}>Demandeur principal *</label>
            <select className={inputCls} value={demandeurId} onChange={(e) => setDemandeurId(e.target.value)}>
              <option value="">— Choisir un demandeur existant —</option>
              {(() => {
                const clientDossierId = dossierChoisi?.client?.id;
                const lies = demandeurs.filter((d) => clientDossierId && (d.clientId === clientDossierId || d.client?.id === clientDossierId));
                const autres = demandeurs.filter((d) => !lies.includes(d));
                const renderOpt = (d: DemandeurOption) => (
                  <option key={d.id} value={d.id}>
                    {demandeurLabel(d)}{d.commune ? ` — ${d.commune}` : ""}{d.client?.raisonSociale ? ` (client : ${d.client.raisonSociale})` : ""}
                  </option>
                );
                return (
                  <>
                    {lies.length > 0 && (
                      <optgroup label={`Liés au client du dossier — ${dossierChoisi!.client.raisonSociale}`}>
                        {lies.map(renderOpt)}
                      </optgroup>
                    )}
                    <optgroup label={lies.length ? "Autres demandeurs" : undefined}>
                      {autres.map(renderOpt)}
                    </optgroup>
                  </>
                );
              })()}
            </select>
          </div>
          {!demandeurId && (
            <div className="rounded-lg border border-dashed border-gray-300 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-medium">Ou créer une fiche demandeur</div>
                {dossierChoisi?.client && (
                  <button
                    type="button"
                    onClick={prefillDemandeurClient}
                    className="rounded border border-cabinet-300 bg-cabinet-50 px-3 py-1 text-xs font-medium text-cabinet-700 hover:bg-cabinet-100"
                  >
                    Utiliser le client du dossier : {dossierChoisi.client.raisonSociale}
                  </button>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>Type</label>
                  <select
                    className={inputCls}
                    value={nouveauDemandeur.typePersonne}
                    onChange={(e) => setNouveauDemandeur({ ...nouveauDemandeur, typePersonne: e.target.value })}
                  >
                    <option value="PHYSIQUE">Personne physique</option>
                    <option value="MORALE">Personne morale</option>
                  </select>
                </div>
                {nouveauDemandeur.typePersonne === "MORALE" ? (
                  <div>
                    <label className={labelCls}>Raison sociale</label>
                    <input className={inputCls} value={nouveauDemandeur.raisonSociale}
                      onChange={(e) => setNouveauDemandeur({ ...nouveauDemandeur, raisonSociale: e.target.value })} />
                  </div>
                ) : (
                  <>
                    <div>
                      <label className={labelCls}>Nom *</label>
                      <input className={inputCls} value={nouveauDemandeur.nom}
                        onChange={(e) => setNouveauDemandeur({ ...nouveauDemandeur, nom: e.target.value })} />
                    </div>
                    <div>
                      <label className={labelCls}>Prénoms</label>
                      <input className={inputCls} value={nouveauDemandeur.prenoms}
                        onChange={(e) => setNouveauDemandeur({ ...nouveauDemandeur, prenoms: e.target.value })} />
                    </div>
                  </>
                )}
                <div>
                  <label className={labelCls}>Téléphone</label>
                  <input className={inputCls} value={nouveauDemandeur.telephone}
                    onChange={(e) => setNouveauDemandeur({ ...nouveauDemandeur, telephone: e.target.value })} />
                </div>
                <div>
                  <label className={labelCls}>E-mail</label>
                  <input type="email" className={inputCls} value={nouveauDemandeur.email}
                    onChange={(e) => setNouveauDemandeur({ ...nouveauDemandeur, email: e.target.value })} />
                </div>
                <div>
                  <label className={labelCls}>Commune</label>
                  <input className={inputCls} value={nouveauDemandeur.commune}
                    onChange={(e) => setNouveauDemandeur({ ...nouveauDemandeur, commune: e.target.value })} />
                </div>
                <div>
                  <label className={labelCls}>N° CNI / passeport</label>
                  <input className={inputCls} value={nouveauDemandeur.pieceIdentiteNumero}
                    onChange={(e) => setNouveauDemandeur({ ...nouveauDemandeur, pieceIdentiteNumero: e.target.value })} />
                </div>
              </div>
            </div>
          )}
          <div>
            <label className={labelCls}>Mandataire (si différent du demandeur)</label>
            <select className={inputCls} value={mandataireId} onChange={(e) => setMandataireId(e.target.value)}>
              <option value="">— Aucun —</option>
              {demandeurs.map((d) => (
                <option key={d.id} value={d.id}>{demandeurLabel(d)}</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">
              Une procuration devra être jointe à la check-list si le cabinet dépose pour le compte du demandeur.
            </p>
          </div>
        </div>
      )}

      {/* Étape 3 — Parcelle */}
      {etape === 2 && (
        <div className="space-y-4">
          {type?.parcelleRequise && (
            <div className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Une fiche bien / parcelle est requise pour cette démarche.
            </div>
          )}
          <div>
            <label className={labelCls}>Parcelle / bien existant</label>
            <select className={inputCls} value={parcelleId} onChange={(e) => setParcelleId(e.target.value)}>
              <option value="">— Choisir —</option>
              {parcelles.map((p) => (
                <option key={p.id} value={p.id}>{parcelleLabel(p)}</option>
              ))}
            </select>
          </div>
          {!parcelleId && (
            <div className="rounded-lg border border-dashed border-gray-300 p-4 space-y-3">
              <div className="text-sm font-medium">Ou créer une fiche parcelle</div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div><label className={labelCls}>Commune</label>
                  <input className={inputCls} value={nouvelleParcelle.commune}
                    onChange={(e) => setNouvelleParcelle({ ...nouvelleParcelle, commune: e.target.value })} /></div>
                <div><label className={labelCls}>Quartier / lotissement</label>
                  <input className={inputCls} value={nouvelleParcelle.quartier}
                    onChange={(e) => setNouvelleParcelle({ ...nouvelleParcelle, quartier: e.target.value })} /></div>
                <div><label className={labelCls}>Adresse / localisation</label>
                  <input className={inputCls} value={nouvelleParcelle.adresse}
                    onChange={(e) => setNouvelleParcelle({ ...nouvelleParcelle, adresse: e.target.value })} /></div>
                <div><label className={labelCls}>NICAD</label>
                  <input className={inputCls} value={nouvelleParcelle.nicad}
                    onChange={(e) => setNouvelleParcelle({ ...nouvelleParcelle, nicad: e.target.value })} /></div>
                <div><label className={labelCls}>Titre foncier</label>
                  <input className={inputCls} value={nouvelleParcelle.titreFoncier}
                    onChange={(e) => setNouvelleParcelle({ ...nouvelleParcelle, titreFoncier: e.target.value })} /></div>
                <div><label className={labelCls}>Référence du droit (bail, permis…)</label>
                  <input className={inputCls} value={nouvelleParcelle.referenceDroit}
                    onChange={(e) => setNouvelleParcelle({ ...nouvelleParcelle, referenceDroit: e.target.value })} /></div>
                <div><label className={labelCls}>Type de droit</label>
                  <select className={inputCls} value={nouvelleParcelle.typeDroit}
                    onChange={(e) => setNouvelleParcelle({ ...nouvelleParcelle, typeDroit: e.target.value })}>
                    <option value="">—</option>
                    <option value="titre_foncier">Titre foncier</option>
                    <option value="bail">Bail</option>
                    <option value="droit_superficie">Droit de superficie</option>
                    <option value="permis_occuper">Permis d'occuper</option>
                    <option value="autorisation_occuper">Autorisation d'occuper</option>
                    <option value="deliberation">Délibération</option>
                    <option value="acte_attribution">Acte d'attribution</option>
                    <option value="autre">Autre</option>
                  </select></div>
                <div><label className={labelCls}>Superficie (m²)</label>
                  <input type="number" className={inputCls} value={nouvelleParcelle.superficie}
                    onChange={(e) => setNouvelleParcelle({ ...nouvelleParcelle, superficie: e.target.value })} /></div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Étape 4 — Circuit */}
      {etape === 3 && (
        <div className="space-y-4">
          <div>
            <label className={labelCls}>Dossier juridique *</label>
            <select className={inputCls} value={dossierId} onChange={(e) => setDossierId(e.target.value)}>
              <option value="">— Choisir —</option>
              {dossiers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.referenceInterne} — {d.client.raisonSociale} ({d.typeAffaire})
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">
              Le rattachement au dossier active la GED, les permissions et le niveau de confidentialité.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls}>
                Autorité compétente{type?.qualificationObligatoire ? " *" : ""}
              </label>
              <select className={inputCls} value={autoriteId} onChange={(e) => setAutoriteId(e.target.value)}>
                <option value="">— Choisir —</option>
                {autorites.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nom}{a.commune ? ` — ${a.commune}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Ou autorité libre</label>
              <input className={inputCls} value={autoriteLibre} onChange={(e) => setAutoriteLibre(e.target.value)}
                placeholder="Ex. Bureau du Cadastre de Kaolack" />
            </div>
          </div>
          <div>
            <label className={labelCls}>Adresse de dépôt</label>
            <input className={inputCls} value={adresseDepot} onChange={(e) => setAdresseDepot(e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className={labelCls}>Responsable interne</label>
              <select className={inputCls} value={responsableId} onChange={(e) => setResponsableId(e.target.value)}>
                <option value="">—</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.prenom} {u.nom} ({u.role.nom})</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Assistante assignée</label>
              <select className={inputCls} value={assistanteId} onChange={(e) => setAssistanteId(e.target.value)}>
                <option value="">—</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.prenom} {u.nom} ({u.role.nom})</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Agent de liaison</label>
              <select className={inputCls} value={agentLiaisonId} onChange={(e) => setAgentLiaisonId(e.target.value)}>
                <option value="">—</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.prenom} {u.nom} ({u.role.nom})</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-5">
            {([
              ["Honoraires", honoraires, setHonoraires],
              ["Débours", debours, setDebours],
              ["Taxes", taxes, setTaxes],
              ["Timbres", timbres, setTimbres],
              ["Avances reçues", avancesRecues, setAvancesRecues],
            ] as const).map(([label, val, set]) => (
              <div key={label}>
                <label className={labelCls}>{label} (FCFA)</label>
                <input type="number" min={0} className={inputCls} value={val}
                  onChange={(e) => set(e.target.value)} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Étape 5 — Récapitulatif */}
      {etape === 4 && (
        <div className="space-y-4 text-sm">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border p-4 space-y-1">
              <div className="font-semibold">Démarche</div>
              <div>{type?.libelle}{sousTypeFinal ? ` — ${sousTypeFinal}` : ""}</div>
              <div className="text-gray-500">{objet}</div>
            </div>
            <div className="rounded-lg border p-4 space-y-1">
              <div className="font-semibold">Demandeur</div>
              <div>{demandeurId ? demandeurLabel(demandeurs.find((d) => d.id === demandeurId)) : `${nouveauDemandeur.prenoms} ${nouveauDemandeur.nom}${nouveauDemandeur.raisonSociale ? ` — ${nouveauDemandeur.raisonSociale}` : ""}`}</div>
            </div>
            <div className="rounded-lg border p-4 space-y-1">
              <div className="font-semibold">Bien / parcelle</div>
              <div>{parcelleId ? parcelleLabel(parcelles.find((p) => p.id === parcelleId)) : [nouvelleParcelle.adresse, nouvelleParcelle.commune, nouvelleParcelle.nicad && `NICAD ${nouvelleParcelle.nicad}`].filter(Boolean).join(", ") || "—"}</div>
            </div>
            <div className="rounded-lg border p-4 space-y-1">
              <div className="font-semibold">Circuit</div>
              <div>Dossier : {dossiers.find((d) => d.id === dossierId)?.referenceInterne}</div>
              <div>Autorité : {autorites.find((a) => a.id === autoriteId)?.nom || autoriteLibre || "—"}</div>
            </div>
          </div>
          {type && type.pieces.length > 0 && (
            <div className="rounded-lg border p-4">
              <div className="mb-2 font-semibold">
                Check-list générée ({type.pieces.length} pièce(s))
              </div>
              <ul className="list-disc space-y-0.5 pl-5 text-xs text-gray-600">
                {type.pieces.slice(0, 12).map((p) => (
                  <li key={p.code}>
                    {p.libelle}{" "}
                    <span className={p.niveau === "OBLIGATOIRE" ? "text-red-600" : "text-gray-400"}>
                      ({p.niveau === "OBLIGATOIRE" ? "obligatoire" : p.niveau.toLowerCase()})
                    </span>
                  </li>
                ))}
                {type.pieces.length > 12 && <li>…</li>}
              </ul>
            </div>
          )}
          {type?.qualificationObligatoire && !sousTypeFinal && (
            <div className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-amber-800">
              Attention : la qualification est incomplète — la démarche restera « À qualifier ».
            </div>
          )}
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between border-t pt-4">
        <button
          type="button"
          className="btn-secondary"
          onClick={() => (etape === 0 ? router.push("/cabinet/dossiers/demarches") : setEtape(etape - 1))}
        >
          {etape === 0 ? "Annuler" : "← Précédent"}
        </button>
        {etape < ETAPES.length - 1 ? (
          <button
            type="button"
            className="btn-primary disabled:opacity-50"
            disabled={!etapeValide()}
            onClick={() => setEtape(etape + 1)}
          >
            Suivant →
          </button>
        ) : (
          <button
            type="button"
            className="btn-primary disabled:opacity-50"
            disabled={loading}
            onClick={soumettre}
          >
            {loading ? "Création…" : "Créer la démarche"}
          </button>
        )}
      </div>
    </div>
  );
}
