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
from typing import Optional

import openai
from PIL import Image, ImageDraw, ImageFont

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

FALLBACK_PALETTE = {
    "primary": "#1A1A2E",
    "secondary": "#16213E",
    "accent": "#E94560",
    "background": "#0F3460",
    "text": "#FFFFFF",
}

# gpt-image-2 size per platform
PLATFORM_IMAGE_SIZE = {
    "instagram": "1024x1024",
    "linkedin": "1024x1536",
}

DEFAULT_IMAGE_SIZE = "1024x1024"

MIN_SLIDES = 3


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _hex_to_rgb(hex_color: str) -> tuple:
    """Convert '#RRGGBB' to (R, G, B)."""
    h = hex_color.lstrip("#")
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))


def _load_font(size: int) -> ImageFont.FreeTypeFont:
    """Try common system bold fonts; fall back to PIL default."""
    candidates = [
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    ]
    for path in candidates:
        if Path(path).exists():
            try:
                return ImageFont.truetype(path, size)
            except Exception:
                continue
    return ImageFont.load_default()


def _load_font_regular(size: int) -> ImageFont.FreeTypeFont:
    """Try common system regular fonts; fall back to PIL default."""
    candidates = [
        "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    ]
    for path in candidates:
        if Path(path).exists():
            try:
                return ImageFont.truetype(path, size)
            except Exception:
                continue
    return ImageFont.load_default()


def _draw_centered_text(draw: ImageDraw.Draw, text: str, y: int, font: ImageFont.FreeTypeFont,
                         fill: tuple, canvas_width: int, padding: int = 80) -> int:
    """
    Draw text centered horizontally within padding.
    Wraps long lines. Returns the y coordinate after the text block.
    """
    max_width = canvas_width - 2 * padding
    words = text.split()
    lines = []
    current = []
    for word in words:
        test_line = " ".join(current + [word])
        bbox = draw.textbbox((0, 0), test_line, font=font)
        if bbox[2] - bbox[0] <= max_width:
            current.append(word)
        else:
            if current:
                lines.append(" ".join(current))
            current = [word]
    if current:
        lines.append(" ".join(current))

    for line in lines:
        bbox = draw.textbbox((0, 0), line, font=font)
        line_w = bbox[2] - bbox[0]
        x = (canvas_width - line_w) // 2
        draw.text((x, y), line, font=font, fill=fill)
        y += (bbox[3] - bbox[1]) + 8
    return y


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def load_brand(path: Optional[str]) -> dict:
    """Load brand JSON from path, or return fallback palette."""
    if not path:
        return dict(FALLBACK_PALETTE)
    brand_path = Path(path)
    if not brand_path.exists():
        return dict(FALLBACK_PALETTE)
    try:
        with brand_path.open() as f:
            data = json.load(f)
        # Merge with fallback so missing keys don't break rendering
        result = dict(FALLBACK_PALETTE)
        result.update(data)
        return result
    except Exception:
        return dict(FALLBACK_PALETTE)


def _fetch_image(prompt: str, size: str, api_key: Optional[str] = None) -> bytes:
    """Call gpt-image-2 and return raw PNG bytes."""
    client = openai.OpenAI(api_key=api_key or os.environ["OPENAI_API_KEY"])
    response = client.images.generate(
        model="gpt-image-2",
        prompt=prompt,
        size=size,
        n=1,
        response_format="b64_json",
    )
    return base64.b64decode(response.data[0].b64_json)


def _render_text_only(slide: dict, canvas: Image.Image, brand: dict) -> Image.Image:
    """
    Render a text-only layout onto `canvas`.
    Returns the modified canvas image.
    """
    width, height = canvas.size
    bg_color = _hex_to_rgb(brand["background"])
    accent_color = _hex_to_rgb(brand["accent"])
    text_color = _hex_to_rgb(brand["text"])

    # Fill background
    canvas = Image.new("RGB", (width, height), bg_color)
    draw = ImageDraw.Draw(canvas)

    # Accent bar at top (8px)
    draw.rectangle([0, 0, width, 8], fill=accent_color)

    padding = 80
    headline = slide.get("headline", "")
    body = slide.get("body", slide.get("subtext", ""))

    headline_font = _load_font(64)
    body_font = _load_font_regular(36)

    y = 8 + padding
    if headline:
        y = _draw_centered_text(draw, headline, y, headline_font, text_color, width, padding)
        y += 32  # spacing between headline and body

    if body:
        _draw_centered_text(draw, body, y, body_font, text_color, width, padding)

    return canvas


def _render_image_bg_text(slide: dict, canvas_size: tuple, brand: dict,
                           api_size: str, api_key: Optional[str] = None) -> Image.Image:
    """
    Render image-bg-text layout: fetch image, apply dark overlay, draw text.
    Returns composed Image.
    """
    width, height = canvas_size
    image_prompt = slide.get("image_prompt", "")

    raw_bytes = _fetch_image(image_prompt, api_size, api_key)
    bg_img = Image.open(BytesIO(raw_bytes)).convert("RGBA")
    bg_img = bg_img.resize((width, height), Image.LANCZOS)

    # Semi-transparent dark overlay at 60% opacity (alpha=153)
    overlay = Image.new("RGBA", (width, height), (0, 0, 0, 153))
    composed = Image.alpha_composite(bg_img, overlay).convert("RGB")

    draw = ImageDraw.Draw(composed)
    text_color = _hex_to_rgb(brand["text"])

    headline = slide.get("headline", "")
    subtext = slide.get("subtext", slide.get("body", ""))

    headline_font = _load_font(72)
    subtext_font = _load_font_regular(40)

    padding = 80
    total_text_height = 0
    if headline:
        bbox = draw.textbbox((0, 0), headline, font=headline_font)
        total_text_height += (bbox[3] - bbox[1]) + 32
    if subtext:
        bbox = draw.textbbox((0, 0), subtext, font=subtext_font)
        total_text_height += (bbox[3] - bbox[1])

    y = max(padding, (height - total_text_height) // 2)

    if headline:
        y = _draw_centered_text(draw, headline, y, headline_font, text_color, width, padding)
        y += 32

    if subtext:
        _draw_centered_text(draw, subtext, y, subtext_font, text_color, width, padding)

    return composed


def _render_image_split(slide: dict, canvas_size: tuple, brand: dict,
                         api_key: Optional[str] = None) -> Image.Image:
    """
    Render image-split layout: image on left half, text on right half.
    Returns composed Image.
    """
    width, height = canvas_size
    half_w = width // 2

    image_prompt = slide.get("image_prompt", "")
    raw_bytes = _fetch_image(image_prompt, "1024x1024", api_key)
    src_img = Image.open(BytesIO(raw_bytes)).convert("RGB")
    # Crop/scale to fill left half
    left_img = src_img.resize((half_w, height), Image.LANCZOS)

    bg_color = _hex_to_rgb(brand["background"])
    text_color = _hex_to_rgb(brand["text"])

    canvas = Image.new("RGB", (width, height), bg_color)
    canvas.paste(left_img, (0, 0))

    draw = ImageDraw.Draw(canvas)
    headline = slide.get("headline", "")
    body = slide.get("body", slide.get("subtext", ""))

    headline_font = _load_font(56)
    body_font = _load_font_regular(32)

    right_padding = 40
    right_canvas_width = half_w  # we'll offset x when drawing

    # Build lines within right half
    max_text_w = half_w - 2 * right_padding

    def _draw_right_text(text: str, y: int, font: ImageFont.FreeTypeFont) -> int:
        words = text.split()
        lines = []
        current = []
        for word in words:
            test_line = " ".join(current + [word])
            bbox = draw.textbbox((0, 0), test_line, font=font)
            if bbox[2] - bbox[0] <= max_text_w:
                current.append(word)
            else:
                if current:
                    lines.append(" ".join(current))
                current = [word]
        if current:
            lines.append(" ".join(current))

        for line in lines:
            bbox = draw.textbbox((0, 0), line, font=font)
            x = half_w + right_padding
            draw.text((x, y), line, font=font, fill=text_color)
            y += (bbox[3] - bbox[1]) + 8
        return y

    y = height // 4
    if headline:
        y = _draw_right_text(headline, y, headline_font)
        y += 24
    if body:
        _draw_right_text(body, y, body_font)

    return canvas


def render_slide(slide: dict, out_path: Path, dimensions: dict, brand: dict,
                 api_key: Optional[str] = None) -> Path:
    """
    Render a single slide to `out_path` as PNG.
    Returns out_path.
    """
    width = dimensions.get("width", 1080)
    height = dimensions.get("height", 1080)
    canvas_size = (width, height)

    layout = slide.get("layout", "text-only")
    image_prompt = slide.get("image_prompt")

    # Determine platform for API size
    # We'll rely on the canvas aspect ratio: if height > width, use linkedin size
    if height > width:
        api_size = "1024x1536"
    else:
        api_size = "1024x1024"

    try:
        if layout == "text-only" or not image_prompt:
            canvas = Image.new("RGB", canvas_size)
            img = _render_text_only(slide, canvas, brand)
        elif layout == "image-bg-text":
            img = _render_image_bg_text(slide, canvas_size, brand, api_size, api_key)
        elif layout == "image-split":
            img = _render_image_split(slide, canvas_size, brand, api_key)
        else:
            # Unknown layout — fall back to text-only
            canvas = Image.new("RGB", canvas_size)
            img = _render_text_only(slide, canvas, brand)
    except Exception as exc:
        if layout in ("image-bg-text", "image-split"):
            print(
                f"[WARN] gpt-image-2 failed for slide {slide.get('index', '?')}: {exc}; "
                "falling back to text-only",
                file=sys.stderr,
            )
            canvas = Image.new("RGB", canvas_size)
            img = _render_text_only(slide, canvas, brand)
        else:
            raise

    out_path.parent.mkdir(parents=True, exist_ok=True)
    img.save(str(out_path), format="PNG")
    return out_path


def write_caption(plan: dict, out_dir: Path) -> Path:
    """
    Write caption.txt to out_dir. Returns path to caption.txt.
    """
    out_dir.mkdir(parents=True, exist_ok=True)
    caption_path = out_dir / "caption.txt"

    post_caption = plan.get("post_caption", "")
    slides = plan.get("slides", [])

    lines = ["[POST CAPTION]", post_caption, "", "---", "[SLIDE COPY]"]
    for slide in slides:
        idx = slide.get("index", "?")
        headline = slide.get("headline", "")
        subtext = slide.get("subtext", slide.get("body", ""))
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
    """
    Main orchestration: render all slides (or a single slide) and optionally write caption.txt.
    """
    with plan_path.open() as f:
        plan = json.load(f)

    slides = plan.get("slides", [])
    if len(slides) < MIN_SLIDES:
        print(
            f"[ERROR] plan.json must have at least {MIN_SLIDES} slides; found {len(slides)}",
            file=sys.stderr,
        )
        sys.exit(1)

    brand = load_brand(brand_path)
    dimensions = plan.get("dimensions", {"width": 1080, "height": 1080})

    if slide_n is not None:
        # Render only the requested slide (1-indexed)
        target = next((s for s in slides if s.get("index") == slide_n), None)
        if target is None:
            print(f"[ERROR] Slide {slide_n} not found in plan.json", file=sys.stderr)
            sys.exit(1)
        out_path = out_dir / f"{slide_n}.png"
        render_slide(target, out_path, dimensions, brand, api_key)
    else:
        # Render all slides
        for slide in slides:
            idx = slide.get("index", slides.index(slide) + 1)
            out_path = out_dir / f"{idx}.png"
            render_slide(slide, out_path, dimensions, brand, api_key)
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
    parser.add_argument("--out-dir", required=True, help="Output directory for PNGs + caption.txt")
    parser.add_argument("--brand", default=None, help="Path to CAROUSEL-BRAND.json")
    parser.add_argument("--slide", type=int, default=None, metavar="N",
                        help="Render only slide N (1-indexed)")
    args = parser.parse_args()

    render_all(
        plan_path=Path(args.plan_json),
        out_dir=Path(args.out_dir),
        brand_path=args.brand,
        slide_n=args.slide,
        api_key=api_key,
    )


if __name__ == "__main__":
    main()
