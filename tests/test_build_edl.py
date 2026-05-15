# tests/test_build_edl.py
"""Tests for scripts/video_edit/build_edl.py — EDL construction + time mapping."""

import json
from pathlib import Path

from scripts.video_edit.build_edl import build_edl, source_to_output_time, format_edit_plan


class TestSourceToOutputTime:
    """Source-time → output-time mapping for overlay placement after cuts."""

    def test_no_cuts_identity(self):
        """With no cuts, source time == output time."""
        kept_ranges = [{"start": 0.0, "end": 60.0}]
        assert source_to_output_time(10.0, kept_ranges) == 10.0
        assert source_to_output_time(0.0, kept_ranges) == 0.0
        assert source_to_output_time(59.9, kept_ranges) == 59.9

    def test_single_trim(self):
        """Trim 5.0–7.0 (2s gap). Source 8.0 → output 6.0."""
        kept_ranges = [
            {"start": 0.0, "end": 5.0},
            {"start": 7.0, "end": 20.0},
        ]
        assert source_to_output_time(3.0, kept_ranges) == 3.0
        assert source_to_output_time(8.0, kept_ranges) == 6.0
        assert source_to_output_time(10.0, kept_ranges) == 8.0

    def test_multiple_trims(self):
        """Two trims: 5–7 and 12–15. Source 16.0 → output 16 - 2 - 3 = 11.0."""
        kept_ranges = [
            {"start": 0.0, "end": 5.0},
            {"start": 7.0, "end": 12.0},
            {"start": 15.0, "end": 30.0},
        ]
        assert source_to_output_time(3.0, kept_ranges) == 3.0
        assert source_to_output_time(8.0, kept_ranges) == 6.0
        assert source_to_output_time(16.0, kept_ranges) == 11.0

    def test_source_inside_trim_returns_none(self):
        """An overlay whose source time falls inside a trimmed gap returns None."""
        kept_ranges = [
            {"start": 0.0, "end": 5.0},
            {"start": 7.0, "end": 20.0},
        ]
        assert source_to_output_time(6.0, kept_ranges) is None

    def test_source_at_range_boundary(self):
        """Source time exactly at a range start maps correctly."""
        kept_ranges = [
            {"start": 0.0, "end": 5.0},
            {"start": 10.0, "end": 20.0},
        ]
        assert source_to_output_time(10.0, kept_ranges) == 5.0


