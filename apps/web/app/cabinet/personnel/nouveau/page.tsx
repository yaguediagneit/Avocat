"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface UserOption {
  id: string;
  prenom: string;
  nom: string;
  email: string;
}

export default function NewEmployeePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [users, setUsers] = useState<UserOption[]>([]);
  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    fetch("/api/personnel/employees/available-users")
      .then((r) => r.json())
      .then((data: UserOption[]) => setUsers(data))
      .catch(() => setError("Impossible de charger les utilisateurs"));
  }, []);

  function selectUser(userId: string) {
    if (!userId) {
      setForm({
        ...form,
        firstName: "",
        lastName: "",
        email: "",
      });
      return;
    }
    const user = users.find((u) => u.id === userId);
    if (user) {
      setForm({
        ...form,
        firstName: user.prenom,
        lastName: user.nom,
        email: user.email,
      });
    }
  }

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    position: "",
    department: "",
    regime: "general",
    hireDate: today,
    contractType: "CDI",
    baseSalary: "",
    cnssNumber: "",
    ipresNumber: "",
    bankAccount: "",
    email: "",
    phone: "",
    maritalStatus: "single",
    nbChildren: "0",
  });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/personnel/employees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        baseSalary: Number(form.baseSalary),
        nbChildren: Number(form.nbChildren),
      }),
    });

    setLoading(false);
    if (res.ok) {
      router.push("/cabinet/personnel");
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error?.formErrors?.[0] || data.error || "Erreur lors de la création");
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Nouvel employé</h1>
        <Link href="/cabinet/personnel" className="text-sm text-cabinet-700 hover:underline">
          ← Retour
        </Link>
      </div>

      <form onSubmit={onSubmit} className="card space-y-5">
        {error && <div className="rounded-md bg-red-100 p-3 text-sm text-red-700">{error}</div>}

        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium">Utilisateur existant</label>
            <select
              className="input w-full"
              onChange={(e) => selectUser(e.target.value)}
              defaultValue=""
            >
              <option value="">— Créer un employé sans utilisateur —</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.prenom} {u.nom} ({u.email})
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">Champ optionnel, sert uniquement à pré-remplir le formulaire.</p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Date d&apos;embauche</label>
            <input type="date" className="input" value={form.hireDate} onChange={(e) => setForm({ ...form, hireDate: e.target.value })} required />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Prénom</label>
            <input className="input" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Nom</label>
            <input className="input" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Poste</label>
            <input className="input" value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Service</label>
            <input className="input" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Régime</label>
            <select className="input" value={form.regime} onChange={(e) => setForm({ ...form, regime: e.target.value })}>
              <option value="general">Régime général</option>
              <option value="cadre">Cadre</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Contrat</label>
            <select className="input" value={form.contractType} onChange={(e) => setForm({ ...form, contractType: e.target.value })}>
              <option value="CDI">CDI</option>
              <option value="CDD">CDD</option>
              <option value="Stage">Stage</option>
              <option value="Prestation">Prestation</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Salaire de base</label>
            <input type="number" min="0" step="1" className="input" value={form.baseSalary} onChange={(e) => setForm({ ...form, baseSalary: e.target.value })} required />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Situation familiale</label>
            <select className="input" value={form.maritalStatus} onChange={(e) => setForm({ ...form, maritalStatus: e.target.value })}>
              <option value="single">Célibataire</option>
              <option value="married">Marié(e)</option>
              <option value="divorced">Divorcé(e)</option>
              <option value="widowed">Veuf/Veuve</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Nombre d&apos;enfants</label>
            <input type="number" min="0" className="input" value={form.nbChildren} onChange={(e) => setForm({ ...form, nbChildren: e.target.value })} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">N° CNSS</label>
            <input className="input" value={form.cnssNumber} onChange={(e) => setForm({ ...form, cnssNumber: e.target.value })} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">N° IPRES</label>
            <input className="input" value={form.ipresNumber} onChange={(e) => setForm({ ...form, ipresNumber: e.target.value })} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Email</label>
            <input type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Téléphone</label>
            <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium">Compte bancaire</label>
            <input className="input" value={form.bankAccount} onChange={(e) => setForm({ ...form, bankAccount: e.target.value })} />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Link href="/cabinet/personnel" className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100">
            Annuler
          </Link>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? "Enregistrement..." : "Enregistrer"}
          </button>
        </div>
      </form>
    </div>
  );
}
