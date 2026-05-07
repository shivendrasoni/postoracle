# Auto-Publish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `--auto-publish` to `make-reel`/`make-carousel`, a standalone `/publish` command, email notifications, and a `/add-platform` scaffolding command — all routed through a single `scripts/publish.py` without touching any existing pipeline stage.

**Architecture:** A platform registry dict in `publish.py` maps `platform → content_type → handler`. The CLI and slash commands both delegate to the same `publish()` function. Email is sent after all platform handlers complete (pass or fail) when `notify_enabled: true` in `vault/publish-config.md`.

**Tech Stack:** Python 3 stdlib (argparse, subprocess, pathlib, re), PyYAML (already in requirements.txt), pytest + unittest.mock for tests. Composio CLI called via `subprocess.run()`.

---

> **SPEC NOTE — caption filename for carousels:** The spec says `caption.txt` for carousels, but `make-carousel.md` has been updated (commit `b1fef5b`) to write `caption.md` instead. This plan implements `publish.py` to read `caption.md` for carousels (matching what the pipeline actually produces) and parse it with the `[POST CAPTION]` marker from that file.

---

## File Map

| Path | Action | Responsibility |
|------|--------|---------------|
| `scripts/publish.py` | Create | Platform registry, content detection, caption extraction, Composio calls, email |
| `vault/publish-config.md` | Create | notify_email and notify_enabled config |
| `tests/test_publish.py` | Create | Unit tests for detection, extraction, registry, dry-run, missing config |
| `.claude/commands/publish.md` | Create | `/publish` slash command |
| `.claude/commands/add-platform.md` | Create | `/add-platform` slash command |
| `.claude/commands/make-reel.md` | Modify | Add `--auto-publish` arg + Stage 6 publish block |
| `.claude/commands/make-carousel.md` | Modify | Add `--auto-publish` arg + Stage 6 publish block |

---

### Task 1: Create vault/publish-config.md

**Files:**
- Create: `vault/publish-config.md`

- [ ] **Step 1: Create the config file**

```markdown
---
notify_email: shivendrasoni91+agent@gmail.com
notify_enabled: true
---
```

Write exactly those three lines (including the `---` delimiters) to `vault/publish-config.md`.

- [ ] **Step 2: Verify file was created**

Run: `cat vault/publish-config.md`
Expected: the three-line YAML block above, no extra whitespace.

- [ ] **Step 3: Commit**

```bash
git add vault/publish-config.md
git commit -m "feat: add vault/publish-config.md with email notification settings"
```

---

### Task 2: Write failing tests for publish.py

**Files:**
- Create: `tests/test_publish.py`

- [ ] **Step 1: Write the test file**

