"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ProvisionForm({ clients }: { clients: { id: string; label: string }[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/provisions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: fd.get("clientId"),
        montant: Number(fd.get("montant")),
        mode: fd.get("mode"),
        reference: fd.get("reference") || undefined,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error?.formErrors?.[0] ?? body?.error ?? "Erreur");
      return;
    }
    (e.target as HTMLFormElement).reset();
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="card grid grid-cols-2 gap-3 text-sm">
      <select name="clientId" required className="input">
        <option value="">— Client —</option>
        {clients.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
      </select>
      <input name="montant" type="number" min="1" required placeholder="Montant (F)" className="input" />
      <select name="mode" required className="input" defaultValue="virement">
        <option value="virement">Virement</option>
        <option value="especes">Espèces (caisse)</option>
        <option value="cheque">Chèque</option>
        <option value="carte">Carte</option>
        <option value="autre">Autre</option>
      </select>
      <input name="reference" placeholder="Référence (optionnel)" className="input" />
      <div className="col-span-2 flex items-center gap-3">
        <button type="submit" disabled={busy} className="btn-primary">{busy ? "…" : "Encaisser la provision"}</button>
        {error && <span className="text-red-600 text-xs">{error}</span>}
      </div>
    </form>
  );
}
