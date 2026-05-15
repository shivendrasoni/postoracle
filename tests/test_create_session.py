from datetime import date
from scripts.create_session import create_session, slugify

def test_creates_required_subdirs(tmp_path):
    session_dir = create_session("AI agents", tmp_path)
    assert (session_dir / "broll").exists()
    assert (session_dir / "sfx").exists()
    assert (session_dir / "edit").exists()

def test_folder_name_includes_today(tmp_path):
    session_dir = create_session("test topic", tmp_path)
    assert str(date.today()) in session_dir.name

def test_folder_name_includes_slug(tmp_path):
    session_dir = create_session("AI agents are amazing", tmp_path)
    assert "ai" in session_dir.name

def test_slugify_url_becomes_url(tmp_path):
    slug = slugify("https://example.com/some-article")
    assert "http" not in slug
    assert len(slug) <= 40

def test_slug_strips_special_chars():
    slug = slugify("Hello, World! This is a test.")
    assert "," not in slug
    assert "!" not in slug
    assert " " not in slug

def test_session_dir_is_inside_vault_outputs_reels(tmp_path):
    session_dir = create_session("topic", tmp_path)
    assert "vault/outputs/reels" in str(session_dir)

def test_idempotent_on_existing_dir(tmp_path):
    create_session("topic", tmp_path)
    create_session("topic", tmp_path)  # should not raise


def test_custom_output_dir_is_used(tmp_path):
    from scripts.create_session import create_session
    session_dir = create_session("topic", tmp_path, output_dir="vault/outputs/reels")
    assert "vault" in str(session_dir)
    assert "outputs" in str(session_dir)
    assert "reels" in str(session_dir)


def test_default_output_dir_is_vault_outputs(tmp_path):
    from scripts.create_session import create_session
    session_dir = create_session("topic", tmp_path)
    assert "vault/outputs/reels" in str(session_dir)
