"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UploadPayslipButton } from "./upload-payslip-button";

interface PayrollRowActionsProps {
  payroll: {
    id: string;
    status: string;
    signedDocumentUrl: string | null;
    employee: { firstName: string; lastName: string };
  };
  canWrite: boolean;
}

function EditIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
  );
}

function CheckIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
  );
}

function PayIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M9 9h6v6H9z" /><path d="M15 9h.01" /></svg>
  );
}

function XIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
  );
}

function RefreshIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" /><path d="M16 21h5v-5" /></svg>
  );
}

function DownloadIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" x2="12" y1="15" y2="3" /></svg>
  );
}

function PrintIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect width="12" height="8" x="6" y="14" /></svg>
  );
}

export function PayrollRowActions({ payroll, canWrite }: PayrollRowActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const status = payroll.status;

  async function callAction(action: "validate" | "pay" | "cancel" | "activate") {
    setLoading(action);
    setError(null);
    try {
      const body = action === "pay" ? JSON.stringify({ mode: "virement" }) : undefined;
      const res = await fetch(`/api/personnel/payrolls/${payroll.id}/${action}`, {
        method: "PATCH",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(typeof data.error === "string" ? data.error : "Erreur");
        return;
      }

      router.refresh();
    } catch (e) {
      setError("Erreur réseau");
    } finally {
      setLoading(null);
    }
  }

  const isPaid = status === "paid";
  const isCancelled = status === "cancelled";
  const isDraft = status === "draft";
  const isValidated = status === "validated";

  return (
    <div className="flex flex-nowrap items-center justify-end gap-1">
      {error && <span className="text-[10px] text-red-600">{error}</span>}

      {canWrite && (
        <>
          <Link
            href={`/cabinet/personnel/paie/${payroll.id}/modifier`}
            className="rounded-md bg-amber-100 p-1 text-amber-700 transition hover:bg-amber-200 disabled:opacity-50"
            title="Modifier"
          >
            <EditIcon />
          </Link>

          <button
            type="button"
            onClick={() => callAction("validate")}
            disabled={!!loading || !isDraft}
            className="rounded-md bg-emerald-100 p-1 text-emerald-700 transition hover:bg-emerald-200 disabled:opacity-50"
            title={isValidated ? "Déjà validé" : isPaid ? "Déjà payé" : isCancelled ? "Annulé" : "Valider"}
          >
            {loading === "validate" ? "..." : <CheckIcon />}
          </button>

          <button
            type="button"
            onClick={() => callAction("pay")}
            disabled={!!loading || !isValidated}
            className="rounded-md bg-blue-100 p-1 text-blue-700 transition hover:bg-blue-200 disabled:opacity-50"
            title={isPaid ? "Déjà payé" : isCancelled ? "Annulé" : isDraft ? "Valider d'abord" : "Payer"}
          >
            {loading === "pay" ? "..." : <PayIcon />}
          </button>

          {isCancelled ? (
            <button
              type="button"
              onClick={() => callAction("activate")}
              disabled={!!loading}
              className="rounded-md bg-emerald-100 p-1 text-emerald-700 transition hover:bg-emerald-200 disabled:opacity-50"
              title="Activer"
            >
              {loading === "activate" ? "..." : <RefreshIcon />}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => callAction("cancel")}
              disabled={!!loading || isPaid}
              className="rounded-md bg-red-100 p-1 text-red-700 transition hover:bg-red-200 disabled:opacity-50"
              title={isPaid ? "Impossible : déjà payé" : "Désactiver"}
            >
              {loading === "cancel" ? "..." : <XIcon />}
            </button>
          )}

          {!isDraft && (
            <UploadPayslipButton payrollId={payroll.id} hasDocument={!!payroll.signedDocumentUrl} />
          )}
        </>
      )}

      {payroll.signedDocumentUrl && (
        <Link
          href={`/api/personnel/payrolls/${payroll.id}/download`}
          target="_blank"
          className="rounded-md bg-cabinet-100 p-1 text-cabinet-700 transition hover:bg-cabinet-200"
          title="Télécharger"
        >
          <DownloadIcon />
        </Link>
      )}

      <Link
        href={`/cabinet/personnel/paie/${payroll.id}/imprimer`}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-md bg-cabinet-100 p-1 text-cabinet-700 transition hover:bg-cabinet-200"
        title="Imprimer"
      >
        <PrintIcon />
      </Link>
    </div>
  );
}
