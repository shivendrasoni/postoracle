"use client";

import { useState } from "react";

export interface BrandInfo {
  username: string;
  displayName: string;
  tagline: string;
  initials: string;
}

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
