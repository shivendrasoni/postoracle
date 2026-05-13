"use client";

import { useState, useRef, useEffect } from "react";
import {
  Plus,
  Link as LinkIcon,
  Image as ImageIcon,
  FileText,
} from "@phosphor-icons/react";

interface AttachMenuProps {
  onAttachUrl: (url: string) => void;
}

export default function AttachMenu({ onAttachUrl }: AttachMenuProps) {
  const [open, setOpen] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [url, setUrl] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setShowUrlInput(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  useEffect(() => {
    if (showUrlInput && inputRef.current) {
      inputRef.current.focus();
    }
  }, [showUrlInput]);

  function handleUrlSubmit() {
    if (url.trim()) {
      onAttachUrl(url.trim());
      setUrl("");
      setShowUrlInput(false);
      setOpen(false);
    }
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => {
          setOpen(!open);
          setShowUrlInput(false);
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
        style={{ minWidth: showUrlInput ? "320px" : "180px" }}
      >
        {showUrlInput ? (
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
                    setShowUrlInput(false);
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
        ) : (
          <div className="p-1.5">
            <button
              type="button"
              onClick={() => setShowUrlInput(true)}
              className="
                w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px]
                text-sub hover:text-content hover:bg-white/[0.04]
                transition-all duration-300
              "
            >
              <LinkIcon size={15} weight="light" className="text-muted" />
              Attach URL
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
