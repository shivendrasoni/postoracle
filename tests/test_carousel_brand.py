"""
Tests for scripts/carousel_brand.py
"""
import json
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from scripts.carousel_brand import (
    assign_color_roles,
    build_brand_dict,
    extract_colors_from_image,
    parse_hex_colors,
    save_brand,
)


# ---------------------------------------------------------------------------
# 1. parse_hex_colors — space-separated with # prefix
# ---------------------------------------------------------------------------

def test_parse_hex_colors_space_separated_with_hash():
    result = parse_hex_colors("#1A1A2E #16213E #E94560 #0F3460 #FFFFFF")
    assert result == {
        "primary": "#1A1A2E",
        "secondary": "#16213E",
        "accent": "#E94560",
        "background": "#0F3460",
        "text": "#FFFFFF",
    }


# ---------------------------------------------------------------------------
# 2. parse_hex_colors — comma-separated without # prefix
# ---------------------------------------------------------------------------

def test_parse_hex_colors_comma_separated_no_hash():
    result = parse_hex_colors("1A1A2E,16213E,E94560,0F3460,FFFFFF")
    assert result == {
        "primary": "#1A1A2E",
        "secondary": "#16213E",
        "accent": "#E94560",
        "background": "#0F3460",
        "text": "#FFFFFF",
    }


# ---------------------------------------------------------------------------
# 3. parse_hex_colors — raises ValueError for fewer than 5 codes
# ---------------------------------------------------------------------------

def test_parse_hex_colors_raises_for_too_few():
    with pytest.raises(ValueError, match="Expected 5 hex color codes, got"):
        parse_hex_colors("#1A1A2E #16213E #E94560")


# ---------------------------------------------------------------------------
# 4. parse_hex_colors — normalizes to uppercase with # prefix
# ---------------------------------------------------------------------------

def test_parse_hex_colors_normalizes_to_uppercase():
    result = parse_hex_colors("aabbcc ddeeff 001122 334455 667788")
    assert result["primary"] == "#AABBCC"
    assert result["secondary"] == "#DDEEFF"
    assert result["accent"] == "#001122"
    assert result["background"] == "#334455"
    assert result["text"] == "#667788"


# ---------------------------------------------------------------------------
# 5. extract_colors_from_image — local file path (mocked colorthief)
# ---------------------------------------------------------------------------

def test_extract_colors_from_local_file(tmp_path):
    fake_image = tmp_path / "logo.png"
    fake_image.write_bytes(b"fake-image-bytes")

    fake_palette = [
        (26, 26, 46),
        (22, 33, 62),
        (233, 69, 96),
        (15, 52, 96),
        (255, 255, 255),
    ]

    with patch("scripts.carousel_brand.colorthief.ColorThief") as mock_ct_cls:
        mock_ct = MagicMock()
        mock_ct_cls.return_value = mock_ct
        mock_ct.get_palette.return_value = fake_palette

        result = extract_colors_from_image(str(fake_image))

    assert result == ["#1A1A2E", "#16213E", "#E94560", "#0F3460", "#FFFFFF"]
    mock_ct.get_palette.assert_called_once_with(color_count=5)


# ---------------------------------------------------------------------------
# 6. extract_colors_from_image — URL (mocked requests + colorthief)
# ---------------------------------------------------------------------------

def test_extract_colors_from_url():
    fake_palette = [
        (10, 20, 30),
        (40, 50, 60),
        (70, 80, 90),
        (100, 110, 120),
        (130, 140, 150),
    ]

    mock_response = MagicMock()
    mock_response.content = b"fake-image-bytes"
    mock_response.raise_for_status = MagicMock()

    with (
        patch("scripts.carousel_brand.requests.get", return_value=mock_response) as mock_get,
        patch("scripts.carousel_brand.colorthief.ColorThief") as mock_ct_cls,
    ):
        mock_ct = MagicMock()
        mock_ct_cls.return_value = mock_ct
        mock_ct.get_palette.return_value = fake_palette

        result = extract_colors_from_image("https://example.com/logo.png")

    mock_get.assert_called_once_with("https://example.com/logo.png")
    mock_response.raise_for_status.assert_called_once()
    assert result == ["#0A141E", "#28323C", "#46505A", "#646E78", "#828C96"]


# ---------------------------------------------------------------------------
# 7. extract_colors_from_image — raises RuntimeError when colorthief fails
# ---------------------------------------------------------------------------

def test_extract_colors_raises_runtime_error_on_colorthief_failure(tmp_path):
    fake_image = tmp_path / "broken.png"
    fake_image.write_bytes(b"not-a-real-image")

    with patch("scripts.carousel_brand.colorthief.ColorThief") as mock_ct_cls:
        mock_ct = MagicMock()
        mock_ct_cls.return_value = mock_ct
        mock_ct.get_palette.side_effect = Exception("cannot read palette")

        with pytest.raises(RuntimeError, match="Color extraction failed"):
            extract_colors_from_image(str(fake_image))


# ---------------------------------------------------------------------------
# 8. assign_color_roles — maps 5 colors to correct roles in order
# ---------------------------------------------------------------------------

def test_assign_color_roles_maps_in_order():
    colors = ["#1A1A2E", "#16213E", "#E94560", "#0F3460", "#FFFFFF"]
    result = assign_color_roles(colors)
    assert result == {
        "primary": "#1A1A2E",
        "secondary": "#16213E",
        "accent": "#E94560",
        "background": "#0F3460",
        "text": "#FFFFFF",
    }


# ---------------------------------------------------------------------------
# 9. build_brand_dict — returns correct full schema structure with null fields
# ---------------------------------------------------------------------------

def test_build_brand_dict_returns_correct_schema():
    colors = {
        "primary": "#1A1A2E",
        "secondary": "#16213E",
        "accent": "#E94560",
        "background": "#0F3460",
        "text": "#FFFFFF",
    }
    brand = build_brand_dict(colors)

    assert brand["colors"] == colors
    assert brand["font"] is None
    assert brand["logo_path"] is None
    assert brand["voice_tone"] is None
    assert set(brand.keys()) == {"colors", "font", "logo_path", "voice_tone"}


# ---------------------------------------------------------------------------
# 10. save_brand — writes valid JSON file at given path
# ---------------------------------------------------------------------------

def test_save_brand_writes_valid_json(tmp_path):
    brand = {
        "colors": {
            "primary": "#1A1A2E",
            "secondary": "#16213E",
            "accent": "#E94560",
            "background": "#0F3460",
            "text": "#FFFFFF",
        },
        "font": None,
        "logo_path": None,
        "voice_tone": None,
    }
    out_path = tmp_path / "CAROUSEL-BRAND.json"

    result = save_brand(brand, out_path)

    assert result == out_path
    assert out_path.exists()
    loaded = json.loads(out_path.read_text(encoding="utf-8"))
    assert loaded == brand


# ---------------------------------------------------------------------------
# 11. save_brand — creates parent directories if they don't exist
# ---------------------------------------------------------------------------

def test_save_brand_creates_parent_directories(tmp_path):
    brand = {"colors": {}, "font": None, "logo_path": None, "voice_tone": None}
    nested_path = tmp_path / "a" / "b" / "c" / "CAROUSEL-BRAND.json"

    result = save_brand(brand, nested_path)

    assert result == nested_path
    assert nested_path.exists()
    assert nested_path.parent.is_dir()
