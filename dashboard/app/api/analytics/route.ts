import { NextResponse } from "next/server";
import { readVaultFile, listVaultDir, vaultPathExists } from "@/lib/vault";
import matter from "gray-matter";
import type { AnalyticsReport } from "@/lib/types";

export async function GET() {
  const exists = await vaultPathExists("analytics");
  if (!exists) {
    return NextResponse.json([]);
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

  return NextResponse.json(reports);
}
