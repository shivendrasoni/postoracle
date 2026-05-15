"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { RegistryEntry } from "@/lib/types";
import StatusBadge from "./status-badge";
import PublishModal from "./publish-modal";
import {
  FilmStrip,
  Images,
  Article,
  File,
  CaretRight,
  SortAscending,
  Eye,
  PaperPlaneTilt,
  ArrowSquareOut,
} from "@phosphor-icons/react";

const TYPE_ICONS: Record<string, typeof FilmStrip> = {
  reel: FilmStrip,
  carousel: Images,
  post: Article,
};

type SortKey = "date" | "virality";

interface ContentTableProps {
  entries: RegistryEntry[];
}

export default function ContentTable({ entries }: ContentTableProps) {
  const router = useRouter();
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortKey>("date");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [publishEntry, setPublishEntry] = useState<RegistryEntry | null>(null);

  const filtered = entries.filter((e) => {
    if (typeFilter !== "all" && e.type !== typeFilter) return false;
    if (statusFilter !== "all" && e.status !== statusFilter) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === "virality")
      return (b.virality_score ?? -1) - (a.virality_score ?? -1);
    return (
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  });

  const types = ["all", ...new Set(entries.map((e) => e.type))];
  const statuses = ["all", "draft", "published"];

  return (
    <div>
      {/* Filter pills */}
      <div className="flex items-center gap-1.5 mb-6 flex-wrap">
        {types.map((t) => (
          <button
            key={t}
            onClick={() => setTypeFilter(t)}
            className={`
              px-3 py-1.5 rounded-full text-[12px]
              transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]
              ${
                typeFilter === t
                  ? "bg-white/[0.08] text-content font-medium shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)]"
                  : "text-muted hover:text-sub hover:bg-white/[0.03]"
              }
            `}
          >
            {t === "all" ? "All types" : t}
          </button>
        ))}
        <span className="w-px h-4 bg-white/[0.06] mx-1.5" />
        {statuses.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`
              px-3 py-1.5 rounded-full text-[12px]
              transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]
              ${
                statusFilter === s
                  ? "bg-white/[0.08] text-content font-medium shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)]"
                  : "text-muted hover:text-sub hover:bg-white/[0.03]"
              }
            `}
          >
            {s === "all" ? "All" : s}
          </button>
        ))}
        <span className="w-px h-4 bg-white/[0.06] mx-1.5" />
        <button
          onClick={() =>
            setSortBy(sortBy === "date" ? "virality" : "date")
          }
          className="group flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] text-muted hover:text-sub hover:bg-white/[0.03] transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]"
        >
          <SortAscending
            size={13}
            weight="light"
            className="transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:scale-110"
          />
          {sortBy === "date" ? "Newest" : "Top virality"}
        </button>
      </div>

      {/* Content list — double-bezel */}
      <div className="rounded-[1.5rem] bg-white/[0.02] border border-white/[0.06] p-1.5">
        <div className="rounded-[calc(1.5rem-0.375rem)] bg-surface/40 overflow-hidden">
          {sorted.length === 0 && (
            <div className="py-16 text-center">
              <p className="text-[13px] text-muted">
                No content matches.
              </p>
            </div>
          )}
          {sorted.map((entry, i) => {
            const Icon = TYPE_ICONS[entry.type] ?? File;
            const isExpanded = expandedId === entry.id;

            return (
              <div
                key={entry.id}
                className={
                  i > 0 ? "border-t border-white/[0.04]" : ""
                }
              >
                <button
                  className="group w-full flex items-center gap-4 px-5 py-4 text-left
                    transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]
                    hover:bg-white/[0.02] active:scale-[0.998]"
                  onClick={() =>
                    setExpandedId(isExpanded ? null : entry.id)
                  }
                >
                  <div
                    className={`
                      w-10 h-10 rounded-xl flex items-center justify-center shrink-0
                      transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]
                      ${
                        entry.status === "published"
                          ? "bg-emerald-soft text-emerald"
                          : "bg-accent-soft text-accent"
                      }
                    `}
                  >
                    <Icon size={18} weight="light" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium text-content truncate">
                      {entry.topic}
                    </div>
                    <div className="text-[12px] text-muted mt-0.5 flex items-center gap-1.5">
                      <span>{entry.type}</span>
                      <span className="text-faint">·</span>
                      <span>
                        {new Date(entry.created_at).toLocaleDateString(
                          "en-US",
                          { month: "short", day: "numeric" }
                        )}
                      </span>
                      <span className="text-faint">·</span>
                      <span>{entry.platforms.join(", ")}</span>
                      {entry.virality_score != null && (
                        <>
                          <span className="text-faint">·</span>
                          <span
                            className={
                              entry.virality_score > 7
                                ? "text-emerald font-medium"
                                : entry.virality_score > 4
                                  ? "text-amber"
                                  : ""
                            }
                          >
                            {entry.virality_score}/10
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <StatusBadge status={entry.status} />
                  <CaretRight
                    size={14}
                    weight="light"
                    className={`text-muted shrink-0 transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${
                      isExpanded
                        ? "rotate-90"
                        : "group-hover:translate-x-0.5"
                    }`}
                  />
                </button>

                {/* Expanded details */}
                <div
                  className="overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]"
                  style={{
                    maxHeight: isExpanded ? "400px" : "0",
                    opacity: isExpanded ? 1 : 0,
                  }}
                >
                  <div className="px-5 py-4 pl-[4.75rem] border-t border-white/[0.04] bg-white/[0.01]">
                    <div className="grid grid-cols-2 gap-x-8 gap-y-2.5 text-[13px]">
                      <div className="flex items-center gap-3">
                        <span>
                          <span className="text-muted">Session </span>
                          <a
                            href={`/vault/${entry.session_dir.replace("vault/", "")}`}
                            className="text-accent hover:underline transition-colors duration-300"
                          >
                            {entry.session_dir}
                          </a>
                        </span>
                        <a
                          href={`/vault/${entry.session_dir.replace("vault/", "")}`}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent-soft text-accent text-[11px] font-medium hover:bg-accent/15 transition-colors duration-300"
                        >
                          <Eye size={12} weight="bold" />
                          Preview
                        </a>
                      </div>
                      {entry.source_url && (
                        <div>
                          <span className="text-muted">Source </span>
                          <span className="text-sub truncate inline-block max-w-xs align-bottom">
                            {entry.source_url}
                          </span>
                        </div>
                      )}
                      {entry.published_urls && Object.keys(entry.published_urls).length > 0 && (
                        <div>
                          <span className="text-muted">Published </span>
                          {Object.entries(entry.published_urls).map(
                            ([platform, url]) => (
                              <a
                                key={platform}
                                href={url || "#"}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 ml-2 text-accent hover:text-accent/80 transition-colors"
                                onClick={(e) => { if (!url) e.preventDefault(); }}
                              >
                                <span className="capitalize">{platform}</span>
                                {url && <ArrowSquareOut size={11} weight="bold" />}
                              </a>
                            )
                          )}
                        </div>
                      )}
                      {entry.analytics && (
                        <div>
                          <span className="text-muted">
                            Performance{" "}
                          </span>
                          <span className="text-content font-mono text-[12px]">
                            {entry.analytics.performance_score}/10
                          </span>
                        </div>
                      )}
                    </div>
                    {entry.tags?.length > 0 && (
                      <div className="mt-3 flex gap-1.5 flex-wrap">
                        {entry.tags.map((tag) => (
                          <span
                            key={tag}
                            className="px-2.5 py-0.5 rounded-full bg-white/[0.04] text-[11px] text-sub border border-white/[0.04]"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="mt-3.5 pt-3 border-t border-white/[0.04]">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setPublishEntry(entry);
                        }}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-[12px] font-medium
                          bg-accent/10 text-accent border border-accent/20
                          hover:bg-accent/20 hover:border-accent/30
                          transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
                      >
                        <PaperPlaneTilt size={14} weight="fill" />
                        {entry.status === "published" ? "Publish to more" : "Publish"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {publishEntry && (
        <PublishModal
          entry={publishEntry}
          onClose={() => setPublishEntry(null)}
          onPublished={() => router.refresh()}
        />
      )}
    </div>
  );
}
