"use client";

import { useState, useRef, useEffect } from "react";
import {
  FilmStrip,
  Images,
  Article,
  Compass,
  CaretDown,
} from "@phosphor-icons/react";
import type { ContentType } from "@/lib/compose-context";

const TYPE_OPTIONS: {
  value: ContentType;
  label: string;
  Icon: typeof FilmStrip;
}[] = [
  { value: "reel", label: "Reel", Icon: FilmStrip },
  { value: "carousel", label: "Carousel", Icon: Images },
  { value: "post", label: "Post", Icon: Article },
  { value: "angle", label: "Angle", Icon: Compass },
];

interface TypeSelectorProps {
  value: ContentType;
  onChange: (type: ContentType) => void;
}

export default function TypeSelector({ value, onChange }: TypeSelectorProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const current = TYPE_OPTIONS.find((o) => o.value === value) ?? TYPE_OPTIONS[0];

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

      {/* Dropdown */}
      <div
        className={`
          absolute bottom-full left-0 mb-2 w-44
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
        <div className="p-1.5">
          {TYPE_OPTIONS.map((option) => {
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
                  w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px]
                  transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]
                  ${isSelected
                    ? "bg-white/[0.06] text-content font-medium"
                    : "text-sub hover:text-content hover:bg-white/[0.04]"
                  }
                `}
              >
                <option.Icon
                  size={16}
                  weight={isSelected ? "fill" : "light"}
                  className={isSelected ? "text-accent" : "text-muted"}
                />
                {option.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
