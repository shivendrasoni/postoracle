# Preview Viewer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add inline platform-native previews (TikTok/Reels, Instagram Post, Instagram Carousel, LinkedIn Post) to the vault browser when navigating to content session folders.

**Architecture:** A single `<SessionPreview>` client component detects content type from the file list and renders the appropriate platform frame sub-component. It lives inside the existing vault `[[...path]]` page via a toggle. No new API routes — all data served by existing `/api/vault`, `/api/vault-asset`, and `/api/brand` endpoints.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS 4, TypeScript

---

## File Structure

| File | Responsibility |
|------|---------------|
| `dashboard/lib/detect-session.ts` | Pure function: takes a file list, returns content type or `null` |
| `dashboard/components/previews/platform-chrome.tsx` | Shared IG header, LI header, IG action bar, LI action bar |
| `dashboard/components/previews/post-preview.tsx` | Instagram and LinkedIn post frames with platform tabs |
| `dashboard/components/previews/carousel-preview.tsx` | Instagram carousel frame with slide navigation |
| `dashboard/components/previews/reel-preview.tsx` | TikTok/Reels frame with video + caption overlay |
| `dashboard/components/session-preview.tsx` | Orchestrator: fetches data, routes to sub-component |
| `dashboard/app/vault/[[...path]]/page.tsx` | Modified: adds session detection + preview/files toggle |

---

## Task 1: Content Type Detection

**Files:**
- Create: `dashboard/lib/detect-session.ts`

- [ ] **Step 1: Create the detection module**

```ts
// dashboard/lib/detect-session.ts

export type SessionType = "reel" | "carousel" | "post";

export interface SessionInfo {
  type: SessionType;
  files: {
    video?: string;
    slides?: string[];
    image?: string;
    imageInstagram?: string;
    imageLinkedin?: string;
    caption?: string;
    postMd?: string;
  };
  hasLinkedin: boolean;
  hasInstagram: boolean;
}

export function detectSession(
  fileNames: string[]
): SessionInfo | null {
  const names = new Set(fileNames);

  // Priority: reel > carousel > post
  if (names.has("final.mp4")) {
    return {
      type: "reel",
      files: {
        video: "final.mp4",
        caption: names.has("caption.md") ? "caption.md" : undefined,
      },
      hasLinkedin: false,
      hasInstagram: true,
    };
  }

  if (names.has("1.png") && names.has("2.png")) {
    const slides: string[] = [];
    let i = 1;
    while (names.has(`${i}.png`)) {
      slides.push(`${i}.png`);
      i++;
    }
    return {
      type: "carousel",
      files: {
        slides,
        caption: names.has("caption.txt") ? "caption.txt" : undefined,
      },
      hasLinkedin: false,
      hasInstagram: true,
    };
  }

  const hasIgImage = names.has("image-instagram.png");
  const hasLiImage = names.has("image-linkedin.png");
  const hasGenericImage = names.has("image.png");

  if (hasIgImage || hasLiImage || hasGenericImage) {
    return {
      type: "post",
      files: {
        image: hasGenericImage ? "image.png" : undefined,
        imageInstagram: hasIgImage ? "image-instagram.png" : undefined,
        imageLinkedin: hasLiImage ? "image-linkedin.png" : undefined,
        postMd: names.has("post.md") ? "post.md" : undefined,
      },
      hasLinkedin: hasLiImage,
      hasInstagram: hasIgImage || hasGenericImage,
    };
  }

  return null;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /Users/shivendrasoni/personal/content_creation/dashboard && npx tsc --noEmit lib/detect-session.ts`

- [ ] **Step 3: Commit**

```bash
git add dashboard/lib/detect-session.ts
git commit -m "feat(dashboard): add content type detection for session folders"
```

---

## Task 2: Platform Chrome Shared Components

**Files:**
- Create: `dashboard/components/previews/platform-chrome.tsx`

- [ ] **Step 1: Create the shared platform chrome components**

This file exports four components used by all preview types: `IgHeader`, `IgActions`, `LiHeader`, `LiActions`.

