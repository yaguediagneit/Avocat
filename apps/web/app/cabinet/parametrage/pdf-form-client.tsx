"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  extractTemplateVariables,
  firstJsonText,
  renderDocumentTemplate,
  suggestVariableValues,
  type TemplateFillContext,
} from "@/lib/document-template";

interface TemplateInfo {
  id: string;
  titre: string;
  description?: string | null;
  contenuDocument?: string | null;
  specialite?: { libelle: string } | null;
  workflowEtape?: { libelle: string } | null;
  delaiJours: number;
  roleAttendu: string;
  priorite: string;
}

interface DossierOption {
  id: string;
  referenceInterne: string;
  client: string;
  typeAffaire: string;
}

interface TacheOption {
  id: string;
  dossierId: string;
  titre: string;
  description?: string | null;
}

interface MissionOption {
  id: string;
  dossierId: string;
  typeActe: string;
}

interface PdfFormClientProps {
  template: TemplateInfo;
  dossiers: DossierOption[];
  taches: TacheOption[];
  missions: MissionOption[];
  defaultDossierId?: string;
  defaultTacheId?: string;
  defaultReference?: string;
  defaultRecipient?: string;
  defaultSubject?: string;
  defaultBody?: string | null;
  cabinet?: TemplateFillContext["cabinet"];
  user?: TemplateFillContext["user"];
}

