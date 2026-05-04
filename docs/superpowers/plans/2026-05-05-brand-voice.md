# Brand Voice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the `/brand-voice` command, vault structure, supporting scripts, and downstream integration so `/make-reel` and `/make-carousel` produce on-brand output.

**Architecture:** A Python CLI (`scripts/brand_voice.py`) owns all vault module I/O (read/write/compile/status). Three new scripts handle platform import parsing, watermark application, and vault brand loading. The `/brand-voice` command is a Claude instruction file that drives a conversational interview and calls the CLI to persist results.

**Tech Stack:** Python 3.10+, PyYAML (new dep), Pillow (existing), pytest; Claude command markdown files for interactive flows.

---

## File Structure

**New files:**
- `scripts/brand_voice.py` — vault module read/write/compile/status CLI
- `scripts/import_platform.py` — parse Instagram JSON, LinkedIn CSV, Twitter JS exports
- `scripts/watermark.py` — apply watermark spec to images
- `.claude/commands/brand-voice.md` — interactive interview command
- `tests/test_brand_voice.py`
- `tests/test_import_platform.py`
- `tests/test_watermark.py`

**Modified files:**
- `requirements.txt` — add `pyyaml>=6.0`
- `.gitignore` — add `vault/`
- `scripts/create_session.py` — add `--output-dir` flag (default `output/reels`)
- `scripts/generate_carousel.py` — add `_load_brand_from_md()` + detect `.md` in `load_brand()`
- `.claude/commands/make-reel.md` — load brand modules before script stage, use vault output, log pipeline
- `.claude/commands/make-carousel.md` — load vault brand.md instead of CAROUSEL-BRAND.json, use vault output, log pipeline
- `tests/test_create_session.py` — add tests for `--output-dir`
- `tests/test_generate_carousel.py` — add tests for `.md` brand loading

**Deleted files:**
- `.claude/commands/carousel-brand.md`
- `scripts/carousel_brand.py`
- `tests/test_carousel_brand.py`

---

## Task 1: Add PyYAML + vault to .gitignore

**Files:**
- Modify: `requirements.txt`
- Modify: `.gitignore`

- [ ] **Step 1: Add pyyaml to requirements.txt**

Current content of `requirements.txt`:
```
requests>=2.33.0
openai>=1.0.0
Pillow>=10.0.0
colorthief>=0.2.1
pytest>=8.0.0
pytest-mock>=3.14.0
```

Add one line so it becomes:
```
requests>=2.33.0
openai>=1.0.0
Pillow>=10.0.0
colorthief>=0.2.1
pyyaml>=6.0
pytest>=8.0.0
pytest-mock>=3.14.0
```

- [ ] **Step 2: Install pyyaml**

```bash
pip install pyyaml>=6.0
```

Expected: `Successfully installed PyYAML-X.X.X` (or "already satisfied")

- [ ] **Step 3: Verify yaml is importable**

```bash
python3 -c "import yaml; print('ok')"
```

Expected: `ok`

- [ ] **Step 4: Add vault/ to .gitignore**

Append to `.gitignore`:
```
vault/
```

Current `.gitignore` ends with:
```
.pytest_cache/
```

New `.gitignore` ends with:
```
.pytest_cache/
vault/
```

- [ ] **Step 5: Commit**

```bash
git add requirements.txt .gitignore
git commit -m "chore: add pyyaml dep and gitignore vault/"
```

---

## Task 2: `scripts/brand_voice.py` — core module I/O

**Files:**
- Create: `scripts/brand_voice.py`
- Create: `tests/test_brand_voice.py`

- [ ] **Step 1: Write failing tests for parse_module_file and read/write_module**

Create `tests/test_brand_voice.py`:

```python
"""
Tests for scripts/brand_voice.py
"""
import textwrap
from datetime import date, timedelta
from pathlib import Path

import pytest
import yaml

from scripts.brand_voice import (
    MODULES,
    compile_master,
    module_path,
    module_status,
    parse_module_file,
    read_module,
    write_module,
)


# ---------------------------------------------------------------------------
# parse_module_file
# ---------------------------------------------------------------------------

def test_parse_module_file_returns_frontmatter_and_body():
    content = textwrap.dedent("""\
        ---
        module: cta
        last_updated: 2026-05-05
        ---

        ## CTA Philosophy

        Low-friction engagement first.
    """)
    fm, body = parse_module_file(content)
    assert fm["module"] == "cta"
    assert fm["last_updated"] == date(2026, 5, 5)
    assert "CTA Philosophy" in body


def test_parse_module_file_no_frontmatter_returns_empty_dict():
    content = "Just a plain body with no frontmatter."
    fm, body = parse_module_file(content)
    assert fm == {}
    assert body == content


def test_parse_module_file_nested_frontmatter():
    content = textwrap.dedent("""\
        ---
        module: watermark
        elements:
          - type: handle
            value: "@shivendra"
        position: 6
        opacity: 0.85
        ---

        Watermark notes here.
    """)
    fm, body = parse_module_file(content)
    assert fm["position"] == 6
    assert fm["elements"][0]["type"] == "handle"
    assert "Watermark notes" in body


# ---------------------------------------------------------------------------
# write_module + read_module
# ---------------------------------------------------------------------------

def test_write_module_creates_file(tmp_path):
    content = "---\nmodule: niche\nlast_updated: 2026-05-05\n---\n\nBody here."
    path = write_module(tmp_path, "niche", content)
    assert path.exists()
    assert path.read_text(encoding="utf-8") == content


def test_write_module_creates_parent_dirs(tmp_path):
    # vault dir does not exist yet
    vault = tmp_path / "vault"
    write_module(vault, "goals", "---\nmodule: goals\n---\n\nBody.")
    assert (vault / "brand" / "modules" / "goals.md").exists()


def test_read_module_returns_frontmatter_and_body(tmp_path):
    content = "---\nmodule: style\nlast_updated: 2026-05-05\n---\n\nStyle body."
    write_module(tmp_path, "style", content)
    fm, body = read_module(tmp_path, "style")
    assert fm["module"] == "style"
    assert "Style body" in body


def test_read_module_raises_file_not_found(tmp_path):
    with pytest.raises(FileNotFoundError):
        read_module(tmp_path, "niche")


# ---------------------------------------------------------------------------
# module_status
# ---------------------------------------------------------------------------

def test_module_status_not_started_when_file_missing(tmp_path):
    status, last = module_status(tmp_path, "niche")
    assert status == "not_started"
    assert last is None


def test_module_status_complete_when_recently_updated(tmp_path):
    today = date.today().isoformat()
    content = f"---\nmodule: niche\nlast_updated: {today}\n---\n\nBody."
    write_module(tmp_path, "niche", content)
    status, last = module_status(tmp_path, "niche")
    assert status == "complete"
    assert last == date.today()


def test_module_status_stale_when_over_30_days(tmp_path):
    old_date = (date.today() - timedelta(days=31)).isoformat()
    content = f"---\nmodule: goals\nlast_updated: {old_date}\n---\n\nBody."
    write_module(tmp_path, "goals", content)
    status, _ = module_status(tmp_path, "goals")
    assert status == "stale"


def test_module_status_complete_when_no_date_field(tmp_path):
    write_module(tmp_path, "brand", "---\nmodule: brand\n---\n\nBody.")
    status, last = module_status(tmp_path, "brand")
    assert status == "complete"
    assert last is None


# ---------------------------------------------------------------------------
# compile_master
# ---------------------------------------------------------------------------

def test_compile_master_creates_brand_voice_md(tmp_path):
    today = date.today().isoformat()
    write_module(tmp_path, "niche", f"---\nmodule: niche\ncreator_name: TestCreator\nlast_updated: {today}\n---\n\nNiche body.")
    write_module(tmp_path, "style", f"---\nmodule: style\nlast_updated: {today}\n---\n\nStyle body.")
    for mod in ["competitors", "goals", "cta", "watermark", "brand"]:
        write_module(tmp_path, mod, f"---\nmodule: {mod}\nlast_updated: {today}\n---\n\n{mod} body.")

    master = compile_master(tmp_path)
    assert master.exists()
    text = master.read_text(encoding="utf-8")
    assert "# Brand Voice — TestCreator" in text
    assert "## Niche" in text
    assert "## Brand Identity" in text
    assert "Niche body." in text


def test_compile_master_shows_not_configured_for_missing_module(tmp_path):
    master = compile_master(tmp_path)
    text = master.read_text(encoding="utf-8")
    assert "_Not configured_" in text


def test_compile_master_includes_last_updated_date(tmp_path):
    master = compile_master(tmp_path)
    text = master.read_text(encoding="utf-8")
    assert f"Last updated: {date.today().isoformat()}" in text
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/shivendrasoni/personal/content_creation && python3 -m pytest tests/test_brand_voice.py -v 2>&1 | head -30
```

