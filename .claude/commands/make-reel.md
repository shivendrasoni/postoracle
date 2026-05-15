---
description: "Generate a portrait short-form video. Default: Video Agent. --heygen-basic: talking head + local edit. --edit-raw: edit your own footage."
argument-hint: "<url-or-topic> [--duration 30|45|60] [--style punchy|deep-dive] [--heygen-basic] [--edit-raw <video-path>]"
allowed-tools: Bash, Read, Write, WebFetch, WebSearch
---

# /make-reel Pipeline

Three modes:
- **Default (Video Agent):** Research → Script → HeyGen Video Agent v3 → finished video. Video Agent handles b-roll, transitions, motion graphics, and pacing. No post-processing needed. ~$2/min.
- **`--heygen-basic`:** Research → Script → basic HeyGen talking head → fetch b-roll → local video editing. You control every cut. ~$0.50–1/min for the video + local compute for editing.
- **`--edit-raw <video-path>`:** Edit raw footage you already have. No research, no script, no HeyGen. Transcribe → analyze → fetch b-roll → grade + overlay + subtitles → final.mp4. Local compute + Pexels + ElevenLabs Scribe.

Work sequentially. Stop and report clearly if any stage fails. Never skip a stage unless explicitly marked conditional.

---

## 0. Parse Arguments & Load Environment

Parse `$ARGUMENTS`:
- `url-or-topic` — everything before any `--` flags (required UNLESS --edit-raw, --from-angle, or --from-script is set)
- `--duration N` — default `45` (seconds). Ignored with `--edit-raw`.
- `--style punchy|deep-dive` — default `punchy`. Ignored with `--edit-raw`.
- `--heygen-basic` — optional; use basic HeyGen video + local editing pipeline instead of Video Agent
- `--edit-raw <video-path>` — optional; edit existing raw footage. No HeyGen, no research, no script.
- `--auto-publish instagram|linkedin|all` — optional; if present, publish after pipeline completes. Store in `$AUTO_PUBLISH`.
- `--auto` — optional; skip strategy confirmation before rendering
- `--from-angle <path>` — optional; path to a vault angle file. Skips Stage 1 (Research). The angle's contrast, talking_points, and hook_pattern replace research context.
- `--from-script <path>` — optional; path to a vault script file. Skips Stage 1 (Research) AND Stage 2 (Script). Pipeline starts at Stage 3 (Video). Script must contain timecodes and `[Visual: ...]` cues.

**Editing engine flags (heygen-basic + edit-raw):**
- `--no-broll` — optional; skip b-roll fetching (grade + subtitles only).
- `--no-subtitles` — optional; skip subtitle generation and burn-in.
- `--grade <auto|subtle|neutral_punch|warm_cinematic|none>` — optional; default from config.

**Edit-raw only flags:**
- `--topic <string>` — optional; topic label for session naming + caption context. Defaults to video filename stem.

**Mutual exclusivity:**
- `--heygen-basic`, `--edit-raw`, `--from-angle`, `--from-script` — only one mode modifier at a time.
- If `--edit-raw` is set: `--heygen-basic`, `--from-angle`, `--from-script` are invalid. `url-or-topic` is not required.
- If `--from-angle` is set, `url-or-topic` is not required (topic comes from the angle file).
- If `--from-script` is set, `url-or-topic`, `--duration`, and `--style` are ignored.
- `--from-angle` and `--from-script` are mutually exclusive. If incompatible flags are present, stop: `[ERROR] Incompatible flags — use only one of --heygen-basic, --edit-raw, --from-angle, --from-script.`

**If `--edit-raw` is set:**
- Verify the video file exists: if not, stop: `[ERROR] Video file not found: <path>`
- Set `$EDIT_RAW=true`, `$EDIT_RAW_PATH=<resolved absolute path>`
- Set `$TOPIC` from `--topic` value or video filename stem (e.g., `my-vlog.mp4` → `my-vlog`)

Load environment from `.env` in the project root:
```bash
set -a && source "$(pwd)/.env" && set +a
```

Validate env vars (fail fast if required keys are missing):
```bash
python3 scripts/check_env.py heygen-basic  # if --heygen-basic
python3 scripts/check_env.py edit-raw      # if --edit-raw
python3 scripts/check_env.py              # otherwise
```

