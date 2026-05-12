# Carousel Template Importer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users screenshot an Instagram carousel they like, import it via `/import-carousel-template`, and have all future carousels rendered in that style.

**Architecture:** `load_template()` reads `vault/brand/templates/active.yaml` and returns a dict with all styling values (colors, typography, spacing, accents, overlay). Template colors merge into the existing brand dict; spacing/accent/typography values replace hardcoded constants via a `_t()` helper. The Claude Code command instructs Claude vision to analyze a screenshot and write the YAML. A dashboard section on the Brand page previews the active template.

**Tech Stack:** Python (PIL, PyYAML), Next.js (React Server Components, Tailwind), Claude Code commands (markdown)

---

## File Structure

| File | Responsibility |
|------|---------------|
| `scripts/generate_carousel.py` | Template loader (`load_template`, `_t`), modified render functions |
| `tests/test_generate_carousel.py` | Tests for template loading and template-aware rendering |
| `.claude/commands/import-carousel-template.md` | Claude Code command definition |
| `dashboard/app/api/template/route.ts` | API route serving active template as JSON |
| `dashboard/app/brand/page.tsx` | Template preview section added to Brand page |
| `dashboard/lib/types.ts` | `CarouselTemplate` TypeScript interface |

---

### Task 1: Template Loader

**Files:**
- Modify: `scripts/generate_carousel.py:1-68` (constants section + new functions)
- Test: `tests/test_generate_carousel.py`

- [ ] **Step 1: Write failing tests for `load_template` and `_t`**

Add to `tests/test_generate_carousel.py`:

```python
from scripts.generate_carousel import load_template, _t, DEFAULT_TEMPLATE


def test_load_template_returns_none_when_no_file(tmp_path):
    result = load_template(str(tmp_path / "nonexistent"))
    assert result is None


def test_load_template_returns_none_when_vault_root_is_none():
    result = load_template(None)
    assert result is None


def test_load_template_reads_yaml(tmp_path):
    templates_dir = tmp_path / "brand" / "templates"
    templates_dir.mkdir(parents=True)
    (templates_dir / "active.yaml").write_text(
        "name: test-template\ncolors:\n  accent: \"#FF0000\"\nspacing:\n  safe_zone_padding: 40\n",
        encoding="utf-8",
    )
    result = load_template(str(tmp_path))
    assert result is not None
    assert result["name"] == "test-template"
    assert result["colors"]["accent"] == "#FF0000"
    assert result["spacing"]["safe_zone_padding"] == 40
    # Unspecified values fall back to defaults
    assert result["colors"]["background_start"] == DEFAULT_TEMPLATE["colors"]["background_start"]
    assert result["typography"] == DEFAULT_TEMPLATE["typography"]


def test_load_template_handles_malformed_yaml(tmp_path):
    templates_dir = tmp_path / "brand" / "templates"
    templates_dir.mkdir(parents=True)
    (templates_dir / "active.yaml").write_text(":::not yaml:::", encoding="utf-8")
    result = load_template(str(tmp_path))
    assert result is None


def test_t_navigates_nested_dict():
    d = {"a": {"b": {"c": 42}}}
    assert _t(d, "a", "b", "c", default=0) == 42


def test_t_returns_default_on_missing_key():
    d = {"a": {"b": 1}}
    assert _t(d, "a", "x", default=99) == 99


def test_t_returns_default_on_empty_dict():
    assert _t({}, "a", "b", default=5) == 5


def test_t_returns_default_on_none_template():
    assert _t(None, "a", "b", default=42) == 42
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest tests/test_generate_carousel.py::test_load_template_returns_defaults_when_no_file -v`
Expected: FAIL with `ImportError: cannot import name 'load_template'`

- [ ] **Step 3: Implement `DEFAULT_TEMPLATE`, `_t`, and `load_template`**

Add to `scripts/generate_carousel.py` after the existing constants block (after line 66):