Expected: `ModuleNotFoundError: No module named 'scripts.brand_voice'`

- [ ] **Step 3: Create `scripts/brand_voice.py`**

```python
#!/usr/bin/env python3
"""
brand_voice.py — CLI for vault brand module read/write/compile/status.

Subcommands:
  read     --module <name> --vault <path>
  write    --module <name> --vault <path>   (reads full file from stdin)
  compile  --vault <path>
  status   --vault <path>
"""
import argparse
import sys
from datetime import date, datetime
from pathlib import Path
from typing import Optional

import yaml

MODULES = ["niche", "style", "competitors", "goals", "cta", "watermark", "brand"]
STALE_DAYS = 30
BRAND_DIR = "brand"
MODULES_SUBDIR = "modules"
MASTER_FILENAME = "brand-voice.md"

SECTION_NAMES = {
    "niche": "Niche",
    "style": "Style",
    "competitors": "Competitors & Inspiration",
    "goals": "Goals",
    "cta": "CTA",
    "watermark": "Watermark",
    "brand": "Brand Identity",
}


def module_path(vault_dir: Path, module: str) -> Path:
    return vault_dir / BRAND_DIR / MODULES_SUBDIR / f"{module}.md"


def parse_module_file(content: str) -> tuple[dict, str]:
    """Split '---\\nfrontmatter\\n---\\nbody' → (frontmatter_dict, body_str).

    Returns ({}, content) if no frontmatter delimiters found.
    """
    if not content.startswith("---"):
        return {}, content
    parts = content.split("---", 2)
    if len(parts) < 3:
        return {}, content
    frontmatter = yaml.safe_load(parts[1]) or {}
    body = parts[2].strip()
    return frontmatter, body


def read_module(vault_dir: Path, module: str) -> tuple[dict, str]:
    """Read and parse vault/brand/modules/<module>.md → (frontmatter, body).

    Raises FileNotFoundError if the file does not exist.
    """
    path = module_path(vault_dir, module)
    content = path.read_text(encoding="utf-8")
    return parse_module_file(content)


def write_module(vault_dir: Path, module: str, content: str) -> Path:
    """Write full file content to vault/brand/modules/<module>.md.

    Creates parent directories. Returns the path written.
    """
    path = module_path(vault_dir, module)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
    return path


def module_status(vault_dir: Path, module: str) -> tuple[str, Optional[date]]:
    """Return (status, last_updated_date) for a module.

    status is one of: 'complete', 'not_started', 'stale'
    last_updated_date is None when status is 'not_started' or no date was recorded.
    """
    path = module_path(vault_dir, module)
    if not path.exists():
        return "not_started", None
    try:
        frontmatter, _ = read_module(vault_dir, module)
    except Exception:
        return "not_started", None
    raw = frontmatter.get("last_updated")
    if not raw:
        return "complete", None
    if isinstance(raw, datetime):
        last_updated = raw.date()
    elif isinstance(raw, date):
        last_updated = raw
    else:
        try:
            last_updated = datetime.strptime(str(raw), "%Y-%m-%d").date()
        except ValueError:
            return "complete", None
    delta = (date.today() - last_updated).days
    if delta > STALE_DAYS:
        return "stale", last_updated
    return "complete", last_updated


def compile_master(vault_dir: Path) -> Path:
    """Regenerate vault/brand/brand-voice.md from all 7 module files.

    Pulls frontmatter YAML + body from each module into one Obsidian document.
    Returns the path written.
    """
    creator_name = "Creator"
    niche_p = module_path(vault_dir, "niche")
    if niche_p.exists():
        try:
            fm, _ = read_module(vault_dir, "niche")
            creator_name = fm.get("creator_name", "Creator")
        except Exception:
            pass

    lines = [
        f"# Brand Voice — {creator_name}",
        f"Last updated: {date.today().isoformat()}",
        "",
    ]

    for mod in MODULES:
        lines.append(f"## {SECTION_NAMES[mod]}")
        p = module_path(vault_dir, mod)
        if not p.exists():
            lines += ["_Not configured_", ""]
            continue
        try:
            fm, body = read_module(vault_dir, mod)
            if fm:
                lines += ["```yaml", yaml.dump(fm, default_flow_style=False).rstrip(), "```"]
            if body:
                lines += ["", body]
        except Exception as exc:
            lines.append(f"_Error reading module: {exc}_")
        lines.append("")

    master_path = vault_dir / BRAND_DIR / MASTER_FILENAME
    master_path.parent.mkdir(parents=True, exist_ok=True)
    master_path.write_text("\n".join(lines), encoding="utf-8")
    return master_path


def print_status(vault_dir: Path) -> None:
    """Print module status table to stdout."""
    for mod in MODULES:
        status, last_updated = module_status(vault_dir, mod)
        if status == "not_started":
            icon = "✗"
            detail = "not started"
        elif status == "stale":
            icon = "~"
            detail = f"last updated {last_updated}  (stale — >{STALE_DAYS} days)"
        else:
            icon = "✓"
            detail = f"last updated {last_updated}" if last_updated else "no date"
        print(f"{mod:<12} {icon}  {detail}")


def _main(argv: Optional[list[str]] = None) -> None:
    parser = argparse.ArgumentParser(description="Vault brand module CLI")
    parser.add_argument("--vault", default="vault", help="Path to vault root directory")
    sub = parser.add_subparsers(dest="command", required=True)

    read_p = sub.add_parser("read", help="Print module frontmatter + body")
    read_p.add_argument("--module", required=True, choices=MODULES)

    write_p = sub.add_parser("write", help="Write module file from stdin")
    write_p.add_argument("--module", required=True, choices=MODULES)

    sub.add_parser("compile", help="Regenerate brand-voice.md")
    sub.add_parser("status", help="Show all module statuses")

    args = parser.parse_args(argv)
    vault_dir = Path(args.vault)

    if args.command == "read":
        try:
            fm, body = read_module(vault_dir, args.module)
        except FileNotFoundError:
            print(f"Error: module '{args.module}' not found", file=sys.stderr)
            sys.exit(1)
        print(yaml.dump(fm, default_flow_style=False))
        print(body)

    elif args.command == "write":
        content = sys.stdin.read()
        path = write_module(vault_dir, args.module, content)
        print(str(path))

    elif args.command == "compile":
        path = compile_master(vault_dir)
        print(str(path))

    elif args.command == "status":
        print_status(vault_dir)


if __name__ == "__main__":
    try:
        _main()
    except Exception as exc:
        print(f"Error: {exc}", file=sys.stderr)
        sys.exit(1)
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/shivendrasoni/personal/content_creation && python3 -m pytest tests/test_brand_voice.py -v
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/brand_voice.py tests/test_brand_voice.py
git commit -m "feat: add brand_voice.py — vault module read/write/compile/status"
```

---

## Task 3: `scripts/import_platform.py` — platform export parsers

**Files:**
- Create: `scripts/import_platform.py`
- Create: `tests/test_import_platform.py`

- [ ] **Step 1: Write failing tests**

Create `tests/test_import_platform.py`:

```python
"""
Tests for scripts/import_platform.py
"""
import csv
import json
from pathlib import Path

import pytest

from scripts.import_platform import (
    _strip_hashtags,
    parse_instagram,
    parse_linkedin,
    parse_twitter,
    scan_imports_dir,
)


# ---------------------------------------------------------------------------
# _strip_hashtags
# ---------------------------------------------------------------------------

def test_strip_hashtags_removes_hashtag_tokens():
    result = _strip_hashtags("Great tips for AI #ai #tech #coding")
    assert "#" not in result
    assert "Great tips for AI" in result


def test_strip_hashtags_preserves_body_text():
    result = _strip_hashtags("Hello world")
    assert result == "Hello world"


def test_strip_hashtags_returns_empty_for_hashtags_only():
    result = _strip_hashtags("#ai #tech #coding")
    assert result == ""


# ---------------------------------------------------------------------------
# parse_instagram
# ---------------------------------------------------------------------------

def test_parse_instagram_extracts_caption_bodies(tmp_path):
    data = {
        "data": [
            {"media": [{"title": "This is my first post #ai #tech"}]},
            {"media": [{"title": "Second post with no hashtags"}]},
        ]
    }
    f = tmp_path / "posts_1.json"
    f.write_text(json.dumps(data), encoding="utf-8")
    result = parse_instagram(f)
    assert len(result) == 2
    assert "#ai" not in result[0]
    assert "This is my first post" in result[0]
    assert result[1] == "Second post with no hashtags"


def test_parse_instagram_skips_hashtag_only_captions(tmp_path):
    data = {"data": [{"media": [{"title": "#ai #tech #coding"}]}]}
    f = tmp_path / "posts_1.json"
    f.write_text(json.dumps(data), encoding="utf-8")
    result = parse_instagram(f)
    assert result == []


def test_parse_instagram_skips_empty_titles(tmp_path):
    data = {"data": [{"media": [{"title": ""}]}]}
    f = tmp_path / "posts_1.json"
    f.write_text(json.dumps(data), encoding="utf-8")
    result = parse_instagram(f)
    assert result == []


# ---------------------------------------------------------------------------
# parse_linkedin
# ---------------------------------------------------------------------------

def test_parse_linkedin_extracts_share_commentary(tmp_path):
    f = tmp_path / "shares.csv"
    with f.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=["ShareCommentary", "Other"])
        writer.writeheader()
        writer.writerow({"ShareCommentary": "Big insight about AI", "Other": "x"})
        writer.writerow({"ShareCommentary": "", "Other": "y"})
        writer.writerow({"ShareCommentary": "Another insight", "Other": "z"})
    result = parse_linkedin(f)
    assert result == ["Big insight about AI", "Another insight"]


def test_parse_linkedin_skips_empty_commentary(tmp_path):
    f = tmp_path / "shares.csv"
    with f.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=["ShareCommentary"])
        writer.writeheader()
        writer.writerow({"ShareCommentary": "   "})
    result = parse_linkedin(f)
    assert result == []


# ---------------------------------------------------------------------------
# parse_twitter
# ---------------------------------------------------------------------------

def _write_tweets_js(path: Path, tweets: list[dict]) -> None:
    entries = [{"tweet": t} for t in tweets]
    path.write_text(
        f"window.YTD.tweets.part0 = {json.dumps(entries)}",
        encoding="utf-8",
    )


def test_parse_twitter_extracts_full_text(tmp_path):
    f = tmp_path / "tweets.js"
    _write_tweets_js(f, [
        {"full_text": "This is my original tweet"},
        {"full_text": "Another original thought"},
    ])
    result = parse_twitter(f)
    assert result == ["This is my original tweet", "Another original thought"]


def test_parse_twitter_filters_retweets(tmp_path):
    f = tmp_path / "tweets.js"
    _write_tweets_js(f, [
        {"full_text": "RT @someuser: This is a retweet"},
        {"full_text": "My own tweet"},
    ])
    result = parse_twitter(f)
    assert result == ["My own tweet"]


def test_parse_twitter_handles_missing_full_text(tmp_path):
    f = tmp_path / "tweets.js"
    entries = [{"tweet": {}}, {"tweet": {"full_text": "Valid tweet"}}]
    f.write_text(
        f"window.YTD.tweets.part0 = {json.dumps(entries)}",
        encoding="utf-8",
    )
    result = parse_twitter(f)
    assert result == ["Valid tweet"]


# ---------------------------------------------------------------------------
# scan_imports_dir
# ---------------------------------------------------------------------------

def test_scan_imports_dir_detects_known_files(tmp_path):
    imports = tmp_path / "imports"
    imports.mkdir()
    (imports / "posts_1.json").write_text("{}", encoding="utf-8")
    (imports / "shares.csv").write_text("", encoding="utf-8")
    (imports / "tweets.js").write_text("", encoding="utf-8")
    found = scan_imports_dir(imports)
    assert "instagram" in found
    assert "linkedin" in found
    assert "twitter" in found


def test_scan_imports_dir_returns_empty_for_missing_dir(tmp_path):
    found = scan_imports_dir(tmp_path / "nonexistent")
    assert found == {}


def test_scan_imports_dir_returns_empty_for_empty_folder(tmp_path):
    imports = tmp_path / "imports"
    imports.mkdir()
    found = scan_imports_dir(imports)
    assert found == {}
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/shivendrasoni/personal/content_creation && python3 -m pytest tests/test_import_platform.py -v 2>&1 | head -15
```

Expected: `ModuleNotFoundError: No module named 'scripts.import_platform'`

- [ ] **Step 3: Create `scripts/import_platform.py`**

```python
#!/usr/bin/env python3
"""
import_platform.py — Parse platform export files into text lists.

Supported:
  instagram  posts_1.json    JSON: data[].media[].title
  linkedin   shares.csv      CSV: ShareCommentary column
  twitter    tweets.js       JS: window.YTD.tweets.part0[].tweet.full_text
"""
import argparse
import csv
import json
import re
import sys
from pathlib import Path
from typing import Optional


def _strip_hashtags(text: str) -> str:
    """Remove #hashtag tokens from text, collapse whitespace, and strip."""
    cleaned = re.sub(r"#\w+", "", text)
    return re.sub(r"\s+", " ", cleaned).strip()


def parse_instagram(path: Path) -> list[str]:
    """Parse Instagram posts_1.json. Returns caption bodies with hashtags stripped."""
    data = json.loads(path.read_text(encoding="utf-8"))
    texts = []
    for post in data.get("data", []):
        for media in post.get("media", []):
            title = media.get("title", "").strip()
            if title:
                body = _strip_hashtags(title)
                if body:
                    texts.append(body)
    return texts


def parse_linkedin(path: Path) -> list[str]:
    """Parse LinkedIn shares.csv. Returns non-empty ShareCommentary values."""
    texts = []
    with path.open(newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            text = row.get("ShareCommentary", "").strip()
            if text:
                texts.append(text)
    return texts


def parse_twitter(path: Path) -> list[str]:
    """Parse Twitter tweets.js. Returns full_text values, excluding retweets."""
    raw = path.read_text(encoding="utf-8").strip()
    raw = re.sub(r"^window\.YTD\.tweets\.part0\s*=\s*", "", raw)
    entries = json.loads(raw)
    texts = []
    for entry in entries:
        text = entry.get("tweet", {}).get("full_text", "").strip()
        if text and not text.startswith("RT @"):
            texts.append(text)
    return texts


def scan_imports_dir(imports_dir: Path) -> dict[str, Path]:
    """Scan a directory for known platform export files.

    Returns dict with keys 'instagram', 'linkedin', 'twitter' for found files.
    """
    found: dict[str, Path] = {}
    if not imports_dir.exists():
        return found
    for f in imports_dir.iterdir():
        if f.name == "posts_1.json":
            found["instagram"] = f
        elif f.name == "shares.csv":
            found["linkedin"] = f
        elif f.name == "tweets.js":
            found["twitter"] = f
    return found


def _main(argv: Optional[list[str]] = None) -> None:
    parser = argparse.ArgumentParser(description="Parse platform export files")
    parser.add_argument("platform", choices=["instagram", "linkedin", "twitter"])
    parser.add_argument("file", help="Path to export file")
    args = parser.parse_args(argv)
    path = Path(args.file)

    if args.platform == "instagram":
        texts = parse_instagram(path)
    elif args.platform == "linkedin":
        texts = parse_linkedin(path)
    else:
        texts = parse_twitter(path)

    for text in texts:
        print(text)
        print("---")


if __name__ == "__main__":
    try:
        _main()
    except Exception as exc:
        print(f"Error: {exc}", file=sys.stderr)
        sys.exit(1)
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/shivendrasoni/personal/content_creation && python3 -m pytest tests/test_import_platform.py -v
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/import_platform.py tests/test_import_platform.py
git commit -m "feat: add import_platform.py — Instagram/LinkedIn/Twitter export parsers"
```

---

## Task 4: `scripts/watermark.py` — image watermark applicator

**Files:**
- Create: `scripts/watermark.py`
- Create: `tests/test_watermark.py`

- [ ] **Step 1: Write failing tests**

Create `tests/test_watermark.py`:

```python
"""
Tests for scripts/watermark.py
"""
from io import BytesIO
from pathlib import Path

import pytest
from PIL import Image

from scripts.watermark import (
    POSITION_MAP,
    _xy,
    apply_watermark,
    load_watermark_spec,
)


def _make_png(tmp_path: Path, width: int = 200, height: int = 200, name: str = "img.png") -> Path:
    p = tmp_path / name
    Image.new("RGB", (width, height), "blue").save(p)
    return p


# ---------------------------------------------------------------------------
# POSITION_MAP
# ---------------------------------------------------------------------------

def test_position_map_covers_all_8_positions():
    assert set(POSITION_MAP.keys()) == {1, 2, 3, 4, 5, 6, 7, 8}


def test_position_map_bottom_left_is_6():
    assert POSITION_MAP[6] == ("left", "bottom")


def test_position_map_top_right_is_3():
    assert POSITION_MAP[3] == ("right", "top")


def test_position_map_top_center_is_2():
    assert POSITION_MAP[2] == ("center", "top")


# ---------------------------------------------------------------------------
# _xy — coordinate calculation
# ---------------------------------------------------------------------------

def test_xy_left_top_returns_margin():
    from scripts.watermark import MARGIN
    x, y = _xy((500, 500), 50, 20, "left", "top")
    assert x == MARGIN
    assert y == MARGIN


def test_xy_right_bottom_returns_canvas_minus_element_minus_margin():
    from scripts.watermark import MARGIN
    x, y = _xy((500, 400), 60, 30, "right", "bottom")
    assert x == 500 - 60 - MARGIN
    assert y == 400 - 30 - MARGIN


def test_xy_center_center_centers_element():
    x, y = _xy((500, 400), 100, 40, "center", "center")
    assert x == (500 - 100) // 2
    assert y == (400 - 40) // 2


# ---------------------------------------------------------------------------
# load_watermark_spec
# ---------------------------------------------------------------------------

def test_load_watermark_spec_returns_frontmatter(tmp_path):
    spec_file = tmp_path / "watermark.md"
    spec_file.write_text(
        "---\nmodule: watermark\nposition: 6\nopacity: 0.85\nelements:\n  - type: handle\n    value: \"@shivendra\"\n---\n\nBody.",
        encoding="utf-8",
    )
    spec = load_watermark_spec(spec_file)
    assert spec["position"] == 6
    assert abs(spec["opacity"] - 0.85) < 0.001
    assert spec["elements"][0]["value"] == "@shivendra"


def test_load_watermark_spec_raises_when_no_frontmatter(tmp_path):
    spec_file = tmp_path / "watermark.md"
    spec_file.write_text("No frontmatter here.", encoding="utf-8")
    with pytest.raises(ValueError, match="No YAML frontmatter"):
        load_watermark_spec(spec_file)


# ---------------------------------------------------------------------------
# apply_watermark — handle text element
# ---------------------------------------------------------------------------

def test_apply_watermark_produces_output_file(tmp_path):
    img_path = _make_png(tmp_path)
    spec = {
        "position": 6,
        "opacity": 0.85,
        "elements": [{"type": "handle", "value": "@test"}],
    }
    out = tmp_path / "out.jpg"
    result = apply_watermark(img_path, spec, out)
    assert result == out
    assert out.exists()
    # Output must be a valid image
    loaded = Image.open(out)
    assert loaded.size == (200, 200)


def test_apply_watermark_creates_parent_dirs(tmp_path):
    img_path = _make_png(tmp_path)
    spec = {"position": 6, "opacity": 0.85, "elements": []}
    nested_out = tmp_path / "a" / "b" / "out.jpg"
    apply_watermark(img_path, spec, nested_out)
    assert nested_out.exists()


def test_apply_watermark_logo_element_skipped_when_path_missing(tmp_path):
    img_path = _make_png(tmp_path)
    spec = {
        "position": 6,
        "opacity": 0.85,
        "elements": [{"type": "logo", "path": "assets/logo.png"}],
    }
    out = tmp_path / "out.jpg"
    # Should not raise even when logo file doesn't exist
    apply_watermark(img_path, spec, out, vault_dir=tmp_path)
    assert out.exists()
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/shivendrasoni/personal/content_creation && python3 -m pytest tests/test_watermark.py -v 2>&1 | head -15
```

Expected: `ModuleNotFoundError: No module named 'scripts.watermark'`

- [ ] **Step 3: Create `scripts/watermark.py`**

```python
#!/usr/bin/env python3
"""
watermark.py — Apply watermark spec to images.

Position grid (3×3):
  1  2  3
  4     5
  6  7  8
"""
import argparse
import sys
from pathlib import Path
from typing import Optional

import yaml
from PIL import Image, ImageDraw, ImageFont

POSITION_MAP: dict[int, tuple[str, str]] = {
    1: ("left", "top"),
    2: ("center", "top"),
    3: ("right", "top"),
    4: ("left", "center"),
    5: ("right", "center"),
    6: ("left", "bottom"),
    7: ("center", "bottom"),
    8: ("right", "bottom"),
}
MARGIN = 20


def load_watermark_spec(spec_path: Path) -> dict:
    """Parse watermark.md frontmatter into a spec dict.

    Raises ValueError if no frontmatter delimiters found.
    """
    content = spec_path.read_text(encoding="utf-8")
    if not content.startswith("---"):
        raise ValueError(f"No YAML frontmatter found in {spec_path}")
    parts = content.split("---", 2)
    return yaml.safe_load(parts[1]) or {}


def _xy(canvas_size: tuple[int, int], w: int, h: int, halign: str, valign: str) -> tuple[int, int]:
    cw, ch = canvas_size
    if halign == "left":
        x = MARGIN
    elif halign == "center":
        x = (cw - w) // 2
    else:
        x = cw - w - MARGIN
    if valign == "top":
        y = MARGIN
    elif valign == "center":
        y = (ch - h) // 2
    else:
        y = ch - h - MARGIN
    return x, y


def apply_watermark(
    image_path: Path,
    spec: dict,
    output_path: Path,
    vault_dir: Optional[Path] = None,
) -> Path:
    """Apply watermark elements from spec to image_path. Write to output_path.

    Returns output_path.
    """
    img = Image.open(image_path).convert("RGBA")
    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    position = int(spec.get("position", 6))
    opacity = int(float(spec.get("opacity", 0.85)) * 255)
    halign, valign = POSITION_MAP.get(position, ("left", "bottom"))
    elements = spec.get("elements", [])

    for element in elements:
        elem_type = element.get("type")
        if elem_type in ("handle", "url"):
            text = element.get("value", "")
            if text:
                font = ImageFont.load_default()
                bbox = draw.textbbox((0, 0), text, font=font)
                tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
                x, y = _xy(img.size, tw, th, halign, valign)
                draw.text((x, y), text, fill=(255, 255, 255, opacity), font=font)
        elif elem_type == "logo" and vault_dir:
            logo_rel = element.get("path", "")
            logo_path = vault_dir / logo_rel
            if logo_path.exists():
                logo = Image.open(logo_path).convert("RGBA")
                max_dim = min(img.size) // 6
                logo.thumbnail((max_dim, max_dim))
                lw, lh = logo.size
                x, y = _xy(img.size, lw, lh, halign, valign)
                r, g, b, a = logo.split()
                a = a.point(lambda p: int(p * opacity / 255))
                logo = Image.merge("RGBA", (r, g, b, a))
                overlay.paste(logo, (x, y), logo)

    composited = Image.alpha_composite(img, overlay).convert("RGB")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    composited.save(output_path)
    return output_path


def _main(argv: Optional[list[str]] = None) -> None:
    parser = argparse.ArgumentParser(description="Apply watermark to an image")
    parser.add_argument("image", help="Input image path")
    parser.add_argument("--spec", required=True, help="Path to watermark.md")
    parser.add_argument("--out", required=True, help="Output image path")
    parser.add_argument("--vault", default=None, help="Vault root for logo path resolution")
    args = parser.parse_args(argv)

    spec = load_watermark_spec(Path(args.spec))
    vault_dir = Path(args.vault) if args.vault else None
    out_path = apply_watermark(Path(args.image), spec, Path(args.out), vault_dir)
    print(str(out_path))


if __name__ == "__main__":
    try:
        _main()
    except Exception as exc:
        print(f"Error: {exc}", file=sys.stderr)
        sys.exit(1)
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/shivendrasoni/personal/content_creation && python3 -m pytest tests/test_watermark.py -v
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/watermark.py tests/test_watermark.py
git commit -m "feat: add watermark.py — apply watermark spec (position grid + opacity) to images"
```

