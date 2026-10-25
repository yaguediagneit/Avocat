"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { encryptDocumentForUpload } from "@/lib/crypto-client";
import { formatFileSize } from "@/lib/format";
import { ParametreSelect } from "@/components/parametre-select";

interface DossierOption {
  id: string;
  referenceInterne: string;
  client?: { raisonSociale: string } | null;
}

interface DocumentFormProps {
  dossiers: DossierOption[];
  defaultDossierId?: string;
  /// Type de document attendu (spécialité) — mémorisé dans metadata.typeDocument.
  defaultTypeDocument?: string;
  defaultCategorie?: string;
  defaultNom?: string;
}

function toBase64(buffer: Uint8Array): string {
  return Buffer.from(buffer).toString("base64");
}

export function DocumentForm({ dossiers, defaultDossierId, defaultTypeDocument, defaultCategorie, defaultNom }: DocumentFormProps) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [dossierQuery, setDossierQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState("");

  const [form, setForm] = useState({
    dossierId: defaultDossierId || "",
    categorie: defaultCategorie || "correspondance",
    nom: defaultNom || "",
    publieClient: true,
    partageExterne: false,
  });

  const filteredDossiers = useMemo(() => {
    const q = dossierQuery.trim().toLowerCase();
    if (!q) return dossiers;
    return dossiers.filter((d) =>
      d.referenceInterne.toLowerCase().includes(q) ||
      d.client?.raisonSociale?.toLowerCase().includes(q)
    );
  }, [dossiers, dossierQuery]);

  const lockedDossier = useMemo(
    () => dossiers.find((d) => d.id === defaultDossierId) || null,
    [dossiers, defaultDossierId]
  );

  const selectedFile = fileRef.current?.files?.[0];

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setGeneralError("");

    const file = fileRef.current?.files?.[0];
    if (!file) {
      setErrors({ file: "Veuillez sélectionner un fichier" });
      return;
    }
    if (!form.dossierId) {
      setErrors({ dossierId: "Veuillez sélectionner un dossier" });
      return;
    }

    setLoading(true);
    try {
      const keyRes = await fetch("/api/keys");
      if (!keyRes.ok) throw new Error("Impossible de récupérer la clé publique");
      const keyData = await keyRes.json();

      const { encryptedFile, encryptedDek, iv } = await encryptDocumentForUpload(
        file,
        JSON.parse(keyData.publicKey)
      );

      const formData = new FormData();
      formData.append("file", new Blob([encryptedFile]), file.name);
      formData.append("dossierId", form.dossierId);
      formData.append("categorie", form.categorie);
      formData.append("nom", form.nom.trim() || file.name);
      formData.append("publieClient", String(form.publieClient));
      formData.append("partageExterne", String(form.partageExterne));
      if (defaultTypeDocument) {
        formData.append("typeDocument", defaultTypeDocument);
      }
      formData.append("encryptedDek", new Blob([encryptedDek]), "dek.bin");
      formData.append("iv", toBase64(iv));

      const res = await fetch("/api/documents", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        router.push("/cabinet/documents");
      } else {
        const data = await res.json().catch(() => ({}));
        setGeneralError(data.error || "Erreur lors de l'upload");
      }
    } catch (err) {
      console.error(err);
      setGeneralError("Erreur de chiffrement ou d'upload");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="card space-y-5">
      {generalError && (
        <div className="rounded-md bg-red-100 p-3 text-sm text-red-700">{generalError}</div>
      )}

      <div>
        <label className="mb-1 block text-sm font-medium">Dossier</label>
        {lockedDossier ? (
          <div className="input flex items-center justify-between bg-gray-50 text-gray-700">
            <span>
              {lockedDossier.referenceInterne}
              {lockedDossier.client?.raisonSociale ? ` — ${lockedDossier.client.raisonSociale}` : ""}
            </span>
            <span className="text-xs text-gray-400">Verrouillé</span>
          </div>
        ) : (
          <>
            <input
              type="text"
              value={dossierQuery}
              onChange={(e) => {
                setDossierQuery(e.target.value);
                setForm((f) => ({ ...f, dossierId: "" }));
              }}
              className="input mb-2"
              placeholder="Rechercher un dossier..."
            />
            <select
              value={form.dossierId}
              onChange={(e) => setForm({ ...form, dossierId: e.target.value })}
              className="input"
              required
              size={Math.min(5, filteredDossiers.length + 1)}
            >
              <option value="">Sélectionner un dossier</option>
              {filteredDossiers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.referenceInterne} {d.client?.raisonSociale ? `— ${d.client.raisonSociale}` : ""}
                </option>
              ))}
            </select>
            {filteredDossiers.length === 0 && dossierQuery && (
              <p className="mt-1 text-xs text-cabinet-600">
                Aucun dossier trouvé.{" "}
                <Link href="/cabinet/dossiers/nouveau" className="underline">
                  Ouvrir un dossier
                </Link>
              </p>
            )}
          </>
        )}
        {errors.dossierId && <p className="mt-1 text-xs text-red-600">{errors.dossierId}</p>}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Catégorie</label>
        <ParametreSelect
          categorie="categorie_document"
          value={form.categorie}
          onChange={(value) => setForm({ ...form, categorie: value })}
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Nom personnalisé (optionnel)</label>
        <input
          type="text"
          value={form.nom}
          onChange={(e) => setForm({ ...form, nom: e.target.value })}
          className="input"
          placeholder="Ne rien saisir, conserver le nom du fichier"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Fichier</label>
        <input
          ref={fileRef}
          type="file"
          className="input"
          required
          onChange={() => setErrors((e) => ({ ...e, file: "" }))}
        />
        {selectedFile && (
          <p className="mt-1 text-xs text-gray-500">
            {selectedFile.name} — {formatFileSize(selectedFile.size)}
          </p>
        )}
        {errors.file && <p className="mt-1 text-xs text-red-600">{errors.file}</p>}
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={form.publieClient}
          onChange={(e) => setForm({ ...form, publieClient: e.target.checked })}
          id="publieClient"
          className="h-4 w-4 rounded border-gray-300"
        />
        <label htmlFor="publieClient" className="text-sm">
          Publier dans l&apos;espace client
        </label>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={form.partageExterne}
          onChange={(e) => setForm({ ...form, partageExterne: e.target.checked })}
          id="partageExterne"
          className="h-4 w-4 rounded border-gray-300"
        />
        <label htmlFor="partageExterne" className="text-sm">
          Partager avec le huissier et les collaborateurs externes du dossier
        </label>
      </div>

      <div className="flex items-center justify-end gap-3 pt-4">
        <button
          type="button"
          onClick={() => router.push("/cabinet/documents")}
          className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
        >
          Annuler
        </button>
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? "Chiffrement et upload..." : "Téléverser"}
        </button>
      </div>
    </form>
  );
}
