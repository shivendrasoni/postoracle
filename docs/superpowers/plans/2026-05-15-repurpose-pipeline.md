# Repurpose Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a `/repurpose` command that takes a saved Instagram post, extracts the core insight, rewrites it as an original script in the user's brand voice, and delegates to the existing `/make-reel` pipeline for production.

**Architecture:** The only new creative work is source resolution + transcription + insight extraction + script generation. Everything downstream (editing, rendering, HeyGen) is delegation to `/make-reel --from-script`. Three new files: `scripts/repurpose.py` (mechanical helpers), `tests/test_repurpose.py` (unit tests), `.claude/commands/repurpose.md` (orchestration command).

**Tech Stack:** Python 3, pytest, ElevenLabs Scribe (via existing `transcribe.py`), existing vault index infrastructure (`sync_instagram.py`), YAML frontmatter.

**Spec:** `docs/superpowers/specs/2026-05-15-repurpose-pipeline-design.md`

---

## File Structure

| File | Responsibility |
|------|---------------|
| `scripts/repurpose.py` | Source resolution (shortcode/URL/path → video + metadata), download gating, transcription orchestration, repurpose frontmatter builder |
| `tests/test_repurpose.py` | Unit tests for all functions in `repurpose.py` |
| `.claude/commands/repurpose.md` | Slash command definition — argument parsing, insight extraction prompt, script generation delegation, make-reel delegation |

---

### Task 1: Source Resolution — `resolve_source()`

**Files:**
- Create: `scripts/repurpose.py`
- Create: `tests/test_repurpose.py`

This function takes a shortcode, Instagram URL, or local file path and returns a dict with the resolved video path and source metadata.

- [ ] **Step 1: Write the failing test for shortcode resolution**

```python
# tests/test_repurpose.py
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_repurpose.py::TestResolveSourceShortcode::test_resolves_shortcode_with_downloaded_video -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'scripts.repurpose'`

- [ ] **Step 3: Write minimal implementation**

```python
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_repurpose.py::TestResolveSourceShortcode::test_resolves_shortcode_with_downloaded_video -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/repurpose.py tests/test_repurpose.py
git commit -m "feat(repurpose): add resolve_source with shortcode lookup"
```

---

### Task 2: URL and Local Path Resolution

**Files:**
- Modify: `tests/test_repurpose.py`
- Existing: `scripts/repurpose.py` (already handles these cases)

- [ ] **Step 1: Write failing tests for URL and local path resolution**

Add to `tests/test_repurpose.py`:

```python
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
```

- [ ] **Step 2: Run tests to verify they pass** (implementation already handles these)

Run: `pytest tests/test_repurpose.py -v`
Expected: ALL PASS

- [ ] **Step 3: Commit**

```bash
git add tests/test_repurpose.py
git commit -m "test(repurpose): add URL, local path, and error case tests"
```

---

### Task 3: `_extract_shortcode_from_url()` Edge Cases

**Files:**
- Modify: `tests/test_repurpose.py`
- Existing: `scripts/repurpose.py`

- [ ] **Step 1: Write tests for URL edge cases**

Add to `tests/test_repurpose.py`:

```python
from scripts.repurpose import _extract_shortcode_from_url


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
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `pytest tests/test_repurpose.py::TestExtractShortcodeFromURL -v`
Expected: ALL PASS

- [ ] **Step 3: Commit**

```bash
git add tests/test_repurpose.py
git commit -m "test(repurpose): add URL extraction edge case tests"
```

---

### Task 4: `transcribe_source()` — Transcription Orchestration

**Files:**
- Modify: `scripts/repurpose.py`
- Modify: `tests/test_repurpose.py`

This function wraps the existing `transcribe.py` and `pack_transcripts.py` into a single call.

- [ ] **Step 1: Write the failing test**

Add to `tests/test_repurpose.py`:

```python
from unittest.mock import patch, MagicMock
from scripts.repurpose import transcribe_source


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

        with patch("scripts.repurpose.transcribe_one") as mock_transcribe:
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

        with patch("scripts.repurpose.transcribe_one") as mock_transcribe:
            mock_transcribe.return_value = transcript_json
            result = transcribe_source(video, work_dir)

        # transcribe_one is still called (it handles its own caching)
        mock_transcribe.assert_called_once()
        assert "cached" in result.read_text()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_repurpose.py::TestTranscribeSource -v`
Expected: FAIL with `ImportError: cannot import name 'transcribe_source'`

- [ ] **Step 3: Write implementation**

Add to `scripts/repurpose.py`:

```python
from scripts.video_edit.transcribe import transcribe_one, load_api_key
from scripts.video_edit.pack_transcripts import pack_one_file, render_markdown


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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_repurpose.py::TestTranscribeSource -v`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/repurpose.py tests/test_repurpose.py
git commit -m "feat(repurpose): add transcribe_source orchestration"
```

