"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

interface SearchInputProps {
  placeholder?: string;
  param?: string;
  label?: string;
  className?: string;
}

export function SearchInput({
  placeholder = "Filtrer...",
  param = "q",
  label = "Recherche",
  className = "",
}: SearchInputProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [value, setValue] = useState(searchParams.get(param) || "");
  const [isPending, startTransition] = useTransition();

  // Resynchronise le champ si l'URL change ailleurs (retour navigateur…).
  useEffect(() => {
    setValue(searchParams.get(param) || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, param]);

  // Debounce : une seule navigation après la frappe au lieu d'une requête
  // serveur par caractère.
  useEffect(() => {
    if (value.trim() === (searchParams.get(param) || "")) return;
    const t = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (value.trim()) {
        params.set(param, value.trim());
      } else {
        params.delete(param);
      }
      startTransition(() => {
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const clear = () => {
    setValue("");
    const params = new URLSearchParams(searchParams.toString());
    params.delete(param);
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  };

  return (
    <div className={className ? `relative ${className}` : "relative"}>
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </span>
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        autoComplete="off"
        className="w-full rounded-md border border-gray-300 py-2 pl-9 pr-8 text-sm text-black outline-none focus:border-cabinet-500 focus:ring-1 focus:ring-cabinet-500"
      />
      {value && !isPending && (
        <button
          type="button"
          onClick={clear}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          aria-label="Effacer"
        >
          ×
        </button>
      )}
      {isPending && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        </span>
      )}
    </div>
  );
}