If exit code is non-zero: stop and tell the user exactly which keys are missing.

**Load config:**
```bash
python3 -c "
from scripts.reel_config import load_config
import json
config = load_config()
print(json.dumps(config))
"
```

Parse the JSON output into `$CONFIG`. Flag values from arguments override config:
- `--grade` overrides `config.grade`
- `--auto` overrides `config.auto_confirm` to `true`
- `--no-broll` overrides `config.broll` to `false`
- `--no-subtitles` overrides `config.subtitles` to `false`
- `--duration` overrides `config.duration`
- `--style` overrides `config.style`

Set variables from config (applied after flag overrides):
- `$GRADE` = resolved grade value (flag > config > default "auto")
- `$SUBTITLES` = resolved boolean (flag > config > default true)
- `$BROLL` = resolved boolean (flag > config > default true)
- `$AUTO_CONFIRM` = resolved boolean (`--auto` flag > config > default false)

**If `--edit-raw` is set → skip to Stage 1-ER (Edit Raw Session).**

## 1. Create Session Folder

```bash
SESSION_DIR=$(python3 scripts/create_session.py "$TOPIC" --base-dir "$(pwd)" --output-dir "vault/outputs/reels")
mkdir -p "$(pwd)/vault/logs"
echo "Session folder: $SESSION_DIR"
```

Check for `AVATAR-USER.md` at the project root. If missing, stop:
> "Your HeyGen avatar isn't configured. Run /heygen-avatar first to create your avatar file, then re-run /make-reel."

Symlink avatar into session:
```bash
ln -sf "$(pwd)/AVATAR-USER.md" "$SESSION_DIR/AVATAR-USER.md"
```

## 1.3. Load Angle or Script (conditional)

**If `--from-angle` is set:**

```bash
python3 -c "
from scripts.parse_angle import read_angle
import yaml
fm, body = read_angle('$FROM_ANGLE_PATH')
print(yaml.dump(fm, default_flow_style=False))
print('---')
print(body)
"
```

Read the output. Extract `topic`, `contrast`, `hook_pattern`, `talking_points` from the frontmatter, and the angle body. These replace the research output in Stage 2.

Set `$TOPIC` from the angle's `topic` field if not already set from arguments.

**Skip to Stage 2.**

**If `--from-script` is set:**

```bash
python3 -c "
from scripts.parse_script_library import read_script
import yaml
fm, body = read_script('$FROM_SCRIPT_PATH')
print(yaml.dump(fm, default_flow_style=False))
print('---')
print(body)
"
```

Read the output. The body IS the script. Write it to `$SESSION_DIR/script.md`.

Set `$TOPIC` from the script's `topic` field.

Validate: script body must contain at least one `(M:SS)` timecode and at least one `[Visual: ...]` line. If validation fails, stop: `[ERROR] Script file missing timecodes or visual cues — cannot use with make-reel.`

**Skip to Stage 3.**

## 1.5. Load Brand Modules

Load brand context from vault. Missing modules warn but do not block.

```bash
VAULT_DIR="$(pwd)/vault"
VAULT_STYLE="$VAULT_DIR/brand/modules/style.md"
VAULT_CTA="$VAULT_DIR/brand/modules/cta.md"
VAULT_NICHE="$VAULT_DIR/brand/modules/niche.md"
VAULT_WATERMARK="$VAULT_DIR/brand/modules/watermark.md"
VAULT_PERFORMANCE="$VAULT_DIR/brand/modules/performance.md"
```

For each file that exists, read it:
```bash
for MODULE_PATH in "$VAULT_STYLE" "$VAULT_CTA" "$VAULT_NICHE" "$VAULT_WATERMARK" "$VAULT_PERFORMANCE"; do
  if [ -f "$MODULE_PATH" ]; then
    echo "Loaded: $MODULE_PATH"
  else
    echo "[WARN] $MODULE_PATH not found — skipping"
  fi
done
```

Inject the contents of each found module into the script generation context for Stage 2:
- `style.md` → tone, vocabulary, opener patterns to apply (and anti-patterns to avoid)
- `cta.md` → CTA line to append at the end of the script (use `platforms.instagram.primary` or `default`)
- `niche.md` → audience persona and transformation for relevance filtering
- `watermark.md` → stored spec for video post-processing step (only used in `--heygen-basic` mode)
- `performance.md` → data-driven insights on what content types and hooks perform best (from `/analytics --insights`)

