"use client";

import { useState, useRef, useEffect } from "react";
import {
  X,
  CheckCircle,
  CircleNotch,
  Circle,
  WarningCircle,
  PaperPlaneRight,
  PaperPlaneTilt,
} from "@phosphor-icons/react";
import { useJobStream, type JobStage } from "@/lib/use-job-stream";
import type { RegistryEntry } from "@/lib/types";
import PublishModal from "@/components/publish-modal";

interface ProgressDrawerProps {
  jobId: string | null;
  contentType: string;
  topic: string;
  platform: string;
  onClose: () => void;
}

function StageIcon({ status }: { status: JobStage["status"] }) {
  switch (status) {
    case "complete":
      return <CheckCircle size={16} weight="fill" className="text-emerald shrink-0" />;
    case "running":
      return <CircleNotch size={16} weight="bold" className="text-accent shrink-0 animate-[spin_1s_linear_infinite]" />;
    case "failed":
      return <WarningCircle size={16} weight="fill" className="text-flame shrink-0" />;
    default:
      return <Circle size={16} weight="light" className="text-muted/40 shrink-0" />;
  }
}

function formatElapsed(ms?: number): string {
  if (!ms) return "";
  const seconds = Math.round(ms / 1000);
  return `${seconds}s`;
}

export default function ProgressDrawer({
  jobId,
  contentType,
  topic,
  platform,
  onClose,
}: ProgressDrawerProps) {
  const {
    connected,
    stages,
    thoughts,
    previews,
    error,
    done,
    sessionDir,
    sendRefine,
  } = useJobStream(jobId);

  const [refineText, setRefineText] = useState("");
  const [showPublish, setShowPublish] = useState(false);
  const thoughtsEndRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (jobId) {
      requestAnimationFrame(() => setIsOpen(true));
    } else {
      setIsOpen(false);
    }
  }, [jobId]);

  useEffect(() => {
    thoughtsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thoughts]);

  function handleRefine() {
    if (!refineText.trim()) return;
    sendRefine(refineText);
    setRefineText("");
  }

  function handleClose() {
    setIsOpen(false);
    setTimeout(onClose, 400);
  }

  const latestThought = thoughts[thoughts.length - 1] ?? "";

  return (
    <>
      {/* Backdrop */}
      <div
        className={`
          fixed inset-0 z-40 bg-black/40 backdrop-blur-sm
          transition-opacity duration-400 ease-[cubic-bezier(0.32,0.72,0,1)]
          ${isOpen ? "opacity-100" : "opacity-0 pointer-events-none"}
        `}
        onClick={handleClose}
      />

      {/* Drawer panel */}
      <div
        className={`
          fixed top-0 right-0 z-50 h-dvh w-full max-w-[520px]
          transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]
          ${isOpen ? "translate-x-0" : "translate-x-full"}
        `}
      >
        <div className="h-full bg-panel/95 backdrop-blur-2xl border-l border-white/[0.06] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-white/[0.04]">
            <div>
              <div className="flex items-center gap-2">
                <div className="text-[10px] font-medium tracking-[0.2em] uppercase text-accent px-2 py-0.5 rounded-full bg-accent-soft">
                  {done ? "Complete" : "Creating"}
                </div>
                <span className="text-[13px] font-medium text-content capitalize">
                  {contentType}
                </span>
              </div>
              <p className="text-[12px] text-sub mt-1 line-clamp-1 max-w-[350px]">
                {topic}
              </p>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="
                w-8 h-8 rounded-full flex items-center justify-center
                bg-white/[0.04] border border-white/[0.06]
                text-muted hover:text-content hover:bg-white/[0.08]
                transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]
                active:scale-[0.92]
              "
            >
              <X size={14} weight="bold" />
            </button>
          </div>

          {/* Connection status */}
          {jobId && !connected && !done && (
            <div className="px-6 py-2 bg-amber-soft text-amber text-[11px]">
              Connecting to agent service...
            </div>
          )}

          {/* Stages */}
          <div className="px-6 py-5 border-b border-white/[0.04]">
            <div className="space-y-2.5">
              {stages.length === 0 && !done && (
                <div className="flex items-center gap-2.5">
                  <CircleNotch
                    size={16}
                    weight="bold"
                    className="text-accent animate-[spin_1s_linear_infinite]"
                  />
                  <span className="text-[13px] text-sub">Initializing pipeline...</span>
                </div>
              )}
              {stages.map((stage) => (
                <div key={stage.name} className="flex items-center gap-2.5">
                  <StageIcon status={stage.status} />
                  <span
                    className={`text-[13px] capitalize ${
                      stage.status === "running"
                        ? "text-content font-medium"
                        : stage.status === "complete"
                          ? "text-sub"
                          : stage.status === "failed"
                            ? "text-flame"
                            : "text-muted/60"
                    }`}
                  >
                    {stage.name.replace(/_/g, " ")}
                  </span>
                  {stage.elapsed && (
                    <span className="text-[11px] text-muted ml-auto tabular-nums">
                      {formatElapsed(stage.elapsed)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Agent reasoning stream */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <div className="space-y-2">
              {thoughts.map((thought, i) => (
                <div
                  key={`t-${i}`}
                  className="text-[12px] text-sub leading-relaxed"
                  style={{
                    opacity: i === thoughts.length - 1 ? 1 : 0.5,
                    transition: "opacity 300ms",
                  }}
                >
                  {thought.length > 300 ? `${thought.slice(0, 300)}...` : thought}
                </div>
              ))}

              {/* Preview thumbnails */}
              {previews.length > 0 && (
                <div className="flex gap-2 mt-4 flex-wrap">
                  {previews.map((url, i) => (
                    <div
                      key={`p-${i}`}
                      className="w-16 h-16 rounded-xl bg-white/[0.04] border border-white/[0.06] overflow-hidden"
                    >
                      <img
                        src={url}
                        alt={`Preview ${i + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Error display */}
              {error && (
                <div className="mt-4 p-3 rounded-xl bg-flame-soft border border-flame/20">
                  <p className="text-[12px] text-flame">{error}</p>
                </div>
              )}

              {/* Done state */}
              {done && sessionDir && (
                <div className="mt-4 p-4 rounded-xl bg-emerald-soft border border-emerald/20">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle size={16} weight="fill" className="text-emerald" />
                      <span className="text-[13px] font-medium text-emerald">
                        Content ready
                      </span>
                    </div>
                    {["reel", "carousel", "post"].includes(contentType) && (
                      <button
                        type="button"
                        onClick={() => setShowPublish(true)}
                        className="
                          flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg
                          bg-accent text-white text-[12px] font-medium
                          hover:bg-accent/80 active:scale-[0.96]
                          transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]
                        "
                      >
                        <PaperPlaneTilt size={13} weight="fill" />
                        Publish
                      </button>
                    )}
                  </div>
                  <p className="text-[12px] text-sub">
                    Output saved to{" "}
                    <code className="font-mono text-[11px] text-content bg-white/[0.04] px-1.5 py-0.5 rounded">
                      {sessionDir}
                    </code>
                  </p>
                </div>
              )}

              <div ref={thoughtsEndRef} />
            </div>
          </div>

          {/* Chat refinement input */}
          <div className="px-5 pb-5 pt-3 border-t border-white/[0.04]">
            <div className="flex items-center gap-2">
              <div className="flex-1 rounded-full bg-white/[0.04] border border-white/[0.06] overflow-hidden">
                <input
                  type="text"
                  value={refineText}
                  onChange={(e) => setRefineText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleRefine();
                    }
                  }}
                  placeholder="Refine... (e.g. make slide 3 punchier)"
                  className="
                    w-full bg-transparent px-4 py-2.5 text-[13px] text-content
                    placeholder:text-muted/50 outline-none border-none
                  "
                />
              </div>
              <button
                type="button"
                onClick={handleRefine}
                disabled={!refineText.trim()}
                className={`
                  w-9 h-9 rounded-full flex items-center justify-center shrink-0
                  transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]
                  active:scale-[0.92]
                  ${refineText.trim()
                    ? "bg-accent text-white hover:bg-accent/80"
                    : "bg-white/[0.04] text-muted cursor-not-allowed"
                  }
                `}
              >
                <PaperPlaneRight size={14} weight="fill" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Publish modal */}
      {showPublish && done && sessionDir && (
        <PublishModal
          entry={{
            id: sessionDir.split("/").pop() ?? sessionDir,
            type: contentType as RegistryEntry["type"],
            topic,
            source_url: null,
            platforms: [platform],
            status: "draft",
            virality_score: null,
            created_at: new Date().toISOString(),
            scheduled_at: null,
            published_at: {},
            published_urls: {},
            session_dir: sessionDir,
            tags: [],
          }}
          onClose={() => setShowPublish(false)}
          onPublished={() => setShowPublish(false)}
        />
      )}
    </>
  );
}
