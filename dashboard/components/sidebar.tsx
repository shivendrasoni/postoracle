"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Rows,
  ChartLineUp,
  Palette,
  FolderLock,
  Lightning,
  Fire,
} from "@phosphor-icons/react";
import type { RegistryEntry } from "@/lib/types";
import {
  calculateXp,
  getLevel,
  calculateStreak,
} from "@/lib/gamification";
import ProgressRing from "./progress-ring";

const NAV_ITEMS = [
  { href: "/", label: "Content", Icon: Rows },
  { href: "/analytics", label: "Analytics", Icon: ChartLineUp },
  { href: "/brand", label: "Brand", Icon: Palette },
  { href: "/vault", label: "Vault", Icon: FolderLock },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [stats, setStats] = useState({
    level: 1,
    title: "Newcomer",
    progress: 0,
    xp: 0,
    streak: 0,
    total: 0,
  });

  useEffect(() => {
    fetch("/api/registry")
      .then((res) => (res.ok ? res.json() : []))
      .then((entries: RegistryEntry[]) => {
        const xp = calculateXp(entries);
        const level = getLevel(xp);
        const streak = calculateStreak(entries);
        setStats({ ...level, xp, streak, total: entries.length });
      })
      .catch(() => {});
  }, []);

  return (
    <aside className="fixed left-0 top-0 h-dvh w-[260px] z-30">
      <div className="absolute inset-0 bg-panel/90 backdrop-blur-xl border-r border-white/[0.06]" />
      <div
        className="absolute -top-20 -right-20 w-60 h-60 pointer-events-none opacity-[0.04]"
        style={{
          background:
            "radial-gradient(circle, #a78bfa 0%, transparent 70%)",
        }}
      />

      <div className="relative z-10 flex flex-col h-full">
        {/* Logo */}
        <div className="px-7 pt-8 pb-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-accent to-emerald flex items-center justify-center shadow-[0_0_20px_rgba(167,139,250,0.15)]">
              <Lightning size={16} weight="bold" className="text-white" />
            </div>
            <span className="text-[15px] font-semibold tracking-tight text-content">
              PostOracle
            </span>
          </div>
        </div>

        {/* Level card — double-bezel */}
        <div className="mx-4 mt-6 mb-6">
          <div className="rounded-[1.25rem] bg-white/[0.03] border border-white/[0.06] p-1.5">
            <div className="rounded-[calc(1.25rem-0.375rem)] bg-surface/80 p-4 shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)]">
              <div className="flex items-center gap-3 mb-3">
                <ProgressRing
                  progress={stats.progress}
                  size={40}
                  strokeWidth={3}
                />
                <div>
                  <div className="text-[11px] font-medium tracking-[0.15em] uppercase text-accent">
                    Level {stats.level}
                  </div>
                  <div className="text-[13px] font-medium text-content">
                    {stats.title}
                  </div>
                </div>
              </div>
              <div className="w-full h-1 rounded-full bg-white/[0.06] overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    stats.progress > 0.8
                      ? "bg-gradient-to-r from-accent via-emerald to-accent bg-[length:200%_100%] animate-[shimmer_3s_linear_infinite]"
                      : "bg-gradient-to-r from-accent to-emerald"
                  }`}
                  style={{
                    width: `${stats.progress * 100}%`,
                    transition:
                      "width 1200ms cubic-bezier(0.32, 0.72, 0, 1)",
                  }}
                />
              </div>
              <div className="text-[11px] text-muted mt-1.5">
                {stats.xp} XP
                {stats.level < 5 &&
                  ` · ${Math.round(stats.progress * 100)}% to next`}
              </div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 flex flex-col gap-0.5">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  group flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px]
                  transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]
                  ${
                    isActive
                      ? "bg-white/[0.06] text-content font-medium shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)]"
                      : "text-sub hover:text-content hover:bg-white/[0.03]"
                  }
                `}
              >
                <item.Icon
                  size={18}
                  weight={isActive ? "fill" : "light"}
                  className={`transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${
                    isActive ? "text-accent" : "group-hover:text-content"
                  }`}
                />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-7 py-5 space-y-3">
          {stats.streak > 0 && (
            <div className="flex items-center gap-2 text-[12px]">
              <Fire size={14} weight="fill" className="text-flame" />
              <span className="text-sub">
                {stats.streak} day streak
              </span>
            </div>
          )}
          <div className="text-[11px] text-muted">localhost · read-only</div>
        </div>
      </div>
    </aside>
  );
}