```python
# ---------------------------------------------------------------------------
# Template system
# ---------------------------------------------------------------------------

DEFAULT_TEMPLATE: dict = {
    "name": "default",
    "source": "built-in",
    "created_at": "",
    "colors": {
        "background_start": FALLBACK_PALETTE["primary"],
        "background_end": FALLBACK_PALETTE["secondary"],
        "accent": FALLBACK_PALETTE["accent"],
        "text_primary": FALLBACK_PALETTE["text"],
        "safe_zone": FALLBACK_PALETTE["primary"],
    },
    "typography": {
        "headline": {"style": "sans-serif-bold", "size": FONT_SIZE_HEADLINE, "case": "none"},
        "body": {"style": "sans-serif-regular", "size": FONT_SIZE_BODY},
        "counter": {"style": "sans-serif-regular", "size": FONT_SIZE_SLIDE_NUM, "visible": True, "position": "bottom-right"},
    },
    "layout": {
        "hook_slide": "image-bg-text",
        "value_slide": "text-only",
        "cta_slide": "image-bg-text",
        "text_align": "left",
    },
    "spacing": {
        "safe_zone_padding": SQUARE_SAFE_PAD,
        "content_padding_x": PAD_X,
        "content_padding_y": PAD_Y,
        "element_gap": GAP_PARA,
    },
    "accents": {
        "left_bar": {"width": ACCENT_LEFT_W, "color": "accent"},
        "top_bar": {"height": ACCENT_TOP_H, "color": "accent"},
        "divider": {"width": DIVIDER_W, "height": DIVIDER_H, "color": "accent"},
    },
    "overlay": {
        "alpha": OVERLAY_ALPHA,
        "direction": "bottom",
    },
}


def _t(template: Optional[dict], *keys, default):
    """Navigate nested template dict, return default if template is None or any key missing."""
    if template is None:
        return default
    val = template
    for key in keys:
        if isinstance(val, dict):
            val = val.get(key)
        else:
            return default
    return val if val is not None else default


def _deep_merge(base: dict, override: dict) -> dict:
    """Recursively merge override into a copy of base."""
    import copy
    result = copy.deepcopy(base)
    for key, value in override.items():
        if key in result and isinstance(result[key], dict) and isinstance(value, dict):
            result[key] = _deep_merge(result[key], value)
        else:
            result[key] = value
    return result


def load_template(vault_root: Optional[str] = None) -> Optional[dict]:
    """Load active carousel template from vault. Returns None if no template exists."""
    if not vault_root:
        return None
    template_path = Path(vault_root) / "brand" / "templates" / "active.yaml"
    if not template_path.exists():
        return None
    try:
        import yaml
        raw = yaml.safe_load(template_path.read_text(encoding="utf-8")) or {}
        return _deep_merge(DEFAULT_TEMPLATE, raw)
    except Exception as e:
        print(f"[WARNING] Failed to load template: {e}", file=sys.stderr)
        return None
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest tests/test_generate_carousel.py -k "test_load_template or test_t_" -v`
Expected: All 7 new tests PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/generate_carousel.py tests/test_generate_carousel.py
git commit -m "feat: add template loader (load_template, _t, DEFAULT_TEMPLATE)"
```

---

### Task 2: Wire Template into Text-Only Renderer

**Files:**
- Modify: `scripts/generate_carousel.py:235-301` (`_render_text_only`)
- Test: `tests/test_generate_carousel.py`

- [ ] **Step 1: Write failing test for template-aware text-only rendering**

Add to `tests/test_generate_carousel.py`:

```python
from scripts.generate_carousel import DEFAULT_TEMPLATE, _deep_merge


def test_render_slide_text_only_uses_template_colors(tmp_path):
    """When a template specifies a different safe_zone color, the border pixels change."""
    slide = {
        "index": 2, "type": "value",
        "headline": "Template Test", "body": "Body text",
        "layout": "text-only", "image_prompt": None,
    }
    custom_template = _deep_merge(DEFAULT_TEMPLATE, {
        "colors": {
            "background_start": "#FF0000",
            "safe_zone": "#FF0000",
        },
    })
    out_path = tmp_path / "2.png"
    brand = dict(FALLBACK_PALETTE)
    render_slide(slide, out_path, {"width": 1080, "height": 1080}, brand,
                 template=custom_template)
    img = Image.open(out_path)
    # Border should be red (#FF0000) not default primary
    assert img.getpixel((0, 0)) == (255, 0, 0)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_generate_carousel.py::test_render_slide_text_only_uses_template_colors -v`
Expected: FAIL — `render_slide() got an unexpected keyword argument 'template'`

- [ ] **Step 3: Add `template` parameter to `_render_text_only` and `render_slide`, replace constants**

Modify `_render_text_only` signature and body in `scripts/generate_carousel.py`:

```python
def _render_text_only(slide: dict, dimensions: tuple, brand: dict,
                      slide_index: int = None, slide_total: int = None,
                      template: Optional[dict] = None) -> Image.Image:
    tmpl = template or DEFAULT_TEMPLATE
    width, height = dimensions
    primary = _hex_to_rgb(brand.get("primary", FALLBACK_PALETTE["primary"]))
    secondary = _hex_to_rgb(brand.get("secondary", FALLBACK_PALETTE["secondary"]))
    accent = _hex_to_rgb(brand.get("accent", FALLBACK_PALETTE["accent"]))
    text_color = _hex_to_rgb(brand["text"])
    body_color = _hex_to_rgb(_t(tmpl, "colors", "text_secondary", default="#C8C8DC"))

    canvas = Image.new("RGB", (width, height))
    _fill_gradient(canvas, primary, secondary)
    draw = ImageDraw.Draw(canvas)

    accent_top_h = _t(tmpl, "accents", "top_bar", "height", default=ACCENT_TOP_H)
    accent_left_w = _t(tmpl, "accents", "left_bar", "width", default=ACCENT_LEFT_W)
    pad_x = _t(tmpl, "spacing", "content_padding_x", default=PAD_X)
    pad_y = _t(tmpl, "spacing", "content_padding_y", default=PAD_Y)
    divider_w = _t(tmpl, "accents", "divider", "width", default=DIVIDER_W)
    divider_h = _t(tmpl, "accents", "divider", "height", default=DIVIDER_H)
    hl_size = _t(tmpl, "typography", "headline", "size", default=FONT_SIZE_HEADLINE)
    bd_size = _t(tmpl, "typography", "body", "size", default=FONT_SIZE_BODY)
    ctr_size = _t(tmpl, "typography", "counter", "size", default=FONT_SIZE_SLIDE_NUM)
    ctr_visible = _t(tmpl, "typography", "counter", "visible", default=True)

    # Top accent bar
    draw.rectangle([0, 0, width, accent_top_h], fill=accent)
    # Left accent bar
    draw.rectangle([0, 0, accent_left_w, height], fill=accent)

    text_x = accent_left_w + pad_x
    max_w = width - text_x - pad_x

    headline = slide.get("headline", "")
    body = slide.get("body") or slide.get("subtext", "")

    hl_font = _load_font(hl_size, bold=True)
    bd_font = _load_font(bd_size, bold=False)
    num_font = _load_font(ctr_size, bold=False)

    y = pad_y + accent_top_h

    if headline:
        hl_lines = _wrap_text(draw, headline, hl_font, max_w)
        y = _draw_lines(draw, hl_lines, text_x, y, hl_font,
                        text_color, GAP_HL_LINE, GAP_PARA)

    y += GAP_HL_TO_DIV
    draw.rectangle([text_x, y, text_x + divider_w, y + divider_h], fill=accent)
    y += divider_h + GAP_DIV_TO_BD

    if body:
        bd_lines = _wrap_text(draw, body, bd_font, max_w)
        _draw_lines(draw, bd_lines, text_x, y, bd_font,
                    body_color, GAP_BD_LINE, GAP_PARA)

    if ctr_visible and slide_index is not None and slide_total is not None:
        num_text = f"{slide_index:02d}  /  {slide_total:02d}"
        nbbox = draw.textbbox((0, 0), num_text, font=num_font)
        nw = nbbox[2] - nbbox[0]
        nh = nbbox[3] - nbbox[1]
        draw.text(
            (width - pad_x - nw, height - PAD_BOTTOM - nh),
            num_text, font=num_font, fill=accent,
        )

    return canvas
