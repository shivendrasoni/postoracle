import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export type ToolExecutor = (input: Record<string, unknown>) => Promise<string>;

// ---------------------------------------------------------------------------
// Spawn helpers
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..", "..", "..");

interface SpawnResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Spawn a Python script by file path.
 * Optionally pipe `stdin` content to the child process.
 */
function spawnPython(
  scriptPath: string,
  args: string[],
  stdin?: string,
): Promise<SpawnResult> {
  return new Promise((resolve, reject) => {
    const proc = spawn(
      "python3",
      [path.join(PROJECT_ROOT, scriptPath), ...args],
      { cwd: PROJECT_ROOT, env: { ...process.env } },
    );
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d: Buffer) => (stdout += d));
    proc.stderr.on("data", (d: Buffer) => (stderr += d));
    proc.on("close", (code) => resolve({ stdout, stderr, exitCode: code ?? 1 }));
    proc.on("error", reject);

    if (stdin !== undefined) {
      proc.stdin.write(stdin);
      proc.stdin.end();
    }
  });
}

/**
 * Spawn a Python module (python3 -m <module> ...).
 * Required for scripts that use relative imports (publish.py, analytics.py).
 */
function spawnPythonModule(
  moduleName: string,
  args: string[],
  stdin?: string,
): Promise<SpawnResult> {
  return new Promise((resolve, reject) => {
    const proc = spawn("python3", ["-m", moduleName, ...args], {
      cwd: PROJECT_ROOT,
      env: { ...process.env },
    });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d: Buffer) => (stdout += d));
    proc.stderr.on("data", (d: Buffer) => (stderr += d));
    proc.on("close", (code) => resolve({ stdout, stderr, exitCode: code ?? 1 }));
    proc.on("error", reject);

    if (stdin !== undefined) {
      proc.stdin.write(stdin);
      proc.stdin.end();
    }
  });
}

/** Format spawn result into a string suitable for returning to Claude. */
function formatResult(result: SpawnResult): string {
  if (result.exitCode === 0) {
    return result.stdout.trim() || "(success — no output)";
  }
  const parts: string[] = [];
  if (result.stderr.trim()) parts.push(result.stderr.trim());
  if (result.stdout.trim()) parts.push(result.stdout.trim());
  return `[EXIT ${result.exitCode}] ${parts.join("\n")}`;
}

// ---------------------------------------------------------------------------
// 1. create_session
// ---------------------------------------------------------------------------

const createSessionDef: ToolDefinition = {
  name: "create_session",
  description:
    "Create a session directory for a content pipeline run. " +
    "Returns the absolute path to the created directory.",
  input_schema: {
    type: "object",
    properties: {
      topic: {
        type: "string",
        description: "Topic or URL for the session — used to generate the folder slug.",
      },
      output_dir: {
        type: "string",
        description:
          "Relative output directory under the project root (default: vault/outputs/reels). " +
          "Use vault/outputs/carousels for carousels, vault/outputs/posts for posts.",
      },
    },
    required: ["topic"],
  },
};

const createSessionExec: ToolExecutor = async (input) => {
  const args = [input.topic as string];
  args.push("--base-dir", PROJECT_ROOT);
  if (input.output_dir) args.push("--output-dir", input.output_dir as string);
  const result = await spawnPython("scripts/create_session.py", args);
  return formatResult(result);
};

// ---------------------------------------------------------------------------
// 2. generate_carousel
// ---------------------------------------------------------------------------

