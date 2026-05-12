import {
  readVaultFile,
  listVaultDir,
  vaultPathExists,
} from "@/lib/vault";
import matter from "gray-matter";
import MarkdownViewer from "@/components/markdown-viewer";
import AnimateIn from "@/components/animate-in";
import type { AnalyticsReport } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const exists = await vaultPathExists("analytics");
  if (!exists) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="rounded-[2rem] bg-white/[0.02] border border-white/[0.06] p-2">
          <div className="rounded-[calc(2rem-0.5rem)] bg-surface/60 px-12 py-16 text-center shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)]">
            <p className="text-lg font-medium text-content mb-2">
              No analytics data
            </p>
            <p className="text-[13px] text-sub">
              Run{" "}
              <code className="font-mono text-accent bg-accent-soft px-2 py-0.5 rounded-md">
                /analytics
              </code>{" "}
              in Claude Code to pull metrics.
            </p>
          </div>
        </div>
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

  const overviewReport = reports.find(
    (r) => r.filename === "overview.md"
  );
  const otherReports = reports.filter(
    (r) => r.filename !== "overview.md"
  );

  return (
    <div>
      <AnimateIn>
        <div className="mb-10">
          <span className="rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.2em] font-medium bg-emerald-soft text-emerald">
            Performance
          </span>
          <h1 className="text-2xl font-semibold tracking-tight text-content mt-3">
            Analytics
          </h1>
          {overviewReport && (
            <p className="text-[12px] text-muted mt-1">
              Updated{" "}
              {new Date(overviewReport.generated_at).toLocaleString()}
            </p>
          )}
        </div>
      </AnimateIn>

      {overviewReport && (
        <AnimateIn delay={100} className="mb-6">
          <div className="rounded-[1.5rem] bg-white/[0.02] border border-white/[0.06] p-1.5">
            <div className="rounded-[calc(1.5rem-0.375rem)] bg-surface/60 p-6 shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)]">
              <MarkdownViewer content={overviewReport.content} />
            </div>
          </div>
        </AnimateIn>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {otherReports.map((report, i) => (
          <AnimateIn key={report.filename} delay={150 + i * 50}>
            <div id={report.filename.replace(".md", "")} className="rounded-[1.5rem] bg-white/[0.02] border border-white/[0.06] p-1.5 h-full scroll-mt-16">
              <div className="rounded-[calc(1.5rem-0.375rem)] bg-surface/60 p-6 shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)] h-full">
                <MarkdownViewer content={report.content} />
              </div>
            </div>
          </AnimateIn>
        ))}
      </div>
    </div>
  );
}
