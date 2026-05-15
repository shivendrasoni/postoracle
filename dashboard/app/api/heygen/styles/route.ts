import { NextResponse } from "next/server";
import { execSync } from "child_process";

interface StyleEntry {
  style_id: string;
  name: string;
  thumbnail_url?: string;
  tags: string[];
}

// Module-level cache with 5-minute TTL
let cachedStyles: StyleEntry[] | null = null;
let cacheTimestamp: number | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function GET() {
  // Check cache
  const now = Date.now();
  if (cachedStyles !== null && cacheTimestamp !== null) {
    if (now - cacheTimestamp < CACHE_TTL) {
      return NextResponse.json(cachedStyles);
    }
  }

  // Fetch fresh data from HeyGen CLI
  const styles = fetchStylesFromCLI();

  // Update cache
  cachedStyles = styles;
  cacheTimestamp = now;

  return NextResponse.json(styles);
}

function fetchStylesFromCLI(): StyleEntry[] {
  try {
    const output = execSync(
      "heygen video-agent styles list --limit 30 --json",
      {
        timeout: 15_000,
        encoding: "utf-8",
        env: { ...process.env, PATH: process.env.PATH },
      }
    );

    const parsed = JSON.parse(output);
    const styles = normalizeStylesResponse(parsed);

    return styles;
  } catch (error) {
    // CLI not installed, failed, or times out — return empty array gracefully
    console.error("Failed to fetch styles from HeyGen CLI:", error);
    return [];
  }
}

function normalizeStylesResponse(
  data: unknown
): StyleEntry[] {
  // Handle three possible response formats:
  // 1. Direct array: [{ style_id: ..., ... }]
  // 2. Object with styles key: { styles: [...] }
  // 3. Object with data key: { data: [...] }

  if (Array.isArray(data)) {
    return data.map(normalizeStyleEntry);
  }

  if (typeof data === "object" && data !== null) {
    const obj = data as Record<string, unknown>;

    if (Array.isArray(obj.styles)) {
      return obj.styles.map(normalizeStyleEntry);
    }

    if (Array.isArray(obj.data)) {
      return obj.data.map(normalizeStyleEntry);
    }
  }

  // Unrecognized format — return empty array
  return [];
}

function normalizeStyleEntry(entry: unknown): StyleEntry {
  // Ensure we extract required fields, providing defaults for optional ones
  const obj = entry as Record<string, unknown>;

  const tags = obj.tags;
  let tagsArray: string[] = [];

  if (Array.isArray(tags)) {
    tagsArray = tags.map(String);
  } else if (typeof tags === "string") {
    tagsArray = [tags];
  }

  return {
    style_id: String(obj.style_id || obj.id || ""),
    name: String(obj.name || ""),
    thumbnail_url: obj.thumbnail_url ? String(obj.thumbnail_url) : undefined,
    tags: tagsArray,
  };
}
