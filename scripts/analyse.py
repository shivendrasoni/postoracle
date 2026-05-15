#!/usr/bin/env python3
"""analyse.py — Data preparation for the /analyse pipeline.

Takes an Instagram saved post shortcode and produces structured JSON with
engagement metrics, transcription, and keyframe paths.  This is Stage 1;
Stage 2 is an LLM that reads the output.

Usage:
    python3 -m scripts.analyse prep <shortcode>
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path
from typing import Optional

import yaml


VAULT_DIR: Path = Path("vault/imports/instagram-saved")

_ANALYSE_DEFAULTS: dict[str, object] = {
    "keyframe_count": 6,
    "benchmarks": {
        "lvr_strong": 3.0,
        "lvr_average": 1.0,
        "clr_strong": 1.0,
        "clr_average": 0.5,
        "er_strong": 3.0,
        "er_average": 1.0,
    },
}


# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

def _load_analyse_config() -> dict[str, object]:
    """Load analyse config, falling back to hardcoded defaults."""
    try:
        from scripts.config import load_config
        return load_config("analyse")
    except (KeyError, Exception):
        return dict(_ANALYSE_DEFAULTS)


# ---------------------------------------------------------------------------
# Pure helpers
# ---------------------------------------------------------------------------

def compute_metrics(
    views: Optional[int],
    likes: Optional[int],
    comments: Optional[int],
) -> dict[str, Optional[float]]:
    """Compute engagement ratios from raw counts.

    Returns dict with keys lvr, clr, engagement_rate — each may be None
    when the divisor is zero or missing.
    """
    safe_views = views if isinstance(views, (int, float)) and views > 0 else 0
    safe_likes = likes if isinstance(likes, (int, float)) and likes > 0 else 0
    safe_comments = comments if isinstance(comments, (int, float)) and comments > 0 else 0

    lvr: Optional[float] = None
    clr: Optional[float] = None
    engagement_rate: Optional[float] = None

    if safe_views > 0:
        lvr = round(safe_likes / safe_views * 100, 2)
        engagement_rate = round((safe_likes + safe_comments) / safe_views * 100, 2)

    if safe_likes > 0:
        clr = round(safe_comments / safe_likes * 100, 2)

    return {
        "lvr": lvr,
        "clr": clr,
        "engagement_rate": engagement_rate,
    }


def rate(value: Optional[float], strong_threshold: float, average_threshold: float) -> Optional[str]:
    """Rate a metric value as strong / average / weak.

    Returns None if the value itself is None.
    Uses strict greater-than for thresholds (>3% = strong, not >=).
    """
    if value is None:
        return None
    if value > strong_threshold:
        return "strong"
    if value >= average_threshold:
        return "average"
    return "weak"


def build_phrases_from_words(
    words: list[dict[str, object]],
    gap_threshold: float = 0.5,
) -> list[dict[str, object]]:
    """Group word-level timestamps into phrases, breaking on silence gaps.

    Each word dict is expected to have keys: text, start, end.
    Words without start/end are skipped (e.g. audio event tags).
    """
    if not words:
        return []

    # Filter to actual words with timing data
    timed = [
        w for w in words
        if "start" in w and "end" in w and w["start"] is not None and w["end"] is not None
    ]
    if not timed:
        return []

    phrases: list[dict[str, object]] = []
    current_texts: list[str] = []
    phrase_start: float = float(timed[0]["start"])
    prev_end: float = float(timed[0]["end"])
    current_texts.append(str(timed[0].get("text", "")))

    for word in timed[1:]:
        w_start = float(word["start"])
        w_end = float(word["end"])
        w_text = str(word.get("text", ""))

        if w_start - prev_end > gap_threshold:
            # Flush current phrase
            phrases.append({
                "start": phrase_start,
                "end": prev_end,
                "text": " ".join(current_texts).strip(),
            })
            current_texts = [w_text]
            phrase_start = w_start
        else:
            current_texts.append(w_text)

        prev_end = w_end

    # Flush last phrase
    if current_texts:
        phrases.append({
            "start": phrase_start,
            "end": prev_end,
            "text": " ".join(current_texts).strip(),
        })

    return phrases


# ---------------------------------------------------------------------------
# Frontmatter parsing
# ---------------------------------------------------------------------------

def _parse_frontmatter(content: str) -> tuple[dict, str]:
    """Split markdown into (frontmatter_dict, body_str)."""
    if not content.startswith("---"):
        return {}, content
    parts = content.split("---", 2)
    if len(parts) < 3:
        return {}, content
    frontmatter = yaml.safe_load(parts[1]) or {}
    body = parts[2].strip()
    return frontmatter, body


# ---------------------------------------------------------------------------
# Transcription
# ---------------------------------------------------------------------------

def _load_transcript(
    shortcode: str,
    video_path: Path,
    vault_dir: Path,
) -> Optional[dict[str, object]]:
    """Load or generate a transcript for a reel video.

    Returns dict with text, phrases, duration_s — or None if no video.
    """
    if not video_path.exists():
        return None

    transcripts_dir = vault_dir / "transcripts"
    cached = transcripts_dir / f"{shortcode}.json"

    if cached.exists():
        raw = json.loads(cached.read_text(encoding="utf-8"))
    else:
        try:
            from scripts.video_edit.transcribe import transcribe_one, load_api_key
            api_key = load_api_key()
            result_path = transcribe_one(
                video=video_path,
                edit_dir=vault_dir,
                api_key=api_key,
                num_speakers=1,
                verbose=False,
            )
            raw = json.loads(result_path.read_text(encoding="utf-8"))
        except Exception as exc:
            print(f"Warning: transcription failed: {exc}", file=sys.stderr)
            return None

    full_text = raw.get("text", "")
    words = raw.get("words", [])
    phrases = build_phrases_from_words(words)

    duration_s: Optional[float] = None
    timed = [w for w in words if "end" in w and w["end"] is not None]
    if timed:
        duration_s = round(float(timed[-1]["end"]), 1)

    return {
        "text": full_text,
        "phrases": phrases,
        "duration_s": duration_s,
    }


# ---------------------------------------------------------------------------
# Keyframe extraction
# ---------------------------------------------------------------------------

def _extract_keyframes(
    shortcode: str,
    video_path: Path,
    vault_dir: Path,
    count: int = 6,
) -> list[str]:
    """Extract evenly-spaced keyframes from a video.

    Returns list of paths relative to project root.
    """
    if not video_path.exists():
        return []

    keyframes_dir = vault_dir / "keyframes" / shortcode
    existing = sorted(keyframes_dir.glob("*.jpg")) if keyframes_dir.exists() else []
    if existing:
        return [str(p) for p in existing]

    keyframes_dir.mkdir(parents=True, exist_ok=True)

    try:
        # Get video duration via ffprobe
        probe_cmd = [
            "ffprobe", "-v", "quiet", "-show_entries", "format=duration",
            "-of", "csv=p=0", str(video_path),
        ]
        result = subprocess.run(
            probe_cmd, capture_output=True, text=True, check=True,
        )
        duration = float(result.stdout.strip())

        if duration <= 0:
            return []

        fps = count / duration
        ffmpeg_cmd = [
            "ffmpeg", "-y", "-i", str(video_path),
            "-vf", f"fps={fps}",
            "-q:v", "2",
            str(keyframes_dir / "%03d.jpg"),
        ]
        subprocess.run(
            ffmpeg_cmd, check=True,
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        )
    except Exception as exc:
        print(f"Warning: keyframe extraction failed: {exc}", file=sys.stderr)
        return []

    frames = sorted(keyframes_dir.glob("*.jpg"))
    return [str(p) for p in frames]


# ---------------------------------------------------------------------------
# Main prep function
# ---------------------------------------------------------------------------

def prep(shortcode: str, vault_dir: Path = VAULT_DIR) -> dict[str, object]:
    """Prepare structured analysis data for a saved Instagram post.

    Returns a dict ready for JSON serialization.
    """
    index_path = vault_dir / "_index.json"
    if not index_path.exists():
        raise FileNotFoundError(
            f"Vault index not found at {index_path}. Run /sync-instagram first."
        )

    index = json.loads(index_path.read_text(encoding="utf-8"))
    entry = index.get(shortcode)
    if not entry:
        raise KeyError(
            f"Shortcode '{shortcode}' not found in vault index."
        )

    # Read markdown frontmatter
    md_file = vault_dir / entry["file"]
    fm: dict = {}
    caption = ""
    if md_file.exists():
        fm, caption = _parse_frontmatter(md_file.read_text(encoding="utf-8"))

    # Load config
    cfg = _load_analyse_config()
    benchmarks: dict[str, float] = cfg.get("benchmarks", _ANALYSE_DEFAULTS["benchmarks"])  # type: ignore[assignment]
    keyframe_count: int = int(cfg.get("keyframe_count", 6))

    # Engagement metrics
    views = fm.get("view_count")
    likes = fm.get("like_count")
    comments = fm.get("comment_count")

    raw_metrics = compute_metrics(views, likes, comments)

    metrics: dict[str, object] = {
        "views": views or 0,
        "likes": likes or 0,
        "comments": comments or 0,
        "lvr": raw_metrics["lvr"],
        "clr": raw_metrics["clr"],
        "engagement_rate": raw_metrics["engagement_rate"],
        "lvr_rating": rate(raw_metrics["lvr"], benchmarks["lvr_strong"], benchmarks["lvr_average"]),
        "clr_rating": rate(raw_metrics["clr"], benchmarks["clr_strong"], benchmarks["clr_average"]),
        "er_rating": rate(
            raw_metrics["engagement_rate"],
            benchmarks["er_strong"],
            benchmarks["er_average"],
        ),
    }

    # Post type
    post_type = entry.get("type", "post")

    # Author from frontmatter
    author = fm.get("author", "")

    # Transcript + keyframes (reels with video only)
    transcript: Optional[dict[str, object]] = None
    keyframe_paths: list[str] = []

    video_file = entry.get("video_file", "")
    video_path = vault_dir / video_file if video_file else Path("")

    if post_type == "reel" and video_file:
        transcript = _load_transcript(shortcode, video_path, vault_dir)
        keyframe_paths = _extract_keyframes(shortcode, video_path, vault_dir, keyframe_count)

    return {
        "shortcode": shortcode,
        "type": post_type,
        "author": author,
        "caption": caption,
        "metrics": metrics,
        "transcript": transcript,
        "keyframe_paths": keyframe_paths,
        "post_file": str(vault_dir / entry["file"]),
    }


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Analyse pipeline — data preparation for Instagram saved posts",
    )
    sub = parser.add_subparsers(dest="command")

    prep_p = sub.add_parser("prep", help="Prepare analysis JSON for a shortcode")
    prep_p.add_argument("shortcode", help="Instagram post shortcode")

    args = parser.parse_args()

    if args.command == "prep":
        try:
            result = prep(args.shortcode)
            print(json.dumps(result, indent=2))
        except (FileNotFoundError, KeyError) as exc:
            print(str(exc), file=sys.stderr)
            sys.exit(1)
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