---

### Task 5: `build_repurpose_frontmatter()` — Provenance Tracking

**Files:**
- Modify: `scripts/repurpose.py`
- Modify: `tests/test_repurpose.py`

- [ ] **Step 1: Write the failing test**

Add to `tests/test_repurpose.py`:

```python
from scripts.repurpose import build_repurpose_frontmatter


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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_repurpose.py::TestBuildRepurposeFrontmatter -v`
Expected: FAIL with `ImportError: cannot import name 'build_repurpose_frontmatter'`

- [ ] **Step 3: Write implementation**

Add to `scripts/repurpose.py`:

```python
def build_repurpose_frontmatter(source_meta: dict) -> dict:
    """Build source_* frontmatter fields for a repurposed script."""
    caption = source_meta.get("caption", "")
    first_line = caption.split("\n")[0].strip() if caption else ""

    return {
        "source_shortcode": source_meta.get("shortcode", ""),
        "source_url": source_meta.get("link", ""),
        "source_author": source_meta.get("author", ""),
        "source_title": first_line,
        "repurposed": True,
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_repurpose.py::TestBuildRepurposeFrontmatter -v`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/repurpose.py tests/test_repurpose.py
git commit -m "feat(repurpose): add build_repurpose_frontmatter for provenance"
```

---

### Task 6: `ensure_downloaded()` — Download Gating

**Files:**
- Modify: `scripts/repurpose.py`
- Modify: `tests/test_repurpose.py`

- [ ] **Step 1: Write the failing test**

Add to `tests/test_repurpose.py`:

```python
from scripts.repurpose import ensure_downloaded


class TestEnsureDownloaded:
    def test_returns_path_when_already_downloaded(self, tmp_path):
        vault_dir = tmp_path / "vault" / "imports" / "instagram-saved"
        vault_dir.mkdir(parents=True)
        videos_dir = vault_dir / "videos"
        videos_dir.mkdir()
        (videos_dir / "ABC.mp4").write_bytes(b"video")

        index = {
            "ABC": {
                "file": "abc.md",
                "video_url": "https://example.com/v.mp4",
                "downloaded": True,
                "video_file": "videos/ABC.mp4",
            }
        }
        (vault_dir / "_index.json").write_text(json.dumps(index))

        result = ensure_downloaded("ABC", vault_dir=vault_dir)
        assert result == (videos_dir / "ABC.mp4").resolve()

    def test_triggers_download_when_not_downloaded(self, tmp_path):
        vault_dir = tmp_path / "vault" / "imports" / "instagram-saved"
        vault_dir.mkdir(parents=True)
        videos_dir = vault_dir / "videos"
        videos_dir.mkdir()

        index = {
            "ABC": {
                "file": "abc.md",
                "video_url": "https://example.com/v.mp4",
                "downloaded": False,
                "video_file": "",
            }
        }
        (vault_dir / "_index.json").write_text(json.dumps(index))

        # After download_videos runs, simulate the file being there
        def fake_download(index_path, vault_dir):
            (videos_dir / "ABC.mp4").write_bytes(b"downloaded")
            idx = json.loads(index_path.read_text())
            idx["ABC"]["downloaded"] = True
            idx["ABC"]["video_file"] = "videos/ABC.mp4"
            index_path.write_text(json.dumps(idx))
            return {"downloaded": 1, "errors": []}

        with patch("scripts.repurpose.download_videos", side_effect=fake_download):
            result = ensure_downloaded("ABC", vault_dir=vault_dir)

        assert result == (videos_dir / "ABC.mp4").resolve()

    def test_raises_when_shortcode_not_in_index(self, tmp_path):
        vault_dir = tmp_path / "vault" / "imports" / "instagram-saved"
        vault_dir.mkdir(parents=True)
        (vault_dir / "_index.json").write_text("{}")

        with pytest.raises(KeyError, match="not found"):
            ensure_downloaded("MISSING", vault_dir=vault_dir)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_repurpose.py::TestEnsureDownloaded -v`
Expected: FAIL with `ImportError: cannot import name 'ensure_downloaded'`

- [ ] **Step 3: Write implementation**

Add to `scripts/repurpose.py`:

```python
from scripts.sync_instagram import download_videos


