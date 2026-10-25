"use client";

export function PrintButton({ label = "Imprimer" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-lg bg-cabinet-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-cabinet-800"
    >
      {label}
    </button>
  );
}
