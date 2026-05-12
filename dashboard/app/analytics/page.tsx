import { readVaultFile, listVaultDir, vaultPathExists } from "@/lib/vault";
import matter from "gray-matter";
import MarkdownViewer from "@/components/markdown-viewer";
import type { AnalyticsReport } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const exists = await vaultPathExists("analytics");
  if (!exists) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <p className="text-lg mb-2">No analytics data</p>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Run <code>/analytics</code> in Claude Code to pull metrics.
        </p>
      </div>
    );
  }

  const files = await listVaultDir("analytics");
  const mdFiles = files.filter((f) => f.name.endsWith(".md"));

  const reports: AnalyticsReport[] = [];
  for (const file of mdFiles) {
    const raw = await readVaultFile(`analytics/${file.name}`);
    const { data, content } = matter(raw);
    const titleMatch = content.match(/^#\s+(.+)$/m);
    reports.push({
      filename: file.name,
      title: titleMatch ? titleMatch[1] : file.name.replace(".md", ""),
      generated_at: data.generated_at ?? "",
      content,
    });
  }

  const overviewReport = reports.find((r) => r.filename === "overview.md");
  const otherReports = reports.filter((r) => r.filename !== "overview.md");

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Analytics</h1>
      {overviewReport && (
        <p className="text-xs mb-6" style={{ color: "var(--text-muted)" }}>
          Last updated:{" "}
          {new Date(overviewReport.generated_at).toLocaleString()}
        </p>
      )}

      {overviewReport && (
        <div
          className="rounded-lg p-6 mb-6"
          style={{ background: "var(--bg-card)" }}
        >
          <MarkdownViewer content={overviewReport.content} />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {otherReports.map((report) => (
          <div
            key={report.filename}
            className="rounded-lg p-6"
            style={{ background: "var(--bg-card)" }}
          >
            <MarkdownViewer content={report.content} />
          </div>
        ))}
      </div>
    </div>
  );
}
