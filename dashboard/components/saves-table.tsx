"use client";

import { useState } from "react";
import type { SavedPost } from "@/lib/types";
import {
  FilmStrip,
  Images,
  Article,
  File,
  ArrowSquareOut,
  SortAscending,
  Heart,
  Eye,
  ChatCircle,
  CaretRight,
  DownloadSimple,
  ArrowsClockwise,
  ChartBar,
} from "@phosphor-icons/react";

const TYPE_ICONS: Record<string, typeof FilmStrip> = {
  reel: FilmStrip,
  carousel: Images,
  post: Article,
};

type SortKey = "date" | "views" | "likes";

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

interface SavesTableProps {
  posts: SavedPost[];
}

export default function SavesTable({ posts }: SavesTableProps) {
  const [platformFilter, setPlatformFilter] = useState("all");
  const [collectionFilter, setCollectionFilter] = useState("all");
  const [sortBy, setSortBy] = useState<SortKey>("date");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const platforms = ["all", ...new Set(posts.map((p) => p.platform))];
  const collections = [
    "all",
    ...new Set(posts.map((p) => p.collection).filter(Boolean)),
  ];

  const filtered = posts.filter((p) => {
    if (platformFilter !== "all" && p.platform !== platformFilter) return false;
    if (collectionFilter !== "all" && p.collection !== collectionFilter)
      return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === "views") return b.view_count - a.view_count;
    if (sortBy === "likes") return b.like_count - a.like_count;
    return (
      new Date(b.synced_at).getTime() - new Date(a.synced_at).getTime()
    );
  });

  const sortLabels: Record<SortKey, string> = {
    date: "Newest",
    views: "Most viewed",
    likes: "Most liked",
  };
  const sortCycle: SortKey[] = ["date", "views", "likes"];

  function cycleSortBy() {
    const idx = sortCycle.indexOf(sortBy);
    setSortBy(sortCycle[(idx + 1) % sortCycle.length]);
  }

  return (
    <div>
      {/* Filter pills */}
      <div className="flex items-center gap-1.5 mb-6 flex-wrap">
        {platforms.map((p) => (
          <button
            key={p}
            onClick={() => setPlatformFilter(p)}
            className={`
              px-3 py-1.5 rounded-full text-[12px] capitalize
              transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]
              ${
                platformFilter === p
                  ? "bg-white/[0.08] text-content font-medium shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)]"
                  : "text-muted hover:text-sub hover:bg-white/[0.03]"
              }
            `}
          >
            {p === "all" ? "All platforms" : p}
          </button>
        ))}
        {collections.length > 1 && (
          <>
            <span className="w-px h-4 bg-white/[0.06] mx-1.5" />
            {collections.map((c) => (
              <button
                key={c}
                onClick={() => setCollectionFilter(c)}
                className={`
                  px-3 py-1.5 rounded-full text-[12px]
                  transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]
                  ${
                    collectionFilter === c
                      ? "bg-white/[0.08] text-content font-medium shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)]"
                      : "text-muted hover:text-sub hover:bg-white/[0.03]"
                  }
                `}
              >
                {c === "all" ? "All collections" : c}
              </button>
            ))}
          </>
        )}
        <span className="w-px h-4 bg-white/[0.06] mx-1.5" />
        <button
          onClick={cycleSortBy}
          className="group flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] text-muted hover:text-sub hover:bg-white/[0.03] transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]"
        >
          <SortAscending
            size={13}
            weight="light"
            className="transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:scale-110"
          />
          {sortLabels[sortBy]}
        </button>
      </div>

      {/* Table — double-bezel */}
      <div className="rounded-[1.5rem] bg-white/[0.02] border border-white/[0.06] p-1.5">
        <div className="rounded-[calc(1.5rem-0.375rem)] bg-surface/40 overflow-hidden">
          {sorted.length === 0 && (
            <div className="py-16 text-center">
              <p className="text-[13px] text-muted">No saves match.</p>
            </div>
          )}
          {sorted.map((post, i) => {
            const Icon = TYPE_ICONS[post.type] ?? File;
            const isExpanded = expandedId === post.shortcode;

            return (
              <div
                key={post.shortcode}
                className={i > 0 ? "border-t border-white/[0.04]" : ""}
              >
                <button
                  className="group w-full flex items-center gap-4 px-5 py-4 text-left
                    transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]
                    hover:bg-white/[0.02] active:scale-[0.998]"
                  onClick={() =>
                    setExpandedId(isExpanded ? null : post.shortcode)
                  }
                >
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-accent-soft text-accent">
                    <Icon size={18} weight="light" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium text-content truncate">
                      {post.caption.split("\n")[0] || post.shortcode}
                    </div>
                    <div className="text-[12px] text-muted mt-0.5 flex items-center gap-1.5">
                      <span className="capitalize">{post.platform}</span>
                      <span className="text-faint">·</span>
                      <span>{post.author_name || post.author}</span>
                      <span className="text-faint">·</span>
                      <span>
                        {new Date(post.synced_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                  </div>

                  {/* Engagement chips */}
                  <div className="hidden md:flex items-center gap-3 shrink-0">
                    {post.view_count > 0 && (
                      <span className="flex items-center gap-1 text-[11px] text-muted">
                        <Eye size={12} weight="light" />
                        {formatNumber(post.view_count)}
                      </span>
                    )}
                    {post.like_count > 0 && (
                      <span className="flex items-center gap-1 text-[11px] text-muted">
                        <Heart size={12} weight="light" />
                        {formatNumber(post.like_count)}
                      </span>
                    )}
                    {post.comment_count > 0 && (
                      <span className="flex items-center gap-1 text-[11px] text-muted">
                        <ChatCircle size={12} weight="light" />
                        {formatNumber(post.comment_count)}
                      </span>
                    )}
                  </div>

                  {/* Action buttons — visible on hover */}
                  <div
                    className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <a
                      href={`/?topic=${encodeURIComponent(`Repurpose: ${post.link || post.shortcode}`)}&type=reel`}
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
                    </a>
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

                  {post.downloaded && (
                    <DownloadSimple
                      size={13}
                      weight="light"
                      className="text-emerald shrink-0"
                    />
                  )}

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
                      {post.link && (
                        <div className="flex items-center gap-2">
                          <span className="text-muted">Source</span>
                          <a
                            href={post.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-accent hover:underline transition-colors duration-300"
                          >
                            Open on {post.platform}
                            <ArrowSquareOut size={12} weight="bold" />
                          </a>
                        </div>
                      )}
                      {post.author_name && (
                        <div>
                          <span className="text-muted">Author </span>
                          <span className="text-sub">
                            {post.author_name}{" "}
                            {post.author && (
                              <span className="text-muted">{post.author}</span>
                            )}
                          </span>
                        </div>
                      )}
                      {post.collection && (
                        <div>
                          <span className="text-muted">Collection </span>
                          <span className="text-sub">{post.collection}</span>
                        </div>
                      )}
                      {post.date_published && (
                        <div>
                          <span className="text-muted">Published </span>
                          <span className="text-sub">
                            {new Date(post.date_published).toLocaleDateString(
                              "en-US",
                              {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              }
                            )}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Engagement row (visible in expanded on mobile) */}
                    <div className="flex gap-4 mt-3 md:hidden">
                      {post.view_count > 0 && (
                        <span className="flex items-center gap-1 text-[12px] text-muted">
                          <Eye size={13} weight="light" />
                          {formatNumber(post.view_count)} views
                        </span>
                      )}
                      {post.like_count > 0 && (
                        <span className="flex items-center gap-1 text-[12px] text-muted">
                          <Heart size={13} weight="light" />
                          {formatNumber(post.like_count)} likes
                        </span>
                      )}
                      {post.comment_count > 0 && (
                        <span className="flex items-center gap-1 text-[12px] text-muted">
                          <ChatCircle size={13} weight="light" />
                          {formatNumber(post.comment_count)} comments
                        </span>
                      )}
                    </div>

                    {post.caption && (
                      <p className="mt-3 text-[12px] text-sub leading-relaxed line-clamp-3">
                        {post.caption}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
