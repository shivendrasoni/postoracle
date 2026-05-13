import Anthropic from "@anthropic-ai/sdk";
import { buildSystemPrompt } from "../prompts/index.js";
import { toolDefinitions, toolExecutors } from "../tools/index.js";
import type { Job, JobEvent, ContentType } from "../types.js";

const AGENT_TOOLS: Record<string, string[]> = {
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
  angle: [
    "web_research", "write_file", "read_file",
  ],
  script: [
    "web_research", "write_file", "read_file",
  ],
  publish: [
    "read_file", "registry_read", "publish_platform",
  ],
  analytics: [
    "pull_metrics", "registry_read", "read_file", "write_file",
  ],
  brand: [
    "brand_read", "brand_write", "brand_compile", "read_file", "write_file",
  ],
};

function getToolsForAgent(agentType: string) {
  const allowedTools = AGENT_TOOLS[agentType] ?? [];
  return toolDefinitions.filter((t) => allowedTools.includes(t.name));
}

interface RunnerOptions {
  job: Job;
  broadcast: (event: JobEvent) => void;
  apiKey: string;
}

export async function runAgentPipeline({ job, broadcast, apiKey }: RunnerOptions): Promise<void> {
  const client = new Anthropic({ apiKey });
  const systemPrompt = buildSystemPrompt(job.type);
  const tools = getToolsForAgent(job.type);

  const userMessage = buildUserMessage(job);

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: userMessage },
  ];

  broadcast({ type: "stage", stage: "initializing", status: "running" });

  let iteration = 0;
  const MAX_ITERATIONS = 50;

  while (iteration < MAX_ITERATIONS) {
    iteration++;

    let response: Anthropic.Message;
    try {
      response = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 8192,
        system: systemPrompt,
        tools: tools as Anthropic.Tool[],
        messages,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown API error";
      broadcast({ type: "error", message, recoverable: false });
      throw err;
    }

    const assistantContent = response.content;
    messages.push({ role: "assistant", content: assistantContent });

    const textBlocks = assistantContent.filter(
      (b): b is Anthropic.TextBlock => b.type === "text"
    );
    for (const block of textBlocks) {
      broadcast({ type: "thought", text: block.text });
    }

    const toolUseBlocks = assistantContent.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
    );

    if (toolUseBlocks.length === 0) {
      break;
    }

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const toolUse of toolUseBlocks) {
      broadcast({
        type: "tool",
        tool: toolUse.name,
        args: toolUse.input as Record<string, unknown>,
      });

      const executor = toolExecutors[toolUse.name];
      let result: string;
      try {
        if (!executor) {
          result = `Tool "${toolUse.name}" is not available.`;
        } else {
          result = await executor(toolUse.input as Record<string, unknown>);
        }
      } catch (err) {
        result = `Tool error: ${err instanceof Error ? err.message : String(err)}`;
        broadcast({
          type: "error",
          message: `Tool ${toolUse.name} failed: ${result}`,
          recoverable: true,
        });
      }

      toolResults.push({
        type: "tool_result",
        tool_use_id: toolUse.id,
        content: result,
      });
    }

    messages.push({ role: "user", content: toolResults });
  }

  if (iteration >= MAX_ITERATIONS) {
    broadcast({
      type: "error",
      message: "Agent reached maximum iteration limit",
      recoverable: false,
    });
  }
}

function buildUserMessage(job: Job): string {
  const parts = [`Create a ${job.type} about: ${job.topic}`];

  if (job.config.platform) {
    parts.push(`Platform: ${job.config.platform}`);
  }
  if (job.config.slides) {
    parts.push(`Slides: ${job.config.slides}`);
  }
  if (job.config.avatarId) {
    parts.push(`Avatar ID: ${job.config.avatarId}`);
  }
  if (job.config.voiceId) {
    parts.push(`Voice ID: ${job.config.voiceId}`);
  }
  if (job.config.fromAngle) {
    parts.push(`Use existing angle from: ${job.config.fromAngle}`);
  }
  if (job.config.attachments?.length) {
    parts.push(`Attachments: ${job.config.attachments.join(", ")}`);
  }
  if (job.config.autoPublish) {
    parts.push(`Auto-publish to: ${job.config.autoPublish}`);
  }

  return parts.join("\n");
}
