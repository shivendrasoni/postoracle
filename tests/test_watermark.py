"""
Tests for scripts/watermark.py
"""
from io import BytesIO
from pathlib import Path

import pytest
from PIL import Image

from scripts.watermark import (
    POSITION_MAP,
    _xy,
    apply_watermark,
    load_watermark_spec,
)


def _make_png(tmp_path: Path, width: int = 200, height: int = 200, name: str = "img.png") -> Path:
    p = tmp_path / name
    Image.new("RGB", (width, height), "blue").save(p)
    return p


# ---------------------------------------------------------------------------
# POSITION_MAP
# ---------------------------------------------------------------------------

def test_position_map_covers_all_8_positions():
    assert set(POSITION_MAP.keys()) == {1, 2, 3, 4, 5, 6, 7, 8}


def test_position_map_bottom_left_is_6():
    assert POSITION_MAP[6] == ("left", "bottom")


def test_position_map_top_right_is_3():
    assert POSITION_MAP[3] == ("right", "top")


def test_position_map_top_center_is_2():
    assert POSITION_MAP[2] == ("center", "top")


# ---------------------------------------------------------------------------
# _xy — coordinate calculation
# ---------------------------------------------------------------------------

def test_xy_left_top_returns_margin():
    from scripts.watermark import MARGIN
    x, y = _xy((500, 500), 50, 20, "left", "top")
    assert x == MARGIN
    assert y == MARGIN


def test_xy_right_bottom_returns_canvas_minus_element_minus_margin():
    from scripts.watermark import MARGIN
    x, y = _xy((500, 400), 60, 30, "right", "bottom")
    assert x == 500 - 60 - MARGIN
    assert y == 400 - 30 - MARGIN


def test_xy_center_center_centers_element():
    x, y = _xy((500, 400), 100, 40, "center", "center")
    assert x == (500 - 100) // 2
    assert y == (400 - 40) // 2


# ---------------------------------------------------------------------------
# load_watermark_spec
# ---------------------------------------------------------------------------

def test_load_watermark_spec_returns_frontmatter(tmp_path):
    spec_file = tmp_path / "watermark.md"
    spec_file.write_text(
        "---\nmodule: watermark\nposition: 6\nopacity: 0.85\nelements:\n  - type: handle\n    value: \"@shivendra\"\n---\n\nBody.",
        encoding="utf-8",
    )
    spec = load_watermark_spec(spec_file)
    assert spec["position"] == 6
    assert abs(spec["opacity"] - 0.85) < 0.001
    assert spec["elements"][0]["value"] == "@shivendra"


def test_load_watermark_spec_raises_when_no_frontmatter(tmp_path):
    spec_file = tmp_path / "watermark.md"
    spec_file.write_text("No frontmatter here.", encoding="utf-8")
    with pytest.raises(ValueError, match="No YAML frontmatter"):
        load_watermark_spec(spec_file)


# ---------------------------------------------------------------------------
# apply_watermark — handle text element
# ---------------------------------------------------------------------------

def test_apply_watermark_produces_output_file(tmp_path):
    img_path = _make_png(tmp_path)
    spec = {
        "position": 6,
        "opacity": 0.85,
        "elements": [{"type": "handle", "value": "@test"}],
    }
    out = tmp_path / "out.jpg"
    result = apply_watermark(img_path, spec, out)
    assert result == out
    assert out.exists()
    # Output must be a valid image
    loaded = Image.open(out)
    assert loaded.size == (200, 200)


def test_apply_watermark_creates_parent_dirs(tmp_path):
    img_path = _make_png(tmp_path)
    spec = {"position": 6, "opacity": 0.85, "elements": []}
    nested_out = tmp_path / "a" / "b" / "out.jpg"
    apply_watermark(img_path, spec, nested_out)
    assert nested_out.exists()


def test_apply_watermark_logo_element_skipped_when_path_missing(tmp_path):
    img_path = _make_png(tmp_path)
    spec = {
        "position": 6,
        "opacity": 0.85,
        "elements": [{"type": "logo", "path": "assets/logo.png"}],
    }
    out = tmp_path / "out.jpg"
    # Should not raise even when logo file doesn't exist
    apply_watermark(img_path, spec, out, vault_dir=tmp_path)
    assert out.exists()
