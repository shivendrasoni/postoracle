# make-carousel Design Spec

**Date:** 2026-05-04
**Status:** Approved

---

## Overview

Two new commands:

- `/make-carousel` — takes a point, URL, or GitHub repo and produces a 5–6 slide carousel (images + caption) ready to post
- `/carousel-brand` — one-time brand setup: saves brand colors (and placeholder fields) to `CAROUSEL-BRAND.json`

---

## Command Interface

### `/make-carousel`

```
/make-carousel <point|url|github-repo> [--platform instagram|linkedin] [--slides 5|6] [--auto|--preview|--manual]
```

| Argument | Default | Notes |
|---|---|---|
| `<input>` | required | Plain text point, HTTP URL, or GitHub repo URL |
| `--platform` | `instagram` | `instagram` → 1080×1080; `linkedin` → 1080×1350 |
| `--slides` | `5` | 5 = hook + 3 value + CTA; 6 adds one extra value slide |
| mode flag | `--preview` | Controls how much Claude deliberates vs executes autonomously (see Agent Modes) |

---

## Agent Modes

The mode flag controls the deliberation/autonomy tradeoff. `--preview` is the default because it prevents wasted image-generation credits on a plan the user would have changed immediately.

| Mode | Flag | Default | Behaviour |
|---|---|---|---|
| Preview | `--preview` (or no flag) | Yes | Claude researches and writes a full `plan.json`, then **presents the plan and waits for approval** before rendering any images. User can approve, request changes, or redirect. Claude iterates on the plan until approved. |
| Auto | `--auto` | No | Claude researches, plans, and renders in one uninterrupted pass. Claude may still pause to ask **one question** if the input is genuinely ambiguous (e.g. a URL with multiple possible angles) — but never asks about things it can reasonably decide itself. |
| Manual | `--manual` | No | Claude generates and presents the **full plan upfront** (so the user has context across all slides), then steps through slide-by-slide: shows the plan for slide N → user approves or edits → renders slide N → moves to N+1. Maximum control. |

### Deliberation rules (all modes)

Claude must always:
- **Justify layout choices** — briefly explain why a slide got `image-split` vs `text-only`
- **Flag ambiguity before acting** — if the input supports two meaningfully different angles, surface them rather than picking silently (even in `--auto` mode)
- **Reason about the arc** — the hook, value progression, and CTA should form a coherent narrative. Claude should explain the narrative arc when presenting a plan.

Claude must never:
- Ask questions it can answer through research or reasonable judgment
- Render images before the plan gate is passed (in `--preview` and `--manual` modes)
- Produce more than one clarifying question per pause point

---

### `/carousel-brand`

```
/carousel-brand
```

Interactive — prompts for hex codes inline OR a local file path / URL to a brand image. No flags needed.

---

## Pipeline Stages (`/make-carousel`)

### Stage 0 — Parse & Validate
- Parse `$ARGUMENTS` for input, `--platform`, `--slides`
- Load `.env` from project root
- Confirm `OPENAI_API_KEY` is set; fail fast with clear message if missing

### Stage 0.5 — Create Session Folder
```bash
SESSION_DIR=$(python3 scripts/create_session.py "$INPUT" --base-dir "$(pwd)/output/carousels")
```
Uses existing `scripts/create_session.py`. Output: `output/carousels/YYYY-MM-DD-<slug>/`.

### Stage 1 — Research
- Input starts with `http` and is a GitHub repo URL → fetch README + key files via WebFetch
- Input starts with `http` (non-GitHub) → WebFetch the URL, summarize key claims and hooks (~300 words)
- Input is plain text → treat as the core point directly, no fetch needed
- Write `$SESSION_DIR/research.md`

### Stage 2 — Plan Slides
Claude reads `research.md`, deliberates on the narrative arc, and writes `$SESSION_DIR/plan.json`.

When presenting the plan, Claude always explains:
- The narrative arc (how hook → value slides → CTA form a coherent story)
- Layout choices for any slide that isn't `text-only` (brief justification)

**Slide structure rules:**
- Slide 1 is always `hook` type with `image-bg-text` layout
- Last slide is always `cta` type with `image-bg-text` layout
- Middle slides are `value` type; layout is `text-only` by default
- Middle slide gets `image-split` layout only when a visual adds clear signal (e.g., a framework diagram, a before/after, a concept illustration) — never on text-heavy slides

**`plan.json` schema:**
```json
{
  "platform": "instagram",
  "dimensions": { "width": 1080, "height": 1080 },
  "slides": [
    {
      "index": 1,
      "type": "hook",
      "headline": "...",
      "subtext": "...",
      "layout": "image-bg-text",
      "image_prompt": "..."
    },
    {
      "index": 2,
      "type": "value",
      "headline": "...",
      "body": "...",
      "layout": "text-only",
      "image_prompt": null
    }
  ],
  "post_caption": "Full social post text with hashtags...",
  "slide_captions": ["Slide 1 copy", "Slide 2 copy"]
}
```

### Stage 2.5 — Plan Gate (mode-dependent)

| Mode | Behaviour at this gate |
|---|---|
| `--preview` | Present full plan to user. Wait for approval. Iterate on `plan.json` until approved. Only then proceed to render. |
| `--auto` | Skip gate. Proceed directly to render. (Exception: pause here if input was genuinely ambiguous and no clarifying question was asked yet.) |
| `--manual` | Present full plan to user. After approval of the overall arc, step through slide-by-slide: show slide N plan → approve → render N → next. |

