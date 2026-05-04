from scripts.parse_script import parse_script_str

FIXTURE = """\
**Topic:** AI Agents
**Style:** Punchy

(0:00) [Text: "STOP DOING THIS"]
[Visual: Person staring at phone]

(0:05) [Visual: Robot taking over office tasks]

(0:12) [Visual: Happy person using AI assistant]
[Text: "Work smarter"]
"""

def test_extracts_three_beats():
    beats = parse_script_str(FIXTURE)
    assert len(beats) == 3

def test_first_beat_timecode_zero():
    beats = parse_script_str(FIXTURE)
    assert beats[0]["timecode_s"] == 0

def test_second_beat_timecode():
    beats = parse_script_str(FIXTURE)
    assert beats[1]["timecode_s"] == 5

def test_third_beat_timecode():
    beats = parse_script_str(FIXTURE)
    assert beats[2]["timecode_s"] == 12

def test_visual_cue_extracted():
    beats = parse_script_str(FIXTURE)
    assert "phone" in beats[0]["visual_cue"].lower() or "stop" in beats[0]["visual_cue"].lower()

def test_second_beat_visual_cue():
    beats = parse_script_str(FIXTURE)
    assert "robot" in beats[1]["visual_cue"].lower()

def test_beat_slug_starts_with_index():
    beats = parse_script_str(FIXTURE)
    assert beats[0]["beat_slug"].startswith("beat-00-")
    assert beats[1]["beat_slug"].startswith("beat-01-")

def test_text_overlay_extracted():
    beats = parse_script_str(FIXTURE)
    assert "STOP" in beats[0]["text_overlay"] or beats[0]["text_overlay"] != ""

def test_empty_script_returns_empty():
    beats = parse_script_str("")
    assert beats == []

def test_visual_cue_falls_back_to_text_overlay():
    content = "(0:00) [Text: \"fallback text\"]"
    beats = parse_script_str(content)
    assert len(beats) == 1
    assert beats[0]["visual_cue"] != ""
