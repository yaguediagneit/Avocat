"use client";

import { Fragment, useMemo, useRef, useState } from "react";
import { PaginatedRows } from "@/components/pagination";
import { useTableSort } from "@/components/table-sort";

type EmployeeTotal = { id: string; nom: string; count: number; total: number; partEmploye: number; paye: number; partCabinet: number };

type Insurer = {
  id: string;
  nom: string;
  adresse: string | null;
  telephone: string | null;
  telephoneSecondaire: string | null;
  email: string | null;
  siteWeb: string | null;
  referenceInterne: string | null;
  statut: string;
  observations: string | null;
  managerNom: string | null;
  managerFonction: string | null;
  managerTelephone: string | null;
  managerEmail: string | null;
  createdAt: string;
  updatedAt: string;
};

type Contract = {
  id: string;
  insurerId: string;
  reference: string;
  dateDebut: string;
  dateFin: string;
  typeCouverture: string;
  devise: string;
  tauxGeneral: number;
  montantAvance: number;
  datePaiementAvance: string | null;
  modePaiementAvance: string | null;
  referencePaiementAvance: string | null;
  statut: string;
  conditions: string | null;
  documentPath: string | null;
  factureAssureurPath: string | null;
  chequePath: string | null;
  createdAt: string;
  updatedAt: string;
  insurer: { id: string; nom: string };
  payments: {
    id: string;
    typePaiement: string;
    statut: string;
    montant: number;
    datePaiement: string | null;
    paidBy: string | null;
    paidAt: string | null;
  }[];
};

type Employee = {
  id: string;
  employeeId: string;
  contractId: string;
  numeroAdherent: string | null;
  dateAdhesion: string;
  dateFinCouverture: string | null;
  formule: string | null;
  tauxParticulier: number | null;
  plafondIndividuel: number | null;
  statut: string;
  createdAt: string;
  updatedAt: string;
  employee: { id: string; firstName: string; lastName: string };
  contract: { id: string; reference: string; tauxGeneral: number; insurer: { id: string; nom: string } };
};

type Dependent = {
  id: string;
  employeeId: string;
  insuredEmployeeId: string | null;
  nom: string;
  prenom: string;
  sexe: string | null;
  dateNaissance: string | null;
  lienFamilial: string;
  numeroAdherent: string | null;
  dateDebutCouverture: string | null;
  dateFinCouverture: string | null;
  tauxParticulier: number | null;
  plafondParticulier: number | null;
  statut: string;
  justificatifPath: string | null;
  observations: string | null;
  createdAt: string;
  updatedAt: string;
  employee: { id: string; firstName: string; lastName: string };
  insuredEmployee: { id: string } | null;
};

type Provider = {
  id: string;
  nom: string;
  adresse: string | null;
  telephone: string | null;
  email: string | null;
  typePrestataire: string | null;
  statut: string;
  createdAt: string;
  updatedAt: string;
};

type Invoices = {
  id: string;
  referenceInterne: string;
  numeroFacture: string | null;
  insuredEmployeeId: string;
  dependentId: string | null;
  contractId: string;
  providerId: string;
  dateSoins: string;
  dateFacture: string;
  typeSoin: string;
  montantTotal: number;
  tauxApplique: number;
  partCabinet: number;
  partEmploye: number;
  montantPayeEmploye: number;
  resteAPayerEmploye: number;
  statut: string;
  statutPaiementEmploye: string;
  commentaire: string | null;
  justificatifPath: string | null;
  factureAssureurPath: string | null;
  chequePath: string | null;
  insuredEmployee: { employee: { id: string; firstName: string; lastName: string } };
  dependent: { id: string; prenom: string; nom: string } | null;
  provider: { id: string; nom: string };
  contract: { id: string; reference: string; insurer: { id: string; nom: string } };
};

type InitialData = {
  insurers: Insurer[];
  contracts: Contract[];
  employees: Employee[];
  dependents: Dependent[];
  providers: Provider[];
  invoices: Invoices[];
  totals: { totalFactures: number; totalPartEmploye: number; totalPayeEmploye: number; totalPartCabinet: number };
  totalsByEmployee: EmployeeTotal[];
  totalAvances: number;
  soldeAPayer: number;
};

function FileUploadField({
  label,
  value,
  onUploaded,
  accept = ".pdf,image/*",
  disabled = false,
}: {
  label: string;
  value: string;
  onUploaded: (key: string) => void;
  accept?: string;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/personnel/assurances/upload", { method: "POST", body: formData });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof json.error === "string" ? json.error : "Échec de l'upload");
      } else {
        onUploaded(json.key ?? "");
      }
    } catch {
      setError("Erreur réseau");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={onChange} disabled={disabled || uploading} />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled || uploading}
        className="input flex w-full items-center justify-between text-sm"
      >
        <span className="truncate">{value || label}</span>
        <span className="ml-2 shrink-0 text-cabinet-600">{uploading ? "..." : value ? "Modifier" : "Uploader"}</span>
      </button>
      {error && <span className="text-[10px] text-red-600">{error}</span>}
    </div>
  );
}

function ActionIcon({ name, className = "h-4 w-4" }: { name: string; className?: string }) {
  const props = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", className } as const;
  switch (name) {
    case "edit":
      return <svg {...props}><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /></svg>;

    case "validate":
      return <svg {...props}><path d="m9 12 2 2 4-4"/></svg>;
    case "upload":
      return <svg {...props}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>;
    case "power":
      return <svg {...props}><path d="M12 2v10" /><path d="M16.24 7.76a6 6 0 1 1-8.48 0" /></svg>;
    case "approve":
      return <svg {...props}><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>;
    case "pay":
      return <svg {...props}><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/></svg>;
    case "advance":
      return <svg {...props}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
    case "print":
      return <svg {...props}><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>;
    default:
      return null;
  }
}

const colorClass: Record<string, string> = {
  blue: "text-blue-600 hover:bg-blue-50",
  red: "text-red-600 hover:bg-red-50",
  emerald: "text-emerald-600 hover:bg-emerald-50",
  amber: "text-amber-600 hover:bg-amber-50",
  cabinet: "text-cabinet-700 hover:bg-cabinet-100",
};
function ActionButton({ onClick, title, icon, color = "blue", disabled = false, className = "" }: { onClick: () => void; title: string; icon: string; color?: string; disabled?: boolean; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={`rounded p-1.5 transition ${colorClass[color] || colorClass.blue} ${className}`}
    >
      <ActionIcon name={icon} />
    </button>
  );
}

