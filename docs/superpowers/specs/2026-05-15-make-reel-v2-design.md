# make-reel v2 — Design Spec

## Problem

The `/make-reel` pipeline has three modes but they're disconnected. Mode 1 (Video Agent) works end-to-end. Mode 2 (heygen-basic) has a loosely defined local edit step. Mode 3 (edit-raw) only overlays b-roll on uncut footage — no actual editing (no cuts, no dead-air removal, no pacing). None of the local editing produces viral-ready output.

## Goal

A unified pipeline where modes 2 and 3 share a single **local editing engine** that produces professionally cut, b-rolled, subtitled, graded, loudness-normalized video ready to publish.

---

## Three Modes

### Mode 1: Video Agent (default)
HeyGen Video Agent v3 handles everything. No local editing.

```
Research → Script → HeyGen Video Agent v3 → final.mp4
```

Unchanged from current implementation. Video Agent produces a fully edited video with b-roll, transitions, motion graphics. No post-processing.

### Mode 2: HeyGen Basic (`--heygen-basic`)
HeyGen generates a clean talking head. Local engine edits it.

```
Research → Script → strip_cues() → HeyGen Basic API → talking head video
                  → parse_script() → beats.json
                                          ↓
                                  [Local Editing Engine]
                                          ↓
                                      final.mp4
```

The script serves two consumers:
- `strip_cues()` → clean spoken text → HeyGen (generates the talking head)
- `parse_script()` → beats.json with timecodes + visual cues → editing engine

Since the HeyGen talking head is clean (no filler, no dead air, no restarts), the editing engine's job is: overlay b-roll at beat points, apply grade, burn subtitles, normalize audio. No cuts needed — the video is already tight.

### Mode 3: Edit Raw (`--edit-raw <video-path>`)
User provides raw footage. Local engine does everything.

```
Raw video → Scribe → transcript (word-level)
                         ↓
                  pack_transcripts.py → takes_packed.md
                         ↓
                  LLM analysis → beats.json (structure + visual cues + CUT DECISIONS)
                         ↓
                  [Local Editing Engine]
                         ↓
                      final.mp4
```

The LLM reads the packed transcript and produces beats.json with:
- Beat segmentation (hook, context, insight, CTA, etc.)
- Visual cues per beat (Pexels-friendly search terms)
- **Cut decisions** — what to keep, what to trim (dead air, filler, restarts, ums)

This is the key difference from mode 2: the beats.json includes cut points that produce a multi-range EDL instead of a single-range one.

---

## The Local Editing Engine

Shared between modes 2 and 3. Receives:
- A source video (HeyGen talking head or raw footage)
- beats.json (structure + visual cues, optionally with cut decisions)

Produces:
- A fully edited video: cut, graded, b-rolled, subtitled, loudness-normalized

### Pipeline Stages

```
[Source Video + beats.json]
        ↓
  1. Transcribe (if not already done — mode 2 needs this for subtitles)
        ↓
  2. Fetch B-roll + SFX from beats
        ↓
  3. Build EDL
     - Mode 2: single-range (full video), b-roll as overlays
     - Mode 3: multi-range (kept segments only), b-roll as overlays
        ↓
  4. Strategy confirmation (show edit plan, wait for approval)
     - Skip if --auto flag or config says auto_confirm: true
        ↓
  5. Render (extract segments → grade → concat → overlays → subtitles LAST → loudnorm)
        ↓
  6. Self-verify (timeline_view on cut boundaries, check for pops/jumps)
        ↓
  final.mp4
```

### beats.json Schema

Unified schema for both modes:

```json
{
  "beats": [
    {
      "index": 0,
      "beat": "HOOK",
      "timecode_s": 0.0,
      "end_s": 5.2,
      "visual_cue": "person scrolling phone looking frustrated",
      "text_overlay": "",
      "beat_slug": "beat-00-person-scrolling-frustrated"
    }
  ],
  "cuts": [
    {
      "type": "keep",
      "start": 0.0,
      "end": 5.2,
      "beat": "HOOK",
      "reason": "Clean hook delivery"
    },
    {
      "type": "trim",
      "start": 5.2,
      "end": 6.8,
      "reason": "Dead air — 1.6s silence"
    },
    {
      "type": "keep",
      "start": 6.8,
      "end": 18.4,
      "beat": "CONTEXT",
      "reason": "Problem setup, clean delivery"
    }
  ]
}
```

- `beats[]` — structural segments with visual cues (used for b-roll fetching)
- `cuts[]` — ordered list of keep/trim decisions (used for EDL construction)

For mode 2 (heygen-basic), `cuts` is either absent or contains a single `keep` spanning the full video. The engine treats missing `cuts` as "keep everything."

### Cut Engine (Mode 3 only)

