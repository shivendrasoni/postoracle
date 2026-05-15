import Anthropic from "@anthropic-ai/sdk";
import { buildSystemPrompt } from "../prompts/index.js";
import { toolDefinitions, toolExecutors } from "../tools/index.js";
import { AGENT_TOOLS } from "./config.js";
import { buildUserMessage } from "./user-message.js";
import type { Job, JobEvent, AgentType } from "../types.js";

function getToolsForAgent(agentType: string) {
  const allowedTools = AGENT_TOOLS[agentType as AgentType] ?? [];
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

