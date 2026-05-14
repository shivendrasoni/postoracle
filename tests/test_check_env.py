from scripts.check_env import check_env

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
