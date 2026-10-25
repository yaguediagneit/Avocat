"use client";

import { useState } from "react";
import { sortRows, type SortGetters, type SortSpec } from "@/lib/table-sort";
import { SortIcon } from "@/components/sort-icon";

export function useTableSort() {
  const [sorts, setSorts] = useState<Record<string, SortSpec>>({});

  function toggle(table: string, key: string) {
    setSorts((prev) => ({
      ...prev,
      [table]: {
        key,
        dir: prev[table]?.key === key && prev[table].dir === 1 ? -1 : 1,
      },
    }));
  }

  function sorted<T>(table: string, rows: T[], getters: SortGetters<T>): T[] {
    return sortRows(rows, sorts[table], getters);
  }

  function th(table: string, key: string, label: React.ReactNode, className?: string) {
    const s = sorts[table];
    return (
      <SortTh
        spec={s?.key === key ? s : null}
        onToggle={() => toggle(table, key)}
        className={className}
        label={label}
      />
    );
  }

  return { th, sorted, sorts };
}

export function SortTh({
  spec,
  onToggle,
  label,
  className,
}: {
  spec: SortSpec | null | undefined;
  onToggle: () => void;
  label: React.ReactNode;
  className?: string;
}) {
  const active = spec?.key != null;
  return (
    <th className={className}>
      <button
        type="button"
        onClick={onToggle}
        title={`Trier par ${typeof label === "string" ? label : "colonne"}`}
        className="inline-flex items-center gap-1 transition hover:text-cabinet-600"
      >
        {label}
        <SortIcon active={active} dir={spec?.dir} />
      </button>
    </th>
  );
}
