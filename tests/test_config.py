# tests/test_config.py
"""Tests for scripts/config.py — centralized config loader."""

import yaml
from pathlib import Path

from scripts.config import load_config, DEFAULTS, GLOBAL_KEYS, CONFIG_PATH


class TestDefaults:
    def test_defaults_has_all_commands(self):
        expected_commands = [
            "make_reel", "make_carousel", "make_post",
            "viral_angle", "viral_script", "publish",
            "sync_instagram", "repurpose",
        ]
        for cmd in expected_commands:
            assert cmd in DEFAULTS, f"Missing defaults for {cmd}"

    def test_global_section_exists(self):
        assert "global" in DEFAULTS
        assert DEFAULTS["global"]["platform"] == "instagram"
        assert DEFAULTS["global"]["auto_publish"] is False
        assert DEFAULTS["global"]["auto_confirm"] is False

    def test_make_reel_defaults(self):
        d = DEFAULTS["make_reel"]
        assert d["duration"] == 45
        assert d["style"] == "punchy"
        assert d["mode"] == "video-agent"
        assert d["grade"] == "auto"
        assert d["subtitles"] is True
        assert d["subtitle_style"] == "bold-overlay"
        assert d["broll"] is True
        assert d["target_silence_max"] == 0.4
        assert d["cut_filler_words"] is True
        assert d["detect_retakes"] is True

    def test_make_carousel_defaults(self):
        d = DEFAULTS["make_carousel"]
        assert d["slides"] == 5
        assert d["mode"] == "preview"

    def test_make_post_defaults(self):
        assert DEFAULTS["make_post"]["mode"] == "visual"

    def test_viral_angle_defaults(self):
        d = DEFAULTS["viral_angle"]
        assert d["format"] == "all"
        assert d["count"] == 5

    def test_viral_script_defaults(self):
        assert DEFAULTS["viral_script"]["mode"] == "shortform"

    def test_publish_defaults(self):
        assert DEFAULTS["publish"]["platform"] == "instagram"

    def test_sync_instagram_defaults(self):
        assert DEFAULTS["sync_instagram"]["collection"] is None

    def test_repurpose_defaults(self):
        d = DEFAULTS["repurpose"]
        assert d["mode"] == "record"
        assert d["script_mode"] == "shortform"
        assert d["duration"] == 45


class TestLoadConfig:
    def test_missing_file_returns_defaults_with_globals(self, tmp_path, monkeypatch):
        monkeypatch.setattr("scripts.config.CONFIG_PATH", tmp_path / "postoracle.yaml")
        config = load_config("make_reel")
        assert config["duration"] == 45
        assert config["platform"] == "instagram"
        assert config["auto_publish"] is False

    def test_missing_file_creates_yaml(self, tmp_path, monkeypatch):
        config_path = tmp_path / "postoracle.yaml"
        monkeypatch.setattr("scripts.config.CONFIG_PATH", config_path)
        load_config("make_reel")
        assert config_path.exists()
        written = yaml.safe_load(config_path.read_text())
        assert "global" in written
        assert "make_reel" in written
        assert written["make_reel"]["duration"] == 45

    def test_returns_flat_dict(self, tmp_path, monkeypatch):
        monkeypatch.setattr("scripts.config.CONFIG_PATH", tmp_path / "postoracle.yaml")
        config = load_config("make_reel")
        assert isinstance(config, dict)
        assert "duration" in config
        assert "platform" in config
        assert "global" not in config

    def test_file_values_override_defaults(self, tmp_path, monkeypatch):
        config_path = tmp_path / "postoracle.yaml"
        config_path.write_text(yaml.dump({
            "global": {"platform": "linkedin"},
            "make_reel": {"duration": 30, "grade": "warm_cinematic"},
        }))
        monkeypatch.setattr("scripts.config.CONFIG_PATH", config_path)
        config = load_config("make_reel")
        assert config["duration"] == 30
        assert config["grade"] == "warm_cinematic"
        assert config["platform"] == "linkedin"
        assert config["style"] == "punchy"

    def test_command_section_overrides_global(self, tmp_path, monkeypatch):
        config_path = tmp_path / "postoracle.yaml"
        config_path.write_text(yaml.dump({
            "global": {"platform": "linkedin"},
            "publish": {"platform": "all"},
        }))
        monkeypatch.setattr("scripts.config.CONFIG_PATH", config_path)
        config = load_config("publish")
        assert config["platform"] == "all"

    def test_cli_overrides_take_precedence(self, tmp_path, monkeypatch):
        config_path = tmp_path / "postoracle.yaml"
        config_path.write_text(yaml.dump({
            "global": {"platform": "linkedin"},
            "make_reel": {"duration": 30},
        }))
        monkeypatch.setattr("scripts.config.CONFIG_PATH", config_path)
        config = load_config("make_reel", overrides={"duration": 60, "platform": "all"})
        assert config["duration"] == 60
        assert config["platform"] == "all"

    def test_none_overrides_are_ignored(self, tmp_path, monkeypatch):
        config_path = tmp_path / "postoracle.yaml"
        config_path.write_text(yaml.dump({
            "make_reel": {"grade": "subtle"},
        }))
        monkeypatch.setattr("scripts.config.CONFIG_PATH", config_path)
        config = load_config("make_reel", overrides={"grade": None})
        assert config["grade"] == "subtle"

    def test_unknown_command_raises(self, tmp_path, monkeypatch):
        monkeypatch.setattr("scripts.config.CONFIG_PATH", tmp_path / "postoracle.yaml")
        import pytest
        with pytest.raises(KeyError):
            load_config("nonexistent_command")

    def test_global_keys_propagate_to_all_commands(self, tmp_path, monkeypatch):
        config_path = tmp_path / "postoracle.yaml"
        config_path.write_text(yaml.dump({
            "global": {"platform": "all", "auto_confirm": True},
        }))
        monkeypatch.setattr("scripts.config.CONFIG_PATH", config_path)
        for cmd in ["make_carousel", "make_post", "viral_angle"]:
            config = load_config(cmd)
            assert config["platform"] == "all"
            assert config["auto_confirm"] is True
