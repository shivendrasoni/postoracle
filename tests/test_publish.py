import pytest
from pathlib import Path
from unittest.mock import patch, MagicMock


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

def _make_session(tmp_path, files: list[str]) -> Path:
    session = tmp_path / "2026-05-05-test-session"
    session.mkdir()
    for f in files:
        (session / f).write_text("placeholder")
    return session


def _make_reel_caption(session: Path) -> None:
    (session / "caption.md").write_text(
        "# Caption\n\n## Post Caption\n\nThis is the hook line.\n\n→ Value 1\n\n#hashtag\n\n---\n\n## Script Reference\n\nscript text"
    )


def _make_carousel_caption(session: Path) -> None:
    (session / "caption.md").write_text(
        "[POST CAPTION]\nThis is the carousel caption.\n#tag1\n\n---\n[SLIDE COPY]\n1: Slide one"
    )


# ---------------------------------------------------------------------------
# Content type detection
# ---------------------------------------------------------------------------

def test_detect_reel_from_final_mp4(tmp_path):
    from scripts.publish import detect_content_type
    session = _make_session(tmp_path, ["final.mp4"])
    assert detect_content_type(session) == "reel"


def test_detect_carousel_from_1_png(tmp_path):
    from scripts.publish import detect_content_type
    session = _make_session(tmp_path, ["1.png"])
    assert detect_content_type(session) == "carousel"


def test_detect_ambiguous_raises(tmp_path):
    from scripts.publish import detect_content_type, PublishError
    session = _make_session(tmp_path, ["final.mp4", "1.png"])
    with pytest.raises(PublishError, match="Ambiguous session"):
        detect_content_type(session)


def test_detect_empty_raises(tmp_path):
    from scripts.publish import detect_content_type, PublishError
    session = _make_session(tmp_path, [])
    with pytest.raises(PublishError, match="No publishable asset"):
        detect_content_type(session)


# ---------------------------------------------------------------------------
# Caption extraction
# ---------------------------------------------------------------------------

def test_extract_reel_caption(tmp_path):
    from scripts.publish import extract_caption
    session = _make_session(tmp_path, ["final.mp4"])
    _make_reel_caption(session)
    caption = extract_caption(session, "reel")
    assert "hook line" in caption
    assert "Value 1" in caption
    assert "Script Reference" not in caption


def test_extract_carousel_caption(tmp_path):
    from scripts.publish import extract_caption
    session = _make_session(tmp_path, ["1.png"])
    _make_carousel_caption(session)
    caption = extract_caption(session, "carousel")
    assert "carousel caption" in caption
    assert "SLIDE COPY" not in caption


def test_extract_caption_missing_file_raises(tmp_path):
    from scripts.publish import extract_caption, PublishError
    session = _make_session(tmp_path, ["final.mp4"])
    with pytest.raises(PublishError, match="caption"):
        extract_caption(session, "reel")


# ---------------------------------------------------------------------------
# Platform registry resolution
# ---------------------------------------------------------------------------

def test_resolve_all_returns_all_platforms():
    from scripts.publish import resolve_platforms
    platforms = resolve_platforms("all")
    assert "instagram" in platforms
    assert "linkedin" in platforms
    assert len(platforms) >= 2


def test_resolve_single_platform():
    from scripts.publish import resolve_platforms
    assert resolve_platforms("instagram") == ["instagram"]


def test_resolve_unknown_platform_raises():
    from scripts.publish import resolve_platforms, PublishError
    with pytest.raises(PublishError, match="Unknown platform"):
        resolve_platforms("twitter")


# ---------------------------------------------------------------------------
# Dry-run: no Composio calls
# ---------------------------------------------------------------------------

def test_dry_run_makes_no_subprocess_calls(tmp_path):
    from scripts.publish import publish
    session = _make_session(tmp_path, ["final.mp4"])
    _make_reel_caption(session)
    config_path = tmp_path / "publish-config.md"
    config_path.write_text("---\nnotify_enabled: false\n---\n")

    with patch("scripts.publish.subprocess.run") as mock_run:
        results = publish(session, "instagram", dry_run=True, config_path=config_path)

    mock_run.assert_not_called()
    assert results["instagram"]["success"] is True
    assert results["instagram"].get("dry_run") is True


# ---------------------------------------------------------------------------
# Missing config: email skipped, publish continues
# ---------------------------------------------------------------------------

def test_missing_config_skips_email(tmp_path):
    from scripts.publish import publish
    session = _make_session(tmp_path, ["final.mp4"])
    _make_reel_caption(session)
    missing_config = tmp_path / "nonexistent-config.md"

    with patch("scripts.publish.subprocess.run") as mock_run:
        mock_run.return_value = MagicMock(returncode=0, stdout="", stderr="")
        results = publish(session, "instagram", dry_run=False, config_path=missing_config)

    # Email send should not have been called (no agent-mail slug call)
    email_calls = [c for c in mock_run.call_args_list
                   if "agent-mail" in str(c) or "GMAIL" in str(c).upper()]
    assert len(email_calls) == 0
