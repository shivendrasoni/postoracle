---
description: Generate a single-image social media post from a URL or topic, tailored per platform.
argument-hint: "<url-or-topic> [--platform instagram|linkedin|x|all] [--mode visual|text] [--from-angle <path>] [--auto-publish platform]"
allowed-tools: Bash, Read, Write, WebFetch, WebSearch
---

# /make-post Pipeline

Orchestrate the single-image post creation pipeline below. Work sequentially. Stop and report clearly if any stage fails. Never skip a stage unless explicitly marked conditional.

## 0. Parse Arguments & Load Environment

Parse `$ARGUMENTS`:
- `<input>` — everything before any `--` flags (required); can be plain text, HTTP URL, or GitHub repo URL
- `--platform` — default from config; valid: `instagram`, `linkedin`, `x`, `all`
- `--mode` — default from config; valid: `visual` (creative AI image), `text` (branded text card)
- `--from-angle <path>` — optional; path to an angle YAML file. If present, skip research stage.
- `--auto-publish <platform>` — optional; if present, publish after pipeline completes.

Load environment from `.env` in the project root:
```bash
set -a && source "$(pwd)/.env" && set +a
```

Verify `OPENAI_API_KEY` is set:
```bash
[ -z "$OPENAI_API_KEY" ] && echo "[ERROR] OPENAI_API_KEY is not set in .env — aborting." >&2 && exit 1
```

**Load config:**
```bash
python3 -c "
from scripts.config import load_config
import json
config = load_config('make_post')
print(json.dumps(config))
"
```

Parse the JSON output into `$CONFIG`. Flag values from arguments override config:
- `--platform` overrides `config.platform`
- `--mode` overrides `config.mode`
- `--auto-publish` overrides `config.auto_publish`

Determine which platforms need images:
- If `--platform all` → `PLATFORMS="instagram,linkedin"` (X gets text only, no image needed)
- If `--platform x` → `PLATFORMS=""` (no image generation needed at all)
- Otherwise → `PLATFORMS="$PLATFORM"` (single platform)

## 1. Create Session Folder

```bash
TODAY=$(date +%Y-%m-%d)
SLUG=$(echo "$INPUT" | python3 -c "
import re, sys
text = sys.stdin.read().strip()
text = re.sub(r'https?://\S+', 'url', text)
text = text.lower()
text = re.sub(r'[^a-z0-9]+', '-', text)
print(text.strip('-')[:40])
")
SESSION_DIR="$(pwd)/vault/outputs/posts/${TODAY}-${SLUG}"
mkdir -p "$SESSION_DIR"
mkdir -p "$(pwd)/vault/logs"
echo "Session folder: $SESSION_DIR"
```

## 2. Research (skip if `--from-angle`)

**If `--from-angle` was provided:**
Read the angle file. Parse its YAML frontmatter to extract `contrast`, `one_liner` (if present), `image_concept` (if present), `hook_pattern`, and `talking_points`.

Write a synthetic `research.md` from the angle data:
```markdown
# Research (from angle)

**Core contrast:** <contrast.common_belief> vs <contrast.surprising_truth>
**Key message:** <one_liner or talking_points[0]>
**Image concept:** <image_concept or "derive from contrast">
**Hook pattern:** <hook_pattern>
```

Skip to Stage 3 (Load Brand).

**If input starts with `http`:**
- Use `WebFetch` to fetch the URL
- Summarize key claims and hooks (~300 words)
- Write to `$SESSION_DIR/research.md`

**If input is plain text:**
- Use `WebSearch` to find 2-3 relevant supporting sources
- Synthesize into `$SESSION_DIR/research.md`

Log: `✓ Stage 2 complete — Research`

## 3. Load Brand Modules

```bash
VAULT_DIR="$(pwd)/vault"
VAULT_BRAND="$VAULT_DIR/brand/modules/brand.md"
VAULT_STYLE="$VAULT_DIR/brand/modules/style.md"
VAULT_CTA="$VAULT_DIR/brand/modules/cta.md"
VAULT_PHOTO="$VAULT_DIR/brand/modules/photo.md"
VAULT_NICHE="$VAULT_DIR/brand/modules/niche.md"
```

Read each file that exists and inject into context:
- `brand.md` → colors (`#C5F135` primary/accent, `#111111` secondary) + font
- `style.md` → tone (direct, slapstick, fluffless) for caption voice
- `cta.md` → CTA text per platform
- `photo.md` → photo_path + physical description for image generation
- `niche.md` → niche context for content relevance

For each missing file: `[WARN] vault/brand/modules/<name>.md not found — skipping`

## 4. Content Analysis

Analyze the research material and decide the image generation approach:

**Decision: `reference` (edit endpoint)**
Use when the concept involves the creator physically — action poses, costumes, speaking, holding objects.
- Requires `photo.md` module with `photo_path` and `description`
- If `photo.md` is missing, fall back to `description` mode with a warning

**Decision: `description` (generate endpoint)**
Use when the concept is abstract, metaphorical, or would look awkward with a real photo.

Report the decision: `Photo approach: <reference|description> — <one-line justification>`

## 5. Construct Image Prompt

Build the GPT-image-2 prompt. The prompt must include:

1. **Creative concept** — the scene, composition, mood (from research/angle)
2. **Text overlays** — key message baked into the image (bold, readable)
3. **Brand colors** — `#C5F135` lime accent, `#111111` dark tones (from `brand.md`)
4. **Watermark** — subtle `@oyegpt` in corner
5. **Person description** — if `reference` mode, include photo.md `description`
6. **Format** — "Square 1024x1024 format"

**For `--mode text`:**
Build a text card prompt instead:
- Dark `#111111` background
- Key quote/hook in bold white typography
- `#C5F135` accent elements
- `@oyegpt` watermark
- Clean, minimal, no photos

