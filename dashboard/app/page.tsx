import StatCard from "@/components/stat-card";
import ContentTable from "@/components/content-table";
import { readVaultJson, vaultPathExists } from "@/lib/vault";
import type { RegistryEntry } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function Home() {
  const exists = await vaultPathExists("content-registry.json");
  if (!exists) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <p className="text-lg mb-2">No content yet</p>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Run <code>/setup</code> then <code>/make-reel</code> in Claude Code to
          get started.
        </p>
      </div>
    );
  }

  const entries = await readVaultJson<RegistryEntry[]>("content-registry.json");
  const drafts = entries.filter((e) => e.status === "draft").length;
  const published = entries.filter((e) => e.status === "published").length;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Content Registry</h1>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard label="Total" value={entries.length} />
        <StatCard label="Drafts" value={drafts} color="var(--yellow)" />
        <StatCard label="Published" value={published} color="var(--green)" />
      </div>

      <ContentTable entries={entries} />
    </div>
  );
}
