# /make-reel Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a `/make-reel` Claude Code slash command that takes a URL or topic and produces a fully edited portrait short-form video (script → HeyGen avatar → b-roll → edit → subtitles → final.mp4).

**Architecture:** A single command file (`make-reel.md`) orchestrates five sequential stages by invoking existing skills (viral-reel-generator, heygen-video, video-use) and a set of focused Python helper scripts for env validation, session management, script parsing, and asset fetching. Each helper script is independently testable with mocked APIs.

**Tech Stack:** Python 3.12, `requests`, `openai` SDK, Pexels REST API, Pixabay REST API, Claude Code skills (viral-reel-generator, heygen-video, video-use), ffmpeg (via video-use skill)

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `.claude/commands/make-reel.md` | Create | Slash command prompt — orchestrates all 5 stages |
| `scripts/check_env.py` | Create | Validate required env vars at startup, fail fast |
| `scripts/create_session.py` | Create | Create timestamped session folder + subdirs |
| `scripts/parse_script.py` | Create | Parse script.md beats → structured JSON with timecodes + visual cues |
| `scripts/fetch_broll.py` | Create | Fetch Pexels video (primary) → Pexels photo (fallback) per beat |
| `scripts/fetch_images.py` | Create | Generate OpenAI gpt-image-2 image (tertiary fallback) per beat |
| `scripts/fetch_sfx.py` | Create | Fetch Pixabay SFX per beat (optional, skip gracefully if no key) |
| `scripts/build_manifest.py` | Create | Combine fetched assets into asset_manifest.json for video-use |
| `tests/test_check_env.py` | Create | Unit tests for check_env |
| `tests/test_create_session.py` | Create | Unit tests for create_session |
| `tests/test_parse_script.py` | Create | Unit tests for parse_script with fixture |
| `tests/test_fetch_broll.py` | Create | Unit tests for fetch_broll with mocked requests |
| `tests/test_fetch_images.py` | Create | Unit tests for fetch_images with mocked openai |
| `tests/test_fetch_sfx.py` | Create | Unit tests for fetch_sfx with mocked requests |
| `tests/test_build_manifest.py` | Create | Unit tests for build_manifest |
| `requirements.txt` | Create | Python dependencies |
| `.env` | Already created | Environment variables (do not commit) |
| `.gitignore` | Create/update | Ignore .env, output/, __pycache__ |

---

## Task 1: Project Scaffolding

**Files:**
- Create: `requirements.txt`
- Create: `.gitignore`
- Create: `scripts/__init__.py`
- Create: `tests/__init__.py`

- [ ] **Step 1: Create requirements.txt**

```
requests>=2.33.0
openai>=1.0.0
pytest>=8.0.0
pytest-mock>=3.14.0
```

- [ ] **Step 2: Create .gitignore**

```
.env
output/
__pycache__/
*.pyc
.pytest_cache/
```

- [ ] **Step 3: Create package init files**

```bash
mkdir -p scripts tests .claude/commands
touch scripts/__init__.py tests/__init__.py
```

- [ ] **Step 4: Install dependencies**

```bash
pip3 install -r requirements.txt
```

Expected: all packages install without error.

- [ ] **Step 5: Verify pytest works**

```bash
python3 -m pytest --collect-only
```

Expected: `no tests ran` (no test files yet) — not an error.

- [ ] **Step 6: Commit**

```bash
git init  # only if not already a git repo
git add requirements.txt .gitignore scripts/__init__.py tests/__init__.py
git commit -m "feat: scaffold make-reel pipeline project"
```

---

## Task 2: check_env.py

**Files:**
- Create: `scripts/check_env.py`
- Create: `tests/test_check_env.py`

- [ ] **Step 1: Write the failing tests**

Create `tests/test_check_env.py`:

