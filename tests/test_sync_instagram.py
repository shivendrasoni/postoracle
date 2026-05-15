"""Tests for scripts/sync_instagram.py — Instagram saved posts sync."""

import json
from pathlib import Path
from unittest.mock import patch

import pytest

from scripts.sync_instagram import build_headers, validate_session, InstagramSessionError
from scripts.sync_instagram import parse_saved_post, parse_media_type, fetch_saved_posts_page
from scripts.sync_instagram import fetch_media_info
from scripts.sync_instagram import Index
from scripts.sync_instagram import generate_markdown, write_post_file
from scripts.sync_instagram import sync_saved_posts
from scripts.sync_instagram import parse_collection, sync_all_collections


class TestBuildHeaders:
    def test_builds_valid_headers(self):
        headers = build_headers(
            session_id="abc123",
            csrf_token="tok456",
            ds_user_id="789",
        )
        assert headers["Cookie"] == "sessionid=abc123; csrftoken=tok456; ds_user_id=789"
        assert headers["X-CSRFToken"] == "tok456"
        assert headers["X-IG-App-ID"] == "936619743392459"
        assert headers["X-Requested-With"] == "XMLHttpRequest"

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
        "pk": "3456789012",
        "caption": {"text": "Watch this reel"},
        "media_type": 2,
        "product_type": "clips",
        "user": {"username": "reelmaker"},
        "taken_at": 1715300000,
        "like_count": 10000,
        "comment_count": 200,
        "play_count": 50000,
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
        assert result["view_count"] == 50000

    def test_handles_missing_caption(self):
        result = parse_saved_post(SAMPLE_SINGLE_ITEM)
        assert result["caption"] == ""

    def test_parses_timestamp(self):
        result = parse_saved_post(SAMPLE_ITEM)
        assert result["date_published"].startswith("2024-05-08")

    @patch("scripts.sync_instagram.fetch_media_info")
    def test_fetches_media_info_when_comment_count_zero(self, mock_info):
        mock_info.return_value = {
            "comment_count": 87,
            "play_count": 120000,
        }
        item_with_zero = {
            "media": {
                **SAMPLE_REEL_ITEM["media"],
                "comment_count": 0,
                "play_count": 0,
            }
        }
        result = parse_saved_post(item_with_zero, headers={"fake": "h"})
        assert result["comment_count"] == 87
        assert result["view_count"] == 120000
        mock_info.assert_called_once()

    def test_skips_media_info_when_no_headers(self):
        item_with_zero = {
            "media": {
                **SAMPLE_REEL_ITEM["media"],
                "comment_count": 0,
                "play_count": 0,
            }
        }
        result = parse_saved_post(item_with_zero)
        assert result["comment_count"] == 0
        assert result["view_count"] == 0


class TestIndex:
    def test_load_empty(self, tmp_path):
        idx = Index(tmp_path / "_index.json")
        assert idx.entries == {}

    def test_add_and_has(self, tmp_path):
        idx = Index(tmp_path / "_index.json")
        idx.add("ABC123", "2026-05-14-abc123.md", collection="Inspiration")
        assert idx.has("ABC123")
        assert not idx.has("XYZ999")

    def test_persists_to_disk(self, tmp_path):
        path = tmp_path / "_index.json"
        idx = Index(path)
        idx.add("ABC123", "file.md")
        idx.save()

        idx2 = Index(path)
        assert idx2.has("ABC123")
        assert idx2.entries["ABC123"]["file"] == "file.md"

    def test_add_updates_existing(self, tmp_path):
        idx = Index(tmp_path / "_index.json")
        idx.add("ABC123", "old.md", collection="Old")
        idx.add("ABC123", "new.md", collection="New")
        assert idx.entries["ABC123"]["file"] == "new.md"
        assert idx.entries["ABC123"]["collection"] == "New"

    def test_count(self, tmp_path):
        idx = Index(tmp_path / "_index.json")
        idx.add("A", "a.md")
        idx.add("B", "b.md")
        assert idx.count() == 2


class TestGenerateMarkdown:
    def test_full_post(self):
        post = {
            "shortcode": "DKxyz123",
            "type": "carousel",
            "author": "designguru",
            "author_name": "Design Guru",
            "caption": "Great design inspo\n#design #ui",
            "link": "https://www.instagram.com/p/DKxyz123/",
            "date_published": "2024-05-08T16:00:00Z",
            "like_count": 4521,
            "comment_count": 87,
            "view_count": 50000,
            "thumbnail_url": "https://example.com/thumb.jpg",
        }
        md = generate_markdown(post, collection="Design Inspiration", date_saved="2026-05-14")
        assert "source: instagram" in md
        assert "type: carousel" in md
        assert 'author: "@designguru"' in md
        assert "collection: Design Inspiration" in md
        assert "like_count: 4521" in md
        assert "view_count: 50000" in md
        assert "Great design inspo" in md

    def test_empty_caption(self):
        post = {
            "shortcode": "DKempty",
            "type": "post",
            "author": "someone",
            "author_name": "",
            "caption": "",
            "link": "https://www.instagram.com/p/DKempty/",
            "date_published": "2024-01-01T00:00:00Z",
            "like_count": 10,
            "comment_count": 0,
            "view_count": 0,
            "thumbnail_url": "",
        }
        md = generate_markdown(post, collection="All Posts")
        assert "---\n\n\n" in md
        assert "view_count" not in md