### Stage 3 — Render

**`--preview` / `--auto`:** render all slides in one pass:
```bash
python3 scripts/generate_carousel.py "$SESSION_DIR/plan.json" \
  --out-dir "$SESSION_DIR" \
  --brand "$(pwd)/CAROUSEL-BRAND.json"
```

**`--manual`:** render one slide at a time, prompting between each:
```bash
python3 scripts/generate_carousel.py "$SESSION_DIR/plan.json" \
  --out-dir "$SESSION_DIR" \
  --brand "$(pwd)/CAROUSEL-BRAND.json" \
  --slide N
```

Produces `1.png`, `2.png`, … and `caption.txt` in `$SESSION_DIR`.

### Stage 4 — Done
Report:
```
✓ /make-carousel complete
Folder: $SESSION_DIR
Slides: $SESSION_DIR/1.png … N.png
Caption: $SESSION_DIR/caption.txt
```

---

## Output Structure

```
output/carousels/YYYY-MM-DD-<slug>/
  1.png
  2.png
  3.png
  4.png
  5.png          (if --slides 6, also 6.png)
  caption.txt
  plan.json
  research.md
```

### `caption.txt` format (plain text, no markdown)
```
[POST CAPTION]
<full post caption with hashtags>

---
[SLIDE COPY]
1: <slide 1 headline + subtext>
2: <slide 2 headline + body>
...
```

---

## Rendering Logic (`scripts/generate_carousel.py`)

### Layouts

**`image-bg-text`** (hook, CTA):
1. Generate image via gpt-image-2 at platform size
2. Pillow: draw semi-transparent dark overlay (60% opacity) over full image
3. Pillow: render headline (large, bold, centered) + subtext (medium, centered) over overlay

**`image-split`** (value slide with strong visual use-case):
1. Generate image via gpt-image-2 at `1024×1024` (square); Pillow crops/scales to fill left half of canvas
2. Pillow: place image on left half; right half = brand background color
3. Render headline + body text on right half with padding
4. Only used when `image_prompt` is non-null; never on text-heavy slides

**`text-only`** (most value slides):
1. Pure Pillow — no AI image call
2. Brand `background` color fill
3. Accent color bar (top or left edge, 8px) for visual rhythm
4. Headline: large bold, brand `text` color
5. Body: medium weight, brand `text` color at 80% opacity
6. Generous padding (min 80px all sides)

### Image sizes sent to gpt-image-2

| Platform | gpt-image-2 size | Output canvas |
|---|---|---|
| instagram | `1024×1024` | 1080×1080 (upscaled) |
| linkedin | `1024×1536` | 1080×1350 (cropped/padded) |

### Brand fallback palette (when `CAROUSEL-BRAND.json` absent)
```json
{
  "primary":    "#1A1A2E",
  "secondary":  "#16213E",
  "accent":     "#E94560",
  "background": "#0F3460",
  "text":       "#FFFFFF"
}
```

### CLI signature
```
generate_carousel.py <plan_json> --out-dir <dir> [--brand <path>] [--slide N]
```
`--slide N` renders only slide N (used by `--manual` mode). Omit to render all slides.

---

## Brand Setup (`/carousel-brand` + `scripts/carousel_brand.py`)

### Command flow
1. Prompt user: provide hex codes inline OR a file path / URL to a brand image
2. If hex codes: parse and map to the 5 color roles
3. If image path/URL:
   - Download if URL (requests)
   - Extract 5 dominant colors with `colorthief`
   - Present extracted colors to user with role assignments; user can accept or override
4. Save `CAROUSEL-BRAND.json` at project root

### `CAROUSEL-BRAND.json` schema
```json
{
  "colors": {
    "primary":    "#hex",
    "secondary":  "#hex",
    "accent":     "#hex",
    "background": "#hex",
    "text":       "#hex"
  },
  "font": null,
  "logo_path": null,
  "voice_tone": null
}
```

`font`, `logo_path`, `voice_tone` are placeholders for future brand setup expansion — left `null` for now.

---

## New Files

| File | Purpose |
|---|---|
| `.claude/commands/make-carousel.md` | Command orchestration |
| `.claude/commands/carousel-brand.md` | Brand setup command |
| `scripts/generate_carousel.py` | Slide renderer (Pillow + gpt-image-2) |
| `scripts/carousel_brand.py` | Color extraction + CAROUSEL-BRAND.json writer |
| `tests/test_generate_carousel.py` | Unit tests for renderer |
| `tests/test_carousel_brand.py` | Unit tests for brand setup |

---

## Dependencies

New packages needed (add to `requirements.txt`):
- `Pillow>=10.0.0` — image composition and text rendering
- `colorthief>=0.2.1` — dominant color extraction from brand images

`openai` and `requests` are already in `requirements.txt`.

---

## Error Handling

| Condition | Behavior |
|---|---|
| `OPENAI_API_KEY` missing | Fail at stage 0 with clear message |
| gpt-image-2 call fails for a slide | Log warning, fall back to `text-only` layout for that slide |
| Research URL unreachable | Fail at stage 1, report URL and status code |
| `plan.json` has fewer than 3 slides | Fail at stage 3, ask Claude to re-plan |
| `CAROUSEL-BRAND.json` missing | Use fallback palette silently, no error |
| colorthief fails on image | Ask user to enter hex codes manually instead |