```python
from scripts.check_env import check_env

def test_all_required_present():
    env = {"PEXELS_API_KEY": "x", "OPENAI_API_KEY": "x", "HEYGEN_API_KEY": "x"}
    missing, missing_optional = check_env(env)
    assert missing == []

def test_single_required_missing():
    env = {"OPENAI_API_KEY": "x", "HEYGEN_API_KEY": "x"}
    missing, _ = check_env(env)
    assert "PEXELS_API_KEY" in missing

def test_all_required_missing():
    missing, _ = check_env({})
    assert set(missing) == {"PEXELS_API_KEY", "OPENAI_API_KEY", "HEYGEN_API_KEY"}

def test_optional_missing_not_in_required():
    env = {"PEXELS_API_KEY": "x", "OPENAI_API_KEY": "x", "HEYGEN_API_KEY": "x"}
    missing, missing_optional = check_env(env)
    assert missing == []
    assert "PIXABAY_API_KEY" in missing_optional
    assert "ELEVENLABS_API_KEY" in missing_optional

def test_optional_present():
    env = {
        "PEXELS_API_KEY": "x", "OPENAI_API_KEY": "x", "HEYGEN_API_KEY": "x",
        "PIXABAY_API_KEY": "y", "ELEVENLABS_API_KEY": "z",
    }
    _, missing_optional = check_env(env)
    assert missing_optional == []
```

- [ ] **Step 2: Run to verify tests fail**

```bash
python3 -m pytest tests/test_check_env.py -v
```

Expected: `ModuleNotFoundError: No module named 'scripts.check_env'`

- [ ] **Step 3: Implement check_env.py**

Create `scripts/check_env.py`:

```python
#!/usr/bin/env python3
import os
import sys
from typing import Optional

REQUIRED = ["PEXELS_API_KEY", "OPENAI_API_KEY", "HEYGEN_API_KEY"]
OPTIONAL = ["PIXABAY_API_KEY", "ELEVENLABS_API_KEY"]


def check_env(env: Optional[dict] = None) -> tuple[list[str], list[str]]:
    e = env if env is not None else dict(os.environ)
    missing = [k for k in REQUIRED if not e.get(k)]
    missing_optional = [k for k in OPTIONAL if not e.get(k)]
    return missing, missing_optional


if __name__ == "__main__":
    missing, missing_optional = check_env()
    if missing_optional:
        print(f"[INFO] Optional keys not set (SFX skipped): {', '.join(missing_optional)}", file=sys.stderr)
    if missing:
        print(f"[ERROR] Missing required env vars: {', '.join(missing)}", file=sys.stderr)
        sys.exit(1)
    print("Environment OK")
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
python3 -m pytest tests/test_check_env.py -v
```

Expected: `5 passed`

- [ ] **Step 5: Commit**

```bash
git add scripts/check_env.py tests/test_check_env.py
git commit -m "feat: add env validation script"
```

---

## Task 3: create_session.py

**Files:**
- Create: `scripts/create_session.py`
- Create: `tests/test_create_session.py`

- [ ] **Step 1: Write the failing tests**

Create `tests/test_create_session.py`:

```python
from datetime import date
from scripts.create_session import create_session, slugify

def test_creates_required_subdirs(tmp_path):
    session_dir = create_session("AI agents", tmp_path)
    assert (session_dir / "broll").exists()
    assert (session_dir / "sfx").exists()
    assert (session_dir / "edit").exists()

def test_folder_name_includes_today(tmp_path):
    session_dir = create_session("test topic", tmp_path)
    assert str(date.today()) in session_dir.name

def test_folder_name_includes_slug(tmp_path):
    session_dir = create_session("AI agents are amazing", tmp_path)
    assert "ai" in session_dir.name

def test_slugify_url_becomes_url(tmp_path):
    slug = slugify("https://example.com/some-article")
    assert "http" not in slug
    assert len(slug) <= 40

def test_slug_strips_special_chars():
    slug = slugify("Hello, World! This is a test.")
    assert "," not in slug
    assert "!" not in slug
    assert " " not in slug

def test_session_dir_is_inside_output_reels(tmp_path):
    session_dir = create_session("topic", tmp_path)
    assert "output" in str(session_dir)
    assert "reels" in str(session_dir)

def test_idempotent_on_existing_dir(tmp_path):
    create_session("topic", tmp_path)
    create_session("topic", tmp_path)  # should not raise
```

- [ ] **Step 2: Run to verify tests fail**

```bash
python3 -m pytest tests/test_create_session.py -v
```