class TestWritePostFile:
    def test_creates_file(self, tmp_path):
        post = {
            "shortcode": "DKtest1",
            "type": "reel",
            "author": "testuser",
            "author_name": "Test",
            "caption": "Hello world",
            "link": "https://www.instagram.com/reel/DKtest1/",
            "date_published": "2024-06-01T12:00:00Z",
            "like_count": 100,
            "comment_count": 5,
            "view_count": 2000,
            "thumbnail_url": "",
        }
        filepath = write_post_file(post, tmp_path, collection="Saved")
        assert filepath.exists()
        content = filepath.read_text()
        assert "shortcode: DKtest1" in content
        assert "Hello world" in content

    def test_filename_format(self, tmp_path):
        post = {
            "shortcode": "DKname1",
            "type": "carousel",
            "author": "designguru",
            "author_name": "",
            "caption": "Some long caption that should be truncated for the filename",
            "link": "https://www.instagram.com/p/DKname1/",
            "date_published": "2024-06-01T12:00:00Z",
            "like_count": 0,
            "comment_count": 0,
            "view_count": 0,
            "thumbnail_url": "",
        }
        filepath = write_post_file(post, tmp_path)
        assert filepath.name.startswith("DKname1-")
        assert filepath.suffix == ".md"


SAMPLE_API_RESPONSE = {
    "items": [SAMPLE_ITEM, SAMPLE_REEL_ITEM, SAMPLE_SINGLE_ITEM],
    "more_available": False,
    "next_max_id": None,
    "status": "ok",
}


class TestSyncSavedPosts:
    @patch("scripts.sync_instagram.fetch_saved_posts_page")
    def test_syncs_new_posts(self, mock_fetch, tmp_path):
        mock_fetch.return_value = SAMPLE_API_RESPONSE
        index_path = tmp_path / "_index.json"
        result = sync_saved_posts(
            headers={"fake": "headers"},
            vault_dir=tmp_path,
            index_path=index_path,
            refresh=False,
        )
        assert result["synced"] == 3
        assert result["skipped"] == 0
        assert (tmp_path / "_index.json").exists()
        md_files = list(tmp_path.glob("*.md"))
        assert len(md_files) == 3

    @patch("scripts.sync_instagram.fetch_saved_posts_page")
    def test_skips_existing_on_default_sync(self, mock_fetch, tmp_path):
        index_path = tmp_path / "_index.json"
        idx = Index(index_path)
        idx.add("DKxyz123", "existing.md")
        idx.save()

        mock_fetch.return_value = SAMPLE_API_RESPONSE
        result = sync_saved_posts(
            headers={"fake": "headers"},
            vault_dir=tmp_path,
            index_path=index_path,
            refresh=False,
        )
        assert result["synced"] == 2
        assert result["skipped"] == 1

    @patch("scripts.sync_instagram.fetch_saved_posts_page")
    def test_refresh_overwrites_existing(self, mock_fetch, tmp_path):
        index_path = tmp_path / "_index.json"
        idx = Index(index_path)
        idx.add("DKxyz123", "existing.md")
        idx.save()

        mock_fetch.return_value = SAMPLE_API_RESPONSE
        result = sync_saved_posts(
            headers={"fake": "headers"},
            vault_dir=tmp_path,
            index_path=index_path,
            refresh=True,
        )
        assert result["synced"] == 3
        assert result["skipped"] == 0


SAMPLE_COLLECTIONS_RESPONSE = [
    {
        "collection_id": "17850123456",
        "collection_name": "Design Inspiration",
        "collection_media_count": 42,
    },
    {
        "collection_id": "17850789012",
        "collection_name": "Copywriting",
        "collection_media_count": 18,
    },
]


class TestParseCollection:
    def test_parses_fields(self):
        result = parse_collection(SAMPLE_COLLECTIONS_RESPONSE[0])
        assert result["id"] == "17850123456"
        assert result["name"] == "Design Inspiration"
        assert result["count"] == 42


class TestSyncAllCollections:
    @patch("scripts.sync_instagram.sync_saved_posts")
    @patch("scripts.sync_instagram.fetch_collections")
    def test_syncs_each_collection(self, mock_fetch_cols, mock_sync, tmp_path):
        mock_fetch_cols.return_value = SAMPLE_COLLECTIONS_RESPONSE
        mock_sync.return_value = {"synced": 5, "skipped": 0, "errors": [], "total_indexed": 5}

        result = sync_all_collections(
            headers={"fake": "headers"},
            vault_dir=tmp_path,
            index_path=tmp_path / "_index.json",
        )
        assert mock_sync.call_count == 2
        assert result["collections_synced"] == 2

    @patch("scripts.sync_instagram.sync_saved_posts")
    @patch("scripts.sync_instagram.fetch_collections")
    def test_filters_by_collection_name(self, mock_fetch_cols, mock_sync, tmp_path):
        mock_fetch_cols.return_value = SAMPLE_COLLECTIONS_RESPONSE
        mock_sync.return_value = {"synced": 5, "skipped": 0, "errors": [], "total_indexed": 5}

        result = sync_all_collections(
            headers={"fake": "headers"},
            vault_dir=tmp_path,
            index_path=tmp_path / "_index.json",
            filter_name="Copywriting",
        )
        assert mock_sync.call_count == 1
