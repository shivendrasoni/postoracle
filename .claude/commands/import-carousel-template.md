---
description: Import a carousel template from a screenshot
---

# /import-carousel-template

Import a carousel style from a screenshot. Analyzes the image and generates a template YAML.

## Input

$ARGUMENTS — path to a screenshot image (local file path or URL)

## Pipeline

### Step 1: Validate input

Confirm the image path exists (or URL is reachable). Read the image to verify it's a valid image file.

### Step 2: Analyze the screenshot

Look at the screenshot carefully and extract these visual properties:

**Colors:**
- `background_start` — the primary background color (or gradient start)
- `background_end` — gradient end color (same as start if solid)
- `accent` — the accent/highlight color used for bars, dividers, or emphasis
- `text_primary` — headline text color
- `text_secondary` — body/subtext color
- `safe_zone` — border color (usually matches background)

**Typography:**
- Headline style: sans-serif-bold, serif-bold, sans-serif-regular, etc.
- Headline size: 60-90 range (default 78)
- Text case: none, uppercase, title-case
- Body style and size (default 36)
- Slide counter: visible or hidden, position

**Layout:**
- Which of these 3 layouts does it best match?
  - `text-only` — gradient background, accent bars, headline + body text
  - `image-bg-text` — full-bleed image with text overlay
  - `image-split` — image on one side, text on other
- Text alignment: left or center

**Spacing:**
- Safe zone padding: tight (40-60), normal (80), airy (100-120)
- Content padding: tight (60), normal (90), airy (120)
- Element gap between sections

**Accents:**
- Left accent bar: present? width in px (0 to disable)
- Top accent bar: present? height in px (0 to disable)
- Divider between headline and body: present? width and height
- All accent colors default to "accent" (the extracted accent color)

**Overlay (for image layouts):**
- Alpha darkness: light (100), medium (150), heavy (200)
- Gradient direction: bottom (dark at bottom), top, or uniform

### Step 3: Generate template YAML

Write the extracted values to `vault/brand/templates/active.yaml`:

```yaml
name: "<descriptive-slug>"
source: "imported from screenshot"
created_at: "<today's date>"

colors:
  background_start: "<hex>"
  background_end: "<hex>"
  accent: "<hex>"
  text_primary: "<hex>"
  text_secondary: "<hex>"
  safe_zone: "<hex>"

typography:
  headline:
    style: "<style>"
    size: <px>
    case: "<case>"
  body:
    style: "<style>"
    size: <px>
  counter:
    style: "sans-serif-regular"
    size: 26
    visible: <true|false>
    position: "<position>"

layout:
  hook_slide: "<layout>"
  value_slide: "<layout>"
  cta_slide: "<layout>"
  text_align: "<alignment>"

spacing:
  safe_zone_padding: <px>
  content_padding_x: <px>
  content_padding_y: <px>
  element_gap: <px>

accents:
  left_bar:
    width: <px>
    color: "accent"
  top_bar:
    height: <px>
    color: "accent"
  divider:
    width: <px>
    height: <px>
    color: "accent"

overlay:
  alpha: <0-255>
  direction: "<direction>"
```

Create the directory `vault/brand/templates/` if it doesn't exist:
```bash
mkdir -p vault/brand/templates
```

### Step 4: Confirm

Print a summary:
- Template name
- Key colors (show hex values)
- Layout type detected
- Typography style

Tell the user: "Template saved. Your next `/make-carousel` will use this style. Preview it at the Brand page in the dashboard."
