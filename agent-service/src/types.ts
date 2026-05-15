import type { AgentType } from "./agents/config.js";

export type { AgentType };
export type Platform = "instagram" | "linkedin" | "x";
export type JobStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

export interface CreateJobRequest {
  type: AgentType;
  topic: string;
  platform?: Platform;
  slides?: 5 | 6;
  avatarId?: string;
  voiceId?: string;
  styleId?: string;
  fromAngle?: string;
  attachments?: string[];
  autoPublish?: string;
  params?: Record<string, unknown>;
}

export interface Job {
  id: string;
  type: AgentType;
  topic: string;
  status: JobStatus;
  createdAt: string;
  completedAt?: string;
  sessionDir?: string;
  config: CreateJobRequest;
  events: JobEvent[];
  error?: string;
}

export type JobEvent =
  | { type: "stage"; stage: string; status: "running" | "complete" | "failed"; elapsed?: number }
  | { type: "thought"; text: string }
  | { type: "tool"; tool: string; args: Record<string, unknown> }
  | { type: "preview"; url: string }
  | { type: "error"; message: string; recoverable: boolean }
  | { type: "done"; sessionDir: string };

export interface RefineRequest {
  message: string;
}

export interface ToolResult {
  success: boolean;
  output: string;
  error?: string;
}
