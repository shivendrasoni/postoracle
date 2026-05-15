from scripts.check_env import check_env, check_env_edit_raw, check_env_heygen_basic

def test_all_required_present():
    env = {"PEXELS_API_KEY": "x", "OPENAI_API_KEY": "x", "HEYGEN_API_KEY": "x"}
    missing, missing_optional = check_env(env)
    assert missing == []

def test_single_required_missing():
    env = {"OPENAI_API_KEY": "x", "HEYGEN_API_KEY": "x"}
    missing, _ = check_env(env)
    assert "PEXELS_API_KEY" in missing

def test_all_required_missing():
    missing, _ = check_env({})
    assert set(missing) == {"PEXELS_API_KEY", "OPENAI_API_KEY", "HEYGEN_API_KEY"}

def test_optional_missing_not_in_required():
    env = {"PEXELS_API_KEY": "x", "OPENAI_API_KEY": "x", "HEYGEN_API_KEY": "x"}
    missing, missing_optional = check_env(env)
    assert missing == []
    assert "PIXABAY_API_KEY" in missing_optional
    assert "ELEVENLABS_API_KEY" in missing_optional

def test_optional_present():
    env = {
        "PEXELS_API_KEY": "x", "OPENAI_API_KEY": "x", "HEYGEN_API_KEY": "x",
        "PIXABAY_API_KEY": "y", "ELEVENLABS_API_KEY": "z",
        "INSTAGRAM_SESSION_ID": "s", "INSTAGRAM_CSRF_TOKEN": "c", "INSTAGRAM_DS_USER_ID": "d",
    }
    _, missing_optional = check_env(env)
    assert missing_optional == []


# --- edit-raw mode ---

def test_edit_raw_all_required_present():
    env = {"PEXELS_API_KEY": "x", "ELEVENLABS_API_KEY": "x"}
    missing, _ = check_env_edit_raw(env)
    assert missing == []

def test_edit_raw_does_not_require_heygen():
    env = {"PEXELS_API_KEY": "x", "ELEVENLABS_API_KEY": "x"}
    missing, _ = check_env_edit_raw(env)
    assert "HEYGEN_API_KEY" not in missing

def test_edit_raw_does_not_require_openai():
    env = {"PEXELS_API_KEY": "x", "ELEVENLABS_API_KEY": "x"}
    missing, _ = check_env_edit_raw(env)
    assert "OPENAI_API_KEY" not in missing

def test_edit_raw_needs_pexels():
    env = {"ELEVENLABS_API_KEY": "x"}
    missing, _ = check_env_edit_raw(env)
    assert "PEXELS_API_KEY" in missing

def test_edit_raw_needs_elevenlabs():
    env = {"PEXELS_API_KEY": "x"}
    missing, _ = check_env_edit_raw(env)
    assert "ELEVENLABS_API_KEY" in missing

def test_edit_raw_missing_all():
    missing, _ = check_env_edit_raw({})
    assert set(missing) == {"PEXELS_API_KEY", "ELEVENLABS_API_KEY"}


# --- heygen-basic mode ---

def test_heygen_basic_all_required_present():
    env = {"PEXELS_API_KEY": "x", "OPENAI_API_KEY": "x", "HEYGEN_API_KEY": "x", "ELEVENLABS_API_KEY": "x"}
    missing, _ = check_env_heygen_basic(env)
    assert missing == []

def test_heygen_basic_needs_elevenlabs():
    env = {"PEXELS_API_KEY": "x", "OPENAI_API_KEY": "x", "HEYGEN_API_KEY": "x"}
    missing, _ = check_env_heygen_basic(env)
    assert "ELEVENLABS_API_KEY" in missing

def test_heygen_basic_needs_heygen():
    env = {"PEXELS_API_KEY": "x", "OPENAI_API_KEY": "x", "ELEVENLABS_API_KEY": "x"}
    missing, _ = check_env_heygen_basic(env)
    assert "HEYGEN_API_KEY" in missing

def test_heygen_basic_needs_openai():
    env = {"PEXELS_API_KEY": "x", "HEYGEN_API_KEY": "x", "ELEVENLABS_API_KEY": "x"}
    missing, _ = check_env_heygen_basic(env)
    assert "OPENAI_API_KEY" in missing

def test_heygen_basic_needs_pexels():
    env = {"OPENAI_API_KEY": "x", "HEYGEN_API_KEY": "x", "ELEVENLABS_API_KEY": "x"}
    missing, _ = check_env_heygen_basic(env)
    assert "PEXELS_API_KEY" in missing

def test_heygen_basic_missing_all():
    missing, _ = check_env_heygen_basic({})
    assert set(missing) == {"PEXELS_API_KEY", "OPENAI_API_KEY", "HEYGEN_API_KEY", "ELEVENLABS_API_KEY"}

def test_heygen_basic_optional_pixabay():
    env = {"PEXELS_API_KEY": "x", "OPENAI_API_KEY": "x", "HEYGEN_API_KEY": "x", "ELEVENLABS_API_KEY": "x"}
    _, missing_optional = check_env_heygen_basic(env)
    assert "PIXABAY_API_KEY" in missing_optional
