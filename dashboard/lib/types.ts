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

export interface SavedPost {
  shortcode: string;
  platform: string;
  type: string;
  link: string;
  author: string;
  author_name: string;
  caption: string;
  collection: string;
  date_published: string;
  date_saved: string;
  synced_at: string;
  like_count: number;
  comment_count: number;
  view_count: number;
  downloaded: boolean;

  // Analysis fields (optional — only present if post has been analysed)
  analysed_at?: string;
  analysis_version?: number;
  overall_score?: number;
  content_verdict?: "recreate" | "skip" | "adapt";
  angle?: string;
  hook_pattern?: string;
  format_type?: string;
  brand_alignment?: number;
  analysis_body?: string; // The raw markdown under ## Analysis
}

export interface CarouselTemplate {
  name: string;
  source: string;
  created_at: string;
  colors: {
    background_start: string;
    background_end: string;
    accent: string;
    text_primary: string;
    text_secondary: string;
    safe_zone: string;
  };
  typography: {
    headline: { style: string; size: number; case: string };
    body: { style: string; size: number };
    counter: { style: string; size: number; visible: boolean; position: string };
  };
  layout: {
    hook_slide: string;
    value_slide: string;
    cta_slide: string;
    text_align: string;
  };
  spacing: {
    safe_zone_padding: number;
    content_padding_x: number;
    content_padding_y: number;
    element_gap: number;
  };
  accents: {
    left_bar: { width: number; color: string };
    top_bar: { height: number; color: string };
    divider: { width: number; height: number; color: string };
  };
  overlay: {
    alpha: number;
    direction: string;
  };
}