const generateCarouselDef: ToolDefinition = {
  name: "generate_carousel",
  description:
    "Render carousel slide images from a plan.json file. " +
    "Requires OPENAI_API_KEY. Outputs PNGs + caption.md to out_dir. " +
    "plan.json must have at least 3 slides.",
  input_schema: {
    type: "object",
    properties: {
      plan_json: {
        type: "string",
        description: "Absolute path to plan.json file.",
      },
      out_dir: {
        type: "string",
        description: "Absolute path to output directory for PNGs and caption.md.",
      },
      brand: {
        type: "string",
        description: "Path to brand palette file (JSON or .md with YAML frontmatter). Optional.",
      },
      slide: {
        type: "number",
        description: "Render only this slide number (1-indexed). Omit to render all.",
      },
      vault_root: {
        type: "string",
        description: "Path to vault root for loading carousel template. Optional.",
      },
    },
    required: ["plan_json", "out_dir"],
  },
};

const generateCarouselExec: ToolExecutor = async (input) => {
  const args = [input.plan_json as string, "--out-dir", input.out_dir as string];
  if (input.brand) args.push("--brand", input.brand as string);
  if (input.slide !== undefined) args.push("--slide", String(input.slide));
  if (input.vault_root) args.push("--vault-root", input.vault_root as string);
  const result = await spawnPython("scripts/generate_carousel.py", args);
  return formatResult(result);
};

// ---------------------------------------------------------------------------
// 3. generate_post
// ---------------------------------------------------------------------------

const generatePostDef: ToolDefinition = {
  name: "generate_post",
  description:
    "Generate a single-image social media post using GPT-image-2. " +
    "Requires OPENAI_API_KEY. Outputs master + platform-adapted images.",
  input_schema: {
    type: "object",
    properties: {
      prompt: {
        type: "string",
        description: "Image generation prompt describing the visual.",
      },
      out_dir: {
        type: "string",
        description: "Absolute path to output directory.",
      },
      brand: {
        type: "string",
        description: "Path to brand palette file. Optional.",
      },
      use_reference: {
        type: "boolean",
        description: "Use reference photo for likeness preservation. Requires photo_path.",
      },
      photo_path: {
        type: "string",
        description: "Path to reference photo (for use_reference mode).",
      },
      platforms: {
        type: "string",
        description: "Comma-separated platforms (default: instagram,linkedin).",
      },
    },
    required: ["prompt", "out_dir"],
  },
};

const generatePostExec: ToolExecutor = async (input) => {
  const args = ["--prompt", input.prompt as string, "--out-dir", input.out_dir as string];
  if (input.brand) args.push("--brand", input.brand as string);
  if (input.use_reference) args.push("--use-reference");
  if (input.photo_path) args.push("--photo-path", input.photo_path as string);
  if (input.platforms) args.push("--platforms", input.platforms as string);
  const result = await spawnPython("scripts/generate_post.py", args);
  return formatResult(result);
};

// ---------------------------------------------------------------------------
// 4. registry_add
// ---------------------------------------------------------------------------

const registryAddDef: ToolDefinition = {
  name: "registry_add",
  description:
    "Add a new entry to the content registry (vault/content-registry.json). " +
    "Entry must have a unique 'id' field. Duplicate IDs are rejected.",
  input_schema: {
    type: "object",
    properties: {
      entry: {
        type: "object",
        description:
          "Registry entry object. Must include 'id' (string). " +
          "Typical fields: id, type, topic, status, platforms, session_dir, virality_score, created_at.",
      },
      registry_path: {
        type: "string",
        description: "Path to registry JSON (default: vault/content-registry.json).",
      },
    },
    required: ["entry"],
  },
};

const registryAddExec: ToolExecutor = async (input) => {
  const registryPath = (input.registry_path as string) || "vault/content-registry.json";
  const entryJson = JSON.stringify(input.entry);
  // Registry.add() is not exposed via CLI — use inline Python with stdin
  // Pass registryPath via sys.argv[1] to avoid shell-interpolation issues
  const code = [
    "import json, sys",
    "sys.path.insert(0, '.')",
    "from scripts.registry import Registry",
    "reg = Registry(sys.argv[1])",
    "entry = json.loads(sys.stdin.read())",
    "reg.add(entry)",
    "print(json.dumps(entry, indent=2))",
  ].join("; ");

  return new Promise<string>((resolve, reject) => {
    const proc = spawn(
      "python3",
      ["-c", code, registryPath],
      { cwd: PROJECT_ROOT, env: { ...process.env } },
    );
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d: Buffer) => (stdout += d));
    proc.stderr.on("data", (d: Buffer) => (stderr += d));
    proc.on("close", (exitCode) => {
      resolve(formatResult({ stdout, stderr, exitCode: exitCode ?? 1 }));
    });
    proc.on("error", reject);
    proc.stdin.write(entryJson);
    proc.stdin.end();
  });
};

