"""Tests for scripts/repurpose.py — Repurpose pipeline helpers."""

import json
import textwrap
from pathlib import Path
from unittest.mock import patch, MagicMock

import pytest

from scripts.repurpose import resolve_source, _extract_shortcode_from_url, transcribe_source, build_repurpose_frontmatter


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


class TestTranscribeSource:
    def test_calls_transcribe_and_pack(self, tmp_path):
        video = tmp_path / "source.mp4"
        video.write_bytes(b"fake-video")
        work_dir = tmp_path / "work"
        work_dir.mkdir()
        edit_dir = work_dir / "edit"

        # Pre-create what transcribe_one would produce
        transcripts_dir = edit_dir / "transcripts"
        transcripts_dir.mkdir(parents=True)
        transcript_json = transcripts_dir / "source.json"
        transcript_json.write_text(json.dumps({
            "words": [
                {"type": "word", "text": "Hello", "start": 0.0, "end": 0.5, "speaker_id": "speaker_0"},
                {"type": "spacing", "start": 0.5, "end": 0.6},
                {"type": "word", "text": "world", "start": 0.6, "end": 1.0, "speaker_id": "speaker_0"},
            ]
        }))

        with patch("scripts.repurpose.load_api_key", return_value="fake-key"), \
             patch("scripts.repurpose.transcribe_one") as mock_transcribe:
            mock_transcribe.return_value = transcript_json
            result = transcribe_source(video, work_dir)

        mock_transcribe.assert_called_once()
        assert result.exists()
        assert result.name == "takes_packed.md"
        content = result.read_text()
        assert "Hello" in content
        assert "world" in content

    def test_uses_cached_transcript(self, tmp_path):
        video = tmp_path / "source.mp4"
        video.write_bytes(b"fake")
        work_dir = tmp_path / "work"
        edit_dir = work_dir / "edit"
        transcripts_dir = edit_dir / "transcripts"
        transcripts_dir.mkdir(parents=True)

        transcript_json = transcripts_dir / "source.json"
        transcript_json.write_text(json.dumps({
            "words": [
                {"type": "word", "text": "cached", "start": 0.0, "end": 0.5, "speaker_id": "speaker_0"},
            ]
        }))

        with patch("scripts.repurpose.load_api_key", return_value="fake-key"), \
             patch("scripts.repurpose.transcribe_one") as mock_transcribe:
            mock_transcribe.return_value = transcript_json
            result = transcribe_source(video, work_dir)

        # transcribe_one is still called (it handles its own caching)
        mock_transcribe.assert_called_once()
        assert "cached" in result.read_text()


class TestBuildRepurposeFrontmatter:
    def test_builds_frontmatter_from_vault_source(self):
        source_meta = {
            "shortcode": "DI3RGhLNXPc",
            "link": "https://www.instagram.com/reel/DI3RGhLNXPc/",
            "author": "@namratarchawla",
            "author_name": "Namrata Chawla",
            "caption": "Some secret tips for Instagram right from the source.",
            "view_count": 1188025,
            "source_type": "vault",
        }

        fm = build_repurpose_frontmatter(source_meta)

        assert fm["source_shortcode"] == "DI3RGhLNXPc"
        assert fm["source_url"] == "https://www.instagram.com/reel/DI3RGhLNXPc/"
        assert fm["source_author"] == "@namratarchawla"
        assert fm["source_title"] == "Some secret tips for Instagram right from the source."
        assert fm["repurposed"] is True

    def test_builds_frontmatter_from_local_source(self):
        source_meta = {
            "shortcode": "",
            "link": "",
            "author": "",
            "author_name": "",
            "caption": "",
            "view_count": 0,
            "source_type": "local",
        }

        fm = build_repurpose_frontmatter(source_meta)

        assert fm["source_shortcode"] == ""
        assert fm["source_url"] == ""
        assert fm["source_author"] == ""
        assert fm["repurposed"] is True

    def test_source_title_truncated_to_first_line(self):
        source_meta = {
            "shortcode": "ABC",
            "link": "https://instagram.com/reel/ABC/",
            "author": "@creator",
            "author_name": "Creator",
            "caption": "First line of caption\nSecond line\nThird line",
            "view_count": 500,
            "source_type": "vault",
        }

        fm = build_repurpose_frontmatter(source_meta)
        assert fm["source_title"] == "First line of caption"