def ensure_downloaded(
    shortcode: str,
    vault_dir: Path = VAULT_DIR,
) -> Path:
    """Ensure the video for a shortcode is downloaded. Returns video path.

    Triggers download_videos() if the video hasn't been downloaded yet.
    """
    index_path = vault_dir / "_index.json"
    if not index_path.exists():
        raise FileNotFoundError(f"Vault index not found at {index_path}")

    index = json.loads(index_path.read_text())
    entry = index.get(shortcode)
    if not entry:
        raise KeyError(f"Shortcode '{shortcode}' not found in vault index.")

    if not entry.get("downloaded"):
        print(f"Downloading video for {shortcode}...")
        download_videos(index_path=index_path, vault_dir=vault_dir)
        # Re-read index after download
        index = json.loads(index_path.read_text())
        entry = index.get(shortcode, {})

    if not entry.get("downloaded") or not entry.get("video_file"):
        raise FileNotFoundError(
            f"Failed to download video for '{shortcode}'. "
            f"Check that the video URL is still valid."
        )

    video_path = vault_dir / entry["video_file"]
    return video_path.resolve()
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_repurpose.py::TestEnsureDownloaded -v`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/repurpose.py tests/test_repurpose.py
git commit -m "feat(repurpose): add ensure_downloaded with auto-download"
```

---

### Task 7: Run Full Test Suite

**Files:**
- Existing: `tests/test_repurpose.py`, `scripts/repurpose.py`

- [ ] **Step 1: Run all repurpose tests**

Run: `pytest tests/test_repurpose.py -v`
Expected: ALL PASS (should be 14+ tests)

- [ ] **Step 2: Run full project test suite to check for regressions**

Run: `pytest tests/ -v --tb=short`
Expected: ALL PASS, no regressions

- [ ] **Step 3: Commit if any fixes were needed**

---

### Task 8: `/repurpose` Command Definition

**Files:**
- Create: `.claude/commands/repurpose.md`

This is the orchestration spec that Claude Code follows when the user runs `/repurpose`. It's a markdown file that describes the step-by-step flow with LLM-driven stages (insight extraction, script generation) and delegation to existing commands.

- [ ] **Step 1: Write the command definition**

```markdown
# /repurpose — Turn a saved post into original content

## Arguments

Parse `$ARGUMENTS` for:

- `<source>` (required): Instagram shortcode, URL, or local video path
- `--mode <mode>` (default: `record`): One of `record`, `heygen-basic`, `heygen-agent`
- `--script-mode <mode>` (default: `shortform`): One of `shortform`, `longform`, `linkedin`
- `--duration <seconds>` (default: `45`): Target video duration
- `--auto` (flag): Skip strategy confirmation
- `--no-broll` (flag): Skip b-roll fetching (passed to make-reel)
- `--no-subtitles` (flag): Skip subtitle generation (passed to make-reel)

If no `<source>` is provided, stop with:
> "Usage: `/repurpose <shortcode|url|path> [--mode record|heygen-basic|heygen-agent] [--script-mode shortform|longform|linkedin]`"

---

## Stage 1: Resolve Source

```bash
python3 -c "
from scripts.repurpose import resolve_source, ensure_downloaded
import json

