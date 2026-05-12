import { readVaultJson, vaultPathExists } from "@/lib/vault";
import { computeAnalytics } from "@/lib/analytics";
import AnimateIn from "@/components/animate-in";
import AnalyticsStatsGrid from "@/components/analytics-stats";
import ContentTypesCard from "@/components/analytics-content-types";
import PlatformsCard from "@/components/analytics-platforms";
import AnalyticsLeaderboard from "@/components/analytics-leaderboard";
import type { RegistryEntry } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const exists = await vaultPathExists("content-registry.json");
  if (!exists) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="rounded-[2rem] bg-white/[0.02] border border-white/[0.06] p-2">
          <div className="rounded-[calc(2rem-0.5rem)] bg-surface/60 px-12 py-16 text-center shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)]">
            <p className="text-lg font-medium text-content mb-2">
              No content yet
            </p>
            <p className="text-[13px] text-sub">
              Create content with{" "}
              <code className="font-mono text-accent bg-accent-soft px-2 py-0.5 rounded-md">
                /make-reel
              </code>{" "}
              or{" "}
              <code className="font-mono text-accent bg-accent-soft px-2 py-0.5 rounded-md">
                /make-post
              </code>{" "}
              then run{" "}
              <code className="font-mono text-accent bg-accent-soft px-2 py-0.5 rounded-md">
                /analytics
              </code>{" "}
              to see performance here.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const entries = await readVaultJson<RegistryEntry[]>("content-registry.json");
  const data = computeAnalytics(entries);

  return (
    <div>
      {/* Header */}
      <AnimateIn>
        <div className="mb-10">
          <span className="rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.2em] font-medium bg-emerald-soft text-emerald">
            Performance
          </span>
          <h1 className="text-2xl font-semibold tracking-tight text-content mt-3">
            Analytics
          </h1>
          {data.lastFetchedAt && (
            <p className="text-[12px] text-muted mt-1">
              Last synced {new Date(data.lastFetchedAt).toLocaleString()}
            </p>
          )}
          {data.isSparse && !data.lastFetchedAt && (
            <p className="text-[12px] text-muted mt-1">
              Run <code className="text-accent font-mono text-[11px]">/analytics</code> to pull engagement metrics
            </p>
          )}
        </div>
      </AnimateIn>

      {/* Stat cards bento */}
      <AnimateIn delay={80}>
        <AnalyticsStatsGrid stats={data.stats} isSparse={data.isSparse} />
      </AnimateIn>

      {/* Content types + Platforms — asymmetric split */}
      <AnimateIn delay={160} className="mt-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          <div className="md:col-span-7">
            <ContentTypesCard types={data.contentTypes} />
          </div>
          <div className="md:col-span-5">
            <PlatformsCard platforms={data.platforms} />
          </div>
        </div>
      </AnimateIn>

      {/* Leaderboard */}
      <AnimateIn delay={240} className="mt-4">
        <AnalyticsLeaderboard entries={data.leaderboard} />
      </AnimateIn>
    </div>
  );
}
