"""
Tests for scripts/import_platform.py
"""
import csv
import json
from pathlib import Path

import pytest

from scripts.import_platform import (
    _strip_hashtags,
    parse_instagram,
    parse_linkedin,
    parse_twitter,
    scan_imports_dir,
)


# ---------------------------------------------------------------------------
# _strip_hashtags
# ---------------------------------------------------------------------------

def test_strip_hashtags_removes_hashtag_tokens():
    result = _strip_hashtags("Great tips for AI #ai #tech #coding")
    assert "#" not in result
    assert "Great tips for AI" in result


def test_strip_hashtags_preserves_body_text():
    result = _strip_hashtags("Hello world")
    assert result == "Hello world"


def test_strip_hashtags_returns_empty_for_hashtags_only():
    result = _strip_hashtags("#ai #tech #coding")
    assert result == ""


# ---------------------------------------------------------------------------
# parse_instagram
# ---------------------------------------------------------------------------

def test_parse_instagram_extracts_caption_bodies(tmp_path):
    data = {
        "data": [
            {"media": [{"title": "This is my first post #ai #tech"}]},
            {"media": [{"title": "Second post with no hashtags"}]},
        ]
    }
    f = tmp_path / "posts_1.json"
    f.write_text(json.dumps(data), encoding="utf-8")
    result = parse_instagram(f)
    assert len(result) == 2
    assert "#ai" not in result[0]
    assert "This is my first post" in result[0]
    assert result[1] == "Second post with no hashtags"


def test_parse_instagram_skips_hashtag_only_captions(tmp_path):
    data = {"data": [{"media": [{"title": "#ai #tech #coding"}]}]}
    f = tmp_path / "posts_1.json"
    f.write_text(json.dumps(data), encoding="utf-8")
    result = parse_instagram(f)
    assert result == []


def test_parse_instagram_skips_empty_titles(tmp_path):
    data = {"data": [{"media": [{"title": ""}]}]}
    f = tmp_path / "posts_1.json"
    f.write_text(json.dumps(data), encoding="utf-8")
    result = parse_instagram(f)
    assert result == []


# ---------------------------------------------------------------------------
# parse_linkedin
# ---------------------------------------------------------------------------

def test_parse_linkedin_extracts_share_commentary(tmp_path):
    f = tmp_path / "shares.csv"
    with f.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=["ShareCommentary", "Other"])
        writer.writeheader()
        writer.writerow({"ShareCommentary": "Big insight about AI", "Other": "x"})
        writer.writerow({"ShareCommentary": "", "Other": "y"})
        writer.writerow({"ShareCommentary": "Another insight", "Other": "z"})
    result = parse_linkedin(f)
    assert result == ["Big insight about AI", "Another insight"]


def test_parse_linkedin_skips_empty_commentary(tmp_path):
    f = tmp_path / "shares.csv"
    with f.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=["ShareCommentary"])
        writer.writeheader()
        writer.writerow({"ShareCommentary": "   "})
    result = parse_linkedin(f)
    assert result == []


# ---------------------------------------------------------------------------
# parse_twitter
# ---------------------------------------------------------------------------

def _write_tweets_js(path: Path, tweets: list[dict]) -> None:
    entries = [{"tweet": t} for t in tweets]
    path.write_text(
        f"window.YTD.tweets.part0 = {json.dumps(entries)}",
        encoding="utf-8",
    )


def test_parse_twitter_extracts_full_text(tmp_path):
    f = tmp_path / "tweets.js"
    _write_tweets_js(f, [
        {"full_text": "This is my original tweet"},
        {"full_text": "Another original thought"},
    ])
    result = parse_twitter(f)
    assert result == ["This is my original tweet", "Another original thought"]


def test_parse_twitter_filters_retweets(tmp_path):
    f = tmp_path / "tweets.js"
    _write_tweets_js(f, [
        {"full_text": "RT @someuser: This is a retweet"},
        {"full_text": "My own tweet"},
    ])
    result = parse_twitter(f)
    assert result == ["My own tweet"]


def test_parse_twitter_handles_missing_full_text(tmp_path):
    f = tmp_path / "tweets.js"
    entries = [{"tweet": {}}, {"tweet": {"full_text": "Valid tweet"}}]
    f.write_text(
        f"window.YTD.tweets.part0 = {json.dumps(entries)}",
        encoding="utf-8",
    )
    result = parse_twitter(f)
    assert result == ["Valid tweet"]


# ---------------------------------------------------------------------------
# scan_imports_dir
# ---------------------------------------------------------------------------

def test_scan_imports_dir_detects_known_files(tmp_path):
    imports = tmp_path / "imports"
    imports.mkdir()
    (imports / "posts_1.json").write_text("{}", encoding="utf-8")
    (imports / "shares.csv").write_text("", encoding="utf-8")
    (imports / "tweets.js").write_text("", encoding="utf-8")
    found = scan_imports_dir(imports)
    assert "instagram" in found
    assert "linkedin" in found
    assert "twitter" in found


def test_scan_imports_dir_returns_empty_for_missing_dir(tmp_path):
    found = scan_imports_dir(tmp_path / "nonexistent")
    assert found == {}


def test_scan_imports_dir_returns_empty_for_empty_folder(tmp_path):
    imports = tmp_path / "imports"
    imports.mkdir()
    found = scan_imports_dir(imports)
    assert found == {}
