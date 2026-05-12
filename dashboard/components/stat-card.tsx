"use client";

import { useEffect, useState } from "react";

interface StatCardProps {
  label: string;
  value: number;
  accent?: string;
}

function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (value === 0) {
      setDisplay(0);
      return;
    }
    const duration = 900;
    const startTime = performance.now();
    const step = (time: number) => {
      const elapsed = time - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.floor(eased * value));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [value]);

  return <>{display}</>;
}

export default function StatCard({ label, value, accent }: StatCardProps) {
  return (
    <div className="rounded-[1.25rem] bg-white/[0.02] border border-white/[0.06] p-1.5">
      <div className="rounded-[calc(1.25rem-0.375rem)] bg-surface/60 p-5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)]">
        <span className="text-[11px] font-medium tracking-[0.12em] uppercase text-muted block mb-3">
          {label}
        </span>
        <div
          className="text-3xl font-semibold tracking-tight"
          style={{ color: accent }}
        >
          <AnimatedNumber value={value} />
        </div>
      </div>
    </div>
  );
}