## 2. Stage 1 — Research

**Skip this stage if `--from-angle` or `--from-script` is set.**

**If input starts with `http`:**
- Use `WebFetch` to scrape the URL
- Summarize key claims, hooks, stats, visual ideas into `$SESSION_DIR/research.md` (~300 words)

**If input is a topic string:**
- Use `WebSearch` to find top 3–5 results
- Use `WebFetch` on the 2 most relevant URLs
- Summarize into `$SESSION_DIR/research.md` (~300 words)

Write `research.md`. Log: `✓ Research complete`

## 3. Stage 2 — Script

**Skip this stage if `--from-script` is set.**

**If `--from-angle` is set:** Pass the angle's contrast, talking_points, and hook_pattern to the viral-reel-generator skill as research context instead of `$SESSION_DIR/research.md`.

Invoke the `viral-reel-generator` skill. Pass:
- Contents of `$SESSION_DIR/research.md` as research context
- Style: `--style punchy` → Style A (Punchy Explainer); `--style deep-dive` → Style B (Deep Dive)
- Target duration: `--duration` value in seconds
- Brand voice context (inject into script prompt if modules were loaded):
  - From `style.md`: apply tone, vocabulary, opener patterns; avoid anti-patterns
  - From `niche.md`: tailor content to audience persona and transformation
  - From `cta.md`: append the platform CTA as the final beat of the script

Save the full output (timecodes + visual cues + CTA) to `$SESSION_DIR/script.md`.

Validate: `script.md` must contain at least one `(M:SS)` timecode and at least one `[Visual: ...]` line. If missing, regenerate once. If still invalid after one retry, stop and report.

Log: `✓ Script complete`

---

## 4. Stage 3 — Video Generation (BRANCH POINT)

Read avatar config from `$SESSION_DIR/AVATAR-USER.md`. Extract `Group ID` and `Voice ID` from the HeyGen section.

**If `--heygen-basic` is NOT set → go to Stage 4A (Video Agent).**
**If `--heygen-basic` IS set → go to Stage 4B (Basic Video + Local Edit).**

---

### 4A. Video Agent Mode (default)

Video Agent v3 produces a fully edited video — b-roll, transitions, motion graphics, pacing. No post-processing needed.

Invoke the `heygen-video` skill in **Enhanced Prompt** mode. Pass:

1. **Avatar:** `avatar_id` (resolved from group_id) and `voice_id` from AVATAR-USER.md
2. **Script:** Full contents of `$SESSION_DIR/script.md`
3. **Orientation:** portrait (`9:16`)
4. **Duration target:** `--duration` seconds
5. **Visual style direction:** If `style.md` was loaded, include brand colors, tone, and visual preferences. Otherwise use:
   ```
   Use minimal, clean styled visuals. Blue, black, and white as main colors.
   Leverage motion graphics as B-rolls and A-roll overlays. Use AI videos when necessary.
   When real-world footage is needed, use Stock Media.
   Include an intro sequence, outro sequence, and chapter breaks using Motion Graphics.
   ```
6. **Research context:** If `$SESSION_DIR/research.md` exists, include key facts and stats so Video Agent can create better visual representations of the data.

The heygen-video skill handles Frame Check, Prompt Craft, and Generate internally. Wait for the video to complete.

Save the final video directly as `$SESSION_DIR/final.mp4`.

Log: `✓ Video Agent complete`

**Skip to Stage 5 (Caption).**

---

### 4B. HeyGen Basic Mode (`--heygen-basic`)

Generate a basic talking-head video (no editing), then use the shared editing engine to produce the final cut.

#### 4B.1. Basic HeyGen Video (talking head only)

Resolve the avatar look_id from the group_id using the heygen-video skill's avatar resolution flow (list looks → pick matching orientation).

Extract clean spoken text from the script and generate a talking-head video via the v2 API:

```bash
python3 scripts/heygen_basic_video.py \
  --script-file "$SESSION_DIR/script.md" \
  --avatar-id "$LOOK_ID" \
  --voice-id "$VOICE_ID" \
  --output-path "$SESSION_DIR/heygen_video.mp4" \
  --width 1080 --height 1920 \
  --timeout 1800
```

