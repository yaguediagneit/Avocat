"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  MATIERES,
  NIVEAUX_PROCEDURE,
  NIVEAU_LABELS,
  TYPES_RECOURS,
  TYPE_RECOURS_LABELS,
  ORIGINES_RECOURS,
  ORIGINE_LABELS,
  TYPES_DECISION,
  TYPE_DECISION_LABELS,
  SENS_DECISION,
  SENS_DECISION_LABELS,
  ISSUES_RECOURS,
  ISSUE_LABELS,
  PROCEDURE_TRANSITIONS,
  PROCEDURE_STATUT_LABELS,
  PROCEDURE_STATUT_BADGES,
  RECOURS_TRANSITIONS,
  RECOURS_STATUT_LABELS,
  RECOURS_STATUT_BADGES,
  delaiRecoursJours,
  joursRestants,
} from "@/lib/recours";

type DateLike = Date | string | null;

interface RecoursDto {
  id: string;
  typeRecours: string;
  origine: string;
  juridictionCible: string | null;
  pointDepart: string | null;
  delaiJours: number | null;
  dateReference: DateLike;
  dateLimite: DateLike;
  dateDeclaration: DateLike;
  dateSignification: DateLike;
  dateConsignation: DateLike;
  dateMemoire: DateLike;
  statut: string;
  issue: string | null;
  avocatId: string | null;
  notes: string | null;
}

interface ProcedureDto {
  id: string;
  niveau: string;
  juridiction: string;
  chambre: string | null;
  greffe: string | null;
  referenceRg: string | null;
  dateSaisine: DateLike;
  datePrononce: DateLike;
  dateSignification: DateLike;
  typeDecision: string | null;
  decision: string | null;
  sensDecision: string;
  statut: string;
  publieClient: boolean;
  notes: string | null;
  recoursExerces: RecoursDto[];
}

function fmt(d: DateLike | undefined): string {
  return d ? new Date(d).toLocaleDateString("fr-FR") : "—";
}

function toInputDate(d: DateLike | undefined): string {
  return d ? new Date(d).toISOString().slice(0, 10) : "";
}

function DeadlineBadge({ recours }: { recours: RecoursDto }) {
  if (!recours.dateLimite) return <span className="text-xs text-gray-400">Délai non déterminé</span>;
  const restants = joursRestants(new Date(recours.dateLimite));
  const enCours = RECOURS_TRANSITIONS[recours.statut]?.length > 0 &&
    ["A_ANALYSER", "A_PREPARER", "EN_VALIDATION_AVOCAT", "EN_VALIDATION_CLIENT", "A_DEPOSER", "A_DECLARER"].includes(recours.statut);
  if (!enCours) {
    return <span className="text-xs text-gray-500">Délai : {fmt(recours.dateLimite)}</span>;
  }
  const cls =
    restants < 0
      ? "bg-red-100 text-red-800"
      : restants <= 3
        ? "bg-red-100 text-red-700"
        : restants <= 7
          ? "bg-amber-100 text-amber-800"
          : "bg-emerald-100 text-emerald-800";
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>
      {restants < 0
        ? `Délai dépassé de ${Math.abs(restants)} j`
        : restants === 0
          ? "Expire aujourd'hui"
          : `J-${restants} — limite ${fmt(recours.dateLimite)}`}
    </span>
  );
}