// ---------------------------------------------------------------------------
// 5. registry_read
// ---------------------------------------------------------------------------

const registryReadDef: ToolDefinition = {
  name: "registry_read",
  description:
    "Read entries from the content registry. " +
    "If 'id' is provided, returns that single entry. " +
    "Otherwise returns a filtered list (all filters optional).",
  input_schema: {
    type: "object",
    properties: {
      id: {
        type: "string",
        description: "Specific entry ID to retrieve. Omit for list mode.",
      },
      status: {
        type: "string",
        description: "Filter by status (e.g. draft, published).",
      },
      type: {
        type: "string",
        description: "Filter by content type (reel, carousel, post).",
      },
      platform: {
        type: "string",
        description: "Filter by platform (instagram, linkedin, x).",
      },
      registry_path: {
        type: "string",
        description: "Path to registry JSON (default: vault/content-registry.json).",
      },
    },
    required: [],
  },
};

const registryReadExec: ToolExecutor = async (input) => {
  const registryPath = (input.registry_path as string) || undefined;
  const baseArgs: string[] = [];
  if (registryPath) baseArgs.push("--registry", registryPath);

  if (input.id) {
    const args = ["get", "--id", input.id as string, ...baseArgs];
    const result = await spawnPython("scripts/registry.py", args);
    return formatResult(result);
  }

  const args = ["list", ...baseArgs];
  if (input.status) args.push("--status", input.status as string);
  if (input.type) args.push("--type", input.type as string);
  if (input.platform) args.push("--platform", input.platform as string);
  const result = await spawnPython("scripts/registry.py", args);
  return formatResult(result);
};

// ---------------------------------------------------------------------------
// 6. publish_platform
// ---------------------------------------------------------------------------

const publishPlatformDef: ToolDefinition = {
  name: "publish_platform",
  description:
    "Publish a content session to social platforms via Composio CLI. " +
    "Auto-detects content type (reel/carousel/post) from session directory contents.",
  input_schema: {
    type: "object",
    properties: {
      session_dir: {
        type: "string",
        description: "Absolute path to the session directory containing content assets.",
      },
      platform: {
        type: "string",
        enum: ["instagram", "linkedin", "x", "all"],
        description: "Target platform or 'all' for all connected platforms.",
      },
      dry_run: {
        type: "boolean",
        description: "Preview what would be published without actually posting.",
      },
    },
    required: ["session_dir", "platform"],
  },
};

const publishPlatformExec: ToolExecutor = async (input) => {
  const args = [
    "--session-dir", input.session_dir as string,
    "--platform", input.platform as string,
  ];
  if (input.dry_run) args.push("--dry-run");
  // publish.py uses `from scripts.registry import Registry` — must run as module
  const result = await spawnPythonModule("scripts.publish", args);
  return formatResult(result);
};

// ---------------------------------------------------------------------------
// 7. pull_metrics
// ---------------------------------------------------------------------------