```python
import pytest
from pathlib import Path
from unittest.mock import patch, MagicMock


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

def _make_session(tmp_path, files: list[str]) -> Path:
    session = tmp_path / "2026-05-05-test-session"
    session.mkdir()
    for f in files:
        (session / f).write_text("placeholder")
    return session


def _make_reel_caption(session: Path) -> None:
    (session / "caption.md").write_text(
        "# Caption\n\n## Post Caption\n\nThis is the hook line.\n\n→ Value 1\n\n#hashtag\n\n---\n\n## Script Reference\n\nscript text"
    )


def _make_carousel_caption(session: Path) -> None:
    (session / "caption.md").write_text(
        "[POST CAPTION]\nThis is the carousel caption.\n#tag1\n\n---\n[SLIDE COPY]\n1: Slide one"
    )


# ---------------------------------------------------------------------------
# Content type detection
# ---------------------------------------------------------------------------

def test_detect_reel_from_final_mp4(tmp_path):
    from scripts.publish import detect_content_type
    session = _make_session(tmp_path, ["final.mp4"])
    assert detect_content_type(session) == "reel"


def test_detect_carousel_from_1_png(tmp_path):
    from scripts.publish import detect_content_type
    session = _make_session(tmp_path, ["1.png"])
    assert detect_content_type(session) == "carousel"


def test_detect_ambiguous_raises(tmp_path):
    from scripts.publish import detect_content_type, PublishError
    session = _make_session(tmp_path, ["final.mp4", "1.png"])
    with pytest.raises(PublishError, match="Ambiguous session"):
        detect_content_type(session)


def test_detect_empty_raises(tmp_path):
    from scripts.publish import detect_content_type, PublishError
    session = _make_session(tmp_path, [])
    with pytest.raises(PublishError, match="No publishable asset"):
        detect_content_type(session)


# ---------------------------------------------------------------------------
# Caption extraction
# ---------------------------------------------------------------------------

def test_extract_reel_caption(tmp_path):
    from scripts.publish import extract_caption
    session = _make_session(tmp_path, ["final.mp4"])
    _make_reel_caption(session)
    caption = extract_caption(session, "reel")
    assert "hook line" in caption
    assert "Value 1" in caption
    assert "Script Reference" not in caption


def test_extract_carousel_caption(tmp_path):
    from scripts.publish import extract_caption
    session = _make_session(tmp_path, ["1.png"])
    _make_carousel_caption(session)
    caption = extract_caption(session, "carousel")
    assert "carousel caption" in caption
    assert "SLIDE COPY" not in caption


def test_extract_caption_missing_file_raises(tmp_path):
    from scripts.publish import extract_caption, PublishError
    session = _make_session(tmp_path, ["final.mp4"])
    with pytest.raises(PublishError, match="caption"):
        extract_caption(session, "reel")


# ---------------------------------------------------------------------------
# Platform registry resolution
# ---------------------------------------------------------------------------

def test_resolve_all_returns_all_platforms():
    from scripts.publish import resolve_platforms
    platforms = resolve_platforms("all")
    assert "instagram" in platforms
    assert "linkedin" in platforms
    assert len(platforms) >= 2


def test_resolve_single_platform():
    from scripts.publish import resolve_platforms
    assert resolve_platforms("instagram") == ["instagram"]


def test_resolve_unknown_platform_raises():
    from scripts.publish import resolve_platforms, PublishError
    with pytest.raises(PublishError, match="Unknown platform"):
        resolve_platforms("twitter")


# ---------------------------------------------------------------------------
# Dry-run: no Composio calls
# ---------------------------------------------------------------------------

def test_dry_run_makes_no_subprocess_calls(tmp_path):
    from scripts.publish import publish
    session = _make_session(tmp_path, ["final.mp4"])
    _make_reel_caption(session)
    config_path = tmp_path / "publish-config.md"
    config_path.write_text("---\nnotify_enabled: false\n---\n")

    with patch("scripts.publish.subprocess.run") as mock_run:
        results = publish(session, "instagram", dry_run=True, config_path=config_path)

    mock_run.assert_not_called()
    assert results["instagram"]["success"] is True
    assert results["instagram"].get("dry_run") is True


# ---------------------------------------------------------------------------
# Missing config: email skipped, publish continues
# ---------------------------------------------------------------------------

def test_missing_config_skips_email(tmp_path):
    from scripts.publish import publish
    session = _make_session(tmp_path, ["final.mp4"])
    _make_reel_caption(session)
    missing_config = tmp_path / "nonexistent-config.md"

    with patch("scripts.publish.subprocess.run") as mock_run:
        mock_run.return_value = MagicMock(returncode=0, stdout="", stderr="")
        results = publish(session, "instagram", dry_run=False, config_path=missing_config)

    # Email send should not have been called (no agent-mail slug call)
    email_calls = [c for c in mock_run.call_args_list
                   if "agent-mail" in str(c) or "GMAIL" in str(c).upper()]
    assert len(email_calls) == 0
```

- [ ] **Step 2: Run tests to confirm they all fail**

```bash
python3 -m pytest tests/test_publish.py -v 2>&1 | head -60
```

Expected: `ImportError` or `ModuleNotFoundError` for `scripts.publish` — confirming no implementation exists yet.

- [ ] **Step 3: Commit**

```bash
git add tests/test_publish.py
git commit -m "test: add failing tests for publish.py (detection, extraction, registry, dry-run)"
```

---

