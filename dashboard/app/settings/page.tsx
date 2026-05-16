"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Key,
  Globe,
  CheckCircle,
  WarningCircle,
  SlidersHorizontal,
  CaretDown,
  CaretRight,
  FloppyDisk,
} from "@phosphor-icons/react";

interface EnvStatus {
  key: string;
  label: string;
  description: string;
  set: boolean;
}

type FieldType = "boolean" | "enum" | "number" | "string";

interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  options?: string[];
}

type Config = Record<string, Record<string, unknown>>;

const API_KEYS: Omit<EnvStatus, "set">[] = [
  { key: "OPENAI_API_KEY", label: "OpenAI", description: "Image generation (GPT-image-2), carousel rendering" },
  { key: "ANTHROPIC_API_KEY", label: "Anthropic", description: "AI agent orchestration (Claude)" },
  { key: "HEYGEN_API_KEY", label: "HeyGen", description: "Presenter video generation" },
  { key: "PEXELS_API_KEY", label: "Pexels", description: "B-roll and stock image fetching" },
  { key: "PIXABAY_API_KEY", label: "Pixabay", description: "Fallback stock images" },
  { key: "ELEVENLABS_API_KEY", label: "ElevenLabs", description: "Voice synthesis" },
];

const PLATFORMS = [
  { id: "instagram", label: "Instagram", description: "Reels, carousels, posts" },
  { id: "linkedin", label: "LinkedIn", description: "Posts, carousels, articles" },
  { id: "x", label: "X (Twitter)", description: "Text posts" },
];

