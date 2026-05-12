#!/usr/bin/env python3
"""Generate a basic HeyGen avatar video (v2 API) — talking head only, no editing."""

import argparse
import json
import os
import re
import sys
import time
import urllib.request
import urllib.error

API_BASE = "https://api.heygen.com"


def strip_cues(text: str) -> str:
    """Remove timecodes, visual cues, and metadata from script, keeping spoken text."""
    in_frontmatter = False
    lines = []
    for line in text.splitlines():
        stripped = line.strip()
        if stripped == "---":
            in_frontmatter = not in_frontmatter
            continue
        if in_frontmatter:
            continue
        if re.match(r"^\(\d+:\d{2}\)$", stripped):
            continue
        if re.match(r"^\[Visual:.*\]$", stripped, re.IGNORECASE):
            continue
        if re.match(r"^\[Text:.*\]$", stripped, re.IGNORECASE):
            continue
        if stripped.startswith("# ") or stripped.startswith("## "):
            continue
        if stripped:
            lines.append(stripped)
    return " ".join(lines)


def create_video(
    api_key: str,
    avatar_id: str,
    voice_id: str,
    script_text: str,
    width: int = 1080,
    height: int = 1920,
) -> str:
    """Submit video generation request, return video_id."""
    payload = {
        "video_inputs": [
            {
                "character": {
                    "type": "avatar",
                    "avatar_id": avatar_id,
                    "avatar_style": "normal",
                },
                "voice": {
                    "type": "text",
                    "input_text": script_text,
                    "voice_id": voice_id,
                },
            }
        ],
        "dimension": {"width": width, "height": height},
    }
    req = urllib.request.Request(
        f"{API_BASE}/v2/video/generate",
        data=json.dumps(payload).encode(),
        headers={"x-api-key": api_key, "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        body = e.read().decode() if e.fp else ""
        raise RuntimeError(f"HeyGen API {e.code}: {body}") from e
    if data.get("error"):
        raise RuntimeError(f"HeyGen API error: {data['error']}")
    return data["data"]["video_id"]


def poll_status(
    api_key: str, video_id: str, timeout: int = 1800, interval: int = 15
) -> dict:
    """Poll until video is completed or failed."""
    url = f"{API_BASE}/v1/video_status.get?video_id={video_id}"
    deadline = time.time() + timeout
    while time.time() < deadline:
        req = urllib.request.Request(url, headers={"x-api-key": api_key})
        try:
            with urllib.request.urlopen(req) as resp:
                result = json.loads(resp.read().decode())
        except urllib.error.HTTPError as e:
            body = e.read().decode() if e.fp else ""
            raise RuntimeError(f"Status poll {e.code}: {body}") from e
        status = result["data"]["status"]
        if status == "completed":
            return result["data"]
        if status == "failed":
            error = result["data"].get("error", "unknown")
            raise RuntimeError(f"Video generation failed: {error}")
        time.sleep(interval)
    raise TimeoutError(f"Video generation timed out after {timeout}s")


def download_video(video_url: str, output_path: str) -> None:
    """Download the rendered video to a local file."""
    urllib.request.urlretrieve(video_url, output_path)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Generate a basic HeyGen talking-head video (v2 API)"
    )
    parser.add_argument("--script-file", required=True, help="Path to script .md file")
    parser.add_argument("--avatar-id", required=True, help="HeyGen avatar look ID")
    parser.add_argument("--voice-id", required=True, help="HeyGen voice ID")
    parser.add_argument("--output-path", required=True, help="Output .mp4 path")
    parser.add_argument("--width", type=int, default=1080)
    parser.add_argument("--height", type=int, default=1920)
    parser.add_argument("--timeout", type=int, default=1800, help="Max wait seconds")
    args = parser.parse_args()

    api_key = os.environ.get("HEYGEN_API_KEY")
    if not api_key:
        print("ERROR: HEYGEN_API_KEY not set", file=sys.stderr)
        sys.exit(1)

    with open(args.script_file) as f:
        raw = f.read()
    script_text = strip_cues(raw)

    if len(script_text) > 5000:
        print(
            f"WARNING: Script is {len(script_text)} chars (limit 5000), truncating.",
            file=sys.stderr,
        )
        script_text = script_text[:5000]

    print(f"Submitting video ({len(script_text)} chars)...")
    video_id = create_video(
        api_key, args.avatar_id, args.voice_id, script_text, args.width, args.height
    )
    print(f"video_id={video_id}")

    print("Polling for completion...")
    result = poll_status(api_key, video_id, timeout=args.timeout)

    duration = result.get("duration", "?")
    print(f"Downloading ({duration}s video)...")
    download_video(result["video_url"], args.output_path)

    output = {"video_id": video_id, "duration": duration, "path": args.output_path}
    print(json.dumps(output))


if __name__ == "__main__":
    main()
