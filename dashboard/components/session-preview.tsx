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

      try {
        if (session.type === "reel" && session.files.caption) {
          const res = await fetch(
            `/api/vault?path=${encodeURIComponent(`${sessionPath}/${session.files.caption}`)}`
          );
          if (res.ok) {
            const data = await res.json();
            const content: string = data.content ?? "";
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