const pullMetricsDef: ToolDefinition = {
  name: "pull_metrics",
  description:
    "Pull social media analytics for published content. " +
    "Supports subcommands: pull (fetch metrics), summary (table), detail (single entry), " +
    "dashboard (generate vault markdown), insights (generate performance.md).",
  input_schema: {
    type: "object",
    properties: {
      command: {
        type: "string",
        enum: ["pull", "summary", "detail", "dashboard", "insights"],
        description: "Analytics subcommand.",
      },
      entry_id: {
        type: "string",
        description: "Entry ID (required for detail, optional for pull to target one entry).",
      },
      force: {
        type: "boolean",
        description: "Ignore cache window and re-fetch (pull only).",
      },
      vault: {
        type: "string",
        description: "Path to vault root (for dashboard/insights).",
      },
    },
    required: ["command"],
  },
};

const pullMetricsExec: ToolExecutor = async (input) => {
  const command = input.command as string;
  const args = [command];

  if (command === "pull") {
    if (input.entry_id) args.push("--id", input.entry_id as string);
    if (input.force) args.push("--force");
  } else if (command === "detail") {
    if (!input.entry_id) return "[ERROR] entry_id is required for detail command";
    args.push("--id", input.entry_id as string);
  } else if (command === "dashboard" || command === "insights") {
    if (input.vault) args.push("--vault", input.vault as string);
  }

  // analytics.py uses `from scripts.registry import Registry` — must run as module
  const result = await spawnPythonModule("scripts.analytics", args);
  return formatResult(result);
};

// ---------------------------------------------------------------------------
// 8. brand_read
// ---------------------------------------------------------------------------

const brandReadDef: ToolDefinition = {
  name: "brand_read",
  description:
    "Read a brand voice module from the vault. Returns YAML frontmatter + body.",
  input_schema: {
    type: "object",
    properties: {
      module: {
        type: "string",
        enum: [
          "niche", "style", "competitors", "goals", "cta", "watermark",
          "brand", "pillars", "audience", "strategy", "photo", "performance",
        ],
        description: "Brand module name.",
      },
      vault: {
        type: "string",
        description: "Path to vault root (default: vault).",
      },
    },
    required: ["module"],
  },
};

const brandReadExec: ToolExecutor = async (input) => {
  const args: string[] = [];
  if (input.vault) args.push("--vault", input.vault as string);
  args.push("read", "--module", input.module as string);
  const result = await spawnPython("scripts/brand_voice.py", args);
  return formatResult(result);
};

// ---------------------------------------------------------------------------
// 9. brand_write
// ---------------------------------------------------------------------------

const brandWriteDef: ToolDefinition = {
  name: "brand_write",
  description:
    "Write a brand voice module to the vault. Content should include YAML frontmatter " +
    "(--- delimited) with at minimum a last_updated field. Returns the path written.",
  input_schema: {
    type: "object",
    properties: {
      module: {
        type: "string",
        enum: [
          "niche", "style", "competitors", "goals", "cta", "watermark",
          "brand", "pillars", "audience", "strategy", "photo", "performance",
        ],
        description: "Brand module name.",
      },
      content: {
        type: "string",
        description:
          "Full file content for the module, including YAML frontmatter " +
          "(--- delimited with last_updated, module fields).",
      },
      vault: {
        type: "string",
        description: "Path to vault root (default: vault).",
      },
    },
    required: ["module", "content"],
  },
};

const brandWriteExec: ToolExecutor = async (input) => {
  const args: string[] = [];
  if (input.vault) args.push("--vault", input.vault as string);
  args.push("write", "--module", input.module as string);
  // brand_voice.py write reads from stdin
  const result = await spawnPython("scripts/brand_voice.py", args, input.content as string);
  return formatResult(result);
};

// ---------------------------------------------------------------------------
// 10. brand_compile
// ---------------------------------------------------------------------------

const brandCompileDef: ToolDefinition = {
  name: "brand_compile",
  description:
    "Regenerate the master brand-voice.md from all brand modules. Returns the path written.",
  input_schema: {
    type: "object",
    properties: {
      vault: {
        type: "string",
        description: "Path to vault root (default: vault).",
      },
    },
    required: [],
  },
};