---

## Task 5: Update `scripts/create_session.py` — add `--output-dir` flag

**Files:**
- Modify: `scripts/create_session.py`
- Modify: `tests/test_create_session.py`

- [ ] **Step 1: Write failing tests for vault output path**

Add these tests to `tests/test_create_session.py` (append after existing tests):

```python
def test_custom_output_dir_is_used(tmp_path):
    from scripts.create_session import create_session
    session_dir = create_session("topic", tmp_path, output_dir="vault/outputs/reels")
    assert "vault" in str(session_dir)
    assert "outputs" in str(session_dir)
    assert "reels" in str(session_dir)


def test_default_output_dir_unchanged(tmp_path):
    from scripts.create_session import create_session
    session_dir = create_session("topic", tmp_path)
    assert "output" in str(session_dir)
    assert "reels" in str(session_dir)
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/shivendrasoni/personal/content_creation && python3 -m pytest tests/test_create_session.py::test_custom_output_dir_is_used -v
```

Expected: `TypeError: create_session() got an unexpected keyword argument 'output_dir'`

- [ ] **Step 3: Update `scripts/create_session.py`**

Current `create_session` signature:
```python
def create_session(topic: str, base_dir: Path) -> Path:
    slug = slugify(topic)
    folder_name = f"{date.today()}-{slug}"
    session_dir = base_dir / "output" / "reels" / folder_name
```

Replace with:
```python
def create_session(topic: str, base_dir: Path, output_dir: str = "output/reels") -> Path:
    slug = slugify(topic)
    folder_name = f"{date.today()}-{slug}"
    session_dir = base_dir / output_dir / folder_name
```

Current `__main__` block:
```python
if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("topic")
    parser.add_argument("--base-dir", default=".")
    args = parser.parse_args()
    session_dir = create_session(args.topic, Path(args.base_dir))
    print(str(session_dir))
```

Replace with:
```python
if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("topic")
    parser.add_argument("--base-dir", default=".")
    parser.add_argument("--output-dir", default="output/reels")
    args = parser.parse_args()
    session_dir = create_session(args.topic, Path(args.base_dir), args.output_dir)
    print(str(session_dir))
```

- [ ] **Step 4: Run all create_session tests to verify they pass**

```bash
cd /Users/shivendrasoni/personal/content_creation && python3 -m pytest tests/test_create_session.py -v
```

Expected: All tests PASS (old tests still pass; new tests pass too).

- [ ] **Step 5: Commit**

```bash
git add scripts/create_session.py tests/test_create_session.py
git commit -m "feat: add --output-dir flag to create_session.py for vault output path support"
```

---

## Task 6: Update `scripts/generate_carousel.py` — vault brand.md support

**Files:**
- Modify: `scripts/generate_carousel.py`
- Modify: `tests/test_generate_carousel.py`

- [ ] **Step 1: Write failing tests for vault brand.md loading**

Find the end of `tests/test_generate_carousel.py` and append:

```python
# ---------------------------------------------------------------------------
# load_brand — vault brand.md support
# ---------------------------------------------------------------------------

def test_load_brand_reads_vault_md_frontmatter(tmp_path):
    from scripts.generate_carousel import load_brand
    brand_md = tmp_path / "brand.md"
    brand_md.write_text(
        "---\nmodule: brand\ncolors:\n  primary: \"#1A1A2E\"\n  secondary: \"#16213E\"\n  accent: \"#E94560\"\n  background: \"#0F3460\"\n  text: \"#FFFFFF\"\nfont: Inter\n---\n\nBody.",
        encoding="utf-8",
    )
    result = load_brand(str(brand_md))
    assert result["primary"] == "#1A1A2E"
    assert result["secondary"] == "#16213E"
    assert result["accent"] == "#E94560"
    assert result["background"] == "#0F3460"
    assert result["text"] == "#FFFFFF"
    assert result.get("font") == "Inter"


def test_load_brand_md_falls_back_to_fallback_palette_on_missing_file(tmp_path):
    from scripts.generate_carousel import load_brand, FALLBACK_PALETTE
    result = load_brand(str(tmp_path / "nonexistent.md"))
    assert result == dict(FALLBACK_PALETTE)


def test_load_brand_md_falls_back_on_malformed_file(tmp_path):
    from scripts.generate_carousel import load_brand, FALLBACK_PALETTE
    bad = tmp_path / "brand.md"
    bad.write_text("not yaml at all ::::", encoding="utf-8")
    result = load_brand(str(bad))
    assert result == dict(FALLBACK_PALETTE)
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/shivendrasoni/personal/content_creation && python3 -m pytest tests/test_generate_carousel.py::test_load_brand_reads_vault_md_frontmatter -v
```

Expected: FAIL — `load_brand` does not handle `.md` files yet (treats them as JSON and fails).

- [ ] **Step 3: Update `scripts/generate_carousel.py` — add `_load_brand_from_md` and update `load_brand`**

The current `load_brand` function (lines 182–197) reads the file as JSON. Add a helper and update the dispatch:

Insert this new function **immediately before** `load_brand`:

```python
def _load_brand_from_md(path: Path) -> dict:
    """Parse vault brand.md YAML frontmatter into a flat brand dict."""
    import yaml
    content = path.read_text(encoding="utf-8")
    parts = content.split("---", 2)
    if len(parts) < 3:
        return dict(FALLBACK_PALETTE)
    fm = yaml.safe_load(parts[1]) or {}
    result = dict(FALLBACK_PALETTE)
    colors = fm.get("colors", {})
    result.update(colors)
    if "font" in fm:
        result["font"] = fm["font"]
    if "logo_path" in fm:
        result["logo_path"] = fm["logo_path"]
    return result
```

Replace the existing `load_brand` body to dispatch on extension:

Old:
```python
def load_brand(path: Optional[str]) -> dict:
    if not path:
        return dict(FALLBACK_PALETTE)
    brand_path = Path(path)
    if not brand_path.exists():
        return dict(FALLBACK_PALETTE)
    try:
        with brand_path.open() as f:
            data = json.load(f)
        result = dict(FALLBACK_PALETTE)
        colors = data.get("colors", data)
        result.update(colors)
        return result
    except Exception as e:
        print(f"[WARNING] Failed to load brand file '{path}': {e}", file=sys.stderr)
        return dict(FALLBACK_PALETTE)
```

New:
```python
def load_brand(path: Optional[str]) -> dict:
    if not path:
        return dict(FALLBACK_PALETTE)
    brand_path = Path(path)
    if not brand_path.exists():
        return dict(FALLBACK_PALETTE)
    try:
        if brand_path.suffix == ".md":
            return _load_brand_from_md(brand_path)
        with brand_path.open() as f:
            data = json.load(f)
        result = dict(FALLBACK_PALETTE)
        colors = data.get("colors", data)
        result.update(colors)
        return result
    except Exception as e:
        print(f"[WARNING] Failed to load brand file '{path}': {e}", file=sys.stderr)
        return dict(FALLBACK_PALETTE)
```

- [ ] **Step 4: Run all generate_carousel tests**

```bash
cd /Users/shivendrasoni/personal/content_creation && python3 -m pytest tests/test_generate_carousel.py -v
```

Expected: All tests PASS (existing tests still pass; new tests pass too).

- [ ] **Step 5: Commit**

```bash
git add scripts/generate_carousel.py tests/test_generate_carousel.py
git commit -m "feat: generate_carousel load_brand supports vault brand.md alongside CAROUSEL-BRAND.json"
```

---

## Task 7: Create `.claude/commands/brand-voice.md`

**Files:**
- Create: `.claude/commands/brand-voice.md`

- [ ] **Step 1: Create the command file**

