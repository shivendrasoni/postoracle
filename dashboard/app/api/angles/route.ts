import { NextResponse } from "next/server";
import { listVaultDir, readVaultFile, vaultPathExists } from "@/lib/vault";
import matter from "gray-matter";

interface AngleFrontmatter {
  topic?: string;
  format?: string;
  pillar?: string;
  contrast?: { common_belief?: string; surprising_truth?: string; strength?: string };
  hook_pattern?: string;
  score?: number;
  recommended?: boolean;
  created?: string;
  status?: string;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format");

  const dirExists = await vaultPathExists("library/angles");
  if (!dirExists) {
    return NextResponse.json([]);
  }

  const entries = await listVaultDir("library/angles");
  const mdFiles = entries.filter((e) => !e.isDirectory && e.name.endsWith(".md"));

  const angles = await Promise.all(
    mdFiles.map(async (file) => {
      const content = await readVaultFile(`library/angles/${file.name}`);
      const { data } = matter(content) as { data: AngleFrontmatter };
      return {
        path: `vault/library/angles/${file.name}`,
        filename: file.name,
        topic: data.topic ?? "",
        format: data.format ?? "",
        pillar: data.pillar ?? "",
        oneLiner: data.contrast?.surprising_truth ?? "",
        hookPattern: data.hook_pattern ?? "",
        strength: data.contrast?.strength ?? "",
        score: data.score ?? 0,
        recommended: data.recommended ?? false,
        created: data.created ?? "",
        status: data.status ?? "draft",
      };
    })
  );

  const filtered = format ? angles.filter((a) => a.format === format) : angles;
  filtered.sort((a, b) => b.score - a.score);

  return NextResponse.json(filtered);
}