export function AssurancesClient({
  canWrite,
  canApprove,
  canManage,
  canApproveAdvance,
  canPay,
  initialData,
  employeesList,
}: {
  canWrite: boolean;
  canApprove: boolean;
  canManage: boolean;
  canApproveAdvance: boolean;
  canPay: boolean;
  initialData: InitialData;
  employeesList: { id: string; firstName: string; lastName: string }[];
}) {
  const [data, setData] = useState(initialData);
  const [tab, setTab] = useState<"dashboard" | "assureurs" | "employes" | "prestataires" | "factures" | "totaux">("dashboard");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [activeForm, setActiveForm] = useState<string | null>(null);

  const [editId, setEditId] = useState<Record<string, string>>({ insurer: "", contract: "", insuredEmployee: "", dependent: "", provider: "", invoice: "" });

  const defaultInsurerForm = { nom: "", adresse: "", telephone: "", telephoneSecondaire: "", email: "", siteWeb: "", referenceInterne: "", statut: "actif", observations: "", managerNom: "", managerFonction: "", managerTelephone: "", managerEmail: "" };
  const defaultContractForm = { insurerId: "", reference: "", dateDebut: "", dateFin: "", typeCouverture: "familial", devise: "XOF", tauxGeneral: 80, montantAvance: 0, datePaiementAvance: "", modePaiementAvance: "virement", referencePaiementAvance: "", statut: "brouillon", conditions: "", factureAssureurPath: "", chequePath: "" };
  const defaultInsuredForm = { employeeId: "", contractId: "", numeroAdherent: "", dateAdhesion: "", dateFinCouverture: "", formule: "", tauxParticulier: "" as string | number, plafondIndividuel: "" as string | number, statut: "actif" };
  const defaultDependentForm = { employeeId: "", insuredEmployeeId: "", nom: "", prenom: "", sexe: "", dateNaissance: "", lienFamilial: "enfant", numeroAdherent: "", dateDebutCouverture: "", dateFinCouverture: "", tauxParticulier: "" as string | number, plafondParticulier: "" as string | number, observations: "" };
  const defaultProviderForm = { nom: "", adresse: "", telephone: "", email: "", typePrestataire: "" };
  const defaultInvoiceForm = { insuredEmployeeId: "", dependentId: "", contractId: "", providerId: "", numeroFacture: "", dateSoins: "", dateFacture: "", typeSoin: "", montantTotal: 0, tauxApplique: "" as string | number, commentaire: "", justificatifPath: "", factureAssureurPath: "", chequePath: "" };

  const [insurerForm, setInsurerForm] = useState(defaultInsurerForm);
  const [contractForm, setContractForm] = useState(defaultContractForm);
  const [insuredForm, setInsuredForm] = useState(defaultInsuredForm);
  const [dependentForm, setDependentForm] = useState(defaultDependentForm);
  const [providerForm, setProviderForm] = useState(defaultProviderForm);
  const [invoiceForm, setInvoiceForm] = useState(defaultInvoiceForm);
  const [advanceForm, setAdvanceForm] = useState({ contractId: "", montant: 0, datePaiement: "", modePaiement: "virement" });
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedInsurerId, setSelectedInsurerId] = useState("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const { th: sortTh, sorted: sortRows } = useTableSort();

  async function submit(action: string, payload: object) {
    if (!canWrite) return;
    setLoading(true);
    setMessage("");
    try {
      const id = editId[action];
      const body = id ? { action: `update_${action}`, ...payload, id } : { action, ...payload };
      const res = await fetch("/api/personnel/assurances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        let detail = json.error;
        if (typeof detail === "object" && detail !== null) {
          const fields = detail.fieldErrors ? Object.entries(detail.fieldErrors).map(([k, v]) => `${k}: ${(v as string[]).join(", ")}`).join("; ") : "";
          detail = fields || detail.formErrors?.join("; ") || JSON.stringify(detail);
        }
        if (!detail) detail = res.statusText;
        setMessage(`Erreur : ${detail}`);
      } else {
        setMessage(id ? "Modification effectuée." : "Enregistrement effectué.");
        cancel(action);
        await refresh();
      }
    } catch (e) {
      setMessage("Erreur réseau");
    } finally {
      setLoading(false);
    }
  }

  // Statut de désactivation par modèle (les enregistrements sont désactivés, jamais supprimés)
  const OFF_STATUT: Record<string, string> = {
    insurer: "inactif",
    contract: "inactif",
    insuredEmployee: "suspendu",
    dependent: "inactif",
    provider: "inactif",
    invoice: "annulee",
  };
  const ON_STATUT: Record<string, string> = {
    insurer: "actif",
    contract: "actif",
    insuredEmployee: "actif",
    dependent: "actif",
    provider: "actif",
    invoice: "brouillon",
  };

  async function toggleStatut(model: string, id: string, currentStatut: string) {
    if (!canWrite) return;
    const next = currentStatut === ON_STATUT[model] ? OFF_STATUT[model] : ON_STATUT[model];
    const label = next === ON_STATUT[model] ? "Réactiver" : model === "invoice" ? "Annuler" : "Désactiver";
    if (!window.confirm(`${label} cet enregistrement ?`)) return;
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/personnel/assurances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle_status", model, id, statut: next }),
      });
      const json = await res.json();
      if (!res.ok) {
        let detail = json.error;
        if (typeof detail === "object" && detail !== null) {
          const fields = detail.fieldErrors ? Object.entries(detail.fieldErrors).map(([k, v]) => `${k}: ${(v as string[]).join(", ")}`).join("; ") : "";
          detail = fields || detail.formErrors?.join("; ") || JSON.stringify(detail);
        }
        if (!detail) detail = res.statusText;
        setMessage(`Erreur : ${detail}`);
      } else {
        setMessage(next === ON_STATUT[model] ? "Réactivation effectuée." : model === "invoice" ? "Annulation effectuée." : "Désactivation effectuée.");
        await refresh();
      }
    } catch (e) {
      setMessage("Erreur réseau");
    } finally {
      setLoading(false);
    }
  }

  async function toggleInsurerStatus(id: string) {
    if (!canWrite) return;
    const r = data.insurers.find((x) => x.id === id);
    if (!r) return;
    const newStatut = r.statut === "inactif" ? "actif" : "inactif";
    if (!window.confirm(`Confirmer ${newStatut === "actif" ? "l'activation" : "la désactivation"} ?`)) return;
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/personnel/assurances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_insurer", id, nom: r.nom, statut: newStatut }),
      });
      const json = await res.json();
      if (!res.ok) {
        let detail = json.error;
        if (typeof detail === "object" && detail !== null) {
          const fields = detail.fieldErrors ? Object.entries(detail.fieldErrors).map(([k, v]) => `${k}: ${(v as string[]).join(", ")}`).join("; ") : "";
          detail = fields || detail.formErrors?.join("; ") || JSON.stringify(detail);
        }
        if (!detail) detail = res.statusText;
        setMessage(`Erreur : ${detail}`);
      } else {
        setMessage(newStatut === "actif" ? "Assureur activé." : "Assureur désactivé.");
        await refresh();
      }
    } catch (e) {
      setMessage("Erreur réseau");
    } finally {
      setLoading(false);
    }
  }

  async function validateInvoice(id: string) {
    if (!canManage) return;
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/personnel/assurances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve_invoice", id }),
      });
      const json = await res.json();
      if (!res.ok) {
        let detail = json.error;
        if (typeof detail === "object" && detail !== null) {
          const fields = detail.fieldErrors ? Object.entries(detail.fieldErrors).map(([k, v]) => `${k}: ${(v as string[]).join(", ")}`).join("; ") : "";
          detail = fields || detail.formErrors?.join("; ") || JSON.stringify(detail);
        }
        if (!detail) detail = res.statusText;
        setMessage(`Erreur : ${detail}`);
      } else {
        setMessage("Facture validée.");
        await refresh();
      }
    } catch (e) {
      setMessage("Erreur réseau");
    } finally {
      setLoading(false);
    }
  }

  async function payInvoice(id: string) {
    if (!canPay) return;
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/personnel/assurances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "pay_invoice", id }),
      });
      const json = await res.json();
      if (!res.ok) {
        let detail = json.error;
        if (typeof detail === "object" && detail !== null) {
          const fields = detail.fieldErrors ? Object.entries(detail.fieldErrors).map(([k, v]) => `${k}: ${(v as string[]).join(", ")}`).join("; ") : "";
          detail = fields || detail.formErrors?.join("; ") || JSON.stringify(detail);
        }
        if (!detail) detail = res.statusText;
        setMessage(`Erreur : ${detail}`);
      } else {
        setMessage("Facture payée.");
        await refresh();
      }
    } catch (e) {
      setMessage("Erreur réseau");
    } finally {
      setLoading(false);
    }
  }

  async function toggleContractStatus(id: string, current: string) {
    if (!canManage) return;
    setLoading(true);
    setMessage("");
    try {
      const newStatut = current === "inactif" ? "actif" : "inactif";
      const res = await fetch("/api/personnel/assurances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle_contract", id, statut: newStatut }),
      });
      const json = await res.json();
      if (!res.ok) {
        let detail = json.error;
        if (typeof detail === "object" && detail !== null) {
          const fields = detail.fieldErrors ? Object.entries(detail.fieldErrors).map(([k, v]) => `${k}: ${(v as string[]).join(", ")}`).join("; ") : "";
          detail = fields || detail.formErrors?.join("; ") || JSON.stringify(detail);
        }
        if (!detail) detail = res.statusText;
        setMessage(`Erreur : ${detail}`);
      } else {
        setMessage(current === "inactif" ? "Contrat activé." : "Contrat désactivé.");
        await refresh();
      }
    } catch (e) {
      setMessage("Erreur réseau");
    } finally {
      setLoading(false);
    }
  }

  async function validateContract(id: string) {
    if (!canManage) return;
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/personnel/assurances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "validate_contract", id }),
      });
      const json = await res.json();
      if (!res.ok) {
        let detail = json.error;
        if (typeof detail === "object" && detail !== null) {
          const fields = detail.fieldErrors ? Object.entries(detail.fieldErrors).map(([k, v]) => `${k}: ${(v as string[]).join(", ")}`).join("; ") : "";
          detail = fields || detail.formErrors?.join("; ") || JSON.stringify(detail);
        }
        if (!detail) detail = res.statusText;
        setMessage(`Erreur : ${detail}`);
      } else {
        setMessage("Contrat validé.");
        await refresh();
      }
    } catch (e) {
      setMessage("Erreur réseau");
    } finally {
      setLoading(false);
    }
  }

  async function requestContractAdvance(id: string) {
    if (!canPay) return;
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/personnel/assurances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "request_advance_contract", id }),
      });
      const json = await res.json();
      if (!res.ok) {
        let detail = json.error;
        if (typeof detail === "object" && detail !== null) {
          const fields = detail.fieldErrors ? Object.entries(detail.fieldErrors).map(([k, v]) => `${k}: ${(v as string[]).join(", ")}`).join("; ") : "";
          detail = fields || detail.formErrors?.join("; ") || JSON.stringify(detail);
        }
        if (!detail) detail = res.statusText;
        setMessage(`Erreur : ${detail}`);
      } else {
        setMessage("Demande d'avance envoyée pour validation.");
        await refresh();
      }
    } catch (e) {
      setMessage("Erreur réseau");
    } finally {
      setLoading(false);
    }
  }

  async function approveAdvance(id: string) {
    if (!canApproveAdvance) return;
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/personnel/assurances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve_advance", id }),
      });
      const json = await res.json();
      if (!res.ok) {
        let detail = json.error;
        if (typeof detail === "object" && detail !== null) {
          const fields = detail.fieldErrors ? Object.entries(detail.fieldErrors).map(([k, v]) => `${k}: ${(v as string[]).join(", ")}`).join("; ") : "";
          detail = fields || detail.formErrors?.join("; ") || JSON.stringify(detail);
        }
        if (!detail) detail = res.statusText;
        setMessage(`Erreur : ${detail}`);
      } else {
        setMessage("Avance approuvée.");
        await refresh();
      }
    } catch (e) {
      setMessage("Erreur réseau");
    } finally {
      setLoading(false);
    }
  }

  async function payAdvance(id: string) {
    if (!canPay) return;
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/personnel/assurances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "pay_advance", id }),
      });
      const json = await res.json();
      if (!res.ok) {
        let detail = json.error;
        if (typeof detail === "object" && detail !== null) {
          const fields = detail.fieldErrors ? Object.entries(detail.fieldErrors).map(([k, v]) => `${k}: ${(v as string[]).join(", ")}`).join("; ") : "";
          detail = fields || detail.formErrors?.join("; ") || JSON.stringify(detail);
        }
        if (!detail) detail = res.statusText;
        setMessage(`Erreur : ${detail}`);
      } else {
        setMessage("Paiement et écriture comptable enregistrés.");
        await refresh();
      }
    } catch (e) {
      setMessage("Erreur réseau");
    } finally {
      setLoading(false);
    }
  }

  async function refresh() {
    const res = await fetch("/api/personnel/assurances");
    if (res.ok) {
      const json = await res.json();
      setData(json as InitialData);
    }
  }

  function cancel(action: string) {
    setEditId({ ...editId, [action]: "" });
    if (action === "insurer") setInsurerForm(defaultInsurerForm);
    if (action === "contract") setContractForm(defaultContractForm);
    if (action === "insuredEmployee") setInsuredForm(defaultInsuredForm);
    if (action === "dependent") setDependentForm(defaultDependentForm);
    if (action === "provider") setProviderForm(defaultProviderForm);
    if (action === "invoice") setInvoiceForm(defaultInvoiceForm);
    setActiveForm(null);
  }

  function startAdd(action: string) { cancel(action); setActiveForm(action); }

  function nextDependentNumber(ie: Employee) {
    const base = ie.numeroAdherent || "ADH";
    let max = 0;
    for (const d of data.dependents) {
      const ref = d.numeroAdherent ?? "";
      if (!ref.startsWith(`${base}-`)) continue;
      const n = parseInt(ref.slice(base.length + 1), 10);
      if (!isNaN(n)) max = Math.max(max, n);
    }
    return `${base}-${String(max + 1).padStart(2, "0")}`;
  }

  function startAddDependent(ie?: Employee) {
    cancel("dependent");
    if (ie) {
      setDependentForm({
        ...defaultDependentForm,
        insuredEmployeeId: ie.id,
        employeeId: ie.employeeId,
        numeroAdherent: nextDependentNumber(ie),
        tauxParticulier: String(ie.tauxParticulier ?? ie.contract.tauxGeneral),
        plafondParticulier: ie.plafondIndividuel !== null && ie.plafondIndividuel !== undefined ? String(ie.plafondIndividuel) : "",
        dateDebutCouverture: ie.dateAdhesion.slice(0, 10),
        dateFinCouverture: ie.dateFinCouverture ? ie.dateFinCouverture.slice(0, 10) : "",
      });
    }
    setActiveForm("dependent");
  }

  function nextContractReference() {
    const prefix = `CTR-${new Date().getFullYear()}-`;
    let max = 0;
    for (const c of data.contracts) {
      if (!c.reference.startsWith(prefix)) continue;
      const n = parseInt(c.reference.slice(prefix.length), 10);
      if (!isNaN(n)) max = Math.max(max, n);
    }
    return `${prefix}${String(max + 1).padStart(3, "0")}`;
  }

  function startAddContract(insurer?: Insurer) {
    cancel("contract");
    setContractForm({ ...defaultContractForm, reference: nextContractReference(), insurerId: insurer?.id ?? "" });
    setActiveForm("contract");
  }

  function nextAdherentNumber() {
    const prefix = `ADH-${new Date().getFullYear()}-`;
    let max = 0;
    for (const e of data.employees) {
      const ref = e.numeroAdherent ?? "";
      if (!ref.startsWith(prefix)) continue;
      const n = parseInt(ref.slice(prefix.length), 10);
      if (!isNaN(n)) max = Math.max(max, n);
    }
    return `${prefix}${String(max + 1).padStart(3, "0")}`;
  }

  function startAddInsuredEmployee() {
    cancel("insuredEmployee");
    setInsuredForm({
      ...defaultInsuredForm,
      contractId: activeContract?.id ?? "",
      numeroAdherent: nextAdherentNumber(),
      dateAdhesion: new Date().toISOString().slice(0, 10),
      dateFinCouverture: activeContract ? activeContract.dateFin.slice(0, 10) : "",
      tauxParticulier: activeContract ? String(activeContract.tauxGeneral) : "",
    });
    setActiveForm("insuredEmployee");
  }

  function startEdit(action: string, id: string) {
    setEditId({ ...editId, [action]: id });
    if (action === "insurer") {
      const r = data.insurers.find((x) => x.id === id);
      if (r) setInsurerForm({ ...r, adresse: r.adresse ?? "", telephone: r.telephone ?? "", email: r.email ?? "", telephoneSecondaire: r.telephoneSecondaire ?? "", siteWeb: r.siteWeb ?? "", referenceInterne: r.referenceInterne ?? "", observations: r.observations ?? "", managerNom: r.managerNom ?? "", managerFonction: r.managerFonction ?? "", managerTelephone: r.managerTelephone ?? "", managerEmail: r.managerEmail ?? "" });
    }
    if (action === "contract") {
      const r = data.contracts.find((x) => x.id === id);
      if (r) setContractForm({ ...r, datePaiementAvance: r.datePaiementAvance ?? "", modePaiementAvance: r.modePaiementAvance ?? "", referencePaiementAvance: r.referencePaiementAvance ?? "", conditions: r.conditions ?? "", factureAssureurPath: r.factureAssureurPath ?? "", chequePath: r.chequePath ?? "" });
    }
    if (action === "insuredEmployee") {
      const r = data.employees.find((x) => x.id === id);
      if (r) setInsuredForm({ employeeId: r.employeeId, contractId: r.contractId, numeroAdherent: r.numeroAdherent ?? "", dateAdhesion: r.dateAdhesion, dateFinCouverture: r.dateFinCouverture ?? "", formule: r.formule ?? "", tauxParticulier: r.tauxParticulier ?? "", plafondIndividuel: r.plafondIndividuel ?? "", statut: r.statut });
    }
    if (action === "dependent") {
      const r = data.dependents.find((x) => x.id === id);
      if (r) setDependentForm({ employeeId: r.employeeId, insuredEmployeeId: r.insuredEmployeeId ?? "", nom: r.nom, prenom: r.prenom, sexe: r.sexe ?? "", dateNaissance: r.dateNaissance ?? "", lienFamilial: r.lienFamilial, numeroAdherent: r.numeroAdherent ?? "", dateDebutCouverture: r.dateDebutCouverture ?? "", dateFinCouverture: r.dateFinCouverture ?? "", tauxParticulier: r.tauxParticulier ?? "", plafondParticulier: r.plafondParticulier ?? "", observations: r.observations ?? "" });
    }
    if (action === "provider") {
      const r = data.providers.find((x) => x.id === id);
      if (r) setProviderForm({ ...r, adresse: r.adresse ?? "", telephone: r.telephone ?? "", email: r.email ?? "", typePrestataire: r.typePrestataire ?? "" });
    }
    if (action === "invoice") {
      const r = data.invoices.find((x) => x.id === id);
      if (r) setInvoiceForm({ insuredEmployeeId: r.insuredEmployeeId, dependentId: r.dependentId ?? "", contractId: r.contractId, providerId: r.providerId, numeroFacture: r.numeroFacture ?? "", dateSoins: r.dateSoins, dateFacture: r.dateFacture, typeSoin: r.typeSoin, montantTotal: r.montantTotal, tauxApplique: r.tauxApplique ?? "", commentaire: r.commentaire ?? "", justificatifPath: r.justificatifPath ?? "", factureAssureurPath: r.factureAssureurPath ?? "", chequePath: r.chequePath ?? "" });
    }
    setActiveForm(action);
  }

  function formatMoney(n: number) {
    return n.toLocaleString("fr-FR") + " FCFA";
  }

  const TABS = [
    { key: "dashboard", label: "Tableau de bord", color: "emerald" },
    { key: "assureurs", label: "Assureurs", color: "blue" },
    { key: "employes", label: "Employés assurés", color: "green" },
    { key: "prestataires", label: "Prestataires", color: "slate" },
    { key: "factures", label: "Factures", color: "yellow" },
    { key: "totaux", label: "Totaux par employé", color: "violet" },
  ] as const;

  const tabClass = (color: string, active: boolean) => {
    const colors: Record<string, string> = {
      emerald: "border-b-transparent border-emerald-200/80 border-t-emerald-500 bg-emerald-100 text-emerald-900 hover:bg-emerald-200",
      blue: "border-b-transparent border-blue-200/80 border-t-blue-500 bg-blue-100 text-blue-900 hover:bg-blue-200",
      amber: "border-b-transparent border-amber-200/80 border-t-amber-500 bg-amber-100 text-amber-900 hover:bg-amber-200",
      green: "border-b-transparent border-green-200/80 border-t-green-500 bg-green-100 text-green-900 hover:bg-green-200",
      yellow: "border-b-transparent border-yellow-200/80 border-t-yellow-500 bg-yellow-100 text-yellow-900 hover:bg-yellow-200",
      slate: "border-b-transparent border-gray-200/80 border-t-gray-500 bg-gray-100 text-gray-900 hover:bg-gray-200",
      indigo: "border-b-transparent border-sky-200/80 border-t-sky-500 bg-sky-100 text-sky-900 hover:bg-sky-200",
      violet: "border-b-transparent border-sky-200/80 border-t-sky-500 bg-sky-100 text-sky-900 hover:bg-sky-200",
    };
    return `relative flex w-auto items-center justify-center whitespace-nowrap rounded-t-xl border px-3 py-2 text-center text-[10px] font-semibold shadow-[0_-6px_16px_-8px_rgba(15,27,46,0.25)] transition ${colors[color] || colors.emerald} ${active ? "z-10 font-bold" : "opacity-80 hover:opacity-100"}`;
  };

  const activeContract = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const covering = data.contracts
      .filter((c) => c.statut === "actif" && c.dateDebut.slice(0, 10) <= today && c.dateFin.slice(0, 10) >= today)
      .sort((a, b) => b.dateDebut.localeCompare(a.dateDebut));
    return covering[0] ?? data.contracts.filter((c) => c.statut === "actif").sort((a, b) => b.dateDebut.localeCompare(a.dateDebut))[0] ?? null;
  }, [data.contracts]);

  const filteredInvoices = useMemo(() => {
    return data.invoices.filter((inv) => {
      const d = inv.dateSoins.slice(0, 10);
      return (
!startDate || d >= startDate) && (!endDate || d <= endDate);
    });
  }, [data.invoices, startDate, endDate]);

  const dependentFormBlock = canWrite && activeForm === "dependent" && (
    <form
      className="card grid grid-cols-3 gap-3 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const payload = {
          ...dependentForm,
          sexe: dependentForm.sexe || undefined,
          tauxParticulier: dependentForm.tauxParticulier === "" ? undefined : Number(dependentForm.tauxParticulier),
          plafondParticulier: dependentForm.plafondParticulier === "" ? undefined : Number(dependentForm.plafondParticulier),
        };
        submit("dependent", payload);
      }}
    >
      <h2 className="col-span-3 font-semibold">{editId.dependent ? "Modifier ayant droit" : "Ajouter un ayant droit"}</h2>
      <select
        className="input"
        value={dependentForm.insuredEmployeeId}
        required
        onChange={(e) => {
          const insuredEmployeeId = e.target.value;
          const ie = data.employees.find((x) => x.id === insuredEmployeeId);
          if (!ie) {
            setDependentForm({ ...dependentForm, insuredEmployeeId, employeeId: "" });
            return;
          }
          setDependentForm({
            ...dependentForm,
            insuredEmployeeId,
            employeeId: ie.employeeId,
            numeroAdherent: nextDependentNumber(ie),
            tauxParticulier: String(ie.tauxParticulier ?? ie.contract.tauxGeneral),
            plafondParticulier: ie.plafondIndividuel !== null && ie.plafondIndividuel !== undefined ? String(ie.plafondIndividuel) : "",
            dateDebutCouverture: ie.dateAdhesion.slice(0, 10),
            dateFinCouverture: ie.dateFinCouverture ? ie.dateFinCouverture.slice(0, 10) : "",
          });
        }}
      >
        <option value="">Employé assuré</option>
        {data.employees.map((ie) => (
          <option key={ie.id} value={ie.id}>{ie.employee.firstName} {ie.employee.lastName} — {ie.contract.reference}</option>
        ))}
      </select>
      <input className="input" placeholder="Prénom" value={dependentForm.prenom} onChange={(e) => setDependentForm({ ...dependentForm, prenom: e.target.value })} required />
      <input className="input" placeholder="Nom" value={dependentForm.nom} onChange={(e) => setDependentForm({ ...dependentForm, nom: e.target.value })} required />
      <select className="input" value={dependentForm.sexe} onChange={(e) => setDependentForm({ ...dependentForm, sexe: e.target.value })}>
        <option value="">Sexe</option>
        <option value="M">Masculin</option>
        <option value="F">Féminin</option>
        <option value="autre">Autre</option>
      </select>
      <input className="input" type="date" placeholder="Date de naissance" value={dependentForm.dateNaissance} onChange={(e) => setDependentForm({ ...dependentForm, dateNaissance: e.target.value })} />
      <select className="input" value={dependentForm.lienFamilial} onChange={(e) => setDependentForm({ ...dependentForm, lienFamilial: e.target.value })}>
        <option value="conjoint">Conjoint</option>
        <option value="enfant">Enfant</option>
        <option value="pere">Père</option>
        <option value="mere">Mère</option>
        <option value="autre">Autre</option>
      </select>
      <input className="input cursor-not-allowed bg-gray-100 text-gray-500" placeholder="N° adhérent (auto)" title="Numéro d'adhérent généré automatiquement" value={dependentForm.numeroAdherent} disabled />
      <input className="input" type="date" placeholder="Début couverture" value={dependentForm.dateDebutCouverture} onChange={(e) => setDependentForm({ ...dependentForm, dateDebutCouverture: e.target.value })} />
      <input className="input" type="date" placeholder="Fin couverture" value={dependentForm.dateFinCouverture} onChange={(e) => setDependentForm({ ...dependentForm, dateFinCouverture: e.target.value })} />
      <input className="input" type="number" step="0.01" placeholder="Taux particulier (%)" value={dependentForm.tauxParticulier} onChange={(e) => setDependentForm({ ...dependentForm, tauxParticulier: e.target.value })} />
      <input className="input" type="number" placeholder="Plafond particulier" value={dependentForm.plafondParticulier} onChange={(e) => setDependentForm({ ...dependentForm, plafondParticulier: e.target.value })} />
      <input className="input" placeholder="Observations" value={dependentForm.observations} onChange={(e) => setDependentForm({ ...dependentForm, observations: e.target.value })} />
      <div className="col-span-3 flex gap-2">
        <button className="rounded-lg bg-emerald-500 px-4 py-2 text-white" disabled={loading} type="submit">{editId.dependent ? "Modifier" : "Enregistrer"}</button>
        <button type="button" onClick={() => cancel("dependent")} className="rounded-lg bg-gray-300 px-4 py-2 text-gray-700">Annuler</button>
      </div>
    </form>
  );

  const contractFormBlock = canWrite && activeForm === "contract" && (
    <form
      className="card grid grid-cols-3 gap-3 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit("contract", contractForm);
      }}
    >
      <h2 className="col-span-3 font-semibold">{editId.contract ? "Modifier contrat" : "Nouveau contrat"}</h2>
      <select className="input" value={contractForm.insurerId} onChange={(e) => setContractForm({ ...contractForm, insurerId: e.target.value })} required>
        <option value="">Assureur</option>
        {data.insurers
          .filter((i) => i.statut === "actif")
          .map((i) => (
            <option key={i.id} value={i.id}>{i.nom}</option>
          ))}
      </select>
      <input className="input cursor-not-allowed bg-gray-100 text-gray-500" placeholder="Référence (auto)" title="Référence générée automatiquement" value={contractForm.reference} disabled />
      <input className="input" type="date" value={contractForm.dateDebut} onChange={(e) => setContractForm({ ...contractForm, dateDebut: e.target.value })} required />
      <input className="input" type="date" value={contractForm.dateFin} onChange={(e) => setContractForm({ ...contractForm, dateFin: e.target.value })} required />
      <select className="input" value={contractForm.typeCouverture} onChange={(e) => setContractForm({ ...contractForm, typeCouverture: e.target.value })}>
        <option value="individuel">Individuel</option>
        <option value="familial">Familial</option>
        <option value="entreprise">Entreprise</option>
      </select>
      <input className="input" value={contractForm.devise} onChange={(e) => setContractForm({ ...contractForm, devise: e.target.value })} placeholder="Devise" />
      <input className="input" type="number" placeholder="Taux général (%)" value={contractForm.tauxGeneral} onChange={(e) => setContractForm({ ...contractForm, tauxGeneral: Number(e.target.value) })} required />
      <input className="input" type="number" placeholder="Avance versée" value={contractForm.montantAvance} onChange={(e) => setContractForm({ ...contractForm, montantAvance: Number(e.target.value) })} />
      <input className="input" type="date" placeholder="Date paiement avance" value={contractForm.datePaiementAvance} onChange={(e) => setContractForm({ ...contractForm, datePaiementAvance: e.target.value })} />
      <input className="input" placeholder="Mode paiement avance" value={contractForm.modePaiementAvance} onChange={(e) => setContractForm({ ...contractForm, modePaiementAvance: e.target.value })} />
      <input className="input" placeholder="Réf. paiement avance" value={contractForm.referencePaiementAvance} onChange={(e) => setContractForm({ ...contractForm, referencePaiementAvance: e.target.value })} />
      <select className="input" value={contractForm.statut} onChange={(e) => setContractForm({ ...contractForm, statut: e.target.value })}>
        <option value="brouillon">Brouillon</option>
        <option value="actif">Actif</option>
        <option value="inactif">Inactif</option>
        <option value="expire">Expiré</option>
        <option value="resilie">Résilié</option>
        <option value="cloture">Clôturé</option>
      </select>
      <input className="input" placeholder="Conditions" value={contractForm.conditions} onChange={(e) => setContractForm({ ...contractForm, conditions: e.target.value })} />
      <FileUploadField
        label="Facture assureur"
        value={contractForm.factureAssureurPath}
        onUploaded={(key) => setContractForm({ ...contractForm, factureAssureurPath: key })}
        disabled={!canWrite}
      />
      <FileUploadField
        label="Chèque"
        value={contractForm.chequePath}
        onUploaded={(key) => setContractForm({ ...contractForm, chequePath: key })}
        disabled={!canWrite}
      />
      <div className="col-span-3 flex gap-2">
        <button className="rounded-lg bg-emerald-500 px-4 py-2 text-white" disabled={loading} type="submit">{editId.contract ? "Modifier" : "Enregistrer"}</button>
        <button type="button" onClick={() => cancel("contract")} className="rounded-lg bg-gray-300 px-4 py-2 text-gray-700">Annuler</button>
      </div>
    </form>
  );

  return (
    <div className="space-y-6">
      {message && (
        <div className={`rounded-lg px-4 py-3 text-sm ${message.startsWith("Erreur") ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
          {message}
        </div>
      )}

      <div className="no-scrollbar flex min-w-max items-end gap-1 overflow-x-auto rounded-t-xl border border-cabinet-200/80 bg-cabinet-100/50 px-3 pt-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={tabClass(t.color, tab === t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "dashboard" && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="card p-4">
              <p className="text-sm text-gray-500">Total factures</p>
              <p className="text-2xl font-bold">{formatMoney(data.totals.totalFactures)}</p>
            </div>
            <div className="card p-4">
              <p className="text-sm text-gray-500">Part cabinet</p>
              <p className="text-2xl font-bold">{formatMoney(data.totals.totalPartCabinet)}</p>
            </div>
            <div className="card p-4">
              <p className="text-sm text-gray-500">Avances versées</p>
              <p className="text-2xl font-bold">{formatMoney(data.totalAvances)}</p>
            </div>
            <div className="card p-4">
              <p className="text-sm text-gray-500">Solde à payer</p>
              <p className="text-2xl font-bold">{formatMoney(data.soldeAPayer)}</p>
            </div>
            <div className="card p-4">
              <p className="text-sm text-gray-500">Payé par les employés</p>
              <p className="text-2xl font-bold">{formatMoney(data.totals.totalPayeEmploye)}</p>
            </div>
            <div className="card p-4">
              <p className="text-sm text-gray-500">Part employés</p>
              <p className="text-2xl font-bold">{formatMoney(data.totals.totalPartEmploye)}</p>
            </div>
            <div className="card p-4">
              <p className="text-sm text-gray-500">Nombre de factures</p>
              <p className="text-2xl font-bold">{data.invoices.length}</p>
            </div>
          </div>
        </div>
      )}
      {tab === "assureurs" && (
        <div className="space-y-6">
          <div className="card overflow-x-auto">
            <div className="flex items-center justify-between p-4">
              <h3 className="font-semibold">Assureurs</h3>
              <button
                onClick={() => startAdd("insurer")}
                className="rounded-lg bg-emerald-500 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-emerald-600"
              >
                + Ajouter
              </button>
            </div>
            <table className="w-full min-w-[600px] text-left text-sm">
              <thead className="bg-cabinet-100 text-cabinet-900">
                <tr>
                  {sortTh("insurers", "nom", "Nom", "px-4 py-3")}
                  {sortTh("insurers", "adresse", "Adresse", "px-4 py-3")}
                  {sortTh("insurers", "telephone", "Téléphone", "px-4 py-3")}
                  {sortTh("insurers", "email", "Email", "px-4 py-3")}
                  {sortTh("insurers", "gestionnaire", "Gestionnaire", "px-4 py-3")}
                  {sortTh("insurers", "statut", "Statut", "px-4 py-3")}
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.insurers.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-500">Aucun assureur.</td></tr>
                )}
                <PaginatedRows colSpan={7}>
                {sortRows("insurers", data.insurers, {
                  nom: (i) => i.nom,
                  adresse: (i) => i.adresse,
                  telephone: (i) => i.telephone,
                  email: (i) => i.email,
                  gestionnaire: (i) => i.managerNom,
                  statut: (i) => i.statut,
                }).map((i) => {
                  const contracts = data.contracts.filter((c) => c.insurerId === i.id);
                  const selected = selectedInsurerId === i.id;
                  return (
                    <Fragment key={i.id}>
                      <tr
                        onClick={() => setSelectedInsurerId(selected ? "" : i.id)}
                        className={`cursor-pointer border-b ${selected ? "bg-cabinet-100/70" : ""} ${i.statut === "inactif" ? "bg-gray-100/50 text-gray-500 line-through" : selected ? "" : "hover:bg-gray-50"}`}
                      >
                        <td className="px-4 py-3 font-medium">{i.nom}</td>
                        <td className="px-4 py-3">{i.adresse}</td>
                        <td className="px-4 py-3">{i.telephone}</td>
                        <td className="px-4 py-3">{i.email}</td>
                        <td className="px-4 py-3">{i.managerNom}</td>
                        <td className="px-4 py-3"><span className="rounded-full bg-gray-100 px-2 py-1 text-xs">{i.statut}</span></td>
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <ActionButton onClick={() => startEdit("insurer", i.id)} title="Modifier" icon="edit" color="blue" className="mr-1" />
                          <button
                            type="button"
                            onClick={() => toggleInsurerStatus(i.id)}
                            className="mr-1 inline-flex items-center rounded p-1.5"
                            title={i.statut === "actif" ? "Désactiver" : "Activer"}
                            disabled={loading}
                          >
                            <svg
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className={`h-4 w-4 ${i.statut === "actif" ? "text-emerald-600" : "text-rose-600"}`}
                            >
                              <path d="M12 2v10" />
                              <path d="M16.24 7.76a6 6 0 1 1-8.48 0" />
                            </svg>
                          </button>

                        </td>
                      </tr>
                      {selected && (
                      <tr className="border-b bg-cabinet-50/50">
                        <td colSpan={7} className="px-4 py-3">
                          <div className="mb-2 flex items-center justify-between">
                            <div className="text-xs font-semibold text-cabinet-900">Contrats</div>
                            {canWrite && (
                              <button
                                type="button"
                                onClick={() => startAddContract(i)}
                                className="rounded bg-emerald-500 px-2 py-1 text-[11px] font-medium text-white transition hover:bg-emerald-600"
                              >
                                + Ajouter
                              </button>
                            )}
                          </div>
                          <table className="w-full text-left text-xs">
                            <thead className="bg-cabinet-100/60 text-cabinet-900">
                              <tr>
                                {sortTh("contracts", "reference", "Référence", "px-3 py-2")}
                                {sortTh("contracts", "debut", "Début", "px-3 py-2")}
                                {sortTh("contracts", "fin", "Fin", "px-3 py-2")}
                                {sortTh("contracts", "couverture", "Couverture", "px-3 py-2")}
                                {sortTh("contracts", "taux", "Taux", "px-3 py-2")}
                                {sortTh("contracts", "statut", "Statut", "px-3 py-2")}
                                <th className="px-3 py-2">Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {contracts.length === 0 && (
                                <tr><td colSpan={7} className="px-3 py-3 text-center text-gray-500">Aucun contrat.</td></tr>
                              )}
                              <PaginatedRows colSpan={7}>
                              {sortRows("contracts", contracts, {
                                reference: (c) => c.reference,
                                debut: (c) => c.dateDebut,
                                fin: (c) => c.dateFin,
                                couverture: (c) => c.typeCouverture,
                                taux: (c) => c.tauxGeneral,
                                statut: (c) => c.statut,
                              }).map((c) => (
                                <tr key={c.id} className={`border-b ${c.statut === "inactif" ? "bg-gray-100/50 text-gray-500 line-through" : "hover:bg-white/50"}`}>
                                  <td className="px-3 py-2 font-medium">{c.reference}</td>
                                  <td className="px-3 py-2">{new Date(c.dateDebut).toLocaleDateString("fr-FR")}</td>
                                  <td className="px-3 py-2">{new Date(c.dateFin).toLocaleDateString("fr-FR")}</td>
                                  <td className="px-3 py-2">{c.typeCouverture}</td>
                                  <td className="px-3 py-2">{c.tauxGeneral}%</td>
                                  <td className="px-3 py-2"><span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px]">{c.statut}</span></td>
                                  <td className="px-3 py-2">
                                    <ActionButton onClick={() => startEdit("contract", c.id)} title="Modifier" icon="edit" color="blue" className="mr-1" />
                                    {canManage && c.statut === "brouillon" && (
                                      <ActionButton onClick={() => validateContract(c.id)} title="Valider" icon="validate" color="emerald" className="mr-1" />
                                    )}
                                    {canManage && (c.statut === "actif" || c.statut === "inactif") && (
                                      <button
                                        type="button"
                                        onClick={() => toggleContractStatus(c.id, c.statut)}
                                        className="mr-1 inline-flex items-center rounded p-1.5"
                                        title={c.statut === "inactif" ? "Activer" : "Désactiver"}
                                        disabled={loading}
                                      >
                                        <svg
                                          viewBox="0 0 24 24"
                                          fill="none"
                                          stroke="currentColor"
                                          strokeWidth="2"
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          className={`h-4 w-4 ${c.statut === "inactif" ? "text-rose-600" : "text-emerald-600"}`}
                                        >
                                          <path d="M12 2v10" />
                                          <path d="M16.24 7.76a6 6 0 1 1-8.48 0" />
                                        </svg>
                                      </button>
                                    )}
                                    {(() => {
                                      const currentAdvance = c.payments.find((p) => p.typePaiement === "avance" && p.statut !== "annule");
                                      if (!currentAdvance && canPay && c.montantAvance > 0 && c.statut === "actif") {
                                        return <ActionButton onClick={() => requestContractAdvance(c.id)} title="Demander avance" icon="advance" color="emerald" className="mr-1" />;
                                      }
                                      if (currentAdvance?.statut === "brouillon" && canApproveAdvance) {
                                        return <ActionButton onClick={() => approveAdvance(currentAdvance.id)} title="Approuver" icon="approve" color="amber" className="mr-1" />;
                                      }
                                      if (currentAdvance?.statut === "approuve" && canPay) {
                                        return <ActionButton onClick={() => payAdvance(currentAdvance.id)} title="Payer" icon="pay" color="emerald" className="mr-1" />;
                                      }
                                      if (currentAdvance && (currentAdvance.statut === "paye" || currentAdvance.statut === "valide")) {
                                        return <span className="mr-2 text-xs text-gray-500">Avance payée</span>;
                                      }
                                      return null;
                                    })()}
                                    {canPay && (
                                      <ActionButton onClick={() => startEdit("contract", c.id)} title="Uploader" icon="upload" color="cabinet" className="mr-1" />
                                    )}
                                    <ActionButton onClick={() => toggleStatut("contract", c.id, c.statut)} title={c.statut === "actif" ? "Désactiver" : "Activer"} icon="power" color={c.statut === "actif" ? "red" : "emerald"} />
                                  </td>
                                </tr>
                              ))}
                              </PaginatedRows>
                            </tbody>
                          </table>
                        </td>
                      </tr>
                      )}
                    </Fragment>
                  );
                })}
                </PaginatedRows>
              </tbody>
            </table>
          </div>

          {canWrite && activeForm === "insurer" && (
          <form
            className="card grid grid-cols-3 gap-3 p-4"
            onSubmit={(e) => {
              e.preventDefault();
              submit("insurer", insurerForm);
            }}
          >
            <h2 className="col-span-3 font-semibold">{editId.insurer ? "Modifier assureur" : "Nouvel assureur"}</h2>
            <input className="input" placeholder="Nom" value={insurerForm.nom} onChange={(e) => setInsurerForm({ ...insurerForm, nom: e.target.value })} required />
            <input className="input" placeholder="Adresse" value={insurerForm.adresse} onChange={(e) => setInsurerForm({ ...insurerForm, adresse: e.target.value })} />
            <input className="input" placeholder="Téléphone" value={insurerForm.telephone} onChange={(e) => setInsurerForm({ ...insurerForm, telephone: e.target.value })} />
            <input className="input" placeholder="Téléphone secondaire" value={insurerForm.telephoneSecondaire} onChange={(e) => setInsurerForm({ ...insurerForm, telephoneSecondaire: e.target.value })} />
            <input className="input" placeholder="Email" value={insurerForm.email} onChange={(e) => setInsurerForm({ ...insurerForm, email: e.target.value })} />
            <input className="input" placeholder="Site web" value={insurerForm.siteWeb} onChange={(e) => setInsurerForm({ ...insurerForm, siteWeb: e.target.value })} />
            <input className="input" placeholder="Référence interne" value={insurerForm.referenceInterne} onChange={(e) => setInsurerForm({ ...insurerForm, referenceInterne: e.target.value })} />
            <select className="input" value={insurerForm.statut} onChange={(e) => setInsurerForm({ ...insurerForm, statut: e.target.value })}>
              <option value="actif">Actif</option>
              <option value="inactif">Inactif</option>
            </select>
            <input className="input" placeholder="Observations" value={insurerForm.observations} onChange={(e) => setInsurerForm({ ...insurerForm, observations: e.target.value })} />
            <input className="input" placeholder="Gestionnaire" value={insurerForm.managerNom} onChange={(e) => setInsurerForm({ ...insurerForm, managerNom: e.target.value })} />
            <input className="input" placeholder="Fonction gestionnaire" value={insurerForm.managerFonction} onChange={(e) => setInsurerForm({ ...insurerForm, managerFonction: e.target.value })} />
            <input className="input" placeholder="Tél. gestionnaire" value={insurerForm.managerTelephone} onChange={(e) => setInsurerForm({ ...insurerForm, managerTelephone: e.target.value })} />
            <input className="input" placeholder="Email gestionnaire" value={insurerForm.managerEmail} onChange={(e) => setInsurerForm({ ...insurerForm, managerEmail: e.target.value })} />
            <div className="col-span-3 flex gap-2">
              <button className="rounded-lg bg-emerald-500 px-4 py-2 text-white" disabled={loading} type="submit">{editId.insurer ? "Modifier" : "Enregistrer"}</button>
              {editId.insurer && <button type="button" onClick={() => cancel("insurer")} className="rounded-lg bg-gray-300 px-4 py-2 text-gray-700">Annuler</button>}
            </div>
          </form>
          )}

          {contractFormBlock}

        </div>
      )}
      {tab === "employes" && (
        <div className="space-y-6">
          {(() => {
            const c = activeContract;
            if (!c) return null;
            const ins = data.insurers.find((i) => i.id === c.insurerId);
            return (
              <div className="card p-4">
                <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
                  <span className="font-semibold text-cabinet-900">Assureur actif : {c.insurer.nom}</span>
                  {ins?.telephone && <span>Tél : {ins.telephone}</span>}
                  {ins?.email && <span>Email : {ins.email}</span>}
                  {ins?.managerNom && (
                    <span>Gestionnaire : {ins.managerNom}{ins.managerTelephone ? ` (${ins.managerTelephone})` : ""}</span>
                  )}
                  <span>
                    Contrat : {c.reference} — {c.tauxGeneral}% — du {new Date(c.dateDebut).toLocaleDateString("fr-FR")} au {new Date(c.dateFin).toLocaleDateString("fr-FR")}
                  </span>
                </div>
              </div>
            );
          })()}
          <div className="card overflow-x-auto">
            <div className="flex items-center justify-between p-4">
              <h3 className="font-semibold">Employés assurés</h3>
              <button
                onClick={() => startAddInsuredEmployee()}
                className="rounded-lg bg-emerald-500 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-emerald-600"
              >
                + Ajouter
              </button>
            </div>
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-cabinet-100 text-cabinet-900">
                <tr>
                  {sortTh("employees", "employe", "Employé", "px-4 py-3")}
                  {sortTh("employees", "contrat", "Contrat", "px-4 py-3")}
                  {sortTh("employees", "assureur", "Assureur", "px-4 py-3")}
                  {sortTh("employees", "adherent", "N° adhérent", "px-4 py-3")}
                  {sortTh("employees", "adhesion", "Adhésion", "px-4 py-3")}
                  {sortTh("employees", "taux", "Taux", "px-4 py-3")}
                  {sortTh("employees", "statut", "Statut", "px-4 py-3")}
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.employees.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-6 text-center text-gray-500">Aucun employé assuré.</td></tr>
                )}
                <PaginatedRows colSpan={8}>
                {sortRows("employees", data.employees, {
                  employe: (ie) => `${ie.employee.firstName} ${ie.employee.lastName}`,
                  contrat: (ie) => ie.contract.reference,
                  assureur: (ie) => ie.contract.insurer.nom,
                  adherent: (ie) => ie.numeroAdherent,
                  adhesion: (ie) => ie.dateAdhesion,
                  taux: (ie) => ie.tauxParticulier ?? ie.contract.tauxGeneral,
                  statut: (ie) => ie.statut,
                }).map((ie) => {
                  const deps = data.dependents.filter((d) =>
                    d.insuredEmployeeId
                      ? d.insuredEmployeeId === ie.id
                      : d.employee.id === ie.employee.id
                  );
                  const selected = selectedEmployeeId === ie.id;
                  return (
                    <Fragment key={ie.id}>
                      <tr
                        onClick={() => setSelectedEmployeeId(selected ? "" : ie.id)}
                        className={`cursor-pointer border-b ${selected ? "bg-cabinet-100/70" : "hover:bg-gray-50"}`}
                      >
                        <td className="px-4 py-3 font-medium">{ie.employee.firstName} {ie.employee.lastName}</td>
                        <td className="px-4 py-3">{ie.contract.reference}</td>
                        <td className="px-4 py-3">{ie.contract.insurer.nom}</td>
                        <td className="px-4 py-3">{ie.numeroAdherent}</td>
                        <td className="px-4 py-3">{new Date(ie.dateAdhesion).toLocaleDateString("fr-FR")}</td>
                        <td className="px-4 py-3">{ie.tauxParticulier ?? ie.contract.tauxGeneral}%</td>
                        <td className="px-4 py-3"><span className="rounded-full bg-gray-100 px-2 py-1 text-xs">{ie.statut}</span></td>
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <ActionButton onClick={() => window.open(`/cabinet/personnel/assurances/bilan-employe?employe=${ie.employee.id}`, "_blank")} title="Bilan employé (imprimer)" icon="print" color="cabinet" className="mr-1" />
                          <ActionButton onClick={() => startEdit("insuredEmployee", ie.id)} title="Modifier" icon="edit" color="blue" className="mr-1" />
                          <ActionButton onClick={() => toggleStatut("insuredEmployee", ie.id, ie.statut)} title={ie.statut === "actif" ? "Désactiver" : "Activer"} icon="power" color={ie.statut === "actif" ? "red" : "emerald"} />
                        </td>
                      </tr>
                      {selected && (
                      <tr className="border-b bg-cabinet-50/50">
                        <td colSpan={8} className="px-4 py-3">
                          <div className="mb-2 flex items-center justify-between">
                            <div className="text-xs font-semibold text-cabinet-900">Ayants droit</div>
                            {canWrite && (
                              <button
                                type="button"
                                onClick={() => startAddDependent(ie)}
                                className="rounded bg-emerald-500 px-2 py-1 text-[11px] font-medium text-white transition hover:bg-emerald-600"
                              >
                                + Ajouter
                              </button>
                            )}
                          </div>
                          <table className="w-full text-left text-xs">
                            <thead className="bg-cabinet-100/60 text-cabinet-900">
                              <tr>
                                {sortTh("dependents", "nom", "Prénom Nom", "px-3 py-2")}
                                {sortTh("dependents", "lien", "Lien", "px-3 py-2")}
                                {sortTh("dependents", "sexe", "Sexe", "px-3 py-2")}
                                {sortTh("dependents", "naissance", "Né(e)", "px-3 py-2")}
                                {sortTh("dependents", "statut", "Statut", "px-3 py-2")}
                                <th className="px-3 py-2">Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {deps.length === 0 && (
                                <tr><td colSpan={6} className="px-3 py-3 text-center text-gray-500">Aucun ayant droit.</td></tr>
                              )}
                              <PaginatedRows colSpan={6}>
                              {sortRows("dependents", deps, {
                                nom: (d) => `${d.prenom} ${d.nom}`,
                                lien: (d) => d.lienFamilial,
                                sexe: (d) => d.sexe,
                                naissance: (d) => d.dateNaissance,
                                statut: (d) => d.statut,
                              }).map((d) => (
                                <tr key={d.id} className="border-b hover:bg-white/50">
                                  <td className="px-3 py-2">{d.prenom} {d.nom}</td>
                                  <td className="px-3 py-2">{d.lienFamilial}</td>
                                  <td className="px-3 py-2">{d.sexe || "-"}</td>
                                  <td className="px-3 py-2">{d.dateNaissance ? new Date(d.dateNaissance).toLocaleDateString("fr-FR") : "-"}</td>
                                  <td className="px-3 py-2"><span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px]">{d.statut}</span></td>
                                  <td className="px-3 py-2">
                                    <ActionButton onClick={() => startEdit("dependent", d.id)} title="Modifier" icon="edit" color="blue" className="mr-1" />
                                    <ActionButton onClick={() => toggleStatut("dependent", d.id, d.statut)} title={d.statut === "actif" ? "Désactiver" : "Activer"} icon="power" color={d.statut === "actif" ? "red" : "emerald"} />
                                  </td>
                                </tr>
                              ))}
                              </PaginatedRows>
                            </tbody>
                          </table>
                        </td>
                      </tr>
                      )}
                    </Fragment>
                  );
                })}
                </PaginatedRows>
              </tbody>
            </table>
          </div>

          {canWrite && activeForm === "insuredEmployee" && (
          <form
            className="card grid grid-cols-3 gap-3 p-4"
            onSubmit={(e) => {
              e.preventDefault();
              const payload = {
                ...insuredForm,
                tauxParticulier: insuredForm.tauxParticulier === "" ? undefined : Number(insuredForm.tauxParticulier),
                plafondIndividuel: insuredForm.plafondIndividuel === "" ? undefined : Number(insuredForm.plafondIndividuel),
                dateFinCouverture: insuredForm.dateFinCouverture || undefined,
              };
              submit("insuredEmployee", payload);
            }}
          >
            <h2 className="col-span-3 font-semibold">{editId.insuredEmployee ? "Modifier adhésion" : "Nouvel employé assuré"}</h2>
            <select className="input" value={insuredForm.employeeId} onChange={(e) => setInsuredForm({ ...insuredForm, employeeId: e.target.value })} required>
              <option value="">Employé</option>
              {employeesList.map((emp) => (
                <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</option>
              ))}
            </select>
            <select className="input cursor-not-allowed bg-gray-100 text-gray-500" title="Contrat d'assurance actif" value={insuredForm.contractId} disabled>
              <option value="">{activeContract ? "Contrat actif" : "Aucun contrat actif"}</option>
              {data.contracts.map((c) => (
                <option key={c.id} value={c.id}>{c.reference} ({c.insurer.nom})</option>
              ))}
            </select>
            <input className="input cursor-not-allowed bg-gray-100 text-gray-500" placeholder="N° adhérent (auto)" title="Numéro d'adhérent généré automatiquement" value={insuredForm.numeroAdherent} disabled />
            <input className="input" type="date" value={insuredForm.dateAdhesion} onChange={(e) => setInsuredForm({ ...insuredForm, dateAdhesion: e.target.value })} required />
            <input className="input" type="date" placeholder="Date fin couverture" value={insuredForm.dateFinCouverture} onChange={(e) => setInsuredForm({ ...insuredForm, dateFinCouverture: e.target.value })} />
            <input className="input" placeholder="Formule" value={insuredForm.formule} onChange={(e) => setInsuredForm({ ...insuredForm, formule: e.target.value })} />
            <input className="input" type="number" step="0.01" placeholder="Taux particulier (%)" value={insuredForm.tauxParticulier} onChange={(e) => setInsuredForm({ ...insuredForm, tauxParticulier: e.target.value })} />
            <input className="input" type="number" placeholder="Plafond individuel" value={insuredForm.plafondIndividuel} onChange={(e) => setInsuredForm({ ...insuredForm, plafondIndividuel: e.target.value })} />
            <select className="input" value={insuredForm.statut} onChange={(e) => setInsuredForm({ ...insuredForm, statut: e.target.value })}>
              <option value="actif">Actif</option>
              <option value="suspendu">Suspendu</option>
              <option value="sorti">Sorti</option>
            </select>
            <div className="col-span-3 flex gap-2">
              <button className="rounded-lg bg-emerald-500 px-4 py-2 text-white" disabled={loading} type="submit">{editId.insuredEmployee ? "Modifier" : "Enregistrer"}</button>
              {editId.insuredEmployee && <button type="button" onClick={() => cancel("insuredEmployee")} className="rounded-lg bg-gray-300 px-4 py-2 text-gray-700">Annuler</button>}
            </div>
          </form>
          )}

          {dependentFormBlock}

        </div>
      )}
      {tab === "prestataires" && (
        <div className="space-y-6">
          <div className="card overflow-x-auto">
            <div className="flex items-center justify-between p-4">
              <h3 className="font-semibold">Prestataires</h3>
              <button
                onClick={() => startAdd("provider")}
                className="rounded-lg bg-emerald-500 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-emerald-600"
              >
                + Ajouter
              </button>
            </div>
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead className="bg-cabinet-100 text-cabinet-900">
                <tr>
                  {sortTh("providers", "nom", "Nom", "px-4 py-3")}
                  {sortTh("providers", "adresse", "Adresse", "px-4 py-3")}
                  {sortTh("providers", "telephone", "Téléphone", "px-4 py-3")}
                  {sortTh("providers", "email", "Email", "px-4 py-3")}
                  {sortTh("providers", "type", "Type", "px-4 py-3")}
                  {sortTh("providers", "statut", "Statut", "px-4 py-3")}
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.providers.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-500">Aucun prestataire.</td></tr>
                )}
                <PaginatedRows colSpan={7}>
                {sortRows("providers", data.providers, {
                  nom: (p) => p.nom,
                  adresse: (p) => p.adresse,
                  telephone: (p) => p.telephone,
                  email: (p) => p.email,
                  type: (p) => p.typePrestataire,
                  statut: (p) => p.statut,
                }).map((p) => (
                  <tr key={p.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{p.nom}</td>
                    <td className="px-4 py-3">{p.adresse}</td>
                    <td className="px-4 py-3">{p.telephone}</td>
                    <td className="px-4 py-3">{p.email}</td>
                    <td className="px-4 py-3">{p.typePrestataire}</td>
                    <td className="px-4 py-3"><span className="rounded-full bg-gray-100 px-2 py-1 text-xs">{p.statut}</span></td>
                    <td className="px-4 py-3">
                      <ActionButton onClick={() => startEdit("provider", p.id)} title="Modifier" icon="edit" color="blue" className="mr-1" />
                      <ActionButton onClick={() => toggleStatut("provider", p.id, p.statut)} title={p.statut === "actif" ? "Désactiver" : "Activer"} icon="power" color={p.statut === "actif" ? "red" : "emerald"} />
                    </td>
                  </tr>
                ))}
                </PaginatedRows>
              </tbody>
            </table>
          </div>

          {canWrite && activeForm === "provider" && (
          <form
            className="card grid grid-cols-3 gap-3 p-4"
            onSubmit={(e) => {
              e.preventDefault();
              submit("provider", providerForm);
            }}
          >
            <h2 className="col-span-3 font-semibold">{editId.provider ? "Modifier prestataire" : "Nouveau prestataire"}</h2>
            <input className="input" placeholder="Nom" value={providerForm.nom} onChange={(e) => setProviderForm({ ...providerForm, nom: e.target.value })} required />
            <input className="input" placeholder="Adresse" value={providerForm.adresse} onChange={(e) => setProviderForm({ ...providerForm, adresse: e.target.value })} />
            <input className="input" placeholder="Téléphone" value={providerForm.telephone} onChange={(e) => setProviderForm({ ...providerForm, telephone: e.target.value })} />
            <input className="input" placeholder="Email" value={providerForm.email} onChange={(e) => setProviderForm({ ...providerForm, email: e.target.value })} />
            <input className="input" placeholder="Type de prestataire" value={providerForm.typePrestataire} onChange={(e) => setProviderForm({ ...providerForm, typePrestataire: e.target.value })} />
            <div className="col-span-3 flex gap-2">
              <button className="rounded-lg bg-emerald-500 px-4 py-2 text-white" disabled={loading} type="submit">{editId.provider ? "Modifier" : "Enregistrer"}</button>
              {editId.provider && <button type="button" onClick={() => cancel("provider")} className="rounded-lg bg-gray-300 px-4 py-2 text-gray-700">Annuler</button>}
            </div>
          </form>
          )}

        </div>
      )}
      {tab === "factures" && (
        <div className="space-y-6">
          <div className="card flex flex-wrap items-end gap-3 p-4">
            <div className="min-w-[10rem] flex-1">
              <label className="block text-xs font-medium text-gray-600">Du</label>
              <input
                type="date"
                className="input"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="min-w-[10rem] flex-1">
              <label className="block text-xs font-medium text-gray-600">Au</label>
              <input
                type="date"
                className="input"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <button
              onClick={() => { setStartDate(""); setEndDate(""); }}
              className="rounded-lg bg-gray-200 px-3 py-2 text-sm text-gray-700 transition hover:bg-gray-300"
            >
              Toutes
            </button>
            <button
              onClick={() =>
                window.open(`/cabinet/personnel/assurances/imprimer?debut=${startDate}&fin=${endDate}`, "_blank")
              }
              className="rounded-lg bg-cabinet-700 px-3 py-2 text-sm font-medium text-white transition hover:bg-cabinet-800"
            >
              Imprimer
            </button>
          </div>
          <div className="card overflow-x-auto">
            <div className="flex items-center justify-between p-4">
              <h3 className="font-semibold">Factures</h3>
              <button
                onClick={() => startAdd("invoice")}
                className="rounded-lg bg-emerald-500 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-emerald-600"
              >
                + Ajouter
              </button>
            </div>
            <table className="w-full text-left text-xs">
              <thead className="bg-cabinet-100 text-cabinet-900">
                <tr>
                  {sortTh("invoices", "ref", "Réf.", "px-2 py-2")}
                  {sortTh("invoices", "date", "Date", "px-2 py-2")}
                  {sortTh("invoices", "employe", "Employé", "px-2 py-2")}
                  {sortTh("invoices", "benef", "Bénéf.", "px-2 py-2")}
                  {sortTh("invoices", "prest", "Prest.", "px-2 py-2")}
                  {sortTh("invoices", "total", "Total", "px-2 py-2 text-right")}
                  {sortTh("invoices", "payeEmploye", "Payé employé", "px-2 py-2 text-right")}
                  {sortTh("invoices", "partCabinet", "Part cabinet", "px-2 py-2 text-right")}
                  {sortTh("invoices", "statut", "Statut", "px-2 py-2")}
                  <th className="px-2 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.length === 0 && (
                  <tr><td colSpan={10} className="px-2 py-6 text-center text-gray-500">Aucune facture pour la période.</td></tr>
                )}
                <PaginatedRows colSpan={10}>
                {sortRows("invoices", filteredInvoices, {
                  ref: (inv) => inv.referenceInterne,
                  date: (inv) => inv.dateSoins,
                  employe: (inv) => `${inv.insuredEmployee.employee.firstName} ${inv.insuredEmployee.employee.lastName}`,
                  benef: (inv) => inv.dependent ? `${inv.dependent.prenom} ${inv.dependent.nom}` : "Employé",
                  prest: (inv) => inv.provider.nom,
                  total: (inv) => inv.montantTotal,
                  payeEmploye: (inv) => inv.montantPayeEmploye,
                  partCabinet: (inv) => inv.partCabinet,
                  statut: (inv) => inv.statut,
                }).map((inv) => (
                  <tr key={inv.id} className="border-b hover:bg-gray-50">
                    <td className="px-2 py-2 font-medium">{inv.referenceInterne}</td>
                    <td className="px-2 py-2">{new Date(inv.dateSoins).toLocaleDateString("fr-FR")}</td>
                    <td className="px-2 py-2">{inv.insuredEmployee.employee.firstName} {inv.insuredEmployee.employee.lastName}</td>
                    <td className="px-2 py-2">{inv.dependent ? `${inv.dependent.prenom} ${inv.dependent.nom}` : "Employé"}</td>
                    <td className="px-2 py-2">{inv.provider.nom}</td>
                    <td className="px-2 py-2 text-right">{formatMoney(inv.montantTotal)}</td>
                    <td className="px-2 py-2 text-right">{formatMoney(inv.montantPayeEmploye)}</td>
                    <td className="px-2 py-2 text-right">{formatMoney(inv.partCabinet)}</td>
                    <td className="px-2 py-2"><span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px]">{inv.statut}</span></td>
                    <td className="px-2 py-2">
                      <ActionButton onClick={() => startEdit("invoice", inv.id)} title="Modifier" icon="edit" color="blue" className="mr-1" />
                      {canManage && inv.statut === "brouillon" && (
                        <ActionButton onClick={() => validateInvoice(inv.id)} title="Valider" icon="validate" color="emerald" className="mr-1" />
                      )}
                      {canPay && inv.statut === "validee" && (
                        <ActionButton onClick={() => payInvoice(inv.id)} title="Payer" icon="pay" color="emerald" className="mr-1" />
                      )}
                      {canPay && (
                        <ActionButton onClick={() => startEdit("invoice", inv.id)} title="Uploader" icon="upload" color="cabinet" className="mr-1" />
                      )}
                      <ActionButton onClick={() => toggleStatut("invoice", inv.id, inv.statut)} title={inv.statut === "annulee" ? "Réactiver" : "Annuler"} icon="power" color={inv.statut === "annulee" ? "emerald" : "red"} />
                    </td>
                  </tr>
                ))}
                </PaginatedRows>
              </tbody>
              {(() => {
                const totalPartCabinet = filteredInvoices.reduce((s, inv) => s + inv.partCabinet, 0);
                const bilan = data.totalAvances - totalPartCabinet;
                return (
                  <tfoot className="bg-cabinet-50 text-cabinet-900">
                    <tr className="border-t-2 border-cabinet-300 font-semibold">
                      <td className="px-2 py-2" colSpan={7}>Total part cabinet</td>
                      <td className="px-2 py-2 text-right">{formatMoney(totalPartCabinet)}</td>
                      <td className="px-2 py-2" colSpan={2}></td>
                    </tr>
                    <tr className="border-t border-cabinet-100 font-semibold">
                      <td className="px-2 py-2" colSpan={7}>Avance payée</td>
                      <td className="px-2 py-2 text-right">{formatMoney(data.totalAvances)}</td>
                      <td className="px-2 py-2" colSpan={2}></td>
                    </tr>
                    <tr className="border-t border-cabinet-100 font-semibold">
                      <td className="px-2 py-2" colSpan={7}>Bilan assurance</td>
                      <td className="px-2 py-2 text-right">{formatMoney(bilan)}</td>
                      <td className="px-2 py-2" colSpan={2}>
                        {bilan < 0 && canPay && (
                          <span className="text-red-700">À payer par le cabinet</span>
                        )}
                        {bilan >= 0 && (
                          <span className="text-emerald-700">{bilan > 0 ? "Remboursement assureur" : "Soldé"}</span>
                        )}
                      </td>
                    </tr>
                  </tfoot>
                );
              })()}
            </table>
          </div>

          <div className="card p-4">
            <h3 className="mb-4 font-semibold text-cabinet-900">Part cabinet mensuelle par type de prise en charge</h3>
            {(() => {
              const monthly: Record<string, { total: number; byType: Record<string, number> }> = {};
              const types: string[] = [];
              const colors = ["bg-sky-400", "bg-blue-400", "bg-indigo-400", "bg-violet-400", "bg-fuchsia-400", "bg-rose-400", "bg-amber-400", "bg-emerald-400"];
              for (const inv of filteredInvoices) {
                const month = inv.dateSoins.slice(0, 7);
                if (!monthly[month]) monthly[month] = { total: 0, byType: {} };
                monthly[month].total += inv.partCabinet;
                const type = inv.typeSoin || "Non précisé";
                if (!types.includes(type)) types.push(type);
                if (!monthly[month].byType[type]) monthly[month].byType[type] = 0;
                monthly[month].byType[type] += inv.partCabinet;
              }
              const months = Object.keys(monthly).sort();
              const maxTotal = Math.max(...months.map((m) => monthly[m].total), 1);
              return (
                <div className="space-y-4">
                  {months.map((month) => (
                    <div key={month} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium">{month}</span>
                        <span className="text-cabinet-600">{formatMoney(monthly[month].total)}</span>
                      </div>
                      <div className="h-5 w-full overflow-hidden rounded-full bg-cabinet-100">
                        <div className="flex h-full w-full">
                          {types.filter((t) => (monthly[month].byType[t] || 0) > 0).map((type, i) => {
                            const value = monthly[month].byType[type] || 0;
                            const width = `${(value / maxTotal) * 100}%`;
                            return (
                              <div
                                key={type}
                                title={`${type}: ${formatMoney(value)}`}
                                className={`h-full ${colors[i % colors.length]}`}
                                style={{ width }}
                              />
                            );
                          })}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 text-[10px]">
                        {types.filter((t) => (monthly[month].byType[t] || 0) > 0).map((type, i) => (
                          <span key={type} className="flex items-center gap-1">
                            <span className={`inline-block h-2 w-2 rounded-full ${colors[i % colors.length]}`} />
                            {type} ({formatMoney(monthly[month].byType[type] || 0)})
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                  {months.length === 0 && <p className="text-sm text-gray-500">Aucune donnée.</p>}
                </div>
              );
            })()}
          </div>
          {canWrite && activeForm === "invoice" && (
          <form
            className="card grid grid-cols-3 gap-3 p-4"
            onSubmit={(e) => {
              e.preventDefault();
              const payload = { ...invoiceForm, tauxApplique: invoiceForm.tauxApplique === "" ? undefined : Number(invoiceForm.tauxApplique) };
              submit("invoice", payload);
            }}
          >
            <h2 className="col-span-3 font-semibold">{editId.invoice ? "Modifier facture" : "Nouvelle facture"}</h2>
            <select className="input" value={invoiceForm.insuredEmployeeId} onChange={(e) => setInvoiceForm({ ...invoiceForm, insuredEmployeeId: e.target.value })} required>
              <option value="">Employé assuré</option>
              {data.employees.map((ie) => (
                <option key={ie.id} value={ie.id}>{ie.employee.firstName} {ie.employee.lastName}</option>
              ))}
            </select>
            <select className="input" value={invoiceForm.dependentId} onChange={(e) => setInvoiceForm({ ...invoiceForm, dependentId: e.target.value })}>
              <option value="">Bénéficiaire (optionnel)</option>
              {data.dependents
                .filter((d) => d.employee.id === (data.employees.find((ie) => ie.id === invoiceForm.insuredEmployeeId)?.employee.id))
                .map((d) => (
                  <option key={d.id} value={d.id}>{d.prenom} {d.nom}</option>
                ))}
            </select>
            <select className="input" value={invoiceForm.contractId} onChange={(e) => setInvoiceForm({ ...invoiceForm, contractId: e.target.value })} required>
              <option value="">Contrat</option>
              {data.contracts
                .filter((c) => c.statut === "actif" || c.id === invoiceForm.contractId)
                .map((c) => (
                  <option key={c.id} value={c.id}>{c.reference}</option>
                ))}
            </select>
            <select className="input" value={invoiceForm.providerId} onChange={(e) => setInvoiceForm({ ...invoiceForm, providerId: e.target.value })} required>
              <option value="">Prestataire</option>
              {data.providers.map((p) => (
                <option key={p.id} value={p.id}>{p.nom}</option>
              ))}
            </select>
            <input className="input" placeholder="N° facture" value={invoiceForm.numeroFacture} onChange={(e) => setInvoiceForm({ ...invoiceForm, numeroFacture: e.target.value })} />
            <input className="input" type="date" value={invoiceForm.dateSoins} onChange={(e) => setInvoiceForm({ ...invoiceForm, dateSoins: e.target.value })} required />
            <input className="input" type="date" value={invoiceForm.dateFacture} onChange={(e) => setInvoiceForm({ ...invoiceForm, dateFacture: e.target.value })} required />
            <input className="input" placeholder="Type de soin" value={invoiceForm.typeSoin} onChange={(e) => setInvoiceForm({ ...invoiceForm, typeSoin: e.target.value })} required />
            <input className="input" type="number" placeholder="Montant total" value={invoiceForm.montantTotal} onChange={(e) => setInvoiceForm({ ...invoiceForm, montantTotal: Number(e.target.value) })} required />
            <input className="input" type="number" step="0.01" placeholder="Taux appliqué (%)" value={invoiceForm.tauxApplique} onChange={(e) => setInvoiceForm({ ...invoiceForm, tauxApplique: e.target.value })} />
            <input className="input" placeholder="Commentaire" value={invoiceForm.commentaire} onChange={(e) => setInvoiceForm({ ...invoiceForm, commentaire: e.target.value })} />
            <input className="input" placeholder="Justificatif (chemin)" value={invoiceForm.justificatifPath} onChange={(e) => setInvoiceForm({ ...invoiceForm, justificatifPath: e.target.value })} />
            <input className="input" placeholder="Facture assureur (chemin)" value={invoiceForm.factureAssureurPath} onChange={(e) => setInvoiceForm({ ...invoiceForm, factureAssureurPath: e.target.value })} />
            <input className="input" placeholder="Chèque (chemin)" value={invoiceForm.chequePath} onChange={(e) => setInvoiceForm({ ...invoiceForm, chequePath: e.target.value })} />
            <div className="col-span-3 flex gap-2">
              <button className="rounded-lg bg-emerald-500 px-4 py-2 text-white" disabled={loading} type="submit">{editId.invoice ? "Modifier" : "Enregistrer"}</button>
              {editId.invoice && <button type="button" onClick={() => cancel("invoice")} className="rounded-lg bg-gray-300 px-4 py-2 text-gray-700">Annuler</button>}
            </div>
          </form>
          )}
        </div>
      )}

      {tab === "totaux" && (
        <div className="space-y-6">
          <div className="card overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-cabinet-100 text-cabinet-900">
                <tr>
                  {sortTh("totals", "employe", "Employé", "px-4 py-3")}
                  {sortTh("totals", "nombre", "Nombre", "px-4 py-3 text-right")}
                  {sortTh("totals", "total", "Total factures", "px-4 py-3 text-right")}
                  {sortTh("totals", "partEmploye", "Part employé", "px-4 py-3 text-right")}
                  {sortTh("totals", "partCabinet", "Part cabinet", "px-4 py-3 text-right")}
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.totalsByEmployee.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-500">Aucun total.</td></tr>
                )}
                <PaginatedRows colSpan={6}>
                {sortRows("totals", data.totalsByEmployee, {
                  employe: (t) => t.nom,
                  nombre: (t) => t.count,
                  total: (t) => t.total,
                  partEmploye: (t) => t.partEmploye,
                  partCabinet: (t) => t.partCabinet,
                }).map((t) => (
                  <tr key={t.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{t.nom}</td>
                    <td className="px-4 py-3 text-right">{t.count}</td>
                    <td className="px-4 py-3 text-right">{formatMoney(t.total)}</td>
                    <td className="px-4 py-3 text-right">{formatMoney(t.partEmploye)}</td>
                    <td className="px-4 py-3 text-right">{formatMoney(t.partCabinet)}</td>
                    <td className="px-4 py-3">
                      <ActionButton
                        onClick={() => window.open(`/cabinet/personnel/assurances/bilan-employe?employe=${t.id}`, "_blank")}
                        title="Bilan employé (imprimer)"
                        icon="print"
                        color="cabinet"
                      />
                    </td>
                  </tr>
                ))}
                </PaginatedRows>
              </tbody>
            </table>
          </div>

          <div className="card p-4">
            <h3 className="mb-4 font-semibold text-cabinet-900">Utilisation mensuelle par employé</h3>
            {(() => {
              const monthly: Record<string, { total: number; byEmployee: Record<string, number> }> = {};
              const employeeNames: string[] = [];
              const colors = ["bg-cabinet-400", "bg-teal-400", "bg-cyan-400", "bg-lime-400", "bg-fuchsia-400", "bg-rose-400", "bg-violet-400", "bg-indigo-400"];
              for (const inv of data.invoices) {
                const month = inv.dateSoins.slice(0, 7);
                if (!monthly[month]) monthly[month] = { total: 0, byEmployee: {} };
                monthly[month].total += inv.partCabinet;
                const name = `${inv.insuredEmployee.employee.firstName} ${inv.insuredEmployee.employee.lastName}`;
                if (!employeeNames.includes(name)) employeeNames.push(name);
                if (!monthly[month].byEmployee[name]) monthly[month].byEmployee[name] = 0;
                monthly[month].byEmployee[name] += inv.partCabinet;
              }
              const months = Object.keys(monthly).sort();
              const maxTotal = Math.max(...months.map((m) => monthly[m].total), 1);
              return (
                <div className="space-y-4">
                  {employeeNames.map((name, empIndex) => (
                    <div key={name} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium">{name}</span>
                        <span className="text-cabinet-600">{formatMoney(months.reduce((s, m) => s + (monthly[m].byEmployee[name] || 0), 0))}</span>
                      </div>
                      <div className="h-5 w-full overflow-hidden rounded-full bg-cabinet-100">
                        <div className="flex h-full w-full">
                          {months.map((month, i) => {
                            const value = monthly[month].byEmployee[name] || 0;
                            const width = `${(value / maxTotal) * 100}%`;
                            return (
                              <div
                                key={month}
                                title={`${month}: ${formatMoney(value)}`}
                                className={`h-full ${colors[i % colors.length]}`}
                                style={{ width }}
                              />
                            );
                          })}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 text-[10px]">
                        {months.map((month, i) => (
                          <span key={month} className="flex items-center gap-1">
                            <span className={`inline-block h-2 w-2 rounded-full ${colors[i % colors.length]}`} />
                            {month} ({formatMoney(monthly[month].byEmployee[name] || 0)})
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                  {employeeNames.length === 0 && <p className="text-sm text-gray-500">Aucune donnée.</p>}
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