If exit code is non-zero, stop and report the error.

Log: `✓ Talking head video complete`

#### 4B.2. Parse Beats & Fetch Assets

Parse beats from the script:
```bash
python3 scripts/parse_script.py "$SESSION_DIR/script.md" > "$SESSION_DIR/beats.json"
```

For each beat in `beats.json["beats"]`, fetch b-roll and SFX. Read `beat_slug`, `visual_cue`, and `timecode_s` from each entry.

**If `$BROLL` is false (--no-broll), skip asset fetching and go to 4B.3.**

**B-roll per beat (Pexels video → Pexels photo → OpenAI image):**
```bash
python3 scripts/fetch_broll.py "$VISUAL_CUE" "$SESSION_DIR/broll" "$BEAT_SLUG" \
  || python3 scripts/fetch_images.py "$VISUAL_CUE portrait photo" "$SESSION_DIR/broll/$BEAT_SLUG.png"
```

**SFX per beat (optional — skip silently if no key):**
```bash
python3 scripts/fetch_sfx.py "$VISUAL_CUE" "$SESSION_DIR/sfx" "$BEAT_SLUG"
```

Individual asset failures are non-fatal. Log any skipped beats and continue.

**Convert any b-roll images to video clips.** For each `.jpg`/`.png` in the broll directory, convert to a 5s portrait video with Ken Burns pan:
```bash
ffmpeg -y -loop 1 -i "<image>" -vf "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,zoompan=z='min(zoom+0.001,1.08)':d=150:s=1080x1920" -t 5 -c:v libx264 -pix_fmt yuv420p "<image_stem>.mp4"
```

Build the asset manifest:
```bash
python3 scripts/build_manifest.py \
  "$SESSION_DIR/beats.json" \
  "$SESSION_DIR/broll" \
  "$SESSION_DIR/sfx" \
  "$SESSION_DIR/asset_manifest.json"
```

Log: `✓ Assets fetched`

#### 4B.3. Build EDL & Strategy Confirmation

Run the editing engine to build the EDL and edit plan (without rendering yet):

```bash
python3 -c "
from scripts.video_edit.edit_engine import run_engine
from pathlib import Path
run_engine(
    session_dir=Path('$SESSION_DIR'),
    source_video=Path('$SESSION_DIR/heygen_video.mp4'),
    beats_path=Path('$SESSION_DIR/beats.json'),
    manifest_path=Path('$SESSION_DIR/asset_manifest.json'),
    grade='$GRADE',
    subtitles=True,
    render=False,
)
"
```

Read `$SESSION_DIR/edit/edit_plan.txt` and display it to the user:

```
Edit Plan:
  Source: heygen_video.mp4 (Xs)
  Output: ~Xs (0% trimmed — no cuts in HeyGen basic mode)
  
  B-roll: N overlay(s)
  Grade: auto
  Subtitles: yes
  
  Proceed? (yes / adjust / redo)
```

**If `$AUTO_CONFIRM` is true:** Skip confirmation, proceed to render.

**Otherwise:** Wait for user response:
- **yes** → proceed to render
- **adjust** → user provides changes (e.g., "remove b-roll at beat 3", "change grade to warm_cinematic") → update edl.json accordingly → show plan again
- **redo** → re-run from 4B.2 with different parameters

#### 4B.4. Render

```bash
python3 scripts/video_edit/render.py \
  "$SESSION_DIR/edit/edl.json" \
  -o "$SESSION_DIR/edit/final.mp4" \
  --build-subtitles
```

Link final output:
```bash
ln -sf "$SESSION_DIR/edit/final.mp4" "$SESSION_DIR/final.mp4"
```

Log: `✓ Edit complete`

**Skip to Stage 5 (Caption).**

---

## Stage 1-ER. Edit Raw — Session Setup

**This stage runs ONLY when `--edit-raw` is set. It replaces Stages 1 through 4.**

Create session folder:
```bash
SESSION_DIR=$(python3 scripts/create_session.py "$TOPIC" --base-dir "$(pwd)" --output-dir "vault/outputs/reels")
mkdir -p "$(pwd)/vault/logs"
mkdir -p "$SESSION_DIR/edit/transcripts"
mkdir -p "$SESSION_DIR/edit/verify"
mkdir -p "$SESSION_DIR/broll"
mkdir -p "$SESSION_DIR/sfx"
echo "Session folder: $SESSION_DIR"
```

