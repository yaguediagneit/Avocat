"use client";

import { useEffect, useState } from "react";

interface Parametre {
  code: string;
  libelle: string;
  ordre: number;
}

interface ParametreSelectProps {
  categorie: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
}

export function ParametreSelect({
  categorie,
  value,
  onChange,
  placeholder = "Sélectionner",
  className = "input",
  required,
}: ParametreSelectProps) {
  const [options, setOptions] = useState<Parametre[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/parametres?categorie=${encodeURIComponent(categorie)}&actif=true`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: Parametre[]) => {
        if (!cancelled)
          setOptions(
            data.sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0) || a.libelle.localeCompare(b.libelle))
          );
      })
      .catch((err) => {
        console.error("Failed to load parametres", err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [categorie]);

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={className}
      disabled={loading}
      required={required}
    >
      <option value="">{loading ? "Chargement..." : placeholder}</option>
      {options.map((o) => (
        <option key={o.code} value={o.code}>
          {o.libelle}
        </option>
      ))}
    </select>
  );
}