### Task 3: Implement publish.py — core logic (detection + caption extraction)

**Files:**
- Create: `scripts/publish.py`

- [ ] **Step 1: Create scripts/publish.py with core logic**

```python
#!/usr/bin/env python3
"""
publish.py — Platform publisher for reel and carousel sessions.

Usage:
  python3 scripts/publish.py --session-dir <path> --platform instagram|linkedin|all [--dry-run]
"""

import argparse
import re
import subprocess
import sys
from pathlib import Path
from typing import Optional

import yaml


class PublishError(Exception):
    pass


# ---------------------------------------------------------------------------
# Platform registry — add new platforms here only
# ---------------------------------------------------------------------------

def _instagram_reel(session_dir: Path, caption: str, config: dict) -> dict:
    return _composio_call(
        slug="INSTAGRAM_CREATE_REEL",
        payload={
            "video_path": str(session_dir / "final.mp4"),
            "caption": caption,
        },
    )


def _instagram_carousel(session_dir: Path, caption: str, config: dict) -> dict:
    image_paths = sorted(str(p) for p in session_dir.glob("*.png") if p.name[0].isdigit())
    return _composio_call(
        slug="INSTAGRAM_CREATE_CAROUSEL_POST",
        payload={
            "image_paths": image_paths,
            "caption": caption,
        },
    )


def _linkedin_reel(session_dir: Path, caption: str, config: dict) -> dict:
    return _composio_call(
        slug="LINKEDIN_CREATE_VIDEO_POST",
        payload={
            "video_path": str(session_dir / "final.mp4"),
            "text": caption,
        },
    )


def _linkedin_carousel(session_dir: Path, caption: str, config: dict) -> dict:
    image_paths = sorted(str(p) for p in session_dir.glob("*.png") if p.name[0].isdigit())
    return _composio_call(
        slug="LINKEDIN_CREATE_IMAGE_POST",
        payload={
            "image_paths": image_paths,
            "text": caption,
        },
    )


PLATFORM_REGISTRY: dict[str, dict[str, callable]] = {
    "instagram": {
        "reel": _instagram_reel,
        "carousel": _instagram_carousel,
    },
    "linkedin": {
        "reel": _linkedin_reel,
        "carousel": _linkedin_carousel,
    },
}


# ---------------------------------------------------------------------------
# Core helpers
# ---------------------------------------------------------------------------

def detect_content_type(session_dir: Path) -> str:
    has_reel = (session_dir / "final.mp4").exists()
    has_carousel = (session_dir / "1.png").exists()
    if has_reel and has_carousel:
        raise PublishError(f"Ambiguous session: contains both final.mp4 and 1.png in {session_dir}")
    if not has_reel and not has_carousel:
        raise PublishError(f"No publishable asset found in session dir: {session_dir}")
    return "reel" if has_reel else "carousel"


def extract_caption(session_dir: Path, content_type: str) -> str:
    caption_path = session_dir / "caption.md"
    if not caption_path.exists():
        raise PublishError(f"caption file missing: {caption_path}")
    text = caption_path.read_text()

    if content_type == "reel":
        # Extract text under "## Post Caption" section, stop at the next "---" or "##"
        match = re.search(r"## Post Caption\s*\n(.*?)(?:\n---|\n##|\Z)", text, re.DOTALL)
        if not match:
            raise PublishError(f"## Post Caption section not found in {caption_path}")
        return match.group(1).strip()

    # carousel: extract everything after "[POST CAPTION]" up to "---"
    match = re.search(r"\[POST CAPTION\]\s*\n(.*?)(?:\n---|\Z)", text, re.DOTALL)
    if not match:
        raise PublishError(f"[POST CAPTION] marker not found in {caption_path}")
    return match.group(1).strip()


def resolve_platforms(platform: str) -> list[str]:
    if platform == "all":
        return list(PLATFORM_REGISTRY.keys())
    if platform not in PLATFORM_REGISTRY:
        raise PublishError(f"Unknown platform '{platform}'. Registered: {list(PLATFORM_REGISTRY.keys())}")
    return [platform]


def load_config(config_path: Path) -> dict:
    if not config_path.exists():
        print(f"[WARN] {config_path} not found — email notifications disabled", file=sys.stderr)
        return {}
    text = config_path.read_text()
    parts = text.split("---", 2)
    if len(parts) < 2:
        print(f"[WARN] {config_path} has no YAML frontmatter — email disabled", file=sys.stderr)
        return {}
    return yaml.safe_load(parts[1]) or {}


# ---------------------------------------------------------------------------
# Composio integration
# ---------------------------------------------------------------------------

def _composio_call(slug: str, payload: dict) -> dict:
    _check_composio()
    import json
    result = subprocess.run(
        ["composio", "execute", slug, "-d", json.dumps(payload)],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        err = result.stderr.strip() or result.stdout.strip()
        if "not connected" in err.lower() or "not authenticated" in err.lower():
            platform_guess = slug.split("_")[0].lower()
            return {"success": False, "url": None, "error": f"Not connected — run: composio link {platform_guess}"}
        return {"success": False, "url": None, "error": err}
    # Try to extract a URL from stdout
    url_match = re.search(r"https?://\S+", result.stdout)
    return {"success": True, "url": url_match.group(0) if url_match else None, "error": None}


def _check_composio() -> None:
    result = subprocess.run(["which", "composio"], capture_output=True)
    if result.returncode != 0:
        raise PublishError("composio not found — install with: npm install -g @composio/cli")


# ---------------------------------------------------------------------------
# Email notification
# ---------------------------------------------------------------------------

def _send_email(session_dir: Path, platforms: list[str], results: dict, config: dict) -> None:
    if not config.get("notify_enabled"):
        return
    recipient = config.get("notify_email", "")
    if not recipient:
        print("[WARN] notify_email is empty — skipping email", file=sys.stderr)
        return

    platform_summary = "\n".join(
        f"  {p}: {'✓ ' + (results[p].get('url') or 'posted') if results[p]['success'] else '✗ ' + results[p].get('error', 'unknown error')}"
        for p in platforms
        if p in results
    )
    subject = f"Published: {session_dir.name} → {', '.join(platforms)}"
    body = f"Session: {session_dir}\n\n{platform_summary}"

    import json
    subprocess.run(
        ["composio", "execute", "GMAIL_SEND_EMAIL", "-d",
         json.dumps({"to": recipient, "subject": subject, "body": body})],
        capture_output=True,
        text=True,
    )


# ---------------------------------------------------------------------------
# Orchestrator
# ---------------------------------------------------------------------------

def publish(
    session_dir: Path,
    platform: str,
    dry_run: bool = False,
    config_path: Optional[Path] = None,
) -> dict:
    if config_path is None:
        config_path = Path("vault/publish-config.md")

    if not session_dir.exists():
        raise PublishError(f"Session dir not found: {session_dir}")

    content_type = detect_content_type(session_dir)
    caption = extract_caption(session_dir, content_type)
    platforms = resolve_platforms(platform)
    config = load_config(config_path)

    results: dict[str, dict] = {}

    for p in platforms:
        handler = PLATFORM_REGISTRY[p].get(content_type)
        if handler is None:
            results[p] = {"success": False, "url": None, "error": f"No {content_type} handler for {p}"}
            continue

        if dry_run:
            print(f"[DRY-RUN] Would publish {content_type} to {p} from {session_dir}")
            results[p] = {"success": True, "url": None, "error": None, "dry_run": True}
            continue

        try:
            results[p] = handler(session_dir, caption, config)
        except PublishError as exc:
            results[p] = {"success": False, "url": None, "error": str(exc)}

    if not dry_run:
        _send_email(session_dir, platforms, results, config)

    _print_summary(platforms, results)
    return results


def _print_summary(platforms: list[str], results: dict) -> None:
    print("\n── Publish Summary ──")
    for p in platforms:
        r = results.get(p, {})
        if r.get("dry_run"):
            print(f"  {p}: [DRY-RUN] would publish")
        elif r.get("success"):
            url = r.get("url") or "no URL returned"
            print(f"  {p}: ✓ published — {url}")
        else:
            print(f"  {p}: ✗ failed — {r.get('error', 'unknown')}")


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(description="Publish a session to social platforms")
    parser.add_argument("--session-dir", required=True, type=Path)
    parser.add_argument("--platform", required=True, help="instagram | linkedin | all")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--config", type=Path, default=None)
    args = parser.parse_args()

    try:
        publish(args.session_dir, args.platform, dry_run=args.dry_run, config_path=args.config)
    except PublishError as exc:
        print(f"[ERROR] {exc}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Run the tests — expect most to pass, some may still need adjustment**

```bash
python3 -m pytest tests/test_publish.py -v 2>&1 | tail -30
```

Expected: all tests pass. If `test_missing_config_skips_email` fails because `_check_composio` raises `PublishError` when `composio` is not on PATH, patch it:

Look at the test — it already patches `subprocess.run`. If `_check_composio` calls `subprocess.run`, the mock will catch it. The mock returns `MagicMock(returncode=0, ...)`, so `which composio` will appear to succeed. This should work.

- [ ] **Step 3: Commit**

```bash
git add scripts/publish.py
git commit -m "feat: add scripts/publish.py with content detection, caption extraction, and platform registry"
```

---

### Task 4: Run tests green and verify

**Files:**
- Modify (if needed): `tests/test_publish.py`, `scripts/publish.py`

- [ ] **Step 1: Run full test suite**

```bash
python3 -m pytest tests/test_publish.py -v
```

Expected output: all tests pass. If any fail, look at the error carefully. Common failure:
- `test_extract_reel_caption` failing → the regex in `extract_caption` may not match the test fixture. Compare the fixture text in the test with the regex pattern `r"## Post Caption\s*\n(.*?)(?:\n---|\n##|\Z)"`.
- The fixture creates: `"# Caption\n\n## Post Caption\n\nThis is the hook line.\n\n→ Value 1\n\n#hashtag\n\n---\n\n## Script Reference\n\nscript text"`. The match should stop at `\n---`. Check the match group returns "This is the hook line.\n\n→ Value 1\n\n#hashtag".

- [ ] **Step 2: Verify the other test suite still passes**

```bash
python3 -m pytest tests/ -v --ignore=tests/test_publish.py 2>&1 | tail -20
```

Expected: all pre-existing tests still pass.

- [ ] **Step 3: Commit if any fixes were needed**

```bash
git add scripts/publish.py tests/test_publish.py
git commit -m "fix: adjust caption regex to match actual caption.md fixture format"
```

---

### Task 5: Modify make-reel.md — add --auto-publish flag and Stage 6

**Files:**
- Modify: `.claude/commands/make-reel.md`

- [ ] **Step 1: Add --auto-publish to Stage 0 argument parsing**

In `.claude/commands/make-reel.md`, find the `## 0. Parse Arguments` section. After the `--style` line add:

