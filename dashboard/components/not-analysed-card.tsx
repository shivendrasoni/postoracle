"use client";

import { useState } from "react";
import { Copy, Check } from "@phosphor-icons/react";

export default function NotAnalysedCard({ shortcode }: { shortcode: string }) {
  const [copied, setCopied] = useState(false);
  const command = `/analyse ${shortcode}`;

  function handleCopy() {
    navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-[1.5rem] bg-white/[0.02] border border-white/[0.06] p-1.5">
      <div className="rounded-[calc(1.5rem-0.375rem)] bg-surface/60 px-8 py-12 text-center shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)]">
        <p className="text-[14px] font-medium text-content mb-2">
          Not analysed yet
        </p>
        <p className="text-[12px] text-muted leading-relaxed">
          Run{" "}
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 font-mono text-accent bg-accent-soft px-2 py-0.5 rounded-md
              cursor-pointer transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]
              hover:bg-accent/20 active:scale-[0.97]"
          >
            {command}
            {copied ? (
              <Check size={12} weight="bold" className="text-emerald" />
            ) : (
              <Copy size={12} weight="bold" className="opacity-50" />
            )}
          </button>{" "}
          in Claude Code to generate the full 5-dimension analysis.
        </p>
      </div>
    </div>
  );
}