```

Update the call in `render_slide` to pass `template` through. Modify `render_slide` signature:

```python
def render_slide(slide: dict, out_path: Path, dimensions: dict, brand: dict,
                 api_key: Optional[str] = None,
                 slide_index: int = None, slide_total: int = None,
                 template: Optional[dict] = None) -> Path:
    tmpl = template or DEFAULT_TEMPLATE
    width = dimensions.get("width", DEFAULT_CANVAS_WIDTH)
    height = dimensions.get("height", DEFAULT_CANVAS_WIDTH)
    safe_pad = _t(tmpl, "spacing", "safe_zone_padding", default=SQUARE_SAFE_PAD)
    inner_w = width - 2 * safe_pad
    inner_h = height - 2 * safe_pad
    canvas_size = (inner_w, inner_h)

    layout = slide.get("layout", "text-only")
    image_prompt = slide.get("image_prompt")
    api_size = PLATFORM_IMAGE_SIZE["linkedin"] if height > width else DEFAULT_IMAGE_SIZE

    try:
        if layout == "text-only" or not image_prompt:
            img = _render_text_only(slide, canvas_size, brand, slide_index, slide_total, template=tmpl)
        elif layout == "image-bg-text":
            img = _render_image_bg_text(slide, canvas_size, brand, api_size, api_key,
                                         slide_index, slide_total)
        elif layout == "image-split":
            img = _render_image_split(slide, canvas_size, brand, api_key,
                                       slide_index, slide_total)
        else:
            img = _render_text_only(slide, canvas_size, brand, slide_index, slide_total, template=tmpl)
    except Exception as exc:
        if layout in ("image-bg-text", "image-split"):
            print(
                f"[WARN] gpt-image-2 failed for slide {slide.get('index', '?')}: {exc}; "
                "falling back to text-only",
                file=sys.stderr,
            )
            img = _render_text_only(slide, canvas_size, brand, slide_index, slide_total, template=tmpl)
        else:
            raise

    brand_primary = brand.get("primary", FALLBACK_PALETTE["primary"])
    safe_zone_color = _hex_to_rgb(_t(template, "colors", "safe_zone", default=brand_primary))
    full_canvas = Image.new("RGB", (width, height), safe_zone_color)
    full_canvas.paste(img, (safe_pad, safe_pad))
    img = full_canvas

    out_path.parent.mkdir(parents=True, exist_ok=True)
    img.save(str(out_path), format="PNG")
    return out_path
