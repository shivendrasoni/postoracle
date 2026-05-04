---
description: Generate a portrait short-form video from a URL or topic (research → script → HeyGen → b-roll → edit).
argument-hint: "<url-or-topic> [--duration 30|45|60] [--style punchy|deep-dive]"
allowed-tools: Bash, Read, Write, WebFetch, WebSearch
---

# /make-reel Pipeline

Orchestrate the 5-stage content creation pipeline below. Work sequentially. Stop and report clearly if any stage fails. Never skip a stage.

## 0. Parse Arguments & Load Environment

Parse `$ARGUMENTS`:
- `url-or-topic` — everything before any `--` flags (required)
- `--duration N` — default `45` (seconds)
- `--style punchy|deep-dive` — default `punchy`

Load environment from `.env` in the project root:
```bash
set -a && source "$(pwd)/.env" && set +a
```

Validate env vars (fail fast if required keys are missing):
```bash
python3 scripts/check_env.py
```

If exit code is non-zero: stop and tell the user exactly which keys are missing.

## 1. Create Session Folder

```bash
SESSION_DIR=$(python3 scripts/create_session.py "$TOPIC" --base-dir "$(pwd)")
echo "Session folder: $SESSION_DIR"
```

Check for `AVATAR-USER.md` at the project root. If missing, stop:
> "Your HeyGen avatar isn't configured. Run /heygen-avatar first to create your avatar file, then re-run /make-reel."

Symlink avatar into session:
```bash
ln -sf "$(pwd)/AVATAR-USER.md" "$SESSION_DIR/AVATAR-USER.md"
```

## 2. Stage 1 — Research

**If input starts with `http`:**
- Use `WebFetch` to scrape the URL
- Summarize key claims, hooks, stats, visual ideas into `$SESSION_DIR/research.md` (~300 words)

**If input is a topic string:**
- Use `WebSearch` to find top 3–5 results
- Use `WebFetch` on the 2 most relevant URLs
- Summarize into `$SESSION_DIR/research.md` (~300 words)

Write `research.md`. Log: `✓ Stage 1 complete`

## 3. Stage 2 — Script

Invoke the `viral-reel-generator` skill. Pass:
- Contents of `$SESSION_DIR/research.md` as research context
- Style: `--style punchy` → Style A (Punchy Explainer); `--style deep-dive` → Style B (Deep Dive)
- Target duration: `--duration` value in seconds

Save the full output (timecodes + visual cues + CTA) to `$SESSION_DIR/script.md`.

Validate: `script.md` must contain at least one `(M:SS)` timecode and at least one `[Visual: ...]` line. If missing, regenerate once. If still invalid after one retry, stop and report.

Log: `✓ Stage 2 complete`

## 4. Stage 3 — HeyGen Video

Invoke the `heygen-video` skill. Pass:
- Avatar: read `avatar_id` and `voice_id` from `$SESSION_DIR/AVATAR-USER.md`
- Script: full contents of `$SESSION_DIR/script.md` (scene-labeled, script-as-prompt)
- Format: portrait `1080×1920`
- Duration target: `--duration` seconds

Save output to `$SESSION_DIR/heygen_video.mp4`.

Log: `✓ Stage 3 complete`

## 5. Stage 4 — Asset Fetch

Parse beats from the script:
```bash
python3 scripts/parse_script.py "$SESSION_DIR/script.md" > "$SESSION_DIR/beats.json"
```

For each beat in `beats.json`, fetch b-roll and SFX. Read `beat_slug`, `visual_cue`, and `timecode_s` from each entry.

**B-roll per beat (Pexels video → Pexels photo → OpenAI image):**
```bash
# Pexels (handles video + photo fallback internally)
python3 scripts/fetch_broll.py "$VISUAL_CUE" "$SESSION_DIR/broll" "$BEAT_SLUG" \
  || python3 scripts/fetch_images.py "$VISUAL_CUE portrait photo" "$SESSION_DIR/broll/$BEAT_SLUG.png"
```

**SFX per beat (optional — skip silently if no key):**
```bash
python3 scripts/fetch_sfx.py "$VISUAL_CUE" "$SESSION_DIR/sfx" "$BEAT_SLUG"
```

Individual asset failures are non-fatal. Log any skipped beats and continue.

Build the asset manifest:
```bash
python3 scripts/build_manifest.py \
  "$SESSION_DIR/beats.json" \
  "$SESSION_DIR/broll" \
  "$SESSION_DIR/sfx" \
  "$SESSION_DIR/asset_manifest.json"
```

Log: `✓ Stage 4 complete`

## 6. Stage 5 — Edit

Invoke the `video-use` skill with this exact brief:

- **Source:** `$SESSION_DIR/heygen_video.mp4` — portrait talking head (1080×1920)
- **Asset manifest:** `$SESSION_DIR/asset_manifest.json` — each entry has `timecode_s`, `broll_path`, `sfx_path`
- **Edit strategy:** Talking head is the base layer. At each `timecode_s`, cut to or overlay the b-roll asset for ~3–5s (or until the next beat), then return to talking head. Skip beats where `broll_path` is null.
- **SFX:** Place `sfx_path` audio at `timecode_s` where not null. Mix under the talking head audio at -12dB.
- **Motion graphics:** Use Remotion for typography-heavy text overlays from `text_overlay` fields; use PIL for simple accent overlays.
- **Subtitles:** Transcribe `heygen_video.mp4` at word level (Scribe) → generate `master.srt` → burn LAST using bold-overlay style: 2-word UPPERCASE chunks, Helvetica Bold size 18, white text with black outline, `MarginV=35`.
- **Output:** `1080×1920@30fps` → `$SESSION_DIR/edit/final.mp4`

After edit completes:
```bash
ln -sf "$SESSION_DIR/edit/final.mp4" "$SESSION_DIR/final.mp4"
```

## 7. Done

Report to user:
```
✓ /make-reel complete
Session: $SESSION_DIR
Final video: $SESSION_DIR/final.mp4
```
