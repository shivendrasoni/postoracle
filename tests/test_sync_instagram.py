"""Tests for scripts/sync_instagram.py — Instagram saved posts sync."""

import json
from pathlib import Path
from unittest.mock import patch

import pytest

from scripts.sync_instagram import build_headers, validate_session, InstagramSessionError
from scripts.sync_instagram import parse_saved_post, parse_media_type, fetch_saved_posts_page


class TestBuildHeaders:
    def test_builds_valid_headers(self):
        headers = build_headers(
            session_id="abc123",
            csrf_token="tok456",
            ds_user_id="789",
        )
        assert headers["Cookie"] == "sessionid=abc123; csrftoken=tok456; ds_user_id=789"
        assert headers["X-CSRFToken"] == "tok456"
        assert "Instagram" in headers["User-Agent"]
        assert headers["X-IG-App-ID"] == "936619743392459"

    def test_missing_session_id_raises(self):
        with pytest.raises(InstagramSessionError, match="sessionid"):
            build_headers(session_id="", csrf_token="tok", ds_user_id="123")

    def test_missing_csrf_token_raises(self):
        with pytest.raises(InstagramSessionError, match="csrftoken"):
            build_headers(session_id="abc", csrf_token="", ds_user_id="123")

    def test_missing_ds_user_id_raises(self):
        with pytest.raises(InstagramSessionError, match="ds_user_id"):
            build_headers(session_id="abc", csrf_token="tok", ds_user_id="")


SAMPLE_ITEM = {
    "media": {
        "code": "DKxyz123",
        "caption": {"text": "Great design inspo\n#design #ui"},
        "media_type": 8,
        "carousel_media_count": 5,
        "user": {"username": "designguru", "full_name": "Design Guru"},
        "taken_at": 1715200000,
        "like_count": 4521,
        "comment_count": 87,
        "image_versions2": {"candidates": [{"url": "https://example.com/thumb.jpg"}]},
        "permalink": "https://www.instagram.com/p/DKxyz123/",
    }
}

SAMPLE_REEL_ITEM = {
    "media": {
        "code": "DKreel99",
        "caption": {"text": "Watch this reel"},
        "media_type": 2,
        "product_type": "clips",
        "user": {"username": "reelmaker"},
        "taken_at": 1715300000,
        "like_count": 10000,
        "comment_count": 200,
    }
}

SAMPLE_SINGLE_ITEM = {
    "media": {
        "code": "DKsingle1",
        "caption": None,
        "media_type": 1,
        "user": {"username": "photog"},
        "taken_at": 1715100000,
        "like_count": 500,
        "comment_count": 12,
    }
}


class TestParseMediaType:
    def test_carousel(self):
        assert parse_media_type(SAMPLE_ITEM["media"]) == "carousel"

    def test_reel(self):
        assert parse_media_type(SAMPLE_REEL_ITEM["media"]) == "reel"

    def test_single_image(self):
        assert parse_media_type(SAMPLE_SINGLE_ITEM["media"]) == "post"

    def test_video_not_reel(self):
        media = {"media_type": 2, "product_type": "feed"}
        assert parse_media_type(media) == "post"


class TestParseSavedPost:
    def test_parses_carousel(self):
        result = parse_saved_post(SAMPLE_ITEM)
        assert result["shortcode"] == "DKxyz123"
        assert result["type"] == "carousel"
        assert result["author"] == "designguru"
        assert result["caption"] == "Great design inspo\n#design #ui"
        assert result["like_count"] == 4521
        assert result["comment_count"] == 87
        assert result["link"] == "https://www.instagram.com/p/DKxyz123/"

    def test_parses_reel(self):
        result = parse_saved_post(SAMPLE_REEL_ITEM)
        assert result["shortcode"] == "DKreel99"
        assert result["type"] == "reel"
        assert result["link"] == "https://www.instagram.com/reel/DKreel99/"

    def test_handles_missing_caption(self):
        result = parse_saved_post(SAMPLE_SINGLE_ITEM)
        assert result["caption"] == ""

    def test_parses_timestamp(self):
        result = parse_saved_post(SAMPLE_ITEM)
        assert result["date_published"].startswith("2024-05-08")
