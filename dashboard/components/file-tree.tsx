"use client";

import Link from "next/link";
import type { VaultFile } from "@/lib/types";

interface FileTreeProps {
  files: VaultFile[];
  basePath?: string;
}

export default function FileTree({ files, basePath = "" }: FileTreeProps) {
  return (
    <ul className="space-y-0.5">
      {files.map((file) => (
        <li key={file.path}>
          {file.type === "directory" ? (
            <details open={!!basePath}>
              <summary
                className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-sm hover:bg-[var(--bg-hover)]"
                style={{ color: "var(--text-primary)" }}
              >
                <span>📁</span>
                {file.name}
              </summary>
              {file.children && file.children.length > 0 && (
                <div className="ml-4">
                  <FileTree files={file.children} basePath={file.path} />
                </div>
              )}
            </details>
          ) : (
            <Link
              href={`/vault/${file.path}`}
              className="flex items-center gap-2 px-2 py-1.5 rounded text-sm hover:bg-[var(--bg-hover)] transition-colors"
              style={{ color: "var(--text-secondary)" }}
            >
              <span>{getFileIcon(file.name)}</span>
              {file.name}
            </Link>
          )}
        </li>
      ))}
    </ul>
  );
}

function getFileIcon(name: string): string {
  if (name.endsWith(".md")) return "📄";
  if (name.endsWith(".json")) return "📋";
  if (/\.(png|jpe?g|gif|webp|svg)$/i.test(name)) return "🖼️";
  if (name.endsWith(".mp4")) return "🎬";
  return "📄";
}
