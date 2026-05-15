import Link from "next/link";
import { notFound } from "next/navigation";
import AnimateIn from "@/components/animate-in";
import AnalysisPanel from "@/components/analysis-panel";
import NotAnalysedCard from "@/components/not-analysed-card";
import { loadSaveByShortcode } from "@/lib/saves";
import {
  ArrowLeft,
  ArrowSquareOut,
  FilmStrip,
  Images,
  Article,
  File,
  Eye,
  Heart,
  ChatCircle,
  DownloadSimple,
} from "@phosphor-icons/react/dist/ssr";

export const dynamic = "force-dynamic";

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

const TYPE_ICONS: Record<string, typeof FilmStrip> = {
  reel: FilmStrip,
  carousel: Images,
  post: Article,
};

export default async function SaveDetailPage({
  params,
}: {
  params: Promise<{ shortcode: string }>;
}) {
  const { shortcode } = await params;
  const post = await loadSaveByShortcode(shortcode);

  if (!post) notFound();

  const Icon = TYPE_ICONS[post.type] ?? File;

  return (
    <div>
      <AnimateIn>
        <Link
          href="/saves"
          className="inline-flex items-center gap-1.5 text-[12px] text-muted hover:text-sub transition-colors duration-300 mb-6"
        >
          <ArrowLeft size={14} weight="light" />
          Back to saves
        </Link>

        {/* Header */}
        <div className="flex items-start gap-4 mb-8">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-accent-soft text-accent">
            <Icon size={22} weight="light" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-semibold tracking-tight text-content leading-snug">
              {post.caption.split("\n")[0] || post.shortcode}
            </h1>
            <div className="text-[12px] text-muted mt-1 flex items-center gap-1.5 flex-wrap">
              <span className="capitalize">{post.platform}</span>
              <span className="text-faint">·</span>
              <span>{post.author_name || post.author}</span>
              {post.date_published && (
                <>
                  <span className="text-faint">·</span>
                  <span>
                    {new Date(post.date_published).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </>
              )}
              {post.link && (
                <>
                  <span className="text-faint">·</span>
                  <a
                    href={post.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-accent hover:underline"
                  >
                    Open original
                    <ArrowSquareOut size={11} weight="bold" />
                  </a>
                </>
              )}
            </div>
          </div>
        </div>
      </AnimateIn>

      {/* Stats row */}
      <AnimateIn delay={100} className="mb-8">
        <div className="flex items-center gap-5 flex-wrap">
          {post.view_count > 0 && (
            <div className="flex items-center gap-1.5 text-[13px] text-sub">
              <Eye size={15} weight="light" className="text-muted" />
              {formatNumber(post.view_count)} views
            </div>
          )}
          {post.like_count > 0 && (
            <div className="flex items-center gap-1.5 text-[13px] text-sub">
              <Heart size={15} weight="light" className="text-muted" />
              {formatNumber(post.like_count)} likes
            </div>
          )}
          {post.comment_count > 0 && (
            <div className="flex items-center gap-1.5 text-[13px] text-sub">
              <ChatCircle size={15} weight="light" className="text-muted" />
              {formatNumber(post.comment_count)} comments
            </div>
          )}
          {post.downloaded && (
            <div className="flex items-center gap-1.5 text-[13px] text-emerald">
              <DownloadSimple size={15} weight="light" />
              Downloaded
            </div>
          )}
          {post.collection && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium bg-white/[0.04] text-muted border border-white/[0.06]">
              {post.collection}
            </span>
          )}
        </div>
      </AnimateIn>

      {/* Caption */}
      {post.caption && (
        <AnimateIn delay={150} className="mb-8">
          <div className="rounded-[1.25rem] bg-white/[0.02] border border-white/[0.06] p-1.5">
            <div className="rounded-[calc(1.25rem-0.375rem)] bg-surface/60 p-5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)]">
              <span className="text-[11px] font-medium tracking-[0.15em] uppercase text-muted block mb-3">
                Caption
              </span>
              <p className="text-[13px] text-sub leading-relaxed whitespace-pre-line">
                {post.caption}
              </p>
            </div>
          </div>
        </AnimateIn>
      )}

      {/* Analysis */}
      <AnimateIn delay={200}>
        {post.analysed_at ? (
          <AnalysisPanel post={post} />
        ) : (
          <NotAnalysedCard shortcode={post.shortcode} />
        )}
      </AnimateIn>
    </div>
  );
}
