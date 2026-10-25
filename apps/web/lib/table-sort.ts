export type SortValue = string | number | Date | null | undefined;
export type SortSpec = { key: string; dir: 1 | -1 };
export type SortGetters<T> = Record<string, (row: T) => SortValue>;

const collator = new Intl.Collator("fr", { numeric: true, sensitivity: "base" });

export function sortRows<T>(rows: T[], spec: SortSpec | null | undefined, getters: SortGetters<T>): T[] {
  if (!spec) return rows;
  const get = getters[spec.key];
  if (!get) return rows;
  return [...rows].sort((a, b) => {
    const va = get(a);
    const vb = get(b);
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    const na = va instanceof Date ? va.getTime() : va;
    const nb = vb instanceof Date ? vb.getTime() : vb;
    const cmp =
      typeof na === "number" && typeof nb === "number"
        ? na - nb
        : collator.compare(String(na), String(nb));
    return cmp * spec.dir;
  });
}

export function getSortSpec(
  searchParams: Record<string, string | string[] | undefined>
): SortSpec | null {
  const key = typeof searchParams.sort === "string" ? searchParams.sort : "";
  if (!key) return null;
  return { key, dir: searchParams.dir === "desc" ? -1 : 1 };
}