The LLM reads `takes_packed.md` and produces cut decisions based on:

1. **Dead air removal** — silences ≥ 0.5s between phrases get trimmed (pack_transcripts.py already marks these as phrase breaks)
2. **Filler word removal** — "um", "uh", "like", "you know" with surrounding pauses
3. **Restart detection** — repeated phrases or false starts ("So the thing is— actually let me start over—")
4. **Pacing** — if the video is freestyle/rambling, tighten to hit a target duration
5. **Beat preservation** — never cut inside a punchline, key insight, or emotional peak

Cut rules (from video-use skill):
- Never cut inside a word (snap to word boundaries from transcript)
- Pad cut edges 30–200ms (absorbs Scribe timestamp drift)
- Prefer silences ≥ 400ms as cut targets (cleanest)
- 30ms audio fades at every segment boundary (prevents pops)

### Multi-take Support (Mode 3)

When the LLM detects the transcript contains **multiple attempts at the same content** (repeated phrases, "let me try that again", similar openings), it switches to multi-take mode:
- Identify the structural beats (hook, problem, solution, CTA)
- For each beat, pick the best take based on: delivery clarity, energy, completeness
- Assemble chronologically by beat, not by source order

This is the editor sub-agent brief from the video-use skill, adapted for the automated pipeline.

### EDL Construction

From `cuts[]`, build the EDL:

```json
{
  "sources": {"raw": "/path/to/video.mp4"},
  "ranges": [
    {"source": "raw", "start": 0.0, "end": 5.2, "beat": "HOOK"},
    {"source": "raw", "start": 6.8, "end": 18.4, "beat": "CONTEXT"},
    {"source": "raw", "start": 19.0, "end": 35.6, "beat": "INSIGHT"}
  ],
  "grade": "auto",
  "overlays": [
    {"file": "broll/beat-00-slug.mp4", "start_in_output": 1.5, "duration": 4.0}
  ],
  "subtitles": "edit/master.srt"
}
```

Each `keep` entry in `cuts[]` becomes a range. `trim` entries are simply omitted — they're the gaps between ranges.

Overlay `start_in_output` is calculated relative to the **output timeline** (after cuts), not the source timeline. The engine maps beat timecodes from source time to output time using the cumulative duration of preceding kept segments.

### Strategy Confirmation

Before rendering, the engine presents a plain-English summary:

```
Edit Plan:
  Source: my-vlog.mp4 (2m 14s)
  Output: ~1m 32s (31% trimmed)
  
  Cuts:
    - 0:05–0:07  TRIM  dead air (1.6s silence)
    - 0:22–0:24  TRIM  filler ("um, so basically")
    - 0:45–0:51  TRIM  restart ("wait let me say that again—")
    - 1:38–1:44  TRIM  trailing silence
  
  Kept beats:
    HOOK      0:00–0:05  "Did you know 90% of reels fail..."
    CONTEXT   0:07–0:22  "Here's what most creators get wrong..."
    INSIGHT   0:24–0:45  "The trick is in the first 3 seconds..."
    PROOF     0:51–1:20  "I tested this on 50 videos..."
    CTA       1:20–1:38  "Save this and try it on your next reel"
  
  B-roll: 6 clips fetched (4 video, 2 images)
  Grade: auto
  Subtitles: yes (bold-overlay)
  
  Proceed? (yes / adjust / redo)
```

The user can approve, request adjustments ("keep the restart at 0:45, it's authentic"), or ask for a complete redo with different parameters.

If `auto_confirm: true` in config or `--auto` flag, this step is skipped.

---

## Config System

Stored at `vault/reel-config.yaml`. Created on first run with sensible defaults. Flags override config values.

```yaml
# /make-reel defaults
mode: video-agent            # video-agent | heygen-basic | edit-raw

# Shared
auto_publish: false
publish_platform: instagram  # instagram | linkedin | all

# Video Agent + HeyGen Basic
duration: 45
style: punchy                # punchy | deep-dive

# Editing Engine (heygen-basic + edit-raw)
grade: auto                  # auto | subtle | neutral_punch | warm_cinematic | none
subtitles: true
subtitle_style: bold-overlay # bold-overlay | natural-sentence
broll: true
auto_confirm: false          # skip strategy confirmation
target_silence_max: 0.4      # trim silences longer than this (seconds)
cut_filler_words: true       # remove ums, ahs, "you know", etc.

# Edit Raw specific
detect_retakes: true         # auto-detect multi-take and pick best
```

Loading priority: `vault/reel-config.yaml` → flag overrides → defaults.

---

## Updated Argument Reference

```
/make-reel <url-or-topic> [flags]
```

### Mode Selection (mutually exclusive)
| Flag | Description |
|------|-------------|
| *(none)* | Video Agent mode (default, or whatever `mode:` is in config) |
| `--heygen-basic` | HeyGen talking head + local editing |
| `--edit-raw <video-path>` | Edit existing raw footage, no HeyGen |

