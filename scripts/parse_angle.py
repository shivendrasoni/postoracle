#!/usr/bin/env python3
"""parse_angle.py — Parse vault angle markdown files into frontmatter + body."""
from pathlib import Path

import yaml


def parse_angle_file(content: str) -> tuple[dict, str]:
    """Split angle markdown into (frontmatter_dict, body_str).

    Returns ({}, content) if no frontmatter delimiters found.
    """
    if not content.startswith("---"):
        return {}, content
    parts = content.split("---", 2)
    if len(parts) < 3:
        return {}, content
    frontmatter = yaml.safe_load(parts[1]) or {}
    body = parts[2].strip()
    return frontmatter, body


def read_angle(path: Path) -> tuple[dict, str]:
    """Read and parse an angle file. Raises FileNotFoundError if missing."""
    content = Path(path).read_text(encoding="utf-8")
    return parse_angle_file(content)
