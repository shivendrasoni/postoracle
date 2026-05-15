import StatCard from "@/components/stat-card";
import SavesTable from "@/components/saves-table";
import AnimateIn from "@/components/animate-in";
import { loadAllSaves } from "@/lib/saves";

export const dynamic = "force-dynamic";

export default async function SavesPage() {
  const posts = await loadAllSaves();

  if (posts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="rounded-[2rem] bg-white/[0.02] border border-white/[0.06] p-2">
          <div className="rounded-[calc(2rem-0.5rem)] bg-surface/60 px-12 py-16 text-center shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)]">
            <p className="text-lg font-medium text-content mb-2">
              No saves yet
            </p>
            <p className="text-[13px] text-sub leading-relaxed">
              Run{" "}
              <code className="font-mono text-accent bg-accent-soft px-2 py-0.5 rounded-md">
                /sync-instagram
              </code>{" "}
              in Claude Code to import your saved posts.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const platforms = new Set(posts.map((p) => p.platform));
  const totalViews = posts.reduce((sum, p) => sum + p.view_count, 0);
  const downloaded = posts.filter((p) => p.downloaded).length;

  return (
    <div>
      <AnimateIn>
        <div className="mb-10">
          <span className="rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.2em] font-medium bg-accent-soft text-accent">
            Saves
          </span>
          <h1 className="text-2xl font-semibold tracking-tight text-content mt-3">
            Saved posts
          </h1>
          <p className="text-[12px] text-muted mt-1">
            {platforms.size} platform{platforms.size !== 1 ? "s" : ""} synced
          </p>
        </div>
      </AnimateIn>

      <AnimateIn delay={100} className="mb-10">
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Saved" value={posts.length} />
          <StatCard
            label="Total views"
            value={totalViews}
            accent="var(--color-accent)"
          />
          <StatCard
            label="Downloaded"
            value={downloaded}
            accent="var(--color-live)"
          />
        </div>
      </AnimateIn>

      <AnimateIn delay={200}>
        <SavesTable posts={posts} />
      </AnimateIn>
    </div>
  );
}