```
- `--auto-publish instagram|linkedin|all` — optional; if present, publish to the specified platform(s) after the pipeline completes
```

Also add capture to the bash env var block:

```bash
AUTO_PUBLISH=""
for arg in $@; do
  case "$prev_arg" in
    --auto-publish) AUTO_PUBLISH="$arg" ;;
  esac
  prev_arg="$arg"
done
```

Use the `Edit` tool to make this change precisely. The exact old string to replace is the last line of the existing parse block (find the `--style punchy|deep-dive — default` line) and add after it:

Old string (last two lines of the arg list):
```
- `--style punchy|deep-dive` — default `punchy`
```

New string:
```
- `--style punchy|deep-dive` — default `punchy`
- `--auto-publish instagram|linkedin|all` — optional; if present, publish after pipeline completes. Store in `$AUTO_PUBLISH`.
```

- [ ] **Step 2: Add Stage 6 — Publish (conditional) after Stage 5.5**

Find the `## 7. Done` section. Insert a new section before it:

Old string:
```
## 7. Done
```

New string:
```
## 6.7. Stage 6 — Publish (conditional)

Runs only if `--auto-publish` was passed in `$ARGUMENTS`.

```bash
if [ -n "$AUTO_PUBLISH" ]; then
  python3 scripts/publish.py \
    --session-dir "$SESSION_DIR" \
    --platform "$AUTO_PUBLISH"