Expected: `ModuleNotFoundError: No module named 'scripts.create_session'`

- [ ] **Step 3: Implement create_session.py**

Create `scripts/create_session.py`:

```python
#!/usr/bin/env python3
import argparse
import re
import sys
from datetime import date
from pathlib import Path


def slugify(text: str) -> str:
    text = re.sub(r"https?://\S+", "url", text)
    text = text.lower()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return text.strip("-")[:40]


def create_session(topic: str, base_dir: Path) -> Path:
    slug = slugify(topic)
    folder_name = f"{date.today()}-{slug}"
    session_dir = base_dir / "output" / "reels" / folder_name
    session_dir.mkdir(parents=True, exist_ok=True)
    for subdir in ("broll", "sfx", "edit"):
        (session_dir / subdir).mkdir(exist_ok=True)
    return session_dir


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("topic")
    parser.add_argument("--base-dir", default=".")
    args = parser.parse_args()
    session_dir = create_session(args.topic, Path(args.base_dir))
    print(str(session_dir))
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
python3 -m pytest tests/test_create_session.py -v
```

Expected: `7 passed`

- [ ] **Step 5: Commit**

```bash
git add scripts/create_session.py tests/test_create_session.py
git commit -m "feat: add session folder creation script"
```

---

## Task 4: parse_script.py

**Files:**
- Create: `scripts/parse_script.py`
- Create: `tests/test_parse_script.py`

- [ ] **Step 1: Write the failing tests**

Create `tests/test_parse_script.py`:

```python
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
```

- [ ] **Step 2: Run to verify tests fail**

```bash
python3 -m pytest tests/test_parse_script.py -v
```

Expected: `ModuleNotFoundError: No module named 'scripts.parse_script'`

- [ ] **Step 3: Implement parse_script.py**

Create `scripts/parse_script.py`:

```python
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


def parse_script_str(content: str) -> list[dict]:
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

    return beats


def parse_script(path: Path) -> list[dict]:
    return parse_script_str(path.read_text())


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("script_path")
    args = parser.parse_args()
    print(json.dumps(parse_script(Path(args.script_path)), indent=2))
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
python3 -m pytest tests/test_parse_script.py -v
```

Expected: `10 passed`

- [ ] **Step 5: Commit**

```bash
git add scripts/parse_script.py tests/test_parse_script.py
git commit -m "feat: add script.md beat parser"
```

---

## Task 5: fetch_broll.py

**Files:**
- Create: `scripts/fetch_broll.py`
- Create: `tests/test_fetch_broll.py`

- [ ] **Step 1: Write the failing tests**

Create `tests/test_fetch_broll.py`:

```python
import pytest
from pathlib import Path
from unittest.mock import patch, MagicMock
from scripts.fetch_broll import fetch_video, fetch_photo

PEXELS_VIDEO_RESPONSE = {
    "videos": [{
        "id": 1,
        "video_files": [
            {"quality": "hd", "file_type": "video/mp4", "link": "https://example.com/video.mp4"}
        ]
    }]
}

PEXELS_PHOTO_RESPONSE = {
    "photos": [{
        "id": 1,
        "src": {"portrait": "https://example.com/photo.jpg"}
    }]
}

PEXELS_EMPTY_RESPONSE = {"videos": [], "photos": []}


@patch("scripts.fetch_broll.requests.get")
def test_fetch_video_returns_mp4_path(mock_get, tmp_path):
    mock_resp = MagicMock()
    mock_resp.json.return_value = PEXELS_VIDEO_RESPONSE
    mock_resp.raise_for_status.return_value = None
    mock_get.return_value = mock_resp

    with patch("scripts.fetch_broll.urllib.request.urlretrieve") as mock_dl:
        mock_dl.side_effect = lambda url, path: Path(path).touch()
        result = fetch_video("sunset", tmp_path, "beat-00-sunset", api_key="test")

    assert result is not None
    assert str(result).endswith(".mp4")


@patch("scripts.fetch_broll.requests.get")
def test_fetch_video_returns_none_when_empty(mock_get, tmp_path):
    mock_resp = MagicMock()
    mock_resp.json.return_value = {"videos": []}
    mock_resp.raise_for_status.return_value = None
    mock_get.return_value = mock_resp

    result = fetch_video("xyznotfound", tmp_path, "beat-00-xyz", api_key="test")
    assert result is None


@patch("scripts.fetch_broll.requests.get")
def test_fetch_photo_returns_jpg_path(mock_get, tmp_path):
    mock_resp = MagicMock()
    mock_resp.json.return_value = PEXELS_PHOTO_RESPONSE
    mock_resp.raise_for_status.return_value = None
    mock_get.return_value = mock_resp

    with patch("scripts.fetch_broll.urllib.request.urlretrieve") as mock_dl:
        mock_dl.side_effect = lambda url, path: Path(path).touch()
        result = fetch_photo("city", tmp_path, "beat-01-city", api_key="test")

    assert result is not None
    assert str(result).endswith(".jpg")


@patch("scripts.fetch_broll.requests.get")
def test_fetch_photo_returns_none_when_empty(mock_get, tmp_path):
    mock_resp = MagicMock()
    mock_resp.json.return_value = {"photos": []}
    mock_resp.raise_for_status.return_value = None
    mock_get.return_value = mock_resp

    result = fetch_photo("xyznotfound", tmp_path, "beat-01-xyz", api_key="test")
    assert result is None
```

