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

**Prerequisites:** Run `/heygen-avatar` first — `AVATAR-USER.md` must exist at the project root.

**Output:** `output/reels/YYYY-MM-DD-slug/final.mp4`

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

**Output:** `output/carousels/YYYY-MM-DD-slug/` (slides `1.png`…`N.png`, `caption.txt`)

**Example:**
```
/make-carousel https://github.com/openai/openai-python --platform linkedin --slides 6 --auto
```

---

## /carousel-brand
One-time brand setup — saves brand colors to `CAROUSEL-BRAND.json` for use in `/make-carousel`.

**Usage:**
```
/carousel-brand
```

**Arguments:** None — the command interactively prompts for brand colors.

**Input options (prompted):**
- Five hex codes (primary, secondary, accent, background, text) — space or comma separated
- A file path or URL to a brand image (colors extracted automatically via colorthief)

**Output:** `CAROUSEL-BRAND.json` at the project root (auto-picked up by `/make-carousel`)

**Example:**
```
/carousel-brand
# then when prompted: #1A1A2E #16213E #0F3460 #E94560 #FFFFFF
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
