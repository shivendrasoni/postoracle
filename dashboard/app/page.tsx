import StatCard from "@/components/stat-card";
import ContentTable from "@/components/content-table";
import { readVaultJson, vaultPathExists } from "@/lib/vault";
import type { RegistryEntry } from "@/lib/types";
import AnimateIn from "@/components/animate-in";

export const dynamic = "force-dynamic";

export default async function Home() {
  const exists = await vaultPathExists("content-registry.json");
  if (!exists) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="rounded-[2rem] bg-white/[0.02] border border-white/[0.06] p-2">
          <div className="rounded-[calc(2rem-0.5rem)] bg-surface/60 px-12 py-16 text-center shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)]">
            <p className="text-lg font-medium text-content mb-2">
              No content yet
            </p>
            <p className="text-[13px] text-sub leading-relaxed">
              Run{" "}
              <code className="font-mono text-accent bg-accent-soft px-2 py-0.5 rounded-md">
                /setup
              </code>{" "}
              then{" "}
              <code className="font-mono text-accent bg-accent-soft px-2 py-0.5 rounded-md">
                /make-reel
              </code>{" "}
              in Claude Code to get started.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const entries = await readVaultJson<RegistryEntry[]>(
    "content-registry.json"
  );
  const drafts = entries.filter((e) => e.status === "draft").length;
  const published = entries.filter((e) => e.status === "published").length;

  return (
    <div>
      <AnimateIn>
        <div className="mb-10">
          <span className="rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.2em] font-medium bg-accent-soft text-accent">
            Dashboard
          </span>
          <h1 className="text-2xl font-semibold tracking-tight text-content mt-3">
            Content registry
          </h1>
        </div>
      </AnimateIn>

      <AnimateIn delay={100} className="mb-10">
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Total" value={entries.length} />
          <StatCard
            label="Drafts"
            value={drafts}
            accent="var(--color-pending)"
          />
          <StatCard
            label="Published"
            value={published}
            accent="var(--color-live)"
          />
        </div>
      </AnimateIn>

      <AnimateIn delay={200}>
        <ContentTable entries={entries} />
      </AnimateIn>
    </div>
  );
}
