"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ClientCreateDialog } from "@/components/client-create-dialog";
import { findSpecialiteForTypeAffaire } from "@/lib/specialite";
import { naturesMissionOf } from "@/lib/nature-mission";
import { stringListOf } from "@/lib/string-list";

interface ClientOption {
  id: string;
  raisonSociale: string;
  type: string;
}

interface UserOption {
  id: string;
  prenom: string;
  nom: string;
  role: { nom: string; estClient: boolean };
}

interface DossierFormData {
  referenceInterne: string;
  typeAffaire: string;
  natureMission: string[];
  clientId: string;
  avocatResponsableId: string;
  huissierResponsableId: string;
  niveauConfidentialite: number;
  dateEcheance: string;
  genererTachesWorkflow: boolean;
}

interface PartieAdverse {
  nom?: string;
  prenom?: string;
  raisonSociale?: string;
  qualite?: string;
}

interface CollaborateurInput {
  userId: string;
  roleRACI: "R" | "A" | "C" | "I";
  discipline?: string;
  /// Tâches attendues : titres de `TacheTemplate` cochés (multi-choix).
  tacheAttendue?: string[];
}

const RACI_LABELS: Record<string, string> = {
  R: "R — Responsable",
  A: "A — Approuve",
  C: "C — Consulté",
  I: "I — Informé",
};

const DISCIPLINES: { code: string; label: string }[] = [
  { code: "avocat", label: "Avocat" },
  { code: "huissier", label: "Huissier" },
  { code: "juriste", label: "Juriste" },
  { code: "greffier", label: "Greffier" },
  { code: "notaire", label: "Notaire" },
  { code: "expert_comptable", label: "Expert-comptable" },
  { code: "assistant", label: "Assistant" },
  { code: "architecte", label: "Architecte" },
  { code: "conseiller_juridique", label: "Conseiller juridique" },
  { code: "clerc", label: "Clerc" },
];

/// Tâche attendue par défaut pour un intervenant « client ».
const CLIENT_TACHE_ATTENDUE = "fournir les documents, suivre le dossier";

function isClientUser(u: UserOption | undefined): boolean {
  return !!u?.role?.estClient;
}

/// Détermine les valeurs par défaut (discipline, roleRACI) à appliquer
/// automatiquement selon le rôle de l'intervenant sélectionné.
/// - Client            → discipline "", RACI "I", tâche prédéfinie
/// - Rôle contenant "avocat" → discipline "avocat", RACI "C"
/// - Rôle contenant "juriste" → discipline "" (Indifférent), RACI "C"
/// - Sinon             → pas de forçage (libre)
function defaultsForRole(u: UserOption | undefined): {
  discipline?: string;
  roleRACI?: "R" | "A" | "C" | "I";
  tacheAttendue?: string[];
} | null {
  if (!u) return null;
  const r = u.role.nom.toLowerCase();
  if (isClientUser(u)) {
    return { discipline: "", roleRACI: "I", tacheAttendue: [CLIENT_TACHE_ATTENDUE] };
  }
  if (r.includes("avocat")) {
    return { discipline: "avocat", roleRACI: "C" };
  }
  if (r.includes("juriste")) {
    return { discipline: "", roleRACI: "C" };
  }
  if (r.includes("directeur")) {
    return { discipline: "", roleRACI: "A" };
  }
  return null;
}

interface ConflitDetecte {
  dossierConflitId: string;
  typeConflit: string;
  details: { description?: string; [k: string]: unknown };
}

interface SpecialiteOption {
  id: string;
  code: string;
  libelle: string;
}

interface ParametreOption {
  code: string;
  libelle: string;
}