const brandCompileExec: ToolExecutor = async (input) => {
  const args: string[] = [];
  if (input.vault) args.push("--vault", input.vault as string);
  args.push("compile");
  const result = await spawnPython("scripts/brand_voice.py", args);
  return formatResult(result);
};

// ---------------------------------------------------------------------------
// 11. fetch_broll
// ---------------------------------------------------------------------------

const fetchBrollDef: ToolDefinition = {
  name: "fetch_broll",
  description:
    "Fetch b-roll video or fallback photo from Pexels. Requires PEXELS_API_KEY. " +
    "Downloads to out_dir with the given slug as filename.",
  input_schema: {
    type: "object",
    properties: {
      keyword: {
        type: "string",
        description: "Search keyword for Pexels (e.g. 'coffee shop', 'technology').",
      },
      out_dir: {
        type: "string",
        description: "Absolute path to output directory.",
      },
      slug: {
        type: "string",
        description: "Filename slug (without extension) for the downloaded file.",
      },
    },
    required: ["keyword", "out_dir", "slug"],
  },
};

const fetchBrollExec: ToolExecutor = async (input) => {
  const args = [
    input.keyword as string,
    input.out_dir as string,
    input.slug as string,
  ];
  const result = await spawnPython("scripts/fetch_broll.py", args);
  return formatResult(result);
};

// ---------------------------------------------------------------------------
// 12. fetch_images
// ---------------------------------------------------------------------------

const fetchImagesDef: ToolDefinition = {
  name: "fetch_images",
  description:
    "Generate a portrait image using GPT-image-2. Requires OPENAI_API_KEY. " +
    "Returns the path to the saved image.",
  input_schema: {
    type: "object",
    properties: {
      prompt: {
        type: "string",
        description: "Image generation prompt.",
      },
      out_path: {
        type: "string",
        description: "Absolute path where the image should be saved (e.g. /path/to/image.png).",
      },
    },
    required: ["prompt", "out_path"],
  },
};

const fetchImagesExec: ToolExecutor = async (input) => {
  const args = [input.prompt as string, input.out_path as string];
  const result = await spawnPython("scripts/fetch_images.py", args);
  return formatResult(result);
};

// ---------------------------------------------------------------------------
// 13. check_env
// ---------------------------------------------------------------------------

const checkEnvDef: ToolDefinition = {
  name: "check_env",
  description:
    "Validate that required environment variables are set. " +
    "Returns 'Environment OK' or lists missing keys. " +
    "Required: PEXELS_API_KEY, OPENAI_API_KEY, HEYGEN_API_KEY. " +
    "Optional: PIXABAY_API_KEY, ELEVENLABS_API_KEY.",
  input_schema: {
    type: "object",
    properties: {},
    required: [],
  },
};

const checkEnvExec: ToolExecutor = async () => {
  const result = await spawnPython("scripts/check_env.py", []);
  // check_env exits non-zero when keys are missing — that is useful output, not an error
  const parts: string[] = [];
  if (result.stderr.trim()) parts.push(result.stderr.trim());
  if (result.stdout.trim()) parts.push(result.stdout.trim());
  return parts.join("\n") || "(no output)";
};

// ---------------------------------------------------------------------------
// 14. web_research (stub)
// ---------------------------------------------------------------------------

const webResearchDef: ToolDefinition = {
  name: "web_research",
  description:
    "Fetch and summarize content from a URL or research a topic. " +
    "(Stub — not yet implemented; returns a placeholder.)",
  input_schema: {
    type: "object",
    properties: {
      url: {
        type: "string",
        description: "URL to fetch content from.",
      },
      topic: {
        type: "string",
        description: "Topic to research (used when no URL provided).",
      },
    },
    required: [],
  },
};

const webResearchExec: ToolExecutor = async (input) => {
  return JSON.stringify({
    status: "stub",
    note: "web_research is not yet implemented. Use the WebFetch MCP tool or manual research.",
    input: { url: input.url, topic: input.topic },
  });
};

