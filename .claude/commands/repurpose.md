# /repurpose — Turn a saved post into original content

## Arguments

Parse `$ARGUMENTS` for:

- `<source>` (required): Instagram shortcode, URL, or local video path
- `--mode <mode>` (default: from config): One of `record`, `heygen-basic`, `heygen-agent`
- `--script-mode <mode>` (default: from config): One of `shortform`, `longform`, `linkedin`
- `--duration <seconds>` (default: from config): Target video duration
- `--auto` (flag): Skip strategy confirmation
- `--no-broll` (flag): Skip b-roll fetching (passed to make-reel)
- `--no-subtitles` (flag): Skip subtitle generation (passed to make-reel)

If no `<source>` is provided, stop with:
> "Usage: `/repurpose <shortcode|url|path> [--mode record|heygen-basic|heygen-agent] [--script-mode shortform|longform|linkedin]`"

**Load config:**
```bash
python3 -c "
from scripts.config import load_config
import json
config = load_config('repurpose')
print(json.dumps(config))
"
```

Use config values as defaults:
- `--mode` overrides `config.mode` (default: from config)
- `--script-mode` overrides `config.script_mode` (default: from config)
- `--duration` overrides `config.duration` (default: from config)
- `--auto` overrides `config.auto_confirm`

---

## Stage 1: Resolve Source

```bash
python3 -c "
from scripts.repurpose import resolve_source, ensure_downloaded
import json

result = resolve_source('$SOURCE', vault_dir=__import__('pathlib').Path('vault/imports/instagram-saved'))
print(json.dumps(result, default=str))
"
```

If `resolve_source` raises `FileNotFoundError` about download:
```bash
python3 -c "
from scripts.repurpose import ensure_downloaded
result = ensure_downloaded('$SHORTCODE')
print(result)
"
```

Store the result. You now have:
- `$VIDEO_PATH`: path to the source video
- `$SHORTCODE`, `$AUTHOR`, `$AUTHOR_NAME`, `$LINK`: source metadata
- `$CAPTION`: original caption text
- `$VIEW_COUNT`, `$LIKE_COUNT`, `$COMMENT_COUNT`: engagement metrics
- `$SOURCE_TYPE`: "vault" or "local"

If `$SOURCE_TYPE` is "local", engagement context won't be available — note this but continue.

---

## Stage 2: Transcribe Source

Create a temporary working directory:

```bash
WORK_DIR=$(python3 scripts/create_session.py "repurpose-$SHORTCODE" --base-dir "$(pwd)" --output-dir "vault/outputs/reels")
```

If `$SOURCE_TYPE` is "local", use the filename stem instead of shortcode for the session name.

Transcribe:

```bash
python3 -c "
from scripts.repurpose import transcribe_source
from pathlib import Path
result = transcribe_source(Path('$VIDEO_PATH'), Path('$WORK_DIR'))
print(result)
"
```

Read the resulting `$WORK_DIR/edit/takes_packed.md`. This is the source transcript.

---

## Stage 3: Extract Insight

Read brand modules (all optional but recommended):
- `vault/brand/modules/niche.md` — audience persona, transformation, blockers
- `vault/brand/modules/style.md` — tone, vocabulary, patterns
- `vault/brand/modules/cta.md` — CTA templates

If none exist, warn: "No brand voice configured. Run `/brand-voice` for better results. Continuing with generic voice."

**Insight Extraction Prompt:**

You are analyzing a source video to extract a repurposable insight. You are NOT copying or summarizing — you are extracting the transferable *idea* that can be rewritten as completely original content.

**Source transcript:**
```
{contents of takes_packed.md}
```

**Source metadata:**
- Author: $AUTHOR ($AUTHOR_NAME)
- Views: $VIEW_COUNT | Likes: $LIKE_COUNT | Comments: $COMMENT_COUNT
- Caption: $CAPTION
- Collection: $COLLECTION

**Your brand context:**
```
{contents of niche.md — audience, transformation, blockers}
{contents of style.md — tone, vocabulary}
```

**Extract:**

1. **Core Insight**: The single transferable idea (not the presentation, not the personality — the *idea*). One sentence.

2. **Contrast** (A→B):
   - Common Belief (A): What most people assume
   - Surprising Truth (B): What the insight reveals
   - Strength: mild / moderate / strong / extreme

