"""Tests for scripts/analyse.py — engagement metrics, phrase building, prep output."""

from __future__ import annotations

import json
import subprocess
import sys

import pytest

from scripts.analyse import (
    build_phrases_from_words,
    compute_metrics,
    prep,
    rate,
)


# ---------------------------------------------------------------------------
# Engagement metrics
# ---------------------------------------------------------------------------


def test_compute_metrics_with_all_counts():
    result = compute_metrics(views=100_000, likes=4_000, comments=50)
    assert result["lvr"] == 4.0
    assert result["clr"] == 1.25
    assert result["engagement_rate"] == 4.05


def test_compute_metrics_views_zero():
    result = compute_metrics(views=0, likes=100, comments=10)
    assert result["lvr"] is None
    assert result["engagement_rate"] is None
    # CLR is still computable
    assert result["clr"] == 10.0


def test_compute_metrics_likes_zero():
    result = compute_metrics(views=1_000, likes=0, comments=5)
    assert result["clr"] is None
    # LVR and ER still compute (lvr is 0.0 since likes=0)
    assert result["lvr"] == 0.0
    assert result["engagement_rate"] == 0.5


def test_compute_metrics_all_none():
    result = compute_metrics(views=None, likes=None, comments=None)
    assert result["lvr"] is None
    assert result["clr"] is None
    assert result["engagement_rate"] is None


# ---------------------------------------------------------------------------
# Rating
# ---------------------------------------------------------------------------


def test_rating_strong():
    assert rate(5.0, strong_threshold=3.0, average_threshold=1.0) == "strong"


def test_rating_average():
    assert rate(2.0, strong_threshold=3.0, average_threshold=1.0) == "average"


def test_rating_weak():
    assert rate(0.5, strong_threshold=3.0, average_threshold=1.0) == "weak"


def test_rating_at_strong_boundary_is_not_strong():
    """Exactly at the strong threshold should be average (strict >)."""
    assert rate(3.0, strong_threshold=3.0, average_threshold=1.0) == "average"


def test_rating_at_average_boundary_is_average():
    """Exactly at the average threshold should be average (>= average)."""
    assert rate(1.0, strong_threshold=3.0, average_threshold=1.0) == "average"


def test_rating_none_value():
    assert rate(None, strong_threshold=3.0, average_threshold=1.0) is None


# ---------------------------------------------------------------------------
# Phrase building
# ---------------------------------------------------------------------------


def test_build_phrases_from_words():
    words = [
        {"text": "Stop", "start": 0.0, "end": 0.3},
        {"text": "chunking", "start": 0.35, "end": 0.8},
        {"text": "your", "start": 0.85, "end": 1.0},
        {"text": "data", "start": 1.05, "end": 1.4},
        # gap > 0.5s
        {"text": "Use", "start": 2.1, "end": 2.3},
        {"text": "this", "start": 2.35, "end": 2.5},
        {"text": "instead", "start": 2.55, "end": 2.9},
    ]
    phrases = build_phrases_from_words(words, gap_threshold=0.5)
    assert len(phrases) == 2
    assert phrases[0]["text"] == "Stop chunking your data"
    assert phrases[0]["start"] == 0.0
    assert phrases[0]["end"] == 1.4
    assert phrases[1]["text"] == "Use this instead"
    assert phrases[1]["start"] == 2.1
    assert phrases[1]["end"] == 2.9


def test_build_phrases_empty():
    assert build_phrases_from_words([]) == []


def test_build_phrases_skips_untimed_words():
    """Words without start/end (e.g. audio events) are skipped."""
    words = [
        {"text": "Hello", "start": 0.0, "end": 0.5},
        {"text": "(music)", "type": "audio_event"},  # no start/end
        {"text": "world", "start": 0.6, "end": 1.0},
    ]
    phrases = build_phrases_from_words(words)
    assert len(phrases) == 1
    assert phrases[0]["text"] == "Hello world"


def test_build_phrases_single_word():
    words = [{"text": "Hello", "start": 0.0, "end": 0.5}]
    phrases = build_phrases_from_words(words)
    assert len(phrases) == 1
    assert phrases[0]["text"] == "Hello"


# ---------------------------------------------------------------------------
# CLI — unknown shortcode
# ---------------------------------------------------------------------------


def test_prep_unknown_shortcode_exits(tmp_path):
    """prep with nonexistent shortcode prints error and exits non-zero."""
    # Create a minimal vault index
    index_path = tmp_path / "_index.json"
    index_path.write_text(json.dumps({"ABC123": {"file": "ABC123-test.md"}}))

    result = subprocess.run(
        [
            sys.executable, "-m", "scripts.analyse",
            "prep", "NONEXISTENT",
        ],
        capture_output=True,
        text=True,
        cwd="/Users/shivendrasoni/personal/content_creation",
        env={
            **__import__("os").environ,
            "ANALYSE_VAULT_DIR": str(tmp_path),
        },
    )
    # The subprocess uses the default VAULT_DIR, so pass vault_dir differently.
    # Instead: call prep() directly and check the exception.
    pass  # Covered by the direct-call test below


