"use client";

import { useState, useEffect } from "react";
import {
  Key,
  Globe,
  CheckCircle,
  WarningCircle,
  FloppyDisk,
} from "@phosphor-icons/react";

interface EnvStatus {
  key: string;
  label: string;
  description: string;
  set: boolean;
}

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

export default function SettingsPage() {
  const [envStatus, setEnvStatus] = useState<EnvStatus[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/settings/env-status")
      .then((res) => (res.ok ? res.json() : []))
      .then((status: Record<string, boolean>) => {
        setEnvStatus(
          API_KEYS.map((k) => ({ ...k, set: status[k.key] ?? false }))
        );
      })
      .catch(() => {
        setEnvStatus(API_KEYS.map((k) => ({ ...k, set: false })));
      })
      .finally(() => setLoading(false));
  }, []);

  const configuredCount = envStatus.filter((e) => e.set).length;

  return (
    <div className="space-y-10">
      {/* Header */}
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
          API keys, platform connections, and defaults.
        </p>
      </div>

      {/* API Keys */}
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
            {loading ? (
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
                    <div className="text-[13px] font-medium text-content">
                      {env.label}
                    </div>
                    <div className="text-[12px] text-muted mt-0.5">
                      {env.description}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {env.set ? (
                      <>
                        <CheckCircle
                          size={16}
                          weight="fill"
                          className="text-emerald"
                        />
                        <span className="text-[12px] text-emerald">
                          Configured
                        </span>
                      </>
                    ) : (
                      <>
                        <WarningCircle
                          size={16}
                          weight="fill"
                          className="text-amber"
                        />
                        <span className="text-[12px] text-amber">
                          Not set
                        </span>
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

      {/* Connected Platforms */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Globe size={18} weight="light" className="text-accent" />
          <h2 className="text-[15px] font-medium text-content">
            Connected Platforms
          </h2>
        </div>

        <div className="rounded-[1.25rem] bg-white/[0.03] border border-white/[0.06] p-1.5">
          <div className="rounded-[calc(1.25rem-0.375rem)] bg-surface/80 divide-y divide-white/[0.04]">
            {PLATFORMS.map((platform) => (
              <div
                key={platform.id}
                className="flex items-center justify-between px-5 py-4 first:rounded-t-[calc(1.25rem-0.375rem)] last:rounded-b-[calc(1.25rem-0.375rem)]"
              >
                <div>
                  <div className="text-[13px] font-medium text-content">
                    {platform.label}
                  </div>
                  <div className="text-[12px] text-muted mt-0.5">
                    {platform.description}
                  </div>
                </div>
                <span className="text-[12px] text-muted">
                  Via Composio CLI
                </span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-[12px] text-muted mt-3 px-1">
          Platform connections are managed via{" "}
          <code className="font-mono text-sub">composio link &lt;platform&gt;</code>.
        </p>
      </section>

      {/* Defaults */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <FloppyDisk size={18} weight="light" className="text-accent" />
          <h2 className="text-[15px] font-medium text-content">
            Default Preferences
          </h2>
        </div>

        <div className="rounded-[1.25rem] bg-white/[0.03] border border-white/[0.06] p-1.5">
          <div className="rounded-[calc(1.25rem-0.375rem)] bg-surface/80 p-5 space-y-5">
            <div>
              <label className="text-[12px] font-medium text-sub uppercase tracking-[0.1em]">
                Default Platform
              </label>
              <div className="flex gap-2 mt-2">
                {["instagram", "linkedin"].map((p) => (
                  <button
                    key={p}
                    className="px-4 py-2 rounded-full text-[13px] bg-white/[0.04] border border-white/[0.06] text-sub
                      hover:bg-white/[0.06] hover:text-content
                      transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]
                      active:scale-[0.97]"
                  >
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[12px] font-medium text-sub uppercase tracking-[0.1em]">
                Default Carousel Slides
              </label>
              <div className="flex gap-2 mt-2">
                {[5, 6].map((n) => (
                  <button
                    key={n}
                    className="px-4 py-2 rounded-full text-[13px] bg-white/[0.04] border border-white/[0.06] text-sub
                      hover:bg-white/[0.06] hover:text-content
                      transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]
                      active:scale-[0.97]"
                  >
                    {n} slides
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
