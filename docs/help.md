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
- `<url-or-topic>` — Source URL to scrape or plain topic string for web research (required unless `--from-angle` or `--from-script` is set)
- `--duration` — Target video length in seconds; default `45`
- `--style` — `punchy` (Style A, fast-paced explainer) or `deep-dive` (Style B, longer-form); default `punchy`
- `--from-angle <path>` — Skip research stage; use a pre-generated angle file from `vault/library/angles/`
- `--from-script <path>` — Skip research AND script stages; use a pre-generated script from `vault/library/scripts/`
- `--auto-publish instagram|linkedin|all` — Publish after pipeline completes

**Prerequisites:** Run `/heygen-avatar` first (`AVATAR-USER.md` must exist). Run `/brand-voice` for on-brand voice and CTA injection.

**Output:** `vault/outputs/reels/YYYY-MM-DD-slug/final.mp4`

**Example:**
```
/make-reel https://martinfowler.com/articles/microservices.html --style punchy --duration 45
```

---

## /make-post
Generate a single-image social media post from a URL or topic, tailored per platform (Instagram image + caption, LinkedIn image + caption, X text-only).

**Usage:**
```
/make-post <url-or-topic> [--platform instagram|linkedin|x|all] [--mode visual|text] [--from-angle <path>] [--auto-publish platform]
```

**Arguments:**
- `<url-or-topic>` — Source URL, plain text topic, or GitHub repo URL (required)
- `--platform` — `instagram`, `linkedin`, `x`, or `all` (default); X is text-only (no image)
- `--mode` — `visual` (creative AI image, default) or `text` (branded text card)
- `--from-angle <path>` — Skip research; use a pre-generated angle file
- `--auto-publish <platform>` — Publish after pipeline completes

**Prerequisites:** Run `/brand-voice` first for on-brand colors, CTA, and tone. Run `/brand-voice --module photo` to enable reference-photo mode.

**Output:** `vault/outputs/posts/YYYY-MM-DD-slug/` (`image.png`, `image-instagram.png`, `image-linkedin.png`, `post.md`)

**Example:**
```
/make-post "AI agents are replacing junior devs" --platform instagram --mode visual
/make-post https://example.com/article --platform all --auto-publish instagram
```

---

## /make-carousel
Generate a 5–6 slide carousel (images + caption) ready to post on Instagram or LinkedIn.

**Usage:**
```
/make-carousel <point|url|github-repo> [--platform instagram|linkedin] [--slides 5|6] [--auto|--preview|--manual]
```

**Arguments:**
- `<input>` — Plain text point, HTTP URL, or GitHub repo URL (required unless `--from-angle` is set)
- `--platform` — `instagram` (1080×1080, default) or `linkedin` (1080×1350)
- `--slides` — Number of slides; `5` (default) or `6` — any other value is an error
- `--from-angle <path>` — Skip research stage; use a pre-generated angle file from `vault/library/angles/`
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
- *(none)* — runs the full 11-module interview (first-time setup)
- `--module <name>` — re-run a single module; names: `niche` `style` `competitors` `goals` `cta` `watermark` `brand` `pillars` `audience` `strategy` `photo`
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
| `pillars` | Content pillars and themes |
| `audience` | Audience deep-dive and personas |
| `strategy` | Content strategy and posting cadence |
| `photo` | Your photo + physical description for AI image generation |

**File import (style module):** Drop Instagram JSON, LinkedIn CSV, or Twitter/X archive into `vault/imports/` — Claude extracts writing patterns automatically.

**Output:** `vault/brand/modules/<module>.md` (one file per module) + compiled `vault/brand/brand-voice.md`

**Prerequisites:** None — run this before `/make-reel`, `/make-carousel`, or `/make-post` to get on-brand output.

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

## /viral-angle
Generate format-specific content angles using the Contrast Formula — scored and persisted to `vault/library/angles/`.

**Usage:**
```
/viral-angle <topic-or-url> [--format shortform|longform|linkedin|carousel|post|all] [--count 5]
```

**Arguments:**
- `<topic-or-url>` — Topic string or URL to research (required)
- `--format` — Target format; `shortform`, `longform`, `linkedin`, `carousel`, `post`, or `all` (default)
- `--count N` — Number of angles per format; default `5`

**How it works:** Researches the topic, generates high-contrast angles (common belief → surprising truth), scores them using brand vault context (pillars, audience, strategy), and saves each as an Obsidian-friendly markdown file.

**Prerequisites:** Run `/brand-voice` first (especially `pillars`, `audience`, `strategy` modules) for better scoring. Works without them using defaults.

**Output:** `vault/library/angles/YYYY-MM-DD-<slug>-<format>-NN.md`

**Examples:**
```
/viral-angle "AI agents" --format shortform --count 5
/viral-angle https://example.com/article --format all
```

---

## /viral-script
Generate scored hooks and a production-ready script from a pre-generated angle or inline topic — supports shortform (HEIL beats), longform (3P's + filming cards), and LinkedIn text posts.

**Usage:**
```
/viral-script --angle <path> --mode shortform|longform|linkedin
/viral-script --topic "<text>" --mode shortform|longform|linkedin
```

**Arguments:**
- `--angle <path>` — Path to an angle file in `vault/library/angles/` (mutually exclusive with `--topic`)
- `--topic "<text>"` — Inline topic string (mutually exclusive with `--angle`)
- `--mode` — REQUIRED. `shortform` (HEIL beats, 15–60s), `longform` (3P's intro, 8–15 min), or `linkedin` (text post)

**How it works:** Generates 10 hooks scored on contrast fit, pattern strength, and platform fit. Presents top 3 hooks, then writes a full production-ready script with timecodes, visual cues, and CTA. Updates the source angle's status to `scripted` when `--angle` is used.

**Prerequisites:** Run `/viral-angle` first to generate angles, or use `--topic` for inline generation. Brand vault modules (`style`, `cta`, `strategy`) improve hook selection.

**Output:** `vault/library/scripts/YYYY-MM-DD-<slug>-<mode>-NN.md`

**Examples:**
```
/viral-script --angle vault/library/angles/2026-05-06-ai-agents-shortform-01.md --mode shortform
/viral-script --topic "AI agents are not replacing junior devs" --mode linkedin
```

---

<!-- ADD NEW COMMANDS BELOW THIS LINE -->
