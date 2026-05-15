"""Tests for scripts/repurpose.py — Repurpose pipeline helpers."""

import json
import textwrap
from pathlib import Path

import pytest

from scripts.repurpose import resolve_source


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
