import Fastify from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import Anthropic from "@anthropic-ai/sdk";
import { config } from "dotenv";
import { randomUUID } from "crypto";
import path from "path";
import type { WebSocket } from "ws";
import type {
  ContentBlock,
  MessageParam,
  Tool,
  ToolResultBlockParam,
  ToolUseBlock,
} from "@anthropic-ai/sdk/resources/messages/messages.js";
import type {
  Job,
  JobEvent,
  CreateJobRequest,
  RefineRequest,
  AgentType,
} from "./types.js";
import { AGENT_TOOLS } from "./agents/config.js";
import { buildUserMessage } from "./agents/user-message.js";
import { toolDefinitions, toolExecutors } from "./tools/index.js";
import { buildSystemPrompt } from "./prompts/index.js";

// ---------------------------------------------------------------------------
// Env
// ---------------------------------------------------------------------------
config({ path: path.resolve(process.cwd(), "../.env") });

const PORT = Number(process.env.AGENT_SERVICE_PORT ?? 4000);
const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5";
const MAX_AGENT_ITERATIONS = 10;

// ---------------------------------------------------------------------------
// Anthropic client
// ---------------------------------------------------------------------------
const anthropic = new Anthropic();

// ---------------------------------------------------------------------------
// In-memory stores
// ---------------------------------------------------------------------------
const jobs = new Map<string, Job>();
const wsClients = new Map<string, Set<WebSocket>>();

// ---------------------------------------------------------------------------
// Broadcast helpers — push events to job.events AND all connected sockets
// ---------------------------------------------------------------------------
function sendToSockets(jobId: string, event: JobEvent): void {
  const sockets = wsClients.get(jobId);
  if (!sockets) return;

  const payload = JSON.stringify(event);
  for (const ws of sockets) {
    if (ws.readyState === 1 /* OPEN */) {
      ws.send(payload);
    }
  }
}

function createBroadcast(job: Job): (event: JobEvent) => void {
  return (event: JobEvent) => {
    job.events.push(event);
    sendToSockets(job.id, event);
  };
}

/**
 * Stream a thought delta to live WS clients without persisting each fragment
 * in job.events. Use broadcast() for the consolidated version after streaming.
 */
function createStreamDelta(job: Job): (text: string) => void {
  return (text: string) => {
    sendToSockets(job.id, { type: "thought", text });
  };
}

// ---------------------------------------------------------------------------
// Tool definitions — loaded from tools/index.ts
// ---------------------------------------------------------------------------

function getToolsForType(type: AgentType): Tool[] {
  const allowedNames = AGENT_TOOLS[type] ?? [];
  return toolDefinitions
    .filter((t) => allowedNames.includes(t.name))
    .map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.input_schema as Tool["input_schema"],
    }));
}

async function executeTool(
  name: string,
  input: Record<string, unknown>,
): Promise<{ content: string; is_error: boolean }> {
  console.log(`[tool] Executing: ${name}`, JSON.stringify(input).slice(0, 200));

  const executor = toolExecutors[name];
  if (!executor) {
    return { content: `Unknown tool: ${name}`, is_error: true };
  }

  try {
    const result = await executor(input);
    return { content: result, is_error: false };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { content: `Tool error: ${message}`, is_error: true };
  }
}

// ---------------------------------------------------------------------------
// System prompt — loaded from prompts/index.ts with dynamic brand context
// ---------------------------------------------------------------------------
function getSystemPrompt(type: AgentType, _topic: string): string {
  return buildSystemPrompt(type);
}