- [ ] **Step 2: Run to verify tests fail**

```bash
python3 -m pytest tests/test_fetch_broll.py -v
```

Expected: `ModuleNotFoundError: No module named 'scripts.fetch_broll'`

- [ ] **Step 3: Implement fetch_broll.py**

Create `scripts/fetch_broll.py`:

```python
#!/usr/bin/env python3
import argparse
import os
import sys
import urllib.request
from pathlib import Path
from typing import Optional

import requests

PEXELS_VIDEO_URL = "https://api.pexels.com/videos/search"
PEXELS_PHOTO_URL = "https://api.pexels.com/v1/search"


def fetch_video(
    keyword: str, out_dir: Path, slug: str, api_key: Optional[str] = None
) -> Optional[Path]:
    key = api_key or os.environ["PEXELS_API_KEY"]
    headers = {"Authorization": key}
    resp = requests.get(
        PEXELS_VIDEO_URL,
        headers=headers,
        params={"query": keyword, "orientation": "portrait", "per_page": 3, "min_duration": 5},
        timeout=15,
    )
    resp.raise_for_status()
    for video in resp.json().get("videos", []):
        for f in video.get("video_files", []):
            if f.get("quality") in ("hd", "sd") and f.get("file_type") == "video/mp4":
                out_path = out_dir / f"{slug}.mp4"
                urllib.request.urlretrieve(f["link"], out_path)
                return out_path
    return None


def fetch_photo(
    keyword: str, out_dir: Path, slug: str, api_key: Optional[str] = None
) -> Optional[Path]:
    key = api_key or os.environ["PEXELS_API_KEY"]
    headers = {"Authorization": key}
    resp = requests.get(
        PEXELS_PHOTO_URL,
        headers=headers,
        params={"query": keyword, "orientation": "portrait", "per_page": 1},
        timeout=15,
    )
    resp.raise_for_status()
    photos = resp.json().get("photos", [])
    if not photos:
        return None
    url = photos[0]["src"]["portrait"]
    out_path = out_dir / f"{slug}.jpg"
    urllib.request.urlretrieve(url, out_path)
    return out_path


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("keyword")
    parser.add_argument("out_dir")
    parser.add_argument("slug")
    args = parser.parse_args()

    out_dir = Path(args.out_dir)
    result = fetch_video(args.keyword, out_dir, args.slug) or fetch_photo(
        args.keyword, out_dir, args.slug
    )
    if result:
        print(str(result))
    else:
        print("NOT_FOUND", file=sys.stderr)
        sys.exit(1)
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
python3 -m pytest tests/test_fetch_broll.py -v
```

Expected: `4 passed`

- [ ] **Step 5: Commit**

```bash
git add scripts/fetch_broll.py tests/test_fetch_broll.py
git commit -m "feat: add Pexels b-roll fetcher (video + photo fallback)"
```

---

## Task 6: fetch_images.py

