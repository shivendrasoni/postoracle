#!/usr/bin/env python3
"""
watermark.py — Apply watermark spec to images.

Position grid (3x3):
  1  2  3
  4     5
  6  7  8
"""
import argparse
import sys
from pathlib import Path
from typing import Optional

import yaml
from PIL import Image, ImageDraw, ImageFont

POSITION_MAP: dict[int, tuple[str, str]] = {
    1: ("left", "top"),
    2: ("center", "top"),
    3: ("right", "top"),
    4: ("left", "center"),
    5: ("right", "center"),
    6: ("left", "bottom"),
    7: ("center", "bottom"),
    8: ("right", "bottom"),
}
MARGIN = 20


def load_watermark_spec(spec_path: Path) -> dict:
    """Parse watermark.md frontmatter into a spec dict.

    Raises ValueError if no frontmatter delimiters found.
    """
    content = spec_path.read_text(encoding="utf-8")
    if not content.startswith("---"):
        raise ValueError(f"No YAML frontmatter found in {spec_path}")
    parts = content.split("---", 2)
    return yaml.safe_load(parts[1]) or {}


def _xy(canvas_size: tuple[int, int], w: int, h: int, halign: str, valign: str) -> tuple[int, int]:
    cw, ch = canvas_size
    if halign == "left":
        x = MARGIN
    elif halign == "center":
        x = (cw - w) // 2
    else:
        x = cw - w - MARGIN
    if valign == "top":
        y = MARGIN
    elif valign == "center":
        y = (ch - h) // 2
    else:
        y = ch - h - MARGIN
    return x, y


def apply_watermark(
    image_path: Path,
    spec: dict,
    output_path: Path,
    vault_dir: Optional[Path] = None,
) -> Path:
    """Apply watermark elements from spec to image_path. Write to output_path.

    Returns output_path.
    """
    img = Image.open(image_path).convert("RGBA")
    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    position = int(spec.get("position", 6))
    opacity = int(float(spec.get("opacity", 0.85)) * 255)
    halign, valign = POSITION_MAP.get(position, ("left", "bottom"))
    elements = spec.get("elements", [])

    for element in elements:
        elem_type = element.get("type")
        if elem_type in ("handle", "url"):
            text = element.get("value", "")
            if text:
                font = ImageFont.load_default()
                bbox = draw.textbbox((0, 0), text, font=font)
                tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
                x, y = _xy(img.size, tw, th, halign, valign)
                draw.text((x, y), text, fill=(255, 255, 255, opacity), font=font)
        elif elem_type == "logo" and vault_dir:
            logo_rel = element.get("path", "")
            logo_path = vault_dir / logo_rel
            if logo_path.exists():
                logo = Image.open(logo_path).convert("RGBA")
                max_dim = min(img.size) // 6
                logo.thumbnail((max_dim, max_dim))
                lw, lh = logo.size
                x, y = _xy(img.size, lw, lh, halign, valign)
                r, g, b, a = logo.split()
                a = a.point(lambda p: int(p * opacity / 255))
                logo = Image.merge("RGBA", (r, g, b, a))
                overlay.paste(logo, (x, y), logo)

    composited = Image.alpha_composite(img, overlay).convert("RGB")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    composited.save(output_path)
    return output_path


def _main(argv: Optional[list[str]] = None) -> None:
    parser = argparse.ArgumentParser(description="Apply watermark to an image")
    parser.add_argument("image", help="Input image path")
    parser.add_argument("--spec", required=True, help="Path to watermark.md")
    parser.add_argument("--out", required=True, help="Output image path")
    parser.add_argument("--vault", default=None, help="Vault root for logo path resolution")
    args = parser.parse_args(argv)

    spec = load_watermark_spec(Path(args.spec))
    vault_dir = Path(args.vault) if args.vault else None
    out_path = apply_watermark(Path(args.image), spec, Path(args.out), vault_dir)
    print(str(out_path))


if __name__ == "__main__":
    try:
        _main()
    except Exception as exc:
        print(f"Error: {exc}", file=sys.stderr)
        sys.exit(1)
