import Link from "next/link";
import { SortIcon } from "@/components/sort-icon";

export function SortableTh({
  column,
  label,
  className,
  path,
  params,
}: {
  column: string;
  label: React.ReactNode;
  className?: string;
  path: string;
  params: Record<string, string | string[] | undefined>;
}) {
  const active = params.sort === column;
  const dir = params.dir === "desc" ? -1 : 1;
  const next = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (k === "sort" || k === "dir") continue;
    if (typeof v === "string" && v) next.set(k, v);
  }
  next.set("sort", column);
  next.set("dir", active && dir === 1 ? "desc" : "asc");
  return (
    <th className={className}>
      <Link
        href={`${path}?${next.toString()}`}
        scroll={false}
        className="inline-flex items-center gap-1 transition hover:text-cabinet-600"
        title={`Trier par ${typeof label === "string" ? label : column}`}
      >
        {label}
        <SortIcon active={active} dir={dir} />
      </Link>
    </th>
  );
}