fi
```

If the publish step ran, append a `Published:` line to the done report.

## 7. Done
```

- [ ] **Step 3: Update the Done report to include Published line**

Find the done report block:
```
Report to user:
```
✓ /make-reel complete
Session: $SESSION_DIR
Final video: $SESSION_DIR/final.mp4
Caption: $SESSION_DIR/caption.md
```
```

Replace with:
```
Report to user:
```
✓ /make-reel complete
Session: $SESSION_DIR
Final video: $SESSION_DIR/final.mp4
Caption: $SESSION_DIR/caption.md
[if --auto-publish was set] Published: $AUTO_PUBLISH
```
```

- [ ] **Step 4: Verify the file looks correct**

Run: `grep -n "auto-publish\|Stage 6\|AUTO_PUBLISH" .claude/commands/make-reel.md`

Expected: at least 4 matching lines covering arg definition, bash capture, Stage 6 block, and done report.

- [ ] **Step 5: Commit**

```bash
git add .claude/commands/make-reel.md
git commit -m "feat: add --auto-publish flag and Stage 6 publish step to make-reel"
```

---

### Task 6: Modify make-carousel.md — add --auto-publish flag and Stage 6

**Files:**
- Modify: `.claude/commands/make-carousel.md`

- [ ] **Step 1: Add --auto-publish to Stage 0 argument parsing**

