"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export interface SearchResult {
  id: string;
  type: string;
  title: string;
  subtitle: string;
  href: string;
  dossierId?: string;
}

export interface SearchResponse {
  clients: SearchResult[];
  dossiers: SearchResult[];
  documents: SearchResult[];
  taches: SearchResult[];
  missions: SearchResult[];
  factures: SearchResult[];
  charges: SearchResult[];
  users: SearchResult[];
  evenements: SearchResult[];
  employes: SearchResult[];
  conges: SearchResult[];
  contrats: SearchResult[];
  paie: SearchResult[];
  assurances: SearchResult[];
  courrier: SearchResult[];
  audiences: SearchResult[];
  demandes: SearchResult[];
  pieces: SearchResult[];
  formalites: SearchResult[];
  prestataires: SearchResult[];
  ecritures: SearchResult[];
  comptes: SearchResult[];
  parametres: SearchResult[];
}

interface SearchCommandProps {
  apiUrl: string;
  label?: string;
  /** "dark" = déclencheur sur fond sombre (défaut) ; "light" = sur topbar claire. */
  tone?: "dark" | "light";
}

const GROUP_ORDER = [
  "dossiers",
  "clients",
  "documents",
  "taches",
  "missions",
  "evenements",
  "factures",
  "charges",
  "employes",
  "conges",
  "contrats",
  "paie",
  "assurances",
  "courrier",
  "audiences",
  "demandes",
  "pieces",
  "formalites",
  "prestataires",
  "ecritures",
  "comptes",
  "users",
  "parametres",
];

const GROUP_LABELS: Record<string, string> = {
  clients: "Clients",
  dossiers: "Dossiers",
  documents: "Documents",
  taches: "Tâches",
  missions: "Missions",
  factures: "Factures",
  charges: "Charges",
  users: "Utilisateurs",
  evenements: "Événements",
  employes: "Employés",
  conges: "Congés",
  contrats: "Contrats de travail",
  paie: "Bulletins de paie",
  assurances: "Assurances",
  courrier: "Courrier",
  audiences: "Audiences & réunions",
  demandes: "Demandes & appels",
  pieces: "Pièces manquantes",
  formalites: "Formalités tribunaux",
  prestataires: "Missions prestataires",
  ecritures: "Écritures comptables",
  comptes: "Comptes comptables",
  parametres: "Paramètres",
};

