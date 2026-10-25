"use client";

import { Children, useRef, useState } from "react";

interface ParametrageSection {
  id: string;
  label: string;
  icon: string;
  couleur?: string;
}

interface ParametrageTabsProps {
  sections: ParametrageSection[];
  children: React.ReactNode;
}

function SectionIcon({ path }: { path: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={path} />
    </svg>
  );
}

export const sectionIcons: Record<string, string> = {
  cabinet:
    "M3 21h18M5 21V7l8-4 8 4v14M9 21v-6h6v6",
  specialites:
    "M12 2l2.4 7.2h7.6l-6 4.8 2.4 7.2-6-4.8-6 4.8 2.4-7.2-6-4.8h7.6z",
  taches:
    "M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11",
  roles:
    "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  utilisateurs:
    "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75",
  parametres:
    "M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.9 1.9 0 00.5 1.7l.1.1a1.9 1.9 0 01-2.7 2.7l-.1-.1a1.9 1.9 0 00-1.7-.5 1.9 1.9 0 00-1.1 1.1 1.9 1.9 0 01-3.7 0 1.9 1.9 0 00-1.1-1.1 1.9 1.9 0 00-1.7.5l-.1.1a1.9 1.9 0 01-2.7-2.7l.1-.1a1.9 1.9 0 00.5-1.7 1.9 1.9 0 00-1.1-1.1 1.9 1.9 0 010-3.7 1.9 1.9 0 001.1-1.1 1.9 1.9 0 00-.5-1.7l-.1-.1a1.9 1.9 0 012.7-2.7l.1.1a1.9 1.9 0 001.7.5 1.9 1.9 0 001.1-1.1 1.9 1.9 0 013.7 0 1.9 1.9 0 001.1 1.1 1.9 1.9 0 001.7-.5l.1-.1a1.9 1.9 0 012.7 2.7l-.1.1a1.9 1.9 0 00-.5 1.7 1.9 1.9 0 001.1 1.1 1.9 1.9 0 010 3.7z",
  comptabilite:
    "M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6",
  audit:
    "M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8",
};

/**
 * Navigation « classeur » : chaque onglet horizontal est une feuille
 * qui affiche la section correspondante au clic.
 * Les panneaux restent montés (hidden) pour préserver l'état des formulaires.
 */
export function ParametrageTabs({ sections, children }: ParametrageTabsProps) {
  const [activeId, setActiveId] = useState<string>(sections[0]?.id || "");
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const panels = Children.toArray(children);

  function focusTab(index: number) {
    const next = (index + sections.length) % sections.length;
    setActiveId(sections[next].id);
    tabRefs.current[next]?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent, index: number) {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      focusTab(index + 1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      focusTab(index - 1);
    } else if (e.key === "Home") {
      e.preventDefault();
      focusTab(0);
    } else if (e.key === "End") {
      e.preventDefault();
      focusTab(sections.length - 1);
    }
  }

  return (
    <div>
      {/* Rangée de feuilles du classeur */}
      <div className="no-scrollbar overflow-x-auto print:hidden">
        <div
          role="tablist"
          aria-label="Sections du paramétrage"
          className="flex min-w-max items-end gap-1 px-3"
        >
          {sections.map((section, index) => {
            const isActive = section.id === activeId;
            const couleur = section.couleur || "#C9A96A";
            return (
              <button
                key={section.id}
                ref={(el) => {
                  tabRefs.current[index] = el;
                }}
                type="button"
                role="tab"
                id={`param-tab-${section.id}`}
                aria-selected={isActive}
                aria-controls={`param-panel-${section.id}`}
                tabIndex={isActive ? 0 : -1}
                onClick={() => setActiveId(section.id)}
                onKeyDown={(e) => handleKeyDown(e, index)}
                style={
                  isActive
                    ? { borderColor: couleur, borderBottomColor: "transparent" }
                    : { backgroundColor: `${couleur}14` }
                }
                className={`
                  group relative flex items-center gap-1.5 whitespace-nowrap rounded-t-xl px-2.5 py-2 text-xs transition-all duration-200
                  ${
                    isActive
                      ? "z-10 -mb-px border border-b-transparent bg-white pb-2.5 font-bold text-cabinet-900 shadow-[0_-6px_16px_-8px_rgba(15,27,46,0.25)]"
                      : "mb-0.5 border border-transparent py-1.5 font-medium text-cabinet-600 hover:text-cabinet-800"
                  }
                `}
              >
                <span
                  className="transition-colors"
                  style={{ color: couleur }}
                >
                  <SectionIcon path={section.icon} />
                </span>
                {section.label}
                <span
                  className={`absolute inset-x-3 top-0 rounded-full ${isActive ? "h-0.5" : "h-0.5 opacity-40"}`}
                  style={{ backgroundColor: couleur }}
                  aria-hidden="true"
                />
              </button>
            );
          })}
        </div>
      </div>

      {/* Feuille de contenu du classeur */}
      <div className="relative rounded-b-2xl rounded-tr-2xl border border-cabinet-200/80 bg-white p-4 shadow-sm sm:p-6">
        {sections.map((section, index) => {
          const isActive = section.id === activeId;
          return (
            <div
              key={section.id}
              role="tabpanel"
              id={`param-panel-${section.id}`}
              aria-labelledby={`param-tab-${section.id}`}
              hidden={!isActive}
              className={isActive ? "animate-[fadeIn_0.3s_ease]" : undefined}
            >
              {panels[index]}
            </div>
          );
        })}
      </div>
    </div>
  );
}
