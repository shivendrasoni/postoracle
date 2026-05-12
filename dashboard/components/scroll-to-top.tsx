"use client";

import { useEffect, useState } from "react";
import { ArrowUp } from "@phosphor-icons/react";

export default function ScrollToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Scroll to top"
      className="fixed right-8 bottom-8 z-40 group"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(1rem)",
        pointerEvents: visible ? "auto" : "none",
        transition:
          "opacity 500ms cubic-bezier(0.32, 0.72, 0, 1), transform 500ms cubic-bezier(0.32, 0.72, 0, 1)",
      }}
    >
      <div className="rounded-full bg-white/[0.04] border border-white/[0.08] p-1.5 backdrop-blur-xl">
        <div className="w-10 h-10 rounded-full bg-surface/80 flex items-center justify-center shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)] transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:bg-raised group-active:scale-[0.92]">
          <ArrowUp
            size={16}
            weight="light"
            className="text-sub transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:text-content group-hover:-translate-y-0.5"
          />
        </div>
      </div>
    </button>
  );
}
