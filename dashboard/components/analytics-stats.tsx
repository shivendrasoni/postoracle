"use client";

import { useEffect, useState } from "react";
import {
  Stack,
  RocketLaunch,
  TrendUp,
  CalendarCheck,
  Trophy,
  FileText,
} from "@phosphor-icons/react";
import type { AnalyticsStats } from "@/lib/analytics";

function AnimatedNumber({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (value === 0) { setDisplay(0); return; }
    const duration = 1200;
    const start = performance.now();
    const step = (time: number) => {
      const t = Math.min((time - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 4);
      setDisplay(eased * value);
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [value]);

  return <>{decimals > 0 ? display.toFixed(decimals) : Math.floor(display)}</>;
}

function ScoreRing({ score, size = 56 }: { score: number; size?: number }) {
  const [animated, setAnimated] = useState(0);
  const sw = 3.5;
  const r = (size - sw) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - animated * circ;

  useEffect(() => {
    const t = setTimeout(() => setAnimated(score / 10), 300);
    return () => clearTimeout(t);
  }, [score]);

  return (
    <svg width={size} height={size} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={sw} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={score > 7 ? "#34d399" : score > 4 ? "#f59e0b" : "#a78bfa"}
        strokeWidth={sw} strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dashoffset 1400ms cubic-bezier(0.32, 0.72, 0, 1)" }}
      />
    </svg>
  );
}

interface AnalyticsStatsProps {
  stats: AnalyticsStats;
  isSparse: boolean;
}

export default function AnalyticsStatsGrid({ stats, isSparse }: AnalyticsStatsProps) {
  const cards = [
    {
      label: "Total Content",
      value: stats.totalContent,
      icon: Stack,
      accent: "text-accent",
      accentBg: "bg-accent-soft",
    },
    {
      label: "Published",
      value: stats.totalPublished,
      icon: RocketLaunch,
      accent: "text-emerald",
      accentBg: "bg-emerald-soft",
    },
    {
      label: "Drafts",
      value: stats.draftCount,
      icon: FileText,
      accent: "text-amber",
      accentBg: "bg-amber-soft",
    },
    {
      label: "This Week",
      value: stats.publishedThisWeek,
      icon: CalendarCheck,
      accent: "text-flame",
      accentBg: "bg-flame-soft",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
      {/* Stat cards — top row */}
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div key={card.label} className="md:col-span-3">
            <div className="rounded-[1.5rem] bg-white/[0.02] border border-white/[0.06] p-1.5 h-full">
              <div className="rounded-[calc(1.5rem-0.375rem)] bg-surface/60 p-5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)] h-full">
                <div className={`w-9 h-9 rounded-xl ${card.accentBg} flex items-center justify-center mb-4`}>
                  <Icon size={17} weight="light" className={card.accent} />
                </div>
                <div className="text-[11px] font-medium tracking-[0.15em] uppercase text-muted mb-1.5">
                  {card.label}
                </div>
                <div className={`text-3xl font-semibold tracking-tight text-content`}>
                  <AnimatedNumber value={card.value} />
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {/* Avg Performance Score — wider card */}
      <div className="md:col-span-8">
        <div className="rounded-[1.5rem] bg-white/[0.02] border border-white/[0.06] p-1.5 h-full">
          <div className="rounded-[calc(1.5rem-0.375rem)] bg-surface/60 p-6 shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)] h-full">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="w-9 h-9 rounded-xl bg-accent-soft flex items-center justify-center">
                    <TrendUp size={17} weight="light" className="text-accent" />
                  </div>
                  <span className="text-[11px] font-medium tracking-[0.15em] uppercase text-muted">
                    Avg Performance
                  </span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-5xl font-semibold tracking-tight text-content">
                    <AnimatedNumber value={stats.avgScore} decimals={1} />
                  </span>
                  <span className="text-lg text-muted font-medium">/10</span>
                </div>
                {isSparse && (
                  <p className="text-[12px] text-muted mt-3 max-w-sm leading-relaxed">
                    Metrics are warming up. Scores populate after content is published and engagement data flows in.
                  </p>
                )}
              </div>
              <ScoreRing score={stats.avgScore} size={72} />
            </div>
          </div>
        </div>
      </div>

      {/* Best Performer — narrower card */}
      <div className="md:col-span-4">
        <div className="rounded-[1.5rem] bg-white/[0.02] border border-white/[0.06] p-1.5 h-full">
          <div className="rounded-[calc(1.5rem-0.375rem)] bg-surface/60 p-6 shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)] h-full flex flex-col">
            <div className="w-9 h-9 rounded-xl bg-emerald-soft flex items-center justify-center mb-4">
              <Trophy size={17} weight="light" className="text-emerald" />
            </div>
            <div className="text-[11px] font-medium tracking-[0.15em] uppercase text-muted mb-2">
              Best Performer
            </div>
            {stats.bestPerformer ? (
              <>
                <p className="text-[13px] font-medium text-content leading-snug line-clamp-2 flex-1">
                  {stats.bestPerformer.topic}
                </p>
                <div className="flex items-center gap-2 mt-3">
                  <span className="text-2xl font-semibold tracking-tight text-emerald">
                    {stats.bestPerformer.score.toFixed(1)}
                  </span>
                  <span className="text-[12px] text-muted">/10</span>
                </div>
              </>
            ) : (
              <p className="text-[12px] text-muted leading-relaxed flex-1">
                Publish content and pull analytics to see your top performer here.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
