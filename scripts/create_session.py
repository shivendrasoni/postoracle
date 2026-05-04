#!/usr/bin/env python3
import argparse
import re
import sys
from datetime import date
from pathlib import Path


def slugify(text: str) -> str:
    text = re.sub(r"https?://\S+", "url", text)
    text = text.lower()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return text.strip("-")[:40]


def create_session(topic: str, base_dir: Path) -> Path:
    slug = slugify(topic)
    folder_name = f"{date.today()}-{slug}"
    session_dir = base_dir / "output" / "reels" / folder_name
    session_dir.mkdir(parents=True, exist_ok=True)
    for subdir in ("broll", "sfx", "edit"):
        (session_dir / subdir).mkdir(exist_ok=True)
    return session_dir


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("topic")
    parser.add_argument("--base-dir", default=".")
    args = parser.parse_args()
    session_dir = create_session(args.topic, Path(args.base_dir))
    print(str(session_dir))