**Files:**
- Create: `scripts/fetch_images.py`
- Create: `tests/test_fetch_images.py`

- [ ] **Step 1: Write the failing tests**

Create `tests/test_fetch_images.py`:

```python
import base64
from pathlib import Path
from unittest.mock import MagicMock, patch

from scripts.fetch_images import generate_image

FAKE_PNG = base64.b64encode(b"fakepngbytes").decode()


@patch("scripts.fetch_images.openai.OpenAI")
def test_generate_image_writes_file(mock_openai_cls, tmp_path):
    mock_client = MagicMock()
    mock_openai_cls.return_value = mock_client
    mock_client.images.generate.return_value = MagicMock(
        data=[MagicMock(b64_json=FAKE_PNG)]
    )

    out_path = tmp_path / "beat-00-sunset.png"
    result = generate_image("a sunset over mountains", out_path, api_key="test")

    assert result == out_path
    assert out_path.exists()
    assert out_path.read_bytes() == base64.b64decode(FAKE_PNG)


@patch("scripts.fetch_images.openai.OpenAI")
def test_generate_image_uses_portrait_size(mock_openai_cls, tmp_path):
    mock_client = MagicMock()
    mock_openai_cls.return_value = mock_client
    mock_client.images.generate.return_value = MagicMock(
        data=[MagicMock(b64_json=FAKE_PNG)]
    )

    out_path = tmp_path / "out.png"
    generate_image("robot working", out_path, api_key="test")

    call_kwargs = mock_client.images.generate.call_args[1]
    assert call_kwargs["size"] in ("1024x1792", "1792x1024")
    assert "1792" in call_kwargs["size"]  # tall portrait dimension present


@patch("scripts.fetch_images.openai.OpenAI")
def test_generate_image_uses_gpt_image_model(mock_openai_cls, tmp_path):
    mock_client = MagicMock()
    mock_openai_cls.return_value = mock_client
    mock_client.images.generate.return_value = MagicMock(
        data=[MagicMock(b64_json=FAKE_PNG)]
    )

    out_path = tmp_path / "out.png"
    generate_image("abstract tech", out_path, api_key="test")

    call_kwargs = mock_client.images.generate.call_args[1]
    assert "gpt-image" in call_kwargs["model"]
```

- [ ] **Step 2: Run to verify tests fail**

```bash
python3 -m pytest tests/test_fetch_images.py -v
```

Expected: `ModuleNotFoundError: No module named 'scripts.fetch_images'`

- [ ] **Step 3: Implement fetch_images.py**

Create `scripts/fetch_images.py`:

```python
#!/usr/bin/env python3
import argparse
import base64
import os
from pathlib import Path
from typing import Optional

import openai


def generate_image(
    prompt: str, out_path: Path, api_key: Optional[str] = None
) -> Path:
    client = openai.OpenAI(api_key=api_key or os.environ["OPENAI_API_KEY"])
    response = client.images.generate(
        model="gpt-image-2",
        prompt=prompt,
        size="1024x1792",  # portrait closest to 1080x1920
        n=1,
        response_format="b64_json",
    )
    image_data = base64.b64decode(response.data[0].b64_json)
    out_path.write_bytes(image_data)
    return out_path


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("prompt")
    parser.add_argument("out_path")
    args = parser.parse_args()
    result = generate_image(args.prompt, Path(args.out_path))
    print(str(result))
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
python3 -m pytest tests/test_fetch_images.py -v
```

Expected: `3 passed`

- [ ] **Step 5: Commit**

```bash
git add scripts/fetch_images.py tests/test_fetch_images.py
git commit -m "feat: add OpenAI gpt-image-2 b-roll fallback generator"
```

---

## Task 7: fetch_sfx.py

**Files:**
- Create: `scripts/fetch_sfx.py`
- Create: `tests/test_fetch_sfx.py`

- [ ] **Step 1: Write the failing tests**

Create `tests/test_fetch_sfx.py`:

