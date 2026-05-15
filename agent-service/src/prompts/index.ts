import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { REEL_AGENT_PROMPT } from "./reel.js";
import { CAROUSEL_AGENT_PROMPT } from "./carousel.js";
import { POST_AGENT_PROMPT } from "./post.js";
import { ANGLE_AGENT_PROMPT } from "./angle.js";
import { PUBLISH_AGENT_PROMPT } from "./publish.js";
import { ANALYTICS_AGENT_PROMPT } from "./analytics.js";
import { BRAND_AGENT_PROMPT } from "./brand.js";
import { ANALYSE_AGENT_PROMPT } from "./analyse.js";
import { REPURPOSE_AGENT_PROMPT } from "./repurpose.js";
import { IMPORT_TEMPLATE_AGENT_PROMPT } from "./import-template.js";
import { ADD_PLATFORM_AGENT_PROMPT } from "./add-platform.js";
import type { AgentType } from "../agents/config.js";

const BASE_PROMPTS: Record<string, string> = {
  reel: REEL_AGENT_PROMPT,
  carousel: CAROUSEL_AGENT_PROMPT,
  post: POST_AGENT_PROMPT,
  angle: ANGLE_AGENT_PROMPT,
  script: REEL_AGENT_PROMPT,
  publish: PUBLISH_AGENT_PROMPT,
  analytics: ANALYTICS_AGENT_PROMPT,
  brand: BRAND_AGENT_PROMPT,
  analyse: ANALYSE_AGENT_PROMPT,
  repurpose: REPURPOSE_AGENT_PROMPT,
  "import-template": IMPORT_TEMPLATE_AGENT_PROMPT,
  "add-platform": ADD_PLATFORM_AGENT_PROMPT,
};

const PROJECT_ROOT = resolve(process.cwd(), "..");

function tryReadFile(relativePath: string): string | null {
  const fullPath = resolve(PROJECT_ROOT, relativePath);
  if (!existsSync(fullPath)) return null;
  return readFileSync(fullPath, "utf-8");
}

function loadBrandContext(): string {
  const modules = [
    "vault/brand/brand-voice.md",
    "vault/brand/modules/brand.md",
    "vault/brand/modules/style.md",
    "vault/brand/modules/cta.md",
    "vault/brand/modules/niche.md",
  ];

  const loaded: string[] = [];
  for (const mod of modules) {
    const content = tryReadFile(mod);
    if (content) {
      loaded.push(`## ${mod.split("/").pop()}\n${content}`);
    }
  }

  if (loaded.length === 0) return "";
  return `\n\n# Brand Context\n\n${loaded.join("\n\n")}`;
}

function loadTemplateConfig(): string {
  const content = tryReadFile("vault/brand/templates/active.yaml");
  if (!content) return "";
  return `\n\n# Template Config\n\n${content}`;
}

export function buildSystemPrompt(agentType: AgentType | string): string {
  const base = BASE_PROMPTS[agentType];
  if (!base) throw new Error(`Unknown agent type: ${agentType}`);

  const brand = loadBrandContext();
  const template = agentType === "carousel" ? loadTemplateConfig() : "";

  return [base, brand, template].filter(Boolean).join("");
}