### Shared Flags
| Flag | Config key | Default | Description |
|------|-----------|---------|-------------|
| `--auto-publish <platform>` | `auto_publish` | false | Publish after pipeline completes |
| `--auto` | `auto_confirm` | false | Skip strategy confirmation |

### Video Agent & HeyGen Basic
| Flag | Config key | Default | Description |
|------|-----------|---------|-------------|
| `--duration N` | `duration` | 45 | Target length in seconds |
| `--style <s>` | `style` | punchy | Script style |
| `--from-angle <path>` | — | — | Skip research, use angle file |
| `--from-script <path>` | — | — | Skip research + script |

### Editing Engine (HeyGen Basic + Edit Raw)
| Flag | Config key | Default | Description |
|------|-----------|---------|-------------|
| `--grade <preset>` | `grade` | auto | Color grade preset |
| `--no-broll` | `broll: false` | true | Skip b-roll fetching |
| `--no-subtitles` | `subtitles: false` | true | Skip subtitles |

### Edit Raw Only
| Flag | Config key | Default | Description |
|------|-----------|---------|-------------|
| `--topic <string>` | — | filename | Topic for session naming + captions |

---

## Environment Requirements

| Key | Video Agent | HeyGen Basic | Edit Raw |
|-----|:-----------:|:------------:|:--------:|
| `HEYGEN_API_KEY` | required | required | — |
| `OPENAI_API_KEY` | required | required | — |
| `PEXELS_API_KEY` | required | required | required |
| `ELEVENLABS_API_KEY` | — | required | required |
| `PIXABAY_API_KEY` | optional | optional | optional |

ElevenLabs is now required for modes 2 and 3 (Scribe transcription powers subtitles and cut decisions).

---

## Session Directory Layout

### Mode 2 (heygen-basic)
```
vault/outputs/reels/YYYY-MM-DD-<slug>/
  AVATAR-USER.md              # symlink
  research.md
  script.md
  heygen_video.mp4            # HeyGen talking head
  beats.json                  # from parse_script()
  asset_manifest.json
  caption.md
  final.mp4 → edit/final.mp4
  broll/
  sfx/
  edit/
    transcripts/raw.json      # Scribe output of heygen_video.mp4
    takes_packed.md
    edl.json
    master.srt
    final.mp4
```

### Mode 3 (edit-raw)
```
vault/outputs/reels/YYYY-MM-DD-<slug>/
  raw.mp4                     # copied input
  beats.json                  # LLM-derived from transcript
  asset_manifest.json
  caption.md
  final.mp4 → edit/final.mp4
  broll/
  sfx/
  edit/
    transcripts/raw.json      # Scribe output
    takes_packed.md
    edl.json
    master.srt
    final.mp4
    verify/                   # timeline_view debug PNGs
```

---

## Files to Create / Modify

### New
| File | Purpose |
|------|---------|
| `scripts/video_edit/edit_engine.py` | Shared local editing engine — orchestrates: transcribe → fetch assets → build EDL → render. Called by both mode 2 and mode 3. |
| `scripts/video_edit/build_edl.py` | Converts beats.json (with optional cuts) into edl.json. Handles source-to-output time mapping for overlay placement. |

### Modify
| File | Change |
|------|--------|
| `.claude/commands/make-reel.md` | Rewrite stages 4B and 4C to both invoke the shared editing engine. Add config loading. Add strategy confirmation. Add `--auto` flag. |
| `scripts/check_env.py` | Make ELEVENLABS required for heygen-basic mode too (needed for subtitle transcription). |

### Already Done (from earlier this session)
| File | Status |
|------|--------|
| `scripts/video_edit/transcribe.py` | Copied from video-use |
| `scripts/video_edit/pack_transcripts.py` | Copied from video-use |
| `scripts/video_edit/render.py` | Copied from video-use |
| `scripts/video_edit/grade.py` | Copied from video-use |
| `scripts/video_edit/timeline_view.py` | Copied from video-use |

---

## Verification

- **Mode 2 smoke test:** `/make-reel "AI agents" --heygen-basic` → produces edited video with b-roll + subtitles
- **Mode 3 smoke test:** `/make-reel --edit-raw ./test-video.mp4 --topic "test"` → produces cut, b-rolled, subtitled video
- **Mode 3 with cuts:** Record a 2-min freestyle video with intentional pauses and filler → verify dead air is removed, output is tighter
- **Strategy confirmation:** Verify edit plan is shown and waitable before render
- **Config system:** Set `grade: warm_cinematic` in config, run without `--grade` flag, verify warm grade is applied
- **Regression:** Mode 1 (Video Agent) unchanged
