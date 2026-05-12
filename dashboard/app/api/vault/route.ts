import { NextRequest, NextResponse } from "next/server";
import {
  buildFileTree,
  readVaultFile,
  resolveVaultPath,
  vaultPathExists,
} from "@/lib/vault";
import fs from "fs/promises";
import matter from "gray-matter";

export async function GET(request: NextRequest) {
  const reqPath = request.nextUrl.searchParams.get("path") ?? "";

  const exists = await vaultPathExists(reqPath || ".");
  if (!exists) {
    return NextResponse.json(
      { error: "not_found", message: `Path not found: ${reqPath}` },
      { status: 404 }
    );
  }

  const fullPath = resolveVaultPath(reqPath || ".");
  const stat = await fs.stat(fullPath);

  if (stat.isDirectory()) {
    const tree = await buildFileTree(reqPath || ".", 2);
    return NextResponse.json({ type: "directory", path: reqPath, tree });
  }

  const raw = await readVaultFile(reqPath);
  const isMarkdown = reqPath.endsWith(".md");

  if (isMarkdown) {
    const { content } = matter(raw);
    return NextResponse.json({
      type: "file",
      path: reqPath,
      format: "markdown",
      content,
    });
  }

  const isJson = reqPath.endsWith(".json");
  if (isJson) {
    return NextResponse.json({
      type: "file",
      path: reqPath,
      format: "json",
      content: raw,
    });
  }

  const isImage = /\.(png|jpe?g|gif|webp|svg)$/i.test(reqPath);
  if (isImage) {
    return NextResponse.json({
      type: "file",
      path: reqPath,
      format: "image",
      assetUrl: `/vault-assets/${reqPath}`,
    });
  }

  return NextResponse.json({
    type: "file",
    path: reqPath,
    format: "text",
    content: raw,
  });
}
