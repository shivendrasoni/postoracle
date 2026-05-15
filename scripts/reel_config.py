# scripts/reel_config.py
#!/usr/bin/env python3
"""Load reel pipeline config from vault/reel-config.yaml with flag overrides."""

from __future__ import annotations

import yaml
from pathlib import Path
from typing import Optional

DEFAULTS: dict = {
    "mode": "video-agent",
    "auto_publish": False,
    "publish_platform": "instagram",
    "duration": 45,
    "style": "punchy",
    "grade": "auto",
    "subtitles": True,
    "subtitle_style": "bold-overlay",
    "broll": True,
    "auto_confirm": False,
    "target_silence_max": 0.4,
    "cut_filler_words": True,
    "detect_retakes": True,
}


def load_config(
    config_path: Optional[Path] = None,
    overrides: Optional[dict] = None,
) -> dict:
    if config_path is None:
        config_path = Path("vault/reel-config.yaml")

    file_values: dict = {}
    if config_path.exists():
        raw = config_path.read_text()
        if raw.strip():
            file_values = yaml.safe_load(raw) or {}
    else:
        config_path.parent.mkdir(parents=True, exist_ok=True)
        config_path.write_text(yaml.dump(dict(DEFAULTS), default_flow_style=False, sort_keys=False))

    merged = {**DEFAULTS, **file_values}

    if overrides:
        for k, v in overrides.items():
            if v is not None:
                merged[k] = v

    return merged
