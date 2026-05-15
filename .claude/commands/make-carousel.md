---
description: Generate a 5–6 slide carousel (images + caption) ready to post on Instagram or LinkedIn.
argument-hint: "<point|url|github-repo> [--platform instagram|linkedin] [--slides 5|6] [--auto|--preview|--manual]"
allowed-tools: Bash, Read, Write, WebFetch, WebSearch
---

# /make-carousel Pipeline

Orchestrate the carousel creation pipeline below. Work sequentially. Stop and report clearly if any stage fails. Never skip a stage unless it is explicitly marked conditional.

## 0. Parse Arguments & Load Environment

Parse `$ARGUMENTS`:
- `<input>` — everything before any `--` flags (required); can be plain text, HTTP URL, or GitHub repo URL
- `--platform` — default from config (→ 1080×1080 for instagram, 1080×1350 for linkedin)
- `--slides` — default from config; must be `5` or `6`. If any other value is provided, stop with: `[ERROR] --slides must be 5 or 6`
- mode flag — `--preview`, `--auto`, or `--manual` — default from config. If multiple mode flags are present, use the most restrictive: `--manual` > `--preview` > `--auto`
- `--auto-publish instagram|linkedin|all` — optional; if present, publish after pipeline completes. Parse the value that follows `--auto-publish` as `$AUTO_PUBLISH`.
- `--from-angle <path>` — optional; path to a vault angle file. Skips Stage 1 (Research). The angle's talking_points seed the slide plan.

If `--from-angle` is set, `<input>` is not required (topic comes from the angle file).

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
config = load_config('make_carousel')
print(json.dumps(config))
"
```

Parse the JSON output into `$CONFIG`. Flag values from arguments override config:
- `--platform` overrides `config.platform` (default from config or global)
- `--slides` overrides `config.slides`
- mode flags (`--preview`, `--auto`, `--manual`) override `config.mode`
- `--auto-publish` overrides `config.auto_publish`

## 1. Create Session Folder

Create the carousel session directory directly (do not use `create_session.py` — it defaults to reels):

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
SESSION_DIR="$(pwd)/vault/outputs/carousels/${TODAY}-${SLUG}"
mkdir -p "$SESSION_DIR"
mkdir -p "$(pwd)/vault/logs"
echo "Session folder: $SESSION_DIR"
```

## 1.3. Load Angle (conditional)

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

Extract `topic`, `contrast`, `talking_points`, and `hook_pattern`. Write the angle body + talking points to `$SESSION_DIR/research.md` as the research output.

Set `$INPUT` from the angle's `topic` field if not already set.

**Skip to Stage 2 (Plan Slides).**

## 2. Stage 1 — Research

**Skip this stage if `--from-angle` is set.**

**If input starts with `https://github.com`:**
- Use `WebFetch` on the repo URL to fetch the README
- Summarize key points and hooks (~300 words)
- Write to `$SESSION_DIR/research.md`

**If input starts with `http` (non-GitHub URL):**
- Use `WebFetch` to fetch the URL
- Summarize key claims and hooks (~300 words)
- Write to `$SESSION_DIR/research.md`

**If input is plain text:**
- Treat the text as the core point
- Write a brief research summary directly to `$SESSION_DIR/research.md`

Log: `✓ Stage 1 complete`

## 1.5. Load Brand Modules

Load brand context from vault. Missing modules warn but do not block.

```bash
VAULT_DIR="$(pwd)/vault"
VAULT_BRAND="$VAULT_DIR/brand/modules/brand.md"
VAULT_STYLE="$VAULT_DIR/brand/modules/style.md"
VAULT_CTA="$VAULT_DIR/brand/modules/cta.md"
VAULT_WATERMARK="$VAULT_DIR/brand/modules/watermark.md"
```

Read each file that exists and inject its content into the slide planning context:
- `brand.md` → colors + font for rendering
- `style.md` → voice and tone guidance for all text (headline copy, caption voice)
- `cta.md` → last-slide CTA text (use the `platforms.<platform>.primary` field for the --platform value, fall back to `default`)
- `watermark.md` → stored for post-render watermark application

For each missing module file, print: `[WARN] vault/brand/modules/<name>.md not found — skipping <name> context`

## 3. Stage 2 — Plan Slides

Read `$SESSION_DIR/research.md`. Deliberate on the narrative arc. Write `$SESSION_DIR/plan.json`.

When planning, always explain:
- The narrative arc (hook → value → CTA)
- Layout choices for any non-`text-only` slide

**Slide structure rules:**
- Slide 1: type `hook`, layout `image-bg-text`
- Last slide: type `cta`, layout `image-bg-text`
- Middle slides: type `value`, layout `text-only` by default
- A middle slide gets `image-split` only when a visual adds clear signal (diagram, before/after) — never on text-heavy slides
- For `--slides 5`: hook + 3 value + CTA
- For `--slides 6`: hook + 4 value + CTA

**Platform dimensions (set from `--platform` flag):**
- `instagram`: set `plan.json`'s `dimensions` to `{ "width": 1080, "height": 1080 }`
- `linkedin`: set `plan.json`'s `dimensions` to `{ "width": 1080, "height": 1350 }`

