import path from "path";
import fs from "fs/promises";
import matter from "gray-matter";
import { resolveVaultPath, readVaultFile } from "./vault";
import type { SavedPost } from "./types";

interface IndexEntry {
  file: string;
  collection: string;
  type: string;
  synced_at: string;
  downloaded: boolean;
}

async function discoverPlatforms(): Promise<string[]> {
  const importsDir = resolveVaultPath("imports");
  try {
    const entries = await fs.readdir(importsDir, { withFileTypes: true });
    return entries
      .filter((e) => e.isDirectory() && e.name.endsWith("-saved"))
      .map((e) => e.name);
  } catch {
    return [];
  }
}

function platformFromDir(dirName: string): string {
  return dirName.replace(/-saved$/, "");
}

async function loadPlatformSaves(dirName: string): Promise<SavedPost[]> {
  const platform = platformFromDir(dirName);
  const indexPath = path.join("imports", dirName, "_index.json");

  let raw: string;
  try {
    raw = await readVaultFile(indexPath);
  } catch {
    return [];
  }

  const index = JSON.parse(raw) as Record<string, IndexEntry>;
  const posts: SavedPost[] = [];

  for (const [shortcode, entry] of Object.entries(index)) {
    const mdPath = path.join("imports", dirName, entry.file);
    let caption = "";
    let fm: Record<string, unknown> = {};

    try {
      const mdContent = await readVaultFile(mdPath);
      const parsed = matter(mdContent);
      fm = parsed.data;
      caption = parsed.content.trim();
    } catch {
      // frontmatter unavailable — use index data only
    }

    posts.push({
      shortcode,
      platform,
      type: (fm.type as string) ?? entry.type ?? "unknown",
      link: (fm.link as string) ?? "",
      author: (fm.author as string) ?? "",
      author_name: (fm.author_name as string) ?? "",
      caption,
      collection: ((fm.collection as string) ?? entry.collection ?? "").trim(),
      date_published: (fm.date_published as string) ?? "",
      date_saved: (fm.date_saved as string) ?? "",
      synced_at: entry.synced_at,
      like_count: (fm.like_count as number) ?? 0,
      comment_count: (fm.comment_count as number) ?? 0,
      view_count: (fm.view_count as number) ?? 0,
      downloaded: entry.downloaded ?? false,
    });
  }

  return posts;
}

export async function loadAllSaves(): Promise<SavedPost[]> {
  const platforms = await discoverPlatforms();
  if (platforms.length === 0) return [];

  const results = await Promise.all(platforms.map(loadPlatformSaves));
  const all = results.flat();

  all.sort(
    (a, b) =>
      new Date(b.synced_at).getTime() - new Date(a.synced_at).getTime()
  );

  return all;
}
