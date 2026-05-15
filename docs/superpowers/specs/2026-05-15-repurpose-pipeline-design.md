# Repurpose Pipeline — Design Spec

## Problem

The vault has synced Instagram saves with downloaded videos, transcripts-ready metadata, and engagement scores. But there's no pipeline to turn a saved reel into original content. The user currently has to manually watch, extract the insight, write a script, and then run `/make-reel` — a multi-hour process that should be a single command.

## Goal

A `/repurpose` command that takes a saved post, extracts the core insight, rewrites it as an original script in the user's brand voice, and then delegates to the existing `/make-reel` pipeline for production.

**Key principle: repurpose ≠ copy.** The output script captures the *insight* from the source, not the words. It's rewritten from scratch in the user's brand voice, with original hooks, examples, and CTA.

---

## What's New vs What's Reused

| Component | Status | Notes |
|-----------|--------|-------|
| Source selection (pick a saved post) | **NEW** | Accept shortcode, URL, or path |
| Source transcription | **REUSE** | `scripts/video_edit/transcribe.py` (ElevenLabs Scribe) |
| Insight extraction + angle generation | **NEW** | LLM analysis of transcript → structured angle |
| Script generation in brand voice | **REUSE** | Existing `/viral-script` logic (HEIL structure) |
| Video recording + editing | **REUSE** | `/make-reel --from-script <path> --edit-raw <video>` |
| HeyGen Basic talking head + edit | **REUSE** | `/make-reel --from-script <path> --heygen-basic` |
| HeyGen Video Agent | **REUSE** | `/make-reel --from-script <path>` |
| B-roll, grading, subtitles, render | **REUSE** | Existing editing engine |
| Provenance tracking | **NEW** | `source_*` fields in script frontmatter |

**The only new creative work is: select source → transcribe → extract insight → generate repurposed script.** Everything after that is delegation.

---

## Command Interface

```
/repurpose <shortcode|url|path> [--mode record|heygen-basic|heygen-agent] [--script-mode shortform|longform|linkedin] [--auto]
```

### Arguments

