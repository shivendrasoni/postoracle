#!/usr/bin/env python3
import argparse
import os
import sys
import urllib.request
from pathlib import Path
from typing import Optional

import requests

PIXABAY_API = "https://pixabay.com/api/"


def fetch_pixabay_sfx(
    keyword: str, out_dir: Path, slug: str, api_key: Optional[str] = None
) -> Optional[Path]:
    key = api_key or os.environ.get("PIXABAY_API_KEY")
    if not key:
        return None  # optional — skip gracefully

    resp = requests.get(
        PIXABAY_API,
        params={"key": key, "q": keyword, "media_type": "music", "per_page": 3},
        timeout=15,
    )
    resp.raise_for_status()
    hits = resp.json().get("hits", [])
    if not hits:
        return None

    audio_url = hits[0].get("previewURL") or hits[0].get("audio", {}).get("url")
    if not audio_url:
        return None

    out_path = out_dir / f"{slug}.mp3"
    urllib.request.urlretrieve(audio_url, out_path)
    return out_path


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("keyword")
    parser.add_argument("out_dir")
    parser.add_argument("slug")
    args = parser.parse_args()

    result = fetch_pixabay_sfx(args.keyword, Path(args.out_dir), args.slug)
    if result:
        print(str(result))
    else:
        print("SKIPPED", file=sys.stderr)
        sys.exit(0)  # optional — not a failure
