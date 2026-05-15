import { readFileSync } from "fs";
import path from "path";
import type { MessageParam } from "@anthropic-ai/sdk/resources/messages/messages.js";
import type { Job } from "../types.js";

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp"]);

function mediaTypeFromExt(ext: string): "image/png" | "image/jpeg" | "image/gif" | "image/webp" {
  switch (ext) {
    case ".png": return "image/png";
    case ".gif": return "image/gif";
    case ".webp": return "image/webp";
    default: return "image/jpeg";
  }
}

export function buildUserMessage(job: Job): MessageParam["content"] {
  const params = job.config.params ?? {};

  switch (job.type) {
    case "analyse": {
      const shortcode = params.shortcode ?? job.topic;
      const parts = [`Analyse saved post: ${shortcode}`];
      if (params.refresh) parts.push("Flag: --refresh (re-analyse even if already done)");
      return parts.join("\n");
    }

    case "repurpose": {
      const source = params.source ?? job.topic;
      const parts = [`Repurpose this source into original content: ${source}`];
      if (params.mode) parts.push(`Output mode: ${params.mode}`);
      if (params.scriptMode) parts.push(`Script mode: ${params.scriptMode}`);
      if (params.duration) parts.push(`Target duration: ${params.duration}s`);
      if (params.auto) parts.push("Flag: --auto (skip strategy confirmation)");
      return parts.join("\n");
    }

    case "import-template": {
      const imagePath = (params.imagePath ?? job.topic) as string;
      const text = "Import carousel template from this screenshot. Analyze the visual properties and generate a template YAML file.";
      const ext = path.extname(imagePath).toLowerCase();

      if (IMAGE_EXTENSIONS.has(ext)) {
        try {
          const data = readFileSync(imagePath).toString("base64");
          return [
            { type: "text", text },
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaTypeFromExt(ext),
                data,
              },
            },
          ];
        } catch {
          return `${text}\n\nImage path: ${imagePath} (could not read file — use read_file tool to inspect it)`;
        }
      }

      return `${text}\n\nImage path: ${imagePath}`;
    }

    case "add-platform": {
      const platformName = params.platformName ?? job.topic;
      const types = params.types ?? "both";
      return `Add platform "${platformName}" to the publish system.\nContent types to support: ${types}\n\nDiscover Composio slugs and scaffold handler functions in scripts/publish.py.`;
    }

    default: {
      const parts = [`Create a ${job.type} about: ${job.topic}`];
      if (job.config.platform) parts.push(`Platform: ${job.config.platform}`);
      if (job.config.slides) parts.push(`Slides: ${job.config.slides}`);
      if (job.config.avatarId) parts.push(`Avatar ID: ${job.config.avatarId}`);
      if (job.config.voiceId) parts.push(`Voice ID: ${job.config.voiceId}`);
      if (job.config.fromAngle) parts.push(`Use existing angle from: ${job.config.fromAngle}`);
      if (job.config.attachments?.length) parts.push(`Attachments: ${job.config.attachments.join(", ")}`);
      if (job.config.autoPublish) parts.push(`Auto-publish to: ${job.config.autoPublish}`);
      return parts.join("\n");
    }
  }
}