// ---------------------------------------------------------------------------
// 15. analyse_prep
// ---------------------------------------------------------------------------

const analysePrepDef: ToolDefinition = {
  name: "analyse_prep",
  description:
    "Prepare structured analysis data for a saved Instagram post. " +
    "Returns JSON with engagement metrics, transcript, keyframe paths, and caption.",
  input_schema: {
    type: "object",
    properties: {
      shortcode: {
        type: "string",
        description: "Instagram post shortcode to analyse.",
      },
    },
    required: ["shortcode"],
  },
};

const analysePrepExec: ToolExecutor = async (input) => {
  const result = await spawnPythonModule("scripts.analyse", [
    "prep",
    input.shortcode as string,
  ]);
  return formatResult(result);
};

// ---------------------------------------------------------------------------
// 16. repurpose_resolve
// ---------------------------------------------------------------------------

const repurposeResolveDef: ToolDefinition = {
  name: "repurpose_resolve",
  description:
    "Resolve a source identifier (shortcode, Instagram URL, or local path) " +
    "to a video path and metadata for repurposing.",
  input_schema: {
    type: "object",
    properties: {
      source: {
        type: "string",
        description:
          "Instagram shortcode, URL (https://instagram.com/reel/...), or local video path.",
      },
    },
    required: ["source"],
  },
};

const repurposeResolveExec: ToolExecutor = async (input) => {
  const code = [
    "import json, sys",
    "sys.path.insert(0, '.')",
    "from scripts.repurpose import resolve_source",
    "result = resolve_source(sys.argv[1])",
    "result['video_path'] = str(result['video_path'])",
    "print(json.dumps(result, indent=2, default=str))",
  ].join("; ");

  return new Promise<string>((resolve, reject) => {
    const proc = spawn(
      "python3",
      ["-c", code, input.source as string],
      { cwd: PROJECT_ROOT, env: { ...process.env } },
    );
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d: Buffer) => (stdout += d));
    proc.stderr.on("data", (d: Buffer) => (stderr += d));
    proc.on("close", (exitCode) => {
      resolve(formatResult({ stdout, stderr, exitCode: exitCode ?? 1 }));
    });
    proc.on("error", reject);
  });
};

// ---------------------------------------------------------------------------
// 17. repurpose_transcribe
// ---------------------------------------------------------------------------

const repurposeTranscribeDef: ToolDefinition = {
  name: "repurpose_transcribe",
  description:
    "Transcribe a source video for repurposing. Returns the packed transcript text.",
  input_schema: {
    type: "object",
    properties: {
      video_path: {
        type: "string",
        description: "Absolute path to the source video file.",
      },
      work_dir: {
        type: "string",
        description: "Absolute path to the working/session directory for output.",
      },
    },
    required: ["video_path", "work_dir"],
  },
};

const repurposeTranscribeExec: ToolExecutor = async (input) => {
  const code = [
    "import json, sys",
    "from pathlib import Path",
    "sys.path.insert(0, '.')",
    "from scripts.repurpose import transcribe_source",
    "result = transcribe_source(Path(sys.argv[1]), Path(sys.argv[2]))",
    "print(result)",
  ].join("; ");

  return new Promise<string>((resolve, reject) => {
    const proc = spawn(
      "python3",
      ["-c", code, input.video_path as string, input.work_dir as string],
      { cwd: PROJECT_ROOT, env: { ...process.env } },
    );
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d: Buffer) => (stdout += d));
    proc.stderr.on("data", (d: Buffer) => (stderr += d));
    proc.on("close", (exitCode) => {
      resolve(formatResult({ stdout, stderr, exitCode: exitCode ?? 1 }));
    });
    proc.on("error", reject);
  });
};

// ---------------------------------------------------------------------------
// 18. composio_search
// ---------------------------------------------------------------------------