interface DossierFormProps {
  clients: ClientOption[];
  users: UserOption[];
  currentUser: UserOption | null;
  /// Spécialités du cabinet proposées comme « type d'affaire ».
  specialites: SpecialiteOption[];
  /// Toutes les spécialités actives (résolution des anciens dossiers).
  toutesSpecialites: SpecialiteOption[];
  /// Natures de mission disponibles (paramètre `nature_mission`).
  naturesMission: ParametreOption[];
  /// Libellés des anciens codes `type_affaire` (paramètres) pour la résolution.
  typeAffaireParamLibelles: Record<string, string>;
  /// Niveaux de confidentialité disponibles (paramètre `niveau_confidentialite`).
  niveauxConfidentialite?: ParametreOption[];
  /// Titres des modèles de tâches actifs, groupés par spécialité.
  tachesParSpecialite: Record<string, string[]>;
  mode: "create" | "edit";
  dossierId?: string;
  initialData?: Partial<DossierFormData>;
  submitLabel: string;
  successHref: string;
  cancelHref: string;
}

function isAvocatRole(roleName: string) {
  const r = roleName.toLowerCase();
  return r.includes("avocat") || r.includes("directeur") || r.includes("associé");
}

function generateReference() {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, "");
  const time = now.toTimeString().slice(0, 8).replace(/:/g, "");
  const ms = now.getMilliseconds().toString().padStart(3, "0");
  const random = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `REF-${date}-${time}-${ms}-${random}`;
}

