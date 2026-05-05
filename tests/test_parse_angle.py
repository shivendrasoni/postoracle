"""Tests for scripts/parse_angle.py"""
import textwrap
from pathlib import Path

import pytest

from scripts.parse_angle import parse_angle_file, read_angle


def test_parse_angle_file_returns_frontmatter_and_body():
    content = textwrap.dedent("""\
        ---
        type: angle
        topic: "AI agents"
        format: shortform
        pillar: "Myth Busting"
        contrast:
          common_belief: "AI will replace junior developers"
          surprising_truth: "AI makes junior devs ship like seniors"
          strength: strong
        hook_pattern: contradiction
        content_job: build_trust
        blocker_targeted: "AI is coming for my job"
        cta_direction: comment_keyword
        score: 0.82
        status: draft
        created: 2026-05-06
        ---

        ## Angle

        AI will replace junior developers — that's what everyone says.

        ## Talking Points

        - Junior devs + AI copilot = senior-level output
        - The real risk is refusal to learn AI tools
    """)
    fm, body = parse_angle_file(content)
    assert fm["type"] == "angle"
    assert fm["topic"] == "AI agents"
    assert fm["format"] == "shortform"
    assert fm["contrast"]["common_belief"] == "AI will replace junior developers"
    assert fm["contrast"]["strength"] == "strong"
    assert fm["hook_pattern"] == "contradiction"
    assert fm["score"] == 0.82
    assert fm["status"] == "draft"
    assert "## Angle" in body
    assert "Talking Points" in body


def test_parse_angle_file_no_frontmatter():
    content = "Just plain text with no frontmatter."
    fm, body = parse_angle_file(content)
    assert fm == {}
    assert body == content


def test_parse_angle_file_with_image_concept():
    content = textwrap.dedent("""\
        ---
        type: angle
        format: post
        image_concept: "Creator in superhero pose with AI emblem"
        ---

        ## Angle

        Post body here.
    """)
    fm, body = parse_angle_file(content)
    assert fm["format"] == "post"
    assert fm["image_concept"] == "Creator in superhero pose with AI emblem"


def test_read_angle_from_file(tmp_path):
    angle_dir = tmp_path / "vault" / "library" / "angles"
    angle_dir.mkdir(parents=True)
    angle_file = angle_dir / "2026-05-06-ai-agents-shortform-01.md"
    angle_file.write_text(textwrap.dedent("""\
        ---
        type: angle
        topic: "AI agents"
        format: shortform
        contrast:
          common_belief: "A"
          surprising_truth: "B"
          strength: strong
        hook_pattern: contradiction
        score: 0.82
        status: draft
        ---

        ## Angle

        Body text.
    """), encoding="utf-8")
    fm, body = read_angle(angle_file)
    assert fm["topic"] == "AI agents"
    assert "Body text" in body


def test_read_angle_file_not_found(tmp_path):
    with pytest.raises(FileNotFoundError):
        read_angle(tmp_path / "nonexistent.md")