const composioSearchDef: ToolDefinition = {
  name: "composio_search",
  description:
    "Search for Composio tool slugs for a platform. " +
    "Returns available tools and their schemas for posting content.",
  input_schema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Search query (e.g. 'post tiktok video', 'upload youtube').",
      },
    },
    required: ["query"],
  },
};

const composioSearchExec: ToolExecutor = async (input) => {
  return new Promise<string>((resolve, reject) => {
    const proc = spawn(
      "composio",
      ["search", input.query as string],
      { cwd: PROJECT_ROOT, env: { ...process.env } },
    );
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d: Buffer) => (stdout += d));
    proc.stderr.on("data", (d: Buffer) => (stderr += d));
    proc.on("close", (exitCode) => {
      resolve(formatResult({ stdout, stderr, exitCode: exitCode ?? 1 }));
    });
    proc.on("error", reject);
  });
};

// ---------------------------------------------------------------------------
// 19. write_file
// ---------------------------------------------------------------------------

const writeFileDef: ToolDefinition = {
  name: "write_file",
  description:
    "Write content to a file at the specified path. " +
    "Creates parent directories if they don't exist. " +
    "Use for plan.json, scripts, angles, captions, and other generated files.",
  input_schema: {
    type: "object",
    properties: {
      file_path: {
        type: "string",
        description: "Absolute path to the file to write.",
      },
      content: {
        type: "string",
        description: "Content to write to the file.",
      },
    },
    required: ["file_path", "content"],
  },
};

const writeFileExec: ToolExecutor = async (input) => {
  const filePath = input.file_path as string;
  const content = input.content as string;
  try {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content, "utf-8");
    return `Written ${content.length} bytes to ${filePath}`;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return `[ERROR] Failed to write ${filePath}: ${msg}`;
  }
};

// ---------------------------------------------------------------------------
// 16. read_file
// ---------------------------------------------------------------------------

const readFileDef: ToolDefinition = {
  name: "read_file",
  description:
    "Read content from a file. Returns the file content as a string.",
  input_schema: {
    type: "object",
    properties: {
      file_path: {
        type: "string",
        description: "Absolute path to the file to read.",
      },
    },
    required: ["file_path"],
  },
};

const readFileExec: ToolExecutor = async (input) => {
  const filePath = input.file_path as string;
  try {
    const content = await fs.readFile(filePath, "utf-8");
    return content;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return `[ERROR] Failed to read ${filePath}: ${msg}`;
  }
};

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export const toolDefinitions: ToolDefinition[] = [
  createSessionDef,
  generateCarouselDef,
  generatePostDef,
  registryAddDef,
  registryReadDef,
  publishPlatformDef,
  pullMetricsDef,
  brandReadDef,
  brandWriteDef,
  brandCompileDef,
  fetchBrollDef,
  fetchImagesDef,
  checkEnvDef,
  webResearchDef,
  analysePrepDef,
  repurposeResolveDef,
  repurposeTranscribeDef,
  composioSearchDef,
  writeFileDef,
  readFileDef,
];

export const toolExecutors: Record<string, ToolExecutor> = {
  create_session: createSessionExec,
  generate_carousel: generateCarouselExec,
  generate_post: generatePostExec,
  registry_add: registryAddExec,
  registry_read: registryReadExec,
  publish_platform: publishPlatformExec,
  pull_metrics: pullMetricsExec,
  brand_read: brandReadExec,
  brand_write: brandWriteExec,
  brand_compile: brandCompileExec,
  fetch_broll: fetchBrollExec,
  fetch_images: fetchImagesExec,
  check_env: checkEnvExec,
  web_research: webResearchExec,
  analyse_prep: analysePrepExec,
  repurpose_resolve: repurposeResolveExec,
  repurpose_transcribe: repurposeTranscribeExec,
  composio_search: composioSearchExec,
  write_file: writeFileExec,
  read_file: readFileExec,
};
