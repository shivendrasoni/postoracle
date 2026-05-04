#!/usr/bin/env python3
"""
carousel_brand.py — Color extraction and CAROUSEL-BRAND.json writer.

This is a non-interactive library module. The interactive flow is handled
by the Claude command .claude/commands/carousel-brand.md.
"""
import argparse
import io
import json
import re
import sys
from pathlib import Path
from typing import Optional

import requests
import colorthief


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

_COLOR_ROLES = ("primary", "secondary", "accent", "background", "text")


def parse_hex_colors(hex_input: str) -> dict[str, str]:
    """
    Parse a string of 5 hex codes (space or comma separated) into a brand dict.

    Returns: {"primary": "#HEX", "secondary": "#HEX", "accent": "#HEX",
              "background": "#HEX", "text": "#HEX"}
    Raises ValueError if fewer than 5 valid hex codes found.
    Normalizes to uppercase with # prefix.
    """
    # Extract all 3-digit or 6-digit hex sequences (with or without leading #)
    pattern = re.compile(r"#?([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})(?:[^0-9A-Fa-f]|$)")
    raw_matches = pattern.findall(hex_input)

    if len(raw_matches) < 5:
        raise ValueError(
            f"Expected 5 hex color codes, got {len(raw_matches)}"
        )

    normalized = [f"#{m.upper()}" for m in raw_matches[:5]]
    return dict(zip(_COLOR_ROLES, normalized))


def extract_colors_from_image(image_source: str) -> list[str]:
    """
    Download URL or open local path, extract 5 dominant colors using colorthief.

    Returns list of 5 hex strings (e.g. ["#1A2B3C", ...]).
    Raises RuntimeError with clear message if colorthief fails.
    Raises requests.HTTPError if URL download fails.
    """
    if image_source.startswith("http"):
        response = requests.get(image_source)
        response.raise_for_status()
        image_data: io.BytesIO | str = io.BytesIO(response.content)
    else:
        image_data = image_source

    try:
        ct = colorthief.ColorThief(image_data)
        palette = ct.get_palette(color_count=5)
    except Exception as exc:
        raise RuntimeError(f"Color extraction failed: {exc}") from exc

    return ["#{:02X}{:02X}{:02X}".format(r, g, b) for r, g, b in palette]


def assign_color_roles(colors: list[str]) -> dict[str, str]:
    """
    Given a list of 5+ hex strings (from colorthief), assign them to the 5 color roles.

    Simple assignment: index 0→primary, 1→secondary, 2→accent, 3→background, 4→text.
    Returns: {"primary": ..., "secondary": ..., "accent": ..., "background": ..., "text": ...}
    """
    return dict(zip(_COLOR_ROLES, colors[:5]))


def build_brand_dict(colors: dict[str, str]) -> dict:
    """
    Build the full CAROUSEL-BRAND.json structure from a colors dict.

    Returns:
    {
      "colors": { "primary": ..., "secondary": ..., "accent": ...,
                  "background": ..., "text": ... },
      "font": null,
      "logo_path": null,
      "voice_tone": null
    }
    """
    return {
        "colors": {role: colors[role] for role in _COLOR_ROLES},
        "font": None,
        "logo_path": None,
        "voice_tone": None,
    }


def save_brand(brand: dict, path: Path) -> Path:
    """
    Write brand dict as JSON to path.

    Creates parent directories if needed. Returns the path written.
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(brand, indent=2), encoding="utf-8")
    return path


# ---------------------------------------------------------------------------
# CLI entry point (for manual use)
# ---------------------------------------------------------------------------

def _main(argv: Optional[list[str]] = None) -> None:
    parser = argparse.ArgumentParser(
        description="Generate CAROUSEL-BRAND.json from hex codes or an image."
    )
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument(
        "--hex",
        metavar="COLORS",
        help='5 hex codes, space or comma separated (e.g. "#1A1A2E #16213E ...")',
    )
    group.add_argument(
        "--image",
        metavar="SOURCE",
        help="Local file path or URL to extract colors from",
    )
    parser.add_argument(
        "--out",
        metavar="PATH",
        default="CAROUSEL-BRAND.json",
        help="Output path (default: CAROUSEL-BRAND.json in current directory)",
    )
    args = parser.parse_args(argv)

    if args.hex:
        colors = parse_hex_colors(args.hex)
    else:
        raw_colors = extract_colors_from_image(args.image)
        colors = assign_color_roles(raw_colors)

    brand = build_brand_dict(colors)
    out_path = save_brand(brand, Path(args.out))
    print(str(out_path))


if __name__ == "__main__":
    try:
        _main()
    except (ValueError, RuntimeError) as exc:
        print(f"Error: {exc}", file=sys.stderr)
        sys.exit(1)
