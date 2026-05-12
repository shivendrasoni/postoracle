#!/usr/bin/env python3
"""
generate_carousel.py — Slide renderer for carousel social media posts.

Usage:
    python3 scripts/generate_carousel.py <plan_json> --out-dir <dir> [--brand <path>] [--slide N]
"""
import argparse
import base64
import json
import os
import sys
from io import BytesIO
from pathlib import Path
from typing import Optional, Union

import openai
from PIL import Image, ImageDraw, ImageFont

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

FALLBACK_PALETTE = {
    "primary": "#0A0A18",
    "secondary": "#141432",
    "accent": "#E94560",
    "background": "#0F3460",
    "text": "#FFFFFF",
}

PLATFORM_IMAGE_SIZE = {
    "instagram": "1024x1024",
    "linkedin": "1024x1536",
}
DEFAULT_IMAGE_SIZE = "1024x1024"
MIN_SLIDES = 3
DEFAULT_CANVAS_WIDTH = 1080

# Typography
FONT_SIZE_HEADLINE = 78
FONT_SIZE_BODY = 36
FONT_SIZE_SLIDE_NUM = 26
FONT_SIZE_HEADLINE_BG = 72
FONT_SIZE_SUBTEXT_BG = 38
FONT_SIZE_HEADLINE_SPLIT = 56
FONT_SIZE_BODY_SPLIT = 32

# Layout
SQUARE_SAFE_PAD = 80     # inset border so content survives Instagram profile-grid crop
PAD_X = 90               # horizontal margin (relative to inner canvas)
PAD_Y = 120              # top margin before headline
PAD_BOTTOM = 80          # bottom margin
ACCENT_LEFT_W = 8        # left accent bar width
ACCENT_TOP_H = 12        # top accent bar height
DIVIDER_W = 80           # headline/body divider width
DIVIDER_H = 4            # headline/body divider height
OVERLAY_ALPHA = 150      # base dark overlay alpha for image-bg slides

PADDING_SPLIT = 40       # padding inside split layout right panel

# Spacing
GAP_HL_LINE = 10         # extra gap between wrapped headline lines
GAP_BD_LINE = 14         # extra gap between wrapped body lines
GAP_PARA = 24            # gap between body paragraphs
GAP_HL_TO_DIV = 30       # headline bottom → divider top
GAP_DIV_TO_BD = 30       # divider bottom → body top


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


_TEMPLATE_KNOWN_KEYS = frozenset(DEFAULT_TEMPLATE.keys())


def load_template(vault_root: Optional[str] = None) -> Optional[dict]:
    """Load active carousel template from vault. Returns None if no template exists."""
    if not vault_root:
        return None
    template_path = Path(vault_root) / "brand" / "templates" / "active.yaml"
    if not template_path.exists():
        return None
    try:
        import yaml
        raw = yaml.safe_load(template_path.read_text(encoding="utf-8"))
        if not isinstance(raw, dict) or not (set(raw.keys()) & _TEMPLATE_KNOWN_KEYS):
            raise ValueError(f"Template file has no recognized keys: {list(raw.keys()) if isinstance(raw, dict) else type(raw)}")
        return _deep_merge(DEFAULT_TEMPLATE, raw)
    except Exception as e:
        print(f"[WARNING] Failed to load template: {e}", file=sys.stderr)
        return None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _hex_to_rgb(hex_color: str) -> tuple:
    h = hex_color.lstrip("#")
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))


