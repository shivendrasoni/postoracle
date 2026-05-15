# tests/test_reel_config.py
"""Tests for scripts/reel_config.py — reel pipeline config loader."""

import yaml
from pathlib import Path

from scripts.reel_config import load_config, DEFAULTS


class TestDefaults:
    def test_defaults_has_expected_keys(self):
        assert DEFAULTS["mode"] == "video-agent"
        assert DEFAULTS["duration"] == 45
        assert DEFAULTS["style"] == "punchy"
        assert DEFAULTS["grade"] == "auto"
        assert DEFAULTS["subtitles"] is True
        assert DEFAULTS["broll"] is True
        assert DEFAULTS["auto_confirm"] is False
        assert DEFAULTS["auto_publish"] is False
        assert DEFAULTS["target_silence_max"] == 0.4
        assert DEFAULTS["cut_filler_words"] is True
        assert DEFAULTS["detect_retakes"] is True
        assert DEFAULTS["subtitle_style"] == "bold-overlay"
        assert DEFAULTS["publish_platform"] == "instagram"


class TestLoadConfig:
    def test_missing_file_returns_defaults(self, tmp_path):
        config = load_config(config_path=tmp_path / "nonexistent.yaml")
        assert config == DEFAULTS

    def test_missing_file_creates_default_file(self, tmp_path):
        config_path = tmp_path / "reel-config.yaml"
        load_config(config_path=config_path)
        assert config_path.exists()
        written = yaml.safe_load(config_path.read_text())
        assert written["mode"] == "video-agent"
        assert written["duration"] == 45

    def test_partial_config_fills_missing_keys(self, tmp_path):
        config_path = tmp_path / "reel-config.yaml"
        config_path.write_text(yaml.dump({"grade": "warm_cinematic", "duration": 30}))
        config = load_config(config_path=config_path)
        assert config["grade"] == "warm_cinematic"
        assert config["duration"] == 30
        assert config["mode"] == "video-agent"
        assert config["subtitles"] is True

    def test_flag_overrides_take_precedence(self, tmp_path):
        config_path = tmp_path / "reel-config.yaml"
        config_path.write_text(yaml.dump({"grade": "warm_cinematic", "duration": 30}))
        config = load_config(config_path=config_path, overrides={"grade": "none", "auto_confirm": True})
        assert config["grade"] == "none"
        assert config["auto_confirm"] is True
        assert config["duration"] == 30

    def test_none_overrides_are_ignored(self, tmp_path):
        config_path = tmp_path / "reel-config.yaml"
        config_path.write_text(yaml.dump({"grade": "subtle"}))
        config = load_config(config_path=config_path, overrides={"grade": None})
        assert config["grade"] == "subtle"

    def test_unknown_keys_in_file_are_preserved(self, tmp_path):
        config_path = tmp_path / "reel-config.yaml"
        config_path.write_text(yaml.dump({"grade": "subtle", "custom_thing": 42}))
        config = load_config(config_path=config_path)
        assert config["custom_thing"] == 42
        assert config["grade"] == "subtle"