**Slide count (set from `--slides` flag):**
- For `--slides 5`: produce exactly 5 slides — hook + 3 value + CTA
- For `--slides 6`: produce exactly 6 slides — hook + 4 value + CTA

**plan.json schema:**
```json
{
  "platform": "instagram",
  "dimensions": { "width": 1080, "height": 1080 },
  "slides": [
    { "index": 1, "type": "hook", "headline": "...", "subtext": "...", "layout": "image-bg-text", "image_prompt": "..." },
    { "index": 2, "type": "value", "headline": "...", "body": "...", "layout": "text-only", "image_prompt": null }
  ],
  "post_caption": "Full social post text with hashtags...",
  "slide_captions": ["Slide 1 copy", "Slide 2 copy"]
}
```

Validate: `plan.json` must have at least 3 slides. If fewer, re-plan once. If still invalid after one retry, stop and report.

Log: `✓ Stage 2 complete`

## 4. Stage 2.5 — Plan Gate (mode-dependent)

**`--preview` (default):**
Present the full plan to the user (narrative arc + all slides summary). Wait for approval. Iterate on `plan.json` until the user approves. Only proceed to Stage 3 after explicit approval.

**`--auto`:**
Skip the gate. Proceed directly to render. Exception: if the input was genuinely ambiguous (multiple meaningful angles exist), pause and ask ONE clarifying question before rendering.

**`--manual`:**
Present the full plan. After user approves the arc, step through slide-by-slide: show the plan for slide N → wait for user approval → render slide N → move to N+1.

## 5. Stage 3 — Render

**`--preview` and `--auto` modes (render all at once):**

Check whether vault brand.md exists:

```bash
if [ -f "$VAULT_BRAND" ]; then
  python3 scripts/generate_carousel.py "$SESSION_DIR/plan.json" \
    --out-dir "$SESSION_DIR" \
    --brand "$VAULT_BRAND"
else
  python3 scripts/generate_carousel.py "$SESSION_DIR/plan.json" \
    --out-dir "$SESSION_DIR"
fi
```

**`--manual` mode (render one slide at a time):**

For each slide N, after user approves that slide:

```bash
if [ -f "$VAULT_BRAND" ]; then
  python3 scripts/generate_carousel.py "$SESSION_DIR/plan.json" \
    --out-dir "$SESSION_DIR" \
    --brand "$VAULT_BRAND" \
    --slide N
else
  python3 scripts/generate_carousel.py "$SESSION_DIR/plan.json" \
    --out-dir "$SESSION_DIR" \
    --slide N
fi
```

After all slides are rendered in `--manual` mode, write `$SESSION_DIR/caption.md` from `plan.json`'s `post_caption` and `slide_captions` fields using this exact format:

```
[POST CAPTION]
<post_caption from plan.json>

---
[SLIDE COPY]
1: <slide 1 headline + subtext>
2: <slide 2 headline + body>
...
```

The separator between headline and body/subtext within a slide entry is `" | "` (space-pipe-space).

Log: `✓ Stage 3 complete`

## 5.5. Log Pipeline Run

```bash
LOG_FILE="$(pwd)/vault/logs/pipeline-log.md"
TIMESTAMP=$(date "+%Y-%m-%d %H:%M")
BRAND_VERSION=$(python3 -c "
import yaml, sys
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

## $TIMESTAMP — make-carousel
- topic: $INPUT
- slides: $SLIDE_COUNT
- platform: $PLATFORM
- brand: $BRAND_VERSION
- output: $SESSION_DIR
EOF
```

## 5.6. Register Content

```bash
python3 -c "
from scripts.registry import Registry, compute_virality_score
from datetime import datetime, timezone
import json

entry = {
    'id': '$(basename $SESSION_DIR)',
    'type': 'carousel',
    'topic': $(python3 -c "import json; print(json.dumps('$INPUT'))"),
    'source_url': $(python3 -c "
import json
inp = '$INPUT'
print(json.dumps(inp if inp.startswith('http') else None))
"),
    'platforms': ['$PLATFORM'],
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

## 5.7. Stage 6 — Publish (conditional)

Runs only if `--auto-publish` was present in `$ARGUMENTS`. Parse the value that follows `--auto-publish` as `$AUTO_PUBLISH`.

If `$AUTO_PUBLISH` is set, run:

```bash
python3 scripts/publish.py \
  --session-dir "$SESSION_DIR" \
  --platform "$AUTO_PUBLISH"
```

If the publish step ran, append a `Published:` line to the done report.

## 6. Done

Report to user:
```
✓ /make-carousel complete
Folder: $SESSION_DIR
Slides: $SESSION_DIR/1.png … N.png
Caption: $SESSION_DIR/caption.md
[if --auto-publish was set] Published: $AUTO_PUBLISH
```

## Deliberation Rules (all modes)

Claude must always:
- Justify layout choices — briefly explain why a slide got `image-split` vs `text-only`
- Flag ambiguity before acting — if the input supports two meaningfully different angles, surface them (even in `--auto`)
- Reason about the arc — explain the narrative arc when presenting a plan

Claude must never:
- Ask questions it can answer through research or reasonable judgment
- Render images before the plan gate is passed (in `--preview` and `--manual` modes)
- Produce more than one clarifying question per pause point