Store the constructed prompt as `$IMAGE_PROMPT`.

**If `--from-angle` with `image_concept`:**
Use the angle's `image_concept` as the base creative concept instead of generating one from research.

## 6. Generate Master Image

**If platform is X-only (no image needed):**
Skip this stage entirely. Log: `✓ Stage 6 skipped — X/Twitter is text-only`

**Otherwise:**

Determine reference mode arguments:
```bash
USE_REF_FLAG=""
PHOTO_FLAG=""
if [ "$PHOTO_APPROACH" = "reference" ] && [ -f "$VAULT_PHOTO" ]; then
  PHOTO_PATH=$(python3 -c "
import yaml
from pathlib import Path
text = Path('$VAULT_PHOTO').read_text()
parts = text.split('---', 2)
fm = yaml.safe_load(parts[1]) if len(parts) >= 3 else {}
print(fm.get('photo_path', ''))
")
  if [ -n "$PHOTO_PATH" ] && [ -f "$(pwd)/vault/$PHOTO_PATH" ]; then
    USE_REF_FLAG="--use-reference"
    PHOTO_FLAG="--photo-path $(pwd)/vault/$PHOTO_PATH"
  fi
fi
```

Generate the image:
```bash
python3 scripts/generate_post.py \
  --prompt "$IMAGE_PROMPT" \
  --out-dir "$SESSION_DIR" \
  --brand "$VAULT_BRAND" \
  $USE_REF_FLAG $PHOTO_FLAG \
  --platforms "$PLATFORMS"
```

Verify outputs:
```bash
ls -la "$SESSION_DIR"/image*.png
```

Log: `✓ Stage 6 complete — Master image + platform variants`

## 7. Generate Caption

Write `$SESSION_DIR/post.md` with platform-specific sections. Use brand voice from `style.md`, CTAs from `cta.md`, and niche context from `niche.md`.

```markdown
## LinkedIn
<Professional tone, longer form, line breaks for readability.
Use style.md guidance: direct, no-fluff.
Include relevant hashtags (3-5).>

## Instagram
<Punchy, emoji-friendly.
CTA from cta.md — use platforms.instagram.primary value.
Include hashtags (5-10).>

## X
<280 characters max. Hook-driven. 1-2 hashtags max.
Must be self-contained — no image context (X is text-only).>
```

**Caption rules:**
- LinkedIn: professional but direct. Use line breaks for readability. No emoji overload.
- Instagram: punchy, use emoji where natural. End with CTA (comment-keyword-to-DM pattern from `cta.md`).
- X: 280 char limit. All substance, no filler. 1-2 hashtags max.
- All platforms: match tone from `style.md`. Reference niche from `niche.md` for authenticity.

**If `--from-angle`:** Use the angle's `contrast` for a punchier opening and `hook_pattern` to shape the hook.

Log: `✓ Stage 7 complete — Captions`

## 8. Log Pipeline Run

```bash
LOG_FILE="$(pwd)/vault/logs/pipeline-log.md"
TIMESTAMP=$(date "+%Y-%m-%d %H:%M")
BRAND_VERSION=$(python3 -c "
import yaml
from pathlib import Path
p = Path('vault/brand/modules/brand.md')
if p.exists():
    parts = p.read_text().split('---', 2)
    fm = yaml.safe_load(parts[1]) if len(parts) >= 2 else {}
    print(f\"loaded (brand-voice v{fm.get('last_updated', 'unknown')})\")
else:
    print('not loaded')
" 2>/dev/null || echo "not loaded")

cat >> "$LOG_FILE" << EOF

## $TIMESTAMP — make-post
- topic: $INPUT
- platform: $PLATFORM
- mode: $MODE
- photo: $PHOTO_APPROACH
- brand: $BRAND_VERSION
- output: $SESSION_DIR
EOF
```

## 8.5. Register Content

```bash
python3 -c "
from scripts.registry import Registry, compute_virality_score
from datetime import datetime, timezone
import json

entry = {
    'id': '$(basename $SESSION_DIR)',
    'type': 'post',
    'topic': $(python3 -c "import json; print(json.dumps('$INPUT'))"),
    'source_url': $(python3 -c "
import json
inp = '$INPUT'
print(json.dumps(inp if inp.startswith('http') else None))
"),
    'platforms': '$PLATFORM'.replace('all', 'instagram,linkedin').split(','),
    'status': 'draft',
    'virality_score': None,
    'created_at': datetime.now(timezone.utc).isoformat(),
    'scheduled_at': None,
    'published_at': {},
    'published_urls': {},
    'session_dir': '${SESSION_DIR#$(pwd)/}',
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

## 9. Publish (conditional)

Runs only if `--auto-publish` was present. Parse the value as `$AUTO_PUBLISH`.

```bash
python3 scripts/publish.py \
  --session-dir "$SESSION_DIR" \
  --platform "$AUTO_PUBLISH"
```

If publish ran, append result to done report.

## 10. Done

Report to user:
```
✓ /make-post complete
Folder: $SESSION_DIR
Images: $SESSION_DIR/image.png (master), image-instagram.png, image-linkedin.png
Caption: $SESSION_DIR/post.md
[if --auto-publish] Published: $AUTO_PUBLISH
```

## Deliberation Rules

Claude must always:
- Justify the photo approach decision (reference vs description)
- Construct the GPT-image-2 prompt explicitly — show it to the user before calling the script
- Verify image outputs exist after generation

Claude must never:
- Skip the photo approach decision
- Use manual Pillow text rendering — all text overlays are baked into the GPT-image-2 prompt
- Generate images when `--platform x` is the only platform
- Ask more than one clarifying question before proceeding
