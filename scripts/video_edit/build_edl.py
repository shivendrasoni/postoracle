# scripts/video_edit/build_edl.py
#!/usr/bin/env python3
"""Build an EDL from beats.json with source→output time mapping for overlays."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Optional

MAX_OVERLAY_DURATION = 5.0


def source_to_output_time(
    source_t: float,
    kept_ranges: list[dict],
) -> Optional[float]:
    cumulative = 0.0
    for r in kept_ranges:
        if r["start"] <= source_t < r["end"]:
            return cumulative + (source_t - r["start"])
        cumulative += r["end"] - r["start"]
    if kept_ranges and source_t == kept_ranges[-1]["end"]:
        return cumulative
    return None


def _overlay_duration(
    beat_index: int,
    beats: list[dict],
    kept_ranges: list[dict],
    source_duration: float,
) -> float:
    if beat_index + 1 < len(beats):
        next_t = beats[beat_index + 1]["timecode_s"]
        next_output = source_to_output_time(next_t, kept_ranges)
        current_output = source_to_output_time(beats[beat_index]["timecode_s"], kept_ranges)
        if next_output is not None and current_output is not None:
            gap = next_output - current_output
            return min(MAX_OVERLAY_DURATION, gap)
    return MAX_OVERLAY_DURATION


def build_edl(
    beats_data: dict,
    manifest: list[dict],
    source_path: Path,
    source_duration: float,
    grade: str = "auto",
    subtitles_path: Optional[str] = None,
) -> dict:
    beats = beats_data.get("beats", [])
    cuts = beats_data.get("cuts", [])

    if cuts:
        kept_ranges = [c for c in cuts if c["type"] == "keep"]
    else:
        kept_ranges = [{"start": 0.0, "end": source_duration}]

    ranges = []
    for r in kept_ranges:
        entry = {
            "source": "raw",
            "start": r["start"],
            "end": r["end"],
        }
        if "beat" in r:
            entry["beat"] = r["beat"]
        if "reason" in r:
            entry["reason"] = r["reason"]
        ranges.append(entry)

    broll_lookup = {}
    for item in manifest:
        if item.get("broll_path"):
            broll_lookup[item["beat_slug"]] = item

    overlays = []
    for beat in beats:
        slug = beat["beat_slug"]
        asset = broll_lookup.get(slug)
        if not asset:
            continue
        output_t = source_to_output_time(beat["timecode_s"], kept_ranges)
        if output_t is None:
            continue
        duration = _overlay_duration(beat["index"], beats, kept_ranges, source_duration)
        overlays.append({
            "file": asset["broll_path"],
            "start_in_output": output_t,
            "duration": duration,
        })

    edl: dict = {
        "version": 1,
        "sources": {"raw": str(source_path.resolve())},
        "ranges": ranges,
        "grade": grade,
        "overlays": overlays,
    }
    if subtitles_path:
        edl["subtitles"] = subtitles_path

    return edl


def _fmt_time(seconds: float) -> str:
    m = int(seconds) // 60
    s = int(seconds) % 60
    return f"{m}:{s:02d}"


def format_edit_plan(
    edl: dict,
    cuts: list[dict],
    source_duration: float,
) -> str:
    output_duration = sum(r["end"] - r["start"] for r in edl["ranges"])
    trimmed_pct = (1 - output_duration / source_duration) * 100 if source_duration > 0 else 0

    lines = [
        "Edit Plan:",
        f"  Source: {source_duration:.1f}s",
        f"  Output: ~{output_duration:.1f}s ({trimmed_pct:.0f}% trimmed)",
        "",
    ]

    trims = [c for c in cuts if c["type"] == "trim"]
    if trims:
        lines.append("  Cuts:")
        for t in trims:
            lines.append(f"    - {_fmt_time(t['start'])}–{_fmt_time(t['end'])}  TRIM  {t.get('reason', '')}")
        lines.append("")

    keeps = [c for c in cuts if c["type"] == "keep"]
    if keeps:
        lines.append("  Kept beats:")
        for k in keeps:
            label = k.get("beat", "—")
            lines.append(f"    {label:<12s} {_fmt_time(k['start'])}–{_fmt_time(k['end'])}  {k.get('reason', '')}")
        lines.append("")

    n_overlays = len(edl.get("overlays", []))
    lines.append(f"  B-roll: {n_overlays} overlay(s)")
    lines.append(f"  Grade: {edl.get('grade', 'auto')}")
    lines.append(f"  Subtitles: {'yes' if edl.get('subtitles') else 'no'}")

    return "\n".join(lines)


def write_edl(edl: dict, edl_path: Path) -> None:
    edl_path.parent.mkdir(parents=True, exist_ok=True)
    edl_path.write_text(json.dumps(edl, indent=2))


def write_edit_plan(plan_text: str, plan_path: Path) -> None:
    plan_path.parent.mkdir(parents=True, exist_ok=True)
    plan_path.write_text(plan_text)
