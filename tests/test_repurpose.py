"""Tests for scripts/repurpose.py — Repurpose pipeline helpers."""

import json
import textwrap
from pathlib import Path

import pytest

from scripts.repurpose import resolve_source, _extract_shortcode_from_url


class TestResolveSourceShortcode:
    def test_resolves_shortcode_with_downloaded_video(self, tmp_path):
        vault_dir = tmp_path / "vault" / "imports" / "instagram-saved"
        vault_dir.mkdir(parents=True)
        videos_dir = vault_dir / "videos"
        videos_dir.mkdir()

        video_file = videos_dir / "DI3RGhLNXPc.mp4"
        video_file.write_bytes(b"fake-video-data")

        index = {
            "DI3RGhLNXPc": {
                "file": "DI3RGhLNXPc-some-caption.md",
                "collection": "Content creation",
                "type": "reel",
                "video_url": "https://instagram.com/video.mp4",
                "downloaded": True,
                "video_file": "videos/DI3RGhLNXPc.mp4",
            }
        }
        (vault_dir / "_index.json").write_text(json.dumps(index))

        md_content = textwrap.dedent("""\
            ---
            source: instagram
            shortcode: DI3RGhLNXPc
            link: https://www.instagram.com/reel/DI3RGhLNXPc/
            type: reel
            author: "@namratarchawla"
            author_name: Namrata Chawla
            caption_first_line: Some secret tips for Instagram
            like_count: 27551
            comment_count: 206
            view_count: 1188025
            ---

            Some secret tips for Instagram right from the source.
        """)
        (vault_dir / "DI3RGhLNXPc-some-caption.md").write_text(md_content)

        result = resolve_source("DI3RGhLNXPc", vault_dir=vault_dir)

        assert result["shortcode"] == "DI3RGhLNXPc"
        assert result["video_path"] == video_file
        assert result["author"] == "@namratarchawla"
        assert result["author_name"] == "Namrata Chawla"
        assert result["link"] == "https://www.instagram.com/reel/DI3RGhLNXPc/"
        assert result["view_count"] == 1188025
        assert result["collection"] == "Content creation"
        assert "Some secret tips" in result["caption"]


class TestResolveSourceURL:
    def test_resolves_instagram_reel_url(self, tmp_path):
        vault_dir = tmp_path / "vault" / "imports" / "instagram-saved"
        vault_dir.mkdir(parents=True)
        videos_dir = vault_dir / "videos"
        videos_dir.mkdir()
        (videos_dir / "ABC123.mp4").write_bytes(b"fake")

        index = {
            "ABC123": {
                "file": "ABC123-caption.md",
                "collection": "Reels",
                "type": "reel",
                "downloaded": True,
                "video_file": "videos/ABC123.mp4",
            }
        }
        (vault_dir / "_index.json").write_text(json.dumps(index))
        (vault_dir / "ABC123-caption.md").write_text(textwrap.dedent("""\
            ---
            source: instagram
            shortcode: ABC123
            link: https://www.instagram.com/reel/ABC123/
            author: "@creator"
            ---

            Caption text.
        """))

        result = resolve_source(
            "https://www.instagram.com/reel/ABC123/",
            vault_dir=vault_dir,
        )
        assert result["shortcode"] == "ABC123"
        assert result["author"] == "@creator"

    def test_resolves_instagram_post_url(self, tmp_path):
        vault_dir = tmp_path / "vault" / "imports" / "instagram-saved"
        vault_dir.mkdir(parents=True)
        videos_dir = vault_dir / "videos"
        videos_dir.mkdir()
        (videos_dir / "XYZ789.mp4").write_bytes(b"fake")

        index = {
            "XYZ789": {
                "file": "XYZ789-post.md",
                "type": "post",
                "downloaded": True,
                "video_file": "videos/XYZ789.mp4",
            }
        }
        (vault_dir / "_index.json").write_text(json.dumps(index))
        (vault_dir / "XYZ789-post.md").write_text("---\nshortcode: XYZ789\n---\nBody.")

        result = resolve_source(
            "https://instagram.com/p/XYZ789/",
            vault_dir=vault_dir,
        )
        assert result["shortcode"] == "XYZ789"


class TestResolveSourceLocalPath:
    def test_resolves_local_video_file(self, tmp_path):
        video = tmp_path / "my_recording.mp4"
        video.write_bytes(b"video-data")

        result = resolve_source(str(video))

        assert result["shortcode"] == ""
        assert result["video_path"] == video.resolve()
        assert result["source_type"] == "local"
        assert result["author"] == ""

    def test_local_file_not_found_falls_through_to_shortcode(self, tmp_path):
        vault_dir = tmp_path / "vault" / "imports" / "instagram-saved"
        vault_dir.mkdir(parents=True)
        (vault_dir / "_index.json").write_text("{}")

        with pytest.raises(KeyError, match="nonexistent"):
            resolve_source("nonexistent", vault_dir=vault_dir)


class TestResolveSourceErrors:
    def test_missing_vault_index_raises(self, tmp_path):
        with pytest.raises(FileNotFoundError, match="Vault index not found"):
            resolve_source("ABC123", vault_dir=tmp_path / "nonexistent")

    def test_shortcode_not_in_index_raises(self, tmp_path):
        vault_dir = tmp_path / "vault" / "imports" / "instagram-saved"
        vault_dir.mkdir(parents=True)
        (vault_dir / "_index.json").write_text("{}")

        with pytest.raises(KeyError, match="not found in vault"):
            resolve_source("MISSING123", vault_dir=vault_dir)

    def test_video_not_downloaded_raises(self, tmp_path):
        vault_dir = tmp_path / "vault" / "imports" / "instagram-saved"
        vault_dir.mkdir(parents=True)
        index = {"ABC": {"file": "abc.md", "downloaded": False}}
        (vault_dir / "_index.json").write_text(json.dumps(index))

        with pytest.raises(FileNotFoundError, match="not downloaded"):
            resolve_source("ABC", vault_dir=vault_dir)


class TestExtractShortcodeFromURL:
    def test_reel_url(self):
        assert _extract_shortcode_from_url(
            "https://www.instagram.com/reel/DI3RGhLNXPc/"
        ) == "DI3RGhLNXPc"

    def test_post_url(self):
        assert _extract_shortcode_from_url(
            "https://www.instagram.com/p/DI3RGhLNXPc/"
        ) == "DI3RGhLNXPc"

    def test_url_without_trailing_slash(self):
        assert _extract_shortcode_from_url(
            "https://instagram.com/reel/ABC123"
        ) == "ABC123"

    def test_url_with_query_params(self):
        assert _extract_shortcode_from_url(
            "https://www.instagram.com/reel/ABC123/?igsh=abc"
        ) == "ABC123"

    def test_not_an_instagram_url(self):
        assert _extract_shortcode_from_url("https://example.com/video") == ""

    def test_empty_string(self):
        assert _extract_shortcode_from_url("") == ""

    def test_plain_shortcode_returns_empty(self):
        assert _extract_shortcode_from_url("DI3RGhLNXPc") == ""
