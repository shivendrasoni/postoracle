import { NextResponse } from "next/server";
import { existsSync, readdirSync, readFileSync } from "fs";
import { resolve } from "path";

interface AvatarEntry {
  name: string;
  filename: string;
  groupId: string;
  voiceId: string;
  voiceName: string;
  looks: Record<string, string>;
}

export async function GET() {
  const projectRoot = resolve(process.cwd(), "..");
  const avatarFiles = getAvatarFiles(projectRoot);
  const avatars: AvatarEntry[] = [];

  for (const filename of avatarFiles) {
    const filePath = resolve(projectRoot, filename);
    try {
      const content = readFileSync(filePath, "utf-8");
      const parsed = parseAvatarFile(content, filename);
      if (parsed) {
        avatars.push(parsed);
      }
    } catch (error) {
      console.error(`Failed to parse ${filename}:`, error);
    }
  }

  return NextResponse.json(avatars);
}

function getAvatarFiles(projectRoot: string): string[] {
  if (!existsSync(projectRoot)) {
    return [];
  }

  const files = readdirSync(projectRoot);
  return files.filter(
    (file) =>
      file.startsWith("AVATAR-") &&
      file.endsWith(".md") &&
      file !== "AVATAR-AGENT.md" &&
      file !== "AVATAR-USER.md"
  );
}

function parseAvatarFile(content: string, filename: string): AvatarEntry | null {
  // Extract avatar name from "# Avatar: <name>" header
  const nameMatch = content.match(/^#\s+Avatar:\s+(.+)$/m);
  if (!nameMatch) {
    return null;
  }
  const name = nameMatch[1].trim();

  // Extract HeyGen section
  const heygenSectionMatch = content.match(/^##\s+HeyGen\s*$([\s\S]*?)(?=^##\s|\Z)/m);
  if (!heygenSectionMatch) {
    return null;
  }

  const heygenSection = heygenSectionMatch[1];

  // Parse individual fields from the HeyGen section
  const groupIdMatch = heygenSection.match(/^-\s+Group ID:\s+(.+)$/m);
  const voiceIdMatch = heygenSection.match(/^-\s+Voice ID:\s+(.+)$/m);
  const voiceNameMatch = heygenSection.match(/^-\s+Voice Name:\s+(.+)$/m);
  const looksMatch = heygenSection.match(/^-\s+Looks:\s+(.+)$/m);

  if (!groupIdMatch || !voiceIdMatch || !voiceNameMatch || !looksMatch) {
    return null;
  }

  const groupId = groupIdMatch[1].trim();
  const voiceId = voiceIdMatch[1].trim();
  const voiceName = voiceNameMatch[1].trim();

  // Parse looks string: "landscape=XXX, portrait=YYY"
  const looks: Record<string, string> = {};
  const looksStr = looksMatch[1].trim();
  const lookPairs = looksStr.split(",").map((pair) => pair.trim());
  for (const pair of lookPairs) {
    const [key, value] = pair.split("=").map((s) => s.trim());
    if (key && value) {
      looks[key] = value;
    }
  }

  return {
    name,
    filename,
    groupId,
    voiceId,
    voiceName,
    looks,
  };
}
