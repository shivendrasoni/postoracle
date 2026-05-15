# scripts/video_edit/edit_engine.py
#!/usr/bin/env python3
"""Thin orchestrator for the local editing engine.

Receives a complete beats.json and asset manifest, then:
1. Checks if transcription is needed (for subtitles)
2. Builds the EDL with time-mapped overlays
3. Writes the edit plan summary
4. Optionally renders the final video
"""

from __future__ import annotations

import json
import subprocess
from pathlib import Path
from typing import Optional

from scripts.video_edit.build_edl import build_edl, format_edit_plan, write_edl, write_edit_plan


def needs_transcription(edit_dir: Path, video_stem: str) -> bool:
    return not (edit_dir / "transcripts" / f"{video_stem}.json").exists()


def compute_source_duration(video_path: Path) -> float:
    result = subprocess.run(
        [
            "ffprobe", "-v", "error",
            "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1",
            str(video_path),
        ],
        capture_output=True,
        text=True,
        check=True,
    )
    return float(result.stdout.strip())


def run_engine(
    session_dir: Path,
    source_video: Path,
    beats_path: Path,
    manifest_path: Path,
    grade: str = "auto",
    subtitles: bool = True,
    render: bool = True,
) -> tuple[Path, Path]:
    edit_dir = session_dir / "edit"
    video_stem = source_video.stem

    if subtitles and needs_transcription(edit_dir, video_stem):
        subprocess.run(
            ["python3", "scripts/video_edit/transcribe.py", str(source_video), "--edit-dir", str(edit_dir)],
            check=True,
        )

    beats_data = json.loads(beats_path.read_text())
    manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else []

    duration = compute_source_duration(source_video)

    subtitles_path = "edit/master.srt" if subtitles else None

    edl = build_edl(
        beats_data=beats_data,
        manifest=manifest,
        source_path=source_video,
        source_duration=duration,
        grade=grade,
        subtitles_path=subtitles_path,
    )

    edl_path = session_dir / "edit" / "edl.json"
    write_edl(edl, edl_path)

    cuts = beats_data.get("cuts", [])
    plan_text = format_edit_plan(edl, cuts, source_duration=duration)
    plan_path = session_dir / "edit" / "edit_plan.txt"
    write_edit_plan(plan_text, plan_path)

    if render:
        render_cmd = [
            "python3", "scripts/video_edit/render.py",
            str(edl_path),
            "-o", str(session_dir / "edit" / "final.mp4"),
        ]
        if subtitles:
            render_cmd.append("--build-subtitles")
        else:
            render_cmd.append("--no-subtitles")
        subprocess.run(render_cmd, check=True)

    return edl_path, plan_path
