import { NextResponse } from "next/server";
import {
  readVaultFile,
  listVaultDir,
  vaultPathExists,
} from "@/lib/vault";
import matter from "gray-matter";
import type { BrandModule } from "@/lib/types";

export async function GET() {
  const hasModules = await vaultPathExists("brand/modules");
  const hasCompiled = await vaultPathExists("brand/brand-voice.md");

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

  return NextResponse.json({ compiledContent, modules });
}