// ---------------------------------------------------------------------------
// Agent pipeline — the core agentic loop
// ---------------------------------------------------------------------------
async function runAgentPipeline(
  job: Job,
  broadcast: (event: JobEvent) => void,
): Promise<void> {
  job.status = "running";
  broadcast({ type: "stage", stage: "initializing", status: "running" });

  const tools = getToolsForType(job.type);
  const systemPrompt = getSystemPrompt(job.type, job.topic);
  const messages: MessageParam[] = [
    { role: "user", content: buildUserMessage(job) },
  ];

  broadcast({ type: "stage", stage: "initializing", status: "complete" });
  broadcast({ type: "stage", stage: "agent_loop", status: "running" });

  let iteration = 0;

  while (iteration < MAX_AGENT_ITERATIONS) {
    iteration++;
    broadcast({
      type: "thought",
      text: `Agent iteration ${iteration}/${MAX_AGENT_ITERATIONS}`,
    });

    // Check if job was cancelled between iterations
    if (job.status !== "running") {
      broadcast({ type: "thought", text: "Job was cancelled, stopping pipeline." });
      return;
    }

    // Call Claude with streaming for live progress
    const stream = anthropic.messages.stream({
      model: MODEL,
      max_tokens: 4096,
      system: systemPrompt,
      messages,
      tools,
    });

    // Stream partial text live to WS clients (not persisted per-delta)
    const streamDelta = createStreamDelta(job);
    let streamedText = "";
    stream.on("text", (text) => {
      if (text.trim()) {
        streamDelta(text);
        streamedText += text;
      }
    });

    const response = await stream.finalMessage();

    // Persist one consolidated thought for the full streamed text
    if (streamedText.trim()) {
      broadcast({ type: "thought", text: streamedText.trim().slice(0, 1000) });
    }

    // Push assistant turn into conversation history
    messages.push({ role: "assistant", content: response.content });

    // If Claude wants to use tools, execute them
    if (response.stop_reason === "tool_use") {
      const toolUseBlocks = response.content.filter(
        (block): block is ToolUseBlock => block.type === "tool_use",
      );

      const toolResults: ToolResultBlockParam[] = [];

      for (const toolUse of toolUseBlocks) {
        broadcast({
          type: "tool",
          tool: toolUse.name,
          args: toolUse.input as Record<string, unknown>,
        });

        const result = await executeTool(
          toolUse.name,
          toolUse.input as Record<string, unknown>,
        );

        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: result.content,
          is_error: result.is_error,
        });

        broadcast({
          type: "thought",
          text: `Tool ${toolUse.name} → ${result.is_error ? "error" : "ok"}`,
        });
      }

      // Push all tool results as a single user message
      messages.push({ role: "user", content: toolResults });

      // Continue the loop — Claude will process tool results
      continue;
    }

    // Claude finished without requesting tools — we're done
    if (response.stop_reason === "end_turn") {
      // Extract final text from response
      const textBlocks = response.content.filter(
        (block): block is Extract<ContentBlock, { type: "text" }> =>
          block.type === "text",
      );
      const finalText = textBlocks.map((b) => b.text).join("\n");

      broadcast({ type: "thought", text: finalText.slice(0, 500) });
      break;
    }

    // Unexpected stop reason (refusal, max_tokens, pause_turn) — mark as failed
    const reason = response.stop_reason ?? "unknown";
    job.status = "failed";
    job.error = `Unexpected stop_reason: ${reason}`;
    job.completedAt = new Date().toISOString();
    broadcast({ type: "stage", stage: "agent_loop", status: "failed" });
    broadcast({
      type: "error",
      message: `Agent stopped unexpectedly: ${reason}`,
      recoverable: false,
    });
    return;
  }

  if (iteration >= MAX_AGENT_ITERATIONS) {
    broadcast({
      type: "thought",
      text: `Reached maximum iterations (${MAX_AGENT_ITERATIONS}). Stopping.`,
    });
  }

  // Mark complete
  const sessionDir = `vault/outputs/${job.type}s/${new Date().toISOString().slice(0, 10)}-${job.topic.toLowerCase().replace(/\s+/g, "-").slice(0, 40)}`;
  job.sessionDir = sessionDir;
  job.status = "completed";
  job.completedAt = new Date().toISOString();

  broadcast({ type: "stage", stage: "agent_loop", status: "complete" });
  broadcast({ type: "done", sessionDir });
}

// ---------------------------------------------------------------------------
// Fastify server
// ---------------------------------------------------------------------------
const fastify = Fastify({ logger: true });