Copy the raw video into the session:
```bash
cp "$EDIT_RAW_PATH" "$SESSION_DIR/raw.mp4"
```

No avatar check — HeyGen is not used in this mode.

Load brand modules (Stage 1.5) — still useful for caption generation. Missing modules warn but do not block.

Log: `✓ Session created (edit-raw mode)`

---

## Stage 4C. Edit Raw — Pipeline

### 4C.1. Transcribe

Transcribe the raw video with ElevenLabs Scribe (word-level timestamps, speaker diarization, audio events):

```bash
python3 scripts/video_edit/transcribe.py "$SESSION_DIR/raw.mp4" --edit-dir "$SESSION_DIR/edit"
```

Verify output exists: `$SESSION_DIR/edit/transcripts/raw.json`

Log: `✓ Transcription complete`

### 4C.2. Pack Transcript

Convert the raw word-level transcript into a phrase-level markdown reading surface:

```bash
python3 scripts/video_edit/pack_transcripts.py --edit-dir "$SESSION_DIR/edit"
```

Output: `$SESSION_DIR/edit/takes_packed.md`

Read the packed transcript. This is the primary content view — use it for all downstream analysis.

Log: `✓ Transcript packed`

### 4C.3. Analyze Content, Extract Beats & Cut Decisions

Read `$SESSION_DIR/edit/takes_packed.md`. Analyze the transcript to produce **both** structural beats and cut decisions.

**Multi-take detection:** If the transcript contains repeated phrases, "let me try that again," similar openings, or multiple attempts at the same content — switch to multi-take mode:
- Identify the structural beats (hook, problem, solution, CTA)
- For each beat, pick the best take based on: delivery clarity, energy, completeness
- Assemble chronologically by beat, not by source order

**Beat extraction** — identify 5–10 moments where b-roll would enhance the video:
- Look for: topic transitions, concrete examples, statistics/numbers, demonstrations, emotional shifts, concept introductions
- Space beats at least 8–10 seconds apart (avoid over-cutting)
- Derive `visual_cue` from what the speaker is *describing*, not literal words — optimize for Pexels video search
- Each `timecode_s` should align with a phrase boundary from the packed transcript
- Prefer visual cues that work as portrait b-roll (actions, objects, environments)

**Cut decisions** — analyze the transcript for trimmable content:
1. **Dead air removal** — silences ≥ `$CONFIG.target_silence_max` (default 0.4s) between phrases
2. **Filler word removal** — "um", "uh", "like", "you know" with surrounding pauses (if `$CONFIG.cut_filler_words` is true)
3. **Restart detection** — repeated phrases or false starts ("So the thing is— actually let me start over—")
4. **Pacing** — if the video is freestyle/rambling, tighten to a reasonable duration

**Cut rules:**
- Never cut inside a word (snap to word boundaries from transcript)
- Pad cut edges 30–200ms (absorbs Scribe timestamp drift)
- Prefer silences ≥ 400ms as cut targets (cleanest)
- Never cut inside a punchline, key insight, or emotional peak

Write `$SESSION_DIR/beats.json` matching this exact schema:
```json
{
  "beats": [
    {
      "index": 0,
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

`beat_slug` format: `beat-{index:02d}-{slugified-visual-cue}` (max 50 chars).

Print a summary: number of beats extracted, number of cuts, estimated output duration, time saved.

Log: `✓ Content analysis complete — {N} beats, {M} cuts`

**If `$BROLL` is false (--no-broll), skip to Stage 4C.5.**

### 4C.4. Fetch B-roll & SFX

For each beat in `beats.json["beats"]`, fetch b-roll and SFX:

**B-roll per beat (Pexels video → Pexels photo → OpenAI image):**
```bash
python3 scripts/fetch_broll.py "$VISUAL_CUE" "$SESSION_DIR/broll" "$BEAT_SLUG" \
  || python3 scripts/fetch_images.py "$VISUAL_CUE portrait photo" "$SESSION_DIR/broll/$BEAT_SLUG.png"
