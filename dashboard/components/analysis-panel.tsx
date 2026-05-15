"use client";

import type { SavedPost } from "@/lib/types";
import MarkdownViewer from "@/components/markdown-viewer";

interface AnalysisPanelProps {
  post: SavedPost;
}

const VERDICT_STYLES: Record<
  string,
  { bg: string; text: string; border: string; label: string }
> = {
  recreate: {
    bg: "bg-emerald/10",
    text: "text-emerald",
    border: "border-emerald/20",
    label: "Recreate",
  },
  skip: {
    bg: "bg-flame/10",
    text: "text-flame",
    border: "border-flame/20",
    label: "Skip",
  },
  adapt: {
    bg: "bg-amber/10",
    text: "text-amber",
    border: "border-amber/20",
    label: "Adapt",
  },
};

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 8
      ? "text-emerald bg-emerald-soft"
      : score >= 5
        ? "text-amber bg-amber-soft"
        : "text-accent bg-accent-soft";

  return (
    <span
      className={`inline-flex items-center px-3 py-1.5 rounded-full text-[18px] font-semibold tabular-nums ${color}`}
    >
      {score.toFixed(1)}
    </span>
  );
}

export default function AnalysisPanel({ post }: AnalysisPanelProps) {
  const verdict = post.content_verdict
    ? VERDICT_STYLES[post.content_verdict]
    : null;

  return (
    <div className="rounded-[1.5rem] bg-white/[0.02] border border-white/[0.06] p-1.5">
      <div className="rounded-[calc(1.5rem-0.375rem)] bg-surface/60 shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)] p-6">
        {/* Score header */}
        <div className="flex items-center gap-3 flex-wrap mb-6">
          {post.overall_score != null && (
            <ScoreBadge score={post.overall_score} />
          )}

          {verdict && (
            <span
              className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold border ${verdict.bg} ${verdict.text} ${verdict.border}`}
            >
              {verdict.label}
            </span>
          )}

          {post.angle && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium bg-white/[0.04] text-sub border border-white/[0.08]">
              {post.angle}
            </span>
          )}

          {post.format_type && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium bg-white/[0.04] text-muted border border-white/[0.06]">
              {post.format_type}
            </span>
          )}
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-4 flex-wrap mb-5">
          {post.hook_pattern && (
            <div>
              <span className="text-[11px] font-medium tracking-[0.15em] uppercase text-muted block mb-0.5">
                Hook Pattern
              </span>
              <span className="text-[13px] text-sub">{post.hook_pattern}</span>
            </div>
          )}

          {post.brand_alignment != null && (
            <div>
              <span className="text-[11px] font-medium tracking-[0.15em] uppercase text-muted block mb-0.5">
                Brand Alignment
              </span>
              <span
                className={`text-[13px] font-semibold tabular-nums ${
                  post.brand_alignment >= 8
                    ? "text-emerald"
                    : post.brand_alignment >= 5
                      ? "text-amber"
                      : "text-accent"
                }`}
              >
                {post.brand_alignment.toFixed(1)}
              </span>
            </div>
          )}

          {post.analysed_at && (
            <div>
              <span className="text-[11px] font-medium tracking-[0.15em] uppercase text-muted block mb-0.5">
                Analysed
              </span>
              <span className="text-[12px] text-muted">
                {new Date(post.analysed_at).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </div>
          )}
        </div>

        {/* Analysis body */}
        {post.analysis_body && (
          <div className="border-t border-white/[0.06] pt-5">
            <div className="text-[11px] font-medium tracking-[0.15em] uppercase text-muted mb-4">
              Detailed Analysis
            </div>
            <div className="[&_.prose]:text-[13px] [&_.prose_h3]:text-[12px] [&_.prose_h3]:uppercase [&_.prose_h3]:tracking-[0.1em] [&_.prose_h3]:text-muted [&_.prose_h3]:font-medium [&_.prose_table]:text-[12px]">
              <MarkdownViewer content={post.analysis_body} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
