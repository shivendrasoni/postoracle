"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Rows,
  ChartLineUp,
  Palette,
  FolderLock,
  Lightning,
  Plus,
  FilmStrip,
  Images,
  Article,
  File,
  GearSix,
  BookmarkSimple,
} from "@phosphor-icons/react";
import type { RegistryEntry } from "@/lib/types";
import { useCompose } from "@/lib/compose-context";

const NAV_ITEMS = [
  { href: "/", label: "Home", Icon: Lightning },
  { href: "/content", label: "Content", Icon: Rows },
  { href: "/analytics", label: "Analytics", Icon: ChartLineUp },
  { href: "/brand", label: "Brand", Icon: Palette },
  { href: "/saves", label: "Saves", Icon: BookmarkSimple },
  { href: "/vault", label: "Vault", Icon: FolderLock },
  { href: "/settings", label: "Settings", Icon: GearSix },
];

const TYPE_ICONS: Record<string, typeof FilmStrip> = {
  reel: FilmStrip,
  carousel: Images,
  post: Article,
};

interface HistoryGroup {
  label: string;
  entries: RegistryEntry[];
}

function groupByDate(entries: RegistryEntry[]): HistoryGroup[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const weekAgo = new Date(today.getTime() - 7 * 86400000);

  const groups: Record<string, RegistryEntry[]> = {
    Today: [],
    Yesterday: [],
    "This week": [],
    Earlier: [],
  };

  for (const entry of entries) {
    const d = new Date(entry.created_at);
    if (d >= today) {
      groups["Today"].push(entry);
    } else if (d >= yesterday) {
      groups["Yesterday"].push(entry);
    } else if (d >= weekAgo) {
      groups["This week"].push(entry);
    } else {
      groups["Earlier"].push(entry);
    }
  }

  return Object.entries(groups)
    .filter(([, items]) => items.length > 0)
    .map(([label, items]) => ({ label, entries: items }));
}

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { reset } = useCompose();
  const [entries, setEntries] = useState<RegistryEntry[]>([]);

  useEffect(() => {
    fetch("/api/registry")
      .then((res) => (res.ok ? res.json() : []))
      .then((data: RegistryEntry[]) => {
        const sorted = [...data].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        setEntries(sorted);
      })
      .catch(() => {});
  }, []);

  function handleNewClick() {
    reset();
    if (pathname !== "/") {
      router.push("/");
    }
  }

  const historyGroups = groupByDate(entries);

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
        {/* Logo + New button */}
        <div className="px-5 pt-7 pb-2">
          <div className="flex items-center justify-between mb-5">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-accent to-emerald flex items-center justify-center shadow-[0_0_20px_rgba(167,139,250,0.15)]">
                <Lightning size={16} weight="bold" className="text-white" />
              </div>
              <span className="text-[15px] font-semibold tracking-tight text-content">
                PostOracle
              </span>
            </Link>
          </div>

          <button
            type="button"
            onClick={handleNewClick}
            className="
              w-full flex items-center justify-center gap-2
              px-4 py-2.5 rounded-xl
              bg-white/[0.06] border border-white/[0.08]
              text-[13px] font-medium text-content
              transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]
              hover:bg-white/[0.10] hover:border-white/[0.14]
              active:scale-[0.97]
            "
          >
            <Plus size={14} weight="bold" className="text-accent" />
            New
          </button>
        </div>

        {/* Creation history */}
        <div className="flex-1 overflow-y-auto px-3 py-3 scrollbar-thin">
          {historyGroups.length === 0 ? (
            <div className="px-3 py-8 text-center">
              <p className="text-[12px] text-muted/60 leading-relaxed">
                Your creations will appear here
              </p>
            </div>
          ) : (
            historyGroups.map((group) => (
              <div key={group.label} className="mb-4">
                <div className="px-2 mb-1.5">
                  <span className="text-[10px] font-medium tracking-[0.12em] uppercase text-muted/60">
                    {group.label}
                  </span>
                </div>
                {group.entries.map((entry) => {
                  const Icon = TYPE_ICONS[entry.type] ?? File;
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      className="
                        w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left
                        transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]
                        text-sub hover:text-content hover:bg-white/[0.04]
                        group
                      "
                    >
                      <Icon
                        size={14}
                        weight="light"
                        className="text-muted shrink-0 group-hover:text-accent transition-colors duration-300"
                      />
                      <span className="text-[12px] truncate leading-tight">
                        {entry.topic}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Bottom navigation */}
        <div className="border-t border-white/[0.04]">
          <nav className="px-3 py-3 flex flex-col gap-0.5">
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
                    group flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px]
                    transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]
                    ${
                      isActive
                        ? "bg-white/[0.06] text-content font-medium shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)]"
                        : "text-sub hover:text-content hover:bg-white/[0.03]"
                    }
                  `}
                >
                  <item.Icon
                    size={16}
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
          <div className="px-5 py-3 border-t border-white/[0.04]">
            <div className="text-[11px] text-muted">localhost</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