```markdown
---
description: Build and maintain creator brand identity — modular deep-dive interview that writes vault/brand/modules/*.md files consumed by /make-reel and /make-carousel.
argument-hint: "[--module <name>] [--list]"
allowed-tools: Bash, Read, Write
---

# /brand-voice

## 0. Parse Arguments

Parse `$ARGUMENTS`:
- *(empty)* → full first-run interview (all 7 modules in sequence)
- `--module <name>` → re-run a single module; valid names: `niche style competitors goals cta watermark brand`
- `--list` → show status of all modules and exit

## 1. `--list` Mode

If `--list` was passed:

```bash
python3 scripts/brand_voice.py --vault "$(pwd)/vault" status
```

Print the result and stop. No further steps.

## 2. `--module <name>` Mode

If `--module <name>` was passed:

**a. Load existing module**

```bash
python3 scripts/brand_voice.py --vault "$(pwd)/vault" read --module <name>
```

If the file exists, show the user a summary:
> "Current `<name>` module (last updated YYYY-MM-DD):
> [show frontmatter as bullet list + first 200 chars of body]
>
> What would you like to update?"

If the file does not exist, treat as first-time setup for that module.

**b. Run focused interview**

Ask only the delta questions needed to update the module. Use the existing content as a starting point — do not re-ask questions already answered unless the user wants to change them.

**c. Write updated module**

After the interview, compose the full module file (frontmatter + body) and write it:

```bash
python3 scripts/brand_voice.py --vault "$(pwd)/vault" write --module <name> << 'CONTENT'
---
module: <name>
last_updated: <today's date as YYYY-MM-DD>
<key frontmatter fields for this module>
---

<Markdown body: philosophy, examples, context>
CONTENT
```

**d. Recompile master**

```bash
python3 scripts/brand_voice.py --vault "$(pwd)/vault" compile
```

Confirm: `✓ <name> module saved. brand-voice.md recompiled.`

## 3. Full First-Run Mode (no arguments)

Create the vault directory structure if it does not exist:

```bash
mkdir -p "$(pwd)/vault/brand/modules"
mkdir -p "$(pwd)/vault/outputs/reels"
mkdir -p "$(pwd)/vault/outputs/carousels"
mkdir -p "$(pwd)/vault/imports"
mkdir -p "$(pwd)/vault/assets"
mkdir -p "$(pwd)/vault/logs"
```

Run all 7 modules in sequence. **Do not proceed to the next module until the current one is written and confirmed.**

---

### Module 1: niche

Ask the user (one question at a time, probing based on answers):
- "What's your creator name and the primary space you create content in?"
- "What specific subniches do you cover?" (probe: "anything else?")
- "Describe your ideal viewer/reader in one sentence — who are they and what do they want?"
- "What transformation do you give them?" (probe: "before vs after watching your content")

After enough detail, write `vault/brand/modules/niche.md`:

```
---
module: niche
last_updated: <YYYY-MM-DD>
creator_name: <from answers>
space: <primary space, e.g. "AI tools for developers">
subniches:
  - <subniche 1>
  - <subniche 2>
audience_persona: <one sentence>
transformation: <one sentence>
---

## Niche Context

<2-3 paragraph narrative synthesizing all answers — enough context for an LLM to write on-brand content>
```

Run: `python3 scripts/brand_voice.py --vault "$(pwd)/vault" write --module niche`

---

### Module 2: style

Check `vault/imports/` for platform export files:

```bash
python3 -c "
import sys, json
from pathlib import Path
from scripts.import_platform import scan_imports_dir
found = scan_imports_dir(Path('vault/imports'))
print(json.dumps({k: str(v) for k, v in found.items()}))
"
```

**If imports found:** For each found file, extract text:
```bash
python3 scripts/import_platform.py instagram vault/imports/posts_1.json 2>/dev/null | head -200
python3 scripts/import_platform.py linkedin vault/imports/shares.csv 2>/dev/null | head -200
python3 scripts/import_platform.py twitter vault/imports/tweets.js 2>/dev/null | head -200
```
Analyze the extracted text before asking style questions.

**If no imports found:**
> "Drop your export files into `vault/imports/` and press Enter — or skip by typing 'skip'."
> Wait for user response.

Ask the user:
- "How would you describe your writing/speaking tone in 3 words?"
- "Fast-paced or measured? Short sentences or flowing paragraphs?"
- "Any words or phrases you always use? Any you never use?"
- "What opener styles do you use? (e.g. bold claim, rhetorical question, stat hook)"

After interviews and any import analysis, write `vault/brand/modules/style.md`:

```
---
module: style
last_updated: <YYYY-MM-DD>
tone: <3 words, e.g. "clear, direct, enthusiastic">
pace: <fast|moderate|measured>
avg_sentence_length: <short|medium|long>
opener_patterns:
  - <pattern 1>
  - <pattern 2>
vocabulary:
  use:
    - <phrase>
  avoid:
    - <phrase>
---

## Style Notes

<Narrative synthesis: voice characteristics, examples from imports if available, anti-patterns to avoid>
```

Run: `python3 scripts/brand_voice.py --vault "$(pwd)/vault" write --module style`

---

### Module 3: competitors

Ask the user:
- "Who are the top 3–5 creators in your space you watch most?"
- "Who inspires your style — creators you want to sound like?"
- "Who do you explicitly NOT want to sound like, and why?"

Write `vault/brand/modules/competitors.md`:

```
---
module: competitors
last_updated: <YYYY-MM-DD>
watch:
  - <creator name>
inspiration:
  - <creator name>
avoid:
  - name: <creator name>
    reason: <why>
---

## Competitive Landscape

<Narrative: what makes them different, what patterns to borrow, what to avoid>
```

Run: `python3 scripts/brand_voice.py --vault "$(pwd)/vault" write --module competitors`

---

### Module 4: goals

Ask the user:
- "For a typical post, what's your primary success metric? (likes, comments, DMs, profile clicks, link clicks, purchases)"
- "Does this change by platform or by content type?"
- "What does a 'great post' look like in numbers for you?"

Write `vault/brand/modules/goals.md`:

```
---
module: goals
last_updated: <YYYY-MM-DD>
primary_metric: <likes|comments|dms|clicks|purchases>
platforms:
  instagram: <metric>
  linkedin: <metric>
success_threshold:
  instagram: <e.g. ">200 likes or >20 comments">
  linkedin: <e.g. ">500 impressions or >10 comments">
---

## Goal Philosophy

<Narrative: why these metrics, how success is measured, what content is worth making>
```

Run: `python3 scripts/brand_voice.py --vault "$(pwd)/vault" write --module goals`

---

### Module 5: cta

Ask the user:
- "What do you want people to do after watching/reading? Different by platform?"
- "Give me your best CTA line for Instagram. For LinkedIn. For an educational post."
- "Do you use DM-based CTAs? Comment-trigger CTAs?"
- "What's your follow-up CTA (for people who already follow)?"

Write `vault/brand/modules/cta.md`:

```
---
module: cta
last_updated: <YYYY-MM-DD>
platforms:
  instagram:
    primary: "<exact CTA text>"
    follow: "<follow CTA text>"
  linkedin:
    primary: "<exact CTA text>"
    follow: "<follow CTA text>"
  default: "<fallback CTA>"
---

## CTA Philosophy

<Narrative: engagement strategy, why these CTAs, when to use which>
```

Run: `python3 scripts/brand_voice.py --vault "$(pwd)/vault" write --module cta`

---

### Module 6: watermark

Show the user the 3×3 position grid:
```
1  2  3
4     5
6  7  8
```

Ask the user:
- "Which elements do you want on your watermark? Options: (a) Instagram handle, (b) LinkedIn handle/URL, (c) Logo image, (d) Website URL, (e) Avatar image + handle. You can pick multiple."
- For each selected element: ask for the exact value (handle text, file path relative to `vault/assets/`, or URL)
- "Which position? (1–8 from the grid above)"
- "Opacity 0.0–1.0? (default 0.85)"

If the user mentions a logo or avatar file: check it exists in `vault/assets/`:
```bash
ls vault/assets/ 2>/dev/null
```
If not found, prompt: "Please copy the file to `vault/assets/<filename>` and press Enter."

Write `vault/brand/modules/watermark.md`:

```
---
module: watermark
last_updated: <YYYY-MM-DD>
elements:
  - type: handle
    value: "<@handle>"
  - type: logo
    path: "assets/<filename>"
position: <1-8>
opacity: <0.0-1.0>
---

## Watermark Notes

