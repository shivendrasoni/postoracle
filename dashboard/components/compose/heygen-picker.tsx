"use client";

import { useState, useRef, useEffect } from "react";

interface PickerItem {
  id: string;
  name: string;
  subtitle?: string;
  thumbnail?: string;
}

interface HeygenPickerProps {
  apiUrl: string;
  mapFn: (data: unknown[]) => PickerItem[];
  selectedId?: string;
  onSelect: (id: string, name: string) => void;
  emptyLabel?: string;
  children: React.ReactNode;
}

export default function HeygenPicker({
  apiUrl,
  mapFn,
  selectedId,
  onSelect,
  emptyLabel = "No items found",
  children,
}: HeygenPickerProps) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<PickerItem[]>([]);
  const [loading, setLoading] = useState(false);
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

  async function fetchItems() {
    setLoading(true);
    try {
      const res = await fetch(apiUrl);
      const json = await res.json();
      const data: unknown[] = Array.isArray(json) ? json : (json.data ?? json.items ?? []);
      setItems(mapFn(data));
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  function handleToggle() {
    const next = !open;
    setOpen(next);
    if (next && items.length === 0) {
      fetchItems();
    }
  }

  function handleSelect(item: PickerItem) {
    onSelect(item.id, item.name);
    setOpen(false);
  }

  return (
    <div className="relative" ref={containerRef}>
      {/* Trigger */}
      <div onClick={handleToggle} className="cursor-pointer">
        {children}
      </div>

      {/* Popover */}
      <div
        className={`
          absolute bottom-full left-0 mb-2 w-64
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
        <div className="max-h-72 overflow-y-auto p-1.5">
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <span className="text-[12px] text-muted">Loading…</span>
            </div>
          ) : items.length === 0 ? (
            <div className="flex items-center justify-center py-6">
              <span className="text-[12px] text-muted">{emptyLabel}</span>
            </div>
          ) : (
            items.map((item) => {
              const isSelected = item.id === selectedId;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelect(item)}
                  className={`
                    w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px]
                    transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]
                    ${isSelected
                      ? "bg-white/[0.06] text-content font-medium"
                      : "text-sub hover:text-content hover:bg-white/[0.04]"
                    }
                  `}
                >
                  {item.thumbnail && (
                    <img
                      src={item.thumbnail}
                      alt={item.name}
                      className="w-7 h-7 rounded-lg object-cover flex-shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0 text-left">
                    <div className="truncate">{item.name}</div>
                    {item.subtitle && (
                      <div className="text-[11px] text-muted truncate">{item.subtitle}</div>
                    )}
                  </div>
                  {isSelected && (
                    <span className="w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0" />
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