export function DossierForm({
  clients,
  users,
  currentUser,
  specialites,
  toutesSpecialites,
  naturesMission,
  typeAffaireParamLibelles,
  niveauxConfidentialite = [],
  tachesParSpecialite,
  mode,
  dossierId,
  initialData,
  submitLabel,
  successHref,
  cancelHref,
}: DossierFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [clientQuery, setClientQuery] = useState("");
  const [clientDialogOpen, setClientDialogOpen] = useState(false);
  /// Clients créés depuis la modale « + Ajouter » (fusionnés à la liste initiale).
  const [addedClients, setAddedClients] = useState<ClientOption[]>([]);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [generalError, setGeneralError] = useState("");

  const defaultAvocatId = useMemo(() => {
    if (!initialData?.avocatResponsableId && currentUser && isAvocatRole(currentUser.role.nom)) {
      return currentUser.id;
    }
    return initialData?.avocatResponsableId || "";
  }, [currentUser, initialData]);

  const [form, setForm] = useState<Partial<DossierFormData>>({
    referenceInterne: initialData?.referenceInterne || generateReference(),
    typeAffaire: initialData?.typeAffaire || "",
    natureMission: naturesMissionOf(initialData?.natureMission),
    clientId: initialData?.clientId || "",
    avocatResponsableId: defaultAvocatId,
    huissierResponsableId: initialData?.huissierResponsableId || "",
    niveauConfidentialite: initialData?.niveauConfidentialite ?? 1,
    dateEcheance: initialData?.dateEcheance || "",
    genererTachesWorkflow: initialData?.genererTachesWorkflow ?? true,
  });
  const [partiesAdverses, setPartiesAdverses] = useState<PartieAdverse[]>(
    (initialData as any)?.partiesAdverses || []
  );
  const [collaborateurs, setCollaborateurs] = useState<CollaborateurInput[]>(
    ((initialData as any)?.collaborateurs || []).map((c: any) => ({
      ...c,
      tacheAttendue: stringListOf(c.tacheAttendue),
    }))
  );
  const [conflits, setConflits] = useState<ConflitDetecte[]>([]);
  const [conflitsAcceptes, setConflitsAcceptes] = useState(false);

  const avocats = useMemo(
    () => users.filter((u) => isAvocatRole(u.role.nom)),
    [users]
  );

  const huissiers = useMemo(
    () => users.filter((u) => u.role.nom.toLowerCase().includes("huissier")),
    [users]
  );

  const allClients = useMemo(() => {
    const merged = new Map<string, ClientOption>();
    for (const c of [...clients, ...addedClients]) merged.set(c.id, c);
    return [...merged.values()].sort((a, b) =>
      a.raisonSociale.localeCompare(b.raisonSociale, "fr")
    );
  }, [clients, addedClients]);

  const filteredClients = useMemo(() => {
    const q = clientQuery.trim().toLowerCase();
    if (!q) return allClients;
    return allClients.filter((c) => c.raisonSociale.toLowerCase().includes(q));
  }, [allClients, clientQuery]);

  // Spécialité résolue depuis le type d'affaire choisi (code de spécialité
  // pour les nouveaux dossiers, ancien code paramètre pour l'édition).
  const specialiteCourante = useMemo(
    () =>
      findSpecialiteForTypeAffaire(
        form.typeAffaire || "",
        typeAffaireParamLibelles[form.typeAffaire || ""],
        toutesSpecialites
      ),
    [form.typeAffaire, typeAffaireParamLibelles, toutesSpecialites]
  );

  // Tâches attendues suggérées pour les intervenants : modèles de tâches de
  // la spécialité du dossier.
  const tachesAttenduesSuggestions = useMemo(
    () => (specialiteCourante ? tachesParSpecialite[specialiteCourante.id] || [] : []),
    [specialiteCourante, tachesParSpecialite]
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrors({});
    setGeneralError("");

    const url = mode === "edit" && dossierId ? `/api/dossiers/${dossierId}` : "/api/dossiers";
    const method = mode === "edit" ? "PATCH" : "POST";

    const body: Record<string, unknown> = {
      ...form,
      dateEcheance: form.dateEcheance || null,
      partiesAdverses: partiesAdverses.filter(
        (p) => (p.raisonSociale || p.nom || p.prenom || "").trim()
      ),
      collaborateurs: collaborateurs.filter((c) => c.userId),
      conflitsAcceptes,
    };

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    setLoading(false);

    if (res.ok) {
      router.push(successHref);
      return;
    }

    const data = await res.json().catch(() => ({}));

    // Gestion spécifique des conflits d'intérêts (409)
    if (res.status === 409 && data?.error === "conflits_detectes") {
      setConflits(data.conflits || []);
      setConflitsAcceptes(false);
      setGeneralError(
        data.message || `${data.count} conflit(s) d'intérêts détecté(s). Veuillez confirmer pour poursuivre.`
      );
      return;
    }

    // Si on avait accepté les conflits mais qu'il y a encore une erreur, on réinitialise
    setConflits([]);
    setConflitsAcceptes(false);

    if (data?.error?.fieldErrors) {
      setErrors(data.error.fieldErrors);
      // Champs sans emplacement d'affichage dédié (collaborateurs,
      // partiesAdverses...) : remontés dans l'erreur générale pour ne pas
      // laisser un 400 silencieux.
      const renderedFields = new Set([
        "referenceInterne",
        "typeAffaire",
        "natureMission",
        "clientId",
        "avocatResponsableId",
        "huissierResponsableId",
        "dateEcheance",
        "niveauConfidentialite",
      ]);
      const extra = Object.entries(
        data.error.fieldErrors as Record<string, string[]>
      )
        .filter(([k]) => !renderedFields.has(k))
        .flatMap(([k, arr]) => (Array.isArray(arr) ? arr : [String(arr)]));
      setGeneralError(
        [data.error.formErrors?.[0], ...extra].filter(Boolean).join(" — ")
      );
    } else if (typeof data.error === "string") {
      setGeneralError(data.error);
    } else {
      setGeneralError("Erreur lors de l'enregistrement du dossier");
    }
  }

  function fieldError(name: string) {
    return errors[name]?.[0] ? (
      <p className="mt-1 text-xs text-red-600">{errors[name][0]}</p>
    ) : null;
  }

  return (
    <form onSubmit={onSubmit} className="card mx-auto max-w-2xl space-y-5">
      {generalError && (
        <div className="rounded-md bg-red-100 p-3 text-sm text-red-700">{generalError}</div>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className="mb-1 block text-sm font-medium">Référence interne</label>
          <input
            type="text"
            value={form.referenceInterne}
            onChange={(e) => setForm({ ...form, referenceInterne: e.target.value })}
            className="input bg-gray-50"
            required
          />
          {fieldError("referenceInterne")}
          {mode === "create" && (
            <p className="mt-1 text-xs text-gray-500">Générée automatiquement, modifiable.</p>
          )}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Type d&apos;affaire (spécialité du cabinet)</label>
          <select
            value={form.typeAffaire || ""}
            onChange={(e) => setForm({ ...form, typeAffaire: e.target.value })}
            className="input"
            required
          >
            <option value="">Sélectionner une spécialité</option>
            {specialites.map((s) => (
              <option key={s.id} value={s.code}>
                {s.libelle}
              </option>
            ))}
            {/* Ancienne valeur conservée en édition si elle ne figure plus dans les spécialités */}
            {form.typeAffaire && !specialites.some((s) => s.code === form.typeAffaire) && (
              <option value={form.typeAffaire}>
                {typeAffaireParamLibelles[form.typeAffaire] || specialiteCourante?.libelle || form.typeAffaire}
              </option>
            )}
          </select>
          {fieldError("typeAffaire")}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Nature de la mission</label>
          <div className="max-h-44 space-y-1 overflow-y-auto rounded-md border border-gray-200 p-2">
            {naturesMission.length === 0 && (
              <p className="text-xs text-gray-500">Aucune nature de mission paramétrée.</p>
            )}
            {naturesMission.map((n) => {
              const selection = form.natureMission || [];
              const checked = selection.includes(n.code);
              return (
                <label key={n.code} className="flex items-center gap-2 rounded px-1 py-0.5 text-sm hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        natureMission: e.target.checked
                          ? [...selection, n.code]
                          : selection.filter((c) => c !== n.code),
                      })
                    }
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <span>{n.libelle}</span>
                </label>
              );
            })}
          </div>
          {fieldError("natureMission")}
        </div>

        <div className="md:col-span-2">
          <div className="mb-1 flex items-center justify-between">
            <label className="block text-sm font-medium">Client</label>
            <button
              type="button"
              onClick={() => setClientDialogOpen(true)}
              className="text-sm text-cabinet-700 hover:underline"
            >
              + Ajouter
            </button>
          </div>
          <input
            type="text"
            value={clientQuery}
            onChange={(e) => {
              setClientQuery(e.target.value);
              setForm((f) => ({ ...f, clientId: "" }));
            }}
            className="input mb-2"
            placeholder="Rechercher un client..."
          />
          <select
            value={form.clientId}
            onChange={(e) => {
              setForm({ ...form, clientId: e.target.value });
              setErrors((prev) => {
                if (!prev.clientId) return prev;
                const next = { ...prev };
                delete next.clientId;
                return next;
              });
            }}
            className="input"
            required
            size={Math.min(5, filteredClients.length + 1)}
          >
            <option value="">Sélectionner un client</option>
            {filteredClients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.raisonSociale} ({c.type})
              </option>
            ))}
          </select>
          {filteredClients.length === 0 && clientQuery && (
            <p className="mt-1 text-xs text-cabinet-600">
              Aucun client trouvé.{" "}
              <button
                type="button"
                onClick={() => setClientDialogOpen(true)}
                className="underline"
              >
                Créer un client
              </button>
            </p>
          )}
          {fieldError("clientId")}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Avocat responsable</label>
          <select
            value={form.avocatResponsableId}
            onChange={(e) => setForm({ ...form, avocatResponsableId: e.target.value })}
            className="input"
            required
          >
            <option value="">Sélectionner</option>
            {avocats.map((u) => (
              <option key={u.id} value={u.id}>
                {u.prenom} {u.nom} ({u.role.nom})
              </option>
            ))}
          </select>
          {fieldError("avocatResponsableId")}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Huissier responsable</label>
          <select
            value={form.huissierResponsableId}
            onChange={(e) => setForm({ ...form, huissierResponsableId: e.target.value })}
            className="input"
          >
            <option value="">Aucun</option>
            {huissiers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.prenom} {u.nom}
              </option>
            ))}
          </select>
          {fieldError("huissierResponsableId")}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Date d&apos;échéance</label>
          <input
            type="date"
            value={form.dateEcheance}
            onChange={(e) => setForm({ ...form, dateEcheance: e.target.value })}
            className="input"
          />
          {fieldError("dateEcheance")}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Niveau de confidentialité</label>
          <select
            value={String(form.niveauConfidentialite ?? 1)}
            onChange={(e) =>
              setForm({
                ...form,
                niveauConfidentialite: e.target.value ? parseInt(e.target.value, 10) : (form.niveauConfidentialite ?? 1),
              })
            }
            className="input"
            required
          >
            <option value="">Sélectionner un niveau</option>
            {(niveauxConfidentialite || []).map((n) => (
              <option key={n.code} value={n.code}>
                {n.libelle}
              </option>
            ))}
          </select>
          {fieldError("niveauConfidentialite")}
        </div>
      </div>

      {/* Parties adverses */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium">Parties adverses</label>
          <button
            type="button"
            onClick={() => setPartiesAdverses([...partiesAdverses, {}])}
            className="text-sm text-cabinet-700 hover:underline"
          >
            + Ajouter une partie
          </button>
        </div>
        {partiesAdverses.length === 0 && (
          <p className="text-xs text-gray-500">
            Aucune partie adverse renseignée. La détection automatique des conflits
            d&apos;intérêts sera limitée au client principal.
          </p>
        )}
        {partiesAdverses.map((p, i) => (
          <div key={i} className="grid gap-3 rounded-md border border-gray-200 bg-gray-50 p-3 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Raison sociale</label>
              <input
                type="text"
                value={p.raisonSociale || ""}
                onChange={(e) => {
                  const copy = [...partiesAdverses];
                  copy[i] = { ...copy[i], raisonSociale: e.target.value };
                  setPartiesAdverses(copy);
                }}
                className="input"
                placeholder="Ex. Société XYZ"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Prénom / Nom</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={p.prenom || ""}
                  onChange={(e) => {
                    const copy = [...partiesAdverses];
                    copy[i] = { ...copy[i], prenom: e.target.value };
                    setPartiesAdverses(copy);
                  }}
                  className="input"
                  placeholder="Prénom"
                />
                <input
                  type="text"
                  value={p.nom || ""}
                  onChange={(e) => {
                    const copy = [...partiesAdverses];
                    copy[i] = { ...copy[i], nom: e.target.value };
                    setPartiesAdverses(copy);
                  }}
                  className="input"
                  placeholder="Nom"
                />
              </div>
            </div>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="mb-1 block text-xs font-medium text-gray-600">Qualité</label>
                <input
                  type="text"
                  value={p.qualite || ""}
                  onChange={(e) => {
                    const copy = [...partiesAdverses];
                    copy[i] = { ...copy[i], qualite: e.target.value };
                    setPartiesAdverses(copy);
                  }}
                  className="input"
                  placeholder="Ex. Défenderesse"
                />
              </div>
              <button
                type="button"
                onClick={() => setPartiesAdverses(partiesAdverses.filter((_, idx) => idx !== i))}
                className="rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-600 transition hover:bg-red-50"
              >
                Retirer
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Associés / Intervenants */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <label className="block text-sm font-medium">Associés / Intervenants</label>
            <p className="text-xs text-gray-500">
              Ajoutez d&apos;autres avocats, juristes, huissiers, architectes, conseillers juridiques, clercs ou greffiers du cabinet,
              avec pour chacun le travail ou la tâche attendue sur ce dossier.
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              setCollaborateurs([
                ...collaborateurs,
                { userId: "", roleRACI: "C", discipline: "", tacheAttendue: [] },
              ])
            }
            className="text-sm text-cabinet-700 hover:underline"
          >
            + Ajouter un intervenant
          </button>
        </div>

        {collaborateurs.length === 0 && (
          <p className="text-xs text-gray-500">
            Aucun associé / intervenant supplémentaire. L&apos;avocat responsable et
            l&apos;huissier responsable sont déjà désignés ci-dessus.
          </p>
        )}

        {collaborateurs.map((c, i) => {
          const selectedUser = users.find((u) => u.id === c.userId);
          const isClient = isClientUser(selectedUser);
          const isAlreadyResponsable =
            c.userId &&
            (c.userId === form.avocatResponsableId || c.userId === form.huissierResponsableId);
          return (
            <div
              key={i}
              className="space-y-3 rounded-md border border-gray-200 bg-gray-50 p-3"
            >
              <div className="grid gap-3 md:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">
                    Intervenant
                  </label>
                  <select
                    value={c.userId}
                    onChange={(e) => {
                      const copy = [...collaborateurs];
                      const picked = users.find((u) => u.id === e.target.value);
                      const defaults = defaultsForRole(picked);
                      const pickedIsClient = isClientUser(picked);
                      copy[i] = {
                        ...copy[i],
                        userId: e.target.value,
                        // Applique les valeurs par défaut selon le rôle.
                        // Si pas de forçage, on conserve les valeurs saisies
                        // (en réinitialisant celles qui avaient été forcées par un client).
                        discipline: defaults?.discipline !== undefined
                          ? defaults.discipline
                          : copy[i].discipline,
                        roleRACI: defaults?.roleRACI !== undefined
                          ? defaults.roleRACI
                          : copy[i].roleRACI === "I" && !isClientUser(picked)
                            ? "C"
                            : copy[i].roleRACI,
                        tacheAttendue: defaults?.tacheAttendue !== undefined
                          ? defaults.tacheAttendue
                          : copy[i].tacheAttendue?.length === 1 &&
                              copy[i].tacheAttendue[0] === CLIENT_TACHE_ATTENDUE &&
                              !pickedIsClient
                            ? []
                            : copy[i].tacheAttendue,
                      };
                      setCollaborateurs(copy);
                    }}
                    className="input"
                    required
                  >
                    <option value="">Sélectionner</option>
                    {users.filter((u) => !isClientUser(u)).map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.prenom} {u.nom} ({u.role.nom})
                      </option>
                    ))}
                  </select>
                  {isAlreadyResponsable && (
                    <p className="mt-1 text-xs text-amber-700">
                      Déjà désigné comme responsable ci-dessus — sera ignoré à la création.
                    </p>
                  )}
                  {isClient && (
                    <p className="mt-1 text-xs text-blue-700">
                      Client : discipline Indifférent, rôle Informé (I), tâche prédéfinie.
                    </p>
                  )}
                  {!isClient && selectedUser && defaultsForRole(selectedUser) && (
                    <p className="mt-1 text-xs text-cabinet-700">
                      Valeurs suggérées appliquées selon le rôle (modifiables).
                    </p>
                  )}
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">
                    Discipline
                  </label>
                  <select
                    value={c.discipline || ""}
                    onChange={(e) => {
                      const copy = [...collaborateurs];
                      copy[i] = { ...copy[i], discipline: e.target.value };
                      setCollaborateurs(copy);
                    }}
                    className={`input ${isClient ? "bg-gray-100" : ""}`}
                    disabled={isClient}
                  >
                    <option value="">Indifférent</option>
                    {DISCIPLINES.map((d) => (
                      <option key={d.code} value={d.code}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">
                    Rôle RACI
                  </label>
                  <select
                    value={c.roleRACI}
                    onChange={(e) => {
                      const copy = [...collaborateurs];
                      copy[i] = {
                        ...copy[i],
                        roleRACI: e.target.value as CollaborateurInput["roleRACI"],
                      };
                      setCollaborateurs(copy);
                    }}
                    className={`input ${isClient ? "bg-gray-100" : ""}`}
                    disabled={isClient}
                  >
                    {Object.entries(RACI_LABELS).map(([code, label]) => (
                      <option key={code} value={code}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="mb-1 block text-xs font-medium text-gray-600">
                    Travail / tâches attendues
                  </label>
                  {isClient ? (
                    <p className="text-xs text-gray-500">{CLIENT_TACHE_ATTENDUE}</p>
                  ) : (
                    <div className="max-h-32 space-y-1 overflow-y-auto rounded-md border border-gray-200 bg-white p-2">
                      {tachesAttenduesSuggestions.length === 0 && (
                        <p className="text-xs text-gray-400">
                          {specialiteCourante
                            ? "Aucune tâche modèle pour cette spécialité."
                            : "Sélectionnez d'abord un type d'affaire."}
                        </p>
                      )}
                      {/* Tâches de la spécialité + valeurs existantes hors liste */}
                      {[...new Set([...tachesAttenduesSuggestions, ...(c.tacheAttendue || [])])].map(
                        (t) => {
                          const checked = (c.tacheAttendue || []).includes(t);
                          return (
                            <label
                              key={t}
                              className="flex items-center gap-2 rounded px-1 py-0.5 text-xs hover:bg-gray-50"
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                  const cur = c.tacheAttendue || [];
                                  const copy = [...collaborateurs];
                                  copy[i] = {
                                    ...copy[i],
                                    tacheAttendue: e.target.checked
                                      ? [...cur, t]
                                      : cur.filter((x) => x !== t),
                                  };
                                  setCollaborateurs(copy);
                                }}
                                className="h-3.5 w-3.5 rounded border-gray-300"
                              />
                              <span>{t}</span>
                            </label>
                          );
                        }
                      )}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setCollaborateurs(collaborateurs.filter((_, idx) => idx !== i))
                  }
                  className="rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-600 transition hover:bg-red-50"
                >
                  Retirer
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Affichage des conflits d'intérêts détectés */}
      {conflits.length > 0 && (
        <div className="space-y-3 rounded-md border-2 border-amber-300 bg-amber-50 p-4">
          <div className="flex items-start gap-2">
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
              className="mt-0.5 flex-shrink-0 text-amber-600"
            >
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
              <path d="M12 9v4" />
              <path d="M12 17h.01" />
            </svg>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-amber-900">
                {conflits.length} conflit(s) d&apos;intérêts détecté(s)
              </h3>
              <p className="mt-0.5 text-xs text-amber-700">
                Vérifiez les éléments ci-dessous. Si l&apos;absence de conflit réel est confirmée,
                vous pouvez accepter et poursuivre l&apos;ouverture.
              </p>
            </div>
          </div>
          <ul className="space-y-2">
            {conflits.map((c, i) => (
              <li key={i} className="rounded-md bg-white p-3 text-sm">
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      c.typeConflit === "client_commun"
                        ? "bg-gray-100 text-gray-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {c.typeConflit === "client_vs_partie_adverse"
                      ? "Client vs partie adverse"
                      : c.typeConflit === "partie_adverse_vs_client"
                        ? "Partie adverse vs client"
                        : c.typeConflit}
                  </span>
                </div>
                <p className="mt-1 text-gray-700">
                  {c.details?.description || JSON.stringify(c.details)}
                </p>
              </li>
            ))}
          </ul>
          <label className="flex items-start gap-2 rounded-md bg-white p-3">
            <input
              type="checkbox"
              checked={conflitsAcceptes}
              onChange={(e) => setConflitsAcceptes(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
            />
            <span className="text-sm text-amber-900">
              J&apos;ai vérifié les conflits signalés et confirme qu&apos;il n&apos;existe pas
              de conflit d&apos;intérêts réel empêchant l&apos;ouverture de ce dossier.
            </span>
          </label>
        </div>
      )}

      {mode === "create" && (
        <label className="flex items-start gap-3 rounded-md border border-cabinet-200 bg-cabinet-50 p-3">
          <input
            type="checkbox"
            checked={form.genererTachesWorkflow ?? true}
            onChange={(e) => setForm({ ...form, genererTachesWorkflow: e.target.checked })}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-cabinet-700 focus:ring-cabinet-500"
          />
          <span className="text-sm">
            <span className="font-medium text-cabinet-900">
              Générer les tâches du workflow automatiquement
            </span>
            <span className="mt-0.5 block text-cabinet-700">
              Crée automatiquement les tâches de démarrage à partir du modèle de la spécialité
              sélectionnée (échéances, rôles attendus et priorités pré-définis).
            </span>
          </span>
        </label>
      )}

      <div className="flex items-center justify-end gap-3 pt-4">
        <button
          type="button"
          onClick={() => router.push(cancelHref)}
          className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
        >
          Annuler
        </button>
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? "Enregistrement..." : submitLabel}
        </button>
      </div>

      <ClientCreateDialog
        open={clientDialogOpen}
        onClose={() => setClientDialogOpen(false)}
        onCreated={(client) => {
          setAddedClients((prev) => [...prev, client]);
          setClientQuery("");
          setForm((f) => ({ ...f, clientId: client.id }));
          setErrors((prev) => {
            if (!prev.clientId) return prev;
            const next = { ...prev };
            delete next.clientId;
            return next;
          });
          setClientDialogOpen(false);
        }}
      />
    </form>
  );
}
