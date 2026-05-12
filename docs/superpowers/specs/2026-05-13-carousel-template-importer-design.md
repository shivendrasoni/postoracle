# Carousel Template Importer

Screenshot in → AI extracts style + layout → one active template → all future carousels match it.

## Template Schema

Stored at `vault/brand/templates/active.yaml`. Every value currently hardcoded in `generate_carousel.py` becomes configurable. Missing fields fall back to current defaults.

```yaml
name: "minimal-dark"
source: "imported from screenshot"
created_at: "2026-05-13"

colors:
  background_start: "#0D0D0D"
  background_end: "#1A1A1A"
  accent: "#C5F135"
  text_primary: "#FFFFFF"
  text_secondary: "#B0B0B0"
  safe_zone: "#0D0D0D"

typography:
  headline:
    style: "sans-serif-bold"    # sans-serif, serif, mono + weight
    size: 78
    case: "none"                # none, uppercase, title-case
  body:
    style: "sans-serif-regular"
    size: 36
  counter:
    style: "sans-serif-regular"
    size: 26
    visible: true
    position: "bottom-right"

layout:
  hook_slide: "image-bg-text"
  value_slide: "text-only"
  cta_slide: "image-bg-text"
  text_align: "left"

spacing:
  safe_zone_padding: 80
  content_padding_x: 90
  content_padding_y: 120
  element_gap: 24

accents:
  left_bar:
    width: 8
    color: "accent"
  top_bar:
    height: 12
    color: "accent"
  divider:
    width: 80
    height: 4
    color: "accent"

overlay:
  alpha: 150
  direction: "bottom"
```

## Import Pipeline

### Command: `/import-carousel-template <screenshot_path>`

1. User provides a local image path or URL of a carousel they like
2. Claude vision analyzes the screenshot and extracts:
   - Color palette (background, text, accent — sampled from visible elements)
   - Typography style (serif/sans, weight, relative sizing, case)
   - Layout pattern (mapped to existing layout types: text-only, image-bg-text, image-split)
   - Spacing feel (tight/normal/airy → mapped to px values)
   - Accent elements (bars, dividers, borders, counters — present or absent)
   - Overlay treatment (darkness, gradient direction for image layouts)
3. Generates the YAML template and saves to `vault/brand/templates/active.yaml`
4. Prints a summary of extracted values to the terminal

No external API needed — Claude vision handles the analysis directly during the command conversation.

### Fallback defaults

If the AI can't confidently determine a value, the schema fills it with the current hardcoded defaults from `generate_carousel.py`. A partial extraction still produces a working template.

## Renderer Changes

### `generate_carousel.py`

1. **New function: `load_template()`** — reads `vault/brand/templates/active.yaml`, returns a dict. Falls back to a dict of current hardcoded values if the file doesn't exist.
2. **Replace constants** — every hardcoded style value (colors, font sizes, spacing, accent dimensions, overlay alpha) reads from the template dict instead of module-level constants.
3. **Backward compatible** — no `active.yaml` = identical behavior to today. Zero breaking changes.

No new layout types. The 3 existing layouts (`text-only`, `image-bg-text`, `image-split`) remain. The template controls their visual parameters, not their structural logic.

### Template resolution order

1. `vault/brand/templates/active.yaml` (user-imported template)
2. Hardcoded defaults in `generate_carousel.py` (current behavior)

## Dashboard Integration

### Brand page — "Active Template" section

A small preview section added to the existing Brand page (`dashboard/app/brand/page.tsx`). Not a separate page.

**Contents:**
- Sample slide rendered with the active template values (CSS mockup of a text-only slide)
- Color palette strip (4-5 swatches: background, accent, text primary, text secondary)
- Template name and import date

**Data source:** New API route `dashboard/app/api/template/route.ts` that reads `vault/brand/templates/active.yaml` and returns JSON. Returns 404 if no template exists — the section hides itself.

## File Changes

| File | Change |
|------|--------|
| `.claude/commands/import-carousel-template.md` | New command definition |
| `scripts/generate_carousel.py` | Add `load_template()`, replace hardcoded constants |
| `tests/test_generate_carousel.py` | Add template loading tests |
| `dashboard/app/api/template/route.ts` | New API route for template data |
| `dashboard/app/brand/page.tsx` | Add template preview section |

## Out of Scope

- No visual template editor — import only, "close enough" precision
- No template library — one active template at a time
- No per-platform templates — same template for Instagram and LinkedIn
- No new layout types — only the 3 existing layouts are configurable
