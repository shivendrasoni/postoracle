"""
Tests for scripts/generate_carousel.py
"""
import base64
import json
from io import BytesIO
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from PIL import Image

from scripts.generate_carousel import (
    load_brand,
    render_slide,
    write_caption,
    render_all,
    FALLBACK_PALETTE,
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_fake_png(width: int = 1024, height: int = 1024) -> str:
    """Return a base64-encoded PNG string for mocking gpt-image-2 responses."""
    buf = BytesIO()
    Image.new("RGB", (width, height), "red").save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode()


FAKE_PNG_B64 = _make_fake_png()


def _make_plan(num_slides: int = 3) -> dict:
    """Build a minimal valid plan dict with `num_slides` slides."""
    slides = []
    for i in range(1, num_slides + 1):
        layout = "image-bg-text" if i == 1 else "text-only"
        slides.append({
            "index": i,
            "type": "hook" if i == 1 else "value",
            "headline": f"Headline {i}",
            "subtext": f"Subtext {i}" if i == 1 else "",
            "body": f"Body {i}" if i > 1 else "",
            "layout": layout,
            "image_prompt": f"A prompt for slide {i}" if i == 1 else None,
        })
    return {
        "platform": "instagram",
        "dimensions": {"width": 1080, "height": 1080},
        "slides": slides,
        "post_caption": "This is the full post caption. #hashtag",
        "slide_captions": [f"Slide {i} copy" for i in range(1, num_slides + 1)],
    }


def _write_plan(tmp_path: Path, plan: dict) -> Path:
    plan_file = tmp_path / "plan.json"
    plan_file.write_text(json.dumps(plan), encoding="utf-8")
    return plan_file


def _make_mock_openai(fake_b64: str = FAKE_PNG_B64):
    """Return a patched openai.OpenAI mock that returns fake PNG data."""
    mock_client = MagicMock()
    mock_client.images.generate.return_value = MagicMock(
        data=[MagicMock(b64_json=fake_b64)]
    )
    return mock_client


# ---------------------------------------------------------------------------
# 1. load_brand returns fallback when no path given
# ---------------------------------------------------------------------------

def test_load_brand_no_path_returns_fallback():
    brand = load_brand(None)
    assert brand == FALLBACK_PALETTE


# ---------------------------------------------------------------------------
# 2. load_brand returns fallback when file doesn't exist
# ---------------------------------------------------------------------------

def test_load_brand_missing_file_returns_fallback(tmp_path):
    brand = load_brand(str(tmp_path / "nonexistent.json"))
    assert brand == FALLBACK_PALETTE


# ---------------------------------------------------------------------------
# 3. load_brand loads correct colors from a real JSON file
# ---------------------------------------------------------------------------

def test_load_brand_reads_from_file(tmp_path):
    brand_data = {
        "primary": "#AABBCC",
        "secondary": "#112233",
        "accent": "#FF0000",
        "background": "#000000",
        "text": "#FFFFFF",
    }
    brand_file = tmp_path / "CAROUSEL-BRAND.json"
    brand_file.write_text(json.dumps(brand_data), encoding="utf-8")

    brand = load_brand(str(brand_file))
    assert brand["accent"] == "#FF0000"
    assert brand["background"] == "#000000"
    assert brand["text"] == "#FFFFFF"


# ---------------------------------------------------------------------------
# 4. render_slide with text-only layout produces a PNG (no API call)
# ---------------------------------------------------------------------------

def test_render_slide_text_only_produces_png(tmp_path):
    slide = {
        "index": 2,
        "type": "value",
        "headline": "Some Headline",
        "body": "Body text here",
        "layout": "text-only",
        "image_prompt": None,
    }
    out_path = tmp_path / "2.png"
    result = render_slide(slide, out_path, {"width": 1080, "height": 1080}, FALLBACK_PALETTE)

    assert result == out_path
    assert out_path.exists()
    img = Image.open(out_path)
    assert img.size == (1080, 1080)


# ---------------------------------------------------------------------------
# 5. render_slide with image-bg-text calls gpt-image-2 and produces a PNG
# ---------------------------------------------------------------------------

@patch("scripts.generate_carousel.openai.OpenAI")
def test_render_slide_image_bg_text_calls_api_and_produces_png(mock_openai_cls, tmp_path):
    mock_client = _make_mock_openai()
    mock_openai_cls.return_value = mock_client

    slide = {
        "index": 1,
        "type": "hook",
        "headline": "Big Hook",
        "subtext": "Sub text here",
        "layout": "image-bg-text",
        "image_prompt": "A dramatic landscape",
    }
    out_path = tmp_path / "1.png"
    result = render_slide(
        slide, out_path, {"width": 1080, "height": 1080}, FALLBACK_PALETTE, api_key="test"
    )

    assert result == out_path
    assert out_path.exists()
    mock_client.images.generate.assert_called_once()
    call_kwargs = mock_client.images.generate.call_args[1]
    assert call_kwargs["model"] == "gpt-image-2"
    assert call_kwargs["response_format"] == "b64_json"
    assert call_kwargs["size"] == "1024x1024"
    img = Image.open(out_path)
    assert img.size == (1080, 1080)


# ---------------------------------------------------------------------------
# 6. render_slide with image-split layout calls gpt-image-2 and produces a PNG
# ---------------------------------------------------------------------------

@patch("scripts.generate_carousel.openai.OpenAI")
def test_render_slide_image_split_calls_api_and_produces_png(mock_openai_cls, tmp_path):
    mock_client = _make_mock_openai()
    mock_openai_cls.return_value = mock_client

    slide = {
        "index": 3,
        "type": "value",
        "headline": "Split Layout",
        "body": "Right side text",
        "layout": "image-split",
        "image_prompt": "Abstract tech background",
    }
    out_path = tmp_path / "3.png"
    result = render_slide(
        slide, out_path, {"width": 1080, "height": 1080}, FALLBACK_PALETTE, api_key="test"
    )

    assert result == out_path
    assert out_path.exists()
    mock_client.images.generate.assert_called_once()
    call_kwargs = mock_client.images.generate.call_args[1]
    assert call_kwargs["size"] == "1024x1024"
    img = Image.open(out_path)
    assert img.size == (1080, 1080)


# ---------------------------------------------------------------------------
# 7. When gpt-image-2 raises an exception for image-bg-text, fall back to text-only
# ---------------------------------------------------------------------------

@patch("scripts.generate_carousel.openai.OpenAI")
def test_render_slide_image_bg_text_api_failure_falls_back(mock_openai_cls, tmp_path):
    mock_client = MagicMock()
    mock_client.images.generate.side_effect = Exception("API timeout")
    mock_openai_cls.return_value = mock_client

    slide = {
        "index": 1,
        "type": "hook",
        "headline": "Hook Headline",
        "subtext": "Sub here",
        "layout": "image-bg-text",
        "image_prompt": "A glowing cityscape",
    }
    out_path = tmp_path / "1.png"
    # Should NOT raise — fallback to text-only
    result = render_slide(
        slide, out_path, {"width": 1080, "height": 1080}, FALLBACK_PALETTE, api_key="test"
    )

    assert result == out_path
    assert out_path.exists()
    img = Image.open(out_path)
    assert img.size == (1080, 1080)


# ---------------------------------------------------------------------------
# 8. write_caption produces caption.txt with correct sections
# ---------------------------------------------------------------------------

def test_write_caption_produces_correct_file(tmp_path):
    plan = _make_plan(3)
    out_dir = tmp_path / "out"
    out_dir.mkdir()

    caption_path = write_caption(plan, out_dir)

    assert caption_path == out_dir / "caption.txt"
    assert caption_path.exists()
    content = caption_path.read_text(encoding="utf-8")

    assert "[POST CAPTION]" in content
    assert plan["post_caption"] in content
    assert "[SLIDE COPY]" in content
    assert "---" in content
    # Each slide index should appear
    for slide in plan["slides"]:
        assert f"{slide['index']}:" in content
    # Headline and body text must appear in slide copy (not silently dropped)
    assert "Headline 2" in content
    assert "Body 2" in content


# ---------------------------------------------------------------------------
# 9. render_all with --slide N renders only that slide, skips caption.txt
# ---------------------------------------------------------------------------

@patch("scripts.generate_carousel.openai.OpenAI")
def test_render_all_single_slide_skips_caption(mock_openai_cls, tmp_path):
    mock_client = _make_mock_openai()
    mock_openai_cls.return_value = mock_client

    plan = _make_plan(3)
    # Make slide 2 text-only so no API call needed
    plan["slides"][1]["layout"] = "text-only"
    plan["slides"][1]["image_prompt"] = None

    plan_file = _write_plan(tmp_path, plan)
    out_dir = tmp_path / "out"

    render_all(plan_file, out_dir, slide_n=2, api_key="test")

    assert (out_dir / "2.png").exists()
    assert not (out_dir / "1.png").exists()
    assert not (out_dir / "3.png").exists()
    assert not (out_dir / "caption.txt").exists()


# ---------------------------------------------------------------------------
# 10. render_all renders all slides and produces caption.txt
# ---------------------------------------------------------------------------

@patch("scripts.generate_carousel.openai.OpenAI")
def test_render_all_all_slides_produces_caption(mock_openai_cls, tmp_path):
    mock_client = _make_mock_openai()
    mock_openai_cls.return_value = mock_client

    plan = _make_plan(3)
    plan_file = _write_plan(tmp_path, plan)
    out_dir = tmp_path / "out"

    render_all(plan_file, out_dir, slide_n=None, api_key="test")

    for i in range(1, 4):
        assert (out_dir / f"{i}.png").exists()
    assert (out_dir / "caption.txt").exists()


# ---------------------------------------------------------------------------
# 11. render_all exits with error when plan has fewer than 3 slides
# ---------------------------------------------------------------------------

def test_render_all_exits_on_too_few_slides(tmp_path):
    plan = _make_plan(2)  # only 2 slides
    plan_file = _write_plan(tmp_path, plan)
    out_dir = tmp_path / "out"

    with pytest.raises(SystemExit) as exc_info:
        render_all(plan_file, out_dir, api_key="test")

    assert exc_info.value.code == 1


# ---------------------------------------------------------------------------
# load_brand — vault brand.md support
# ---------------------------------------------------------------------------

def test_load_brand_reads_vault_md_frontmatter(tmp_path):
    from scripts.generate_carousel import load_brand
    brand_md = tmp_path / "brand.md"
    brand_md.write_text(
        "---\nmodule: brand\ncolors:\n  primary: \"#1A1A2E\"\n  secondary: \"#16213E\"\n  accent: \"#E94560\"\n  background: \"#0F3460\"\n  text: \"#FFFFFF\"\nfont: Inter\n---\n\nBody.",
        encoding="utf-8",
    )
    result = load_brand(str(brand_md))
    assert result["primary"] == "#1A1A2E"
    assert result["secondary"] == "#16213E"
    assert result["accent"] == "#E94560"
    assert result["background"] == "#0F3460"
    assert result["text"] == "#FFFFFF"
    assert result.get("font") == "Inter"


def test_load_brand_md_falls_back_to_fallback_palette_on_missing_file(tmp_path):
    from scripts.generate_carousel import load_brand, FALLBACK_PALETTE
    result = load_brand(str(tmp_path / "nonexistent.md"))
    assert result == dict(FALLBACK_PALETTE)


def test_load_brand_md_falls_back_on_malformed_file(tmp_path):
    from scripts.generate_carousel import load_brand, FALLBACK_PALETTE
    bad = tmp_path / "brand.md"
    bad.write_text("not yaml at all ::::", encoding="utf-8")
    result = load_brand(str(bad))
    assert result == dict(FALLBACK_PALETTE)
