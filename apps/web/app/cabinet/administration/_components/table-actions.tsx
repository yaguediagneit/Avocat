"use client";

function EyeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function PrinterIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <polyline points="6 9 6 2 18 2 18 9" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect x="6" y="14" width="12" height="8" rx="1" />
    </svg>
  );
}

function PowerIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
      <line x1="12" y1="2" x2="12" y2="12" />
    </svg>
  );
}

export interface TableActionsProps {
  isActive: boolean;
  onView: () => void;
  onPrint?: () => void;
  onToggle: () => void;
  onEdit?: () => void;
}

export function TableActions({ isActive, onView, onPrint, onToggle, onEdit }: TableActionsProps) {
  return (
    <div className="flex items-center gap-2">
      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          className="text-cabinet-700 hover:text-cabinet-900"
          aria-label="Modifier"
          title="Modifier"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
            aria-hidden="true"
          >
            <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.928a1 1 0 0 0 1.226 1.226l4.928-1.321a2 2 0 0 0 .83-.497z" />
            <path d="m15 5 4 4" />
          </svg>
        </button>
      )}
      <button
        type="button"
        onClick={onView}
        className="text-cabinet-700 hover:text-cabinet-900"
        aria-label="Visualiser"
        title="Visualiser"
      >
        <EyeIcon />
      </button>
      {onPrint && (
        <button
          type="button"
          onClick={onPrint}
          className="text-cabinet-700 hover:text-cabinet-900"
          aria-label="Imprimer"
          title="Imprimer"
        >
          <PrinterIcon />
        </button>
      )}
      <button
        type="button"
        onClick={onToggle}
        className={isActive ? "text-red-600 hover:text-red-800" : "text-green-600 hover:text-green-800"}
        aria-label={isActive ? "Désactiver" : "Activer"}
        title={isActive ? "Désactiver" : "Activer"}
      >
        <PowerIcon />
      </button>
    </div>
  );
}
