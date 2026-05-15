#!/usr/bin/env python3
import argparse
import json
import re
from pathlib import Path
from typing import Optional

TIMECODE_RE = re.compile(r"\((\d+):(\d{2})\)")
VISUAL_RE = re.compile(r"\[Visual:\s*([^\]]+)\]", re.IGNORECASE)
TEXT_RE = re.compile(r'\[Text:\s*"?([^"\]]+)"?\]', re.IGNORECASE)


def _slugify(text: str, index: int) -> str:
    text = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:30]
    return f"beat-{index:02d}-{text}"


def parse_script_str(content: str) -> dict:
    beats: list[dict] = []
    lines = content.splitlines()

    for i, line in enumerate(lines):
        tc_match = TIMECODE_RE.search(line)
        if not tc_match:
            continue

        m, s = int(tc_match.group(1)), int(tc_match.group(2))
        timecode_s = m * 60 + s
        visual_cue = ""
        text_overlay = ""

        # Search current line + up to 3 following lines for cues
        window = lines[i : min(i + 4, len(lines))]
        for wline in window:
            if not visual_cue:
                vm = VISUAL_RE.search(wline)
                if vm:
                    visual_cue = vm.group(1).strip()
            if not text_overlay:
                tm = TEXT_RE.search(wline)
                if tm:
                    text_overlay = tm.group(1).strip()

        cue = visual_cue or text_overlay or f"beat-{len(beats)}"
        beats.append(
            {
                "index": len(beats),
                "timecode_s": timecode_s,
                "visual_cue": cue,
                "text_overlay": text_overlay,
                "beat_slug": _slugify(cue, len(beats)),
            }
        )

    return {"beats": beats, "cuts": []}


def parse_script(path: Path) -> dict:
    return parse_script_str(path.read_text())


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("script_path")
    args = parser.parse_args()
    print(json.dumps(parse_script(Path(args.script_path)), indent=2))
