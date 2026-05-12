import type { RegistryEntry } from "./types";

export interface CreatorLevel {
  level: number;
  title: string;
  minXp: number;
  maxXp: number;
  progress: number;
}

const LEVELS = [
  { level: 1, title: "Newcomer", minXp: 0, maxXp: 500 },
  { level: 2, title: "Creator", minXp: 500, maxXp: 1500 },
  { level: 3, title: "Strategist", minXp: 1500, maxXp: 3500 },
  { level: 4, title: "Influencer", minXp: 3500, maxXp: 7000 },
  { level: 5, title: "Oracle", minXp: 7000, maxXp: Infinity },
];

export function calculateXp(entries: RegistryEntry[]): number {
  let xp = 0;
  for (const entry of entries) {
    xp += 100;
    if (entry.status === "published") xp += 200;
    if (entry.virality_score != null && entry.virality_score > 7) xp += 150;
  }
  return xp;
}

export function getLevel(xp: number): CreatorLevel {
  const level = LEVELS.find((l) => xp < l.maxXp) ?? LEVELS[LEVELS.length - 1];
  const range = level.maxXp === Infinity ? 1 : level.maxXp - level.minXp;
  const progress =
    level.maxXp === Infinity ? 1 : Math.min((xp - level.minXp) / range, 1);
  return { ...level, progress };
}

export function calculateStreak(entries: RegistryEntry[]): number {
  if (entries.length === 0) return 0;

  const uniqueDays = [
    ...new Set(entries.map((e) => new Date(e.created_at).toDateString())),
  ]
    .map((d) => new Date(d))
    .sort((a, b) => b.getTime() - a.getTime());

  if (uniqueDays.length === 0) return 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const mostRecent = new Date(uniqueDays[0]);
  mostRecent.setHours(0, 0, 0, 0);

  const daysSinceLast = Math.floor(
    (today.getTime() - mostRecent.getTime()) / 86400000
  );
  if (daysSinceLast > 1) return 0;

  let streak = 1;
  for (let i = 1; i < uniqueDays.length; i++) {
    const curr = new Date(uniqueDays[i]);
    const prev = new Date(uniqueDays[i - 1]);
    curr.setHours(0, 0, 0, 0);
    prev.setHours(0, 0, 0, 0);
    const diff = Math.floor((prev.getTime() - curr.getTime()) / 86400000);
    if (diff === 1) streak++;
    else break;
  }
  return streak;
}
