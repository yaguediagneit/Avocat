"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { encryptDocumentForUpload } from "@/lib/crypto-client";
import { formatFileSize } from "@/lib/format";

interface DossierOption {
  id: string;
  referenceInterne: string;
}

interface ClientDocumentUploadProps {
  dossiers: DossierOption[];
  defaultDossierId?: string;
}

const CATEGORIES: { value: string; label: string }[] = [
  { value: "correspondance", label: "Correspondance" },
  { value: "contrat", label: "Contrat" },
  { value: "pv", label: "Procès-verbal" },
  { value: "facture", label: "Facture" },
  { value: "titre_foncier", label: "Titre foncier" },
  { value: "assignation", label: "Assignation" },
  { value: "autre", label: "Autre" },
];

function toBase64(buffer: Uint8Array): string {
  return Buffer.from(buffer).toString("base64");
}

export function ClientDocumentUpload({ dossiers, defaultDossierId }: ClientDocumentUploadProps) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [form, setForm] = useState({
    dossierId: defaultDossierId || (dossiers.length === 1 ? dossiers[0].id : ""),
    categorie: "autre",
    nom: "",
    description: "",
  });

  const lockDossier = Boolean(defaultDossierId);

  function reset() {
    setForm((f) => ({ ...f, categorie: "autre", nom: "", description: "" }));
    setSelectedFile(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("Veuillez sélectionner un fichier.");
      return;
    }
    if (!form.dossierId) {
      setError("Veuillez sélectionner un dossier.");
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
      formData.append("description", form.description.trim());
      formData.append("encryptedDek", new Blob([encryptedDek]), "dek.bin");
      formData.append("iv", toBase64(iv));

      const res = await fetch("/api/client/documents", { method: "POST", body: formData });

      if (res.ok) {
        setSuccess("Document transmis au cabinet.");
        reset();
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(typeof data.error === "string" ? data.error : "Erreur lors de l'envoi");
      }
    } catch (err) {
      console.error(err);
      setError("Erreur de chiffrement ou d'envoi");
    } finally {
      setLoading(false);
    }
  }

  if (dossiers.length === 0) return null;

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold">Transmettre un document</h2>
          <p className="text-xs text-gray-500">
            Vos fichiers sont chiffrés dans votre navigateur avant l&apos;envoi au cabinet.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setOpen((o) => !o);
            setError("");
            setSuccess("");
          }}
          className={open ? "rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100" : "btn-primary"}
        >
          {open ? "Fermer" : "+ Ajouter un document"}
        </button>
      </div>

      {success && !open && (
        <div className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">{success}</div>
      )}

      {open && (
        <form onSubmit={onSubmit} className="space-y-4 border-t border-cabinet-100 pt-4">
          {error && <div className="rounded-md bg-red-100 p-3 text-sm text-red-700">{error}</div>}
          {success && <div className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">{success}</div>}

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Dossier</label>
              <select
                value={form.dossierId}
                onChange={(e) => setForm({ ...form, dossierId: e.target.value })}
                className="input w-full"
                required
                disabled={lockDossier}
              >
                <option value="">Sélectionner un dossier</option>
                {dossiers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.referenceInterne}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Catégorie</label>
              <select
                value={form.categorie}
                onChange={(e) => setForm({ ...form, categorie: e.target.value })}
                className="input w-full"
                required
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Nom du document (optionnel)</label>
            <input
              type="text"
              value={form.nom}
              onChange={(e) => setForm({ ...form, nom: e.target.value })}
              className="input w-full"
              placeholder={selectedFile?.name || "Conserver le nom du fichier"}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Message au cabinet (optionnel)</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="input w-full"
              rows={2}
              placeholder="Précisez le contexte de ce document..."
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Fichier</label>
            <input
              ref={fileRef}
              type="file"
              className="input w-full"
              required
              onChange={(e) => {
                setSelectedFile(e.target.files?.[0] || null);
                setError("");
              }}
            />
            {selectedFile && (
              <p className="mt-1 text-xs text-gray-500">
                {selectedFile.name} — {formatFileSize(selectedFile.size)}
              </p>
            )}
            <p className="mt-1 text-xs text-gray-400">Taille maximale : 25 Mo.</p>
          </div>

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                reset();
                setOpen(false);
              }}
              className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
            >
              Annuler
            </button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? "Chiffrement et envoi..." : "Envoyer au cabinet"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
