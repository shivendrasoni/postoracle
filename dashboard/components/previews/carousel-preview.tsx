"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { IgHeader, IgActions } from "./platform-chrome";
import type { SessionInfo } from "@/lib/detect-session";

interface CarouselPreviewProps {
  sessionPath: string;
  session: SessionInfo;
  brand: { username: string; displayName: string; tagline: string; initials: string };
  caption: string;
}

export default function CarouselPreview({
  sessionPath,
  session,
  brand,
  caption,
}: CarouselPreviewProps) {
  const slides = session.files.slides ?? [];
  const [current, setCurrent] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const prev = useCallback(
    () => setCurrent((c) => Math.max(0, c - 1)),
    []
  );
  const next = useCallback(
    () => setCurrent((c) => Math.min(slides.length - 1, c + 1)),
    [slides.length]
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    }
    const el = containerRef.current;
    el?.addEventListener("keydown", onKey);
    return () => el?.removeEventListener("keydown", onKey);
  }, [prev, next]);

  const slideUrl = (file: string) =>
    `/api/vault-asset?path=${encodeURIComponent(`${sessionPath}/${file}`)}`;

  return (
    <div className="flex flex-col items-center">
      <div
        ref={containerRef}
        tabIndex={0}
        className="w-full max-w-[380px] bg-black rounded-lg overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.4)] outline-none"
      >
        <IgHeader
          brand={brand}
          rightContent={
            <span className="text-[11px] text-white/50">
              {current + 1} / {slides.length}
            </span>
          }
        />

        <div className="relative w-full aspect-square">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={slideUrl(slides[current])}
            alt={`Slide ${current + 1}`}
            className="w-full h-full object-cover transition-opacity duration-300"
          />

          {current > 0 && (
            <button
              onClick={prev}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center hover:bg-black/60 transition-colors"
            >
              <span className="text-white text-base leading-none">‹</span>
            </button>
          )}

          {current < slides.length - 1 && (
            <button
              onClick={next}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center hover:bg-black/60 transition-colors"
            >
              <span className="text-white text-base leading-none">›</span>
            </button>
          )}
        </div>

        <div className="flex justify-center gap-[5px] py-2.5">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className="w-1.5 h-1.5 rounded-full transition-colors duration-300"
              style={{
                background: i === current ? "#3897f0" : "rgba(255,255,255,0.2)",
              }}
            />
          ))}
        </div>

        <IgActions caption={caption} username={brand.username} />
      </div>
    </div>
  );
}