class TestBuildEdl:
    def test_mode2_no_cuts(self, tmp_path):
        """Mode 2: no cuts → single range spanning full video."""
        beats_data = {
            "beats": [
                {"index": 0, "timecode_s": 2.0, "visual_cue": "phone", "text_overlay": "", "beat_slug": "beat-00-phone"}
            ],
            "cuts": []
        }
        manifest = [
            {"beat_slug": "beat-00-phone", "timecode_s": 2.0, "broll_path": "/tmp/broll/beat-00-phone.mp4", "sfx_path": None}
        ]
        edl = build_edl(
            beats_data=beats_data,
            manifest=manifest,
            source_path=Path("/tmp/video.mp4"),
            source_duration=30.0,
            grade="auto",
            subtitles_path="edit/master.srt",
        )
        assert edl["version"] == 1
        assert len(edl["ranges"]) == 1
        assert edl["ranges"][0]["start"] == 0.0
        assert edl["ranges"][0]["end"] == 30.0
        assert len(edl["overlays"]) == 1
        assert edl["overlays"][0]["start_in_output"] == 2.0

    def test_mode3_with_cuts(self, tmp_path):
        """Mode 3: cuts produce multi-range EDL. Overlays remap to output time."""
        beats_data = {
            "beats": [
                {"index": 0, "timecode_s": 1.0, "visual_cue": "hook", "text_overlay": "", "beat_slug": "beat-00-hook"},
                {"index": 1, "timecode_s": 8.0, "visual_cue": "context", "text_overlay": "", "beat_slug": "beat-01-context"},
            ],
            "cuts": [
                {"type": "keep", "start": 0.0, "end": 5.0, "beat": "HOOK", "reason": "Clean hook"},
                {"type": "trim", "start": 5.0, "end": 7.0, "reason": "Dead air"},
                {"type": "keep", "start": 7.0, "end": 20.0, "beat": "CONTEXT", "reason": "Context"},
            ]
        }
        manifest = [
            {"beat_slug": "beat-00-hook", "timecode_s": 1.0, "broll_path": "/tmp/broll/beat-00-hook.mp4", "sfx_path": None},
            {"beat_slug": "beat-01-context", "timecode_s": 8.0, "broll_path": "/tmp/broll/beat-01-context.mp4", "sfx_path": None},
        ]
        edl = build_edl(
            beats_data=beats_data,
            manifest=manifest,
            source_path=Path("/tmp/video.mp4"),
            source_duration=20.0,
            grade="auto",
            subtitles_path="edit/master.srt",
        )
        assert len(edl["ranges"]) == 2
        assert edl["ranges"][0]["end"] == 5.0
        assert edl["ranges"][1]["start"] == 7.0
        # beat-00-hook at source 1.0 → output 1.0 (in first kept range 0-5)
        assert edl["overlays"][0]["start_in_output"] == 1.0
        # beat-01-context at source 8.0 → output 5.0 + (8.0 - 7.0) = 6.0
        assert edl["overlays"][1]["start_in_output"] == 6.0

    def test_overlay_inside_trim_is_dropped(self):
        """Overlay whose source time falls inside a trimmed gap is excluded."""
        beats_data = {
            "beats": [
                {"index": 0, "timecode_s": 6.0, "visual_cue": "dead", "text_overlay": "", "beat_slug": "beat-00-dead"},
            ],
            "cuts": [
                {"type": "keep", "start": 0.0, "end": 5.0, "beat": "HOOK", "reason": "Hook"},
                {"type": "trim", "start": 5.0, "end": 8.0, "reason": "Dead air"},
                {"type": "keep", "start": 8.0, "end": 20.0, "beat": "BODY", "reason": "Body"},
            ]
        }
        manifest = [
            {"beat_slug": "beat-00-dead", "timecode_s": 6.0, "broll_path": "/tmp/broll/dead.mp4", "sfx_path": None},
        ]
        edl = build_edl(
            beats_data=beats_data,
            manifest=manifest,
            source_path=Path("/tmp/video.mp4"),
            source_duration=20.0,
            grade="auto",
        )
        assert edl["overlays"] == []

    def test_no_subtitles_omits_field(self):
        """When subtitles_path is None, the subtitles field is absent."""
        beats_data = {"beats": [], "cuts": []}
        edl = build_edl(
            beats_data=beats_data,
            manifest=[],
            source_path=Path("/tmp/video.mp4"),
            source_duration=30.0,
            grade="auto",
        )
        assert "subtitles" not in edl

    def test_null_broll_path_skips_overlay(self):
        """Beats with null broll_path produce no overlay entry."""
        beats_data = {
            "beats": [
                {"index": 0, "timecode_s": 5.0, "visual_cue": "phone", "text_overlay": "", "beat_slug": "beat-00-phone"}
            ],
            "cuts": []
        }
        manifest = [
            {"beat_slug": "beat-00-phone", "timecode_s": 5.0, "broll_path": None, "sfx_path": None}
        ]
        edl = build_edl(
            beats_data=beats_data,
            manifest=manifest,
            source_path=Path("/tmp/video.mp4"),
            source_duration=30.0,
            grade="auto",
        )
        assert edl["overlays"] == []


class TestOverlayDuration:
    def test_overlay_duration_capped_at_next_beat(self):
        """Overlay duration is min(5s, gap to next beat)."""
        beats_data = {
            "beats": [
                {"index": 0, "timecode_s": 2.0, "visual_cue": "a", "text_overlay": "", "beat_slug": "beat-00-a"},
                {"index": 1, "timecode_s": 5.0, "visual_cue": "b", "text_overlay": "", "beat_slug": "beat-01-b"},
            ],
            "cuts": []
        }
        manifest = [
            {"beat_slug": "beat-00-a", "timecode_s": 2.0, "broll_path": "/tmp/a.mp4", "sfx_path": None},
            {"beat_slug": "beat-01-b", "timecode_s": 5.0, "broll_path": "/tmp/b.mp4", "sfx_path": None},
        ]
        edl = build_edl(
            beats_data=beats_data,
            manifest=manifest,
            source_path=Path("/tmp/video.mp4"),
            source_duration=30.0,
            grade="auto",
        )
        # beat-00 at 2.0, next beat at 5.0 → gap is 3.0 < 5.0
        assert edl["overlays"][0]["duration"] == 3.0
        # beat-01 at 5.0, no next beat → default 5.0
        assert edl["overlays"][1]["duration"] == 5.0


class TestFormatEditPlan:
    def test_plan_includes_source_and_output_duration(self):
        edl = {
            "ranges": [
                {"source": "raw", "start": 0.0, "end": 5.0, "beat": "HOOK"},
                {"source": "raw", "start": 7.0, "end": 20.0, "beat": "CONTEXT"},
            ],
            "overlays": [{"file": "/tmp/a.mp4", "start_in_output": 1.0, "duration": 3.0}],
            "grade": "auto",
            "subtitles": "edit/master.srt",
        }
        cuts = [
            {"type": "keep", "start": 0.0, "end": 5.0, "beat": "HOOK", "reason": "Clean hook"},
            {"type": "trim", "start": 5.0, "end": 7.0, "reason": "Dead air"},
            {"type": "keep", "start": 7.0, "end": 20.0, "beat": "CONTEXT", "reason": "Context"},
        ]
        plan = format_edit_plan(edl, cuts, source_duration=20.0)
        assert "20.0s" in plan
        assert "18.0s" in plan
        assert "TRIM" in plan
        assert "Dead air" in plan
