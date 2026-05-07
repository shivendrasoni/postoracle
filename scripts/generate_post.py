#!/usr/bin/env python3
"""
generate_post.py — Single-image post generator with platform adaptation.

Usage:
    python3 scripts/generate_post.py --prompt "..." --out-dir <dir> [--brand <path>] \
        [--mode visual|text] [--use-reference] [--photo-path <path>] [--platforms instagram,linkedin]
"""
import argparse
import base64
import os
import sys
from io import BytesIO
from pathlib import Path
from typing import Optional

import openai
from PIL import Image, ImageDraw

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

MASTER_SIZE = "1024x1024"
INSTAGRAM_SIZE = (1080, 1080)
LINKEDIN_SIZE = (1200, 627)
LINKEDIN_ACCENT_BAR_H = 3


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _hex_to_rgb(hex_color: str) -> tuple:
    h = hex_color.lstrip("#")
    return tuple(int(h[i : i + 2], 16) for i in (0, 2, 4))


# ---------------------------------------------------------------------------
# Brand loading
# ---------------------------------------------------------------------------

def load_brand(path: Optional[str]) -> dict:
    """Load brand palette from a YAML-frontmatter markdown file.

    Returns FALLBACK_PALETTE (copy) when path is None, missing, or unparseable.
    """
    import yaml

    if not path:
        return dict(FALLBACK_PALETTE)
    brand_path = Path(path)
    if not brand_path.exists():
        return dict(FALLBACK_PALETTE)
    try:
        content = brand_path.read_text(encoding="utf-8")
        parts = content.split("---", 2)
        if len(parts) < 3:
            return dict(FALLBACK_PALETTE)
        fm = yaml.safe_load(parts[1]) or {}
        result = dict(FALLBACK_PALETTE)
        result.update(fm.get("colors", {}))
        if "font" in fm:
            result["font"] = fm["font"]
        return result
    except (yaml.YAMLError, OSError):
        return dict(FALLBACK_PALETTE)


# ---------------------------------------------------------------------------
# Platform adaptation
# ---------------------------------------------------------------------------

def adapt_instagram(master: Image.Image) -> Image.Image:
    """Resize master image to Instagram square format (1080x1080)."""
    return master.resize(INSTAGRAM_SIZE, Image.LANCZOS)


def adapt_linkedin(master: Image.Image, brand: dict) -> Image.Image:
    """Letterbox master image into LinkedIn landscape format (1200x627).

    Scales to fit height, pads sides with brand secondary color, then
    draws a thin accent bar across the top.
    """
    target_w, target_h = LINKEDIN_SIZE
    accent_color = _hex_to_rgb(brand.get("accent", FALLBACK_PALETTE["accent"]))
    bg_color = _hex_to_rgb(brand.get("secondary", FALLBACK_PALETTE["secondary"]))

    # Scale to fit height (letterbox — no crop)
    scale = target_h / master.height
    scaled_w = round(master.width * scale)
    scaled = master.resize((scaled_w, target_h), Image.LANCZOS)

    # Paste centered onto background canvas
    canvas = Image.new("RGB", (target_w, target_h), bg_color)
    x_offset = (target_w - scaled_w) // 2
    canvas.paste(scaled, (x_offset, 0))

    # Draw accent bar on top
    draw = ImageDraw.Draw(canvas)
    draw.rectangle([0, 0, target_w, LINKEDIN_ACCENT_BAR_H], fill=accent_color)

    return canvas


# ---------------------------------------------------------------------------
# Image generation
# ---------------------------------------------------------------------------

def generate_master_image(
    prompt: str,
    use_reference: bool = False,
    photo_path: Optional[str] = None,
    api_key: Optional[str] = None,
) -> bytes:
    """Generate a master image using the OpenAI images API.

    When use_reference is True and photo_path is provided, uses images.edit
    (reference-guided generation). Otherwise uses images.generate (description-only).

    Returns raw PNG bytes decoded from the b64_json response.

    Raises RuntimeError if no API key is available.
    """
    resolved_key = api_key or os.environ.get("OPENAI_API_KEY")
    if not resolved_key:
        raise RuntimeError("OPENAI_API_KEY is not set")
    client = openai.OpenAI(api_key=resolved_key)

    if use_reference and photo_path:
        ref_guard = (
            " IMPORTANT: The reference photo is the person's real face. "
            "Do NOT alter, modify, or distort any facial features, skin tone, "
            "hair style, or physical appearance from the reference photo. "
            "Preserve the person's exact likeness."
        )
        guarded_prompt = prompt + ref_guard
        with open(photo_path, "rb") as f:
            response = client.images.edit(
                model="gpt-image-2",
                image=f,
                prompt=guarded_prompt,
                size=MASTER_SIZE,
                n=1,
            )
    else:
        response = client.images.generate(
            model="gpt-image-2",
            prompt=prompt,
            size=MASTER_SIZE,
            n=1,
        )
    return base64.b64decode(response.data[0].b64_json)


def render_post(
    prompt: str,
    out_dir: Path,
    brand_path: Optional[str] = None,
    use_reference: bool = False,
    photo_path: Optional[str] = None,
    platforms: Optional[list[str]] = None,
    api_key: Optional[str] = None,
) -> None:
    if platforms is None:
        platforms = ["instagram", "linkedin"]

    out_dir.mkdir(parents=True, exist_ok=True)
    brand = load_brand(brand_path)

    image_bytes = generate_master_image(prompt, use_reference, photo_path, api_key)
    master = Image.open(BytesIO(image_bytes)).convert("RGB")

    master_path = out_dir / "image.png"
    master.save(str(master_path), format="PNG")

    if "instagram" in platforms:
        adapt_instagram(master).save(str(out_dir / "image-instagram.png"), format="PNG")

    if "linkedin" in platforms:
        adapt_linkedin(master, brand).save(str(out_dir / "image-linkedin.png"), format="PNG")


def main() -> None:
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        print("[ERROR] OPENAI_API_KEY is not set", file=sys.stderr)
        sys.exit(1)

    parser = argparse.ArgumentParser(description="Generate single-image post")
    parser.add_argument("--prompt", required=True)
    parser.add_argument("--out-dir", required=True, type=Path)
    parser.add_argument("--brand", default=None)
    parser.add_argument("--use-reference", action="store_true")
    parser.add_argument("--photo-path", default=None)
    parser.add_argument("--platforms", default="instagram,linkedin")
    args = parser.parse_args()

    platforms = [p.strip() for p in args.platforms.split(",")]

    render_post(
        prompt=args.prompt,
        out_dir=args.out_dir,
        brand_path=args.brand,
        use_reference=args.use_reference,
        photo_path=args.photo_path,
        platforms=platforms,
        api_key=api_key,
    )


if __name__ == "__main__":
    main()
