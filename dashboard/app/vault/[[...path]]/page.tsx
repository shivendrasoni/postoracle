import {
  buildFileTree,
  readVaultFile,
  resolveVaultPath,
  vaultPathExists,
} from "@/lib/vault";
import fs from "fs/promises";
import matter from "gray-matter";
import FileTree from "@/components/file-tree";
import MarkdownViewer from "@/components/markdown-viewer";
import AnimateIn from "@/components/animate-in";
import Link from "next/link";

export const dynamic = "force-dynamic";

interface VaultPageProps {
  params: Promise<{ path?: string[] }>;
}

export default async function VaultPage({ params }: VaultPageProps) {
  const { path: pathSegments } = await params;
  const reqPath = pathSegments?.join("/") ?? "";

  const exists = await vaultPathExists(reqPath || ".");
  if (!exists) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="rounded-[2rem] bg-white/[0.02] border border-white/[0.06] p-2">
          <div className="rounded-[calc(2rem-0.5rem)] bg-surface/60 px-12 py-16 text-center shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)]">
            <p className="text-lg font-medium text-content mb-2">
              Not found
            </p>
            <p className="text-[13px] text-sub">
              <code className="font-mono text-accent">{reqPath}</code>{" "}
              does not exist in the vault.
            </p>
            <Link
              href="/vault"
              className="inline-flex mt-4 text-[13px] text-accent hover:underline"
            >
              Back to vault root
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const fullPath = resolveVaultPath(reqPath || ".");
  const stat = await fs.stat(fullPath);

  const breadcrumbs = reqPath
    ? reqPath.split("/").map((seg, i, arr) => ({
        label: seg,
        href: "/vault/" + arr.slice(0, i + 1).join("/"),
      }))
    : [];

  if (stat.isDirectory()) {
    const tree = await buildFileTree(reqPath || ".", 2);
    return (
      <div>
        <AnimateIn>
          <div className="mb-6">
            <span className="rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.2em] font-medium bg-amber-soft text-amber">
              Files
            </span>
            <h1 className="text-2xl font-semibold tracking-tight text-content mt-3">
              Vault
            </h1>
            <Breadcrumbs items={breadcrumbs} />
          </div>
        </AnimateIn>
        <AnimateIn delay={100}>
          <div className="rounded-[1.5rem] bg-white/[0.02] border border-white/[0.06] p-1.5">
            <div className="rounded-[calc(1.5rem-0.375rem)] bg-surface/60 p-4 shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)]">
              {tree.length === 0 ? (
                <p className="text-[13px] text-muted py-8 text-center">
                  Empty directory
                </p>
              ) : (
                <FileTree files={tree} />
              )}
            </div>
          </div>
        </AnimateIn>
      </div>
    );
  }

  const assetUrl = `/api/vault-asset?path=${encodeURIComponent(reqPath)}`;
  const isImage = /\.(png|jpe?g|gif|webp|svg)$/i.test(reqPath);
  const isVideo = /\.(mp4|webm|mov)$/i.test(reqPath);

  if (isImage) {
    return (
      <div>
        <AnimateIn>
          <div className="mb-6">
            <h1 className="text-2xl font-semibold tracking-tight text-content">
              Vault
            </h1>
            <Breadcrumbs items={breadcrumbs} />
          </div>
        </AnimateIn>
        <AnimateIn delay={100}>
          <div className="rounded-[1.5rem] bg-white/[0.02] border border-white/[0.06] p-1.5">
            <div className="rounded-[calc(1.5rem-0.375rem)] bg-surface/60 p-6 shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)] flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={assetUrl}
                alt={reqPath.split("/").pop() ?? reqPath}
                className="max-w-full max-h-[80vh] rounded-xl object-contain"
              />
            </div>
          </div>
        </AnimateIn>
      </div>
    );
  }

  if (isVideo) {
    return (
      <div>
        <AnimateIn>
          <div className="mb-6">
            <h1 className="text-2xl font-semibold tracking-tight text-content">
              Vault
            </h1>
            <Breadcrumbs items={breadcrumbs} />
          </div>
        </AnimateIn>
        <AnimateIn delay={100}>
          <div className="rounded-[1.5rem] bg-white/[0.02] border border-white/[0.06] p-1.5">
            <div className="rounded-[calc(1.5rem-0.375rem)] bg-surface/60 p-6 shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)] flex justify-center">
              <video
                src={assetUrl}
                controls
                className="max-w-full max-h-[80vh] rounded-xl"
              />
            </div>
          </div>
        </AnimateIn>
      </div>
    );
  }

  const raw = await readVaultFile(reqPath);
  const isMarkdown = reqPath.endsWith(".md");
  const isJson = reqPath.endsWith(".json");

  let formattedJson = "";
  if (isJson) {
    try {
      formattedJson = JSON.stringify(JSON.parse(raw), null, 2);
    } catch {
      formattedJson = raw;
    }
  }

  return (
    <div>
      <AnimateIn>
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-content">
            Vault
          </h1>
          <Breadcrumbs items={breadcrumbs} />
        </div>
      </AnimateIn>
      <AnimateIn delay={100}>
        <div className="rounded-[1.5rem] bg-white/[0.02] border border-white/[0.06] p-1.5">
          <div className="rounded-[calc(1.5rem-0.375rem)] bg-surface/60 p-6 shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)]">
            {isMarkdown ? (
              <MarkdownViewer content={matter(raw).content} />
            ) : (
              <pre className="text-[13px] text-sub overflow-auto whitespace-pre-wrap font-mono max-h-[80vh]">
                {isJson ? formattedJson : raw}
              </pre>
            )}
          </div>
        </div>
      </AnimateIn>
    </div>
  );
}

function Breadcrumbs({
  items,
}: {
  items: { label: string; href: string }[];
}) {
  return (
    <div className="flex items-center gap-1.5 text-[13px] mt-2">
      <Link
        href="/vault"
        className="text-accent hover:underline transition-colors duration-300"
      >
        vault
      </Link>
      {items.map((item) => (
        <span key={item.href} className="flex items-center gap-1.5">
          <span className="text-faint">/</span>
          <Link
            href={item.href}
            className="text-accent hover:underline transition-colors duration-300"
          >
            {item.label}
          </Link>
        </span>
      ))}
    </div>
  );
}