result = resolve_source('$SOURCE', vault_dir=__import__('pathlib').Path('vault/imports/instagram-saved'))
print(json.dumps(result, default=str))
"
```

If `resolve_source` raises `FileNotFoundError` about download:
```bash
python3 -c "
from scripts.repurpose import ensure_downloaded
result = ensure_downloaded('$SHORTCODE')
print(result)
"
```

Store the result. You now have:
- `$VIDEO_PATH`: path to the source video
- `$SHORTCODE`, `$AUTHOR`, `$AUTHOR_NAME`, `$LINK`: source metadata
- `$CAPTION`: original caption text
- `$VIEW_COUNT`, `$LIKE_COUNT`, `$COMMENT_COUNT`: engagement metrics
- `$SOURCE_TYPE`: "vault" or "local"

If `$SOURCE_TYPE` is "local", engagement context won't be available — note this but continue.

---

## Stage 2: Transcribe Source

Create a temporary working directory:

```bash
WORK_DIR=$(python3 scripts/create_session.py "repurpose-$SHORTCODE" --base-dir "$(pwd)" --output-dir "vault/outputs/reels")
```

If `$SOURCE_TYPE` is "local", use the filename stem instead of shortcode for the session name.

Transcribe:

```bash
python3 -c "
from scripts.repurpose import transcribe_source
from pathlib import Path
result = transcribe_source(Path('$VIDEO_PATH'), Path('$WORK_DIR'))
print(result)
"
```

Read the resulting `$WORK_DIR/edit/takes_packed.md`. This is the source transcript.

---

## Stage 3: Extract Insight

Read brand modules (all optional but recommended):
- `vault/brand/modules/niche.md` — audience persona, transformation, blockers
- `vault/brand/modules/style.md` — tone, vocabulary, patterns
- `vault/brand/modules/cta.md` — CTA templates

If none exist, warn: "No brand voice configured. Run `/brand-voice` for better results. Continuing with generic voice."

**Insight Extraction Prompt:**

You are analyzing a source video to extract a repurposable insight. You are NOT copying or summarizing — you are extracting the transferable *idea* that can be rewritten as completely original content.

**Source transcript:**
```
{contents of takes_packed.md}
```

**Source metadata:**
- Author: $AUTHOR ($AUTHOR_NAME)
- Views: $VIEW_COUNT | Likes: $LIKE_COUNT | Comments: $COMMENT_COUNT
- Caption: $CAPTION
- Collection: $COLLECTION

**Your brand context:**
```
{contents of niche.md — audience, transformation, blockers}
{contents of style.md — tone, vocabulary}
```

**Extract:**

1. **Core Insight**: The single transferable idea (not the presentation, not the personality — the *idea*). One sentence.

2. **Contrast** (A→B):
   - Common Belief (A): What most people assume
   - Surprising Truth (B): What the insight reveals
   - Strength: mild / moderate / strong / extreme

3. **Talking Points**: 5 bullet points that support the insight, reframed for YOUR audience (not the source's audience)

4. **Source Analysis**:
   - What Worked: Why did this resonate? (hook technique, emotional trigger, specificity, controversy)
   - Audience Overlap: How does the source's audience map to yours?
   - Your Differentiation: What unique angle can YOU bring that the source didn't? (your experience, your niche, your style)

**Output format** — return a YAML block:

```yaml
core_insight: "..."
contrast:
  common_belief: "..."
  surprising_truth: "..."
  strength: strong
talking_points:
  - "..."
  - "..."
  - "..."
  - "..."
  - "..."
source_context:
  what_worked: "..."
  audience_overlap: "..."
  differentiation: "..."
```

Store the extracted insight as `$INSIGHT`.

---

## Stage 4: Strategy Confirmation

Unless `--auto` is set, present:

```
Repurpose Strategy:
  Source: $AUTHOR — "$CAPTION_FIRST_LINE" ($VIEW_COUNT views)

  Core Insight: $CORE_INSIGHT
  Contrast: "$COMMON_BELIEF" → "$SURPRISING_TRUTH"
  Your Angle: $DIFFERENTIATION

  Script Mode: $SCRIPT_MODE ($DURATION_TARGETs)
  Output Mode: $MODE

  Proceed? (yes / adjust / skip)
```

- **yes**: continue to Stage 5
- **adjust**: ask what to change, re-extract if needed
- **skip**: abort, clean up session directory

---

## Stage 5: Generate Repurposed Script

Build repurpose frontmatter:

```bash
python3 -c "
from scripts.repurpose import build_repurpose_frontmatter
import json
meta = $SOURCE_META_JSON
print(json.dumps(build_repurpose_frontmatter(meta)))
"
```

Now generate the script using existing `/viral-script` logic:

**If `$SCRIPT_MODE` is `shortform`:**

Generate a HEIL (Hook / Explain / Illustrate / Lesson) script. Use the extracted insight as the creative brief:

- **Hook**: Generate 10 hooks from the contrast. Score by contrast_fit (0.40), pattern_strength (0.35), platform_fit (0.25). Present top 3.
- **Body**: Write 5–8 beats with timecodes and visual cues. Apply brand voice from style.md. Use talking points as structure.
- **CTA**: Pull from cta.md or generate platform-appropriate CTA.
- **Duration**: Target `$DURATION` seconds.

Apply ALL anti-slop rules:
- No 3-word loops, no rhetorical lists, no meta-commentary
- No hype adjectives, no fake scenarios, no throat-clearing
- Use connectors: "See," "Meaning," "Therefore"
- Use contrast: "Most [X] do Y. But [This] does Z."

**If `$SCRIPT_MODE` is `longform`:**

Generate a 3P's (Proof / Promise / Plan) script with the same insight.

**If `$SCRIPT_MODE` is `linkedin`:**

Generate a LinkedIn text post with hook line + body + CTA + hashtags.

**Save the script** to `vault/library/scripts/YYYY-MM-DD-<topic-slug>-$SCRIPT_MODE-repurposed-NN.md`

The script frontmatter MUST include the `source_*` fields from `build_repurpose_frontmatter()` merged with the standard script frontmatter:

```yaml
---
type: script
topic: "<extracted topic>"
mode: shortform
source_shortcode: "DI3RGhLNXPc"
source_url: "https://www.instagram.com/reel/DI3RGhLNXPc/"
source_author: "@namratarchawla"
source_title: "First line of original caption"
repurposed: true
hook_pattern: contradiction
hook_score: 0.85
duration_target: 45
status: draft
created: 2026-05-15
---
```

Print the saved script path: `$SCRIPT_PATH`

---

## Stage 6: Delegate to /make-reel (Mode-Dependent)

### If `$MODE` is `record`:

**Stop here.** Print:

```
✓ Repurposed script ready!

  Source: $AUTHOR — "$SOURCE_TITLE"
  Script: $SCRIPT_PATH
  Mode: shortform (HEIL, ~${DURATION}s)

  Next steps:
  1. Review the script: Read $SCRIPT_PATH
  2. Record your video
  3. Edit and render:
     /make-reel --from-script $SCRIPT_PATH --edit-raw <your-recording.mp4>
