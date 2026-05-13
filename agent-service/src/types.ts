export type ContentType = "reel" | "carousel" | "post" | "angle" | "script";
export type Platform = "instagram" | "linkedin" | "x";
export type JobStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

export interface CreateJobRequest {
  type: ContentType;
  topic: string;
  platform?: Platform;
  slides?: 5 | 6;
  avatarId?: string;
  voiceId?: string;
  fromAngle?: string;
  attachments?: string[];
  autoPublish?: string;
}

export interface Job {
  id: string;
  type: ContentType;
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