3. **Talking Points**: 5 bullet points that support the insight, reframed for YOUR audience (not the source's audience)

4. **Source Analysis**:
   - What Worked: Why did this resonate? (hook technique, emotional trigger, specificity, controversy)
   - Audience Overlap: How does the source's audience map to yours?
   - Your Differentiation: What unique angle can YOU bring that the source didn't? (your experience, your niche, your style)

**Output format** — return a YAML block:

```yaml
core_insight: "..."
contrast:
  common_belief: "..."
  surprising_truth: "..."
  strength: strong
talking_points:
  - "..."
  - "..."
  - "..."
  - "..."
  - "..."
source_context:
  what_worked: "..."
  audience_overlap: "..."
  differentiation: "..."
```

Store the extracted insight as `$INSIGHT`.

---

## Stage 4: Strategy Confirmation

Unless `--auto` is set, present:

```
Repurpose Strategy:
  Source: $AUTHOR — "$CAPTION_FIRST_LINE" ($VIEW_COUNT views)

  Core Insight: $CORE_INSIGHT
  Contrast: "$COMMON_BELIEF" → "$SURPRISING_TRUTH"
  Your Angle: $DIFFERENTIATION

  Script Mode: $SCRIPT_MODE ($DURATION_TARGETs)
  Output Mode: $MODE

  Proceed? (yes / adjust / skip)
```

- **yes**: continue to Stage 5
- **adjust**: ask what to change, re-extract if needed
- **skip**: abort, clean up session directory

---

## Stage 5: Generate Repurposed Script

Build repurpose frontmatter:

```bash
python3 -c "
from scripts.repurpose import build_repurpose_frontmatter
import json
meta = $SOURCE_META_JSON
print(json.dumps(build_repurpose_frontmatter(meta)))
"
```

Now generate the script using existing `/viral-script` logic:

**If `$SCRIPT_MODE` is `shortform`:**

Generate a HEIL (Hook / Explain / Illustrate / Lesson) script. Use the extracted insight as the creative brief:

- **Hook**: Generate 10 hooks from the contrast. Score by contrast_fit (0.40), pattern_strength (0.35), platform_fit (0.25). Present top 3.
- **Body**: Write 5–8 beats with timecodes and visual cues. Apply brand voice from style.md. Use talking points as structure.
- **CTA**: Pull from cta.md or generate platform-appropriate CTA.
- **Duration**: Target `$DURATION` seconds.

Apply ALL anti-slop rules:
- No 3-word loops, no rhetorical lists, no meta-commentary
- No hype adjectives, no fake scenarios, no throat-clearing
- Use connectors: "See," "Meaning," "Therefore"
- Use contrast: "Most [X] do Y. But [This] does Z."

**If `$SCRIPT_MODE` is `longform`:**

Generate a 3P's (Proof / Promise / Plan) script with the same insight.

**If `$SCRIPT_MODE` is `linkedin`:**

Generate a LinkedIn text post with hook line + body + CTA + hashtags.

**Save the script** to `vault/library/scripts/YYYY-MM-DD-<topic-slug>-$SCRIPT_MODE-repurposed-NN.md`

The script frontmatter MUST include the `source_*` fields from `build_repurpose_frontmatter()` merged with the standard script frontmatter:

```yaml
---
type: script
topic: "<extracted topic>"
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

Print the saved script path: `$SCRIPT_PATH`

---

## Stage 6: Delegate to /make-reel (Mode-Dependent)

### If `$MODE` is `record`:

**Stop here.** Print:

```
✓ Repurposed script ready!

  Source: $AUTHOR — "$SOURCE_TITLE"
  Script: $SCRIPT_PATH
  Mode: shortform (HEIL, ~${DURATION}s)

  Next steps:
  1. Review the script: Read $SCRIPT_PATH
  2. Record your video
  3. Edit and render:
     /make-reel --from-script $SCRIPT_PATH --edit-raw <your-recording.mp4>
```

Do NOT invoke `/make-reel`. The user records at their own pace.

### If `$MODE` is `heygen-basic`:

Delegate directly:

```
/make-reel --from-script $SCRIPT_PATH --heygen-basic --duration $DURATION $EXTRA_FLAGS
```

Where `$EXTRA_FLAGS` includes `--no-broll`, `--no-subtitles`, `--auto` if set.

### If `$MODE` is `heygen-agent`:

Delegate directly:

```
/make-reel --from-script $SCRIPT_PATH --duration $DURATION $EXTRA_FLAGS
```

This invokes the default Video Agent mode.

---

## Error Handling

| Error | Action |
|-------|--------|
| Source not in vault | "Shortcode not found. Run `/sync-instagram` to fetch your saved posts." |
| Video not downloaded | Auto-trigger download, retry |
| Download fails | "Video download failed. The Instagram URL may have expired. Re-run `/sync-instagram sync --refresh` to get fresh URLs." |
| No brand modules | Warn but continue: "No brand voice found. Run `/brand-voice` for personalized scripts." |
| Transcription fails | "Transcription failed. Check ELEVENLABS_API_KEY in .env." |
| Script generation fails validation | Retry once. If still invalid, show the raw script and ask user to fix. |