```python
import pytest
from pathlib import Path
from unittest.mock import MagicMock, patch

from scripts.fetch_sfx import fetch_pixabay_sfx

PIXABAY_RESPONSE = {
    "hits": [{"previewURL": "https://example.com/sfx.mp3"}]
}


@patch("scripts.fetch_sfx.requests.get")
def test_returns_mp3_path_when_key_set(mock_get, tmp_path):
    mock_resp = MagicMock()
    mock_resp.json.return_value = PIXABAY_RESPONSE
    mock_resp.raise_for_status.return_value = None
    mock_get.return_value = mock_resp

    with patch("scripts.fetch_sfx.urllib.request.urlretrieve") as mock_dl:
        mock_dl.side_effect = lambda url, path: Path(path).touch()
        result = fetch_pixabay_sfx("whoosh", tmp_path, "beat-00-whoosh", api_key="test")

    assert result is not None
    assert str(result).endswith(".mp3")


@patch("scripts.fetch_sfx.requests.get")
def test_returns_none_when_no_hits(mock_get, tmp_path):
    mock_resp = MagicMock()
    mock_resp.json.return_value = {"hits": []}
    mock_resp.raise_for_status.return_value = None
    mock_get.return_value = mock_resp

    result = fetch_pixabay_sfx("xyznotfound", tmp_path, "beat-00-xyz", api_key="test")
    assert result is None


def test_returns_none_when_no_api_key(tmp_path):
    result = fetch_pixabay_sfx("whoosh", tmp_path, "beat-00-whoosh", api_key=None)
    assert result is None
```

- [ ] **Step 2: Run to verify tests fail**

```bash
python3 -m pytest tests/test_fetch_sfx.py -v
```

Expected: `ModuleNotFoundError: No module named 'scripts.fetch_sfx'`

- [ ] **Step 3: Implement fetch_sfx.py**

Create `scripts/fetch_sfx.py`:

```python
#!/usr/bin/env python3
import argparse
import os
import sys
import urllib.request
from pathlib import Path
from typing import Optional

import requests

PIXABAY_API = "https://pixabay.com/api/"


def fetch_pixabay_sfx(
    keyword: str, out_dir: Path, slug: str, api_key: Optional[str] = None
) -> Optional[Path]:
    key = api_key or os.environ.get("PIXABAY_API_KEY")
    if not key:
        return None  # optional — skip gracefully

    resp = requests.get(
        PIXABAY_API,
        params={"key": key, "q": keyword, "media_type": "music", "per_page": 3},
        timeout=15,
    )
    resp.raise_for_status()
    hits = resp.json().get("hits", [])
    if not hits:
        return None

    audio_url = hits[0].get("previewURL") or hits[0].get("audio", {}).get("url")
    if not audio_url:
        return None

    out_path = out_dir / f"{slug}.mp3"
    urllib.request.urlretrieve(audio_url, out_path)
    return out_path


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("keyword")
    parser.add_argument("out_dir")
    parser.add_argument("slug")
    args = parser.parse_args()

    result = fetch_pixabay_sfx(args.keyword, Path(args.out_dir), args.slug)
    if result:
        print(str(result))
    else:
        print("SKIPPED", file=sys.stderr)
        sys.exit(0)  # optional — not a failure
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
python3 -m pytest tests/test_fetch_sfx.py -v
```

Expected: `3 passed`

- [ ] **Step 5: Commit**

```bash
git add scripts/fetch_sfx.py tests/test_fetch_sfx.py
git commit -m "feat: add optional Pixabay SFX fetcher"
```

---

## Task 8: build_manifest.py

**Files:**
- Create: `scripts/build_manifest.py`
- Create: `tests/test_build_manifest.py`

- [ ] **Step 1: Write the failing tests**

Create `tests/test_build_manifest.py`:

```python
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
```

- [ ] **Step 2: Run to verify tests fail**

```bash
python3 -m pytest tests/test_build_manifest.py -v
```

Expected: `ModuleNotFoundError: No module named 'scripts.build_manifest'`

- [ ] **Step 3: Implement build_manifest.py**

Create `scripts/build_manifest.py`:

```python
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
python3 -m pytest tests/test_build_manifest.py -v
```

Expected: `8 passed`

- [ ] **Step 5: Run full test suite**

```bash
python3 -m pytest tests/ -v
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add scripts/build_manifest.py tests/test_build_manifest.py
git commit -m "feat: add asset manifest builder"
```

