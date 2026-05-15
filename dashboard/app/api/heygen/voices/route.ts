import { NextResponse } from "next/server";
import { execSync } from "child_process";

interface VoiceEntry {
  voice_id: string;
  name: string;
  language: string;
  gender: string;
  preview_url?: string;
}

// Module-level cache with 5-minute TTL
let cachedVoices: VoiceEntry[] | null = null;
let cacheTimestamp: number | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function GET() {
  // Check cache
  const now = Date.now();
  if (cachedVoices !== null && cacheTimestamp !== null) {
    if (now - cacheTimestamp < CACHE_TTL) {
      return NextResponse.json(cachedVoices);
    }
  }

  // Fetch fresh data from HeyGen CLI
  const voices = fetchVoicesFromCLI();

  // Update cache
  cachedVoices = voices;
  cacheTimestamp = now;

  return NextResponse.json(voices);
}

function fetchVoicesFromCLI(): VoiceEntry[] {
  try {
    const output = execSync(
      "heygen voice list --language en --limit 50 --json",
      {
        timeout: 15_000,
        encoding: "utf-8",
        env: { ...process.env, PATH: process.env.PATH },
      }
    );

    const parsed = JSON.parse(output);
    const voices = normalizeVoicesResponse(parsed);

    return voices;
  } catch (error) {
    // CLI not installed, failed, or times out — return empty array gracefully
    console.error("Failed to fetch voices from HeyGen CLI:", error);
    return [];
  }
}

function normalizeVoicesResponse(
  data: unknown
): VoiceEntry[] {
  // Handle three possible response formats:
  // 1. Direct array: [{ voice_id: ..., ... }]
  // 2. Object with voices key: { voices: [...] }
  // 3. Object with data key: { data: [...] }

  if (Array.isArray(data)) {
    return data.map(normalizeVoiceEntry);
  }

  if (typeof data === "object" && data !== null) {
    const obj = data as Record<string, unknown>;

    if (Array.isArray(obj.voices)) {
      return obj.voices.map(normalizeVoiceEntry);
    }

    if (Array.isArray(obj.data)) {
      return obj.data.map(normalizeVoiceEntry);
    }
  }

  // Unrecognized format — return empty array
  return [];
}

function normalizeVoiceEntry(entry: unknown): VoiceEntry {
  // Ensure we extract required fields, providing defaults for optional ones
  const obj = entry as Record<string, unknown>;

  return {
    voice_id: String(obj.voice_id || obj.id || ""),
    name: String(obj.name || ""),
    language: String(obj.language || "en"),
    gender: String(obj.gender || ""),
    preview_url: obj.preview_url ? String(obj.preview_url) : undefined,
  };
}