```

**SFX per beat (optional — skip silently if no key):**
```bash
python3 scripts/fetch_sfx.py "$VISUAL_CUE" "$SESSION_DIR/sfx" "$BEAT_SLUG"
```

Individual asset failures are non-fatal. Log any skipped beats and continue.

**Convert any b-roll images to video clips.** For each `.jpg`/`.png` in the broll directory, convert to a 5s portrait video with Ken Burns pan:
```bash
ffmpeg -y -loop 1 -i "<image>" -vf "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,zoompan=z='min(zoom+0.001,1.08)':d=150:s=1080x1920" -t 5 -c:v libx264 -pix_fmt yuv420p "<image_stem>.mp4"
```

Build the asset manifest:
```bash
python3 scripts/build_manifest.py \
  "$SESSION_DIR/beats.json" \
  "$SESSION_DIR/broll" \
  "$SESSION_DIR/sfx" \
  "$SESSION_DIR/asset_manifest.json"
```

Log: `✓ Assets fetched`

### 4C.5. Build EDL & Strategy Confirmation

Run the editing engine to build the EDL and edit plan (without rendering yet):

Determine subtitle boolean from flags/config:
- If `--no-subtitles` was set: `SUBTITLES=false`
- Else use config value: `SUBTITLES=$CONFIG_SUBTITLES`

```bash
SUBS_PY=$( [ "$SUBTITLES" = "false" ] && echo "False" || echo "True" )
python3 -c "
from scripts.video_edit.edit_engine import run_engine
from pathlib import Path
run_engine(
    session_dir=Path('$SESSION_DIR'),
    source_video=Path('$SESSION_DIR/raw.mp4'),
    beats_path=Path('$SESSION_DIR/beats.json'),
    manifest_path=Path('$SESSION_DIR/asset_manifest.json'),
    grade='$GRADE',
    subtitles=$SUBS_PY,
    render=False,
)
"
```

Read `$SESSION_DIR/edit/edit_plan.txt` and display it to the user:

```
Edit Plan:
  Source: raw.mp4 (2m 14s)
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

**If `$AUTO_CONFIRM` is true:** Skip confirmation, proceed to render.

**Otherwise:** Wait for user response:
- **yes** → proceed to render
- **adjust** → user provides changes (e.g., "keep the restart at 0:45, it's authentic", "remove b-roll at beat 3") → update beats.json and re-run build_edl → show plan again
- **redo** → re-run from 4C.3 with different parameters

### 4C.6. Render

```bash
python3 scripts/video_edit/render.py \
  "$SESSION_DIR/edit/edl.json" \
  -o "$SESSION_DIR/edit/final.mp4" \
  --build-subtitles
```

If `--no-subtitles`:
```bash
python3 scripts/video_edit/render.py \
  "$SESSION_DIR/edit/edl.json" \
  -o "$SESSION_DIR/edit/final.mp4" \
  --no-subtitles
```

Link final output:
```bash
ln -sf "$SESSION_DIR/edit/final.mp4" "$SESSION_DIR/final.mp4"
```

### 4C.7. Self-Verify (Mode 3 only)

Generate timeline view debug PNGs at each cut boundary to check for pops or jump cuts:

```bash
python3 scripts/video_edit/timeline_view.py \
  "$SESSION_DIR/edit/final.mp4" \
  --edit-dir "$SESSION_DIR/edit" \
  --output-dir "$SESSION_DIR/edit/verify"
```

Visually inspect the generated PNGs. If any cut shows:
- Audio pops (waveform spike at boundary)
- Visual jump (mismatched frames across cut)
- Subtitle overlap (text from trimmed section visible)

Flag to user: "⚠ Potential issue at cut boundary [time]. Review `edit/verify/` PNGs."

Log: `✓ Edit complete + verified`

**Continue to Stage 5 (Caption).**

---

## 5. Caption

Generate the social post caption and write `$SESSION_DIR/caption.md`.

**If `--edit-raw` mode:** Read `$SESSION_DIR/edit/takes_packed.md` as the content source (no script.md exists).
**Otherwise:** Read `$SESSION_DIR/script.md` as the content source.

Extract:
- The hook line (first spoken phrase / beat)
- The core value points (3–5 key points from the content)
- The CTA line (last beat, or `platforms.instagram.primary` from `cta.md` if loaded)

Write `$SESSION_DIR/caption.md` in this exact format:

