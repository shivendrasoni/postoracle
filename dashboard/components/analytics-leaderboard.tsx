"use client";

import { useState } from "react";
import {
  FilmStrip,
  Images,
  Article,
  File,
  Crown,
  ArrowUpRight,
} from "@phosphor-icons/react";
import type { LeaderboardEntry } from "@/lib/analytics";

const TYPE_ICONS: Record<string, typeof FilmStrip> = {
  reel: FilmStrip,
  carousel: Images,
  post: Article,
};

const RANK_STYLES: Record<number, { ring: string; badge: string; text: string }> = {
  1: { ring: "ring-amber/30", badge: "bg-amber/10 text-amber", text: "text-amber" },
  2: { ring: "ring-white/10", badge: "bg-white/[0.06] text-sub", text: "text-sub" },
  3: { ring: "ring-white/[0.06]", badge: "bg-white/[0.04] text-muted", text: "text-muted" },
};

function ScorePill({ score }: { score: number }) {
  const color =
    score >= 8 ? "text-emerald bg-emerald-soft" :
    score >= 5 ? "text-amber bg-amber-soft" :
    score > 0 ? "text-accent bg-accent-soft" :
    "text-muted bg-white/[0.04]";

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold tabular-nums ${color}`}>
      {score.toFixed(1)}
    </span>
  );
}

export default function AnalyticsLeaderboard({ entries }: { entries: LeaderboardEntry[] }) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  if (entries.length === 0) {
    return (
      <div className="rounded-[1.5rem] bg-white/[0.02] border border-white/[0.06] p-1.5">
        <div className="rounded-[calc(1.5rem-0.375rem)] bg-surface/60 shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)] px-8 py-12 text-center">
          <div className="text-[11px] font-medium tracking-[0.15em] uppercase text-muted mb-4">
            Performance Leaderboard
          </div>
          <p className="text-[13px] text-sub leading-relaxed">
            Publish content and run{" "}
            <code className="font-mono text-accent bg-accent-soft px-2 py-0.5 rounded-md text-[12px]">
              /analytics
            </code>{" "}
            to see performance rankings here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[1.5rem] bg-white/[0.02] border border-white/[0.06] p-1.5">
      <div className="rounded-[calc(1.5rem-0.375rem)] bg-surface/60 shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)] overflow-hidden">
        <div className="px-6 pt-6 pb-4 flex items-center justify-between">
          <div className="text-[11px] font-medium tracking-[0.15em] uppercase text-muted">
            Performance Leaderboard
          </div>
          <div className="text-[11px] text-muted tabular-nums">
            {entries.length} {entries.length === 1 ? "piece" : "pieces"}
          </div>
        </div>

        <div>
          {entries.map((entry) => {
            const Icon = TYPE_ICONS[entry.type] ?? File;
            const rankStyle = RANK_STYLES[entry.rank] ?? {
              ring: "ring-transparent",
              badge: "bg-white/[0.03] text-muted",
              text: "text-muted",
            };
            const isHovered = hoveredId === entry.id;

            return (
              <div
                key={entry.id}
                className={`
                  group flex items-center gap-4 px-6 py-4 border-t border-white/[0.04]
                  transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]
                  hover:bg-white/[0.015]
                `}
                onMouseEnter={() => setHoveredId(entry.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                {/* Rank */}
                <div className={`
                  w-8 h-8 rounded-lg ring-1 ${rankStyle.ring} ${rankStyle.badge}
                  flex items-center justify-center shrink-0
                  text-[12px] font-semibold tabular-nums
                `}>
                  {entry.rank === 1 ? (
                    <Crown size={14} weight="fill" className="text-amber" />
                  ) : (
                    entry.rank
                  )}
                </div>

                {/* Type icon */}
                <div className="w-9 h-9 rounded-xl bg-white/[0.04] flex items-center justify-center shrink-0">
                  <Icon size={16} weight="light" className="text-sub" />
                </div>

                {/* Content info */}
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium text-content truncate leading-snug">
                    {entry.topic}
                  </div>
                  <div className="text-[11px] text-muted mt-0.5 flex items-center gap-1.5">
                    <span className="capitalize">{entry.type}</span>
                    {entry.publishedAt && (
                      <>
                        <span className="text-faint">·</span>
                        <span>
                          {new Date(entry.publishedAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      </>
                    )}
                    <span className="text-faint">·</span>
                    <span>{entry.platforms.join(", ")}</span>
                  </div>
                </div>

                {/* Score */}
                <ScorePill score={entry.score} />

                {/* Arrow */}
                <ArrowUpRight
                  size={14}
                  weight="light"
                  className={`
                    text-muted shrink-0
                    transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]
                    ${isHovered ? "translate-x-0.5 -translate-y-0.5 text-sub" : ""}
                  `}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
