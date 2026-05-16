"use client";

import { useState, useRef, useEffect } from "react";
import { Gear, X } from "@phosphor-icons/react";
import type { ContentType } from "@/lib/compose-context";

interface SettingsDropdownProps {
  type: ContentType;
  defaults: Record<string, unknown>;
  overrides: Record<string, unknown>;
  onOverride: (key: string, value: unknown) => void;
  onClear: (key: string) => void;
}

const YAML_SECTION_KEY: Partial<Record<ContentType, string>> = {
  reel: "make_reel",
  carousel: "make_carousel",
  post: "make_post",
  angle: "viral_angle",
  script: "viral_script",
};

const TYPE_CONFIG_KEYS: Record<string, { key: string; label: string; options?: string[] }[]> = {
  reel: [
    { key: "duration", label: "Duration", options: ["30", "45", "60"] },
    { key: "style", label: "Script style", options: ["punchy", "deep-dive"] },
    { key: "mode", label: "Mode", options: ["video-agent", "heygen-basic", "edit-raw"] },
    { key: "subtitles", label: "Subtitles", options: ["true", "false"] },
    { key: "broll", label: "B-roll", options: ["true", "false"] },
    { key: "grade", label: "Color grade", options: ["auto", "none"] },
  ],
  carousel: [
    { key: "slides", label: "Slides", options: ["5", "6", "7", "8", "9", "10"] },
    { key: "mode", label: "Mode", options: ["preview", "final"] },
  ],
  post: [
    { key: "mode", label: "Mode", options: ["visual", "text-overlay"] },
  ],
  angle: [
    { key: "format", label: "Format", options: ["all", "shortform", "longform", "carousel"] },
    { key: "count", label: "Count", options: ["3", "5", "8"] },
  ],
  script: [
    { key: "mode", label: "Mode", options: ["shortform", "longform", "linkedin"] },
  ],
};

export default function SettingsDropdown({
  type,
  defaults,
  overrides,
  onOverride,
  onClear,
}: SettingsDropdownProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  const sectionKey = YAML_SECTION_KEY[type];
  if (!sectionKey) return null;

  const fields = TYPE_CONFIG_KEYS[type] ?? [];
  const sectionDefaults = (defaults[sectionKey] ?? {}) as Record<string, unknown>;
  const overrideCount = Object.keys(overrides).filter((k) =>
    fields.some((f) => f.key === k)
  ).length;
  const hasOverrides = overrideCount > 0;

  function getDefaultValue(key: string): string {
    const val = sectionDefaults[key];
    return val !== undefined && val !== null ? String(val) : "";
  }

  function getCurrentValue(key: string): string {
    if (key in overrides) return String(overrides[key]);
    return getDefaultValue(key);
  }

  function handleChange(key: string, value: string) {
    const defaultVal = getDefaultValue(key);
    if (value === defaultVal) {
      onClear(key);
    } else {
      onOverride(key, value);
    }
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`
          flex items-center justify-center w-8 h-8 rounded-full
          border
          transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]
          active:scale-[0.94]
          ${hasOverrides
            ? "bg-accent-soft text-accent border-accent/20 hover:bg-accent/20"
            : "bg-white/[0.04] border-white/[0.06] text-muted hover:bg-white/[0.08] hover:text-sub hover:border-white/[0.10]"
          }
        `}
      >
        <Gear size={15} weight="bold" />
      </button>

      {/* Dropdown */}
      <div
        className={`
          absolute bottom-full left-0 mb-2 w-72
          rounded-2xl bg-panel/95 backdrop-blur-xl
          border border-white/[0.08]
          shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.03)]
          overflow-hidden
          transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]
          origin-bottom-left
          ${open
            ? "opacity-100 scale-100 pointer-events-auto translate-y-0"
            : "opacity-0 scale-95 pointer-events-none translate-y-1"
          }
        `}
      >
        <div className="p-3">
          {/* Header */}
          <div className="text-[11px] font-medium text-muted uppercase tracking-[0.1em] mb-2 px-2">
            Settings
          </div>

          {/* Fields */}
          <div className="flex flex-col gap-0.5">
            {fields.map(({ key, label, options }) => {
              const defaultVal = getDefaultValue(key);
              const currentVal = getCurrentValue(key);
              const isOverridden = key in overrides;

              return (
                <div
                  key={key}
                  className="flex items-center justify-between px-2 py-2 rounded-xl hover:bg-white/[0.03]"
                >
                  <span className="text-[12px] text-sub">{label}</span>
                  <div className="flex items-center gap-1.5">
                    <select
                      value={currentVal}
                      onChange={(e) => handleChange(key, e.target.value)}
                      className="bg-white/[0.04] border border-white/[0.06] rounded-lg px-2 py-1 text-[12px] text-content outline-none cursor-pointer"
                    >
                      {(options ?? []).map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}{opt === defaultVal ? " (default)" : ""}
                        </option>
                      ))}
                    </select>
                    {isOverridden && (
                      <button
                        type="button"
                        onClick={() => onClear(key)}
                        className="
                          flex items-center justify-center w-4 h-4 rounded-full
                          bg-white/[0.06] text-muted
                          transition-all duration-200
                          hover:bg-white/[0.10] hover:text-sub
                        "
                      >
                        <X size={9} weight="bold" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          {overrideCount > 0 && (
            <div className="mt-2 px-2 pt-2 border-t border-white/[0.06]">
              <span className="text-[11px] text-accent">
                {overrideCount} override{overrideCount > 1 ? "s" : ""}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