| Argument | Required | Default | Description |
|----------|----------|---------|-------------|
| `<source>` | Yes | — | Instagram shortcode (e.g. `DI3RGhLNXPc`), Instagram URL, or local video path |
| `--mode` | No | `record` | Output mode: `record` (user records, then edit-raw), `heygen-basic` (talking head + local edit), `heygen-agent` (Video Agent v3) |
| `--script-mode` | No | `shortform` | Script structure: `shortform` (HEIL, 15-60s), `longform` (3P's, 8-15min), `linkedin` (text post) |
| `--auto` | No | `false` | Skip strategy confirmation, go straight through |
| `--duration` | No | `45` | Target duration in seconds (passed through to make-reel) |
| `--no-broll` | No | `false` | Skip b-roll fetching (passed through) |

### Source Resolution

1. **Shortcode** (e.g. `DI3RGhLNXPc`): Look up in `vault/imports/instagram-saved/_index.json`. Must exist and have `downloaded: true` with a `video_file` path.
2. **URL** (e.g. `https://instagram.com/reel/DI3RGhLNXPc/`): Extract shortcode from URL, then resolve as above.
3. **Local path** (e.g. `~/Downloads/clip.mp4`): Use directly. No vault metadata available — transcribe only, no engagement context.

If the video isn't downloaded yet, run `sync_instagram.download_videos()` for that shortcode first.

---

## Pipeline Flow

### Phase 1: Transcribe Source

```
source video (vault or local)
    ↓
scripts/video_edit/transcribe.py → word-level JSON
    ↓
scripts/video_edit/pack_transcripts.py → readable transcript (takes_packed.md)
```

Reuse the existing Scribe transcription pipeline. Output: a human-readable phrase-level transcript with timestamps.

### Phase 2: Extract Insight

```
takes_packed.md + vault metadata (caption, engagement, author)
    ↓
LLM analysis
    ↓
Structured insight extraction
```

The LLM reads the transcript and source metadata, then extracts:

```yaml
core_insight: "The single key idea worth repurposing"
contrast:
  common_belief: "What most people think (the A)"
  surprising_truth: "What the source reveals (the B)"
  strength: moderate|strong|extreme
talking_points:
  - "Supporting point 1"
  - "Supporting point 2"
  - "Supporting point 3"
  - "Supporting point 4"
  - "Supporting point 5"
source_context:
  what_worked: "Why this resonated (engagement signals)"
  audience_overlap: "How source audience maps to user's niche"
  differentiation: "What angle the user can own that the source didn't"
```

**This is NOT a summary.** It's a structured extraction of the transferable insight, filtered through the user's niche and audience. The LLM must:

1. Read `vault/brand/modules/niche.md` to understand the user's audience
2. Read `vault/brand/modules/style.md` to understand voice constraints
3. Identify what made the source content resonate (engagement signals from vault metadata)
4. Extract the core A→B contrast (the insight engine, not the presentation)
5. Propose differentiation — what angle the user can own

### Phase 3: Generate Repurposed Script

```
Extracted insight + brand modules
    ↓
/viral-script logic (hook generation → scoring → script writing)
    ↓
vault/library/scripts/YYYY-MM-DD-<slug>-<mode>-repurposed-NN.md
```

Feed the extracted insight into the existing `/viral-script` pipeline:

- **Hook generation**: 10 hooks scored by contrast fit, pattern strength, platform fit
- **Script structure**: HEIL (shortform), 3P's (longform), or LinkedIn text — per `--script-mode`
- **Brand voice**: Applied from `vault/brand/modules/style.md`, `cta.md`, `niche.md`
- **Anti-slop rules**: All existing script quality rules enforced

The generated script is saved with extended frontmatter:

```yaml
---
type: script
topic: "extracted topic"
mode: shortform
source_shortcode: "DI3RGhLNXPc"
source_url: "https://www.instagram.com/reel/DI3RGhLNXPc/"
source_author: "@namratarchawla"
source_title: "First line of original caption"
repurposed: true
hook_pattern: contradiction
hook_score: 0.85
duration_target: 45
status: draft
created: 2026-05-15
---
```

The `source_*` fields establish provenance — the content registry and dashboard can show "repurposed from @creator".

### Phase 4: Delegate to make-reel (Mode-Dependent)

This is where the pipeline branches based on `--mode`:

#### Mode A: Record (`--mode record`, default)

**Two-phase, async flow.** Phase 1 ends here. The user records later.

```
Phase 1 (now):
  /repurpose DI3RGhLNXPc --mode record
  → Transcribe → Extract → Generate script
  → Save to vault/library/scripts/2026-05-15-<slug>-shortform-repurposed-01.md
  → Print: "Script ready. Record your video, then run:"
  → Print: "/make-reel --from-script vault/library/scripts/2026-05-15-<slug>-shortform-repurposed-01.md --edit-raw <your-recording.mp4>"

Phase 2 (later, user-initiated):
  /make-reel --from-script <script-path> --edit-raw <recording.mp4>
  → Existing edit-raw pipeline (transcribe recording → cuts → b-roll → render)
```

The script file is the linking artifact between the two phases. The user records at their convenience, then invokes `/make-reel` with both the script and their recording.

#### Mode B: HeyGen Basic (`--mode heygen-basic`)

**One-shot flow.** Delegates directly after script generation.

```
/repurpose DI3RGhLNXPc --mode heygen-basic
  → Transcribe → Extract → Generate script
  → Delegate: /make-reel --from-script <script-path> --heygen-basic [--duration N]
  → HeyGen basic talking head → local edit engine → final.mp4
```

#### Mode C: HeyGen Agent (`--mode heygen-agent`)

**One-shot flow.** Delegates to Video Agent.

```
/repurpose DI3RGhLNXPc --mode heygen-agent
  → Transcribe → Extract → Generate script
  → Delegate: /make-reel --from-script <script-path> [--duration N]
  → Video Agent v3 → final.mp4
```

---

## Strategy Confirmation

Before generating the script (unless `--auto`), present a confirmation:

```
Repurpose Strategy:
  Source: @namratarchawla — "Some secret tips for Instagram..." (1.2M views)
  
  Core Insight: [extracted A→B contrast]
  Your Angle: [differentiation point]
  
  Script Mode: shortform (HEIL, ~45s)
  Output Mode: record (you'll record, then edit-raw)
  
  Proceed? (yes / adjust / skip)
```

- `yes`: generate script
- `adjust`: modify parameters
- `skip`: abort

---

## Data Flow Diagram

```
vault/imports/instagram-saved/
├── _index.json  ←── (1) resolve shortcode
├── videos/DI3RGhLNXPc.mp4  ←── (2) source video
└── DI3RGhLNXPc-caption-slug.md  ←── (3) metadata

        ↓ (2) transcribe
scripts/video_edit/transcribe.py → edit/transcripts/source.json
        ↓
scripts/video_edit/pack_transcripts.py → takes_packed.md
        ↓ + (3) metadata + brand modules
LLM insight extraction → structured insight
        ↓
/viral-script logic → vault/library/scripts/YYYY-MM-DD-<slug>-repurposed-NN.md
        ↓
        ├── --mode record → STOP (print next command for user)
        ├── --mode heygen-basic → /make-reel --from-script --heygen-basic
        └── --mode heygen-agent → /make-reel --from-script
```

---

## New Files

| File | Purpose |
|------|---------|
| `.claude/commands/repurpose.md` | Slash command definition (orchestration spec) |
| `scripts/repurpose.py` | Source resolution + transcription orchestration + insight extraction prompt |
| `tests/test_repurpose.py` | Unit tests for source resolution, frontmatter extension, insight schema validation |

**That's it.** Three files. The rest is delegation to existing infrastructure.

### scripts/repurpose.py

Responsible for the mechanical parts that benefit from a standalone script:

1. **`resolve_source(identifier: str) -> dict`** — Takes shortcode, URL, or path. Returns `{shortcode, video_path, metadata_path, caption, author, engagement}`. Reads `_index.json` and markdown frontmatter.
2. **`ensure_downloaded(shortcode: str) -> Path`** — Checks if video exists locally. If not, calls `sync_instagram.download_videos()` for that shortcode. Returns video path.
3. **`transcribe_source(video_path: Path, work_dir: Path) -> Path`** — Runs transcribe.py + pack_transcripts.py. Returns path to `takes_packed.md`.
4. **`build_repurpose_frontmatter(source_meta: dict) -> dict`** — Generates the `source_*` frontmatter fields for the output script.

The insight extraction and script generation are LLM tasks handled in the command definition (`.claude/commands/repurpose.md`), not in Python.

---

## Assumptions

Decisions made on the user's behalf (since they said "take correct assumptions"):

1. **Default mode is `record`** — the user said "I record the video, you edit it" as their first flow. HeyGen modes are explicit opt-ins.
2. **Default script mode is `shortform` (HEIL)** — Instagram saves are predominantly short reels. Longform and LinkedIn are available via `--script-mode`.
3. **Repurpose means insight extraction, not transcript cleanup** — the output script is original content written from scratch in the user's brand voice, not a polished version of the source transcript.
4. **Brand voice modules improve quality but don't block** — if `vault/brand/modules/` doesn't exist, warn and continue with generic voice. Suggest `/brand-voice` for better results.
5. **The record flow is two-phase** — `/repurpose` generates the script and stops. The user records at their convenience, then runs `/make-reel --from-script --edit-raw` separately. No attempt to make this look like a single command.
6. **Provenance is tracked** — `source_shortcode`, `source_url`, `source_author` in script frontmatter. The content registry can later surface "repurposed from" metadata.
7. **No batch repurposing** — one source at a time. Batch is a follow-up.
8. **No dashboard integration yet** — the dashboard "Saves" table doesn't get a "Repurpose" button in this iteration. Follow-up.
9. **Engagement context improves insight extraction** — when source metadata is available (views, likes, comments), it's fed to the LLM to understand *why* the content resonated, not just *what* it says.
10. **All existing make-reel flags pass through** — `--duration`, `--no-broll`, `--no-subtitles`, `--grade`, `--auto` are forwarded to `/make-reel` when delegating.

---

## Out of Scope

- Batch repurposing multiple saves at once
- Dashboard "Repurpose" button
- Cross-platform saves (TikTok, YouTube) — infrastructure supports it, but only Instagram is wired
- Multi-take recording logic (already handled by edit-raw)
- Automatic source recommendation ("which saves should I repurpose?")
- Content similarity detection (avoiding repurposing the same insight twice)

---

## Testing Strategy

| Test | What it validates |
|------|------------------|
| `test_resolve_source_shortcode` | Shortcode → video path + metadata from _index.json |
| `test_resolve_source_url` | URL → shortcode extraction → same resolution |
| `test_resolve_source_path` | Local path → direct usage, no vault lookup |
| `test_resolve_source_not_found` | Missing shortcode → clear error message |
| `test_ensure_downloaded` | Triggers download when `downloaded: false` |
| `test_build_repurpose_frontmatter` | Correct `source_*` fields generated |
| `test_frontmatter_missing_metadata` | Graceful handling when source is a local file (no vault metadata) |
