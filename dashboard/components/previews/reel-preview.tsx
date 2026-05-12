"use client";

import { useState, useRef, useEffect } from "react";
import type { SessionInfo } from "@/lib/detect-session";

interface ReelPreviewProps {
  sessionPath: string;
  session: SessionInfo;
  brand: { username: string; displayName: string; tagline: string; initials: string };
  caption: string;
}

export default function ReelPreview({
  sessionPath,
  session,
  brand,
  caption,
}: ReelPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  const videoUrl = `/api/vault-asset?path=${encodeURIComponent(
    `${sessionPath}/${session.files.video}`
  )}`;

  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play();
      setPlaying(true);
    } else {
      v.pause();
      setPlaying(false);
    }
  }

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    function onTime() {
      if (!v) return;
      setProgress(v.duration ? v.currentTime / v.duration : 0);
    }
    function onEnded() {
      setPlaying(false);
      setProgress(0);
    }

    v.addEventListener("timeupdate", onTime);
    v.addEventListener("ended", onEnded);
    return () => {
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("ended", onEnded);
    };
  }, []);

  return (
    <div className="flex flex-col items-center">
      <div
        className="w-full max-w-[320px] bg-black rounded-xl overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.5)] relative cursor-pointer"
        style={{ aspectRatio: "9/16" }}
        onClick={togglePlay}
      >
        <video
          ref={videoRef}
          src={videoUrl}
          className="absolute inset-0 w-full h-full object-cover"
          playsInline
          preload="metadata"
        />

        <div className="absolute right-3 bottom-[140px] flex flex-col items-center gap-5 z-10">
          <div className="flex flex-col items-center gap-1">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
            <span className="text-[11px] text-white font-medium">12.3K</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="white">
              <path d="M12 2C6.477 2 2 5.813 2 10.5c0 2.634 1.355 4.985 3.5 6.574V22l4.21-2.484c.737.156 1.5.234 2.29.234 5.523 0 10-3.813 10-8.5S17.523 2 12 2z" />
            </svg>
            <span className="text-[11px] text-white font-medium">234</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
              <path d="M14.5 3.5L21 10l-6.5 6.5v-4C8 12.5 4.5 14.5 2 19c0-6.5 3.5-12 12.5-12.5v-3z" />
            </svg>
            <span className="text-[11px] text-white font-medium">1.2K</span>
          </div>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
            <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z" />
          </svg>
          <div
            className={`w-8 h-8 rounded-full border-2 border-white/30 bg-[#111] flex items-center justify-center ${
              playing ? "animate-[spin_3s_linear_infinite]" : ""
            }`}
          >
            <div className="w-2.5 h-2.5 rounded-full bg-white/50" />
          </div>
        </div>

        <div
          className="absolute bottom-0 left-0 right-0 z-10"
          style={{
            padding: "16px 60px 20px 14px",
            background: "linear-gradient(transparent, rgba(0,0,0,0.75))",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-2 mb-2.5">
            <div className="w-8 h-8 rounded-full bg-[#444] border-[1.5px] border-white flex items-center justify-center flex-shrink-0">
              <span className="text-[10px] text-white font-semibold">
                {brand.initials}
              </span>
            </div>
            <span className="text-sm text-white font-bold">
              {brand.username}
            </span>
            <span className="text-xs text-white border border-white/70 rounded px-2.5 py-0.5 font-medium">
              Follow
            </span>
          </div>
          <div className="text-[13px] text-white/95 leading-relaxed mb-2.5 line-clamp-2">
            {caption}
          </div>
          <div className="flex items-center gap-1.5">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="rgba(255,255,255,0.7)">
              <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z" />
            </svg>
            <span className="text-[11px] text-white/70 whitespace-nowrap">
              Original audio — {brand.username}
            </span>
          </div>
        </div>

        {!playing && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[52px] h-[52px] rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center z-10">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="rgba(255,255,255,0.8)">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        )}

        <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-white/15 z-20">
          <div
            className="h-full bg-white rounded-r-sm transition-[width] duration-100"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}