---

## Task 9: make-reel.md Command File

**Files:**
- Create: `.claude/commands/make-reel.md`

This is a Claude Code command prompt, not executable code. No unit tests — correctness is verified by checking all 5 stages of the spec are covered.

- [ ] **Step 1: Create the command file**

Create `.claude/commands/make-reel.md`:

````markdown
---
description: Generate a portrait short-form video from a URL or topic (research → script → HeyGen → b-roll → edit).
argument-hint: "<url-or-topic> [--duration 30|45|60] [--style punchy|deep-dive]"
allowed-tools: Bash, Read, Write, WebFetch, WebSearch
---

# /make-reel Pipeline

Orchestrate the 5-stage content creation pipeline below. Work sequentially. Stop and report clearly if any stage fails. Never skip a stage.

## 0. Parse Arguments & Load Environment

Parse `$ARGUMENTS`:
- `url-or-topic` — everything before any `--` flags (required)
- `--duration N` — default `45` (seconds)
- `--style punchy|deep-dive` — default `punchy`

Load environment from `.env` in the project root:
```bash
set -a && source "$(pwd)/.env" && set +a
```

Validate env vars (fail fast if required keys are missing):
```bash
python3 scripts/check_env.py
```

If exit code is non-zero: stop and tell the user exactly which keys are missing.

## 1. Create Session Folder

```bash
SESSION_DIR=$(python3 scripts/create_session.py "$TOPIC" --base-dir "$(pwd)")
echo "Session folder: $SESSION_DIR"
```

Check for `AVATAR-USER.md` at the project root. If missing, stop:
> "Your HeyGen avatar isn't configured. Run /heygen-avatar first to create your avatar file, then re-run /make-reel."

Symlink avatar into session:
```bash
ln -sf "$(pwd)/AVATAR-USER.md" "$SESSION_DIR/AVATAR-USER.md"
```

## 2. Stage 1 — Research

**If input starts with `http`:**
- Use `WebFetch` to scrape the URL
- Summarize key claims, hooks, stats, visual ideas into `$SESSION_DIR/research.md` (~300 words)

**If input is a topic string:**
- Use `WebSearch` to find top 3–5 results
- Use `WebFetch` on the 2 most relevant URLs
- Summarize into `$SESSION_DIR/research.md` (~300 words)

Write `research.md`. Log: `✓ Stage 1 complete`

## 3. Stage 2 — Script

Invoke the `viral-reel-generator` skill. Pass:
- Contents of `$SESSION_DIR/research.md` as research context
- Style: `--style punchy` → Style A (Punchy Explainer); `--style deep-dive` → Style B (Deep Dive)
- Target duration: `--duration` value in seconds

Save the full output (timecodes + visual cues + CTA) to `$SESSION_DIR/script.md`.

Validate: `script.md` must contain at least one `(M:SS)` timecode and at least one `[Visual: ...]` line. If missing, regenerate once. If still invalid after one retry, stop and report.

Log: `✓ Stage 2 complete`

## 4. Stage 3 — HeyGen Video

Invoke the `heygen-video` skill. Pass:
- Avatar: read `avatar_id` and `voice_id` from `$SESSION_DIR/AVATAR-USER.md`
- Script: full contents of `$SESSION_DIR/script.md` (scene-labeled, script-as-prompt)
- Format: portrait `1080×1920`
- Duration target: `--duration` seconds

Save output to `$SESSION_DIR/heygen_video.mp4`.

Log: `✓ Stage 3 complete`

## 5. Stage 4 — Asset Fetch

Parse beats from the script:
```bash
python3 scripts/parse_script.py "$SESSION_DIR/script.md" > "$SESSION_DIR/beats.json"
```

For each beat in `beats.json`, fetch b-roll and SFX. Read `beat_slug`, `visual_cue`, and `timecode_s` from each entry.

**B-roll per beat (Pexels video → Pexels photo → OpenAI image):**
```bash
# Pexels (handles video + photo fallback internally)
python3 scripts/fetch_broll.py "$VISUAL_CUE" "$SESSION_DIR/broll" "$BEAT_SLUG" \
  || python3 scripts/fetch_images.py "$VISUAL_CUE portrait photo" "$SESSION_DIR/broll/$BEAT_SLUG.png"
```

