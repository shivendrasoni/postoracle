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
        <p className="text-lg mb-2">Not found</p>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          <code>{reqPath}</code> does not exist in the vault.
        </p>
        <Link
          href="/vault"
          className="mt-4 text-sm"
          style={{ color: "var(--accent)" }}
        >
          Back to vault root
        </Link>
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
        <h1 className="text-2xl font-bold mb-2">Vault</h1>
        <Breadcrumbs items={breadcrumbs} />
        <div
          className="rounded-lg p-4 mt-4"
          style={{ background: "var(--bg-card)" }}
        >
          {tree.length === 0 ? (
            <p className="text-sm py-4 text-center" style={{ color: "var(--text-muted)" }}>
              Empty directory
            </p>
          ) : (
            <FileTree files={tree} />
          )}
        </div>
      </div>
    );
  }

  const isImage = /\.(png|jpe?g|gif|webp|svg)$/i.test(reqPath);
  if (isImage) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-2">Vault</h1>
        <Breadcrumbs items={breadcrumbs} />
        <div
          className="rounded-lg p-6 mt-4"
          style={{ background: "var(--bg-card)" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/vault-assets/${reqPath}`}
            alt={reqPath}
            className="max-w-full rounded"
          />
        </div>
      </div>
    );
  }

  const raw = await readVaultFile(reqPath);
  const isMarkdown = reqPath.endsWith(".md");

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Vault</h1>
      <Breadcrumbs items={breadcrumbs} />
      <div
        className="rounded-lg p-6 mt-4"
        style={{ background: "var(--bg-card)" }}
      >
        {isMarkdown ? (
          <MarkdownViewer content={matter(raw).content} />
        ) : (
          <pre
            className="text-sm overflow-auto whitespace-pre-wrap"
            style={{ color: "var(--text-secondary)" }}
          >
            {raw}
          </pre>
        )}
      </div>
    </div>
  );
}

function Breadcrumbs({
  items,
}: {
  items: { label: string; href: string }[];
}) {
  return (
    <div className="flex items-center gap-1 text-sm">
      <Link href="/vault" style={{ color: "var(--accent)" }}>
        vault
      </Link>
      {items.map((item) => (
        <span key={item.href} className="flex items-center gap-1">
          <span style={{ color: "var(--text-muted)" }}>/</span>
          <Link href={item.href} style={{ color: "var(--accent)" }}>
            {item.label}
          </Link>
        </span>
      ))}
    </div>
  );
}
