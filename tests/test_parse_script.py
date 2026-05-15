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

def test_returns_dict_with_expected_keys():
    result = parse_script_str(FIXTURE)
    assert "beats" in result and "cuts" in result

def test_cuts_always_empty():
    result = parse_script_str(FIXTURE)
    assert result["cuts"] == []

def test_extracts_three_beats():
    result = parse_script_str(FIXTURE)
    assert len(result["beats"]) == 3

def test_first_beat_timecode_zero():
    result = parse_script_str(FIXTURE)
    assert result["beats"][0]["timecode_s"] == 0

def test_second_beat_timecode():
    result = parse_script_str(FIXTURE)
    assert result["beats"][1]["timecode_s"] == 5

def test_third_beat_timecode():
    result = parse_script_str(FIXTURE)
    assert result["beats"][2]["timecode_s"] == 12

def test_visual_cue_extracted():
    result = parse_script_str(FIXTURE)
    assert "phone" in result["beats"][0]["visual_cue"].lower() or "stop" in result["beats"][0]["visual_cue"].lower()

def test_second_beat_visual_cue():
    result = parse_script_str(FIXTURE)
    assert "robot" in result["beats"][1]["visual_cue"].lower()

def test_beat_slug_starts_with_index():
    result = parse_script_str(FIXTURE)
    assert result["beats"][0]["beat_slug"].startswith("beat-00-")
    assert result["beats"][1]["beat_slug"].startswith("beat-01-")

def test_text_overlay_extracted():
    result = parse_script_str(FIXTURE)
    assert "STOP" in result["beats"][0]["text_overlay"] or result["beats"][0]["text_overlay"] != ""

def test_empty_script_returns_empty():
    result = parse_script_str("")
    assert result["beats"] == []
    assert result["cuts"] == []

def test_visual_cue_falls_back_to_text_overlay():
    content = "(0:00) [Text: \"fallback text\"]"
    result = parse_script_str(content)
    assert len(result["beats"]) == 1
    assert result["beats"][0]["visual_cue"] != ""
