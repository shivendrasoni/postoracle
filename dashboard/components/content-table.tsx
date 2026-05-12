"use client";

import { useState } from "react";
import type { RegistryEntry } from "@/lib/types";
import StatusBadge from "./status-badge";

const TYPE_ICONS: Record<string, string> = {
  reel: "🎬",
  carousel: "📸",
  post: "📝",
};

type SortKey = "date" | "virality";

interface ContentTableProps {
  entries: RegistryEntry[];
}

export default function ContentTable({ entries }: ContentTableProps) {
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortKey>("date");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = entries.filter((e) => {
    if (typeFilter !== "all" && e.type !== typeFilter) return false;
    if (statusFilter !== "all" && e.status !== statusFilter) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === "virality") {
      return (b.virality_score ?? -1) - (a.virality_score ?? -1);
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const types = ["all", ...new Set(entries.map((e) => e.type))];
  const statuses = ["all", "draft", "published"];

  return (
    <div>
      <div className="flex gap-2 mb-4 flex-wrap">
        {types.map((t) => (
          <button
            key={t}
            onClick={() => setTypeFilter(t)}
            className="px-3 py-1 rounded text-xs transition-colors"
            style={{
              background:
                typeFilter === t ? "var(--accent-dim)" : "var(--bg-card)",
              color:
                typeFilter === t ? "var(--accent)" : "var(--text-secondary)",
            }}
          >
            {t === "all" ? "All types" : t}
          </button>
        ))}
        <div className="w-px mx-1" style={{ background: "var(--border)" }} />
        {statuses.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className="px-3 py-1 rounded text-xs transition-colors"
            style={{
              background:
                statusFilter === s ? "var(--accent-dim)" : "var(--bg-card)",
              color:
                statusFilter === s ? "var(--accent)" : "var(--text-secondary)",
            }}
          >
            {s === "all" ? "All statuses" : s}
          </button>
        ))}
        <div className="w-px mx-1" style={{ background: "var(--border)" }} />
        <button
          onClick={() => setSortBy(sortBy === "date" ? "virality" : "date")}
          className="px-3 py-1 rounded text-xs transition-colors"
          style={{
            background: "var(--bg-card)",
            color: "var(--text-secondary)",
          }}
        >
          Sort: {sortBy === "date" ? "newest" : "virality"}
        </button>
      </div>

      <div className="flex flex-col gap-2">
        {sorted.length === 0 && (
          <p className="text-sm py-8 text-center" style={{ color: "var(--text-muted)" }}>
            No content matches the current filters.
          </p>
        )}
        {sorted.map((entry) => (
          <div key={entry.id}>
            <div
              className="flex items-center gap-3 rounded-lg px-4 py-3 transition-colors cursor-pointer"
              style={{ background: "var(--bg-card)" }}
              onClick={() =>
                setExpandedId(expandedId === entry.id ? null : entry.id)
              }
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "var(--bg-hover)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "var(--bg-card)")
              }
            >
              <div
                className="w-9 h-9 rounded flex items-center justify-center text-lg"
                style={{
                  background:
                    entry.status === "published"
                      ? "var(--green-dim)"
                      : "var(--accent-dim)",
                }}
              >
                {TYPE_ICONS[entry.type] ?? "📄"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">
                  {entry.topic}
                </div>
                <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                  {entry.type} · {new Date(entry.created_at).toLocaleDateString()} ·{" "}
                  {entry.platforms.join(", ")}
                </div>
              </div>
              <StatusBadge status={entry.status} />
              <span
                className="text-xs ml-1 transition-transform"
                style={{
                  color: "var(--text-muted)",
                  transform: expandedId === entry.id ? "rotate(90deg)" : "none",
                }}
              >
                ▶
              </span>
            </div>

            {expandedId === entry.id && (
              <div
                className="rounded-b-lg px-4 py-4 -mt-1 ml-12 mr-0 text-sm"
                style={{
                  background: "var(--bg-secondary)",
                  borderTop: "1px solid var(--border)",
                }}
              >
                <div className="grid grid-cols-2 gap-x-8 gap-y-2">
                  <div>
                    <span style={{ color: "var(--text-muted)" }}>Session:</span>{" "}
                    <a
                      href={`/vault/${entry.session_dir.replace("vault/", "")}`}
                      style={{ color: "var(--accent)" }}
                    >
                      {entry.session_dir}
                    </a>
                  </div>
                  {entry.source_url && (
                    <div>
                      <span style={{ color: "var(--text-muted)" }}>Source:</span>{" "}
                      <span className="truncate inline-block max-w-xs align-bottom">
                        {entry.source_url}
                      </span>
                    </div>
                  )}
                  {entry.virality_score !== null && (
                    <div>
                      <span style={{ color: "var(--text-muted)" }}>
                        Virality:
                      </span>{" "}
                      {entry.virality_score}
                    </div>
                  )}
                  {Object.keys(entry.published_urls).length > 0 && (
                    <div>
                      <span style={{ color: "var(--text-muted)" }}>
                        Published URLs:
                      </span>
                      {Object.entries(entry.published_urls).map(
                        ([platform]) => (
                          <span key={platform} className="ml-2">
                            {platform}
                          </span>
                        )
                      )}
                    </div>
                  )}
                  {entry.analytics && (
                    <div>
                      <span style={{ color: "var(--text-muted)" }}>
                        Performance:
                      </span>{" "}
                      {entry.analytics.performance_score}/10
                    </div>
                  )}
                </div>
                {entry.tags.length > 0 && (
                  <div className="mt-2 flex gap-1">
                    {entry.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 rounded text-xs"
                        style={{
                          background: "var(--bg-card)",
                          color: "var(--text-secondary)",
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