Find the `## 0. Parse Arguments` section in `make-carousel.md`. After the `mode flag` line, add:

Old string (the mode flag line):
```
- mode flag — `--preview` (default), `--auto`, or `--manual`. If multiple mode flags are present, use the most restrictive: `--manual` > `--preview` > `--auto`
```

New string:
```
- mode flag — `--preview` (default), `--auto`, or `--manual`. If multiple mode flags are present, use the most restrictive: `--manual` > `--preview` > `--auto`
- `--auto-publish instagram|linkedin|all` — optional; if present, publish after pipeline completes. Store in `$AUTO_PUBLISH`.
```

- [ ] **Step 2: Add Stage 6 — Publish (conditional) after the log step**

Find the `## 6. Done` section in `make-carousel.md`. Insert before it:

Old string:
```
## 6. Done
```

New string:
```
## 5.7. Stage 6 — Publish (conditional)

Runs only if `--auto-publish` was passed in `$ARGUMENTS`.

```bash
if [ -n "$AUTO_PUBLISH" ]; then
  python3 scripts/publish.py \
    --session-dir "$SESSION_DIR" \
    --platform "$AUTO_PUBLISH"
fi
```

If the publish step ran, append a `Published:` line to the done report.

## 6. Done
```

- [ ] **Step 3: Update the Done report**

Find:
```
Report to user:
```
✓ /make-carousel complete
Folder: $SESSION_DIR
Slides: $SESSION_DIR/1.png … N.png
Caption: $SESSION_DIR/caption.md
```
```

Replace with:
```
Report to user:
```
✓ /make-carousel complete
Folder: $SESSION_DIR
Slides: $SESSION_DIR/1.png … N.png
Caption: $SESSION_DIR/caption.md
[if --auto-publish was set] Published: $AUTO_PUBLISH
```
```

- [ ] **Step 4: Verify the file looks correct**

Run: `grep -n "auto-publish\|Stage 6\|AUTO_PUBLISH" .claude/commands/make-carousel.md`

Expected: at least 4 matching lines.

- [ ] **Step 5: Commit**

```bash
git add .claude/commands/make-carousel.md
git commit -m "feat: add --auto-publish flag and Stage 6 publish step to make-carousel"
```

---

### Task 7: Create /publish slash command

**Files:**
- Create: `.claude/commands/publish.md`

- [ ] **Step 1: Create the command file**

