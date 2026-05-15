# scripts/repurpose.py
"""repurpose.py — Helpers for the /repurpose pipeline.

Resolves saved Instagram posts to local video paths + metadata,
orchestrates transcription, and builds repurpose-specific frontmatter.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

import yaml

from scripts.video_edit.transcribe import transcribe_one, load_api_key
from scripts.video_edit.pack_transcripts import pack_one_file, render_markdown


VAULT_DIR = Path("vault/imports/instagram-saved")
INDEX_PATH = VAULT_DIR / "_index.json"


def _parse_frontmatter(content: str) -> tuple[dict, str]:
    """Split markdown into (frontmatter_dict, body_str)."""
    if not content.startswith("---"):
        return {}, content
    parts = content.split("---", 2)
    if len(parts) < 3:
        return {}, content
    frontmatter = yaml.safe_load(parts[1]) or {}
    body = parts[2].strip()
    return frontmatter, body


def _extract_shortcode_from_url(url: str) -> str:
    """Extract shortcode from an Instagram URL.

    Handles:
      https://www.instagram.com/reel/DI3RGhLNXPc/
      https://www.instagram.com/p/DI3RGhLNXPc/
      https://instagram.com/reel/DI3RGhLNXPc
    """
    match = re.search(r"instagram\.com/(?:reel|p)/([A-Za-z0-9_-]+)", url)
    if match:
        return match.group(1)
    return ""


def resolve_source(
    identifier: str,
    vault_dir: Path = VAULT_DIR,
) -> dict:
    """Resolve a shortcode, Instagram URL, or local path to video + metadata.

    Returns dict with keys:
      shortcode, video_path, link, author, author_name, caption,
      collection, like_count, comment_count, view_count, source_type
    """
    # Try as URL first
    shortcode = _extract_shortcode_from_url(identifier)

    # Try as local file path
    if not shortcode:
        candidate = Path(identifier).expanduser()
        if candidate.suffix in (".mp4", ".mov", ".webm") and candidate.exists():
            return {
                "shortcode": "",
                "video_path": candidate.resolve(),
                "link": "",
                "author": "",
                "author_name": "",
                "caption": "",
                "collection": "",
                "like_count": 0,
                "comment_count": 0,
                "view_count": 0,
                "source_type": "local",
            }

    # Fall through to shortcode lookup
    if not shortcode:
        shortcode = identifier

    index_path = vault_dir / "_index.json"
    if not index_path.exists():
        raise FileNotFoundError(
            f"Vault index not found at {index_path}. Run /sync-instagram first."
        )

    index = json.loads(index_path.read_text())
    entry = index.get(shortcode)
    if not entry:
        raise KeyError(
            f"Shortcode '{shortcode}' not found in vault index. "
            f"Run /sync-instagram to fetch it."
        )

    if not entry.get("downloaded"):
        raise FileNotFoundError(
            f"Video for '{shortcode}' not downloaded yet. "
            f"Run /sync-instagram download first."
        )

    video_path = vault_dir / entry["video_file"]
    if not video_path.exists():
        raise FileNotFoundError(
            f"Video file missing at {video_path}. Re-run /sync-instagram download."
        )

    # Read markdown frontmatter for rich metadata
    md_file = vault_dir / entry["file"]
    fm: dict = {}
    caption = ""
    if md_file.exists():
        fm, caption = _parse_frontmatter(md_file.read_text(encoding="utf-8"))

    return {
        "shortcode": shortcode,
        "video_path": video_path.resolve(),
        "link": fm.get("link", ""),
        "author": fm.get("author", ""),
        "author_name": fm.get("author_name", ""),
        "caption": caption or fm.get("caption", ""),
        "collection": entry.get("collection", ""),
        "like_count": fm.get("like_count", 0),
        "comment_count": fm.get("comment_count", 0),
        "view_count": fm.get("view_count", 0),
        "source_type": "vault",
    }


def transcribe_source(video_path: Path, work_dir: Path) -> Path:
    """Transcribe a source video and pack into readable markdown.

    Returns path to takes_packed.md.
    """
    edit_dir = work_dir / "edit"
    edit_dir.mkdir(parents=True, exist_ok=True)

    api_key = load_api_key()
    transcribe_one(
        video=video_path,
        edit_dir=edit_dir,
        api_key=api_key,
        num_speakers=1,
        verbose=True,
    )

    transcript_files = sorted((edit_dir / "transcripts").glob("*.json"))
    entries = [pack_one_file(p, silence_threshold=0.5) for p in transcript_files]
    markdown = render_markdown(entries, silence_threshold=0.5)

    packed_path = edit_dir / "takes_packed.md"
    packed_path.write_text(markdown, encoding="utf-8")

    return packed_path