```
# Caption

## Post Caption

<hook line as opening — 1 punchy sentence>

<3–5 value lines drawn from the content, each on its own line with a → or • prefix>

<CTA line>

<save/share prompt — 1 sentence>

<hashtags — 10–15 relevant tags>

---

## LinkedIn Caption

<hook line — same opening hook, adapted for LinkedIn's professional tone>

<paragraph 1 (3-4 sentences): set up the problem or common belief. Write in first person, conversational but professional.>

<paragraph 2 (3-4 sentences): deliver the insight, stats, or mechanism. Include specific numbers.>

<paragraph 3 (2-3 sentences): the conclusion or call to action. No hashtags in the body.>

<3-5 hashtags on a final line — LinkedIn-appropriate, no more than 5>

---

## Content Reference

<full contents of script.md OR takes_packed.md>
```

Rules:
- The Post Caption (Instagram) must be self-contained, punchy, and hashtag-rich
- The LinkedIn Caption must be 2-3 full paragraphs — narrative, professional, no bullet arrows or emoji
- LinkedIn tone: first-person storytelling, data-backed, no hashtag spam (max 5 at the end)
- Hook line must match or closely echo the content's opening hook on both platforms
- Use the CTA from `cta.md` (`platforms.instagram.primary` → fallback to `default`) if the module was loaded; otherwise derive a CTA from the content's closing point
- Instagram hashtags: mix broad (#contentcreator) + niche + topic-specific tags (10-15)
- LinkedIn hashtags: 3-5 professional tags only

Log: `✓ Caption complete`

## 6. Log Pipeline Run

```bash
LOG_FILE="$(pwd)/vault/logs/pipeline-log.md"
TIMESTAMP=$(date "+%Y-%m-%d %H:%M")
BRAND_LOADED="none"
[ -f "$VAULT_STYLE" ] && BRAND_LOADED="style"
[ -f "$VAULT_CTA" ] && BRAND_LOADED="$BRAND_LOADED,cta"
[ -f "$VAULT_NICHE" ] && BRAND_LOADED="$BRAND_LOADED,niche"

MODE="video-agent"
[ "$HEYGEN_BASIC" = true ] && MODE="heygen-basic"
[ "$EDIT_RAW" = true ] && MODE="edit-raw"

cat >> "$LOG_FILE" << EOF

## $TIMESTAMP — make-reel ($MODE)
- topic: $TOPIC
- duration: $DURATION
- style: $STYLE
- mode: $MODE
- brand modules: $BRAND_LOADED
- output: $SESSION_DIR/final.mp4
EOF
```

## 6.5. Register Content

```bash
python3 -c "
from scripts.registry import Registry, compute_virality_score
from datetime import datetime, timezone
import json

entry = {
    'id': '$(basename $SESSION_DIR)',
    'type': 'reel',
    'topic': $(python3 -c "import json; print(json.dumps('$TOPIC'))"),
    'source_url': $(python3 -c "
import json
inp = '$TOPIC'
print(json.dumps(inp if inp.startswith('http') else None))
"),
    'platforms': ['instagram'],
    'status': 'draft',
    'virality_score': None,
    'created_at': datetime.now(timezone.utc).isoformat(),
    'scheduled_at': None,
    'published_at': {},
    'published_urls': {},
    'session_dir': '$SESSION_DIR',
    'tags': [],
}

reg = Registry()
try:
    reg.add(entry)
    print('✓ Registered in content registry')
except ValueError:
    print('⚠ Already in registry — skipping')
"
```

## 6.7. Publish (conditional)

Runs only if `--auto-publish` was present in `$ARGUMENTS`. Parse the value that follows `--auto-publish` as `$AUTO_PUBLISH`.

If `$AUTO_PUBLISH` is set, run:

```bash
python3 scripts/publish.py \
  --session-dir "$SESSION_DIR" \
  --platform "$AUTO_PUBLISH"
```

If the publish step ran, append a `Published:` line to the done report.

## 7. Done

Report to user:
```
✓ /make-reel complete
Mode: $MODE
Session: $SESSION_DIR
Final video: $SESSION_DIR/final.mp4
Caption: $SESSION_DIR/caption.md
[if --auto-publish was set] Published: $AUTO_PUBLISH
```
