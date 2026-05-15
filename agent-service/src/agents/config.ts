export type AgentType =
  | "reel"
  | "carousel"
  | "post"
  | "angle"
  | "script"
  | "publish"
  | "analytics"
  | "brand"
  | "analyse"
  | "repurpose"
  | "import-template"
  | "add-platform";

export const AGENT_TOOLS: Record<AgentType, string[]> = {
  reel: [
    "web_research", "create_session", "write_file", "read_file",
    "fetch_broll", "fetch_images", "registry_add",
  ],
  carousel: [
    "web_research", "create_session", "write_file", "read_file",
    "generate_carousel", "registry_add",
  ],
  post: [
    "web_research", "create_session", "write_file", "read_file",
    "generate_post", "registry_add",
  ],
  angle: ["web_research", "write_file", "read_file"],
  script: ["web_research", "write_file", "read_file"],
  publish: ["read_file", "registry_read", "publish_platform"],
  analytics: ["pull_metrics", "registry_read", "read_file", "write_file"],
  brand: ["brand_read", "brand_write", "brand_compile", "read_file", "write_file"],
  analyse: ["analyse_prep", "read_file", "write_file", "brand_read"],
  repurpose: [
    "repurpose_resolve", "repurpose_transcribe", "create_session",
    "write_file", "read_file", "brand_read", "registry_add",
  ],
  "import-template": ["read_file", "write_file"],
  "add-platform": ["read_file", "write_file", "composio_search"],
};
