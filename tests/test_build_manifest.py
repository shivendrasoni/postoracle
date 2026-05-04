import json
from pathlib import Path
from scripts.build_manifest import build_manifest

BEATS = [
    {"index": 0, "timecode_s": 0, "visual_cue": "person with phone", "text_overlay": "STOP", "beat_slug": "beat-00-person"},
    {"index": 1, "timecode_s": 5, "visual_cue": "robot office", "text_overlay": "", "beat_slug": "beat-01-robot"},
]


def test_manifest_has_entry_per_beat(tmp_path):
    manifest = build_manifest(BEATS, broll_dir=tmp_path, sfx_dir=tmp_path)
    assert len(manifest) == 2


def test_manifest_includes_beat_slug(tmp_path):
    manifest = build_manifest(BEATS, broll_dir=tmp_path, sfx_dir=tmp_path)
    assert manifest[0]["beat_slug"] == "beat-00-person"


def test_manifest_broll_path_is_none_when_file_missing(tmp_path):
    manifest = build_manifest(BEATS, broll_dir=tmp_path, sfx_dir=tmp_path)
    assert manifest[0]["broll_path"] is None


def test_manifest_broll_path_set_when_video_exists(tmp_path):
    (tmp_path / "beat-00-person.mp4").touch()
    manifest = build_manifest(BEATS, broll_dir=tmp_path, sfx_dir=tmp_path)
    assert manifest[0]["broll_path"] is not None
    assert manifest[0]["broll_path"].endswith(".mp4")


def test_manifest_broll_path_prefers_video_over_photo(tmp_path):
    (tmp_path / "beat-00-person.mp4").touch()
    (tmp_path / "beat-00-person.jpg").touch()
    manifest = build_manifest(BEATS, broll_dir=tmp_path, sfx_dir=tmp_path)
    assert manifest[0]["broll_path"].endswith(".mp4")


def test_manifest_broll_falls_back_to_jpg(tmp_path):
    (tmp_path / "beat-00-person.jpg").touch()
    manifest = build_manifest(BEATS, broll_dir=tmp_path, sfx_dir=tmp_path)
    assert manifest[0]["broll_path"].endswith(".jpg")


def test_manifest_sfx_path_is_none_when_missing(tmp_path):
    manifest = build_manifest(BEATS, broll_dir=tmp_path, sfx_dir=tmp_path)
    assert manifest[0]["sfx_path"] is None


def test_manifest_sfx_path_set_when_exists(tmp_path):
    (tmp_path / "beat-00-person.mp3").touch()
    manifest = build_manifest(BEATS, broll_dir=tmp_path, sfx_dir=tmp_path)
    assert manifest[0]["sfx_path"].endswith(".mp3")
