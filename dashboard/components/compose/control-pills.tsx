"use client";

import {
  User,
  Microphone,
  Palette,
  InstagramLogo,
  LinkedinLogo,
  XLogo,
  Stack,
} from "@phosphor-icons/react";
import type { ContentType, Platform, SlideCount } from "@/lib/compose-context";

interface ControlPillsProps {
  type: ContentType;
  platform: Platform;
  slides: SlideCount;
  avatarId?: string;
  voiceId?: string;
  onPlatformChange: (platform: Platform) => void;
  onSlidesChange: (slides: SlideCount) => void;
}

function Pill({
  children,
  active = false,
  onClick,
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium
        border transition-all duration-400 ease-[cubic-bezier(0.32,0.72,0,1)]
        hover:scale-[1.03] active:scale-[0.97]
        ${active
          ? "bg-accent-soft text-accent border-accent/20"
          : "bg-white/[0.04] text-sub border-white/[0.06] hover:bg-white/[0.06] hover:text-content"
        }
      `}
    >
      {children}
    </button>
  );
}

function PlatformPill({
  platform,
  current,
  onClick,
}: {
  platform: Platform;
  current: Platform;
  onClick: () => void;
}) {
  const icons: Record<Platform, typeof InstagramLogo> = {
    instagram: InstagramLogo,
    linkedin: LinkedinLogo,
    x: XLogo,
  };
  const labels: Record<Platform, string> = {
    instagram: "IG",
    linkedin: "LI",
    x: "X",
  };
  const Icon = icons[platform];
  const isActive = platform === current;

  return (
    <Pill active={isActive} onClick={onClick}>
      <Icon size={13} weight={isActive ? "fill" : "light"} />
      {labels[platform]}
    </Pill>
  );
}

export default function ControlPills({
  type,
  platform,
  slides,
  avatarId,
  voiceId,
  onPlatformChange,
  onSlidesChange,
}: ControlPillsProps) {
  return (
    <div
      className="flex items-center gap-1.5 flex-wrap min-h-[32px]"
      style={{
        transition: "all 400ms cubic-bezier(0.32, 0.72, 0, 1)",
      }}
    >
      {/* Reel pills */}
      {type === "reel" && (
        <>
          <Pill>
            <User size={13} weight="light" />
            {avatarId ? "Avatar" : "Avatar"}
          </Pill>
          <Pill>
            <Microphone size={13} weight="light" />
            {voiceId ? "Voice" : "Voice"}
          </Pill>
          <Pill>
            <Palette size={13} weight="light" />
            Style
          </Pill>
        </>
      )}

      {/* Carousel pills */}
      {type === "carousel" && (
        <>
          <Pill>
            <Palette size={13} weight="light" />
            Style
          </Pill>
          <div className="flex items-center gap-0.5 rounded-full bg-white/[0.03] border border-white/[0.06] p-0.5">
            <PlatformPill platform="instagram" current={platform} onClick={() => onPlatformChange("instagram")} />
            <PlatformPill platform="linkedin" current={platform} onClick={() => onPlatformChange("linkedin")} />
          </div>
          <div className="flex items-center gap-0.5 rounded-full bg-white/[0.03] border border-white/[0.06] p-0.5">
            <Pill active={slides === 5} onClick={() => onSlidesChange(5)}>
              <Stack size={13} weight="light" />
              5
            </Pill>
            <Pill active={slides === 6} onClick={() => onSlidesChange(6)}>
              <Stack size={13} weight="light" />
              6
            </Pill>
          </div>
        </>
      )}

      {/* Post pills */}
      {type === "post" && (
        <>
          <Pill>
            <Palette size={13} weight="light" />
            Style
          </Pill>
          <div className="flex items-center gap-0.5 rounded-full bg-white/[0.03] border border-white/[0.06] p-0.5">
            <PlatformPill platform="instagram" current={platform} onClick={() => onPlatformChange("instagram")} />
            <PlatformPill platform="linkedin" current={platform} onClick={() => onPlatformChange("linkedin")} />
            <PlatformPill platform="x" current={platform} onClick={() => onPlatformChange("x")} />
          </div>
        </>
      )}

      {/* Angle — minimal, no pills */}
    </div>
  );
}