```

Do NOT invoke `/make-reel`. The user records at their own pace.

### If `$MODE` is `heygen-basic`:

Delegate directly:

```
/make-reel --from-script $SCRIPT_PATH --heygen-basic --duration $DURATION $EXTRA_FLAGS
```

Where `$EXTRA_FLAGS` includes `--no-broll`, `--no-subtitles`, `--auto` if set.

### If `$MODE` is `heygen-agent`:

Delegate directly:

```
/make-reel --from-script $SCRIPT_PATH --duration $DURATION $EXTRA_FLAGS
```

This invokes the default Video Agent mode.

---

## Error Handling

| Error | Action |
|-------|--------|
| Source not in vault | "Shortcode not found. Run `/sync-instagram` to fetch your saved posts." |
| Video not downloaded | Auto-trigger download, retry |
| Download fails | "Video download failed. The Instagram URL may have expired. Re-run `/sync-instagram sync --refresh` to get fresh URLs." |
| No brand modules | Warn but continue: "No brand voice found. Run `/brand-voice` for personalized scripts." |
| Transcription fails | "Transcription failed. Check ELEVENLABS_API_KEY in .env." |
| Script generation fails validation | Retry once. If still invalid, show the raw script and ask user to fix. |
```

- [ ] **Step 2: Review the command for completeness**

Check that:
- All stages reference correct Python functions and paths
- All flag names match the spec (`--mode`, `--script-mode`, `--auto`, etc.)
- The YAML output format in Stage 3 matches the frontmatter in Stage 5
- The delegation commands in Stage 6 use correct `/make-reel` flags
- Error handling covers all failure modes from the spec

- [ ] **Step 3: Commit**

```bash
git add .claude/commands/repurpose.md
git commit -m "feat(repurpose): add /repurpose slash command definition"
```

---

### Task 9: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

Add the `/repurpose` command to the command table and welcome banner.

- [ ] **Step 1: Add to welcome banner**

In the welcome banner ASCII block, add after `/sync-instagram`:

```
  /repurpose       Repurpose saved post → original script
```

- [ ] **Step 2: Add to commands table**

Add row:

```markdown
| `/repurpose <source>` | Repurpose saved post: transcribe → extract insight → original script → make-reel |
```

- [ ] **Step 3: Add to Key Files table**

Add row:

```markdown
| `scripts/repurpose.py` | Source resolution, transcription orchestration, repurpose frontmatter |
```

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add /repurpose to CLAUDE.md commands and key files"
```

---

### Task 10: Integration Smoke Test

**Files:**
- Existing: all files from tasks 1–9

- [ ] **Step 1: Run full test suite**

Run: `pytest tests/ -v --tb=short`
Expected: ALL PASS

- [ ] **Step 2: Verify command file is loadable**

Run: `cat .claude/commands/repurpose.md | head -5`
Expected: Shows the command header

- [ ] **Step 3: Verify repurpose.py imports cleanly**

Run: `python3 -c "from scripts.repurpose import resolve_source, ensure_downloaded, transcribe_source, build_repurpose_frontmatter; print('OK')"`
Expected: `OK`

- [ ] **Step 4: Verify resolve_source works against real vault** (if vault exists)

Run: `python3 -c "from scripts.repurpose import resolve_source; import json; r = resolve_source('DI3RGhLNXPc'); print(json.dumps({k: str(v) for k, v in r.items()}, indent=2))"`
Expected: Prints resolved source metadata (or clear error if shortcode doesn't exist)

- [ ] **Step 5: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix(repurpose): integration fixes from smoke test"
```