```tsx
// dashboard/components/previews/platform-chrome.tsx
"use client";

export interface BrandInfo {
  username: string;
  displayName: string;
  tagline: string;
  initials: string;
}

/* ── Instagram Header ── */
export function IgHeader({
  brand,
  rightContent,
}: {
  brand: BrandInfo;
  rightContent?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between px-3 py-2.5">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#833ab4] via-[#e1306c] to-[#fcaf45] p-[2px]">
          <div className="w-full h-full rounded-full bg-[#222] flex items-center justify-center">
            <span className="text-[9px] text-white font-semibold">
              {brand.initials}
            </span>
          </div>
        </div>
        <span className="text-xs text-white font-semibold">
          {brand.username}
        </span>
      </div>
      {rightContent ?? (
        <span className="text-white tracking-[3px] text-sm">···</span>
      )}
    </div>
  );
}

/* ── Instagram Actions ── */
export function IgActions({
  caption,
  username,
}: {
  caption: string;
  username: string;
}) {
  return (
    <div className="px-3 pt-2.5 pb-2">
      <div className="flex justify-between mb-2">
        <div className="flex gap-3.5 items-center">
          <HeartIcon />
          <CommentIcon />
          <ShareIcon />
        </div>
        <BookmarkIcon />
      </div>
      <div className="text-xs text-white font-semibold mb-1">1,234 likes</div>
      <div className="text-xs text-white/85 leading-relaxed">
        <span className="font-semibold">{username}</span>{" "}
        <CaptionText text={caption} />
      </div>
      <div className="text-[10px] text-white/35 mt-1.5">2 HOURS AGO</div>
    </div>
  );
}

/* ── LinkedIn Header ── */
export function LiHeader({ brand }: { brand: BrandInfo }) {
  return (
    <div className="flex items-start gap-2.5 px-4 py-3">
      <div className="w-10 h-10 rounded-full bg-[#333] flex-shrink-0 flex items-center justify-center">
        <span className="text-xs text-white font-semibold">
          {brand.initials}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] text-white font-semibold">
          {brand.displayName}
        </div>
        <div className="text-[11px] text-white/50 mt-0.5 truncate">
          {brand.tagline}
        </div>
        <div className="text-[10px] text-white/35 mt-0.5">2h · 🌐</div>
      </div>
      <span className="text-white/40 text-lg">···</span>
    </div>
  );
}

/* ── LinkedIn Actions ── */
export function LiActions() {
  return (
    <>
      <div className="flex justify-between items-center px-4 py-2 border-b border-white/[0.08]">
        <div className="flex items-center gap-1">
          <span className="text-sm">👍</span>
          <span className="text-sm">❤️</span>
          <span className="text-sm">💡</span>
          <span className="text-[11px] text-white/50 ml-1">142</span>
        </div>
        <span className="text-[11px] text-white/40">
          12 comments · 8 reposts
        </span>
      </div>
      <div className="flex justify-around py-1 px-2">
        {(["Like", "Comment", "Repost", "Send"] as const).map((label) => (
          <div
            key={label}
            className="flex items-center gap-1.5 py-2.5 px-2 rounded"
          >
            <LiActionIcon action={label} />
            <span className="text-xs text-white/60">{label}</span>
          </div>
        ))}
      </div>
    </>
  );
}

/* ── Caption with expand ── */
function CaptionText({ text }: { text: string }) {
  const MAX_LEN = 120;
  const [expanded, setExpanded] = useState(false);

  if (text.length <= MAX_LEN) return <span>{text}</span>;

  return (
    <span>
      {expanded ? text : text.slice(0, MAX_LEN) + "..."}
      <button
        onClick={() => setExpanded(!expanded)}
        className="text-white/50 ml-1"
      >
        {expanded ? "less" : "more"}
      </button>
    </span>
  );
}

/* ── SVG Icons ── */
function HeartIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

function CommentIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5">
      <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
    </svg>
  );
}

function BookmarkIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function LiActionIcon({ action }: { action: string }) {
  const paths: Record<string, string> = {
    Like: "M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3",
    Comment: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z",
    Repost: "M17 1l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3",
    Send: "M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z",
  };
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5">
      <path d={paths[action]} />
    </svg>
  );
}

import { useState } from "react";
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /Users/shivendrasoni/personal/content_creation/dashboard && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add dashboard/components/previews/platform-chrome.tsx
git commit -m "feat(dashboard): add shared platform chrome components for previews"
```

---

## Task 3: Post Preview Component

**Files:**
- Create: `dashboard/components/previews/post-preview.tsx`

- [ ] **Step 1: Create the post preview component**

Renders Instagram post or LinkedIn post frame. When both variants exist, shows platform tabs.

