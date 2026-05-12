"use client";

import { useEffect, useState } from "react";
import { FilmStrip, Images, Article } from "@phosphor-icons/react";
import type { ContentTypeBreakdown } from "@/lib/analytics";

const TYPE_META: Record<string, { icon: typeof FilmStrip; color: string; bg: string }> = {
  reel: { icon: FilmStrip, color: "text-accent", bg: "bg-accent-soft" },
  carousel: { icon: Images, color: "text-emerald", bg: "bg-emerald-soft" },
  post: { icon: Article, color: "text-amber", bg: "bg-amber-soft" },
};

function AnimatedBar({ percentage, color, delay }: { percentage: number; color: string; delay: number }) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setWidth(percentage), delay);
    return () => clearTimeout(t);
  }, [percentage, delay]);

  return (
    <div className="h-2 rounded-full bg-white/[0.04] overflow-hidden flex-1">
      <div
        className={`h-full rounded-full ${color}`}
        style={{
          width: `${Math.max(width, 2)}%`,
          transition: "width 1200ms cubic-bezier(0.32, 0.72, 0, 1)",
        }}
      />
    </div>
  );
}

const BAR_COLORS: Record<string, string> = {
  reel: "bg-accent",
  carousel: "bg-emerald",
  post: "bg-amber",
};

export default function ContentTypesCard({ types }: { types: ContentTypeBreakdown[] }) {
  if (types.length === 0) return null;

  return (
    <div className="rounded-[1.5rem] bg-white/[0.02] border border-white/[0.06] p-1.5 h-full">
      <div className="rounded-[calc(1.5rem-0.375rem)] bg-surface/60 p-6 shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)] h-full">
        <div className="text-[11px] font-medium tracking-[0.15em] uppercase text-muted mb-6">
          Content Mix
        </div>

        <div className="space-y-5">
          {types.map((t, i) => {
            const meta = TYPE_META[t.type] ?? TYPE_META.post;
            const Icon = meta.icon;

            return (
              <div key={t.type}>
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-7 h-7 rounded-lg ${meta.bg} flex items-center justify-center`}>
                      <Icon size={14} weight="light" className={meta.color} />
                    </div>
                    <span className="text-[13px] font-medium text-content capitalize">{t.type}s</span>
                  </div>
                  <div className="flex items-center gap-3 text-[12px]">
                    <span className="text-sub tabular-nums">
                      {t.published}/{t.total}
                      <span className="text-muted ml-1">published</span>
                    </span>
                    {t.avgScore > 0 && (
                      <span className="text-content font-medium tabular-nums">{t.avgScore.toFixed(1)}</span>
                    )}
                  </div>
                </div>
                <AnimatedBar
                  percentage={t.percentage}
                  color={BAR_COLORS[t.type] ?? "bg-accent"}
                  delay={200 + i * 100}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
