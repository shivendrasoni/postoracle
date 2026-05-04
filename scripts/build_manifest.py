#!/usr/bin/env python3
import argparse
import json
from pathlib import Path
from typing import Optional


def _find_broll(broll_dir: Path, slug: str) -> Optional[str]:
    for ext in (".mp4", ".jpg", ".png"):
        p = broll_dir / f"{slug}{ext}"
        if p.exists():
            return str(p)
    return None


def _find_sfx(sfx_dir: Path, slug: str) -> Optional[str]:
    p = sfx_dir / f"{slug}.mp3"
    return str(p) if p.exists() else None


def build_manifest(
    beats: list[dict], broll_dir: Path, sfx_dir: Path
) -> list[dict]:
    manifest = []
    for beat in beats:
        slug = beat["beat_slug"]
        manifest.append(
            {
                "beat_slug": slug,
                "timecode_s": beat["timecode_s"],
                "visual_cue": beat["visual_cue"],
                "text_overlay": beat.get("text_overlay", ""),
                "broll_path": _find_broll(broll_dir, slug),
                "sfx_path": _find_sfx(sfx_dir, slug),
            }
        )
    return manifest


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("beats_json")
    parser.add_argument("broll_dir")
    parser.add_argument("sfx_dir")
    parser.add_argument("out_path")
    args = parser.parse_args()

    beats = json.loads(Path(args.beats_json).read_text())
    manifest = build_manifest(beats, Path(args.broll_dir), Path(args.sfx_dir))
    Path(args.out_path).write_text(json.dumps(manifest, indent=2))
    print(f"Manifest written: {args.out_path} ({len(manifest)} beats)")
