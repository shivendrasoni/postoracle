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


def test_detect_post_from_image_png(tmp_path):
    from scripts.publish import detect_content_type
    session = _make_session(tmp_path, ["image.png"])
    assert detect_content_type(session) == "post"


def test_detect_ambiguous_reel_and_post_raises(tmp_path):
    from scripts.publish import detect_content_type, PublishError
    session = _make_session(tmp_path, ["final.mp4", "image.png"])
    with pytest.raises(PublishError, match="Ambiguous"):
        detect_content_type(session)


def test_detect_ambiguous_carousel_and_post_raises(tmp_path):
    from scripts.publish import detect_content_type, PublishError
    session = _make_session(tmp_path, ["1.png", "image.png"])
    with pytest.raises(PublishError, match="Ambiguous"):
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


def _make_post_caption(session: Path) -> None:
    (session / "post.md").write_text(
        "## LinkedIn\n\nAI is not replacing you — it's upgrading you.\n\nHere's the truth about AI agents:\n\n#AI #Productivity\n\n"
        "## Instagram\n\nAI won't replace you. But someone using AI will. 🔥\n\nComment AGENT and I'll DM you the guide.\n\n#AI #Tech\n\n"
        "## X\n\nAI is your superpower, not your replacement. The devs who get this will win 2026. #AI"
    )


def test_extract_post_caption_instagram(tmp_path):
    from scripts.publish import extract_caption
    session = _make_session(tmp_path, ["image.png"])
    _make_post_caption(session)
    caption = extract_caption(session, "post", platform="instagram")
    assert "Comment AGENT" in caption
    assert "LinkedIn" not in caption


def test_extract_post_caption_linkedin(tmp_path):
    from scripts.publish import extract_caption
    session = _make_session(tmp_path, ["image.png"])
    _make_post_caption(session)
    caption = extract_caption(session, "post", platform="linkedin")
    assert "truth about AI agents" in caption
    assert "Comment AGENT" not in caption


def test_extract_post_caption_x(tmp_path):
    from scripts.publish import extract_caption
    session = _make_session(tmp_path, ["image.png"])
    _make_post_caption(session)
    caption = extract_caption(session, "post", platform="x")
    assert "superpower" in caption
    assert len(caption) <= 280


def test_extract_post_caption_missing_section_raises(tmp_path):
    from scripts.publish import extract_caption, PublishError
    session = _make_session(tmp_path, ["image.png"])
    (session / "post.md").write_text("## Instagram\nOnly Instagram caption here.\n")
    with pytest.raises(PublishError, match="LinkedIn"):
        extract_caption(session, "post", platform="linkedin")


def test_extract_post_caption_missing_file_raises(tmp_path):
    from scripts.publish import extract_caption, PublishError
    session = _make_session(tmp_path, ["image.png"])
    with pytest.raises(PublishError, match="post.md"):
        extract_caption(session, "post", platform="instagram")


def test_extract_reel_caption_still_works_with_platform_param(tmp_path):
    from scripts.publish import extract_caption
    session = _make_session(tmp_path, ["final.mp4"])
    _make_reel_caption(session)
    caption = extract_caption(session, "reel", platform="instagram")
    assert "hook line" in caption


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


# ---------------------------------------------------------------------------
# _send_email: FileNotFoundError when composio is not installed
# ---------------------------------------------------------------------------

def test_send_email_composio_not_found_does_not_raise(tmp_path, capsys):
    from scripts.publish import _send_email

    session_dir = tmp_path / "test-session"
    session_dir.mkdir()

    config = {"notify_enabled": True, "notify_email": "test@example.com", "agent_mail_inbox_id": "inbox-123"}

    with patch("scripts.publish.subprocess.run", side_effect=FileNotFoundError("composio not found")):
        # Should NOT raise — should print a [WARN] instead
        _send_email(session_dir, ["instagram"], {"instagram": {"success": True, "url": None}}, config)

    captured = capsys.readouterr()
    assert "[WARN]" in captured.err
    assert "Email notification failed" in captured.err