function useDebounce<T>(value: T, delay = 200) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export function SearchCommand({ apiUrl, label = "Recherche", tone = "dark" }: SearchCommandProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 250);
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const allItems: SearchResult[] = useMemo(() => {
    if (!results) return [];
    const items: SearchResult[] = [];
    for (const type of GROUP_ORDER) {
      items.push(...(results[type as keyof SearchResponse] || []));
    }
    return items;
  }, [results]);

  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults(null);
      setError("");
      setSelectedIndex(0);
      return;
    }
    inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [allItems]);

  useEffect(() => {
    if (!open) return;
    if (debouncedQuery.trim().length < 2) {
      setResults(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError("");

    fetch(`${apiUrl}?q=${encodeURIComponent(debouncedQuery)}&limit=20`)
      .then((res) => {
        if (!res.ok) throw new Error("Erreur réseau");
        return res.json();
      })
      .then((data: SearchResponse) => {
        if (!cancelled) setResults(data);
      })
      .catch(() => {
        if (!cancelled) setError("La recherche a échoué.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, open, apiUrl]);

  const onKeyDownList = useCallback(
    (e: React.KeyboardEvent) => {
      if (allItems.length === 0) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => (i + 1) % allItems.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => (i - 1 + allItems.length) % allItems.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        const item = allItems[selectedIndex];
        if (item) {
          window.location.href = item.href;
          setOpen(false);
        }
      }
    },
    [allItems, selectedIndex]
  );

  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`);
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  useEffect(() => {
    if (open) {
      setOpen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const hasResults = allItems.length > 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          tone === "light"
            ? "hidden w-56 items-center gap-2 rounded-lg border border-cabinet-200 bg-cabinet-50/60 px-3 py-1.5 text-xs text-cabinet-500 transition hover:border-cabinet-300 hover:bg-white md:flex"
            : "hidden items-center gap-2 rounded-md bg-white/10 px-3 py-1.5 text-sm text-white transition hover:bg-white/20 sm:flex"
        }
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <span className={tone === "light" ? "truncate" : "hidden lg:inline"}>{label}</span>
        <span
          className={
            tone === "light"
              ? "ml-auto rounded border border-cabinet-200 bg-white px-1.5 text-[10px] text-cabinet-400"
              : "ml-2 hidden rounded border border-white/20 px-1.5 text-xs text-cabinet-200 lg:inline"
          }
        >
          Ctrl+K
        </span>
      </button>

      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          tone === "light"
            ? "rounded-md p-2 text-cabinet-500 hover:bg-cabinet-100 md:hidden"
            : "rounded-md p-2 text-white hover:bg-white/10 sm:hidden"
        }
        aria-label={label}
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-20"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            className="w-full max-w-2xl overflow-hidden rounded-lg bg-white shadow-2xl"
            onKeyDown={onKeyDownList}
          >
            <div className="flex items-center border-b px-4 py-3">
              <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher dans toute l'application : dossiers, clients, employés, écritures, courrier, audiences..."
                className="ml-3 w-full text-base text-black outline-none placeholder:text-gray-400"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="ml-2 text-xs text-gray-400 hover:text-gray-600"
                >
                  Effacer
                </button>
              )}
            </div>

            <div ref={listRef} className="max-h-[60vh] overflow-y-auto">
              {loading && (
                <div className="px-4 py-6 text-center text-sm text-gray-500">Recherche en cours...</div>
              )}

              {!loading && query.trim().length < 2 && (
                <div className="px-4 py-6 text-center text-sm text-gray-500">
                  Saisissez au moins 2 caractères.
                </div>
              )}

              {!loading && error && (
                <div className="px-4 py-6 text-center text-sm text-red-600">{error}</div>
              )}

              {!loading && !error && query.trim().length >= 2 && !hasResults && (
                <div className="px-4 py-6 text-center text-sm text-gray-500">Aucun résultat.</div>
              )}

              {hasResults &&
                GROUP_ORDER.map((type, groupIndex) => {
                  const groupItems = results![type as keyof SearchResponse] || [];
                  if (groupItems.length === 0) return null;
                  const offset = GROUP_ORDER.slice(0, groupIndex).reduce(
                    (sum, t) => sum + ((results![t as keyof SearchResponse] || []) as SearchResult[]).length,
                    0
                  );
                  return (
                    <div key={type}>
                      <div className="bg-gray-50 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                        {GROUP_LABELS[type]}
                      </div>
                      {groupItems.map((item, i) => {
                        const index = offset + i;
                        const selected = index === selectedIndex;
                        return (
                          <Link
                            key={`${item.type}-${item.id}`}
                            href={item.href}
                            data-index={index}
                            onClick={() => setOpen(false)}
                            onMouseEnter={() => setSelectedIndex(index)}
                            className={`block px-4 py-3 transition ${
                              selected ? "bg-cabinet-50" : "hover:bg-gray-50"
                            }`}
                          >
                            <div className="font-medium text-cabinet-900">{item.title}</div>
                            <div className="text-sm text-gray-500">{item.subtitle}</div>
                          </Link>
                        );
                      })}
                    </div>
                  );
                })}
            </div>

            <div className="flex items-center justify-between border-t bg-gray-50 px-4 py-2 text-xs text-gray-500">
              <div>
                <span className="font-semibold">↑</span> <span className="font-semibold">↓</span> naviguer
              </div>
              <div className="hidden sm:block">
                <span className="font-semibold">↵</span> ouvrir
              </div>
              <div>
                <span className="font-semibold">Esc</span> fermer
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
