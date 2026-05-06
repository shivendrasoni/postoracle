"""Tests for scripts/generate_post.py"""
import os
from io import BytesIO
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from PIL import Image


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_fake_png(width: int = 1024, height: int = 1024) -> bytes:
    """Return raw PNG bytes for mocking."""
    buf = BytesIO()
    Image.new("RGB", (width, height), "blue").save(buf, format="PNG")
    return buf.getvalue()


FAKE_PNG_BYTES = _make_fake_png()


# ---------------------------------------------------------------------------
# Brand loading
# ---------------------------------------------------------------------------

def test_load_brand_no_path_returns_fallback():
    from scripts.generate_post import load_brand, FALLBACK_PALETTE
    assert load_brand(None) == FALLBACK_PALETTE


def test_load_brand_missing_file_returns_fallback(tmp_path):
    from scripts.generate_post import load_brand, FALLBACK_PALETTE
    assert load_brand(str(tmp_path / "nope.md")) == FALLBACK_PALETTE


def test_load_brand_reads_vault_md(tmp_path):
    from scripts.generate_post import load_brand
    brand_md = tmp_path / "brand.md"
    brand_md.write_text(
        "---\nmodule: brand\ncolors:\n  primary: \"#C5F135\"\n  secondary: \"#111111\"\n"
        "  accent: \"#C5F135\"\n  background: \"#FFFFFF\"\n  text: \"#FFFFFF\"\nfont: Inter\n---\n\nNotes.",
        encoding="utf-8",
    )
    brand = load_brand(str(brand_md))
    assert brand["primary"] == "#C5F135"
    assert brand["secondary"] == "#111111"
    assert brand.get("font") == "Inter"


# ---------------------------------------------------------------------------
# Platform adaptation — Instagram
# ---------------------------------------------------------------------------

def test_adapt_instagram_resizes_to_1080x1080():
    from scripts.generate_post import adapt_instagram, INSTAGRAM_SIZE
    master = Image.new("RGB", (1024, 1024), "red")
    result = adapt_instagram(master)
    assert result.size == INSTAGRAM_SIZE


# ---------------------------------------------------------------------------
# Platform adaptation — LinkedIn
# ---------------------------------------------------------------------------

def test_adapt_linkedin_produces_1200x627():
    from scripts.generate_post import adapt_linkedin, LINKEDIN_SIZE, FALLBACK_PALETTE
    master = Image.new("RGB", (1024, 1024), "red")
    result = adapt_linkedin(master, FALLBACK_PALETTE)
    assert result.size == LINKEDIN_SIZE


def test_adapt_linkedin_has_accent_bar_at_top():
    from scripts.generate_post import adapt_linkedin, LINKEDIN_ACCENT_BAR_H, FALLBACK_PALETTE
    brand = dict(FALLBACK_PALETTE, accent="#00FF00")
    master = Image.new("RGB", (1024, 1024), "red")
    result = adapt_linkedin(master, brand)
    # Top-left pixel should be accent color
    assert result.getpixel((0, 0)) == (0, 255, 0)
    # Pixel just below accent bar should NOT be accent
    assert result.getpixel((0, LINKEDIN_ACCENT_BAR_H + 1)) != (0, 255, 0)


def test_adapt_linkedin_letterboxes_with_side_padding():
    from scripts.generate_post import adapt_linkedin, LINKEDIN_SIZE, FALLBACK_PALETTE
    brand = dict(FALLBACK_PALETTE, secondary="#111111")
    master = Image.new("RGB", (1024, 1024), "red")
    result = adapt_linkedin(master, brand)
    # Left edge at mid-height should be bg color (side padding), not image color
    mid_y = result.size[1] // 2
    assert result.getpixel((0, mid_y)) == (17, 17, 17)
    # Center pixel should be the image color (red)
    center_x = result.size[0] // 2
    assert result.getpixel((center_x, mid_y)) == (255, 0, 0)


# ---------------------------------------------------------------------------
# Image generation — generate endpoint (no reference photo)
# ---------------------------------------------------------------------------

def _make_fake_b64(width: int = 1024, height: int = 1024) -> str:
    return base64.b64encode(_make_fake_png(width, height)).decode()


import base64
FAKE_B64 = _make_fake_b64()


@patch("scripts.generate_post.openai.OpenAI")
def test_generate_master_image_calls_generate_endpoint(mock_openai_cls):
    from scripts.generate_post import generate_master_image

    mock_client = MagicMock()
    mock_client.images.generate.return_value = MagicMock(
        data=[MagicMock(b64_json=FAKE_B64)]
    )
    mock_openai_cls.return_value = mock_client

    result = generate_master_image("A dramatic landscape", api_key="test-key")

    mock_client.images.generate.assert_called_once()
    kwargs = mock_client.images.generate.call_args[1]
    assert kwargs["model"] == "gpt-image-2"
    assert kwargs["size"] == "1024x1024"
    assert kwargs["prompt"] == "A dramatic landscape"
    assert isinstance(result, bytes)
    img = Image.open(BytesIO(result))
    assert img.size == (1024, 1024)


@patch("scripts.generate_post.openai.OpenAI")
def test_generate_master_image_without_reference_does_not_call_edit(mock_openai_cls):
    from scripts.generate_post import generate_master_image

    mock_client = MagicMock()
    mock_client.images.generate.return_value = MagicMock(
        data=[MagicMock(b64_json=FAKE_B64)]
    )
    mock_openai_cls.return_value = mock_client

    generate_master_image("prompt", use_reference=False, api_key="test-key")

    mock_client.images.generate.assert_called_once()
    mock_client.images.edit.assert_not_called()


def test_generate_master_image_raises_without_api_key():
    from scripts.generate_post import generate_master_image

    with patch.dict(os.environ, {}, clear=True):
        with pytest.raises(RuntimeError, match="OPENAI_API_KEY"):
            generate_master_image("prompt")
