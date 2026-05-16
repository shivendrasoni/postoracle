"use client";

import { useState, useRef, useEffect } from "react";
import {
  Plus,
  Link as LinkIcon,
  Image as ImageIcon,
  FileText,
  Compass,
  CircleNotch,
} from "@phosphor-icons/react";

interface AngleItem {
  path: string;
  oneLiner: string;
  hookPattern: string;
  strength: string;
  score: number;
  recommended: boolean;
}

interface AttachMenuProps {
  onAttachUrl: (url: string) => void;
  contentType: string;
  anglePath?: string;
  onAngleSelect: (path: string, name: string) => void;
  onAngleClear: () => void;
}

type View = "menu" | "url" | "angles";

export default function AttachMenu({
  onAttachUrl,
  contentType,
  anglePath,
  onAngleSelect,
  onAngleClear,
}: AttachMenuProps) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("menu");
  const [url, setUrl] = useState("");
  const [angles, setAngles] = useState<AngleItem[]>([]);
  const [loadingAngles, setLoadingAngles] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setView("menu");
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  useEffect(() => {
    if (view === "url" && inputRef.current) {
      inputRef.current.focus();
    }
  }, [view]);

  function handleUrlSubmit() {
    if (url.trim()) {
      onAttachUrl(url.trim());
      setUrl("");
      setView("menu");
      setOpen(false);
    }
  }

  async function loadAngles() {
    setView("angles");
    if (angles.length > 0) return;
    setLoadingAngles(true);
    try {
      const format = contentType === "carousel" ? "carousel" : "";
      const res = await fetch(`/api/angles${format ? `?format=${format}` : ""}`);
      const data = await res.json();
      setAngles(Array.isArray(data) ? data : []);
    } catch {
      setAngles([]);
    } finally {
      setLoadingAngles(false);
    }
  }

  function handleAngleSelect(angle: AngleItem) {
    onAngleSelect(angle.path, angle.oneLiner);
    setOpen(false);
    setView("menu");
  }

  const showAngleOption = ["carousel", "script"].includes(contentType);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => {
          setOpen(!open);
          setView("menu");
        }}
        className="
          flex items-center justify-center w-8 h-8 rounded-full
          bg-white/[0.04] border border-white/[0.06]
          text-muted
          transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]
          hover:bg-white/[0.08] hover:text-sub hover:border-white/[0.10]
          active:scale-[0.94]
        "
      >
        <Plus
          size={15}
          weight="bold"
          className={`transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${
            open ? "rotate-45" : ""
          }`}
        />
      </button>

      {/* Dropdown */}
      <div
        className={`
          absolute bottom-full left-0 mb-2
          rounded-2xl bg-panel backdrop-blur-xl
          border border-white/[0.08]
          shadow-[0_8px_32px_rgba(0,0,0,0.6),0_0_0_1px_rgba(255,255,255,0.03)]
          overflow-hidden
          transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]
          origin-bottom-left
          ${open
            ? "opacity-100 scale-100 pointer-events-auto translate-y-0"
            : "opacity-0 scale-95 pointer-events-none translate-y-1"
          }
        `}
        style={{ minWidth: view === "url" ? "320px" : view === "angles" ? "340px" : "180px" }}
      >
        {view === "url" && (
          <div className="p-3">
            <div className="text-[11px] font-medium text-muted uppercase tracking-[0.1em] mb-2 px-1">
              Add URL
            </div>
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleUrlSubmit();
                  if (e.key === "Escape") {
                    setView("menu");
                    setUrl("");
                  }
                }}
                placeholder="https://..."
                className="
                  flex-1 px-3 py-2 rounded-xl
                  bg-white/[0.04] border border-white/[0.06]
                  text-[13px] text-content placeholder:text-muted
                  outline-none
                  transition-all duration-300
                  focus:border-accent/30 focus:bg-white/[0.06]
                "
              />
              <button
                type="button"
                onClick={handleUrlSubmit}
                className="
                  px-3 py-2 rounded-xl
                  bg-accent-soft text-accent text-[12px] font-medium
                  transition-all duration-300
                  hover:bg-accent/20
                "
              >
                Add
              </button>
            </div>
          </div>
        )}

        {view === "angles" && (
          <div className="p-1.5">
            <div className="px-2.5 pt-1 pb-2">
              <span className="text-[10px] font-semibold tracking-[0.1em] uppercase text-muted">
                From angle
              </span>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {loadingAngles ? (
                <div className="flex items-center justify-center py-6">
                  <CircleNotch size={16} weight="bold" className="text-muted animate-spin" />
                </div>
              ) : angles.length === 0 ? (
                <div className="py-5 text-center">
                  <p className="text-[12px] text-muted">No angles yet</p>
                  <p className="text-[11px] text-muted/60 mt-0.5">Run /viral-angle first</p>
                </div>
              ) : (
                angles.map((angle) => {
                  const isSelected = angle.path === anglePath;
                  return (
                    <button
                      key={angle.path}
                      type="button"
                      onClick={() => handleAngleSelect(angle)}
                      className={`
                        w-full text-left px-2.5 py-2 rounded-xl
                        transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]
                        ${isSelected
                          ? "bg-accent-soft border border-accent/20"
                          : "hover:bg-white/[0.04] border border-transparent"
                        }
                      `}
                    >
                      <div className={`text-[12px] leading-snug ${isSelected ? "text-accent font-medium" : "text-content"}`}>
                        {angle.recommended ? "⭐ " : ""}{angle.oneLiner}
                      </div>
                      <div className="text-[10px] text-muted mt-0.5">
                        {angle.hookPattern} · {angle.strength} · {angle.score.toFixed(1)}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
            {anglePath && (
              <div className="border-t border-white/[0.04] mt-1 pt-1 px-1">
                <button
                  type="button"
                  onClick={() => {
                    onAngleClear();
                    setOpen(false);
                    setView("menu");
                  }}
                  className="w-full text-center py-2 text-[11px] text-muted hover:text-content transition-colors rounded-lg hover:bg-white/[0.04]"
                >
                  Clear angle
                </button>
              </div>
            )}
          </div>
        )}

        {view === "menu" && (
          <div className="p-1.5">
            <button
              type="button"
              onClick={() => setView("url")}
              className="
                w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px]
                text-sub hover:text-content hover:bg-white/[0.04]
                transition-all duration-300
              "
            >
              <LinkIcon size={15} weight="light" className="text-muted" />
              Attach URL
            </button>
            {showAngleOption && (
              <button
                type="button"
                onClick={loadAngles}
                className={`
                  w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px]
                  transition-all duration-300
                  ${anglePath
                    ? "text-accent bg-accent-soft/50"
                    : "text-sub hover:text-content hover:bg-white/[0.04]"
                  }
                `}
              >
                <Compass size={15} weight={anglePath ? "fill" : "light"} className={anglePath ? "text-accent" : "text-muted"} />
                {anglePath ? "Change angle" : "From angle"}
              </button>
            )}
            <button
              type="button"
              className="
                w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px]
                text-sub hover:text-content hover:bg-white/[0.04]
                transition-all duration-300 opacity-50 cursor-not-allowed
              "
              disabled
            >
              <ImageIcon size={15} weight="light" className="text-muted" />
              Upload image
            </button>
            <button
              type="button"
              className="
                w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px]
                text-sub hover:text-content hover:bg-white/[0.04]
                transition-all duration-300 opacity-50 cursor-not-allowed
              "
              disabled
            >
              <FileText size={15} weight="light" className="text-muted" />
              Paste text
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
