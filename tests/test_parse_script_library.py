"""Tests for scripts/parse_script_library.py"""
import textwrap
from pathlib import Path

import pytest

from scripts.parse_script_library import parse_script_file, read_script


def test_parse_script_file_returns_frontmatter_and_body():
    content = textwrap.dedent("""\
        ---
        type: script
        topic: "AI agents"
        mode: shortform
        angle_ref: "vault/library/angles/2026-05-06-ai-agents-shortform-01.md"
        hook_pattern: contradiction
        hook_score: 0.88
        duration_target: 45
        status: draft
        created: 2026-05-06
        ---

        ## Script: AI Agents Are Not Replacing You

        **Hook Pattern:** contradiction
        **Duration:** 45s
        **Format:** shortform

        ### Beat Table

        | Beat | Timecode | Type | Script | Visual Cue |
        |------|----------|------|--------|------------|
        | 1 | 0:00–0:03 | Hook | "Everyone says AI will replace junior devs" | [Visual: news headlines] |
    """)
    fm, body = parse_script_file(content)
    assert fm["type"] == "script"
    assert fm["mode"] == "shortform"
    assert fm["hook_score"] == 0.88
    assert fm["duration_target"] == 45
    assert fm["angle_ref"] == "vault/library/angles/2026-05-06-ai-agents-shortform-01.md"
    assert "Beat Table" in body
    assert "0:00–0:03" in body


def test_parse_script_file_no_frontmatter():
    content = "Just plain text."
    fm, body = parse_script_file(content)
    assert fm == {}
    assert body == content


def test_read_script_from_file(tmp_path):
    script_dir = tmp_path / "vault" / "library" / "scripts"
    script_dir.mkdir(parents=True)
    script_file = script_dir / "2026-05-06-ai-agents-shortform-01.md"
    script_file.write_text(textwrap.dedent("""\
        ---
        type: script
        mode: shortform
        status: draft
        ---

        ## Script: Test

        Body content.
    """), encoding="utf-8")
    fm, body = read_script(script_file)
    assert fm["mode"] == "shortform"
    assert "Body content" in body


def test_read_script_file_not_found(tmp_path):
    with pytest.raises(FileNotFoundError):
        read_script(tmp_path / "nonexistent.md")