export function DossierProcedures({
  dossierId,
  matiere,
  procedures: initial,
  users,
  canEdit,
}: {
  dossierId: string;
  matiere: string | null;
  procedures: ProcedureDto[];
  users: { id: string; nom: string }[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [erreur, setErreur] = useState<string | null>(null);
  const [showProcForm, setShowProcForm] = useState(false);
  const [recoursFormFor, setRecoursFormFor] = useState<string | null>(null);
  const [decisionFormFor, setDecisionFormFor] = useState<string | null>(null);
  const [transitionFor, setTransitionFor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function call(url: string, method: string, payload?: unknown) {
    setLoading(true);
    setErreur(null);
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: payload ? JSON.stringify(payload) : undefined,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErreur(typeof json.error === "string" ? json.error : "Erreur serveur");
        return false;
      }
      router.refresh();
      return true;
    } finally {
      setLoading(false);
    }
  }

  /* ------- formulaire nouvelle procédure ------- */
  const [procForm, setProcForm] = useState({
    niveau: "premiere_instance",
    juridiction: "",
    chambre: "",
    greffe: "",
    referenceRg: "",
    dateSaisine: "",
  });

  async function submitProcedure(e: React.FormEvent) {
    e.preventDefault();
    const ok = await call(`/api/dossiers/${dossierId}/procedures`, "POST", {
      ...procForm,
      dateSaisine: procForm.dateSaisine || null,
    });
    if (ok) {
      setShowProcForm(false);
      setProcForm({ niveau: "premiere_instance", juridiction: "", chambre: "", greffe: "", referenceRg: "", dateSaisine: "" });
    }
  }

  /* ------- formulaire décision ------- */
  const [decForm, setDecForm] = useState<Record<string, unknown>>({});

  function openDecisionForm(p: ProcedureDto) {
    setDecForm({
      typeDecision: p.typeDecision || "jugement",
      datePrononce: toInputDate(p.datePrononce),
      dateSignification: toInputDate(p.dateSignification),
      sensDecision: p.sensDecision || "en_attente",
      decision: p.decision || "",
    });
    setDecisionFormFor(p.id);
  }

  async function submitDecision(p: ProcedureDto, e: React.FormEvent) {
    e.preventDefault();
    const ok = await call(`/api/procedures/${p.id}`, "PATCH", {
      ...decForm,
      datePrononce: decForm.datePrononce || null,
      dateSignification: decForm.dateSignification || null,
      statut: decForm.dateSignification
        ? "DECISION_SIGNIFIEE"
        : decForm.datePrononce
          ? "DECISION_RENDUE"
          : undefined,
    });
    if (ok) setDecisionFormFor(null);
  }

  /* ------- formulaire recours ------- */
  const [recForm, setRecForm] = useState<Record<string, string>>({});

  function openRecoursForm(p: ProcedureDto) {
    const suggestion =
      p.niveau === "premiere_instance" ? "appel" : p.niveau === "appel" ? "pourvoi" : "autre";
    const delai = delaiRecoursJours(matiere, suggestion);
    setRecForm({
      typeRecours: suggestion,
      origine: "client",
      juridictionCible:
        suggestion === "pourvoi" ? "Cour suprême" : suggestion === "appel" ? "Cour d'appel" : "",
      delaiJours: delai ? String(delai) : "",
      avocatId: "",
      notes: "",
    });
    setRecoursFormFor(p.id);
  }

  async function submitRecours(p: ProcedureDto, e: React.FormEvent) {
    e.preventDefault();
    const ok = await call(`/api/procedures/${p.id}/recours`, "POST", {
      typeRecours: recForm.typeRecours,
      origine: recForm.origine,
      juridictionCible: recForm.juridictionCible || null,
      delaiJours: recForm.delaiJours ? Number(recForm.delaiJours) : null,
      avocatId: recForm.avocatId || null,
      notes: recForm.notes || null,
    });
    if (ok) setRecoursFormFor(null);
  }

  /* ------- transition de recours ------- */
  const [transForm, setTransForm] = useState<Record<string, string>>({});

  function openTransition(r: RecoursDto) {
    setTransForm({
      statut: "",
      dateDeclaration: toInputDate(r.dateDeclaration),
      dateSignification: toInputDate(r.dateSignification),
      dateConsignation: toInputDate(r.dateConsignation),
      dateMemoire: toInputDate(r.dateMemoire),
      issue: r.issue || "",
      juridictionCible: r.juridictionCible || "",
      note: "",
    });
    setTransitionFor(r.id);
  }

  const TRANSITION_DATE_FIELDS: Record<string, string> = {
    DEPOSE: "dateDeclaration",
    DECLARE: "dateDeclaration",
    SIGNIFIE: "dateSignification",
    CONSIGNE: "dateConsignation",
    MEMOIRE_DEPOSE: "dateMemoire",
  };

  async function submitTransition(r: RecoursDto, e: React.FormEvent) {
    e.preventDefault();
    if (!transForm.statut) return;
    const payload: Record<string, unknown> = {
      statut: transForm.statut,
      note: transForm.note || null,
    };
    const champ = TRANSITION_DATE_FIELDS[transForm.statut];
    if (champ) payload[champ] = transForm[champ] || null;
    if (transForm.statut === "JUGE") payload.issue = transForm.issue || null;
    if (transForm.statut === "ENREGISTRE" && transForm.juridictionCible)
      payload.juridictionCible = transForm.juridictionCible;
    const ok = await call(`/api/recours/${r.id}/transition`, "POST", payload);
    if (ok) setTransitionFor(null);
  }

  const input = "w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm";
  const label = "block text-xs font-medium text-gray-600 mb-1";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-medium">Parcours procédural</h3>
        {canEdit && (
          <button onClick={() => setShowProcForm((v) => !v)} className="text-sm text-cabinet-700 hover:underline">
            + Ajouter une procédure
          </button>
        )}
      </div>

      {/* Matière : pilote le calcul automatique des délais. */}
      {canEdit && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
          <span className="text-gray-600">Matière du dossier :</span>
          <select
            className="rounded-md border border-gray-300 px-2 py-1 text-sm"
            value={matiere || ""}
            onChange={async (e) => {
              await call(`/api/dossiers/${dossierId}`, "PATCH", { matiere: e.target.value || null });
            }}
          >
            <option value="">— Non renseignée —</option>
            {MATIERES.map((m) => (
              <option key={m.code} value={m.code}>{m.label}</option>
            ))}
          </select>
          {!matiere && (
            <span className="text-xs text-amber-700">
              Requis pour calculer automatiquement les délais de pourvoi.
            </span>
          )}
        </div>
      )}

      {erreur && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{erreur}</p>
      )}

      {showProcForm && (
        <form onSubmit={submitProcedure} className="space-y-3 rounded-md border border-cabinet-200 bg-cabinet-50/50 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={label}>Niveau</label>
              <select className={input} value={procForm.niveau} onChange={(e) => setProcForm({ ...procForm, niveau: e.target.value })}>
                {NIVEAUX_PROCEDURE.map((n) => (
                  <option key={n.code} value={n.code}>{n.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={label}>Juridiction *</label>
              <input className={input} required value={procForm.juridiction} onChange={(e) => setProcForm({ ...procForm, juridiction: e.target.value })} placeholder="Tribunal de grande instance de Dakar" />
            </div>
            <div>
              <label className={label}>Chambre / formation</label>
              <input className={input} value={procForm.chambre} onChange={(e) => setProcForm({ ...procForm, chambre: e.target.value })} placeholder="Chambre civile, correctionnelle…" />
            </div>
            <div>
              <label className={label}>Greffe</label>
              <input className={input} value={procForm.greffe} onChange={(e) => setProcForm({ ...procForm, greffe: e.target.value })} />
            </div>
            <div>
              <label className={label}>N° de rôle / RG</label>
              <input className={input} value={procForm.referenceRg} onChange={(e) => setProcForm({ ...procForm, referenceRg: e.target.value })} />
            </div>
            <div>
              <label className={label}>Date de saisine</label>
              <input type="date" className={input} value={procForm.dateSaisine} onChange={(e) => setProcForm({ ...procForm, dateSaisine: e.target.value })} />
            </div>
          </div>
          <div className="flex gap-3">
            <button type="submit" disabled={loading} className="btn-primary text-xs">Créer la procédure</button>
            <button type="button" onClick={() => setShowProcForm(false)} className="btn-secondary text-xs">Annuler</button>
          </div>
        </form>
      )}

      {initial.length === 0 ? (
        <p className="text-sm text-gray-500">
          Aucune procédure. Ajoutez la première instance pour démarrer le parcours du dossier.
        </p>
      ) : (
        <ol className="relative space-y-6 border-l-2 border-cabinet-200 pl-5">
          {initial.map((p, idx) => (
            <li key={p.id} className="relative">
              <span className="absolute -left-[27px] top-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-cabinet-500 bg-white text-[10px] font-bold text-cabinet-700" />
              <div className="space-y-3 rounded-md border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-cabinet-100 px-2 py-0.5 text-xs font-semibold text-cabinet-800">
                      {idx + 1}. {NIVEAU_LABELS[p.niveau] || p.niveau}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${PROCEDURE_STATUT_BADGES[p.statut] || "bg-gray-100 text-gray-700"}`}>
                      {PROCEDURE_STATUT_LABELS[p.statut] || p.statut}
                    </span>
                    {!p.publieClient && (
                      <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs text-gray-600">Interne</span>
                    )}
                  </div>
                  {canEdit && (
                    <select
                      className="rounded-md border border-gray-300 px-2 py-1 text-xs"
                      value=""
                      onChange={async (e) => {
                        if (!e.target.value) return;
                        await call(`/api/procedures/${p.id}`, "PATCH", { statut: e.target.value });
                      }}
                    >
                      <option value="">Changer l'état…</option>
                      {(PROCEDURE_TRANSITIONS[p.statut] || []).map((s) => (
                        <option key={s} value={s}>{PROCEDURE_STATUT_LABELS[s] || s}</option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <p className="font-medium text-gray-900">{p.juridiction}</p>
                  <p className="text-xs text-gray-500">
                    {[p.chambre, p.greffe && `Greffe : ${p.greffe}`, p.referenceRg && `RG ${p.referenceRg}`]
                      .filter(Boolean)
                      .join(" · ") || " "}
                  </p>
                </div>

                <dl className="grid gap-2 text-sm sm:grid-cols-3">
                  <div>
                    <dt className="text-xs text-gray-500">Saisine</dt>
                    <dd>{fmt(p.dateSaisine)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-500">Prononcé</dt>
                    <dd>{fmt(p.datePrononce)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-500">Signification</dt>
                    <dd>{fmt(p.dateSignification)}</dd>
                  </div>
                </dl>

                {p.decision && (
                  <div className="rounded-md bg-gray-50 p-3 text-sm">
                    <p className="text-xs font-semibold uppercase text-gray-500">
                      {TYPE_DECISION_LABELS[p.typeDecision || ""] || "Décision"} — {SENS_DECISION_LABELS[p.sensDecision] || p.sensDecision}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-gray-800">{p.decision}</p>
                  </div>
                )}

                {canEdit && (
                  <div className="flex flex-wrap gap-4 text-sm">
                    <button onClick={() => (decisionFormFor === p.id ? setDecisionFormFor(null) : openDecisionForm(p))} className="text-cabinet-700 hover:underline">
                      {p.datePrononce ? "Modifier la décision" : "Saisir la décision"}
                    </button>
                    <button onClick={() => (recoursFormFor === p.id ? setRecoursFormFor(null) : openRecoursForm(p))} className="font-medium text-cabinet-700 hover:underline">
                      + Déclarer un recours
                    </button>
                  </div>
                )}

                {decisionFormFor === p.id && (
                  <form onSubmit={(e) => submitDecision(p, e)} className="space-y-3 rounded-md border border-amber-200 bg-amber-50/50 p-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className={label}>Type de décision</label>
                        <select className={input} value={decForm.typeDecision as string} onChange={(e) => setDecForm({ ...decForm, typeDecision: e.target.value })}>
                          {TYPES_DECISION.map((t) => (
                            <option key={t.code} value={t.code}>{t.label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className={label}>Sens</label>
                        <select className={input} value={decForm.sensDecision as string} onChange={(e) => setDecForm({ ...decForm, sensDecision: e.target.value })}>
                          {SENS_DECISION.map((s) => (
                            <option key={s.code} value={s.code}>{s.label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className={label}>Date de prononcé</label>
                        <input type="date" className={input} value={decForm.datePrononce as string} onChange={(e) => setDecForm({ ...decForm, datePrononce: e.target.value })} />
                      </div>
                      <div>
                        <label className={label}>Date de signification</label>
                        <input type="date" className={input} value={decForm.dateSignification as string} onChange={(e) => setDecForm({ ...decForm, dateSignification: e.target.value })} />
                      </div>
                    </div>
                    <div>
                      <label className={label}>Dispositif / résumé</label>
                      <textarea className={input} rows={3} value={decForm.decision as string} onChange={(e) => setDecForm({ ...decForm, decision: e.target.value })} />
                    </div>
                    <div className="flex gap-3">
                      <button type="submit" disabled={loading} className="btn-primary text-xs">Enregistrer</button>
                      <button type="button" onClick={() => setDecisionFormFor(null)} className="btn-secondary text-xs">Annuler</button>
                    </div>
                  </form>
                )}

                {recoursFormFor === p.id && (
                  <form onSubmit={(e) => submitRecours(p, e)} className="space-y-3 rounded-md border border-indigo-200 bg-indigo-50/50 p-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className={label}>Voie de recours</label>
                        <select
                          className={input}
                          value={recForm.typeRecours}
                          onChange={(e) => {
                            const type = e.target.value;
                            const delai = delaiRecoursJours(matiere, type);
                            setRecForm({
                              ...recForm,
                              typeRecours: type,
                              delaiJours: delai ? String(delai) : recForm.delaiJours,
                              juridictionCible:
                                type === "pourvoi" ? "Cour suprême" : type === "appel" ? "Cour d'appel" : recForm.juridictionCible,
                            });
                          }}
                        >
                          {TYPES_RECOURS.map((t) => (
                            <option key={t.code} value={t.code}>{t.label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className={label}>À l'initiative de</label>
                        <select className={input} value={recForm.origine} onChange={(e) => setRecForm({ ...recForm, origine: e.target.value })}>
                          {ORIGINES_RECOURS.map((o) => (
                            <option key={o.code} value={o.code}>{o.label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className={label}>Juridiction cible</label>
                        <input className={input} value={recForm.juridictionCible} onChange={(e) => setRecForm({ ...recForm, juridictionCible: e.target.value })} />
                      </div>
                      <div>
                        <label className={label}>Délai (jours)</label>
                        <input type="number" min={1} className={input} value={recForm.delaiJours} onChange={(e) => setRecForm({ ...recForm, delaiJours: e.target.value })} placeholder={matiere ? "Auto selon la matière" : "Renseigner la matière ou saisir"} />
                      </div>
                      <div>
                        <label className={label}>Avocat en charge</label>
                        <select className={input} value={recForm.avocatId} onChange={(e) => setRecForm({ ...recForm, avocatId: e.target.value })}>
                          <option value="">— Responsable du dossier —</option>
                          {users.map((u) => (
                            <option key={u.id} value={u.id}>{u.nom}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button type="submit" disabled={loading} className="btn-primary text-xs">Créer le recours</button>
                      <button type="button" onClick={() => setRecoursFormFor(null)} className="btn-secondary text-xs">Annuler</button>
                    </div>
                  </form>
                )}

                {/* Recours exercés contre la décision de cette procédure. */}
                {p.recoursExerces.length > 0 && (
                  <div className="space-y-3 border-t border-gray-100 pt-3">
                    {p.recoursExerces.map((r) => (
                      <div key={r.id} className="space-y-2 rounded-md border border-gray-200 bg-gray-50/60 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-gray-900">
                              {TYPE_RECOURS_LABELS[r.typeRecours] || r.typeRecours}
                            </span>
                            <span className="text-xs text-gray-500">
                              ({ORIGINE_LABELS[r.origine] || r.origine}
                              {r.juridictionCible ? ` → ${r.juridictionCible}` : ""})
                            </span>
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${RECOURS_STATUT_BADGES[r.statut] || "bg-gray-100 text-gray-700"}`}>
                              {RECOURS_STATUT_LABELS[r.statut] || r.statut}
                            </span>
                          </div>
                          <DeadlineBadge recours={r} />
                        </div>

                        <dl className="grid gap-2 text-xs text-gray-600 sm:grid-cols-4">
                          <div>Déclaration : {fmt(r.dateDeclaration)}</div>
                          <div>Signification : {fmt(r.dateSignification)}</div>
                          <div>Consignation : {fmt(r.dateConsignation)}</div>
                          <div>Mémoire : {fmt(r.dateMemoire)}</div>
                        </dl>
                        {r.issue && (
                          <p className="text-xs">
                            Issue : <span className="font-medium">{ISSUE_LABELS[r.issue] || r.issue}</span>
                          </p>
                        )}

                        {canEdit && (RECOURS_TRANSITIONS[r.statut] || []).length > 0 && (
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              onClick={() => (transitionFor === r.id ? setTransitionFor(null) : openTransition(r))}
                              className="text-xs font-medium text-cabinet-700 hover:underline"
                            >
                              Faire avancer…
                            </button>
                            {(RECOURS_TRANSITIONS[r.statut] || []).map((s) => (
                              <span key={s} className="rounded-full bg-white px-2 py-0.5 text-[11px] text-gray-500 shadow-sm">
                                {RECOURS_STATUT_LABELS[s]}
                              </span>
                            ))}
                          </div>
                        )}

                        {transitionFor === r.id && (
                          <form onSubmit={(e) => submitTransition(r, e)} className="space-y-3 rounded-md border border-cabinet-200 bg-white p-3">
                            <div className="grid gap-3 sm:grid-cols-2">
                              <div>
                                <label className={label}>Nouvel état *</label>
                                <select required className={input} value={transForm.statut} onChange={(e) => setTransForm({ ...transForm, statut: e.target.value })}>
                                  <option value="">— Choisir —</option>
                                  {(RECOURS_TRANSITIONS[r.statut] || []).map((s) => (
                                    <option key={s} value={s}>{RECOURS_STATUT_LABELS[s]}</option>
                                  ))}
                                </select>
                              </div>
                              {TRANSITION_DATE_FIELDS[transForm.statut] && (
                                <div>
                                  <label className={label}>
                                    {TRANSITION_DATE_FIELDS[transForm.statut] === "dateDeclaration" && "Date de déclaration / dépôt *"}
                                    {TRANSITION_DATE_FIELDS[transForm.statut] === "dateSignification" && "Date de signification *"}
                                    {TRANSITION_DATE_FIELDS[transForm.statut] === "dateConsignation" && "Date de consignation *"}
                                    {TRANSITION_DATE_FIELDS[transForm.statut] === "dateMemoire" && "Date de dépôt du mémoire *"}
                                  </label>
                                  <input
                                    type="date"
                                    required
                                    className={input}
                                    value={transForm[TRANSITION_DATE_FIELDS[transForm.statut]] || ""}
                                    onChange={(e) => setTransForm({ ...transForm, [TRANSITION_DATE_FIELDS[transForm.statut]]: e.target.value })}
                                  />
                                </div>
                              )}
                              {transForm.statut === "JUGE" && (
                                <div>
                                  <label className={label}>Issue *</label>
                                  <select required className={input} value={transForm.issue} onChange={(e) => setTransForm({ ...transForm, issue: e.target.value })}>
                                    <option value="">— Choisir —</option>
                                    {ISSUES_RECOURS.map((i) => (
                                      <option key={i.code} value={i.code}>{i.label}</option>
                                    ))}
                                  </select>
                                </div>
                              )}
                              {transForm.statut === "ENREGISTRE" && (
                                <div>
                                  <label className={label}>Juridiction d'enregistrement</label>
                                  <input className={input} value={transForm.juridictionCible} onChange={(e) => setTransForm({ ...transForm, juridictionCible: e.target.value })} />
                                </div>
                              )}
                            </div>
                            <div>
                              <label className={label}>Note</label>
                              <input className={input} value={transForm.note} onChange={(e) => setTransForm({ ...transForm, note: e.target.value })} />
                            </div>
                            <div className="flex gap-3">
                              <button type="submit" disabled={loading} className="btn-primary text-xs">Valider</button>
                              <button type="button" onClick={() => setTransitionFor(null)} className="btn-secondary text-xs">Annuler</button>
                            </div>
                          </form>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
