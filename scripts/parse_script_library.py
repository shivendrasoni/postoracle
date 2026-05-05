#!/usr/bin/env python3
"""parse_script_library.py — Parse vault script library markdown files."""
from pathlib import Path

import yaml


def parse_script_file(content: str) -> tuple[dict, str]:
    """Split script markdown into (frontmatter_dict, body_str).

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


def read_script(path: Path) -> tuple[dict, str]:
    """Read and parse a script library file. Raises FileNotFoundError if missing."""
    content = Path(path).read_text(encoding="utf-8")
    return parse_script_file(content)
