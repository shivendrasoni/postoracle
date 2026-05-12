"""Tests for scripts/heygen_basic_video.py — strip_cues logic."""

from scripts.heygen_basic_video import strip_cues


def test_strip_timecodes():
    text = "(0:00)\nHello world\n(0:15)\nGoodbye"
    assert strip_cues(text) == "Hello world Goodbye"


def test_strip_visual_cues():
    text = "First line\n[Visual: stock footage of city]\nSecond line"
    assert strip_cues(text) == "First line Second line"


def test_strip_text_overlays():
    text = 'Intro\n[Text: "Subscribe now"]\nOutro'
    assert strip_cues(text) == "Intro Outro"


def test_strip_headers():
    text = "# Title\n## Section\nActual content here"
    assert strip_cues(text) == "Actual content here"


def test_strip_frontmatter():
    text = "---\ntopic: test\nstyle: punchy\n---\nSpoken words here"
    assert strip_cues(text) == "Spoken words here"


def test_preserves_spoken_text():
    text = (
        "---\ntopic: AI\n---\n"
        "(0:00)\n"
        "Did you know AI can write code?\n"
        "[Visual: robot typing]\n"
        "(0:10)\n"
        "Here's how it works.\n"
        '[Text: "Step 1"]\n'
        "You just ask it a question."
    )
    result = strip_cues(text)
    assert result == (
        "Did you know AI can write code? "
        "Here's how it works. "
        "You just ask it a question."
    )


def test_empty_input():
    assert strip_cues("") == ""


def test_only_cues():
    text = "(0:00)\n[Visual: something]\n[Text: \"hi\"]"
    assert strip_cues(text) == ""