<Any placement notes or platform-specific variations>
```

Run: `python3 scripts/brand_voice.py --vault "$(pwd)/vault" write --module watermark`

---

### Module 7: brand

Ask the user:
- "Provide hex codes for 5 colors: primary, secondary, accent, background, text. (space or comma separated)"
- "What font do you use? (e.g. Inter, Montserrat, Poppins — or 'not sure')"
- "Do you have a logo file? If so, copy it to `vault/assets/` and give me the filename."

If user provides a brand image instead of hex codes, extract colors:
```bash
python3 -c "
from scripts.carousel_brand import extract_colors_from_image, assign_color_roles
colors = extract_colors_from_image('<path_or_url>')
roles = assign_color_roles(colors)
import json; print(json.dumps(roles, indent=2))
"
```
Ask: "Here are the extracted colors — accept or override?"

Write `vault/brand/modules/brand.md`:

```
---
module: brand
last_updated: <YYYY-MM-DD>
colors:
  primary: "<hex>"
  secondary: "<hex>"
  accent: "<hex>"
  background: "<hex>"
  text: "<hex>"
font: "<font name>"
logo_path: "assets/<filename>"
---

## Brand Identity Notes

<Any notes on brand usage, do's and don'ts>
```

Run: `python3 scripts/brand_voice.py --vault "$(pwd)/vault" write --module brand`

---

### Final: Compile master

After all 7 modules are written:

```bash
python3 scripts/brand_voice.py --vault "$(pwd)/vault" compile
```

Report to user:
```
✓ /brand-voice complete
Brand profile saved to vault/brand/brand-voice.md (Obsidian-ready)

Module status:
<paste output of: python3 scripts/brand_voice.py --vault vault/ status>

Run /make-reel or /make-carousel to use your brand automatically.
```
```

- [ ] **Step 2: Verify the command file is syntactically correct (no broken bash blocks)**

