"use client";

import { useState, useEffect } from "react";
import {
  FilmStrip,
  Images,
  Article,
  File,
  ArrowUpRight,
  ArrowsClockwise,
  ChartBar,
  Eye,
  Heart,
} from "@phosphor-icons/react";
import type { RegistryEntry, SavedPost } from "@/lib/types";
import { useCompose } from "@/lib/compose-context";
import ComposeArea from "./compose-area";
import StatusBadge from "../status-badge";
import AnimateIn from "../animate-in";

const TYPE_ICONS: Record<string, typeof FilmStrip> = {
  reel: FilmStrip,
  carousel: Images,
  post: Article,
};

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

interface ComposeHomeProps {
  entries: RegistryEntry[];
  saves?: SavedPost[];
  agentReady?: boolean;
}

export default function ComposeHome({ entries, saves = [], agentReady = false }: ComposeHomeProps) {
  const [visible, setVisible] = useState(false);
  const { dispatch } = useCompose();
  const recentEntries = entries
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 6);
  const recentSaves = saves.slice(0, 8);

  function handleRepurpose(post: SavedPost) {
    const source = post.link || post.shortcode;
    dispatch({ kind: "SET_TOPIC", topic: `Repurpose: ${source}` });
    dispatch({ kind: "SET_TYPE", type: "reel" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  useEffect(() => {
    setVisible(true);
  }, []);

  return (
    <div className="flex flex-col items-center">
      {/* Hero section */}
      <div
        className="text-center mb-12 mt-4"
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0)" : "translateY(1.5rem)",
          transition: "opacity 800ms cubic-bezier(0.32, 0.72, 0, 1), transform 800ms cubic-bezier(0.32, 0.72, 0, 1)",
        }}
      >
        <h1 className="text-[2.25rem] font-semibold tracking-[-0.03em] text-content leading-tight">
          Turn your ideas into
          <br />
          <span className="bg-gradient-to-r from-accent via-emerald to-accent bg-[length:200%_auto] bg-clip-text text-transparent animate-[shimmer_6s_linear_infinite]">
            publish-ready content
          </span>
        </h1>
        <p className="text-[15px] text-sub mt-4 max-w-md mx-auto leading-relaxed">
          Describe what you want to create. PostOracle handles the research,
          scripting, and production.
        </p>
      </div>

      {/* Compose card */}
      <AnimateIn delay={150} className="w-full">
        {agentReady ? (
          <ComposeArea />
        ) : (
          <div className="w-full max-w-[760px] mx-auto">
            <div className="rounded-[2rem] bg-white/[0.02] border border-white/[0.06] p-2">
              <div className="rounded-[calc(2rem-0.5rem)] bg-surface/60 px-12 py-14 text-center shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)]">
                <p className="text-[15px] font-medium text-content mb-2">
                  Agent not configured
                </p>
                <p className="text-[13px] text-sub leading-relaxed max-w-md mx-auto">
                  Add{" "}
                  <code className="font-mono text-accent bg-accent-soft px-2 py-0.5 rounded-md text-[12px]">
                    ANTHROPIC_API_KEY
                  </code>{" "}
                  to your{" "}
                  <code className="font-mono text-accent bg-accent-soft px-2 py-0.5 rounded-md text-[12px]">
                    .env
                  </code>{" "}
                  file to enable content generation.
                </p>
                <a
                  href="/settings"
                  className="
                    inline-flex items-center gap-1.5 mt-5
                    px-5 py-2.5 rounded-full
                    bg-white/[0.06] border border-white/[0.08]
                    text-[13px] font-medium text-content
                    transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]
                    hover:bg-white/[0.10] hover:border-white/[0.14]
                    active:scale-[0.97]
                  "
                >
                  View settings
                  <ArrowUpRight size={13} weight="bold" className="text-accent" />
                </a>
              </div>
            </div>
          </div>
        )}
      </AnimateIn>

      {/* Saved content with hover actions */}
      {recentSaves.length > 0 && (
        <AnimateIn delay={250} className="w-full mt-16 max-w-[760px] mx-auto">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-[13px] font-medium tracking-[0.08em] uppercase text-muted">
              Saved content
            </h2>
            <a
              href="/saves"
              className="text-[12px] text-muted hover:text-sub transition-colors duration-300"
            >
              View all
            </a>
          </div>

          <div className="rounded-[1.5rem] bg-white/[0.02] border border-white/[0.06] p-1.5">
            <div className="rounded-[calc(1.5rem-0.375rem)] bg-surface/40 overflow-hidden">
              {recentSaves.map((post, i) => {
                const Icon = TYPE_ICONS[post.type] ?? File;
                return (
                  <div
                    key={post.shortcode}
                    className={`group relative flex items-center gap-4 px-5 py-3.5
                      transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]
                      hover:bg-white/[0.02]
                      ${i > 0 ? "border-t border-white/[0.04]" : ""}`}
                  >
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-accent-soft text-accent">
                      <Icon size={16} weight="light" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium text-content truncate">
                        {post.caption.split("\n")[0] || post.shortcode}
                      </div>
                      <div className="text-[11px] text-muted mt-0.5 flex items-center gap-1.5">
                        <span className="capitalize">{post.platform}</span>
                        <span className="text-faint">·</span>
                        <span>{post.author_name || post.author}</span>
                        {post.view_count > 0 && (
                          <>
                            <span className="text-faint">·</span>
                            <span className="flex items-center gap-0.5">
                              <Eye size={10} weight="light" />
                              {formatNumber(post.view_count)}
                            </span>
                          </>
                        )}
                        {post.like_count > 0 && (
                          <>
                            <span className="text-faint">·</span>
                            <span className="flex items-center gap-0.5">
                              <Heart size={10} weight="light" />
                              {formatNumber(post.like_count)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Hover actions */}
                    <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <button
                        type="button"
                        onClick={() => handleRepurpose(post)}
                        title="Repurpose"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full
                          bg-accent/10 text-accent text-[11px] font-medium
                          border border-accent/20
                          transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]
                          hover:bg-accent/20 hover:border-accent/30
                          active:scale-[0.96]"
                      >
                        <ArrowsClockwise size={12} weight="bold" />
                        Repurpose
                      </button>
                      <a
                        href={post.link || "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Analyse"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full
                          bg-white/[0.04] text-sub text-[11px] font-medium
                          border border-white/[0.08]
                          transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]
                          hover:bg-white/[0.08] hover:border-white/[0.12]
                          active:scale-[0.96]"
                      >
                        <ChartBar size={12} weight="bold" />
                        Analyse
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </AnimateIn>
      )}

      {/* Recent content cards (below the fold) */}
      {recentEntries.length > 0 && (
        <AnimateIn delay={350} className="w-full mt-20 max-w-[760px] mx-auto">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-[13px] font-medium tracking-[0.08em] uppercase text-muted">
              Recent creations
            </h2>
            <a
              href="/content"
              className="
                text-[12px] text-muted hover:text-sub
                transition-colors duration-300
              "
            >
              View all
            </a>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {recentEntries.map((entry) => {
              const Icon = TYPE_ICONS[entry.type] ?? File;
              return (
                <div
                  key={entry.id}
                  className="
                    group rounded-[1.25rem] bg-white/[0.02] border border-white/[0.06] p-1.5
                    transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]
                    hover:bg-white/[0.03] hover:border-white/[0.08]
                  "
                >
                  <div className="rounded-[calc(1.25rem-0.375rem)] bg-surface/60 p-4 shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)]">
                    <div className="flex items-start justify-between mb-3">
                      <div
                        className={`
                          w-8 h-8 rounded-lg flex items-center justify-center shrink-0
                          ${entry.status === "published"
                            ? "bg-emerald-soft text-emerald"
                            : "bg-accent-soft text-accent"
                          }
                        `}
                      >
                        <Icon size={15} weight="light" />
                      </div>
                      <StatusBadge status={entry.status} />
                    </div>
                    <div className="text-[13px] font-medium text-content leading-snug line-clamp-2 mb-2">
                      {entry.topic}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-muted">
                        {entry.type} · {new Date(entry.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                      <ArrowUpRight
                        size={12}
                        weight="bold"
                        className="
                          text-muted opacity-0 group-hover:opacity-100
                          transition-all duration-300
                          group-hover:translate-x-0.5 group-hover:-translate-y-0.5
                        "
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </AnimateIn>
      )}
    </div>
  );
}
