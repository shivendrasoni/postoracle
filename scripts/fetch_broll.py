#!/usr/bin/env python3
import argparse
import os
import sys
import urllib.request
from pathlib import Path
from typing import Optional

import requests

PEXELS_VIDEO_URL = "https://api.pexels.com/videos/search"
PEXELS_PHOTO_URL = "https://api.pexels.com/v1/search"


def fetch_video(
    keyword: str, out_dir: Path, slug: str, api_key: Optional[str] = None
) -> Optional[Path]:
    key = api_key or os.environ["PEXELS_API_KEY"]
    headers = {"Authorization": key}
    resp = requests.get(
        PEXELS_VIDEO_URL,
        headers=headers,
        params={"query": keyword, "orientation": "portrait", "per_page": 3, "min_duration": 5},
        timeout=15,
    )
    resp.raise_for_status()
    for video in resp.json().get("videos", []):
        for f in video.get("video_files", []):
            if f.get("quality") in ("hd", "sd") and f.get("file_type") == "video/mp4":
                out_path = out_dir / f"{slug}.mp4"
                urllib.request.urlretrieve(f["link"], out_path)
                return out_path
    return None


def fetch_photo(
    keyword: str, out_dir: Path, slug: str, api_key: Optional[str] = None
) -> Optional[Path]:
    key = api_key or os.environ["PEXELS_API_KEY"]
    headers = {"Authorization": key}
    resp = requests.get(
        PEXELS_PHOTO_URL,
        headers=headers,
        params={"query": keyword, "orientation": "portrait", "per_page": 1},
        timeout=15,
    )
    resp.raise_for_status()
    photos = resp.json().get("photos", [])
    if not photos:
        return None
    url = photos[0]["src"]["portrait"]
    out_path = out_dir / f"{slug}.jpg"
    urllib.request.urlretrieve(url, out_path)
    return out_path


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("keyword")
    parser.add_argument("out_dir")
    parser.add_argument("slug")
    args = parser.parse_args()

    out_dir = Path(args.out_dir)
    result = fetch_video(args.keyword, out_dir, args.slug) or fetch_photo(
        args.keyword, out_dir, args.slug
    )
    if result:
        print(str(result))
    else:
        print("NOT_FOUND", file=sys.stderr)
        sys.exit(1)
