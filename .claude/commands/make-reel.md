---
description: "Generate a portrait short-form video from a URL or topic. Default: Video Agent (fully edited). --local-edit: talking head + local b-roll/editing."
argument-hint: "<url-or-topic> [--duration 30|45|60] [--style punchy|deep-dive] [--local-edit]"
allowed-tools: Bash, Read, Write, WebFetch, WebSearch
---

# /make-reel Pipeline

Two modes:
- **Default (Video Agent):** Research → Script → HeyGen Video Agent v3 → finished video. Video Agent handles b-roll, transitions, motion graphics, and pacing. No post-processing needed. ~$2/min.
- **`--local-edit`:** Research → Script → basic HeyGen talking head → fetch b-roll → local video editing. You control every cut. ~$0.50–1/min for the video + local compute for editing.

Work sequentially. Stop and report clearly if any stage fails. Never skip a stage unless explicitly marked conditional.

---

## 0. Parse Arguments & Load Environment

Parse `$ARGUMENTS`:
- `url-or-topic` — everything before any `--` flags (required UNLESS --from-angle or --from-script is set)
- `--duration N` — default `45` (seconds)
- `--style punchy|deep-dive` — default `punchy`
- `--local-edit` — optional; use basic HeyGen video + local editing pipeline instead of Video Agent
- `--auto-publish instagram|linkedin|all` — optional; if present, publish after pipeline completes. Store in `$AUTO_PUBLISH`.
- `--from-angle <path>` — optional; path to a vault angle file. Skips Stage 1 (Research). The angle's contrast, talking_points, and hook_pattern replace research context.
- `--from-script <path>` — optional; path to a vault script file. Skips Stage 1 (Research) AND Stage 2 (Script). Pipeline starts at Stage 3 (Video). Script must contain timecodes and `[Visual: ...]` cues.

If `--from-angle` is set, `url-or-topic` is not required (topic comes from the angle file).
If `--from-script` is set, `url-or-topic`, `--duration`, and `--style` are ignored.
`--from-angle` and `--from-script` are mutually exclusive. If both are present, stop: `[ERROR] Use --from-angle OR --from-script, not both.`

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
- `watermark.md` → stored spec for video post-processing step (only used in `--local-edit` mode)
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

**If `--local-edit` is NOT set → go to Stage 4A (Video Agent).**
**If `--local-edit` IS set → go to Stage 4B (Basic Video + Local Edit).**

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

### 4B. Local Edit Mode (`--local-edit`)

Generate a basic talking-head video (no editing), then build the final video locally with b-roll overlays and subtitles.

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

#### 4B.2. Asset Fetch

Parse beats from the script:
```bash
python3 scripts/parse_script.py "$SESSION_DIR/script.md" > "$SESSION_DIR/beats.json"
```

For each beat in `beats.json`, fetch b-roll and SFX. Read `beat_slug`, `visual_cue`, and `timecode_s` from each entry.

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

Build the asset manifest:
```bash
python3 scripts/build_manifest.py \
  "$SESSION_DIR/beats.json" \
  "$SESSION_DIR/broll" \
  "$SESSION_DIR/sfx" \
  "$SESSION_DIR/asset_manifest.json"
```

Log: `✓ Assets fetched`

#### 4B.3. Edit

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

Log: `✓ Edit complete`

---

## 5. Caption

Generate the social post caption from the script and write `$SESSION_DIR/caption.md`.

Read `$SESSION_DIR/script.md` to extract:
- The hook line (first spoken beat)
- The core value points
- The CTA line (last beat, or `platforms.instagram.primary` from `cta.md` if loaded)

Write `$SESSION_DIR/caption.md` in this exact format:

```
# Caption

## Post Caption

<hook line as opening — 1 punchy sentence>

<3–5 value lines drawn from the script beats, each on its own line with a → or • prefix>

<CTA line>

<save/share prompt — 1 sentence>

<hashtags — 10–15 relevant tags>

---

## LinkedIn Caption

<hook line — same opening hook, adapted for LinkedIn's professional tone>

<paragraph 1 (3-4 sentences): set up the problem or common belief. Use the script's context/setup beats. Write in first person, conversational but professional.>

<paragraph 2 (3-4 sentences): deliver the insight, stats, or mechanism. Draw from the script's core argument. Include specific numbers.>

<paragraph 3 (2-3 sentences): the conclusion or call to action. End with the CTA adapted for LinkedIn (e.g., "Comment [keyword] and I'll send you..." or "DM me [keyword] for..."). No hashtags in the body.>

<3-5 hashtags on a final line — LinkedIn-appropriate, no more than 5>

---

## Script Reference

<full contents of script.md>
```

Rules:
- The Post Caption (Instagram) must be self-contained, punchy, and hashtag-rich
- The LinkedIn Caption must be 2-3 full paragraphs — narrative, professional, no bullet arrows or emoji
- LinkedIn tone: first-person storytelling, data-backed, no hashtag spam (max 5 at the end)
- Hook line must match or closely echo the script's opening hook on both platforms
- Use the CTA from `cta.md` (`platforms.instagram.primary` → fallback to `default`) if the module was loaded; otherwise derive a CTA from the script's closing beat
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
[ "$LOCAL_EDIT" = true ] && MODE="local-edit"

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
