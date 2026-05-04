# /make-reel Pipeline — Design Spec

**Date:** 2026-05-01  
**Status:** Approved  

---

## Overview

A single Claude Code slash command (`/make-reel`) that takes a URL or topic, researches it, writes a viral short-form script, generates a HeyGen avatar video, fetches b-roll and sound effects, and edits everything into a finished portrait video with burned subtitles — saved locally to `content_creation/output/reels/`.

---

## Invocation

```
/make-reel <url-or-topic> [--duration 30|45|60] [--style punchy|deep-dive]
```

| Argument | Required | Default | Description |
|---|---|---|---|
| `url-or-topic` | Yes | — | A URL to scrape or plain-text topic |
| `--duration` | No | 45 | Target video length in seconds |
| `--style` | No | `punchy` | Script style: `punchy` (Style A) or `deep-dive` (Style B) |

---

## Session Folder Layout

Every run creates a timestamped session folder:

```
content_creation/output/reels/YYYY-MM-DD-<slug>/
├── research.md          ← web research notes (~300 words)
├── script.md            ← viral script with timecodes + visual cues
├── AVATAR-USER.md       ← symlink to user's pre-created HeyGen avatar file
├── heygen_video.mp4     ← raw HeyGen portrait video (1080×1920)
├── broll/               ← Pexels video clips + OpenAI gpt-image-2 images
├── sfx/                 ← Pixabay audio files
├── edit/                ← video-use working dir (EDL, transcripts, renders)
│   ├── project.md
│   ├── takes_packed.md
│   ├── edl.json
│   ├── transcripts/
│   ├── animations/
│   ├── master.srt
│   ├── preview.mp4
│   └── final.mp4
└── final.mp4            ← symlink to edit/final.mp4
```

---

## Five Sequential Stages

### Stage 1 — Research

- If input is a URL: `WebFetch` to scrape page content
- If input is a topic: `WebSearch` for top results, `WebFetch` the most relevant 2–3
- Summarize into `research.md`: key claims, hooks, stats, angles, visual ideas
- Target ~300 words — enough to ground the script without padding it

**Failure:** If no content can be fetched, stop and report to user.

---

### Stage 2 — Script

- Invoke `viral-reel-generator` skill with `research.md` as context
- Pass `--duration` and `--style` args to guide script length and tone
- Output saved to `script.md` in full production format:
  - Timecodes per beat
  - Visual cue per timecode (used by Stage 4 for b-roll keyword matching)
  - Hook, body, CTA structure
  - Anti-slop rules enforced by the skill

**Failure:** If script output is missing timecodes or visual cues, regenerate once before stopping.

---

### Stage 3 — HeyGen Video

- Invoke `heygen-video` skill
- Read `AVATAR-USER.md` for `avatar_id` and `voice_id` (pre-created separately by user)
- Generate portrait video: `1080×1920`, target duration matches `--duration`
- Full script pasted as prompt (scene-labeled, script-as-prompt approach)
- Save output to `heygen_video.mp4`

**Prerequisite:** User must have run `heygen-avatar` skill beforehand to create their avatar. If `AVATAR-USER.md` is missing, stop and instruct the user to run `/heygen-avatar` first.

**Failure:** HeyGen API errors or timeout → report error with HeyGen job ID if available.

---

### Stage 4 — Asset Fetch

Parse `script.md` to extract visual cue keywords per timecode beat. For each beat:

**B-roll (video clips — primary):**
- Search Pexels Videos API using the visual cue keyword
- Download best-match clip (portrait preferred, ≥5s duration)
- Save to `broll/<beat-slug>.mp4`

**B-roll (photos — secondary fallback):**
- If no Pexels video found, search Pexels Photos API with the same keyword
- Download best-match photo
- Save to `broll/<beat-slug>.jpg`

