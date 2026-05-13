import { NextResponse } from "next/server";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

const ENV_KEYS = [
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "HEYGEN_API_KEY",
  "PEXELS_API_KEY",
  "PIXABAY_API_KEY",
  "ELEVENLABS_API_KEY",
];

export async function GET() {
  const envPath = resolve(process.cwd(), "..", ".env");
  const status: Record<string, boolean> = {};

  if (existsSync(envPath)) {
    const content = readFileSync(envPath, "utf-8");
    for (const key of ENV_KEYS) {
      const regex = new RegExp(`^${key}=.+`, "m");
      status[key] = regex.test(content);
    }
  } else {
    for (const key of ENV_KEYS) {
      status[key] = false;
    }
  }

  return NextResponse.json(status);
}