const COMMAND_FIELDS: { section: string; label: string; fields: FieldDef[] }[] = [
  {
    section: "global",
    label: "Global",
    fields: [
      { key: "platform", label: "Default Platform", type: "enum", options: ["instagram", "linkedin", "x", "all"] },
      { key: "auto_publish", label: "Auto-Publish", type: "boolean" },
      { key: "auto_confirm", label: "Auto-Confirm", type: "boolean" },
    ],
  },
  {
    section: "make_reel",
    label: "make-reel",
    fields: [
      { key: "duration", label: "Duration (seconds)", type: "number" },
      { key: "style", label: "Style", type: "enum", options: ["punchy", "deep-dive"] },
      { key: "mode", label: "Mode", type: "enum", options: ["video-agent", "heygen-basic", "edit-raw"] },
      { key: "grade", label: "Grade", type: "enum", options: ["auto", "subtle", "neutral_punch", "warm_cinematic", "none"] },
      { key: "subtitles", label: "Subtitles", type: "boolean" },
      { key: "subtitle_style", label: "Subtitle Style", type: "enum", options: ["bold-overlay"] },
      { key: "broll", label: "B-roll", type: "boolean" },
      { key: "target_silence_max", label: "Silence Threshold (s)", type: "number" },
      { key: "cut_filler_words", label: "Cut Filler Words", type: "boolean" },
      { key: "detect_retakes", label: "Detect Retakes", type: "boolean" },
    ],
  },
  {
    section: "make_carousel",
    label: "make-carousel",
    fields: [
      { key: "slides", label: "Slides", type: "enum", options: ["5", "6", "7", "8", "9", "10"] },
      { key: "mode", label: "Mode", type: "enum", options: ["preview", "auto", "manual"] },
    ],
  },
  {
    section: "make_post",
    label: "make-post",
    fields: [
      { key: "mode", label: "Mode", type: "enum", options: ["visual", "text"] },
    ],
  },
  {
    section: "viral_angle",
    label: "viral-angle",
    fields: [
      { key: "format", label: "Format", type: "enum", options: ["shortform", "longform", "linkedin", "carousel", "post", "all"] },
      { key: "count", label: "Count (per format)", type: "number" },
    ],
  },
  {
    section: "viral_script",
    label: "viral-script",
    fields: [
      { key: "mode", label: "Mode", type: "enum", options: ["shortform", "longform", "linkedin"] },
    ],
  },
  {
    section: "publish",
    label: "publish",
    fields: [
      { key: "platform", label: "Platform", type: "enum", options: ["instagram", "linkedin", "all"] },
    ],
  },
  {
    section: "sync_instagram",
    label: "sync-instagram",
    fields: [
      { key: "collection", label: "Default Collection", type: "string" },
    ],
  },
  {
    section: "repurpose",
    label: "repurpose",
    fields: [
      { key: "mode", label: "Mode", type: "enum", options: ["record", "heygen-basic", "heygen-agent"] },
      { key: "script_mode", label: "Script Mode", type: "enum", options: ["shortform", "longform", "linkedin"] },
      { key: "duration", label: "Duration (seconds)", type: "number" },
    ],
  },
];

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300 ${
        value ? "bg-accent" : "bg-white/[0.08]"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 rounded-full bg-white transition-transform duration-300 ${
          value ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

function PillGroup({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className={`px-3 py-1.5 rounded-full text-[12px] border transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.97] ${
            String(value) === opt
              ? "bg-accent/15 border-accent/30 text-accent"
              : "bg-white/[0.04] border-white/[0.06] text-sub hover:bg-white/[0.06] hover:text-content"
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

function NumberInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <input
      type="number"
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-24 px-3 py-1.5 rounded-lg text-[13px] bg-white/[0.04] border border-white/[0.06] text-content
        focus:outline-none focus:border-accent/40 transition-colors"
    />
  );
}

function StringInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="text"
      value={value ?? ""}
      placeholder="(none)"
      onChange={(e) => onChange(e.target.value || "")}
      className="w-48 px-3 py-1.5 rounded-lg text-[13px] bg-white/[0.04] border border-white/[0.06] text-content placeholder:text-muted
        focus:outline-none focus:border-accent/40 transition-colors"
    />
  );
}

function ConfigSection({
  section,
  label,
  fields,
  values,
  onChange,
  defaultExpanded,
}: {
  section: string;
  label: string;
  fields: FieldDef[];
  values: Record<string, unknown>;
  onChange: (section: string, key: string, value: unknown) => void;
  defaultExpanded: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className="border-b border-white/[0.04] last:border-b-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full px-5 py-3.5 text-left hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-2">
          {expanded ? (
            <CaretDown size={14} weight="bold" className="text-sub" />
          ) : (
            <CaretRight size={14} weight="bold" className="text-sub" />
          )}
          <span className="text-[13px] font-medium text-content font-mono">{label}</span>
        </div>
        <span className="text-[11px] text-muted">{fields.length} settings</span>
      </button>

      {expanded && (
        <div className="px-5 pb-4 space-y-4">
          {fields.map((field) => {
            const val = values[field.key];
            return (
              <div key={field.key} className="flex items-center justify-between gap-4">
                <label className="text-[12px] text-sub min-w-[140px]">{field.label}</label>
                <div>
                  {field.type === "boolean" && (
                    <Toggle value={val as boolean} onChange={(v) => onChange(section, field.key, v)} />
                  )}
                  {field.type === "enum" && field.options && (
                    <PillGroup
                      options={field.options}
                      value={String(val ?? "")}
                      onChange={(v) => {
                        const num = Number(v);
                        onChange(section, field.key, Number.isFinite(num) && String(num) === v ? num : v);
                      }}
                    />
                  )}
                  {field.type === "number" && (
                    <NumberInput value={val as number} onChange={(v) => onChange(section, field.key, v)} />
                  )}
                  {field.type === "string" && (
                    <StringInput value={(val as string) ?? ""} onChange={(v) => onChange(section, field.key, v || null)} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const [envStatus, setEnvStatus] = useState<EnvStatus[]>([]);
  const [envLoading, setEnvLoading] = useState(true);
  const [config, setConfig] = useState<Config>({});
  const [configLoading, setConfigLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  useEffect(() => {
    fetch("/api/settings/env-status")
      .then((res) => (res.ok ? res.json() : {}))
      .then((status: Record<string, boolean>) => {
        setEnvStatus(API_KEYS.map((k) => ({ ...k, set: status[k.key] ?? false })));
      })
      .catch(() => {
        setEnvStatus(API_KEYS.map((k) => ({ ...k, set: false })));
      })
      .finally(() => setEnvLoading(false));

    fetch("/api/settings/config")
      .then((res) => (res.ok ? res.json() : {}))
      .then((data: Config) => setConfig(data))
      .catch(() => setConfig({}))
      .finally(() => setConfigLoading(false));
  }, []);

  const handleChange = useCallback((section: string, key: string, value: unknown) => {
    setConfig((prev) => ({
      ...prev,
      [section]: { ...(prev[section] ?? {}), [key]: value },
    }));
    setSaveStatus("idle");
  }, []);

  const handleSave = useCallback(async () => {
    setSaveStatus("saving");
    try {
      const res = await fetch("/api/settings/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      setSaveStatus(res.ok ? "saved" : "error");
    } catch {
      setSaveStatus("error");
    }
  }, [config]);

  const configuredCount = envStatus.filter((e) => e.set).length;

  return (
    <div className="space-y-10">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <div className="text-[10px] font-medium tracking-[0.2em] uppercase text-accent px-2.5 py-1 rounded-full bg-accent-soft">
            Settings
          </div>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-content mt-3">
          Configuration
        </h1>
        <p className="text-[13px] text-sub mt-1">
          API keys, platform connections, and command defaults.
        </p>
      </div>

      <section>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Key size={18} weight="light" className="text-accent" />
            <h2 className="text-[15px] font-medium text-content">API Keys</h2>
          </div>
          <span className="text-[12px] text-sub">
            {configuredCount}/{API_KEYS.length} configured
          </span>
        </div>

        <div className="rounded-[1.25rem] bg-white/[0.03] border border-white/[0.06] p-1.5">
          <div className="rounded-[calc(1.25rem-0.375rem)] bg-surface/80 divide-y divide-white/[0.04]">
            {envLoading ? (
              <div className="px-5 py-8 text-center text-[13px] text-muted">
                Checking environment...
              </div>
            ) : (
              envStatus.map((env) => (
                <div
                  key={env.key}
                  className="flex items-center justify-between px-5 py-4 first:rounded-t-[calc(1.25rem-0.375rem)] last:rounded-b-[calc(1.25rem-0.375rem)]"
                >
                  <div>
                    <div className="text-[13px] font-medium text-content">{env.label}</div>
                    <div className="text-[12px] text-muted mt-0.5">{env.description}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {env.set ? (
                      <>
                        <CheckCircle size={16} weight="fill" className="text-emerald" />
                        <span className="text-[12px] text-emerald">Configured</span>
                      </>
                    ) : (
                      <>
                        <WarningCircle size={16} weight="fill" className="text-amber" />
                        <span className="text-[12px] text-amber">Not set</span>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <p className="text-[12px] text-muted mt-3 px-1">
          Keys are stored in <code className="font-mono text-sub">.env</code> in the project root.
          Edit the file directly to add or update keys.
        </p>
      </section>

      <section>
        <div className="flex items-center gap-2 mb-4">
          <Globe size={18} weight="light" className="text-accent" />
          <h2 className="text-[15px] font-medium text-content">Connected Platforms</h2>
        </div>

        <div className="rounded-[1.25rem] bg-white/[0.03] border border-white/[0.06] p-1.5">
          <div className="rounded-[calc(1.25rem-0.375rem)] bg-surface/80 divide-y divide-white/[0.04]">
            {PLATFORMS.map((platform) => (
              <div
                key={platform.id}
                className="flex items-center justify-between px-5 py-4 first:rounded-t-[calc(1.25rem-0.375rem)] last:rounded-b-[calc(1.25rem-0.375rem)]"
              >
                <div>
                  <div className="text-[13px] font-medium text-content">{platform.label}</div>
                  <div className="text-[12px] text-muted mt-0.5">{platform.description}</div>
                </div>
                <span className="text-[12px] text-muted">Via Composio CLI</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-[12px] text-muted mt-3 px-1">
          Platform connections are managed via{" "}
          <code className="font-mono text-sub">composio link &lt;platform&gt;</code>.
        </p>
      </section>

      <section>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <SlidersHorizontal size={18} weight="light" className="text-accent" />
            <h2 className="text-[15px] font-medium text-content">Command Defaults</h2>
          </div>
          <button
            onClick={handleSave}
            disabled={saveStatus === "saving"}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[12px] font-medium
              bg-accent/15 border border-accent/30 text-accent
              hover:bg-accent/25 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]
              active:scale-[0.97] disabled:opacity-50"
          >
            <FloppyDisk size={14} weight="bold" />
            {saveStatus === "saving" ? "Saving..." : saveStatus === "saved" ? "Saved" : saveStatus === "error" ? "Error" : "Save"}
          </button>
        </div>

        <div className="rounded-[1.25rem] bg-white/[0.03] border border-white/[0.06] p-1.5">
          <div className="rounded-[calc(1.25rem-0.375rem)] bg-surface/80">
            {configLoading ? (
              <div className="px-5 py-8 text-center text-[13px] text-muted">
                Loading config...
              </div>
            ) : (
              COMMAND_FIELDS.map((group, i) => (
                <ConfigSection
                  key={group.section}
                  section={group.section}
                  label={group.label}
                  fields={group.fields}
                  values={(config[group.section] as Record<string, unknown>) ?? {}}
                  onChange={handleChange}
                  defaultExpanded={i === 0}
                />
              ))
            )}
          </div>
        </div>

        <p className="text-[12px] text-muted mt-3 px-1">
          Saved to <code className="font-mono text-sub">vault/postoracle.yaml</code>.
          CLI flags always override these defaults.
        </p>
      </section>
    </div>
  );
}
