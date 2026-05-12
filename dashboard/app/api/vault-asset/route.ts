import { NextRequest, NextResponse } from "next/server";
import { resolveVaultPath, vaultPathExists } from "@/lib/vault";
import fs from "fs/promises";
import path from "path";

const MIME_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".mp4": "video/mp4",
  ".txt": "text/plain",
};

export async function GET(request: NextRequest) {
  const reqPath = request.nextUrl.searchParams.get("path") ?? "";
  if (!reqPath) {
    return NextResponse.json({ error: "missing path" }, { status: 400 });
  }

  const exists = await vaultPathExists(reqPath);
  if (!exists) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const fullPath = resolveVaultPath(reqPath);
  const ext = path.extname(fullPath).toLowerCase();
  const mime = MIME_TYPES[ext] ?? "application/octet-stream";
  const data = await fs.readFile(fullPath);

  return new NextResponse(data, {
    headers: { "Content-Type": mime },
  });
}
