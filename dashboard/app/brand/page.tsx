import {
  readVaultFile,
  listVaultDir,
  vaultPathExists,
} from "@/lib/vault";
import matter from "gray-matter";
import MarkdownViewer from "@/components/markdown-viewer";
import type { BrandModule } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function BrandPage() {
  const hasModules = await vaultPathExists("brand/modules");
  const hasCompiled = await vaultPathExists("brand/brand-voice.md");

  if (!hasCompiled && !hasModules) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <p className="text-lg mb-2">No brand profile</p>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Run <code>/brand-voice</code> in Claude Code to build your identity.
        </p>
      </div>
    );
  }

  let compiledContent = "";
  if (hasCompiled) {
    compiledContent = await readVaultFile("brand/brand-voice.md");
  }

  const modules: BrandModule[] = [];
  if (hasModules) {
    const files = await listVaultDir("brand/modules");
    const mdFiles = files.filter((f) => f.name.endsWith(".md"));
    for (const file of mdFiles) {
      const raw = await readVaultFile(`brand/modules/${file.name}`);
      const { data, content } = matter(raw);
      const isPlaceholder =
        content.trim().length < 50 ||
        content.includes("To be filled in");
      modules.push({
        filename: file.name,
        module: (data.module as string) ?? file.name.replace(".md", ""),
        last_updated: String(data.last_updated ?? ""),
        content,
        frontmatter: data,
        isEmpty: isPlaceholder,
      });
    }
  }

  const completed = modules.filter((m) => !m.isEmpty).length;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Brand Profile</h1>
      <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
        {completed} of {modules.length} modules completed
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-8">
        {modules.map((m) => (
          <a
            key={m.filename}
            href={`#module-${m.module}`}
            className="rounded-lg px-4 py-3 text-center text-sm transition-colors"
            style={{
              background: m.isEmpty ? "var(--bg-card)" : "var(--accent-dim)",
              color: m.isEmpty ? "var(--text-muted)" : "var(--accent)",
              fontWeight: m.isEmpty ? 400 : 600,
            }}
          >
            {m.module}
          </a>
        ))}
      </div>

      {compiledContent && (
        <div
          className="rounded-lg p-6 mb-8"
          style={{ background: "var(--bg-card)" }}
        >
          <h2 className="text-lg font-semibold mb-4">Compiled Brand Voice</h2>
          <MarkdownViewer content={compiledContent} />
        </div>
      )}

      {modules
        .filter((m) => !m.isEmpty)
        .map((m) => (
          <div
            key={m.filename}
            id={`module-${m.module}`}
            className="rounded-lg p-6 mb-4"
            style={{ background: "var(--bg-card)" }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold capitalize">{m.module}</h2>
              <span
                className="text-xs"
                style={{ color: "var(--text-muted)" }}
              >
                updated {m.last_updated}
              </span>
            </div>
            <MarkdownViewer content={m.content} />
          </div>
        ))}
    </div>
  );
}