```

- [ ] **Step 4: Run all tests to verify they pass**

Run: `pytest tests/test_generate_carousel.py -v`
Expected: All tests PASS including the new template color test and all existing tests (backward compat)

- [ ] **Step 5: Commit**

```bash
git add scripts/generate_carousel.py tests/test_generate_carousel.py
git commit -m "feat: wire template into text-only renderer and render_slide"
```

---

### Task 3: Wire Template into Image Renderers

**Files:**
- Modify: `scripts/generate_carousel.py:304-455` (`_render_image_bg_text`, `_render_image_split`)
- Modify: `scripts/generate_carousel.py:458-503` (`render_slide` — pass template to image renderers)

- [ ] **Step 1: Write failing test for template-aware image-bg-text rendering**

Add to `tests/test_generate_carousel.py`:

```python
@patch("scripts.generate_carousel.openai.OpenAI")
def test_render_slide_image_bg_uses_template_overlay(mock_openai_cls, tmp_path):
    """Template overlay alpha changes the image-bg rendering."""
    mock_client = _make_mock_openai()
    mock_openai_cls.return_value = mock_client

    slide = {
        "index": 1, "type": "hook",
        "headline": "Hook", "subtext": "Sub",
        "layout": "image-bg-text", "image_prompt": "test",
    }
    custom_template = _deep_merge(DEFAULT_TEMPLATE, {
        "overlay": {"alpha": 200},
        "colors": {"safe_zone": "#00FF00"},
    })
    out_path = tmp_path / "1.png"
    render_slide(slide, out_path, {"width": 1080, "height": 1080}, FALLBACK_PALETTE,
                 api_key="test", template=custom_template)
    img = Image.open(out_path)
    assert img.size == (1080, 1080)
    # Green safe zone border
    assert img.getpixel((0, 0)) == (0, 255, 0)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_generate_carousel.py::test_render_slide_image_bg_uses_template_overlay -v`
Expected: FAIL — border color is wrong (not using template safe_zone yet for image layouts)

- [ ] **Step 3: Add `template` parameter to `_render_image_bg_text`**

Modify the function signature and replace hardcoded constants:

```python
def _render_image_bg_text(slide: dict, canvas_size: tuple, brand: dict,
                           api_size: str, api_key: Optional[str] = None,
                           slide_index: int = None, slide_total: int = None,
                           template: Optional[dict] = None) -> Image.Image:
    tmpl = template or DEFAULT_TEMPLATE
    width, height = canvas_size
    image_prompt = slide.get("image_prompt", "")

    raw_bytes = _fetch_image(image_prompt, api_size, api_key)
    bg_img = Image.open(BytesIO(raw_bytes)).convert("RGBA")
    bg_img = bg_img.resize((width, height), Image.LANCZOS)

    overlay_alpha = _t(tmpl, "overlay", "alpha", default=OVERLAY_ALPHA)
    base_overlay = Image.new("RGBA", (width, height), (0, 0, 0, overlay_alpha))
    grad_overlay = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    grad_draw = ImageDraw.Draw(grad_overlay)
    fade_start = height // 3
    for y in range(height):
        t = max(0.0, (y - fade_start) / (height - fade_start))
        a = int(min(210, t * 210))
        grad_draw.line([(0, y), (width, y)], fill=(0, 0, 0, a))

    composed = Image.alpha_composite(bg_img, base_overlay)
    composed = Image.alpha_composite(composed, grad_overlay).convert("RGB")
    draw = ImageDraw.Draw(composed)

    text_color = _hex_to_rgb(brand["text"])
    subtext_color = _hex_to_rgb(_t(tmpl, "colors", "text_secondary", default="#DCDCEB"))
    accent = _hex_to_rgb(brand.get("accent", FALLBACK_PALETTE["accent"]))

    headline = slide.get("headline", "")
    subtext = slide.get("subtext") or slide.get("body", "")

    hl_size = _t(tmpl, "typography", "headline", "size", default=FONT_SIZE_HEADLINE_BG)
    st_size = _t(tmpl, "typography", "body", "size", default=FONT_SIZE_SUBTEXT_BG)
    ctr_size = _t(tmpl, "typography", "counter", "size", default=FONT_SIZE_SLIDE_NUM)
    ctr_visible = _t(tmpl, "typography", "counter", "visible", default=True)
    pad_x = _t(tmpl, "spacing", "content_padding_x", default=PAD_X)
    divider_w = _t(tmpl, "accents", "divider", "width", default=DIVIDER_W)
    divider_h = _t(tmpl, "accents", "divider", "height", default=DIVIDER_H)

    hl_font = _load_font(hl_size, bold=True)
    st_font = _load_font(st_size, bold=False)
    num_font = _load_font(ctr_size, bold=False)

    max_w = width - 2 * pad_x

    hl_lines = _wrap_text(draw, headline, hl_font, max_w) if headline else []
    st_lines = _wrap_text(draw, subtext, st_font, max_w) if subtext else []

    hl_h = _lines_height(draw, hl_lines, hl_font, GAP_HL_LINE, GAP_PARA)
    st_h = _lines_height(draw, st_lines, st_font, GAP_BD_LINE, GAP_PARA) if st_lines else 0
    divider_block = divider_h + GAP_HL_TO_DIV + GAP_DIV_TO_BD if (hl_lines and st_lines) else 0
    total_h = hl_h + divider_block + st_h

    bottom_zone_start = int(height * 0.62)
    y = bottom_zone_start + max(0, (height - PAD_BOTTOM - bottom_zone_start - total_h) // 2)

    if hl_lines:
        y = _draw_lines(draw, hl_lines, pad_x, y, hl_font,
                        text_color, GAP_HL_LINE, GAP_PARA,
                        align='center', canvas_width=width)

    if hl_lines and st_lines:
        y += GAP_HL_TO_DIV
        draw.rectangle(
            [(width - divider_w) // 2, y, (width + divider_w) // 2, y + divider_h],
            fill=accent,
        )
        y += divider_h + GAP_DIV_TO_BD

    if st_lines:
        _draw_lines(draw, st_lines, pad_x, y, st_font,
                    subtext_color, GAP_BD_LINE, GAP_PARA,
                    align='center', canvas_width=width)

    if ctr_visible and slide_index is not None and slide_total is not None:
        num_text = f"{slide_index:02d}  /  {slide_total:02d}"
        nbbox = draw.textbbox((0, 0), num_text, font=num_font)
        nw = nbbox[2] - nbbox[0]
        nh = nbbox[3] - nbbox[1]
        draw.text(
            (width - pad_x - nw, height - PAD_BOTTOM - nh),
            num_text, font=num_font, fill=accent,
        )

    return composed
```

- [ ] **Step 4: Add `template` parameter to `_render_image_split`**

```python
def _render_image_split(slide: dict, canvas_size: tuple, brand: dict,
                         api_key: Optional[str] = None,
                         slide_index: int = None, slide_total: int = None,
                         template: Optional[dict] = None) -> Image.Image:
    tmpl = template or DEFAULT_TEMPLATE
    width, height = canvas_size
    half_w = width // 2

    primary = _hex_to_rgb(brand.get("primary", FALLBACK_PALETTE["primary"]))
    secondary = _hex_to_rgb(brand.get("secondary", FALLBACK_PALETTE["secondary"]))
    accent = _hex_to_rgb(brand.get("accent", FALLBACK_PALETTE["accent"]))
    text_color = _hex_to_rgb(brand["text"])
    body_color = _hex_to_rgb(_t(tmpl, "colors", "text_secondary", default="#C8C8DC"))

    accent_left_w = _t(tmpl, "accents", "left_bar", "width", default=ACCENT_LEFT_W)
    divider_w = _t(tmpl, "accents", "divider", "width", default=DIVIDER_W)
    divider_h = _t(tmpl, "accents", "divider", "height", default=DIVIDER_H)
    ctr_size = _t(tmpl, "typography", "counter", "size", default=FONT_SIZE_SLIDE_NUM)
    ctr_visible = _t(tmpl, "typography", "counter", "visible", default=True)
    hl_size = _t(tmpl, "typography", "headline", "size", default=FONT_SIZE_HEADLINE_SPLIT)
    bd_size = _t(tmpl, "typography", "body", "size", default=FONT_SIZE_BODY_SPLIT)

    image_prompt = slide.get("image_prompt", "")
    raw_bytes = _fetch_image(image_prompt, DEFAULT_IMAGE_SIZE, api_key)
    src_img = Image.open(BytesIO(raw_bytes)).convert("RGB")
    left_img = src_img.resize((half_w, height), Image.LANCZOS)

    canvas = Image.new("RGB", (width, height))
    _fill_gradient(canvas, primary, secondary)
    canvas.paste(left_img, (0, 0))

    draw = ImageDraw.Draw(canvas)

    draw.rectangle([half_w, 0, half_w + accent_left_w, height], fill=accent)

    headline = slide.get("headline", "")
    body = slide.get("body") or slide.get("subtext", "")

    hl_font = _load_font(hl_size, bold=True)
    bd_font = _load_font(bd_size, bold=False)
    num_font = _load_font(ctr_size, bold=False)

    right_x = half_w + accent_left_w + PADDING_SPLIT
    max_w = width - right_x - PADDING_SPLIT
    y = height // 5

    if headline:
        hl_lines = _wrap_text(draw, headline, hl_font, max_w)
        y = _draw_lines(draw, hl_lines, right_x, y, hl_font, text_color, GAP_HL_LINE, GAP_PARA)
        y += GAP_HL_TO_DIV
        draw.rectangle([right_x, y, right_x + divider_w, y + divider_h], fill=accent)
        y += divider_h + GAP_DIV_TO_BD

    if body:
        bd_lines = _wrap_text(draw, body, bd_font, max_w)
        _draw_lines(draw, bd_lines, right_x, y, bd_font, body_color, GAP_BD_LINE, GAP_PARA)

    if ctr_visible and slide_index is not None and slide_total is not None:
        num_text = f"{slide_index:02d}  /  {slide_total:02d}"
        nbbox = draw.textbbox((0, 0), num_text, font=num_font)
        nw = nbbox[2] - nbbox[0]
        nh = nbbox[3] - nbbox[1]
        draw.text(
            (width - PADDING_SPLIT - nw, height - PAD_BOTTOM - nh),
            num_text, font=num_font, fill=accent,
        )

    return canvas
```

- [ ] **Step 5: Update `render_slide` to pass template to image renderers**

Update the `try` block inside `render_slide` to pass `template=tmpl` to all render calls:

```python
    try:
        if layout == "text-only" or not image_prompt:
            img = _render_text_only(slide, canvas_size, brand, slide_index, slide_total, template=tmpl)
        elif layout == "image-bg-text":
            img = _render_image_bg_text(slide, canvas_size, brand, api_size, api_key,
                                         slide_index, slide_total, template=tmpl)
        elif layout == "image-split":
            img = _render_image_split(slide, canvas_size, brand, api_key,
                                       slide_index, slide_total, template=tmpl)
        else:
            img = _render_text_only(slide, canvas_size, brand, slide_index, slide_total, template=tmpl)
    except Exception as exc:
        if layout in ("image-bg-text", "image-split"):
            print(
                f"[WARN] gpt-image-2 failed for slide {slide.get('index', '?')}: {exc}; "
                "falling back to text-only",
                file=sys.stderr,
            )
            img = _render_text_only(slide, canvas_size, brand, slide_index, slide_total, template=tmpl)
        else:
            raise
```

- [ ] **Step 6: Run all tests to verify they pass**

Run: `pytest tests/test_generate_carousel.py -v`
Expected: All tests PASS

- [ ] **Step 7: Commit**

```bash
git add scripts/generate_carousel.py tests/test_generate_carousel.py
git commit -m "feat: wire template into image-bg-text and image-split renderers"
```

---

### Task 4: Wire Template into `render_all`

**Files:**
- Modify: `scripts/generate_carousel.py:526-560` (`render_all`)
- Test: `tests/test_generate_carousel.py`

- [ ] **Step 1: Write failing test for `render_all` loading template from vault**

Add to `tests/test_generate_carousel.py`:

```python
@patch("scripts.generate_carousel.openai.OpenAI")
def test_render_all_loads_template_from_vault(mock_openai_cls, tmp_path):
    """render_all uses vault_root to find and apply the active template."""
    mock_client = _make_mock_openai()
    mock_openai_cls.return_value = mock_client

    # Create a template with a distinctive safe_zone color
    vault_root = tmp_path / "vault"
    templates_dir = vault_root / "brand" / "templates"
    templates_dir.mkdir(parents=True)
    (templates_dir / "active.yaml").write_text(
        'colors:\n  safe_zone: "#0000FF"\n',
        encoding="utf-8",
    )

    plan = _make_plan(3)
    # Make all slides text-only to avoid API calls
    for s in plan["slides"]:
        s["layout"] = "text-only"
        s["image_prompt"] = None
    plan_file = _write_plan(tmp_path, plan)
    out_dir = tmp_path / "out"

    render_all(plan_file, out_dir, api_key="test", vault_root=str(vault_root))

    # Check slide 1 has blue border
    img = Image.open(out_dir / "1.png")
    assert img.getpixel((0, 0)) == (0, 0, 255)
```

- [ ] **Step 1b: Write backward-compat test — no template preserves brand colors**

Add to `tests/test_generate_carousel.py`:

```python
def test_render_all_no_template_preserves_brand_colors(tmp_path):
    """Without a template file, brand primary drives the safe_zone border."""
    plan = _make_plan(3)
    for s in plan["slides"]:
        s["layout"] = "text-only"
        s["image_prompt"] = None
    plan_file = _write_plan(tmp_path, plan)
    out_dir = tmp_path / "out"

    # No vault_root means no template — brand colors should be untouched
    render_all(plan_file, out_dir, api_key="test")

    img = Image.open(out_dir / "1.png")
    # Border pixel should be FALLBACK_PALETTE["primary"] (#0F0E2A) = (15, 14, 42)
    assert img.getpixel((0, 0)) == (15, 14, 42)
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest tests/test_generate_carousel.py::test_render_all_loads_template_from_vault tests/test_generate_carousel.py::test_render_all_no_template_preserves_brand_colors -v`
Expected: FAIL — `render_all() got an unexpected keyword argument 'vault_root'`

- [ ] **Step 3: Add `vault_root` parameter to `render_all`**

Modify `render_all` in `scripts/generate_carousel.py`:

```python
def render_all(
    plan_path: Path,
    out_dir: Path,
    brand_path: Optional[str] = None,
    slide_n: Optional[int] = None,
    api_key: Optional[str] = None,
    vault_root: Optional[str] = None,
) -> None:
    with plan_path.open() as f:
        plan = json.load(f)

    slides = plan.get("slides", [])
    if len(slides) < MIN_SLIDES:
        print(f"[ERROR] plan.json must have at least {MIN_SLIDES} slides; found {len(slides)}",
              file=sys.stderr)
        sys.exit(1)

    brand = load_brand(brand_path)
    template = load_template(vault_root)

    # Template colors override brand colors only when a template file exists
    if template is not None:
        tmpl_colors = template.get("colors", {})
        if "background_start" in tmpl_colors:
            brand["primary"] = tmpl_colors["background_start"]
        if "background_end" in tmpl_colors:
            brand["secondary"] = tmpl_colors["background_end"]
        if "accent" in tmpl_colors:
            brand["accent"] = tmpl_colors["accent"]
        if "text_primary" in tmpl_colors:
            brand["text"] = tmpl_colors["text_primary"]

    dimensions = plan.get("dimensions", {"width": DEFAULT_CANVAS_WIDTH, "height": DEFAULT_CANVAS_WIDTH})
    total = len(slides)

    if slide_n is not None:
        target = next((s for s in slides if s.get("index") == slide_n), None)
        if target is None:
            print(f"[ERROR] Slide {slide_n} not found in plan.json", file=sys.stderr)
            sys.exit(1)
        out_path = out_dir / f"{slide_n}.png"
        render_slide(target, out_path, dimensions, brand, api_key,
                     slide_index=slide_n, slide_total=total, template=template)
    else:
        for slide in slides:
            idx = slide.get("index", slides.index(slide) + 1)
            out_path = out_dir / f"{idx}.png"
            render_slide(slide, out_path, dimensions, brand, api_key,
                         slide_index=idx, slide_total=total, template=template)
        write_caption(plan, out_dir)
```

Also update `main()` to accept `--vault-root`:

```python
def main() -> None:
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        print("[ERROR] OPENAI_API_KEY environment variable is not set", file=sys.stderr)
        sys.exit(1)

    parser = argparse.ArgumentParser(description="Render carousel slides from a plan.json")
    parser.add_argument("plan_json", help="Path to plan.json file")
    parser.add_argument("--out-dir", required=True, help="Output directory for PNGs + caption.md")
    parser.add_argument("--brand", default=None, help="Path to CAROUSEL-BRAND.json")
    parser.add_argument("--slide", type=int, default=None, metavar="N",
                        help="Render only slide N (1-indexed)")
    parser.add_argument("--vault-root", default=None,
                        help="Path to vault root for loading carousel template")
    args = parser.parse_args()

    try:
        render_all(
            plan_path=Path(args.plan_json),
            out_dir=Path(args.out_dir),
            brand_path=args.brand,
            slide_n=args.slide,
            api_key=api_key,
            vault_root=args.vault_root,
        )
    except RuntimeError as exc:
        print(f"[ERROR] {exc}", file=sys.stderr)
        sys.exit(1)
```

- [ ] **Step 4: Run all tests**

Run: `pytest tests/test_generate_carousel.py -v`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/generate_carousel.py tests/test_generate_carousel.py
git commit -m "feat: wire template loading into render_all with vault_root param"
```

---

### Task 5: Import Command Definition

**Files:**
- Create: `.claude/commands/import-carousel-template.md`

- [ ] **Step 1: Write the command definition**

Create `.claude/commands/import-carousel-template.md`:

```markdown
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
```

- [ ] **Step 2: Commit**

```bash
git add .claude/commands/import-carousel-template.md
git commit -m "feat: add /import-carousel-template command definition"
```

---

### Task 6: Dashboard Template API + Brand Page Section

**Files:**
- Create: `dashboard/app/api/template/route.ts`
- Modify: `dashboard/lib/types.ts`
- Modify: `dashboard/app/brand/page.tsx`

- [ ] **Step 1: Add `CarouselTemplate` type**

Add to `dashboard/lib/types.ts`:

```typescript
export interface CarouselTemplate {
  name: string;
  source: string;
  created_at: string;
  colors: {
    background_start: string;
    background_end: string;
    accent: string;
    text_primary: string;
    text_secondary: string;
    safe_zone: string;
  };
  typography: {
    headline: { style: string; size: number; case: string };
    body: { style: string; size: number };
    counter: { style: string; size: number; visible: boolean; position: string };
  };
  layout: {
    hook_slide: string;
    value_slide: string;
    cta_slide: string;
    text_align: string;
  };
  spacing: {
    safe_zone_padding: number;
    content_padding_x: number;
    content_padding_y: number;
    element_gap: number;
  };
  accents: {
    left_bar: { width: number; color: string };
    top_bar: { height: number; color: string };
    divider: { width: number; height: number; color: string };
  };
  overlay: {
    alpha: number;
    direction: string;
  };
}
```

- [ ] **Step 2: Create template API route**

Create `dashboard/app/api/template/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { readVaultFile, vaultPathExists } from "@/lib/vault";
import yaml from "js-yaml";

export async function GET() {
  const exists = await vaultPathExists("brand/templates/active.yaml");
  if (!exists) {
    return NextResponse.json(null, { status: 404 });
  }
  try {
    const raw = await readVaultFile("brand/templates/active.yaml");
    const parsed = yaml.load(raw);
    return NextResponse.json(parsed);
  } catch {
    return NextResponse.json(null, { status: 500 });
  }
}
```

Check if `js-yaml` is already a dependency. If not, install it:

```bash
cd dashboard && npm ls js-yaml 2>/dev/null || npm install js-yaml && npm install -D @types/js-yaml
```

Note: `gray-matter` (already installed) bundles `js-yaml` internally, but it may not be directly importable. If the import fails, use gray-matter's yaml parser or install `js-yaml` directly.

- [ ] **Step 3: Add template preview section to Brand page**

Add a `TemplatePreview` component section to `dashboard/app/brand/page.tsx`. Insert it after the module grid and before the compiled brand voice section.

First, read the template file server-side in the page component:

```typescript
// At the top of BrandPage(), after existing vault checks:
const hasTemplate = await vaultPathExists("brand/templates/active.yaml");
let template: CarouselTemplate | null = null;
if (hasTemplate) {
  try {
    const raw = await readVaultFile("brand/templates/active.yaml");
    const yaml = await import("js-yaml");
    template = yaml.load(raw) as CarouselTemplate;
  } catch {
    template = null;
  }
}
```

Add the import at the top:
```typescript
import type { CarouselTemplate } from "@/lib/types";
```

Then add the template section in the JSX, between the module grid `</AnimateIn>` and the `{compiledContent && ...}` block:

```tsx
{template && (
  <AnimateIn delay={150} className="mb-10">
    <div className="rounded-[1.5rem] bg-white/[0.02] border border-white/[0.06] p-1.5">
      <div className="rounded-[calc(1.5rem-0.375rem)] bg-surface/60 p-6 shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)]">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <h2 className="text-[15px] font-semibold text-content">
              Carousel template
            </h2>
            <span className="text-[11px] text-accent bg-accent-soft px-2 py-0.5 rounded-full">
              {template.name}
            </span>
          </div>
          {template.created_at && (
            <span className="text-[11px] text-muted">
              {template.created_at}
            </span>
          )}
        </div>

        <div className="flex gap-6 items-start">
          {/* Sample slide */}
          <div
            className="w-48 aspect-square rounded-lg overflow-hidden relative flex-shrink-0 border border-white/[0.06]"
            style={{
              background: `linear-gradient(to bottom, ${template.colors.background_start}, ${template.colors.background_end})`,
            }}
          >
            {template.accents.top_bar.height > 0 && (
              <div
                className="absolute top-0 left-0 right-0"
                style={{
                  height: `${Math.max(2, template.accents.top_bar.height / 6)}px`,
                  backgroundColor: template.colors.accent,
                }}
              />
            )}
            {template.accents.left_bar.width > 0 && (
              <div
                className="absolute top-3 bottom-3 left-2"
                style={{
                  width: `${Math.max(1, template.accents.left_bar.width / 4)}px`,
                  backgroundColor: template.colors.accent,
                }}
              />
            )}
            <div className="absolute left-5 top-6 right-4 bottom-4">
              <div
                className="text-[11px] font-bold leading-tight mb-1.5"
                style={{ color: template.colors.text_primary }}
              >
                Sample Headline
                <br />
                Text Here
              </div>
              {template.accents.divider.width > 0 && (
                <div
                  className="mb-1.5 rounded-full"
                  style={{
                    width: `${Math.max(12, template.accents.divider.width / 4)}px`,
                    height: `${Math.max(1, template.accents.divider.height)}px`,
                    backgroundColor: template.colors.accent,
                  }}
                />
              )}
              <div
                className="text-[7px] leading-relaxed"
                style={{ color: template.colors.text_secondary }}
              >
                Body text shows up here
                <br />
                with the template style.
              </div>
            </div>
            <div
              className="absolute bottom-2 right-3 text-[6px]"
              style={{ color: template.colors.accent }}
            >
              02 / 05
            </div>
          </div>

          {/* Color strip */}
          <div className="flex flex-wrap gap-2">
            {[
              { label: "BG", color: template.colors.background_start },
              { label: "Accent", color: template.colors.accent },
              { label: "Text", color: template.colors.text_primary },
              { label: "Body", color: template.colors.text_secondary },
            ].map((swatch) => (
              <div key={swatch.label} className="text-center">
                <div
                  className="w-8 h-8 rounded-md border border-white/[0.08] mb-1"
                  style={{ backgroundColor: swatch.color }}
                />
                <div className="text-[9px] text-muted">{swatch.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  </AnimateIn>
)}
```

- [ ] **Step 4: Verify dashboard builds**

```bash
cd dashboard && npm run build
```

Expected: Build succeeds with no type errors.

- [ ] **Step 5: Commit**

```bash
git add dashboard/lib/types.ts dashboard/app/api/template/route.ts dashboard/app/brand/page.tsx
git commit -m "feat: add template preview section to dashboard brand page"
```

---

## Verification Checklist

After all tasks are complete:

- [ ] `pytest tests/test_generate_carousel.py -v` — all tests pass
- [ ] `cd dashboard && npm run build` — builds cleanly
- [ ] Render a carousel without a template → identical output to before (backward compat)
- [ ] Create a `vault/brand/templates/active.yaml` manually, render a carousel → uses template values
- [ ] Dashboard brand page shows template preview when `active.yaml` exists
- [ ] Dashboard brand page hides template section when `active.yaml` doesn't exist
