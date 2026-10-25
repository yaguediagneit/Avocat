"use client";

import {
  Children,
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
  useMemo,
  useState,
} from "react";

const DEFAULT_PAGE_SIZE = 5;

function pageNumbers(page: number, pageCount: number): number[] {
  const span = 7;
  if (pageCount <= span) return Array.from({ length: pageCount }, (_, i) => i + 1);
  let start = Math.max(1, page - 3);
  const end = Math.min(pageCount, start + span - 1);
  start = Math.max(1, end - span + 1);
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

function Pager({
  page,
  pageCount,
  total,
  onChange,
}: {
  page: number;
  pageCount: number;
  total: number;
  onChange: (p: number) => void;
}) {
  const numbers = useMemo(() => pageNumbers(page, pageCount), [page, pageCount]);
  const btn = "rounded border border-gray-200 px-2 py-0.5 text-xs transition disabled:opacity-40";
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
      <span>
        {total} entrée{total > 1 ? "s" : ""} — page {page}/{pageCount}
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          className={`${btn} hover:bg-gray-100`}
          aria-label="Page précédente"
        >
          ‹ Préc.
        </button>
        {numbers.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`${btn} ${n === page ? "border-cabinet-600 bg-cabinet-600 text-white" : "hover:bg-gray-100"}`}
          >
            {n}
          </button>
        ))}
        <button
          type="button"
          disabled={page >= pageCount}
          onClick={() => onChange(page + 1)}
          className={`${btn} hover:bg-gray-100`}
          aria-label="Page suivante"
        >
          Suiv. ›
        </button>
      </div>
    </div>
  );
}

/**
 * Rend les éléments hors page masqués (hidden) mais restaurés à l'impression
 * via la classe print `printDisplay` (ex. "print:table-row" pour un <tr>).
 * Si un enfant n'est pas un élément DOM clonable (Fragment…), repli sur
 * l'affichage de la page courante seulement.
 */
function pagedItems(
  children: ReactNode,
  page: number,
  pageSize: number,
  printDisplay: string,
): { items: ReactNode[]; total: number; pageCount: number; page: number } {
  const items = Children.toArray(children);
  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const p = Math.min(Math.max(1, page), pageCount);
  const start = (p - 1) * pageSize;
  const end = p * pageSize;
  const allDom = items.every(
    (it) => isValidElement(it) && typeof it.type === "string",
  );
  if (!allDom) {
    return { items: items.slice(start, end), total, pageCount, page: p };
  }
  const mapped = items.map((it, i) => {
    if (i >= start && i < end) return it;
    const el = it as ReactElement<{ className?: string }>;
    return cloneElement(el, {
      className: `${el.props.className || ""} hidden ${printDisplay}`.trim(),
    });
  });
  return { items: mapped, total, pageCount, page: p };
}

function usePage() {
  const [page, setPage] = useState(1);
  return { page, setPage };
}

/** Pagination à insérer dans un <tbody> autour des lignes .map(). */
export function PaginatedRows({
  children,
  colSpan,
  pageSize = DEFAULT_PAGE_SIZE,
}: {
  children: ReactNode;
  colSpan: number;
  pageSize?: number;
}) {
  const { page, setPage } = usePage();
  const { items, total, pageCount, page: p } = pagedItems(
    children,
    page,
    pageSize,
    "print:table-row",
  );
  return (
    <>
      {items}
      {pageCount > 1 && (
        <tr className="border-t border-gray-100 bg-gray-50/60 print:hidden">
          <td colSpan={colSpan} className="px-2 py-1.5">
            <Pager page={p} pageCount={pageCount} total={total} onChange={setPage} />
          </td>
        </tr>
      )}
    </>
  );
}

/** Pagination à insérer dans un <ul> autour des <li> .map(). */
export function PaginatedUl({
  children,
  pageSize = DEFAULT_PAGE_SIZE,
}: {
  children: ReactNode;
  pageSize?: number;
}) {
  const { page, setPage } = usePage();
  const { items, total, pageCount, page: p } = pagedItems(
    children,
    page,
    pageSize,
    "print:list-item",
  );
  return (
    <>
      {items}
      {pageCount > 1 && (
        <li className="bg-gray-50/60 px-3 py-1.5 print:hidden">
          <Pager page={p} pageCount={pageCount} total={total} onChange={setPage} />
        </li>
      )}
    </>
  );
}

/** Pagination pour les listes hors tableau (cartes, blocs). */
export function PaginatedList({
  children,
  pageSize = DEFAULT_PAGE_SIZE,
  pagerClassName = "",
}: {
  children: ReactNode;
  pageSize?: number;
  pagerClassName?: string;
}) {
  const { page, setPage } = usePage();
  const { items, total, pageCount, page: p } = pagedItems(
    children,
    page,
    pageSize,
    "print:block",
  );
  return (
    <>
      {items}
      {pageCount > 1 && (
        <div
          className={`rounded-lg border border-gray-100 bg-gray-50/60 px-3 py-1.5 print:hidden ${pagerClassName}`.trim()}
        >
          <Pager page={p} pageCount={pageCount} total={total} onChange={setPage} />
        </div>
      )}
    </>
  );
}