async function start(): Promise<void> {
  // Plugins
  await fastify.register(cors, { origin: "http://localhost:3000" });
  await fastify.register(websocket);

  // -------------------------------------------------------------------------
  // REST routes
  // -------------------------------------------------------------------------

  // POST /api/jobs — create a new job
  fastify.post<{ Body: CreateJobRequest }>("/api/jobs", async (request, reply) => {
    const body = request.body;

    if (!body?.type || !body?.topic) {
      return reply.status(400).send({ error: "type and topic are required" });
    }

    const job: Job = {
      id: randomUUID(),
      type: body.type,
      topic: body.topic,
      status: "queued",
      createdAt: new Date().toISOString(),
      config: body,
      events: [],
    };

    jobs.set(job.id, job);

    const broadcast = createBroadcast(job);

    // Fire and forget — pipeline runs async while we return the jobId
    void runAgentPipeline(job, broadcast).catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      job.status = "failed";
      job.error = message;
      job.completedAt = new Date().toISOString();
      broadcast({ type: "error", message, recoverable: false });
    });

    return reply.status(201).send({ jobId: job.id });
  });

  // GET /api/jobs — list all jobs, most recent first
  fastify.get("/api/jobs", async (_request, reply) => {
    const allJobs = Array.from(jobs.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    return reply.send(allJobs);
  });

  // GET /api/jobs/:id — get a single job
  fastify.get<{ Params: { id: string } }>("/api/jobs/:id", async (request, reply) => {
    const job = jobs.get(request.params.id);
    if (!job) {
      return reply.status(404).send({ error: "Job not found" });
    }
    return reply.send(job);
  });

  // POST /api/jobs/:id/refine — placeholder for refinement
  fastify.post<{ Params: { id: string }; Body: RefineRequest }>(
    "/api/jobs/:id/refine",
    async (request, reply) => {
      const job = jobs.get(request.params.id);
      if (!job) {
        return reply.status(404).send({ error: "Job not found" });
      }

      const { message } = request.body ?? {};
      if (!message) {
        return reply.status(400).send({ error: "message is required" });
      }

      const broadcast = createBroadcast(job);
      broadcast({ type: "thought", text: `Refinement requested: ${message}` });

      return reply.send({ status: "refinement_queued", jobId: job.id });
    },
  );

  // DELETE /api/jobs/:id — cancel a job
  fastify.delete<{ Params: { id: string } }>(
    "/api/jobs/:id",
    async (request, reply) => {
      const job = jobs.get(request.params.id);
      if (!job) {
        return reply.status(404).send({ error: "Job not found" });
      }

      job.status = "cancelled";
      job.completedAt = new Date().toISOString();

      const broadcast = createBroadcast(job);
      broadcast({ type: "thought", text: "Job cancelled by user" });

      return reply.send({ status: "cancelled", jobId: job.id });
    },
  );

  // -------------------------------------------------------------------------
  // WebSocket endpoint
  // -------------------------------------------------------------------------
  fastify.get("/ws", { websocket: true }, (socket, request) => {
    const query = request.query as Record<string, string | undefined>;
    const jobId = query.jobId;

    if (!jobId) {
      socket.close(1008, "Missing jobId query parameter");
      return;
    }

    const job = jobs.get(jobId);
    if (!job) {
      socket.close(1008, "Unknown jobId");
      return;
    }

    // Register this socket for the job
    if (!wsClients.has(jobId)) {
      wsClients.set(jobId, new Set());
    }
    wsClients.get(jobId)!.add(socket);

    // Replay all buffered events so late-joining clients catch up
    for (const event of job.events) {
      if (socket.readyState === 1) {
        socket.send(JSON.stringify(event));
      }
    }

    // Handle incoming messages (future: refinement over WS)
    socket.on("message", (data: Buffer | ArrayBuffer | Buffer[]) => {
      try {
        const parsed = JSON.parse(data.toString()) as { type?: string; message?: string };
        if (parsed.type === "ping") {
          socket.send(JSON.stringify({ type: "pong" }));
        }
      } catch {
        // Ignore malformed messages
      }
    });

    // Cleanup on close
    socket.on("close", () => {
      const sockets = wsClients.get(jobId);
      if (sockets) {
        sockets.delete(socket);
        if (sockets.size === 0) {
          wsClients.delete(jobId);
        }
      }
    });
  });

  // -------------------------------------------------------------------------
  // Start listening
  // -------------------------------------------------------------------------
  try {
    await fastify.listen({ port: PORT, host: "0.0.0.0" });
    console.log(`Agent service listening on http://localhost:${PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

start();
