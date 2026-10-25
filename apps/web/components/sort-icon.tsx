export function SortIcon({ active, dir }: { active: boolean; dir?: 1 | -1 }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`h-3 w-3 ${active ? "" : "opacity-30"}`}
      aria-hidden
    >
      {active ? (
        dir === -1 ? (
          <path d="M6 9l6 6 6-6" />
        ) : (
          <path d="M6 15l6-6 6 6" />
        )
      ) : (
        <>
          <path d="M8 9l4-4 4 4" />
          <path d="M8 15l4 4 4-4" />
        </>
      )}
    </svg>
  );
}
