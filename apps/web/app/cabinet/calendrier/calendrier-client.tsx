"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendrierModal } from "./evenement-modal";

export type CalendarEvent = {
  id: string;
  kind?: "evenement" | "tache";
  type: string;
  statut?: string | null;
  priorite?: string | null;
  titre: string;
  dateDebut: string;
  dateFin: string | null;
  lieu: string | null;
  dossierId: string | null;
  dossier: { referenceInterne: string } | null;
  estPublicClient: boolean;
  nbCommentaires?: number;
};

type View = "jour" | "semaine" | "mois";

type ProcessedEvent = CalendarEvent & {
  start: Date;
  end: Date | null;
};

const WEEKDAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

const TYPE_LABELS: Record<string, string> = {
  audience: "Audience",
  echeance: "Échéance",
  rdv: "Rendez-vous",
  signification: "Signification",
  deadline: "Deadline procédurale",
  journal: "Journal",
  tache: "Tâche",
};

const EVENT_COLORS: Record<string, string> = {
  audience: "bg-cabinet-100 text-cabinet-800 border-cabinet-200",
  echeance: "bg-amber-100 text-amber-700 border-amber-200",
  rdv: "bg-blue-100 text-blue-700 border-blue-200",
  signification: "bg-purple-100 text-purple-700 border-purple-200",
  deadline: "bg-red-100 text-red-700 border-red-200",
  journal: "bg-slate-100 text-slate-700 border-slate-200",
};

const TACHE_PRIORITE_COLORS: Record<string, string> = {
  basse: "bg-gray-100 text-gray-700 border-gray-200",
  moyenne: "bg-cabinet-50 text-cabinet-700 border-cabinet-200",
  haute: "bg-amber-100 text-amber-700 border-amber-200",
  critique: "bg-red-100 text-red-700 border-red-200",
};

function itemColor(item: ProcessedEvent): string {
  if (item.kind === "tache") {
    return TACHE_PRIORITE_COLORS[item.priorite || ""] || "bg-gray-100 text-gray-700 border-gray-200";
  }
  return EVENT_COLORS[item.type] || "bg-gray-100 text-gray-700 border-gray-200";
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function startOfWeek(d: Date): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  const day = c.getDay();
  const diff = c.getDate() - ((day + 6) % 7);
  c.setDate(diff);
  return c;
}

function addDays(d: Date, n: number): Date {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}

function addMonths(d: Date, n: number): Date {
  const c = new Date(d);
  c.setMonth(c.getMonth() + n);
  return c;
}

function addWeeks(d: Date, n: number): Date {
  return addDays(d, n * 7);
}

