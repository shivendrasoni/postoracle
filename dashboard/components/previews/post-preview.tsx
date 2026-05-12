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