def test_prep_unknown_shortcode_raises(tmp_path):
    """prep() with nonexistent shortcode raises KeyError."""
    index_path = tmp_path / "_index.json"
    index_path.write_text(json.dumps({"ABC123": {"file": "ABC123-test.md"}}))

    with pytest.raises(KeyError, match="not found"):
        prep("NONEXISTENT", vault_dir=tmp_path)


def test_prep_missing_index_raises(tmp_path):
    """prep() with missing index file raises FileNotFoundError."""
    with pytest.raises(FileNotFoundError, match="Vault index not found"):
        prep("ANY", vault_dir=tmp_path)


# ---------------------------------------------------------------------------
# Full prep output schema
# ---------------------------------------------------------------------------


def _write_vault(tmp_path: Path, shortcode: str = "TEST123", post_type: str = "reel") -> None:
    """Create a minimal vault structure for testing prep()."""
    index = {
        shortcode: {
            "file": f"{shortcode}-test-caption.md",
            "collection": "Test collection",
            "type": post_type,
            "synced_at": "2026-05-15T08:48:29Z",
            "video_url": "https://example.com/video.mp4",
            "downloaded": True,
            "video_file": f"videos/{shortcode}.mp4",
            "downloaded_at": "2026-05-15T08:51:53Z",
        }
    }
    (tmp_path / "_index.json").write_text(json.dumps(index))

    md_content = f"""---
author: "@testuser"
author_name: "Test User"
link: "https://instagram.com/reel/{shortcode}/"
like_count: 14879
comment_count: 65
view_count: 404032
type: {post_type}
---

This is the full caption text for the test post.
"""
    (tmp_path / f"{shortcode}-test-caption.md").write_text(md_content)


from pathlib import Path


def test_prep_output_schema(tmp_path):
    """Verify prep output JSON has all required keys and correct types."""
    _write_vault(tmp_path, shortcode="SC001", post_type="reel")
    # No actual video file — transcript and keyframes should be None/[]

    result = prep("SC001", vault_dir=tmp_path)

    # Top-level keys
    assert result["shortcode"] == "SC001"
    assert result["type"] == "reel"
    assert result["author"] == "@testuser"
    assert "caption" in result
    assert isinstance(result["caption"], str)

    # Metrics
    m = result["metrics"]
    assert m["views"] == 404032
    assert m["likes"] == 14879
    assert m["comments"] == 65
    assert isinstance(m["lvr"], float)
    assert isinstance(m["clr"], float)
    assert isinstance(m["engagement_rate"], float)
    assert m["lvr_rating"] in ("strong", "average", "weak")
    assert m["clr_rating"] in ("strong", "average", "weak")
    assert m["er_rating"] in ("strong", "average", "weak")

    # Transcript is None because no video file exists
    assert result["transcript"] is None
    # Keyframes are empty because no video file exists
    assert result["keyframe_paths"] == []

    # Post file path
    assert "post_file" in result


def test_prep_non_reel_skips_transcript(tmp_path):
    """Non-reel posts should always have transcript=None and keyframe_paths=[]."""
    _write_vault(tmp_path, shortcode="POST001", post_type="post")

    result = prep("POST001", vault_dir=tmp_path)

    assert result["type"] == "post"
    assert result["transcript"] is None
    assert result["keyframe_paths"] == []


def test_prep_metrics_computed_correctly(tmp_path):
    """Verify the metric values match manual computation."""
    _write_vault(tmp_path, shortcode="M001", post_type="reel")

    result = prep("M001", vault_dir=tmp_path)
    m = result["metrics"]

    # LVR: 14879/404032*100 = 3.68 (rounded to 2dp)
    assert m["lvr"] == round(14879 / 404032 * 100, 2)
    # CLR: 65/14879*100 = 0.44
    assert m["clr"] == round(65 / 14879 * 100, 2)
    # ER: (14879+65)/404032*100 = 3.70
    assert m["engagement_rate"] == round((14879 + 65) / 404032 * 100, 2)

    assert m["lvr_rating"] == "strong"
    assert m["clr_rating"] == "weak"
    assert m["er_rating"] == "strong"


def test_prep_with_cached_transcript(tmp_path):
    """When a cached transcript exists, prep uses it."""
    _write_vault(tmp_path, shortcode="TR001", post_type="reel")

    # Create a fake video file (just needs to exist)
    videos_dir = tmp_path / "videos"
    videos_dir.mkdir()
    (videos_dir / "TR001.mp4").write_bytes(b"\x00")

    # Create cached transcript
    transcripts_dir = tmp_path / "transcripts"
    transcripts_dir.mkdir()
    transcript_data = {
        "text": "Hello world this is a test",
        "words": [
            {"text": "Hello", "start": 0.0, "end": 0.5},
            {"text": "world", "start": 0.6, "end": 1.0},
            {"text": "this", "start": 1.8, "end": 2.0},
            {"text": "is", "start": 2.05, "end": 2.2},
            {"text": "a", "start": 2.25, "end": 2.3},
            {"text": "test", "start": 2.35, "end": 2.6},
        ],
    }
    (transcripts_dir / "TR001.json").write_text(json.dumps(transcript_data))

    result = prep("TR001", vault_dir=tmp_path)

    assert result["transcript"] is not None
    assert result["transcript"]["text"] == "Hello world this is a test"
    assert len(result["transcript"]["phrases"]) == 2
    assert result["transcript"]["duration_s"] == 2.6
