# scripts/config.py
"""Centralized config loader for all PostOracle commands."""

from __future__ import annotations

import yaml
from pathlib import Path
from typing import Optional

CONFIG_PATH: Path = Path("vault/postoracle.yaml")

GLOBAL_KEYS = ("platform", "auto_publish", "auto_confirm")

DEFAULTS: dict = {
    "global": {
        "platform": "instagram",
        "auto_publish": False,
        "auto_confirm": False,
    },
    "make_reel": {
        "duration": 45,
        "style": "punchy",
        "mode": "video-agent",
        "grade": "auto",
        "subtitles": True,
        "subtitle_style": "bold-overlay",
        "broll": True,
        "target_silence_max": 0.4,
        "cut_filler_words": True,
        "detect_retakes": True,
    },
    "make_carousel": {
        "slides": 5,
        "mode": "preview",
    },
    "make_post": {
        "mode": "visual",
    },
    "viral_angle": {
        "format": "all",
        "count": 5,
    },
    "viral_script": {
        "mode": "shortform",
    },
    "publish": {
        "platform": "instagram",
    },
    "sync_instagram": {
        "collection": None,
    },
    "repurpose": {
        "mode": "record",
        "script_mode": "shortform",
        "duration": 45,
    },
    "analyse": {
        "keyframe_count": 6,
        "benchmarks": {
            "lvr_strong": 3.0,
            "lvr_average": 1.0,
            "clr_strong": 1.0,
            "clr_average": 0.5,
            "er_strong": 3.0,
            "er_average": 1.0,
        },
    },
}


def _read_yaml() -> dict:
    if CONFIG_PATH.exists():
        raw = CONFIG_PATH.read_text()
        if raw.strip():
            return yaml.safe_load(raw) or {}
    else:
        CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
        CONFIG_PATH.write_text(
            yaml.dump(dict(DEFAULTS), default_flow_style=False, sort_keys=False)
        )
    return {}


def load_config(
    command: str,
    overrides: Optional[dict] = None,
) -> dict:
    if command not in DEFAULTS:
        raise KeyError(f"Unknown command: {command}")

    file_data = _read_yaml()

    cmd_defaults = dict(DEFAULTS[command])

    for key in GLOBAL_KEYS:
        if key not in cmd_defaults:
            cmd_defaults[key] = DEFAULTS["global"][key]

    file_global = file_data.get("global", {}) or {}
    for key in GLOBAL_KEYS:
        if key in file_global:
            cmd_defaults[key] = file_global[key]

    file_cmd = file_data.get(command, {}) or {}
    for key, val in file_cmd.items():
        cmd_defaults[key] = val

    if overrides:
        for key, val in overrides.items():
            if val is not None:
                cmd_defaults[key] = val

    return cmd_defaults
