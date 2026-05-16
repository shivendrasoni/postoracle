"use client";

import { useState, useRef, useEffect } from "react";
import {
  FilmStrip,
  Images,
  Article,
  Compass,
  CaretDown,
  ChartBar,
  ArrowsClockwise,
  ImageSquare,
  PlusCircle,
  FileText,
} from "@phosphor-icons/react";
import type { ContentType } from "@/lib/compose-context";

interface TypeOption {
  value: ContentType;
  label: string;
  Icon: typeof FilmStrip;
}

interface TypeGroup {
  label: string;
  options: TypeOption[];
}

const TYPE_GROUPS: TypeGroup[] = [
  {
    label: "Create",
    options: [
      { value: "reel", label: "Reel", Icon: FilmStrip },
      { value: "carousel", label: "Carousel", Icon: Images },
      { value: "post", label: "Post", Icon: Article },
    ],
  },
  {
    label: "Pipeline",
    options: [
      { value: "angle", label: "Angle", Icon: Compass },
      { value: "script", label: "Script", Icon: FileText },
      { value: "analyse", label: "Analyse", Icon: ChartBar },
      { value: "repurpose", label: "Repurpose", Icon: ArrowsClockwise },
    ],
  },
  {
    label: "Setup",
    options: [
      { value: "import-template", label: "Import template", Icon: ImageSquare },
      { value: "add-platform", label: "Add platform", Icon: PlusCircle },
    ],
  },
];

const ALL_OPTIONS = TYPE_GROUPS.flatMap((g) => g.options);

interface TypeSelectorProps {
  value: ContentType;
  onChange: (type: ContentType) => void;
}

export default function TypeSelector({ value, onChange }: TypeSelectorProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const current = ALL_OPTIONS.find((o) => o.value === value) ?? ALL_OPTIONS[0];

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

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="
          flex items-center gap-2 px-3.5 py-2 rounded-full
          bg-white/[0.06] border border-white/[0.08]
          text-[13px] font-medium text-content
          transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]
          hover:bg-white/[0.09] hover:border-white/[0.12]
          active:scale-[0.97]
        "
      >
        <current.Icon size={16} weight="light" className="text-accent" />
        {current.label}
        <CaretDown
          size={12}
          weight="bold"
          className={`text-muted transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Dropdown — horizontal columns */}
      <div
        className={`
          absolute bottom-full right-0 mb-2
          rounded-2xl bg-panel backdrop-blur-xl
          border border-white/[0.08]
          shadow-[0_8px_32px_rgba(0,0,0,0.6),0_0_0_1px_rgba(255,255,255,0.03)]
          overflow-hidden
          transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]
          origin-bottom-right
          ${open
            ? "opacity-100 scale-100 pointer-events-auto translate-y-0"
            : "opacity-0 scale-95 pointer-events-none translate-y-1"
          }
        `}
      >
        <div className="flex p-1.5 gap-1">
          {TYPE_GROUPS.map((group, groupIdx) => (
            <div
              key={group.label}
              className={`
                min-w-[140px]
                ${groupIdx > 0 ? "border-l border-white/[0.06] pl-1" : ""}
              `}
            >
              <div className="px-2.5 pt-1.5 pb-1.5">
                <span className="text-[10px] font-semibold tracking-[0.1em] uppercase text-muted">
                  {group.label}
                </span>
              </div>
              {group.options.map((option) => {
                const isSelected = option.value === value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                    className={`
                      w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-[13px]
                      transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]
                      ${isSelected
                        ? "bg-white/[0.08] text-content font-medium"
                        : "text-sub hover:text-content hover:bg-white/[0.04]"
                      }
                    `}
                  >
                    <option.Icon
                      size={15}
                      weight={isSelected ? "fill" : "light"}
                      className={isSelected ? "text-accent" : "text-muted"}
                    />
                    {option.label}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
