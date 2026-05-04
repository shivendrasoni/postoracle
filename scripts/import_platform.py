#!/usr/bin/env python3
"""
import_platform.py — Parse platform export files into text lists.

Supported:
  instagram  posts_1.json    JSON: data[].media[].title
  linkedin   shares.csv      CSV: ShareCommentary column
  twitter    tweets.js       JS: window.YTD.tweets.part0[].tweet.full_text
"""
import argparse
import csv
import json
import re
import sys
from pathlib import Path
from typing import Optional


def _strip_hashtags(text: str) -> str:
    """Remove #hashtag tokens from text, collapse whitespace, and strip."""
    cleaned = re.sub(r"#\w+", "", text)
    return re.sub(r"\s+", " ", cleaned).strip()


def parse_instagram(path: Path) -> list[str]:
    """Parse Instagram posts_1.json. Returns caption bodies with hashtags stripped."""
    data = json.loads(path.read_text(encoding="utf-8"))
    texts = []
    for post in data.get("data", []):
        for media in post.get("media", []):
            title = media.get("title", "").strip()
            if title:
                body = _strip_hashtags(title)
                if body:
                    texts.append(body)
    return texts


def parse_linkedin(path: Path) -> list[str]:
    """Parse LinkedIn shares.csv. Returns non-empty ShareCommentary values."""
    texts = []
    with path.open(newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            text = row.get("ShareCommentary", "").strip()
            if text:
                texts.append(text)
    return texts


def parse_twitter(path: Path) -> list[str]:
    """Parse Twitter tweets.js. Returns full_text values, excluding retweets."""
    raw = path.read_text(encoding="utf-8").strip()
    raw = re.sub(r"^window\.YTD\.tweets\.part0\s*=\s*", "", raw)
    entries = json.loads(raw)
    texts = []
    for entry in entries:
        text = entry.get("tweet", {}).get("full_text", "").strip()
        if text and not text.startswith("RT @"):
            texts.append(text)
    return texts


def scan_imports_dir(imports_dir: Path) -> dict[str, Path]:
    """Scan a directory for known platform export files.

    Returns dict with keys 'instagram', 'linkedin', 'twitter' for found files.
    """
    found: dict[str, Path] = {}
    if not imports_dir.exists():
        return found
    for f in imports_dir.iterdir():
        if f.name == "posts_1.json":
            found["instagram"] = f
        elif f.name == "shares.csv":
            found["linkedin"] = f
        elif f.name == "tweets.js":
            found["twitter"] = f
    return found


def _main(argv: Optional[list[str]] = None) -> None:
    parser = argparse.ArgumentParser(description="Parse platform export files")
    parser.add_argument("platform", choices=["instagram", "linkedin", "twitter"])
    parser.add_argument("file", help="Path to export file")
    args = parser.parse_args(argv)
    path = Path(args.file)

    if args.platform == "instagram":
        texts = parse_instagram(path)
    elif args.platform == "linkedin":
        texts = parse_linkedin(path)
    else:
        texts = parse_twitter(path)

    for text in texts:
        print(text)
        print("---")


if __name__ == "__main__":
    try:
        _main()
    except Exception as exc:
        print(f"Error: {exc}", file=sys.stderr)
        sys.exit(1)
