# Content Creation CLI — Command Reference

Quick reference for all available slash commands.

---

## /make-reel
Generate a portrait short-form video from a URL or topic (research → script → HeyGen → b-roll → edit).

**Usage:**
```
/make-reel <url-or-topic> [--duration 30|45|60] [--style punchy|deep-dive]
```

**Arguments:**
- `<url-or-topic>` — Source URL to scrape or plain topic string for web research (required)
- `--duration` — Target video length in seconds; default `45`
- `--style` — `punchy` (Style A, fast-paced explainer) or `deep-dive` (Style B, longer-form); default `punchy`

**Prerequisites:** Run `/heygen-avatar` first (`AVATAR-USER.md` must exist). Run `/brand-voice` for on-brand voice and CTA injection.

**Output:** `vault/outputs/reels/YYYY-MM-DD-slug/final.mp4`

**Example:**
```
/make-reel https://martinfowler.com/articles/microservices.html --style punchy --duration 45
```

---

## /make-carousel
Generate a 5–6 slide carousel (images + caption) ready to post on Instagram or LinkedIn.

**Usage:**
```
/make-carousel <point|url|github-repo> [--platform instagram|linkedin] [--slides 5|6] [--auto|--preview|--manual]
```

**Arguments:**
- `<input>` — Plain text point, HTTP URL, or GitHub repo URL (required)
- `--platform` — `instagram` (1080×1080, default) or `linkedin` (1080×1350)
- `--slides` — Number of slides; `5` (default) or `6` — any other value is an error
- `--auto` — Render immediately without pausing for plan approval
- `--preview` — (default) Present plan and wait for approval before rendering
- `--manual` — Step through slide-by-slide approval before rendering each slide

**Prerequisites:** Run `/brand-voice` first for on-brand colors, fonts, and caption voice.

**Output:** `vault/outputs/carousels/YYYY-MM-DD-slug/` (slides `1.png`…`N.png`, `caption.md`)

**Example:**
```
/make-carousel https://github.com/openai/openai-python --platform linkedin --slides 6 --auto
```

---

## /brand-voice
Build and maintain your creator brand identity — a modular deep-dive interview that produces structured profiles consumed by `/make-reel` and `/make-carousel`. Profiles are saved to `vault/brand/` (Obsidian-ready).

**Usage:**
```
/brand-voice
/brand-voice --module <name>
/brand-voice --list
```

**Arguments:**
- *(none)* — runs the full 7-module interview (first-time setup)
- `--module <name>` — re-run a single module; names: `niche` `style` `competitors` `goals` `cta` `watermark` `brand`
- `--list` — show status of all modules (complete / not started / stale)

**Modules:**
| Module | What it captures |
|--------|-----------------|
| `niche` | Your space, subniches, target audience |
| `style` | Tone, pace, vocabulary — accepts platform export files |
| `competitors` | Who you watch, who inspires you, what to avoid |
| `goals` | Per-post success metric (likes, DMs, clicks, purchases) |
| `cta` | Call-to-action text per platform and goal |
| `watermark` | Elements (handle, logo, URL) + 3×3 position picker |
| `brand` | Colors (5 roles), font, logo path |

**File import (style module):** Drop Instagram JSON, LinkedIn CSV, or Twitter/X archive into `vault/imports/` — Claude extracts writing patterns automatically.

**Output:** `vault/brand/modules/<module>.md` (one file per module) + compiled `vault/brand/brand-voice.md`

**Prerequisites:** None — run this before `/make-reel` or `/make-carousel` to get on-brand output.

**Examples:**
```
/brand-voice
/brand-voice --module cta
/brand-voice --list
```

---

## /heygen-video
Generate HeyGen presenter videos via the v3 Video Agent pipeline — handles frame check, prompt engineering, avatar resolution, and voice selection.

**Usage:**
```
/heygen-video [topic_or_script] [--avatar avatar_id]
```

**Arguments:**
- `[topic_or_script]` — Topic description or full script text to present (optional; prompted if omitted)
- `--avatar` — HeyGen avatar ID to use; defaults to the avatar configured in `AVATAR-USER.md`

**Output:** HeyGen-rendered MP4 video (portrait 1080×1920)

**Example:**
```
/heygen-video "The top 3 reasons to use TypeScript in 2025" --avatar abc123
```

---

## /heygen-avatar
Create and manage HeyGen avatars — build a persistent digital identity (face + voice) from a photo or description for use in presenter videos.

**Usage:**
```
/heygen-avatar [name_or_description]
```

**Arguments:**
- `[name_or_description]` — Name or description of the avatar to create (optional; prompted if omitted)

**Output:** `AVATAR-USER.md` at the project root containing `avatar_id` and `voice_id` for use by `/make-reel` and `/heygen-video`

**Example:**
```
/heygen-avatar "Shivendra — professional tech educator, warm tone"
```

---

<!-- ADD NEW COMMANDS BELOW THIS LINE -->
