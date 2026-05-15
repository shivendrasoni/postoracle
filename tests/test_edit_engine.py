# tests/test_edit_engine.py
"""Tests for scripts/video_edit/edit_engine.py — editing engine orchestrator."""

import json
from pathlib import Path
from unittest.mock import patch, MagicMock

from scripts.video_edit.edit_engine import (
    needs_transcription,
    compute_source_duration,
    run_engine,
)


class TestNeedsTranscription:
    def test_true_when_no_transcript_exists(self, tmp_path):
        edit_dir = tmp_path / "edit"
        edit_dir.mkdir()
        assert needs_transcription(edit_dir, "raw") is True

    def test_false_when_transcript_exists(self, tmp_path):
        edit_dir = tmp_path / "edit"
        transcripts = edit_dir / "transcripts"
        transcripts.mkdir(parents=True)
        (transcripts / "raw.json").write_text('{"words": []}')
        assert needs_transcription(edit_dir, "raw") is False


class TestComputeSourceDuration:
    @patch("scripts.video_edit.edit_engine.subprocess.run")
    def test_parses_ffprobe_output(self, mock_run):
        mock_run.return_value = MagicMock(stdout="134.56\n", returncode=0)
        assert compute_source_duration(Path("/tmp/video.mp4")) == 134.56

    @patch("scripts.video_edit.edit_engine.subprocess.run")
    def test_raises_on_failure(self, mock_run):
        mock_run.side_effect = Exception("ffprobe not found")
        try:
            compute_source_duration(Path("/tmp/video.mp4"))
            assert False, "Should have raised"
        except Exception:
            pass


class TestRunEngine:
    def test_writes_edl_and_edit_plan(self, tmp_path):
        """When transcript already exists, engine builds EDL and edit plan."""
        session_dir = tmp_path / "session"
        session_dir.mkdir()
        (session_dir / "edit" / "transcripts").mkdir(parents=True)
        (session_dir / "edit" / "transcripts" / "raw.json").write_text('{"words": []}')
        (session_dir / "broll").mkdir()
        (session_dir / "sfx").mkdir()

        beats_data = {"beats": [], "cuts": []}
        (session_dir / "beats.json").write_text(json.dumps(beats_data))

        manifest = []
        (session_dir / "asset_manifest.json").write_text(json.dumps(manifest))

        with patch("scripts.video_edit.edit_engine.compute_source_duration", return_value=30.0), \
             patch("scripts.video_edit.edit_engine.subprocess.run"):
            edl_path, plan_path = run_engine(
                session_dir=session_dir,
                source_video=session_dir / "raw.mp4",
                beats_path=session_dir / "beats.json",
                manifest_path=session_dir / "asset_manifest.json",
                grade="auto",
                subtitles=True,
                render=False,
            )

        assert edl_path.exists()
        assert plan_path.exists()
        edl = json.loads(edl_path.read_text())
        assert edl["version"] == 1
        assert "Edit Plan:" in plan_path.read_text()

    def test_triggers_transcription_when_missing_and_subtitles_on(self, tmp_path):
        """When subtitles=True and no transcript exists, engine calls transcribe.py."""
        session_dir = tmp_path / "session"
        session_dir.mkdir()
        (session_dir / "edit").mkdir()
        (session_dir / "broll").mkdir()
        (session_dir / "sfx").mkdir()

        beats_data = {"beats": [], "cuts": []}
        (session_dir / "beats.json").write_text(json.dumps(beats_data))
        (session_dir / "asset_manifest.json").write_text("[]")

        with patch("scripts.video_edit.edit_engine.compute_source_duration", return_value=30.0), \
             patch("scripts.video_edit.edit_engine.subprocess.run") as mock_run:
            run_engine(
                session_dir=session_dir,
                source_video=session_dir / "raw.mp4",
                beats_path=session_dir / "beats.json",
                manifest_path=session_dir / "asset_manifest.json",
                grade="auto",
                subtitles=True,
                render=False,
            )
        transcribe_calls = [
            c for c in mock_run.call_args_list
            if any("transcribe.py" in str(a) for a in c[0][0])
        ]
        assert len(transcribe_calls) == 1

    def test_skips_transcription_when_subtitles_off(self, tmp_path):
        """When subtitles=False, engine does NOT call transcribe.py even if no transcript exists."""
        session_dir = tmp_path / "session"
        session_dir.mkdir()
        (session_dir / "edit").mkdir()
        (session_dir / "broll").mkdir()
        (session_dir / "sfx").mkdir()

        beats_data = {"beats": [], "cuts": []}
        (session_dir / "beats.json").write_text(json.dumps(beats_data))
        (session_dir / "asset_manifest.json").write_text("[]")

        with patch("scripts.video_edit.edit_engine.compute_source_duration", return_value=30.0), \
             patch("scripts.video_edit.edit_engine.subprocess.run") as mock_run:
            run_engine(
                session_dir=session_dir,
                source_video=session_dir / "raw.mp4",
                beats_path=session_dir / "beats.json",
                manifest_path=session_dir / "asset_manifest.json",
                grade="auto",
                subtitles=False,
                render=False,
            )
        transcribe_calls = [
            c for c in mock_run.call_args_list
            if any("transcribe.py" in str(a) for a in c[0][0])
        ]
        assert len(transcribe_calls) == 0