```tsx
// dashboard/components/previews/post-preview.tsx
"use client";

import { useState } from "react";
import { IgHeader, IgActions, LiHeader, LiActions } from "./platform-chrome";
import type { SessionInfo } from "@/lib/detect-session";

interface PostPreviewProps {
  sessionPath: string;
  session: SessionInfo;
  brand: { username: string; displayName: string; tagline: string; initials: string };
  captions: { instagram?: string; linkedin?: string };
}

export default function PostPreview({
  sessionPath,
  session,
  brand,
  captions,
}: PostPreviewProps) {
  const platforms: ("instagram" | "linkedin")[] = [];
  if (session.hasInstagram) platforms.push("instagram");
  if (session.hasLinkedin) platforms.push("linkedin");

  const [activePlatform, setActivePlatform] = useState(platforms[0]);

  const imageFile =
    activePlatform === "linkedin"
      ? session.files.imageLinkedin
      : session.files.imageInstagram ?? session.files.image;

  const assetUrl = `/api/vault-asset?path=${encodeURIComponent(
    `${sessionPath}/${imageFile}`
  )}`;

  const caption = captions[activePlatform] ?? "";

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Platform tabs */}
      {platforms.length > 1 && (
        <div className="flex gap-1 rounded-full bg-white/[0.06] p-1">
          {platforms.map((p) => (
            <button
              key={p}
              onClick={() => setActivePlatform(p)}
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all duration-300 ${
                activePlatform === p
                  ? "bg-white/[0.1] text-content shadow-sm"
                  : "text-sub hover:text-content"
              }`}
            >
              {p === "instagram" ? "Instagram" : "LinkedIn"}
            </button>
          ))}
        </div>
      )}

      {/* Frame */}
      <div
        className="w-full max-w-[380px] rounded-lg overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.4)] transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]"
        style={{
          background: activePlatform === "linkedin" ? "#1b1f23" : "#000",
          borderWidth: activePlatform === "linkedin" ? "1px" : "0",
          borderColor: "rgba(255,255,255,0.08)",
        }}
      >
        {activePlatform === "instagram" ? (
          <>
            <IgHeader brand={brand} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={assetUrl}
              alt="Post"
              className="w-full aspect-square object-cover"
            />
            <IgActions caption={caption} username={brand.username} />
          </>
        ) : (
          <>
            <LiHeader brand={brand} />
            <div className="px-4 pb-3 text-[13px] text-white/85 leading-relaxed">
              {caption.length > 200 ? (
                <>
                  {caption.slice(0, 200)}...
                  <span className="text-[#70b5f9] cursor-pointer ml-1">
                    see more
                  </span>
                </>
              ) : (
                caption
              )}
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={assetUrl}
              alt="Post"
              className="w-full object-cover"
              style={{ aspectRatio: "1.2" }}
            />
            <LiActions />
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /Users/shivendrasoni/personal/content_creation/dashboard && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add dashboard/components/previews/post-preview.tsx
git commit -m "feat(dashboard): add post preview component with IG/LinkedIn frames"
```

---

## Task 4: Carousel Preview Component

**Files:**
- Create: `dashboard/components/previews/carousel-preview.tsx`

- [ ] **Step 1: Create the carousel preview component**

Instagram carousel frame with dot indicators, arrow buttons, and keyboard navigation.

```tsx
// dashboard/components/previews/carousel-preview.tsx
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

        {/* Slide area */}
        <div className="relative w-full aspect-square">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={slideUrl(slides[current])}
            alt={`Slide ${current + 1}`}
            className="w-full h-full object-cover transition-opacity duration-300"
          />

          {/* Prev arrow */}
          {current > 0 && (
            <button
              onClick={prev}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center hover:bg-black/60 transition-colors"
            >
              <span className="text-white text-base leading-none">‹</span>
            </button>
          )}

          {/* Next arrow */}
          {current < slides.length - 1 && (
            <button
              onClick={next}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center hover:bg-black/60 transition-colors"
            >
              <span className="text-white text-base leading-none">›</span>
            </button>
          )}
        </div>

        {/* Dot indicators */}
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
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /Users/shivendrasoni/personal/content_creation/dashboard && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add dashboard/components/previews/carousel-preview.tsx
git commit -m "feat(dashboard): add carousel preview with slide navigation and dots"
```

---

## Task 5: Reel Preview Component

**Files:**
- Create: `dashboard/components/previews/reel-preview.tsx`

- [ ] **Step 1: Create the reel preview component**

TikTok/Reels frame with video player, caption overlay, right-side actions, progress bar, and spinning music disc.

```tsx
// dashboard/components/previews/reel-preview.tsx
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
        {/* Video */}
        <video
          ref={videoRef}
          src={videoUrl}
          className="absolute inset-0 w-full h-full object-cover"
          playsInline
          preload="metadata"
        />

        {/* Right side actions */}
        <div className="absolute right-3 bottom-[140px] flex flex-col items-center gap-5 z-10">
          {/* Heart */}
          <div className="flex flex-col items-center gap-1">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
            <span className="text-[11px] text-white font-medium">12.3K</span>
          </div>
          {/* Comment */}
          <div className="flex flex-col items-center gap-1">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="white">
              <path d="M12 2C6.477 2 2 5.813 2 10.5c0 2.634 1.355 4.985 3.5 6.574V22l4.21-2.484c.737.156 1.5.234 2.29.234 5.523 0 10-3.813 10-8.5S17.523 2 12 2z" />
            </svg>
            <span className="text-[11px] text-white font-medium">234</span>
          </div>
          {/* Share */}
          <div className="flex flex-col items-center gap-1">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
              <path d="M14.5 3.5L21 10l-6.5 6.5v-4C8 12.5 4.5 14.5 2 19c0-6.5 3.5-12 12.5-12.5v-3z" />
            </svg>
            <span className="text-[11px] text-white font-medium">1.2K</span>
          </div>
          {/* Bookmark */}
          <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
            <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z" />
          </svg>
          {/* Music disc */}
          <div
            className="w-8 h-8 rounded-full border-2 border-white/30 bg-[#111] flex items-center justify-center"
            style={{
              animation: playing ? "spin 3s linear infinite" : "none",
            }}
          >
            <div className="w-2.5 h-2.5 rounded-full bg-white/50" />
          </div>
        </div>

        {/* Bottom overlay */}
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

        {/* Center play button — visible when paused */}
        {!playing && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[52px] h-[52px] rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center z-10">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="rgba(255,255,255,0.8)">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        )}

        {/* Progress bar */}
        <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-white/15 z-20">
          <div
            className="h-full bg-white rounded-r-sm transition-[width] duration-100"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      </div>

      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /Users/shivendrasoni/personal/content_creation/dashboard && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add dashboard/components/previews/reel-preview.tsx
git commit -m "feat(dashboard): add reel preview with TikTok/Reels frame and video player"
```

---

## Task 6: Session Preview Orchestrator

**Files:**
- Create: `dashboard/components/session-preview.tsx`

- [ ] **Step 1: Create the session preview orchestrator**

This client component fetches brand data and caption content, then renders the right preview sub-component.

```tsx
// dashboard/components/session-preview.tsx
"use client";

import { useEffect, useState } from "react";
import type { SessionInfo } from "@/lib/detect-session";
import type { BrandInfo } from "./previews/platform-chrome";
import PostPreview from "./previews/post-preview";
import CarouselPreview from "./previews/carousel-preview";
import ReelPreview from "./previews/reel-preview";

const DEFAULT_BRAND: BrandInfo = {
  username: "username",
  displayName: "Your Name",
  tagline: "Your tagline",
  initials: "YN",
};

function extractBrand(modules: Array<{ module: string; frontmatter: Record<string, unknown>; content: string }>): BrandInfo {
  const identity = modules.find((m) => m.module === "identity");
  if (!identity) return DEFAULT_BRAND;

  const fm = identity.frontmatter;
  const username = String(fm.instagram_handle ?? fm.handle ?? "username").replace("@", "");
  const displayName = String(fm.name ?? fm.display_name ?? "Your Name");
  const tagline = String(fm.tagline ?? fm.title ?? "");
  const parts = displayName.split(" ");
  const initials = parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : displayName.slice(0, 2).toUpperCase();

  return { username, displayName, tagline, initials };
}

function parseCaptionSections(postMd: string): { instagram?: string; linkedin?: string } {
  const result: { instagram?: string; linkedin?: string } = {};
  const sections = postMd.split(/^## /m);
  for (const section of sections) {
    const lower = section.toLowerCase();
    if (lower.startsWith("instagram")) {
      result.instagram = section.replace(/^instagram\s*/i, "").trim();
    } else if (lower.startsWith("linkedin")) {
      result.linkedin = section.replace(/^linkedin\s*/i, "").trim();
    }
  }
  return result;
}

interface SessionPreviewProps {
  sessionPath: string;
  session: SessionInfo;
}

export default function SessionPreview({ sessionPath, session }: SessionPreviewProps) {
  const [brand, setBrand] = useState<BrandInfo>(DEFAULT_BRAND);
  const [caption, setCaption] = useState("");
  const [captions, setCaptions] = useState<{ instagram?: string; linkedin?: string }>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      // Fetch brand
      try {
        const res = await fetch("/api/brand");
        if (res.ok) {
          const data = await res.json();
          if (data.modules?.length) {
            setBrand(extractBrand(data.modules));
          }
        }
      } catch {
        // fallback to default brand
      }

      // Fetch caption
      try {
        if (session.type === "reel" && session.files.caption) {
          const res = await fetch(
            `/api/vault?path=${encodeURIComponent(`${sessionPath}/${session.files.caption}`)}`
          );
          if (res.ok) {
            const data = await res.json();
            const content: string = data.content ?? "";
            // Extract the post caption section
            const match = content.match(/## Post Caption\s*\n([\s\S]*?)(?=\n---|\n##|$)/);
            setCaption(match ? match[1].trim() : content.trim());
          }
        } else if (session.type === "carousel" && session.files.caption) {
          const res = await fetch(
            `/api/vault?path=${encodeURIComponent(`${sessionPath}/${session.files.caption}`)}`
          );
          if (res.ok) {
            const data = await res.json();
            let text: string = data.content ?? "";
            // Strip [POST CAPTION] header if present
            text = text.replace(/^\[POST CAPTION\]\s*/i, "");
            setCaption(text.trim());
          }
        } else if (session.type === "post" && session.files.postMd) {
          const res = await fetch(
            `/api/vault?path=${encodeURIComponent(`${sessionPath}/${session.files.postMd}`)}`
          );
          if (res.ok) {
            const data = await res.json();
            const sections = parseCaptionSections(data.content ?? "");
            setCaptions(sections);
          }
        }
      } catch {
        // fallback to empty caption
      }

      setLoading(false);
    }

    load();
  }, [sessionPath, session]);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  switch (session.type) {
    case "reel":
      return (
        <ReelPreview
          sessionPath={sessionPath}
          session={session}
          brand={brand}
          caption={caption}
        />
      );
    case "carousel":
      return (
        <CarouselPreview
          sessionPath={sessionPath}
          session={session}
          brand={brand}
          caption={caption}
        />
      );
    case "post":
      return (
        <PostPreview
          sessionPath={sessionPath}
          session={session}
          brand={brand}
          captions={captions}
        />
      );
  }
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /Users/shivendrasoni/personal/content_creation/dashboard && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add dashboard/components/session-preview.tsx
git commit -m "feat(dashboard): add session preview orchestrator with brand/caption fetching"
```

---

## Task 7: Integrate into Vault Page

**Files:**
- Modify: `dashboard/app/vault/[[...path]]/page.tsx`

- [ ] **Step 1: Modify the vault page to detect sessions and toggle preview**

The vault page is a server component. It needs to:
1. When rendering a directory, check if it's a session folder using `detectSession`
2. If it is, pass the session info to a new client wrapper that handles the toggle
3. The client wrapper shows either the preview or the file tree

Create a client wrapper component inline in the page file, then modify the directory rendering branch.

First, create a small client component for the toggle at `dashboard/components/preview-toggle.tsx`:

```tsx
// dashboard/components/preview-toggle.tsx
"use client";

import { useState } from "react";
import type { VaultFile } from "@/lib/types";
import type { SessionInfo } from "@/lib/detect-session";
import SessionPreview from "./session-preview";
import FileTree from "./file-tree";

interface PreviewToggleProps {
  sessionPath: string;
  session: SessionInfo;
  files: VaultFile[];
}

export default function PreviewToggle({
  sessionPath,
  session,
  files,
}: PreviewToggleProps) {
  const [showFiles, setShowFiles] = useState(false);

  if (showFiles) {
    return (
      <div>
        <div className="mb-3 flex justify-end">
          <button
            onClick={() => setShowFiles(false)}
            className="text-[12px] text-accent hover:underline transition-colors"
          >
            ← Preview
          </button>
        </div>
        <FileTree files={files} />
      </div>
    );
  }

  return (
    <div>
      <SessionPreview sessionPath={sessionPath} session={session} />
      <div className="mt-4 flex justify-center">
        <button
          onClick={() => setShowFiles(true)}
          className="text-[12px] text-sub hover:text-content transition-colors"
        >
          View files
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Modify the vault page directory branch**

In `dashboard/app/vault/[[...path]]/page.tsx`, add the detection logic to the `stat.isDirectory()` branch. Add these imports at the top:

```tsx
import { detectSession } from "@/lib/detect-session";
import PreviewToggle from "@/components/preview-toggle";
```

Then replace the directory rendering block (the `if (stat.isDirectory())` branch body, after `const tree = ...`) with logic that checks for a session:

```tsx
  if (stat.isDirectory()) {
    const tree = await buildFileTree(reqPath || ".", 2);
    const fileNames = tree.map((f) => f.name);
    const session = reqPath.startsWith("outputs/") ? detectSession(fileNames) : null;

    return (
      <div>
        <AnimateIn>
          <div className="mb-6">
            <span className="rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.2em] font-medium bg-amber-soft text-amber">
              {session ? session.type : "Files"}
            </span>
            <h1 className="text-2xl font-semibold tracking-tight text-content mt-3">
              Vault
            </h1>
            <Breadcrumbs items={breadcrumbs} />
          </div>
        </AnimateIn>
        <AnimateIn delay={100}>
          <div className="rounded-[1.5rem] bg-white/[0.02] border border-white/[0.06] p-1.5">
            <div className="rounded-[calc(1.5rem-0.375rem)] bg-surface/60 p-4 shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)]">
              {session ? (
                <PreviewToggle
                  sessionPath={reqPath}
                  session={session}
                  files={tree}
                />
              ) : tree.length === 0 ? (
                <p className="text-[13px] text-muted py-8 text-center">
                  Empty directory
                </p>
              ) : (
                <FileTree files={tree} />
              )}
            </div>
          </div>
        </AnimateIn>
      </div>
    );
  }
```

- [ ] **Step 3: Verify it compiles**

Run: `cd /Users/shivendrasoni/personal/content_creation/dashboard && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add dashboard/components/preview-toggle.tsx dashboard/app/vault/\[\[...path\]\]/page.tsx
git commit -m "feat(dashboard): integrate session preview into vault browser with toggle"
```

---

## Task 8: Add CSS Animation + Manual Test

**Files:**
- Modify: `dashboard/app/globals.css`

- [ ] **Step 1: Add the spin keyframe to globals.css**

The reel preview needs a `spin` animation for the music disc. Add it to `globals.css` alongside the existing keyframes. Check if it already exists first — if it does, skip this step.

```css
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
```

After adding, also remove the `<style jsx>` block from `reel-preview.tsx` since the animation is now global. Replace the `style={{ animation: ... }}` on the music disc with a className approach:

In `reel-preview.tsx`, replace the music disc div's style:
```tsx
<div
  className={`w-8 h-8 rounded-full border-2 border-white/30 bg-[#111] flex items-center justify-center ${
    playing ? "animate-[spin_3s_linear_infinite]" : ""
  }`}
>
```

And remove the `<style jsx>` block at the bottom of the component.

- [ ] **Step 2: Start the dev server and test all preview types**

Run: `cd /Users/shivendrasoni/personal/content_creation/dashboard && npm run dev`

Test these URLs in the browser:
1. **Reel**: http://localhost:3000/vault/outputs/reels/2026-05-12-content-automation-vs-recording
2. **Carousel**: http://localhost:3000/vault/outputs/carousels/2026-05-05-stop-trying-to-be-creative-just-see-what
3. **Post**: http://localhost:3000/vault/outputs/posts/2026-05-06-openai-age-predictor

For each, verify:
- Preview renders with the correct platform frame
- Brand data shows (or fallback if brand modules don't exist)
- Caption text is populated
- "View files" toggle switches to file tree
- "← Preview" link switches back
- Carousel: arrows, dots, and keyboard left/right work
- Reel: click to play/pause, progress bar updates, music disc spins while playing
- Post: platform tabs toggle between IG and LinkedIn (if both variants exist)

- [ ] **Step 3: Fix any issues found during testing**

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(dashboard): finalize preview viewer with CSS animations and polish"
```

---

## Task 9: Non-Session Folder Regression Check

- [ ] **Step 1: Verify non-session folders are unaffected**

Test these URLs — they should show the normal file tree, not a preview:
1. http://localhost:3000/vault (root)
2. http://localhost:3000/vault/brand (brand directory)
3. http://localhost:3000/vault/library (library directory)

- [ ] **Step 2: Verify individual file views still work**

Test:
1. http://localhost:3000/vault/outputs/reels/2026-05-12-content-automation-vs-recording/script.md
2. http://localhost:3000/vault/outputs/carousels/2026-05-05-stop-trying-to-be-creative-just-see-what/1.png

Both should render as before (markdown viewer, image viewer).

- [ ] **Step 3: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix(dashboard): ensure non-session vault paths render normally"
```
