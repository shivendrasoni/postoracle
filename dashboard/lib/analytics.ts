import type { RegistryEntry } from "./types";

export interface AnalyticsStats {
  totalContent: number;
  totalPublished: number;
  avgScore: number;
  bestPerformer: { topic: string; score: number; id: string } | null;
  publishedThisWeek: number;
  draftCount: number;
}

export interface ContentTypeBreakdown {
  type: string;
  total: number;
  published: number;
  avgScore: number;
  percentage: number;
}

export interface LeaderboardEntry {
  rank: number;
  id: string;
  topic: string;
  type: "reel" | "carousel" | "post";
  score: number;
  platforms: string[];
  publishedAt: string | null;
  status: "draft" | "published";
}

export interface PlatformBreakdown {
  name: string;
  published: number;
  total: number;
  avgScore: number;
}

export interface AnalyticsData {
  stats: AnalyticsStats;
  contentTypes: ContentTypeBreakdown[];
  leaderboard: LeaderboardEntry[];
  platforms: PlatformBreakdown[];
  lastFetchedAt: string | null;
  isSparse: boolean;
}

export function computeAnalytics(entries: RegistryEntry[]): AnalyticsData {
  const published = entries.filter((e) => e.status === "published");
  const withAnalytics = published.filter((e) => e.analytics);
  const scores = withAnalytics.map((e) => e.analytics!.performance_score);
  const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const publishedThisWeek = published.filter((e) => {
    const dates = Object.values(e.published_at);
    return dates.some((d) => new Date(d) >= weekAgo);
  }).length;

  let bestPerformer: AnalyticsStats["bestPerformer"] = null;
  if (withAnalytics.length > 0) {
    const best = withAnalytics.reduce((a, b) =>
      (a.analytics!.performance_score >= b.analytics!.performance_score ? a : b)
    );
    bestPerformer = {
      topic: best.topic,
      score: best.analytics!.performance_score,
      id: best.id,
    };
  }

  const lastFetch = withAnalytics
    .map((e) => e.analytics!.last_fetched_at)
    .sort()
    .pop() ?? null;

  const typeMap = new Map<string, { total: number; published: number; scores: number[] }>();
  for (const entry of entries) {
    const bucket = typeMap.get(entry.type) ?? { total: 0, published: 0, scores: [] };
    bucket.total++;
    if (entry.status === "published") bucket.published++;
    if (entry.analytics) bucket.scores.push(entry.analytics.performance_score);
    typeMap.set(entry.type, bucket);
  }
  const contentTypes: ContentTypeBreakdown[] = [...typeMap.entries()].map(([type, data]) => ({
    type,
    total: data.total,
    published: data.published,
    avgScore: data.scores.length > 0 ? data.scores.reduce((a, b) => a + b, 0) / data.scores.length : 0,
    percentage: entries.length > 0 ? (data.total / entries.length) * 100 : 0,
  }));

  const platformMap = new Map<string, { published: number; total: number; scores: number[] }>();
  for (const entry of entries) {
    for (const platform of entry.platforms) {
      const bucket = platformMap.get(platform) ?? { published: 0, total: 0, scores: [] };
      bucket.total++;
      if (entry.status === "published") bucket.published++;
      if (entry.analytics) bucket.scores.push(entry.analytics.performance_score);
      platformMap.set(platform, bucket);
    }
  }
  const platforms: PlatformBreakdown[] = [...platformMap.entries()]
    .map(([name, data]) => ({
      name,
      published: data.published,
      total: data.total,
      avgScore: data.scores.length > 0 ? data.scores.reduce((a, b) => a + b, 0) / data.scores.length : 0,
    }))
    .sort((a, b) => b.total - a.total);

  const leaderboard: LeaderboardEntry[] = entries
    .filter((e) => e.analytics != null)
    .sort((a, b) => b.analytics!.performance_score - a.analytics!.performance_score)
    .slice(0, 10)
    .map((entry, i) => {
      const firstPublish = Object.values(entry.published_at).sort()[0] ?? null;
      return {
        rank: i + 1,
        id: entry.id,
        topic: entry.topic,
        type: entry.type,
        score: entry.analytics!.performance_score,
        platforms: entry.platforms,
        publishedAt: firstPublish,
        status: entry.status,
      };
    });

  const isSparse = withAnalytics.length <= 1 || avgScore === 0;

  return {
    stats: {
      totalContent: entries.length,
      totalPublished: published.length,
      avgScore,
      bestPerformer,
      publishedThisWeek,
      draftCount: entries.length - published.length,
    },
    contentTypes,
    leaderboard,
    platforms,
    lastFetchedAt: lastFetch,
    isSparse,
  };
}
