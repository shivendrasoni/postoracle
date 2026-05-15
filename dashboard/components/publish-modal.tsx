"use client";

import { useState } from "react";
import {
  X,
  InstagramLogo,
  LinkedinLogo,
  XLogo,
  CircleNotch,
  CheckCircle,
  WarningCircle,
  ArrowSquareOut,
} from "@phosphor-icons/react";
import type { RegistryEntry } from "@/lib/types";

const PLATFORMS = [
  { id: "instagram", label: "Instagram", icon: InstagramLogo },
  { id: "linkedin", label: "LinkedIn", icon: LinkedinLogo },
  { id: "x", label: "X", icon: XLogo },
] as const;

type PlatformId = (typeof PLATFORMS)[number]["id"];

type PlatformResult = {
  success: boolean;
  url: string | null;
  error: string | null;
};

interface PublishModalProps {
  entry: RegistryEntry;
  onClose: () => void;
  onPublished: () => void;
}

export default function PublishModal({ entry, onClose, onPublished }: PublishModalProps) {
  const [selected, setSelected] = useState<Set<PlatformId>>(() => {
    const initial = new Set<PlatformId>();
    for (const p of entry.platforms) {
      if (PLATFORMS.some((pl) => pl.id === p)) {
        initial.add(p as PlatformId);
      }
    }
    return initial;
  });

  const [publishing, setPublishing] = useState(false);
  const [results, setResults] = useState<Record<string, PlatformResult> | null>(null);

  const alreadyPublished = new Set(
    Object.keys(entry.published_urls ?? {})
  );

  function toggle(id: PlatformId) {
    if (publishing) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handlePublish() {
    const toPublish = [...selected].filter((p) => !alreadyPublished.has(p));
    if (toPublish.length === 0) return;

    setPublishing(true);
    setResults(null);

    try {
      const res = await fetch("/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionDir: entry.session_dir,
          platforms: toPublish,
        }),
      });
      const data = await res.json();
      setResults(data.results ?? data);
      if (data.results && Object.values(data.results as Record<string, PlatformResult>).some((r) => r.success)) {
        onPublished();
      }
    } catch {
      setResults(
        Object.fromEntries(toPublish.map((p) => [p, { success: false, url: null, error: "Network error" }]))
      );
    } finally {
      setPublishing(false);
    }
  }

  const pendingCount = [...selected].filter((p) => !alreadyPublished.has(p)).length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget && !publishing) onClose(); }}
    >
      <div className="w-full max-w-md rounded-2xl bg-[#141417] border border-white/[0.08] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
          <div>
            <h2 className="text-[15px] font-semibold text-content">Publish</h2>
            <p className="text-[12px] text-muted mt-0.5 truncate max-w-[280px]">{entry.topic}</p>
          </div>
          <button
            onClick={onClose}
            disabled={publishing}
            className="p-1.5 rounded-lg text-muted hover:text-content hover:bg-white/[0.06] transition-colors duration-200 disabled:opacity-40"
          >
            <X size={16} weight="bold" />
          </button>
        </div>

        {/* Platform picker */}
        <div className="px-6 py-5 space-y-2.5">
          {PLATFORMS.map(({ id, label, icon: Icon }) => {
            const isPublished = alreadyPublished.has(id);
            const isSelected = selected.has(id);
            const result = results?.[id];

            return (
              <button
                key={id}
                onClick={() => !isPublished && toggle(id)}
                disabled={isPublished || publishing}
                className={`
                  w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-left
                  transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]
                  ${isPublished
                    ? "bg-emerald-500/[0.06] border border-emerald-500/20 cursor-default"
                    : isSelected
                      ? "bg-white/[0.06] border border-white/[0.12]"
                      : "bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04] hover:border-white/[0.08]"
                  }
                  disabled:cursor-default
                `}
              >
                <Icon
                  size={20}
                  weight="regular"
                  className={
                    isPublished ? "text-emerald" : isSelected ? "text-content" : "text-muted"
                  }
                />
                <span
                  className={`flex-1 text-[13px] font-medium ${
                    isPublished ? "text-emerald" : isSelected ? "text-content" : "text-sub"
                  }`}
                >
                  {label}
                </span>

                {/* Status indicators */}
                {result ? (
                  result.success ? (
                    <span className="flex items-center gap-1.5 text-[11px] text-emerald">
                      <CheckCircle size={14} weight="fill" />
                      Published
                      {result.url && (
                        <a
                          href={result.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="p-0.5 hover:bg-emerald-500/20 rounded transition-colors"
                        >
                          <ArrowSquareOut size={12} weight="bold" />
                        </a>
                      )}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-[11px] text-red-400">
                      <WarningCircle size={14} weight="fill" />
                      Failed
                    </span>
                  )
                ) : isPublished ? (
                  <span className="flex items-center gap-1.5 text-[11px] text-emerald">
                    <CheckCircle size={14} weight="fill" />
                    Live
                    {(entry.published_urls ?? {})[id] && (
                      <a
                        href={(entry.published_urls ?? {})[id]}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="p-0.5 hover:bg-emerald-500/20 rounded transition-colors"
                      >
                        <ArrowSquareOut size={12} weight="bold" />
                      </a>
                    )}
                  </span>
                ) : (
                  <div
                    className={`w-4 h-4 rounded-full border-2 transition-all duration-300 ${
                      isSelected
                        ? "border-accent bg-accent"
                        : "border-white/20"
                    }`}
                  >
                    {isSelected && (
                      <div className="w-full h-full flex items-center justify-center">
                        <div className="w-1.5 h-1.5 rounded-full bg-white" />
                      </div>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Error details */}
        {results && Object.values(results).some((r) => !r.success && r.error) && (
          <div className="px-6 pb-3">
            <div className="rounded-lg bg-red-500/[0.06] border border-red-500/10 px-3 py-2">
              {Object.entries(results)
                .filter(([, r]) => !r.success && r.error)
                .map(([platform, r]) => (
                  <p key={platform} className="text-[11px] text-red-400">
                    <span className="font-medium capitalize">{platform}:</span> {r.error}
                  </p>
                ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/[0.06] flex items-center justify-end gap-2.5">
          <button
            onClick={onClose}
            disabled={publishing}
            className="px-4 py-2 rounded-lg text-[13px] text-sub hover:text-content hover:bg-white/[0.04] transition-colors duration-200 disabled:opacity-40"
          >
            {results ? "Close" : "Cancel"}
          </button>
          {!results && (
            <button
              onClick={handlePublish}
              disabled={publishing || pendingCount === 0}
              className="px-5 py-2 rounded-lg text-[13px] font-medium bg-accent text-white
                hover:bg-accent/90 transition-all duration-300
                disabled:opacity-40 disabled:cursor-not-allowed
                flex items-center gap-2"
            >
              {publishing ? (
                <>
                  <CircleNotch size={14} weight="bold" className="animate-spin" />
                  Publishing...
                </>
              ) : (
                <>Publish to {pendingCount} platform{pendingCount !== 1 ? "s" : ""}</>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
