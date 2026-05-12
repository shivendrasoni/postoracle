export interface RegistryEntry {
  id: string;
  type: "reel" | "carousel" | "post";
  topic: string;
  source_url: string | null;
  platforms: string[];
  status: "draft" | "published";
  virality_score: number | null;
  created_at: string;
  scheduled_at: string | null;
  published_at: Record<string, string>;
  published_urls: Record<string, string>;
  session_dir: string;
  tags: string[];
  analytics?: {
    performance_score: number;
    last_fetched_at: string;
  };
  published_media_ids?: Record<string, string>;
}

export interface VaultFile {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: VaultFile[];
}

export interface BrandModule {
  filename: string;
  module: string;
  last_updated: string;
  content: string;
  frontmatter: Record<string, unknown>;
  isEmpty: boolean;
}