export function PdfFormClient({
  template,
  dossiers,
  taches,
  missions,
  defaultDossierId,
  defaultTacheId,
  defaultReference,
  defaultRecipient,
  defaultSubject,
  defaultBody,
  cabinet,
  user,
}: PdfFormClientProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

  const [form, setForm] = useState({
    title: template.titre,
    reference: defaultReference || "",
    date: new Date().toLocaleDateString("fr-FR"),
    recipient: defaultRecipient || "",
    subject: defaultSubject || template.specialite?.libelle || "",
    body: defaultBody ? defaultBody : template.description || "",
    signature: [
      [user?.prenom, user?.nom].filter(Boolean).join(" "),
      user?.titre || "",
      cabinet?.raisonSociale || "",
    ]
      .filter(Boolean)
      .join("\n"),
    dossierId: defaultDossierId || "",
    tacheId: defaultTacheId || "",
    missionId: "",
    publieClient: false,
  });

  // Modèle structuré : le texte fixe du document est verrouillé, seules les
  // variables {{cle}} détectées sont éditables via des champs dédiés.
  const templateVariables = useMemo(
    () => extractTemplateVariables(template.contenuDocument),
    [template.contenuDocument]
  );
  const hasContenuDocument = !!template.contenuDocument?.trim();
  const [variables, setVariables] = useState<Record<string, string>>(() =>
    suggestVariableValues(templateVariables, { cabinet, user })
  );
  // Les champs structurés alimentent aussi les variables canoniques du modèle
  // ([Référence], [Date], [Destinataire], [Objet], [Signature]) lorsqu'il les
  // contient, sans écraser une saisie directe.
  const mergedVariables = useMemo(() => {
    const canoniques: Record<string, string> = {
      reference: form.reference,
      date: form.date,
      destinataire: form.recipient,
      objet: form.subject,
      signature: form.signature,
    };
    const merged = { ...variables };
    for (const [cle, valeur] of Object.entries(canoniques)) {
      if (valeur?.trim() && !merged[cle]?.trim()) merged[cle] = valeur;
    }
    return merged;
  }, [variables, form.reference, form.date, form.recipient, form.subject, form.signature]);
  const renderedBody = useMemo(
    () =>
      hasContenuDocument
        ? renderDocumentTemplate(template.contenuDocument as string, mergedVariables)
        : form.body,
    [hasContenuDocument, template.contenuDocument, mergedVariables, form.body]
  );

  function update(field: string, value: string | boolean) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  const availableTaches = useMemo(
    () => (form.dossierId ? taches.filter((t) => t.dossierId === form.dossierId) : []),
    [form.dossierId, taches]
  );

  const availableMissions = useMemo(
    () => (form.dossierId ? missions.filter((m) => m.dossierId === form.dossierId) : []),
    [form.dossierId, missions]
  );

  // Pré-remplit les champs reconnus à partir des infos du dossier sélectionné
  // (référence, client, parties adverses…). Les champs déjà saisis ne sont
  // pas écrasés.
  useEffect(() => {
    if (!hasContenuDocument || !form.dossierId) return;
    let cancelled = false;
    fetch(`/api/dossiers/${form.dossierId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((dossier) => {
        if (!dossier || cancelled) return;
        const suggestions = suggestVariableValues(templateVariables, {
          cabinet,
          user,
          dossier: {
            referenceInterne: dossier.referenceInterne,
            typeAffaire: dossier.typeAffaire,
            partiesAdverses: dossier.partiesAdverses,
          },
          client: dossier.client,
        });
        setVariables((prev) => {
          const next = { ...prev };
          for (const [cle, valeur] of Object.entries(suggestions)) {
            if (!next[cle]?.trim()) next[cle] = valeur;
          }
          return next;
        });
        // Destinataire : première partie adverse du dossier si le champ est vide.
        const adverse = firstJsonText(dossier.partiesAdverses);
        if (adverse) {
          setForm((prev) =>
            prev.recipient.trim() ? prev : { ...prev, recipient: adverse }
          );
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.dossierId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.dossierId) {
      setError("Veuillez sélectionner un dossier.");
      return;
    }
    setLoading(true);
    setError("");
    setSuccess(false);

    try {
      const res = await fetch(`/api/tache-templates/${template.id}/pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, body: renderedBody, variables: mergedVariables }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Erreur lors de la génération du PDF");
        return;
      }

      // Le PDF est sauvegardé et retourné en inline
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);
      setDocumentId(res.headers.get("X-Document-Id"));
      setSuccess(true);
      setError("");

      window.open(url, "_blank");
    } catch (err) {
      console.error(err);
      setError("Erreur réseau.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Générer un document PDF</h1>
          <p className="text-sm text-gray-600">
            Modèle : <span className="font-medium">{template.titre}</span>
            {template.specialite && ` — ${template.specialite.libelle}`}
          </p>
        </div>
        <Link
          href="/cabinet/parametrage"
          className="text-sm text-cabinet-700 hover:underline"
        >
          ← Retour au paramétrage
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-4">
        {error && (
          <div className="rounded-md bg-red-100 p-3 text-sm text-red-700">{error}</div>
        )}
        {success && (
          <div className="rounded-md bg-emerald-100 p-3 text-sm text-emerald-700">
            <p>Document PDF généré et enregistré dans les documents du dossier.</p>
            {documentId && (
              <div className="mt-2 flex flex-wrap items-center gap-3">
                {pdfUrl && (
                  <a
                    href={pdfUrl}
                    download={`${form.title}.pdf`}
                    className="font-medium text-cabinet-800 underline"
                  >
                    Télécharger le PDF
                  </a>
                )}
                <Link
                    href={`/cabinet/documents/${documentId}`}
                    className="font-medium text-cabinet-800 underline"
                  >
                    Voir le document
                  </Link>
                  <Link
                    href={`/cabinet/dossiers/${form.dossierId}`}
                    className="font-medium text-cabinet-800 underline"
                  >
                    Retour au dossier
                  </Link>
              </div>
            )}
          </div>
        )}

        {/* Section : Dossier de rattachement */}
        <div className="rounded-lg border border-cabinet-200 bg-cabinet-50/30 p-4">
          <h3 className="mb-3 text-sm font-semibold text-cabinet-900">Dossier de rattachement</h3>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium">
                Dossier <span className="text-red-600">*</span>
              </label>
              <select
                value={form.dossierId}
                onChange={(e) => update("dossierId", e.target.value)}
                className="input"
                required
                disabled={!!defaultDossierId}
              >
                <option value="">Sélectionner un dossier</option>
                {dossiers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.referenceInterne} — {d.client}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Tâche associée (optionnel)</label>
              <select
                value={form.tacheId}
                onChange={(e) => update("tacheId", e.target.value)}
                className="input"
                disabled={!form.dossierId || !!defaultTacheId}
              >
                <option value="">Aucune tâche</option>
                {availableTaches.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.titre}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Mission associée (optionnel)</label>
              <select
                value={form.missionId}
                onChange={(e) => update("missionId", e.target.value)}
                className="input"
                disabled={!form.dossierId}
              >
                <option value="">Aucune mission</option>
                {availableMissions.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.typeActe}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2 flex items-center gap-2">
              <input
                type="checkbox"
                id="publie-client"
                checked={form.publieClient}
                onChange={(e) => update("publieClient", e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-cabinet-700 focus:ring-cabinet-500"
              />
              <label htmlFor="publie-client" className="text-sm font-medium">
                Publier dans l&apos;espace client
              </label>
            </div>
          </div>
        </div>

        {/* Section : Contenu du document */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium">Titre du document</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => update("title", e.target.value)}
              className="input"
              required
            />
          </div>

          {!hasContenuDocument && (
            <div>
              <label className="mb-1 block text-sm font-medium">Référence</label>
              <input
                type="text"
                value={form.reference}
                onChange={(e) => update("reference", e.target.value)}
                className="input"
                disabled={!!defaultReference}
                placeholder="Ex. 2026-001"
              />
            </div>
          )}

          {!hasContenuDocument && (
            <div>
              <label className="mb-1 block text-sm font-medium">Date</label>
              <input
                type="text"
                value={form.date}
                onChange={(e) => update("date", e.target.value)}
                className="input"
              />
            </div>
          )}

          {!hasContenuDocument && (
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium">Destinataire</label>
            <textarea
              value={form.recipient}
              onChange={(e) => update("recipient", e.target.value)}
              className="input"
              rows={3}
              disabled={!!defaultRecipient}
              placeholder={"Nom du destinataire / raison sociale\nFonction\nAdresse complète"}
            />
            <p className="mt-1 text-xs text-gray-500">
              Une ligne par information : nom, fonction, adresse.
            </p>
          </div>
          )}

          {!hasContenuDocument && (
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium">Objet</label>
            <input
              type="text"
              value={form.subject}
              onChange={(e) => update("subject", e.target.value)}
              className="input"
              disabled={!!defaultSubject}
            />
          </div>
          )}

          {hasContenuDocument && templateVariables.length > 0 && (
            <div className="md:col-span-2 rounded-lg border border-cabinet-200 bg-cabinet-50/30 p-4">
              <h3 className="mb-3 text-sm font-semibold text-cabinet-900">
                Champs du document
              </h3>
              <div className="grid gap-3 md:grid-cols-2">
                {templateVariables.map((v) => (
                  <div key={v.cle} className={v.multiline ? "md:col-span-2" : ""}>
                    <label className="mb-1 block text-xs font-medium text-gray-700">
                      {v.label}
                    </label>
                    {v.multiline ? (
                      <textarea
                        value={variables[v.cle] || ""}
                        onChange={(e) =>
                          setVariables((prev) => ({ ...prev, [v.cle]: e.target.value }))
                        }
                        className="input text-sm"
                        rows={3}
                        placeholder={v.label}
                      />
                    ) : (
                      <input
                        type="text"
                        value={variables[v.cle] || ""}
                        onChange={(e) =>
                          setVariables((prev) => ({ ...prev, [v.cle]: e.target.value }))
                        }
                        className="input"
                        placeholder={v.label}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium">Corps du document</label>
            <textarea
              value={hasContenuDocument ? renderedBody : form.body}
              onChange={(e) => update("body", e.target.value)}
              className={`input min-h-[200px] font-mono text-sm ${
                hasContenuDocument ? "bg-gray-50 text-gray-600" : ""
              }`}
              rows={10}
              disabled={hasContenuDocument || !!defaultBody}
              readOnly={hasContenuDocument}
              placeholder="Rédigez le contenu du document juridique..."
            />
            <p className="mt-1 text-xs text-gray-500">
              {hasContenuDocument
                ? "Aperçu : le texte du modèle est fixe, seuls les champs ci-dessus sont modifiables."
                : "Le contenu sera formaté avec le thème PDF défini dans Paramétrage > Cabinet."}
            </p>
          </div>

          {!hasContenuDocument && (
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium">Signature</label>
            <textarea
              value={form.signature}
              onChange={(e) => update("signature", e.target.value)}
              className="input"
              rows={3}
              placeholder={"Nom et prénom\nFonction\nCabinet / Société"}
            />
            <p className="mt-1 text-xs text-gray-500">
              Une ligne par information. L&apos;image de signature enregistrée sur votre
              profil est apposée automatiquement sous le bloc.
            </p>
          </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => router.push("/cabinet/parametrage")}
            className="btn-secondary"
          >
            Annuler
          </button>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? "Génération..." : "Générer et enregistrer le PDF"}
          </button>
        </div>
      </form>
    </div>
  );
}
