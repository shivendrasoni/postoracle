import {
  readVaultFile,
  listVaultDir,
  vaultPathExists,
} from "@/lib/vault";
import matter from "gray-matter";
import MarkdownViewer from "@/components/markdown-viewer";
import ProgressRing from "@/components/progress-ring";
import AnimateIn from "@/components/animate-in";
import type { BrandModule, CarouselTemplate } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function BrandPage() {
  const hasModules = await vaultPathExists("brand/modules");
  const hasCompiled = await vaultPathExists("brand/brand-voice.md");

  const hasTemplate = await vaultPathExists("brand/templates/active.yaml");
  let template: CarouselTemplate | null = null;
  if (hasTemplate) {
    try {
      const raw = await readVaultFile("brand/templates/active.yaml");
      const yaml = await import("js-yaml");
      template = yaml.load(raw) as CarouselTemplate;
    } catch {
      template = null;
    }
  }

  if (!hasCompiled && !hasModules && !template) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="rounded-[2rem] bg-white/[0.02] border border-white/[0.06] p-2">
          <div className="rounded-[calc(2rem-0.5rem)] bg-surface/60 px-12 py-16 text-center shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)]">
            <p className="text-lg font-medium text-content mb-2">
              No brand profile
            </p>
            <p className="text-[13px] text-sub">
              Run{" "}
              <code className="font-mono text-accent bg-accent-soft px-2 py-0.5 rounded-md">
                /brand-voice
              </code>{" "}
              in Claude Code to build your identity.
            </p>
          </div>
        </div>
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
        content.trim().length < 50 || content.includes("To be filled in");
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
  const progress = modules.length > 0 ? completed / modules.length : 0;

  return (
    <div>
      <AnimateIn>
        <div className="flex items-start justify-between mb-10">
          <div>
            <span className="rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.2em] font-medium bg-accent-soft text-accent">
              Identity
            </span>
            <h1 className="text-2xl font-semibold tracking-tight text-content mt-3">
              Brand profile
            </h1>
            <p className="text-[13px] text-sub mt-1">
              {completed} of {modules.length} modules completed
            </p>
          </div>
          <ProgressRing progress={progress} size={56} strokeWidth={4} />
        </div>
      </AnimateIn>

      <AnimateIn delay={100} className="mb-10">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {modules.map((m) => (
            <a
              key={m.filename}
              href={`#module-${m.module}`}
              className={`
                group rounded-[1rem] p-1
                transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]
                ${
                  m.isEmpty
                    ? "bg-white/[0.02] border border-white/[0.04] hover:border-white/[0.08]"
                    : "bg-white/[0.03] border border-accent/20 hover:border-accent/40"
                }
              `}
            >
              <div
                className={`
                  rounded-[calc(1rem-0.25rem)] px-4 py-3 text-center text-[13px]
                  transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]
                  ${
                    m.isEmpty
                      ? "text-muted group-hover:text-sub"
                      : "text-accent font-medium"
                  }
                `}
              >
                <div className="flex items-center justify-center gap-2">
                  {m.isEmpty ? (
                    <span className="w-3 h-3 rounded-full border border-faint" />
                  ) : (
                    <span className="w-3 h-3 rounded-full bg-accent flex items-center justify-center">
                      <svg
                        width="8"
                        height="8"
                        viewBox="0 0 8 8"
                        fill="none"
                      >
                        <path
                          d="M1.5 4L3.2 5.7L6.5 2.3"
                          stroke="white"
                          strokeWidth="1.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                  )}
                  {m.module}
                </div>
              </div>
            </a>
          ))}
        </div>
      </AnimateIn>

      {template && (
        <AnimateIn delay={150} className="mb-10">
          <div className="rounded-[1.5rem] bg-white/[0.02] border border-white/[0.06] p-1.5">
            <div className="rounded-[calc(1.5rem-0.375rem)] bg-surface/60 p-6 shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)]">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <h2 className="text-[15px] font-semibold text-content">
                    Carousel template
                  </h2>
                  <span className="text-[11px] text-accent bg-accent-soft px-2 py-0.5 rounded-full">
                    {template.name}
                  </span>
                </div>
                {template.created_at && (
                  <span className="text-[11px] text-muted">
                    {template.created_at}
                  </span>
                )}
              </div>

              <div className="flex gap-6 items-start">
                {/* Sample slide */}
                <div
                  className="w-48 aspect-square rounded-lg overflow-hidden relative flex-shrink-0 border border-white/[0.06]"
                  style={{
                    background: `linear-gradient(to bottom, ${template.colors.background_start}, ${template.colors.background_end})`,
                  }}
                >
                  {template.accents.top_bar.height > 0 && (
                    <div
                      className="absolute top-0 left-0 right-0"
                      style={{
                        height: `${Math.max(2, template.accents.top_bar.height / 6)}px`,
                        backgroundColor: template.colors.accent,
                      }}
                    />
                  )}
                  {template.accents.left_bar.width > 0 && (
                    <div
                      className="absolute top-3 bottom-3 left-2"
                      style={{
                        width: `${Math.max(1, template.accents.left_bar.width / 4)}px`,
                        backgroundColor: template.colors.accent,
                      }}
                    />
                  )}
                  <div className="absolute left-5 top-6 right-4 bottom-4">
                    <div
                      className="text-[11px] font-bold leading-tight mb-1.5"
                      style={{ color: template.colors.text_primary }}
                    >
                      Sample Headline
                      <br />
                      Text Here
                    </div>
                    {template.accents.divider.width > 0 && (
                      <div
                        className="mb-1.5 rounded-full"
                        style={{
                          width: `${Math.max(12, template.accents.divider.width / 4)}px`,
                          height: `${Math.max(1, template.accents.divider.height)}px`,
                          backgroundColor: template.colors.accent,
                        }}
                      />
                    )}
                    <div
                      className="text-[7px] leading-relaxed"
                      style={{ color: template.colors.text_secondary }}
                    >
                      Body text shows up here
                      <br />
                      with the template style.
                    </div>
                  </div>
                  <div
                    className="absolute bottom-2 right-3 text-[6px]"
                    style={{ color: template.colors.accent }}
                  >
                    02 / 05
                  </div>
                </div>

                {/* Color strip */}
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: "BG", color: template.colors.background_start },
                    { label: "Accent", color: template.colors.accent },
                    { label: "Text", color: template.colors.text_primary },
                    { label: "Body", color: template.colors.text_secondary },
                  ].map((swatch) => (
                    <div key={swatch.label} className="text-center">
                      <div
                        className="w-8 h-8 rounded-md border border-white/[0.08] mb-1"
                        style={{ backgroundColor: swatch.color }}
                      />
                      <div className="text-[9px] text-muted">{swatch.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </AnimateIn>
      )}

      {compiledContent && (
        <AnimateIn delay={200} className="mb-8">
          <div className="rounded-[1.5rem] bg-white/[0.02] border border-white/[0.06] p-1.5">
            <div className="rounded-[calc(1.5rem-0.375rem)] bg-surface/60 p-6 shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)]">
              <h2 className="text-[15px] font-semibold text-content mb-5">
                Compiled brand voice
              </h2>
              <MarkdownViewer content={compiledContent} />
            </div>
          </div>
        </AnimateIn>
      )}

      {modules
        .filter((m) => !m.isEmpty)
        .map((m, i) => (
          <AnimateIn
            key={m.filename}
            delay={250 + i * 50}
            className="mb-4"
          >
            <div
              id={`module-${m.module}`}
              className="rounded-[1.5rem] bg-white/[0.02] border border-white/[0.06] p-1.5"
            >
              <div className="rounded-[calc(1.5rem-0.375rem)] bg-surface/60 p-6 shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)]">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-[15px] font-semibold text-content capitalize">
                    {m.module}
                  </h2>
                  <span className="text-[11px] text-muted">
                    updated {m.last_updated}
                  </span>
                </div>
                <MarkdownViewer content={m.content} />
              </div>
            </div>
          </AnimateIn>
        ))}
    </div>
  );
}
