"use client";

import { useEffect, useState } from "react";
import {
  InstagramLogo,
  LinkedinLogo,
  XLogo,
  Globe,
} from "@phosphor-icons/react";
import type { PlatformBreakdown } from "@/lib/analytics";

const PLATFORM_META: Record<string, { icon: typeof Globe; gradient: string }> = {
  instagram: {
    icon: InstagramLogo,
    gradient: "from-[#833ab4] via-[#fd1d1d] to-[#fcb045]",
  },
  linkedin: {
    icon: LinkedinLogo,
    gradient: "from-[#0077b5] to-[#00a0dc]",
  },
  x: {
    icon: XLogo,
    gradient: "from-white/80 to-white/40",
  },
};

function AnimatedBar({ value, max, delay }: { value: number; max: number; delay: number }) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const pct = max > 0 ? (value / max) * 100 : 0;
    const t = setTimeout(() => setWidth(pct), delay);
    return () => clearTimeout(t);
  }, [value, max, delay]);

  return (
    <div className="h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
      <div
        className="h-full rounded-full bg-gradient-to-r from-accent to-emerald"
        style={{
          width: `${Math.max(width, 3)}%`,
          transition: "width 1200ms cubic-bezier(0.32, 0.72, 0, 1)",
        }}
      />
    </div>
  );
}

export default function PlatformsCard({ platforms }: { platforms: PlatformBreakdown[] }) {
  if (platforms.length === 0) return null;

  const maxTotal = Math.max(...platforms.map((p) => p.total), 1);

  return (
    <div className="rounded-[1.5rem] bg-white/[0.02] border border-white/[0.06] p-1.5 h-full">
      <div className="rounded-[calc(1.5rem-0.375rem)] bg-surface/60 p-6 shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)] h-full">
        <div className="text-[11px] font-medium tracking-[0.15em] uppercase text-muted mb-6">
          Platforms
        </div>

        <div className="space-y-5">
          {platforms.map((p, i) => {
            const meta = PLATFORM_META[p.name] ?? { icon: Globe, gradient: "from-white/60 to-white/30" };
            const Icon = meta.icon;

            return (
              <div key={p.name}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-7 h-7 rounded-lg bg-white/[0.06] flex items-center justify-center`}>
                      <Icon size={15} weight="light" className="text-content" />
                    </div>
                    <span className="text-[13px] font-medium text-content capitalize">{p.name}</span>
                  </div>
                  <div className="text-[12px] text-sub tabular-nums">
                    {p.published} <span className="text-muted">of</span> {p.total}
                  </div>
                </div>
                <AnimatedBar value={p.total} max={maxTotal} delay={300 + i * 120} />
              </div>
            );
          })}
        </div>

        {platforms.length === 1 && (
          <p className="text-[11px] text-muted mt-5 leading-relaxed">
            Cross-post to multiple platforms to see comparison data.
          </p>
        )}
      </div>
    </div>
  );
}
