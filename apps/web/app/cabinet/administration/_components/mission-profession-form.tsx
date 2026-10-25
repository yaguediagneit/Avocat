"use client";

import { useMemo } from "react";
import { parseMissionTemplate, getMissionFormDefaults, type MissionFormData } from "@/lib/mission-form";

interface MissionProfessionFormProps {
  profession: string;
  data: MissionFormData;
  onChange: (data: MissionFormData) => void;
}

export function MissionProfessionForm({ profession, data, onChange }: MissionProfessionFormProps) {
  const items = useMemo(() => parseMissionTemplate(profession).items, [profession]);
  const merged = useMemo(() => ({ ...getMissionFormDefaults(profession), ...data }), [profession, data]);

  function update(key: string, value: string | boolean) {
    onChange({ ...merged, [key]: value });
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => {
        if (item.kind === "checkbox") {
          return (
            <label key={item.key} className="flex items-start gap-2">
              <input
                type="checkbox"
                className="mt-1"
                checked={!!merged[item.key]}
                onChange={(e) => update(item.key, e.target.checked)}
              />
              <span className="text-sm">{item.label}</span>
            </label>
          );
        }

        const isTextarea = item.type === "textarea";
        return (
          <div key={item.key} className={isTextarea ? "sm:col-span-2 lg:col-span-3" : undefined}>
            <label className="mb-1 block text-sm font-medium">{item.label}</label>
            {isTextarea ? (
              <textarea
                className="input w-full"
                rows={item.label === "Description détaillée" ? 4 : 2}
                value={String(merged[item.key] ?? "")}
                onChange={(e) => update(item.key, e.target.value)}
              />
            ) : (
              <input
                type={item.type === "date" ? "date" : "text"}
                className="input w-full"
                value={String(merged[item.key] ?? "")}
                onChange={(e) => update(item.key, e.target.value)}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