```markdown
---
description: Publish a previously generated session to Instagram, LinkedIn, or all platforms.
argument-hint: '"<partial-name-or-path>" --platform instagram|linkedin|all'
allowed-tools: Bash, Read
---

# /publish Command

Publish a finished reel or carousel session to social platforms.

## 1. Resolve Session Directory

Parse `$ARGUMENTS`:
- Extract everything before `--platform` as `$INPUT` (strip surrounding quotes)
- Extract value after `--platform` as `$PLATFORM` (default: `all` if not provided)

**Path resolution:**
- If `$INPUT` starts with `/`, `./`, or `vault/` → treat as a direct path. Set `SESSION_DIR="$INPUT"`. Skip search.
- Otherwise → search for folders whose names contain `$INPUT` (case-insensitive):

```bash
find vault/outputs/reels vault/outputs/carousels -maxdepth 1 -type d \
  | grep -i "$INPUT" \
  | sort -t'-' -k1,3
```

**Match handling:**
- 0 matches → `[ERROR] No session found matching '$INPUT'` — stop.
- 1 match → set `SESSION_DIR` to that path, proceed.
- 2+ matches → list them numbered with full path and last-modified timestamp:

```bash
i=1
while IFS= read -r dir; do
  echo "$i) $dir  (modified: $(stat -f '%Sm' -t '%Y-%m-%d %H:%M' "$dir"))"
  i=$((i+1))
done <<< "$MATCHES"
```

Ask: "Multiple sessions match. Enter the number of the session to publish:"
Wait for user input. Use the selected path as `SESSION_DIR`.

## 2. Publish

```bash
python3 scripts/publish.py \
  --session-dir "$SESSION_DIR" \
  --platform "$PLATFORM"
```

## 3. Report Result

Report inline: show the publish summary printed by `publish.py`. No additional output needed.
```

- [ ] **Step 2: Verify the file was created**

Run: `cat .claude/commands/publish.md | head -10`

Expected: frontmatter with description and argument-hint.

- [ ] **Step 3: Commit**

```bash
git add .claude/commands/publish.md
git commit -m "feat: add /publish slash command"
```

---

### Task 8: Create /add-platform slash command

**Files:**
- Create: `.claude/commands/add-platform.md`

- [ ] **Step 1: Create the command file**

```markdown
---
description: Scaffold a new social platform handler in scripts/publish.py without touching any other file.
argument-hint: "<platform-name> [--types reel|carousel|both]"
allowed-tools: Bash, Read, Edit
---

# /add-platform Command

Add a new platform to the publish registry by discovering Composio slugs and scaffolding handler functions.

## 1. Parse Arguments

Parse `$ARGUMENTS`:
- `$PLATFORM_NAME` — everything before any `--` flags (required, lowercase it)
- `--types reel|carousel|both` — default `both`

## 2. Discover Composio Slugs

```bash
composio search "post $PLATFORM_NAME video"
composio search "post $PLATFORM_NAME images carousel"
```

For each discovered slug, inspect its schema:

```bash
composio execute <SLUG> --get-schema
```

Note the required parameters for each slug.

If no slugs are found for the platform, report:
```
[WARN] No Composio tools found for '<platform-name>'. Check 'composio search "<platform-name>"' manually.
```
And stop.

## 3. Scaffold Handler Functions in scripts/publish.py

Read `scripts/publish.py`. Add new handler functions using the real slug names and parameter names discovered in Step 2.

Handler function template (adapt parameter names from the schema):

```python
def _<platform>_reel(session_dir: Path, caption: str, config: dict) -> dict:
    return _composio_call(
        slug="<DISCOVERED_REEL_SLUG>",
        payload={
            "<param_from_schema>": str(session_dir / "final.mp4"),
            "<caption_param>": caption,
        },
    )

def _<platform>_carousel(session_dir: Path, caption: str, config: dict) -> dict:
    image_paths = sorted(str(p) for p in session_dir.glob("*.png") if p.name[0].isdigit())
    return _composio_call(
        slug="<DISCOVERED_CAROUSEL_SLUG>",
        payload={
            "<image_param>": image_paths,
            "<caption_param>": caption,
        },
    )