**B-roll (AI images — tertiary fallback):**
- If no Pexels content found, generate with OpenAI `gpt-image-2` using the visual cue as prompt
- Portrait orientation (1080×1920) to match output format
- Save to `broll/<beat-slug>.png`

**Sound effects (optional — skipped gracefully if no key available):**
- If `PIXABAY_API_KEY` is set: search Pixabay audio API, download best-match SFX (<10s preferred), save to `sfx/<beat-slug>.mp3`
- Else if `ELEVENLABS_API_KEY` is set and free tier is confirmed: use ElevenLabs SFX
- Else: skip SFX for this beat, log it, continue

**Failure:** Individual asset failures are non-fatal — log missing assets and proceed. The edit stage will skip b-roll for beats where no asset was found.

---

### Stage 5 — Edit

Invoke `video-use` skill on `heygen_video.mp4` with this brief:

- **Source:** `heygen_video.mp4` (talking head, portrait)
- **B-roll manifest:** list of `{beat, timecode, asset_path}` from Stage 4
- **SFX manifest:** list of `{beat, timecode, sfx_path}` from Stage 4
- **Edit strategy:** insert b-roll cuts at visual cue timecodes from the script; talking head remains the base layer; b-roll overlays/cuts placed per beat
- **Motion graphics:** use Remotion for typography-heavy beats; PIL/hyperframes for simple overlays
- **Subtitles:** word-level Scribe transcription → `master.srt` → burned last (bold-overlay style: 2-word chunks, UPPERCASE, Helvetica Bold, white-on-outline, `MarginV=35`)
- **Output format:** `1080×1920@30fps`, `final.mp4`

video-use hard rules apply (subtitles last, 30ms audio fades at cuts, no re-transcription on retry).

**Self-eval:** video-use runs its standard self-eval pass before presenting output (checks cut boundaries, subtitle visibility, overlay alignment).

---

## Environment Variables

Checked at command startup. Missing required keys = fail fast with clear message.

| Variable | Required | Purpose |
|---|---|---|
| `PEXELS_API_KEY` | Yes | Stock video b-roll |
| `OPENAI_API_KEY` | Yes | gpt-image-2 AI image generation |
| `PIXABAY_API_KEY` | No | Sound effects (optional — SFX skipped if missing) |
| `HEYGEN_API_KEY` | Yes* | HeyGen video generation (*or MCP OAuth) |
| `ELEVENLABS_API_KEY` | No | SFX only if free tier confirmed |

Loaded from `content_creation/.env`.

---

## Subtitle Spec

- **Style:** `bold-overlay`
- **Chunking:** 2-word chunks
- **Case:** UPPERCASE
- **Font:** Helvetica Bold, size 18
- **Color:** white text, black outline
- **Position:** `MarginV=35` from bottom
- **Applied:** last in filter chain, after all b-roll and motion graphic overlays

---

## Command File Location

```
content_creation/.claude/commands/make-reel.md
```

---

## Out of Scope (Future)

- Social posting (Composio / Postiz integration)
- Parallel asset fetch + HeyGen generation (optimization once pipeline is proven)
- Multi-platform format export (square 1080×1080, landscape 1920×1080)
- Automatic avatar creation (user runs `/heygen-avatar` separately)

---

## Dependencies

| Skill | Version/Source | Purpose |
|---|---|---|
| `viral-reel-generator` | `content_creation/.claude/skills/viral-reel-generator/` | Script writing |
| `heygen-video` | `content_creation/.claude/skills/heygen-skills/heygen-video/` | Avatar video |
| `video-use` | `content_creation/.claude/skills/video-use.md` | Video editing |
| Pexels API | `api.pexels.com/videos/` | Stock b-roll |
| OpenAI API | `gpt-image-2` model | AI image b-roll |
| Pixabay API | `pixabay.com/api/videos/` | Sound effects |
| Remotion | npm package | Motion graphics (typography) |
| hyperframes / PIL | codex plugins / stdlib | Motion graphics (simple overlays) |