```bash
grep -n '```' /Users/$(whoami)/personal/content_creation/.claude/commands/brand-voice.md | wc -l
```

Expected: even number (all code blocks properly opened and closed).

- [ ] **Step 3: Quick smoke test — run --list with empty vault**

```bash
cd /Users/$(whoami)/personal/content_creation && python3 scripts/brand_voice.py --vault vault status
```

Expected output (7 lines, all `✗  not started`):
```
niche        ✗  not started
style        ✗  not started
competitors  ✗  not started
goals        ✗  not started
cta          ✗  not started
watermark    ✗  not started
brand        ✗  not started
```

- [ ] **Step 4: Commit**

```bash
git add .claude/commands/brand-voice.md
git commit -m "feat: add /brand-voice command — 7-module interview pipeline"
```

---

## Task 8: Update `.claude/commands/make-carousel.md`

**Files:**
- Modify: `.claude/commands/make-carousel.md`

Key changes: (a) session dir → `vault/outputs/carousels/`, (b) brand → `vault/brand/modules/brand.md`, (c) load style/cta/watermark as context before Stage 2, (d) log to `vault/logs/pipeline-log.md`.

- [ ] **Step 1: Replace Stage 1 session creation block**

Find this block in `make-carousel.md`:
```bash
TODAY=$(date +%Y-%m-%d)
SLUG=$(echo "$INPUT" | python3 -c "
import re, sys
text = sys.stdin.read().strip()
text = re.sub(r'https?://\S+', 'url', text)
text = text.lower()
text = re.sub(r'[^a-z0-9]+', '-', text)
print(text.strip('-')[:40])
")
SESSION_DIR="$(pwd)/output/carousels/${TODAY}-${SLUG}"
mkdir -p "$SESSION_DIR"
echo "Session folder: $SESSION_DIR"
```

Replace with:
```bash
TODAY=$(date +%Y-%m-%d)
SLUG=$(echo "$INPUT" | python3 -c "
import re, sys
text = sys.stdin.read().strip()
text = re.sub(r'https?://\S+', 'url', text)
text = text.lower()
text = re.sub(r'[^a-z0-9]+', '-', text)
print(text.strip('-')[:40])
")
SESSION_DIR="$(pwd)/vault/outputs/carousels/${TODAY}-${SLUG}"
mkdir -p "$SESSION_DIR"
mkdir -p "$(pwd)/vault/logs"
echo "Session folder: $SESSION_DIR"
```

- [ ] **Step 2: Add brand module loading section before Stage 2**

After the Stage 1 Research section (after the `Log: ✓ Stage 1 complete` line), insert a new section:

```markdown
## 1.5. Load Brand Modules

Load brand context from vault. Missing modules warn but do not block.

```bash
VAULT_DIR="$(pwd)/vault"
VAULT_BRAND="$VAULT_DIR/brand/modules/brand.md"
VAULT_STYLE="$VAULT_DIR/brand/modules/style.md"
VAULT_CTA="$VAULT_DIR/brand/modules/cta.md"
VAULT_WATERMARK="$VAULT_DIR/brand/modules/watermark.md"
```

Read each file that exists and inject its content into the slide planning context:
- `brand.md` → colors + font for rendering
- `style.md` → voice and tone guidance for all text (headline copy, caption voice)
- `cta.md` → last-slide CTA text (use the `platforms.<platform>.primary` field for the --platform value, fall back to `default`)
- `watermark.md` → stored for post-render watermark application

For each missing module file, print: `[WARN] vault/brand/modules/<name>.md not found — skipping <name> context`
```

- [ ] **Step 3: Replace the Stage 3 brand loading logic**

Find this block:
```bash
if [ -f "$(pwd)/CAROUSEL-BRAND.json" ]; then
  python3 scripts/generate_carousel.py "$SESSION_DIR/plan.json" \
    --out-dir "$SESSION_DIR" \
    --brand "$(pwd)/CAROUSEL-BRAND.json"
else
  python3 scripts/generate_carousel.py "$SESSION_DIR/plan.json" \
    --out-dir "$SESSION_DIR"
fi
```

Replace with (there are two instances — both the `--preview`/`--auto` block and the `--manual` per-slide block):

For the all-at-once block:
```bash
if [ -f "$VAULT_BRAND" ]; then
  python3 scripts/generate_carousel.py "$SESSION_DIR/plan.json" \
    --out-dir "$SESSION_DIR" \
    --brand "$VAULT_BRAND"
else
  python3 scripts/generate_carousel.py "$SESSION_DIR/plan.json" \
    --out-dir "$SESSION_DIR"
fi
```

For the per-slide `--manual` block:
```bash
if [ -f "$VAULT_BRAND" ]; then
  python3 scripts/generate_carousel.py "$SESSION_DIR/plan.json" \
    --out-dir "$SESSION_DIR" \
    --brand "$VAULT_BRAND" \
    --slide N
else
  python3 scripts/generate_carousel.py "$SESSION_DIR/plan.json" \
    --out-dir "$SESSION_DIR" \
    --slide N
fi
```

- [ ] **Step 4: Add pipeline log append at the end (before the Done report)**

Before the `## 6. Done` section, insert:

```markdown
## 5.5. Log Pipeline Run

```bash
LOG_FILE="$(pwd)/vault/logs/pipeline-log.md"
TIMESTAMP=$(date "+%Y-%m-%d %H:%M")
BRAND_VERSION=$(python3 -c "
import yaml, sys
from pathlib import Path
p = Path('vault/brand/modules/brand.md')
if p.exists():
    parts = p.read_text().split('---', 2)
    fm = yaml.safe_load(parts[1]) if len(parts) >= 2 else {}
    print(f\"loaded (brand-voice v{fm.get('last_updated', 'unknown')})\")
else:
    print('not loaded')
" 2>/dev/null || echo "not loaded")

cat >> "$LOG_FILE" << EOF

## $TIMESTAMP — make-carousel
- topic: $INPUT
- slides: $SLIDE_COUNT
- platform: $PLATFORM
- brand: $BRAND_VERSION
- output: $SESSION_DIR
EOF
```
```

- [ ] **Step 5: Verify the modified file has no syntax issues**

```bash
grep -c '```' /Users/$(whoami)/personal/content_creation/.claude/commands/make-carousel.md
```

Expected: even number.

- [ ] **Step 6: Commit**

```bash
git add .claude/commands/make-carousel.md
git commit -m "feat: make-carousel reads vault brand modules and logs to pipeline-log.md"
```

---

## Task 9: Update `.claude/commands/make-reel.md`

**Files:**
- Modify: `.claude/commands/make-reel.md`

Key changes: (a) create session in `vault/outputs/reels/`, (b) load brand modules before Stage 2 Script, (c) inject brand context into script prompt, (d) log to `vault/logs/pipeline-log.md`.

- [ ] **Step 1: Update Session Folder creation to use vault output**

Find in `make-reel.md`:
```bash
SESSION_DIR=$(python3 scripts/create_session.py "$TOPIC" --base-dir "$(pwd)")
echo "Session folder: $SESSION_DIR"
```

Replace with:
```bash
SESSION_DIR=$(python3 scripts/create_session.py "$TOPIC" --base-dir "$(pwd)" --output-dir "vault/outputs/reels")
mkdir -p "$(pwd)/vault/logs"
echo "Session folder: $SESSION_DIR"
```

- [ ] **Step 2: Add brand module loading section before Stage 2**

After the `## 1. Create Session Folder` section (after the symlink line), insert:

```markdown
## 1.5. Load Brand Modules

Load brand context from vault. Missing modules warn but do not block.

```bash
VAULT_DIR="$(pwd)/vault"
VAULT_STYLE="$VAULT_DIR/brand/modules/style.md"
VAULT_CTA="$VAULT_DIR/brand/modules/cta.md"
VAULT_NICHE="$VAULT_DIR/brand/modules/niche.md"
VAULT_WATERMARK="$VAULT_DIR/brand/modules/watermark.md"
```

For each file that exists, read it:
```bash
for MODULE_PATH in "$VAULT_STYLE" "$VAULT_CTA" "$VAULT_NICHE" "$VAULT_WATERMARK"; do
  if [ -f "$MODULE_PATH" ]; then
    echo "Loaded: $MODULE_PATH"
  else
    echo "[WARN] $MODULE_PATH not found — skipping"
  fi
done
```

Inject the contents of each found module into the script generation context for Stage 2:
- `style.md` → tone, vocabulary, opener patterns to apply (and anti-patterns to avoid)
- `cta.md` → CTA line to append at the end of the script (use `platforms.instagram.primary` or `default`)
- `niche.md` → audience persona and transformation for relevance filtering
- `watermark.md` → stored spec for video post-processing step
```

- [ ] **Step 3: Update Stage 2 Script to inject brand context**

Find the Stage 2 Script section that says:
```
Invoke the `viral-reel-generator` skill. Pass:
- Contents of `$SESSION_DIR/research.md` as research context
```

Update to include brand context:
```
Invoke the `viral-reel-generator` skill. Pass:
- Contents of `$SESSION_DIR/research.md` as research context
- Style: `--style punchy` → Style A (Punchy Explainer); `--style deep-dive` → Style B (Deep Dive)
- Target duration: `--duration` value in seconds
- Brand voice context (inject into script prompt if modules were loaded):
  - From `style.md`: apply tone, vocabulary, opener patterns; avoid anti-patterns
  - From `niche.md`: tailor content to audience persona and transformation
  - From `cta.md`: append the platform CTA as the final beat of the script
```

- [ ] **Step 4: Add pipeline log append before the Done section**

Before `## 7. Done`, insert:

```markdown
## 6.5. Log Pipeline Run

```bash
LOG_FILE="$(pwd)/vault/logs/pipeline-log.md"
TIMESTAMP=$(date "+%Y-%m-%d %H:%M")
BRAND_LOADED="none"
[ -f "$VAULT_STYLE" ] && BRAND_LOADED="style"
[ -f "$VAULT_CTA" ] && BRAND_LOADED="$BRAND_LOADED,cta"
[ -f "$VAULT_NICHE" ] && BRAND_LOADED="$BRAND_LOADED,niche"

cat >> "$LOG_FILE" << EOF

## $TIMESTAMP — make-reel
- topic: $TOPIC
- duration: $DURATION
- style: $STYLE
- brand modules: $BRAND_LOADED
- output: $SESSION_DIR/final.mp4
EOF
```
```

- [ ] **Step 5: Commit**

```bash
git add .claude/commands/make-reel.md
git commit -m "feat: make-reel loads vault brand modules and logs to pipeline-log.md"
```

---

## Task 10: Delete deprecated files

**Files:**
- Delete: `.claude/commands/carousel-brand.md`
- Delete: `scripts/carousel_brand.py`
- Delete: `tests/test_carousel_brand.py`

- [ ] **Step 1: Run the full test suite to confirm everything passes before deletion**

```bash
cd /Users/$(whoami)/personal/content_creation && python3 -m pytest tests/ -v --ignore=tests/test_carousel_brand.py
```

Expected: All tests PASS.

- [ ] **Step 2: Confirm nothing imports carousel_brand except test_carousel_brand**

```bash
grep -r "carousel_brand" /Users/$(whoami)/personal/content_creation --include="*.py" --include="*.md" -l
```

Expected: only `scripts/carousel_brand.py` and `tests/test_carousel_brand.py` (and possibly `carousel-brand.md`). No other scripts should import it after the brand.md migration.

- [ ] **Step 3: Delete the files**

```bash
rm /Users/$(whoami)/personal/content_creation/.claude/commands/carousel-brand.md
rm /Users/$(whoami)/personal/content_creation/scripts/carousel_brand.py
rm /Users/$(whoami)/personal/content_creation/tests/test_carousel_brand.py
```

- [ ] **Step 4: Run the full test suite to confirm nothing broke**

```bash
cd /Users/$(whoami)/personal/content_creation && python3 -m pytest tests/ -v
```

Expected: All remaining tests PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: delete carousel-brand command and carousel_brand.py (replaced by vault brand.md)"
```

---

## Self-Review

### Spec coverage check

| Spec section | Task that implements it |
|---|---|
| §2 Vault structure (dirs) | Task 7 (brand-voice.md creates dirs), Task 8 (make-carousel uses vault paths) |
| §3 Module file format (YAML frontmatter + body) | Task 2 (brand_voice.py parse/write) |
| §4 /brand-voice command (3 modes) | Task 7 |
| §4 Module sequence (7 modules) | Task 7 |
| §4 Module re-run (--module) | Task 7 |
| §4 Status check (--list) | Task 7, Task 2 (module_status) |
| §5 File import (style module, scan imports/) | Task 3 (import_platform.py), Task 7 (style module in brand-voice.md) |
| §5 Instagram/LinkedIn/Twitter parsers | Task 3 |
| §6 Watermark config (3×3 grid, elements) | Task 4 (watermark.py), Task 7 (watermark module) |
| §7 Brand module (replaces CAROUSEL-BRAND.json) | Task 6 (generate_carousel.py), Task 8, Task 10 |
| §8 /make-reel brand integration | Task 9 |
| §8 /make-carousel brand integration | Task 8 |
| §8 Output logging (pipeline-log.md) | Task 8 and Task 9 |
| §9 Compiled master (brand-voice.md) | Task 2 (compile_master) |
| §10 scripts/brand_voice.py | Task 2 |
| §10 scripts/import_platform.py | Task 3 |
| §10 scripts/watermark.py | Task 4 |
| §11 Delete deprecated files | Task 10 |
| §12 .gitignore vault/ | Task 1 |

### Gaps found

- **`docs/help.md`** already updated (confirmed in file — `/brand-voice` documented, `/carousel-brand` not listed). No action needed.
- **`vault/` directory initialization** — Task 7 brand-voice.md creates all required subdirectories via `mkdir -p` commands during the full first-run mode. No separate init script needed.
- **`carousel_brand.py` is still imported by `brand-voice.md` Task 7 step for color extraction from image in the brand module interview** — this is fine because we only delete `carousel_brand.py` in Task 10, after Task 7 is complete. The brand-voice.md command calls the extract function from the existing carousel_brand module for image→hex extraction. This is intentional: the extraction logic stays alive in brand_voice.py's usage until deletion confirms it's not needed. Since `watermark.py` and `brand_voice.py` don't depend on `carousel_brand.py`, deletion in Task 10 is safe.

### Placeholder scan

No TBD, TODO, or "similar to Task N" patterns found. All code blocks are complete.

### Type consistency

- `module_status` returns `tuple[str, Optional[date]]` — used consistently in `print_status` (Task 2)
- `parse_module_file` returns `tuple[dict, str]` — used by `read_module`, `_load_brand_from_md`, `load_watermark_spec` — consistent
- `write_module` takes `(vault_dir: Path, module: str, content: str)` — consistent with brand-voice.md bash heredoc usage
- `apply_watermark` signature `(image_path, spec, output_path, vault_dir=None)` — consistent with watermark.py CLI args

---

**Plan complete and saved to `docs/superpowers/plans/2026-05-05-brand-voice.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
