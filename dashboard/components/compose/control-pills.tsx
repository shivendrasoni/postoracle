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
import HeygenPicker from "./heygen-picker";

interface ControlPillsProps {
  type: ContentType;
  platform: Platform;
  slides: SlideCount;
  avatarId?: string;
  voiceId?: string;
  avatarName?: string;
  voiceName?: string;
  styleId?: string;
  styleName?: string;
  onPlatformChange: (platform: Platform) => void;
  onSlidesChange: (slides: SlideCount) => void;
  onAvatarSelect: (id: string, name: string) => void;
  onVoiceSelect: (id: string, name: string) => void;
  onStyleSelect: (id: string, name: string) => void;
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

interface AvatarData { name: string; groupId: string; voiceName: string }
interface VoiceData { voice_id: string; name: string; language?: string; gender?: string }
interface StyleData { style_id: string; name: string; thumbnail_url?: string; tags?: string[] }

function mapAvatars(data: unknown[]): { id: string; name: string; subtitle?: string }[] {
  return (data as AvatarData[]).map((a) => ({
    id: a.groupId,
    name: a.name,
    subtitle: `Voice: ${a.voiceName}`,
  }));
}

function mapVoices(data: unknown[]): { id: string; name: string; subtitle?: string }[] {
  return (data as VoiceData[]).map((v) => ({
    id: v.voice_id,
    name: v.name,
    subtitle: [v.language, v.gender].filter(Boolean).join(" · "),
  }));
}

function mapStyles(data: unknown[]): { id: string; name: string; subtitle?: string; thumbnail?: string }[] {
  return (data as StyleData[]).map((s) => ({
    id: s.style_id,
    name: s.name,
    thumbnail: s.thumbnail_url,
    subtitle: s.tags?.join(", "),
  }));
}

export default function ControlPills({
  type,
  platform,
  slides,
  avatarId,
  voiceId,
  avatarName,
  voiceName,
  styleId,
  styleName,
  onPlatformChange,
  onSlidesChange,
  onAvatarSelect,
  onVoiceSelect,
  onStyleSelect,
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
          <HeygenPicker
            apiUrl="/api/heygen/avatars"
            mapFn={mapAvatars}
            selectedId={avatarId}
            onSelect={onAvatarSelect}
            emptyLabel="No avatars found — run /heygen-avatar first"
          >
            <Pill active={!!avatarId}>
              <User size={13} weight={avatarId ? "fill" : "light"} />
              {avatarName ? `Avatar: ${avatarName}` : "Avatar"}
            </Pill>
          </HeygenPicker>
          <HeygenPicker
            apiUrl="/api/heygen/voices"
            mapFn={mapVoices}
            selectedId={voiceId}
            onSelect={onVoiceSelect}
            emptyLabel="No voices available"
          >
            <Pill active={!!voiceId}>
              <Microphone size={13} weight={voiceId ? "fill" : "light"} />
              {voiceName ? `Voice: ${voiceName}` : "Voice"}
            </Pill>
          </HeygenPicker>
          <HeygenPicker
            apiUrl="/api/heygen/styles"
            mapFn={mapStyles}
            selectedId={styleId}
            onSelect={onStyleSelect}
            emptyLabel="No styles available"
          >
            <Pill active={!!styleId}>
              <Palette size={13} weight={styleId ? "fill" : "light"} />
              {styleName ? `Style: ${styleName}` : "Style"}
            </Pill>
          </HeygenPicker>
        </>
      )}

      {/* Carousel pills */}
      {type === "carousel" && (
        <>
          <HeygenPicker
            apiUrl="/api/heygen/styles"
            mapFn={mapStyles}
            selectedId={styleId}
            onSelect={onStyleSelect}
            emptyLabel="No styles available"
          >
            <Pill active={!!styleId}>
              <Palette size={13} weight={styleId ? "fill" : "light"} />
              {styleName ? `Style: ${styleName}` : "Style"}
            </Pill>
          </HeygenPicker>
          <div className="flex items-center gap-0.5 rounded-full bg-white/[0.03] border border-white/[0.06] p-0.5">
            <PlatformPill platform="instagram" current={platform} onClick={() => onPlatformChange("instagram")} />
            <PlatformPill platform="linkedin" current={platform} onClick={() => onPlatformChange("linkedin")} />
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-white/[0.03] border border-white/[0.06] px-2.5 py-1">
            <Stack size={13} weight="light" className="text-muted shrink-0" />
            <select
              value={slides}
              onChange={(e) => onSlidesChange(Number(e.target.value) as SlideCount)}
              className="bg-transparent text-[12px] font-medium text-content outline-none cursor-pointer appearance-none pr-3"
              style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right center" }}
            >
              {[5, 6, 7, 8, 9, 10].map((n) => (
                <option key={n} value={n}>{n} slides</option>
              ))}
            </select>
          </div>
        </>
      )}

      {/* Post pills */}
      {type === "post" && (
        <>
          <HeygenPicker
            apiUrl="/api/heygen/styles"
            mapFn={mapStyles}
            selectedId={styleId}
            onSelect={onStyleSelect}
            emptyLabel="No styles available"
          >
            <Pill active={!!styleId}>
              <Palette size={13} weight={styleId ? "fill" : "light"} />
              {styleName ? `Style: ${styleName}` : "Style"}
            </Pill>
          </HeygenPicker>
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
