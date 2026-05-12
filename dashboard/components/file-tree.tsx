"use client";

import Link from "next/link";
import type { VaultFile } from "@/lib/types";
import {
  Folder,
  FileText,
  FileCode,
  Image,
  FilmStrip,
  Images,
  Article,
} from "@phosphor-icons/react";

interface FileTreeProps {
  files: VaultFile[];
  basePath?: string;
}

export default function FileTree({ files, basePath = "" }: FileTreeProps) {
  return (
    <ul className="space-y-px">
      {files.map((file) => (
        <li key={file.path}>
          {file.type === "directory" ? (
            <div>
              <Link
                href={`/vault/${file.path}`}
                className="group flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] text-content
                  hover:bg-white/[0.03] transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]"
              >
                <FolderIcon path={file.path} />
                {file.name}
              </Link>
              {file.children && file.children.length > 0 && (
                <div className="ml-4 border-l border-white/[0.04] pl-1">
                  <FileTree files={file.children} basePath={file.path} />
                </div>
              )}
            </div>
          ) : (
            <Link
              href={`/vault/${file.path}`}
              className="group flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] text-sub
                hover:text-content hover:bg-white/[0.03]
                transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]"
            >
              <FileIcon name={file.name} />
              {file.name}
            </Link>
          )}
        </li>
      ))}
    </ul>
  );
}

const SESSION_ICONS: Record<string, typeof FilmStrip> = {
  reels: FilmStrip,
  carousels: Images,
  posts: Article,
};

function FolderIcon({ path }: { path: string }) {
  const cls =
    "shrink-0 transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:scale-110";
  const segments = path.split("/");
  const parentType = segments.find((s) => s in SESSION_ICONS);
  if (parentType && segments.length > segments.indexOf(parentType) + 1) {
    const Icon = SESSION_ICONS[parentType];
    const colorCls =
      parentType === "reels"
        ? "text-flame"
        : parentType === "carousels"
          ? "text-accent"
          : "text-emerald";
    return <Icon size={16} weight="duotone" className={`${cls} ${colorCls}`} />;
  }
  return <Folder size={16} weight="duotone" className={`${cls} text-amber`} />;
}

function FileIcon({ name }: { name: string }) {
  const cls =
    "shrink-0 text-muted transition-colors duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:text-sub";
  if (name.endsWith(".md"))
    return <FileText size={16} weight="light" className={cls} />;
  if (name.endsWith(".json"))
    return <FileCode size={16} weight="light" className={cls} />;
  if (/\.(png|jpe?g|gif|webp|svg)$/i.test(name))
    return <Image size={16} weight="light" className={cls} />;
  if (name.endsWith(".mp4"))
    return <FilmStrip size={16} weight="light" className={cls} />;
  return <FileText size={16} weight="light" className={cls} />;
}