```

Add the new entry to `PLATFORM_REGISTRY`:

```python
"<platform>": {
    "reel": _<platform>_reel,       # omit if --types carousel
    "carousel": _<platform>_carousel, # omit if --types reel
},
```

Only add handler types matching `--types`. If `--types reel`, only add the reel handler (and only `"reel"` key in registry). If `--types carousel`, only carousel. If `--types both` (default), add both.

## 4. Report

```
✓ Added <platform> handlers to PLATFORM_REGISTRY
Connect your account: composio link <platform>
Then test with: /publish "session-name" --platform <platform> --dry-run
```
```

- [ ] **Step 2: Verify the file was created**

Run: `cat .claude/commands/add-platform.md | head -10`

Expected: frontmatter with description and argument-hint.

- [ ] **Step 3: Commit**

```bash
git add .claude/commands/add-platform.md
git commit -m "feat: add /add-platform slash command for scaffolding new platform handlers"
```

---

### Task 9: Final verification

**Files:** none new

- [ ] **Step 1: Run full test suite**

```bash
python3 -m pytest tests/ -v 2>&1 | tail -30
```

Expected: all tests pass including the new `test_publish.py` tests.

- [ ] **Step 2: Smoke-test the CLI interface (dry-run, no real Composio needed)**

Create a minimal fake session to dry-run:

```bash
mkdir -p /tmp/test-session-publish
touch /tmp/test-session-publish/final.mp4
cat > /tmp/test-session-publish/caption.md << 'EOF'
# Caption

## Post Caption

This is a test hook line.

→ Value point one

#hashtag1 #hashtag2

---

## Script Reference

Test script
EOF

python3 scripts/publish.py \
  --session-dir /tmp/test-session-publish \
  --platform instagram \
  --dry-run
```

Expected output:
```
[DRY-RUN] Would publish reel to instagram from /tmp/test-session-publish

── Publish Summary ──
  instagram: [DRY-RUN] would publish
```

- [ ] **Step 3: Verify file structure is complete**

```bash
ls -la scripts/publish.py vault/publish-config.md \
  .claude/commands/publish.md .claude/commands/add-platform.md \
  tests/test_publish.py
grep -n "auto-publish" .claude/commands/make-reel.md
grep -n "auto-publish" .claude/commands/make-carousel.md
```

Expected: all 5 new files present, both command files show `auto-publish` references.

- [ ] **Step 4: Clean up temp session**

```bash
rm -rf /tmp/test-session-publish
```

---

## Self-Review Against Spec

**Spec requirement → plan task mapping:**

| Requirement | Task |
|-------------|------|
| `--auto-publish` flag on `make-reel` | Task 5 |
| `--auto-publish` flag on `make-carousel` | Task 6 |
| `/publish` standalone command | Task 7 |
| Email notification after successful publish | Task 3 (\_send_email in publish.py) |
| `notify_enabled` flag off by default if missing | Task 3 (load_config returns {} → email skipped) |
| `/add-platform` scaffolding command | Task 8 |
| Never touch existing pipeline stages | Tasks 5/6 only append Stage 6 |
| Platform registry pattern | Task 3 |
| Content type detection (reel/carousel/ambiguous/empty) | Task 3 |
| Caption extraction from both formats | Task 3 |
| `--dry-run` flag | Task 3 |
| Per-platform failure continues others | Task 3 (try/except in publish loop) |
| Hard fails for: missing session, ambiguous, no asset, missing caption | Task 3 |
| Composio not on PATH → hard fail with install hint | Task 3 (_check_composio) |
| `vault/publish-config.md` missing → warn + skip email | Task 3 (load_config) |
| Unit tests covering all spec-listed scenarios | Task 2 |

**Placeholder scan:** None found. All steps include actual code.

**Type consistency check:** `detect_content_type` returns `"reel"` or `"carousel"` (str) — used as key in `PLATFORM_REGISTRY[p][content_type]` in Task 3. `resolve_platforms` returns `list[str]` — iterated in the publish loop. `extract_caption` returns `str` — passed as `caption` to handlers. All consistent.
