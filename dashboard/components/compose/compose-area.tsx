"use client";

import { useRef, useEffect, useState } from "react";
import { ArrowRight, Gear, Link as LinkIcon, X } from "@phosphor-icons/react";
import { useCompose } from "@/lib/compose-context";
import TypeSelector from "./type-selector";
import ControlPills from "./control-pills";
import AttachMenu from "./attach-menu";

export default function ComposeArea() {
  const { state, dispatch } = useCompose();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(el.scrollHeight, 56)}px`;
  }, [state.topic]);

  async function handleGenerate() {
    if (!state.topic.trim()) return;

    const payload = {
      type: state.type,
      topic: state.topic,
      platform: state.platform,
      slides: state.type === "carousel" ? state.slides : undefined,
      avatarId: state.type === "reel" ? state.avatarId : undefined,
      voiceId: state.type === "reel" ? state.voiceId : undefined,
      attachments: state.attachments,
    };

    console.log("[PostOracle] Generate request:", payload);
    setIsGenerating(true);

    try {
      const res = await fetch("http://localhost:4000/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = (await res.json()) as { jobId: string };
        dispatch({ kind: "START_JOB", jobId: data.jobId });
      } else {
        console.warn("[PostOracle] Backend returned", res.status);
      }
    } catch {
      console.warn("[PostOracle] Backend not available — job logged to console only");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="w-full max-w-[760px] mx-auto">
      {/* Outer bezel */}
      <div className="rounded-[2rem] bg-white/[0.02] border border-white/[0.06] p-2">
        {/* Inner card — glass morphism */}
        <div
          className="
            rounded-[calc(2rem-0.5rem)] bg-surface/60
            shadow-[inset_0_1px_1px_rgba(255,255,255,0.04),0_0_80px_rgba(167,139,250,0.03)]
            backdrop-blur-sm
          "
        >
          {/* Control pills row */}
          <div className="px-6 pt-5 pb-0">
            <ControlPills
              type={state.type}
              platform={state.platform}
              slides={state.slides}
              avatarId={state.avatarId}
              voiceId={state.voiceId}
              onPlatformChange={(p) => dispatch({ kind: "SET_PLATFORM", platform: p })}
              onSlidesChange={(s) => dispatch({ kind: "SET_SLIDES", slides: s })}
            />
          </div>

          {/* Text input */}
          <div className="px-6 py-4">
            <textarea
              ref={textareaRef}
              value={state.topic}
              onChange={(e) => dispatch({ kind: "SET_TOPIC", topic: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Enter" && e.metaKey) {
                  e.preventDefault();
                  handleGenerate();
                }
              }}
              placeholder="Describe your content idea..."
              rows={1}
              className="
                w-full bg-transparent border-none outline-none resize-none
                text-[15px] leading-relaxed text-content placeholder:text-muted/60
                min-h-[56px] max-h-[200px]
              "
            />

            {/* Attachments */}
            {state.attachments.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2 pt-3 border-t border-white/[0.04]">
                {state.attachments.map((url, i) => (
                  <span
                    key={`${url}-${i}`}
                    className="
                      inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full
                      bg-accent-soft text-[11px] text-accent font-medium
                      max-w-[200px]
                    "
                  >
                    <LinkIcon size={11} weight="bold" />
                    <span className="truncate">{url}</span>
                    <button
                      type="button"
                      onClick={() => dispatch({ kind: "REMOVE_ATTACHMENT", index: i })}
                      className="ml-0.5 hover:text-content transition-colors"
                    >
                      <X size={10} weight="bold" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Bottom toolbar */}
          <div className="px-5 pb-4 flex items-center justify-between">
            {/* Left actions */}
            <div className="flex items-center gap-1.5">
              <AttachMenu
                onAttachUrl={(url) => dispatch({ kind: "ADD_ATTACHMENT", url })}
              />
              <button
                type="button"
                className="
                  flex items-center justify-center w-8 h-8 rounded-full
                  bg-white/[0.04] border border-white/[0.06]
                  text-muted
                  transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]
                  hover:bg-white/[0.08] hover:text-sub hover:border-white/[0.10]
                  active:scale-[0.94]
                "
              >
                <Gear size={15} weight="light" />
              </button>
            </div>

            {/* Right: type selector + generate */}
            <div className="flex items-center gap-2">
              <TypeSelector
                value={state.type}
                onChange={(type) => dispatch({ kind: "SET_TYPE", type })}
              />
              <button
                type="button"
                onClick={handleGenerate}
                disabled={!state.topic.trim() || isGenerating}
                className={`
                  group flex items-center gap-2 pl-5 pr-4 py-2.5 rounded-full
                  text-[13px] font-semibold
                  transition-all duration-400 ease-[cubic-bezier(0.32,0.72,0,1)]
                  active:scale-[0.96]
                  ${state.topic.trim() && !isGenerating
                    ? "bg-gradient-to-r from-accent to-emerald text-white shadow-[0_0_24px_rgba(167,139,250,0.25),0_0_8px_rgba(52,211,153,0.15)] hover:shadow-[0_0_32px_rgba(167,139,250,0.35),0_0_12px_rgba(52,211,153,0.25)] hover:scale-[1.02]"
                    : "bg-white/[0.06] text-muted cursor-not-allowed"
                  }
                `}
              >
                {isGenerating ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-[spin_0.8s_linear_infinite]" />
                    Generating
                  </>
                ) : (
                  <>
                    Generate
                    <ArrowRight
                      size={15}
                      weight="bold"
                      className={`transition-transform duration-300 ${
                        state.topic.trim() ? "group-hover:translate-x-0.5" : ""
                      }`}
                    />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Keyboard hint */}
      <div className="text-center mt-3">
        <span className="text-[11px] text-muted/50">
          <kbd className="px-1.5 py-0.5 rounded bg-white/[0.03] border border-white/[0.06] text-[10px] font-mono">
            Cmd
          </kbd>
          {" + "}
          <kbd className="px-1.5 py-0.5 rounded bg-white/[0.03] border border-white/[0.06] text-[10px] font-mono">
            Enter
          </kbd>
          {" to generate"}
        </span>
      </div>
    </div>
  );
}