**SFX per beat (optional — skip silently if no key):**
```bash
python3 scripts/fetch_sfx.py "$VISUAL_CUE" "$SESSION_DIR/sfx" "$BEAT_SLUG"
```

Individual asset failures are non-fatal. Log any skipped beats and continue.

Build the asset manifest:
```bash
python3 scripts/build_manifest.py \
  "$SESSION_DIR/beats.json" \
  "$SESSION_DIR/broll" \
  "$SESSION_DIR/sfx" \
  "$SESSION_DIR/asset_manifest.json"
```

Log: `✓ Stage 4 complete`

## 6. Stage 5 — Edit

Invoke the `video-use` skill with this exact brief:

- **Source:** `$SESSION_DIR/heygen_video.mp4` — portrait talking head (1080×1920)
- **Asset manifest:** `$SESSION_DIR/asset_manifest.json` — each entry has `timecode_s`, `broll_path`, `sfx_path`
- **Edit strategy:** Talking head is the base layer. At each `timecode_s`, cut to or overlay the b-roll asset for ~3–5s (or until the next beat), then return to talking head. Skip beats where `broll_path` is null.
- **SFX:** Place `sfx_path` audio at `timecode_s` where not null. Mix under the talking head audio at -12dB.
- **Motion graphics:** Use Remotion for typography-heavy text overlays from `text_overlay` fields; use PIL for simple accent overlays.
- **Subtitles:** Transcribe `heygen_video.mp4` at word level (Scribe) → generate `master.srt` → burn LAST using bold-overlay style: 2-word UPPERCASE chunks, Helvetica Bold size 18, white text with black outline, `MarginV=35`.
- **Output:** `1080×1920@30fps` → `$SESSION_DIR/edit/final.mp4`

After edit completes:
```bash
ln -sf "$SESSION_DIR/edit/final.mp4" "$SESSION_DIR/final.mp4"
```

## 7. Done

Report to user:
```
✓ /make-reel complete
Session: $SESSION_DIR
Final video: $SESSION_DIR/final.mp4
```
````

- [ ] **Step 2: Verify all 5 stages are covered**

Read `.claude/commands/make-reel.md` and confirm each section exists:
- [ ] Stage 1 Research — `WebFetch`/`WebSearch` → `research.md`
- [ ] Stage 2 Script — `viral-reel-generator` → `script.md`
- [ ] Stage 3 HeyGen — `heygen-video` → `heygen_video.mp4`
- [ ] Stage 4 Assets — `fetch_broll.py`, `fetch_images.py`, `fetch_sfx.py`, `build_manifest.py`
- [ ] Stage 5 Edit — `video-use` with b-roll manifest, SFX, subtitles → `final.mp4`

- [ ] **Step 3: Commit**

```bash
git add .claude/commands/make-reel.md
git commit -m "feat: add /make-reel slash command"
```

---

## Task 10: Full Test Suite Run

- [ ] **Step 1: Run all tests**

```bash
python3 -m pytest tests/ -v --tb=short
```

Expected: all tests pass. If any fail, fix before proceeding.

- [ ] **Step 2: Smoke-test env validation script**

```bash
python3 scripts/check_env.py
```

Expected (if `.env` not filled in yet): `[ERROR] Missing required env vars: ...` and exit 1.

- [ ] **Step 3: Smoke-test session creation**

```bash
python3 scripts/create_session.py "test topic"
```

Expected: prints a path like `output/reels/2026-05-01-test-topic/` and the directories exist.

- [ ] **Step 4: Smoke-test script parser with a fixture**

```bash
printf '(0:00) [Visual: Robot working]\n(0:05) [Text: "AI is here"]\n' | \
  python3 -c "
import sys
from scripts.parse_script import parse_script_str
import json
print(json.dumps(parse_script_str(sys.stdin.read()), indent=2))
"
```

Expected: JSON array with 2 beats, timecodes 0 and 5.

- [ ] **Step 5: Final commit**

```bash
git add .
git commit -m "feat: complete make-reel pipeline — all scripts + command + tests"
```