def _load_font(size: int, bold: bool = True) -> Union[ImageFont.FreeTypeFont, ImageFont.ImageFont]:
    """Try common system fonts; fall back to PIL default."""
    bold_candidates = [
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    ]
    regular_candidates = [
        "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    ]
    candidates = bold_candidates if bold else regular_candidates
    for path in candidates:
        if Path(path).exists():
            try:
                return ImageFont.truetype(path, size)
            except Exception:
                continue
    return ImageFont.load_default()


def _fill_gradient(canvas: Image.Image, top_rgb: tuple, bottom_rgb: tuple) -> None:
    """Fill canvas in-place with a vertical linear gradient."""
    draw = ImageDraw.Draw(canvas)
    w, h = canvas.size
    for y in range(h):
        t = y / max(h - 1, 1)
        r = round(top_rgb[0] + t * (bottom_rgb[0] - top_rgb[0]))
        g = round(top_rgb[1] + t * (bottom_rgb[1] - top_rgb[1]))
        b = round(top_rgb[2] + t * (bottom_rgb[2] - top_rgb[2]))
        draw.line([(0, y), (w, y)], fill=(r, g, b))


def _wrap_text(draw: ImageDraw.Draw, text: str, font, max_width: int) -> list:
    """
    Word-wrap text, respecting hard newlines.
    Returns a list of strings; '' marks a paragraph gap.
    """
    result = []
    paragraphs = text.split('\n')
    for i, para in enumerate(paragraphs):
        stripped = para.rstrip()
        if not stripped:
            result.append('')
            continue
        words = stripped.split()
        current: list = []
        for word in words:
            test = " ".join(current + [word])
            bbox = draw.textbbox((0, 0), test, font=font)
            if bbox[2] - bbox[0] <= max_width:
                current.append(word)
            else:
                if current:
                    result.append(" ".join(current))
                current = [word]
        if current:
            result.append(" ".join(current))
        if i < len(paragraphs) - 1:
            result.append('')  # paragraph separator between hard newlines
    # Trim trailing blanks
    while result and result[-1] == '':
        result.pop()
    return result


def _lines_height(draw: ImageDraw.Draw, lines: list, font, line_gap: int, para_gap: int) -> int:
    """Calculate total pixel height for a list of wrapped lines ('' = paragraph break)."""
    total = 0
    for line in lines:
        if line == '':
            total += para_gap
        else:
            bbox = draw.textbbox((0, 0), line, font=font)
            total += (bbox[3] - bbox[1]) + line_gap
    return total


def _draw_lines(draw: ImageDraw.Draw, lines: list, x: int, y: int, font,
                fill: tuple, line_gap: int, para_gap: int,
                align: str = 'left', canvas_width: int = None) -> int:
    """Draw pre-wrapped lines. Returns final y after last line."""
    for line in lines:
        if line == '':
            y += para_gap
            continue
        bbox = draw.textbbox((0, 0), line, font=font)
        lh = bbox[3] - bbox[1]
        lw = bbox[2] - bbox[0]
        if align == 'center' and canvas_width:
            draw_x = (canvas_width - lw) // 2
        else:
            draw_x = x
        draw.text((draw_x, y), line, font=font, fill=fill)
        y += lh + line_gap
    return y


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def _load_brand_from_md(path: Path) -> dict:
    """Parse vault brand.md YAML frontmatter into a flat brand dict."""
    import yaml
    content = path.read_text(encoding="utf-8")
    parts = content.split("---", 2)
    if len(parts) < 3:
        return dict(FALLBACK_PALETTE)
    fm = yaml.safe_load(parts[1]) or {}
    result = dict(FALLBACK_PALETTE)
    colors = fm.get("colors", {})
    result.update(colors)
    if "font" in fm:
        result["font"] = fm["font"]
    if "logo_path" in fm:
        result["logo_path"] = fm["logo_path"]
    return result


def load_brand(path: Optional[str]) -> dict:
    if not path:
        return dict(FALLBACK_PALETTE)
    brand_path = Path(path)
    if not brand_path.exists():
        return dict(FALLBACK_PALETTE)
    try:
        if brand_path.suffix == ".md":
            return _load_brand_from_md(brand_path)
        with brand_path.open() as f:
            data = json.load(f)
        result = dict(FALLBACK_PALETTE)
        colors = data.get("colors", data)
        result.update(colors)
        return result
    except Exception as e:
        print(f"[WARNING] Failed to load brand file '{path}': {e}", file=sys.stderr)
        return dict(FALLBACK_PALETTE)


def _fetch_image(prompt: str, size: str, api_key: Optional[str] = None) -> bytes:
    resolved_key = api_key or os.environ.get("OPENAI_API_KEY")
    if not resolved_key:
        raise RuntimeError("OPENAI_API_KEY is not set and no api_key was provided")
    client = openai.OpenAI(api_key=resolved_key)
    response = client.images.generate(
        model="gpt-image-2",
        prompt=prompt,
        size=size,
        n=1,
    )
    return base64.b64decode(response.data[0].b64_json)


def _render_text_only(slide: dict, dimensions: tuple, brand: dict,
                      slide_index: int = None, slide_total: int = None,
                      template: Optional[dict] = None) -> Image.Image:
    """
    Modern editorial layout:
    - Gradient background (primary → secondary)
    - Left + top accent bars
    - Left-aligned headline → accent divider → left-aligned body
    - Slide counter bottom-right
    """
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

    # Content area starts here
    text_x = accent_left_w + pad_x
    max_w = width - text_x - pad_x

    headline = slide.get("headline", "")
    body = slide.get("body") or slide.get("subtext", "")

    hl_font = _load_font(hl_size, bold=True)
    bd_font = _load_font(bd_size, bold=False)
    num_font = _load_font(ctr_size, bold=False)

    y = pad_y + accent_top_h

    # Headline
    if headline:
        hl_lines = _wrap_text(draw, headline, hl_font, max_w)
        y = _draw_lines(draw, hl_lines, text_x, y, hl_font,
                        text_color, GAP_HL_LINE, GAP_PARA)

    # Accent divider
    y += GAP_HL_TO_DIV
    draw.rectangle([text_x, y, text_x + divider_w, y + divider_h], fill=accent)
    y += divider_h + GAP_DIV_TO_BD

    # Body
    if body:
        bd_lines = _wrap_text(draw, body, bd_font, max_w)
        _draw_lines(draw, bd_lines, text_x, y, bd_font,
                    body_color, GAP_BD_LINE, GAP_PARA)

    # Slide counter: "02 / 05"
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


def _render_image_bg_text(slide: dict, canvas_size: tuple, brand: dict,
                           api_size: str, api_key: Optional[str] = None,
                           slide_index: int = None, slide_total: int = None,
                           template: Optional[dict] = None) -> Image.Image:
    """
    Cinematic image-bg layout:
    - Full-bleed AI image
    - Gradient overlay (transparent at top → dark at bottom)
    - Headline + subtext centered in bottom 40%
    """
    tmpl = template or DEFAULT_TEMPLATE
    width, height = canvas_size
    image_prompt = slide.get("image_prompt", "")

    raw_bytes = _fetch_image(image_prompt, api_size, api_key)
    bg_img = Image.open(BytesIO(raw_bytes)).convert("RGBA")
    bg_img = bg_img.resize((width, height), Image.LANCZOS)

    overlay_alpha = _t(tmpl, "overlay", "alpha", default=OVERLAY_ALPHA)
    # Base uniform darken
    base_overlay = Image.new("RGBA", (width, height), (0, 0, 0, overlay_alpha))
    # Bottom-weighted gradient overlay (0 at top → 210 at bottom)
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

    # Measure block height for bottom-positioning
    hl_lines = _wrap_text(draw, headline, hl_font, max_w) if headline else []
    st_lines = _wrap_text(draw, subtext, st_font, max_w) if subtext else []

    hl_h = _lines_height(draw, hl_lines, hl_font, GAP_HL_LINE, GAP_PARA)
    st_h = _lines_height(draw, st_lines, st_font, GAP_BD_LINE, GAP_PARA) if st_lines else 0
    divider_block = divider_h + GAP_HL_TO_DIV + GAP_DIV_TO_BD if (hl_lines and st_lines) else 0
    total_h = hl_h + divider_block + st_h

    # Position text in bottom 38% of slide
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

    # Slide counter
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


def _render_image_split(slide: dict, canvas_size: tuple, brand: dict,
                         api_key: Optional[str] = None,
                         slide_index: int = None, slide_total: int = None,
                         template: Optional[dict] = None) -> Image.Image:
    """
    Image-split layout: AI image on left half, styled text on right.
    """
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

    # Vertical separator
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

    # Slide counter
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


def render_slide(slide: dict, out_path: Path, dimensions: dict, brand: dict,
                 api_key: Optional[str] = None,
                 slide_index: int = None, slide_total: int = None,
                 template: Optional[dict] = None) -> Path:
    tmpl = template or DEFAULT_TEMPLATE
    width = dimensions.get("width", DEFAULT_CANVAS_WIDTH)
    height = dimensions.get("height", DEFAULT_CANVAS_WIDTH)
    # Render content at inner size so the output has a safe-zone border on all sides
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

    # Compose inner content onto full-size canvas with safe-zone border
    # IMPORTANT: use raw `template` (not `tmpl`) so None falls back to brand_primary (backward compat)
    brand_primary = brand.get("primary", FALLBACK_PALETTE["primary"])
    safe_zone_color = _hex_to_rgb(_t(template, "colors", "safe_zone", default=brand_primary))
    full_canvas = Image.new("RGB", (width, height), safe_zone_color)
    full_canvas.paste(img, (safe_pad, safe_pad))
    img = full_canvas

    out_path.parent.mkdir(parents=True, exist_ok=True)
    img.save(str(out_path), format="PNG")
    return out_path


def write_caption(plan: dict, out_dir: Path) -> Path:
    out_dir.mkdir(parents=True, exist_ok=True)
    caption_path = out_dir / "caption.md"

    post_caption = plan.get("post_caption", "")
    slides = plan.get("slides", [])

    lines = ["[POST CAPTION]", post_caption, "", "---", "[SLIDE COPY]"]
    for slide in slides:
        idx = slide.get("index", "?")
        headline = slide.get("headline", "")
        subtext = slide.get("subtext") or slide.get("body", "")
        parts = [p for p in [headline, subtext] if p]
        copy = " | ".join(parts) if parts else ""
        lines.append(f"{idx}: {copy}")

    caption_path.write_text("\n".join(lines), encoding="utf-8")
    return caption_path


def render_all(
    plan_path: Path,
    out_dir: Path,
    brand_path: Optional[str] = None,
    slide_n: Optional[int] = None,
    api_key: Optional[str] = None,
) -> None:
    with plan_path.open() as f:
        plan = json.load(f)

    slides = plan.get("slides", [])
    if len(slides) < MIN_SLIDES:
        print(f"[ERROR] plan.json must have at least {MIN_SLIDES} slides; found {len(slides)}",
              file=sys.stderr)
        sys.exit(1)

    brand = load_brand(brand_path)
    dimensions = plan.get("dimensions", {"width": DEFAULT_CANVAS_WIDTH, "height": DEFAULT_CANVAS_WIDTH})
    total = len(slides)

    if slide_n is not None:
        target = next((s for s in slides if s.get("index") == slide_n), None)
        if target is None:
            print(f"[ERROR] Slide {slide_n} not found in plan.json", file=sys.stderr)
            sys.exit(1)
        out_path = out_dir / f"{slide_n}.png"
        render_slide(target, out_path, dimensions, brand, api_key,
                     slide_index=slide_n, slide_total=total)
    else:
        for slide in slides:
            idx = slide.get("index", slides.index(slide) + 1)
            out_path = out_dir / f"{idx}.png"
            render_slide(slide, out_path, dimensions, brand, api_key,
                         slide_index=idx, slide_total=total)
        write_caption(plan, out_dir)


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

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
    args = parser.parse_args()

    try:
        render_all(
            plan_path=Path(args.plan_json),
            out_dir=Path(args.out_dir),
            brand_path=args.brand,
            slide_n=args.slide,
            api_key=api_key,
        )
    except RuntimeError as exc:
        print(f"[ERROR] {exc}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