function formatHour(d: Date): string {
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function monthYearLabel(d: Date): string {
  return d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

function weekLabel(start: Date): string {
  const end = addDays(start, 6);
  const s = start.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  const e = end.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
  return `${s} - ${e}`;
}

function EventPill({
  e,
  compact = false,
  onSelect,
}: {
  e: ProcessedEvent;
  compact?: boolean;
  onSelect: (id: string, kind: "evenement" | "tache") => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(e.id, e.kind || "evenement")}
      className={`block w-full rounded border px-1.5 py-0.5 text-left text-xs hover:opacity-80 ${itemColor(e)} mb-1 truncate`}
      title={`${e.titre}${e.lieu ? ` · ${e.lieu}` : ""}${e.nbCommentaires ? ` · ${e.nbCommentaires} commentaire(s)` : ""}`}
    >
      <span className="flex w-full items-center gap-1">
        <span className="font-medium">{compact ? "" : `${formatHour(e.start)} `}</span>
        <span className="truncate">{e.titre}</span>
        {!!e.nbCommentaires && (
          <span className="ml-auto inline-flex h-4 min-w-[1rem] flex-shrink-0 items-center justify-center rounded-full bg-cabinet-700 px-1 text-[10px] font-medium text-white">
            {e.nbCommentaires}
          </span>
        )}
      </span>
    </button>
  );
}

function MonthView({ days, current, all, onSelect }: { days: Date[]; current: Date; all: ProcessedEvent[]; onSelect: (id: string, kind: "evenement" | "tache") => void }) {
  return (
    <div className="card overflow-hidden rounded-lg border bg-gray-200">
      <div className="grid grid-cols-7 gap-px">
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className="bg-cabinet-100 px-2 py-2 text-center text-sm font-medium text-cabinet-900"
          >
            {d}
          </div>
        ))}
        {days.map((day, i) => {
          const inMonth = day.getMonth() === current.getMonth();
          const isToday = sameDay(day, new Date());
          const dayEvents = all.filter((e) => sameDay(e.start, day));
          return (
            <div
              key={i}
              className={`min-h-[7rem] p-1.5 ${
                inMonth
                  ? isToday
                    ? "bg-emerald-50"
                    : "bg-white"
                  : "bg-gray-50 text-gray-400"
              }`}
            >
              <div className={`mb-1 text-right text-sm font-medium ${inMonth ? "text-gray-900" : ""}`}>
                {day.getDate()}
              </div>
              <div className="space-y-0.5">
                {dayEvents.slice(0, 4).map((e) => (
                  <EventPill key={e.id} e={e} compact onSelect={onSelect} />
                ))}
                {dayEvents.length > 4 && (
                  <div className="pl-1 text-xs text-gray-500">+{dayEvents.length - 4} autres</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeekView({ days, all, onSelect }: { days: Date[]; all: ProcessedEvent[]; onSelect: (id: string, kind: "evenement" | "tache") => void }) {
  return (
    <div className="grid grid-cols-7 gap-2">
      {days.map((day) => {
        const isToday = sameDay(day, new Date());
        const dayEvents = all
          .filter((e) => sameDay(e.start, day))
          .sort((a, b) => a.start.getTime() - b.start.getTime());
        return (
          <div
            key={day.toISOString()}
            className={`card min-h-[16rem] p-2 ${isToday ? "bg-emerald-50" : ""}`}
          >
            <div className="mb-2 border-b pb-1 text-center text-sm font-semibold text-cabinet-900">
              {day.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric" })}
            </div>
            <div className="space-y-1">
              {dayEvents.map((e) => (
                <EventPill key={e.id} e={e} onSelect={onSelect} />
              ))}
              {dayEvents.length === 0 && (
                <div className="mt-4 text-center text-xs text-gray-400">—</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DayView({ day, all, onSelect }: { day: Date; all: ProcessedEvent[]; onSelect: (id: string, kind: "evenement" | "tache") => void }) {
  const isToday = sameDay(day, new Date());
  const dayEvents = all
    .filter((e) => sameDay(e.start, day))
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  return (
    <div className={`card space-y-3 ${isToday ? "bg-emerald-50" : ""}`}>
      <h3 className="text-lg font-semibold text-cabinet-900">
        {day.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
      </h3>
      {dayEvents.length === 0 && <p className="text-sm text-gray-500">Aucun événement ce jour.</p>}
      {dayEvents.map((e) => {
        const label =
          e.kind === "tache"
            ? `Tâche${e.priorite ? ` · ${e.priorite}` : ""}`
            : TYPE_LABELS[e.type] || e.type;
        return (
          <button
            key={e.id}
            type="button"
            onClick={() => onSelect(e.id, e.kind || "evenement")}
            className={`block w-full rounded border p-3 text-left hover:opacity-90 ${itemColor(e)}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 text-sm font-medium">
                  {formatHour(e.start)} {e.titre}
                  {!!e.nbCommentaires && (
                    <span className="inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-cabinet-700 px-1 text-[10px] font-medium text-white">
                      {e.nbCommentaires}
                    </span>
                  )}
                </div>
                {e.lieu && <div className="text-xs opacity-80">{e.lieu}</div>}
                {e.dossier && <div className="text-xs opacity-80">{e.dossier.referenceInterne}</div>}
              </div>
              <span className="text-xs uppercase tracking-wide opacity-70">{label}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

export function CalendrierClient({
  evenements,
  currentUserId,
  estAdmin,
}: {
  evenements: CalendarEvent[];
  currentUserId: string;
  estAdmin: boolean;
}) {
  const [view, setView] = useState<View>("mois");
  const [current, setCurrent] = useState(new Date());
  const [selected, setSelected] = useState<{ id: string; kind: "evenement" | "tache" } | null>(null);
  const [items, setItems] = useState<CalendarEvent[]>(evenements);

  useEffect(() => setItems(evenements), [evenements]);

  const handleSelect = (id: string, kind: "evenement" | "tache") => setSelected({ id, kind });

  const handleCommentChange = (id: string, kind: "evenement" | "tache", commentaires: unknown) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id && item.kind === kind
          ? { ...item, nbCommentaires: Array.isArray(commentaires) ? commentaires.length : 0 }
          : item
      )
    );
  };

  const all = useMemo<ProcessedEvent[]>(
    () =>
      items.map((e) => ({
        ...e,
        start: new Date(e.dateDebut),
        end: e.dateFin ? new Date(e.dateFin) : null,
      })),
    [items]
  );

  const header = useMemo(() => {
    if (view === "mois") return monthYearLabel(current);
    if (view === "semaine") {
      const ws = startOfWeek(current);
      return `Semaine du ${weekLabel(ws)}`;
    }
    return current.toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }, [view, current]);

  const navigate = (dir: -1 | 1) => {
    setCurrent((prev) => {
      if (view === "mois") return addMonths(prev, dir);
      if (view === "semaine") return addWeeks(prev, dir);
      return addDays(prev, dir);
    });
  };

  const monthStart = useMemo(() => new Date(current.getFullYear(), current.getMonth(), 1), [current]);
  const monthDays = useMemo(() => {
    const start = startOfWeek(monthStart);
    const days: Date[] = [];
    for (let i = 0; i < 42; i++) {
      days.push(addDays(start, i));
    }
    return days;
  }, [monthStart]);

  const weekStart = useMemo(() => startOfWeek(current), [current]);
  const weekDays = useMemo(() => {
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      days.push(addDays(weekStart, i));
    }
    return days;
  }, [weekStart]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            <button
              onClick={() => navigate(-1)}
              className="rounded border bg-white p-2 hover:bg-gray-50"
              aria-label="Période précédente"
            >
              ‹
            </button>
            <button
              onClick={() => navigate(1)}
              className="rounded border bg-white p-2 hover:bg-gray-50"
              aria-label="Période suivante"
            >
              ›
            </button>
          </div>
          <button
            onClick={() => setCurrent(new Date())}
            className="rounded border bg-white px-3 py-2 text-sm font-medium hover:bg-gray-50"
          >
            Aujourd&apos;hui
          </button>
          <h2 className="text-lg font-semibold">{header}</h2>
        </div>
        <div className="flex rounded border bg-white p-1">
          {(["jour", "semaine", "mois"] as View[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`rounded px-3 py-1.5 text-sm capitalize ${
                view === v
                  ? "bg-cabinet-100 font-medium text-cabinet-800"
                  : "hover:bg-gray-50"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {view === "mois" && <MonthView days={monthDays} current={current} all={all} onSelect={handleSelect} />}
      {view === "semaine" && <WeekView days={weekDays} all={all} onSelect={handleSelect} />}
      {view === "jour" && <DayView day={current} all={all} onSelect={handleSelect} />}
      {selected && (
        <CalendrierModal
          id={selected.id}
          kind={selected.kind}
          currentUserId={currentUserId}
          estAdmin={estAdmin}
          onClose={() => setSelected(null)}
          onCommentChange={handleCommentChange}
        />
      )}
    </div>
  );
}
