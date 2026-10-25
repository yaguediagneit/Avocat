"use client";

import { useEffect, useState } from "react";
import PaymentsSection from "./payments-section";

interface CabinetInfo {
  raisonSociale: string;
  adresse: string;
  telephonePrincipal: string;
  email: string;
  logoUrl?: string;
  pdfTheme?: {
    primaryColor: string;
    secondaryColor: string;
    fontFamily: string;
    fontSize: number;
    headerText: string;
    footerText: string;
  };
}

export function VersementsButton({ cabinet }: { cabinet: CabinetInfo }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg bg-teal-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-teal-600"
      >
        Versements sociaux et fiscaux
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="relative max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-xl bg-gray-50 p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Fermer"
              className="absolute right-7 top-7 z-10 flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 shadow-sm transition hover:bg-gray-100 hover:text-gray-900"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
            <PaymentsSection cabinet={cabinet} />
          </div>
        </div>
      )}
    </>
  );
}
