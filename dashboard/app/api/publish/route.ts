import { NextResponse } from "next/server";
import { execFile } from "child_process";
import path from "path";

const PROJECT_ROOT = path.resolve(process.cwd(), "..");
const VAULT_ROOT = path.resolve(PROJECT_ROOT, "vault");

function resolveSessionDir(raw: string): string {
  const basename = raw.split("/").pop()!;
  const candidates = ["outputs/reels", "outputs/carousels", "outputs/posts"];
  for (const dir of candidates) {
    const abs = path.join(VAULT_ROOT, dir, basename);
    try {
      require("fs").accessSync(abs);
      return path.join("vault", dir, basename);
    } catch {}
  }
  if (raw.startsWith("vault/")) return raw;
  return path.join("vault", raw.replace(/^.*?vault\//, ""));
}

export async function POST(request: Request) {
  const body = await request.json();
  const { sessionDir: rawSessionDir, platforms } = body as {
    sessionDir: string;
    platforms: string[];
  };

  if (!rawSessionDir || !platforms?.length) {
    return NextResponse.json(
      { error: "sessionDir and platforms are required" },
      { status: 400 }
    );
  }

  const sessionDir = resolveSessionDir(rawSessionDir);

  const allowedPlatforms = ["instagram", "linkedin", "x"];
  for (const p of platforms) {
    if (!allowedPlatforms.includes(p)) {
      return NextResponse.json(
        { error: `Unknown platform: ${p}` },
        { status: 400 }
      );
    }
  }

  const results: Record<string, { success: boolean; url: string | null; error: string | null }> = {};

  for (const platform of platforms) {
    try {
      const result = await new Promise<string>((resolve, reject) => {
        execFile(
          "python3",
          ["-m", "scripts.publish", "--session-dir", sessionDir, "--platform", platform, "--json"],
          { cwd: PROJECT_ROOT, timeout: 120_000 },
          (err, stdout, stderr) => {
            if (err) reject(new Error(stderr || err.message));
            else resolve(stdout);
          }
        );
      });
      const parsed = JSON.parse(result);
      results[platform] = parsed[platform] ?? { success: false, url: null, error: "No result returned" };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      results[platform] = { success: false, url: null, error: message };
    }
  }

  return NextResponse.json({ results });
}
