# Content Registry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a master content registry that tracks every generated post/carousel/reel with status, virality score, and publish state — backed by a JSON file and importable Python module.

**Architecture:** `scripts/registry.py` is both an importable module (used by `publish.py` and `/make-*` skills) and a CLI tool. It reads/writes `vault/content-registry.json` (a plain JSON array). Each `/make-*` skill appends an entry at generation time; `/publish` updates it after publishing. An Obsidian Dataview dashboard renders the registry as a live table.

**Tech Stack:** Python 3.12, pytest, JSON, Obsidian Dataview JS

---

## File Map

| Action | Path | Responsibility |
|--------|------|---------------|
| Create | `scripts/registry.py` | Registry class (add/update/get/list), virality scorer, CLI |
| Create | `tests/test_registry.py` | Unit tests for all registry operations |
| Create | `vault/content-registry.json` | Seed data (3 existing sessions) |
| Create | `vault/content-dashboard.md` | Obsidian Dataview JS table |
| Modify | `scripts/publish.py:290-331` | Import registry, call `update()` after publish |
| Modify | `.claude/commands/make-post.md:213-239` | Add registry.add() call after pipeline-log |
| Modify | `.claude/commands/make-carousel.md:218-243` | Add registry.add() call after pipeline-log |
| Modify | `.claude/commands/make-reel.md:262-281` | Add registry.add() call after pipeline-log |

---

### Task 1: Registry Core — add, get, list

**Files:**
- Create: `scripts/registry.py`
- Create: `tests/test_registry.py`

- [ ] **Step 1: Write failing tests for Registry.add and Registry.get**

```python
# tests/test_registry.py
import json
import pytest
from scripts.registry import Registry


def _sample_entry(**overrides):
    base = {
        "id": "2026-05-06-test-post",
        "type": "post",
        "topic": "Test topic",
        "source_url": None,
        "platforms": ["instagram"],
        "status": "draft",
        "virality_score": None,
        "created_at": "2026-05-06T12:00:00Z",
        "scheduled_at": None,
        "published_at": {},
        "published_urls": {},
        "session_dir": "vault/outputs/posts/2026-05-06-test-post",
        "tags": [],
    }
    base.update(overrides)
    return base


def test_add_creates_file_and_stores_entry(tmp_path):
    reg = Registry(tmp_path / "registry.json")
    entry = _sample_entry()
    reg.add(entry)
    assert (tmp_path / "registry.json").exists()
    data = json.loads((tmp_path / "registry.json").read_text())
    assert len(data) == 1
    assert data[0]["id"] == "2026-05-06-test-post"


def test_add_appends_to_existing(tmp_path):
    reg = Registry(tmp_path / "registry.json")
    reg.add(_sample_entry(id="post-1"))
    reg.add(_sample_entry(id="post-2"))
    data = json.loads((tmp_path / "registry.json").read_text())
    assert len(data) == 2


def test_add_duplicate_id_raises(tmp_path):
    reg = Registry(tmp_path / "registry.json")
    reg.add(_sample_entry(id="post-1"))
    with pytest.raises(ValueError, match="already exists"):
        reg.add(_sample_entry(id="post-1"))


def test_get_returns_entry_by_id(tmp_path):
    reg = Registry(tmp_path / "registry.json")
    reg.add(_sample_entry(id="post-1", topic="First"))
    result = reg.get("post-1")
    assert result is not None
    assert result["topic"] == "First"


def test_get_returns_none_for_missing(tmp_path):
    reg = Registry(tmp_path / "registry.json")
    reg.add(_sample_entry(id="post-1"))
    assert reg.get("nonexistent") is None


def test_get_on_empty_registry(tmp_path):
    reg = Registry(tmp_path / "registry.json")
    assert reg.get("anything") is None
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/shivendrasoni/personal/content_creation && python3 -m pytest tests/test_registry.py -v
```

Expected: `ModuleNotFoundError: No module named 'scripts.registry'`

- [ ] **Step 3: Implement Registry class with add and get**

```python
# scripts/registry.py
#!/usr/bin/env python3
import json
from pathlib import Path


class Registry:
    def __init__(self, path: str | Path = "vault/content-registry.json"):
        self.path = Path(path)

    def _load(self) -> list[dict]:
        if not self.path.exists():
            return []
        return json.loads(self.path.read_text())

    def _save(self, entries: list[dict]) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(json.dumps(entries, indent=2, ensure_ascii=False) + "\n")

    def add(self, entry: dict) -> None:
        entries = self._load()
        if any(e["id"] == entry["id"] for e in entries):
            raise ValueError(f"Entry '{entry['id']}' already exists in registry")
        entries.append(entry)
        self._save(entries)

    def get(self, entry_id: str) -> dict | None:
        for e in self._load():
            if e["id"] == entry_id:
                return e
        return None
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/shivendrasoni/personal/content_creation && python3 -m pytest tests/test_registry.py -v
```

Expected: All 6 tests PASS

- [ ] **Step 5: Write failing tests for Registry.list**

Add to `tests/test_registry.py`:

```python
def test_list_returns_all_when_no_filters(tmp_path):
    reg = Registry(tmp_path / "registry.json")
    reg.add(_sample_entry(id="post-1"))
    reg.add(_sample_entry(id="post-2"))
    assert len(reg.list()) == 2


def test_list_filters_by_status(tmp_path):
    reg = Registry(tmp_path / "registry.json")
    reg.add(_sample_entry(id="post-1", status="draft"))
    reg.add(_sample_entry(id="post-2", status="published"))
    results = reg.list(status="draft")
    assert len(results) == 1
    assert results[0]["id"] == "post-1"


def test_list_filters_by_type(tmp_path):
    reg = Registry(tmp_path / "registry.json")
    reg.add(_sample_entry(id="post-1", type="post"))
    reg.add(_sample_entry(id="carousel-1", type="carousel"))
    results = reg.list(type="carousel")
    assert len(results) == 1
    assert results[0]["id"] == "carousel-1"


def test_list_filters_by_platform(tmp_path):
    reg = Registry(tmp_path / "registry.json")
    reg.add(_sample_entry(id="post-1", platforms=["instagram"]))
    reg.add(_sample_entry(id="post-2", platforms=["instagram", "linkedin"]))
    results = reg.list(platform="linkedin")
    assert len(results) == 1
    assert results[0]["id"] == "post-2"


def test_list_combines_filters(tmp_path):
    reg = Registry(tmp_path / "registry.json")
    reg.add(_sample_entry(id="post-1", type="post", status="draft"))
    reg.add(_sample_entry(id="carousel-1", type="carousel", status="draft"))
    reg.add(_sample_entry(id="post-2", type="post", status="published"))
    results = reg.list(type="post", status="draft")
    assert len(results) == 1
    assert results[0]["id"] == "post-1"


def test_list_empty_registry(tmp_path):
    reg = Registry(tmp_path / "registry.json")
    assert reg.list() == []
```

- [ ] **Step 6: Run tests to verify new ones fail**

```bash
cd /Users/shivendrasoni/personal/content_creation && python3 -m pytest tests/test_registry.py -v -k "test_list"
```

Expected: FAIL — `Registry` has no `list` method

- [ ] **Step 7: Implement Registry.list**

Add to `Registry` class in `scripts/registry.py`:

```python
    def list(self, **filters) -> list[dict]:
        entries = self._load()
        for key, value in filters.items():
            if key == "platform":
                entries = [e for e in entries if value in e.get("platforms", [])]
            else:
                entries = [e for e in entries if e.get(key) == value]
        return entries
```

- [ ] **Step 8: Run all tests to verify they pass**

```bash
cd /Users/shivendrasoni/personal/content_creation && python3 -m pytest tests/test_registry.py -v
```

Expected: All 12 tests PASS

- [ ] **Step 9: Commit**

```bash
git add scripts/registry.py tests/test_registry.py
git commit -m "feat(registry): add Registry class with add, get, list operations"
```

---

### Task 2: Registry Core — update

**Files:**
- Modify: `scripts/registry.py`
- Modify: `tests/test_registry.py`

- [ ] **Step 1: Write failing tests for Registry.update**

Add to `tests/test_registry.py`:

```python
def test_update_changes_status(tmp_path):
    reg = Registry(tmp_path / "registry.json")
    reg.add(_sample_entry(id="post-1", status="draft"))
    reg.update("post-1", {"status": "published"})
    assert reg.get("post-1")["status"] == "published"


def test_update_merges_published_at(tmp_path):
    reg = Registry(tmp_path / "registry.json")
    reg.add(_sample_entry(id="post-1", published_at={}))
    reg.update("post-1", {
        "published_at": {"instagram": "2026-05-06T18:00:00Z"},
        "published_urls": {"instagram": "https://instagram.com/p/123"},
    })
    result = reg.get("post-1")
    assert result["published_at"]["instagram"] == "2026-05-06T18:00:00Z"
    assert result["published_urls"]["instagram"] == "https://instagram.com/p/123"


def test_update_nonexistent_raises(tmp_path):
    reg = Registry(tmp_path / "registry.json")
    reg.add(_sample_entry(id="post-1"))
    with pytest.raises(KeyError, match="not found"):
        reg.update("nonexistent", {"status": "published"})


def test_update_preserves_other_fields(tmp_path):
    reg = Registry(tmp_path / "registry.json")
    reg.add(_sample_entry(id="post-1", topic="Original topic", status="draft"))
    reg.update("post-1", {"status": "scheduled"})
    result = reg.get("post-1")
    assert result["topic"] == "Original topic"
    assert result["status"] == "scheduled"
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/shivendrasoni/personal/content_creation && python3 -m pytest tests/test_registry.py -v -k "test_update"
```

Expected: FAIL — `Registry` has no `update` method

- [ ] **Step 3: Implement Registry.update**

Add to `Registry` class in `scripts/registry.py`:

```python
    def update(self, entry_id: str, fields: dict) -> None:
        entries = self._load()
        for entry in entries:
            if entry["id"] == entry_id:
                entry.update(fields)
                self._save(entries)
                return
        raise KeyError(f"Entry '{entry_id}' not found in registry")
```

- [ ] **Step 4: Run all tests to verify they pass**

```bash
cd /Users/shivendrasoni/personal/content_creation && python3 -m pytest tests/test_registry.py -v
```

Expected: All 16 tests PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/registry.py tests/test_registry.py
git commit -m "feat(registry): add update method for partial entry updates"
```

---

### Task 3: Virality Score Heuristic

**Files:**
- Modify: `scripts/registry.py`
- Modify: `tests/test_registry.py`

- [ ] **Step 1: Write failing tests for compute_virality_score**

Add to `tests/test_registry.py`:

```python
from scripts.registry import compute_virality_score


def test_score_returns_float():
    entry = _sample_entry(type="post", platforms=["instagram"])
    score = compute_virality_score(entry)
    assert isinstance(score, float)


def test_score_between_0_and_10():
    entry = _sample_entry(type="post", platforms=["instagram"])
    score = compute_virality_score(entry)
    assert 0.0 <= score <= 10.0


def test_score_reel_higher_than_post():
    post = _sample_entry(type="post", platforms=["instagram"])
    reel = _sample_entry(type="reel", platforms=["instagram"])
    assert compute_virality_score(reel) > compute_virality_score(post)


def test_score_carousel_higher_than_post():
    post = _sample_entry(type="post", platforms=["instagram"])
    carousel = _sample_entry(type="carousel", platforms=["instagram"])
    assert compute_virality_score(carousel) > compute_virality_score(post)


def test_score_multi_platform_bonus():
    single = _sample_entry(platforms=["instagram"])
    multi = _sample_entry(platforms=["instagram", "linkedin"])
    assert compute_virality_score(multi) > compute_virality_score(single)


def test_score_brand_loaded_bonus():
    without = compute_virality_score(_sample_entry(), brand_loaded=False)
    with_brand = compute_virality_score(_sample_entry(), brand_loaded=True)
    assert with_brand > without


def test_score_hook_strength_bonus():
    no_hook = compute_virality_score(_sample_entry(), hook_text="here is some info")
    strong_hook = compute_virality_score(_sample_entry(), hook_text="Stop doing this. Here's what nobody tells you about AI.")
    assert strong_hook > no_hook


def test_score_cta_bonus():
    no_cta = compute_virality_score(_sample_entry(), hook_text="plain text")
    with_cta = compute_virality_score(_sample_entry(), hook_text="Comment AGENT below and I'll DM you the guide")
    assert with_cta > no_cta


def test_score_max_signals_does_not_exceed_10():
    entry = _sample_entry(type="reel", platforms=["instagram", "linkedin", "x"])
    score = compute_virality_score(
        entry,
        hook_text="Stop doing this. Nobody tells you the truth. Comment below for the free guide.",
        brand_loaded=True,
    )
    assert score <= 10.0
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/shivendrasoni/personal/content_creation && python3 -m pytest tests/test_registry.py -v -k "test_score"
```

Expected: FAIL — `cannot import name 'compute_virality_score'`

- [ ] **Step 3: Implement compute_virality_score**

Add to `scripts/registry.py` (outside the class):

```python
import re


HOOK_PATTERNS = [
    r"(?i)\bstop\b.*\b(doing|trying|using)\b",
    r"(?i)\bnobody\b.*\btells?\b",
    r"(?i)\bhere'?s?\s+(the\s+)?(truth|what|why)\b",
    r"(?i)\byou'?re\b.*\bwrong\b",
    r"(?i)\bforget\b.*\beverything\b",
    r"(?i)\bthis\s+(changed|broke|blew)\b",
    r"(?i)\bI\s+(was|used\s+to)\b.*\buntil\b",
]

CTA_PATTERNS = [
    r"(?i)\bcomment\b",
    r"(?i)\bDM\b",
    r"(?i)\bfollow\b",
    r"(?i)\blink\s+in\s+bio\b",
    r"(?i)\bsave\s+this\b",
    r"(?i)\bshare\s+this\b",
    r"(?i)\btag\s+(a\s+friend|someone)\b",
]

TYPE_MULTIPLIERS = {"reel": 1.5, "carousel": 1.2, "post": 1.0}
MAX_RAW = 3.0 + 2.0 + 1.5 + 1.0 + 0.5 + 0.5  # 8.5


def compute_virality_score(
    entry: dict,
    hook_text: str = "",
    brand_loaded: bool = False,
) -> float:
    raw = 0.0

    hook_matches = sum(1 for p in HOOK_PATTERNS if re.search(p, hook_text))
    raw += min(hook_matches / len(HOOK_PATTERNS) * 3.0, 3.0)

    content_type = entry.get("type", "post")
    raw += TYPE_MULTIPLIERS.get(content_type, 1.0)

    if brand_loaded:
        raw += 1.0

    cta_matches = sum(1 for p in CTA_PATTERNS if re.search(p, hook_text))
    if cta_matches > 0:
        raw += 0.5

    if len(entry.get("platforms", [])) >= 2:
        raw += 0.5

    return round(min(raw / MAX_RAW * 10.0, 10.0), 1)
```

- [ ] **Step 4: Run all tests to verify they pass**

```bash
cd /Users/shivendrasoni/personal/content_creation && python3 -m pytest tests/test_registry.py -v
```

Expected: All 25 tests PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/registry.py tests/test_registry.py
git commit -m "feat(registry): add virality score heuristic with hook/CTA/type signals"
```

---

### Task 4: CLI Interface

**Files:**
- Modify: `scripts/registry.py`
- Modify: `tests/test_registry.py`

- [ ] **Step 1: Write failing tests for CLI**

Add to `tests/test_registry.py`:

```python
import subprocess
import sys


def test_cli_list_outputs_json(tmp_path):
    reg = Registry(tmp_path / "registry.json")
    reg.add(_sample_entry(id="post-1"))
    result = subprocess.run(
        [sys.executable, "scripts/registry.py", "list", "--registry", str(tmp_path / "registry.json")],
        capture_output=True, text=True,
        cwd="/Users/shivendrasoni/personal/content_creation",
    )
    assert result.returncode == 0
    data = json.loads(result.stdout)
    assert len(data) == 1


def test_cli_list_with_status_filter(tmp_path):
    reg = Registry(tmp_path / "registry.json")
    reg.add(_sample_entry(id="post-1", status="draft"))
    reg.add(_sample_entry(id="post-2", status="published"))
    result = subprocess.run(
        [sys.executable, "scripts/registry.py", "list",
         "--registry", str(tmp_path / "registry.json"),
         "--status", "draft"],
        capture_output=True, text=True,
        cwd="/Users/shivendrasoni/personal/content_creation",
    )
    assert result.returncode == 0
    data = json.loads(result.stdout)
    assert len(data) == 1
    assert data[0]["id"] == "post-1"


def test_cli_get_outputs_entry(tmp_path):
    reg = Registry(tmp_path / "registry.json")
    reg.add(_sample_entry(id="post-1", topic="My topic"))
    result = subprocess.run(
        [sys.executable, "scripts/registry.py", "get",
         "--registry", str(tmp_path / "registry.json"),
         "--id", "post-1"],
        capture_output=True, text=True,
        cwd="/Users/shivendrasoni/personal/content_creation",
    )
    assert result.returncode == 0
    data = json.loads(result.stdout)
    assert data["topic"] == "My topic"


def test_cli_get_missing_exits_1(tmp_path):
    reg = Registry(tmp_path / "registry.json")
    reg.add(_sample_entry(id="post-1"))
    result = subprocess.run(
        [sys.executable, "scripts/registry.py", "get",
         "--registry", str(tmp_path / "registry.json"),
         "--id", "nonexistent"],
        capture_output=True, text=True,
        cwd="/Users/shivendrasoni/personal/content_creation",
    )
    assert result.returncode == 1
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/shivendrasoni/personal/content_creation && python3 -m pytest tests/test_registry.py -v -k "test_cli"
```

Expected: FAIL — script runs but no CLI entrypoint, exits with error

- [ ] **Step 3: Implement CLI entrypoint**

Add to `scripts/registry.py`:

```python
import argparse
import sys


def main() -> None:
    parser = argparse.ArgumentParser(description="Content registry CLI")
    parser.add_argument("--registry", default="vault/content-registry.json", help="Path to registry JSON")
    sub = parser.add_subparsers(dest="command")

    list_p = sub.add_parser("list")
    list_p.add_argument("--status", help="Filter by status")
    list_p.add_argument("--type", help="Filter by content type")
    list_p.add_argument("--platform", help="Filter by platform")

    get_p = sub.add_parser("get")
    get_p.add_argument("--id", required=True, help="Entry ID")

    update_p = sub.add_parser("update")
    update_p.add_argument("--id", required=True, help="Entry ID")
    update_p.add_argument("--status", help="New status")
    update_p.add_argument("--scheduled-at", help="Scheduled datetime")

    args = parser.parse_args()
    reg = Registry(args.registry)

    if args.command == "list":
        filters = {}
        if args.status:
            filters["status"] = args.status
        if args.type:
            filters["type"] = args.type
        if args.platform:
            filters["platform"] = args.platform
        print(json.dumps(reg.list(**filters), indent=2))

    elif args.command == "get":
        entry = reg.get(args.id)
        if entry is None:
            print(f"Entry '{args.id}' not found", file=sys.stderr)
            sys.exit(1)
        print(json.dumps(entry, indent=2))

    elif args.command == "update":
        fields = {}
        if args.status:
            fields["status"] = args.status
        if args.scheduled_at:
            fields["scheduled_at"] = args.scheduled_at
        reg.update(args.id, fields)
        print(json.dumps(reg.get(args.id), indent=2))

    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Run all tests to verify they pass**

```bash
cd /Users/shivendrasoni/personal/content_creation && python3 -m pytest tests/test_registry.py -v
```

Expected: All 29 tests PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/registry.py tests/test_registry.py
git commit -m "feat(registry): add CLI interface for list, get, update commands"
```

---

### Task 5: Seed Data & Obsidian Dashboard

**Files:**
- Create: `vault/content-registry.json`
- Create: `vault/content-dashboard.md`

- [ ] **Step 1: Create seed data file**

Write `vault/content-registry.json` with the 3 existing sessions from `pipeline-log.md`:

```json
[
  {
    "id": "2026-05-05-stop-trying-to-be-creative-just-see-what",
    "type": "carousel",
    "topic": "Stop trying to be creative. Just see whats going viral and repurpose it.",
    "source_url": null,
    "platforms": ["instagram"],
    "status": "draft",
    "virality_score": null,
    "created_at": "2026-05-05T02:24:00Z",
    "scheduled_at": null,
    "published_at": {},
    "published_urls": {},
    "session_dir": "vault/outputs/carousels/2026-05-05-stop-trying-to-be-creative-just-see-what",
    "tags": []
  },
  {
    "id": "2026-05-05-url",
    "type": "carousel",
    "topic": "https://addyosmani.com/blog/agent-harness-engineering/",
    "source_url": "https://addyosmani.com/blog/agent-harness-engineering/",
    "platforms": ["instagram"],
    "status": "draft",
    "virality_score": null,
    "created_at": "2026-05-05T04:51:00Z",
    "scheduled_at": null,
    "published_at": {},
    "published_urls": {},
    "session_dir": "vault/outputs/carousels/2026-05-05-url",
    "tags": []
  },
  {
    "id": "2026-05-06-openai-age-predictor",
    "type": "post",
    "topic": "https://www.educative.io/newsletter/artificial-intelligence/openai-age-predictor",
    "source_url": "https://www.educative.io/newsletter/artificial-intelligence/openai-age-predictor",
    "platforms": ["instagram", "linkedin"],
    "status": "draft",
    "virality_score": null,
    "created_at": "2026-05-06T17:28:00Z",
    "scheduled_at": null,
    "published_at": {},
    "published_urls": {},
    "session_dir": "vault/outputs/posts/2026-05-06-openai-age-predictor",
    "tags": []
  }
]
```

- [ ] **Step 2: Verify seed data loads correctly**

```bash
cd /Users/shivendrasoni/personal/content_creation && python3 scripts/registry.py list --registry vault/content-registry.json
```

Expected: JSON output with 3 entries

- [ ] **Step 3: Create Obsidian dashboard**

Write `vault/content-dashboard.md`:

````markdown
# Content Dashboard

```dataviewjs
const registry = JSON.parse(await dv.io.load("content-registry.json"))

dv.header(3, `${registry.length} pieces of content`)

dv.table(
  ["ID", "Type", "Status", "Score", "Platforms", "Created"],
  registry
    .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""))
    .map(r => [
      r.id,
      r.type,
      r.status,
      r.virality_score ?? "—",
      r.platforms.join(", "),
      r.created_at?.slice(0, 10) ?? "—"
    ])
)
```
````

- [ ] **Step 4: Commit**

```bash
git add vault/content-registry.json vault/content-dashboard.md
git commit -m "feat(registry): seed registry with existing content, add Obsidian dashboard"
```

---

### Task 6: Publish Integration

**Files:**
- Modify: `scripts/publish.py:290-331`
- Modify: `tests/test_publish.py`

- [ ] **Step 1: Write failing test for registry update after publish**

Add to `tests/test_publish.py`:

```python
def test_publish_updates_registry_on_success(tmp_path):
    from scripts.registry import Registry

    # Set up session
    session = _make_session(tmp_path, ["image.png", "image-instagram.png"])
    _make_post_caption(session)

    # Set up registry with a matching entry
    registry_path = tmp_path / "content-registry.json"
    reg = Registry(registry_path)
    reg.add({
        "id": session.name,
        "type": "post",
        "topic": "test",
        "source_url": None,
        "platforms": ["instagram"],
        "status": "draft",
        "virality_score": None,
        "created_at": "2026-05-06T12:00:00Z",
        "scheduled_at": None,
        "published_at": {},
        "published_urls": {},
        "session_dir": str(session),
        "tags": [],
    })

    config_path = tmp_path / "publish-config.md"
    config_path.write_text("---\nnotify_enabled: false\n---\n")

    with patch("scripts.publish.subprocess.run") as mock_run, \
         patch("scripts.publish.REGISTRY_PATH", registry_path):
        mock_run.return_value = MagicMock(
            returncode=0,
            stdout="https://instagram.com/p/test123",
            stderr="",
        )
        from scripts.publish import publish
        results = publish(session, "instagram", dry_run=False, config_path=config_path)

    entry = reg.get(session.name)
    assert entry["status"] == "published"
    assert "instagram" in entry["published_at"]
    assert "instagram" in entry["published_urls"]


def test_publish_skips_registry_when_entry_missing(tmp_path):
    """Publish should not crash if session has no registry entry (backward compat)."""
    session = _make_session(tmp_path, ["image.png", "image-instagram.png"])
    _make_post_caption(session)

    registry_path = tmp_path / "content-registry.json"
    registry_path.write_text("[]")

    config_path = tmp_path / "publish-config.md"
    config_path.write_text("---\nnotify_enabled: false\n---\n")

    with patch("scripts.publish.subprocess.run") as mock_run, \
         patch("scripts.publish.REGISTRY_PATH", registry_path):
        mock_run.return_value = MagicMock(returncode=0, stdout="", stderr="")
        from scripts.publish import publish
        results = publish(session, "instagram", dry_run=False, config_path=config_path)

    assert results["instagram"]["success"] is True
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/shivendrasoni/personal/content_creation && python3 -m pytest tests/test_publish.py::test_publish_updates_registry_on_success -v
```

Expected: FAIL — `REGISTRY_PATH` not defined in `publish.py`

- [ ] **Step 3: Add registry integration to publish.py**

Add import and constant near the top of `scripts/publish.py` (after existing imports):

```python
from scripts.registry import Registry

REGISTRY_PATH = Path("vault/content-registry.json")
```

Add a helper function before the `publish()` function:

```python
def _update_registry(session_dir: Path, platforms: list[str], results: dict) -> None:
    try:
        reg = Registry(REGISTRY_PATH)
        entry = reg.get(session_dir.name)
        if entry is None:
            return
        published_at = dict(entry.get("published_at") or {})
        published_urls = dict(entry.get("published_urls") or {})
        now = __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat()
        all_published = True
        for p in platforms:
            r = results.get(p, {})
            if r.get("success") and not r.get("dry_run"):
                published_at[p] = now
                if r.get("url"):
                    published_urls[p] = r["url"]
            elif not r.get("dry_run"):
                all_published = False
        target_platforms = set(entry.get("platforms", []))
        published_platforms = set(published_at.keys())
        status = "published" if target_platforms <= published_platforms else entry.get("status", "draft")
        reg.update(session_dir.name, {
            "status": status,
            "published_at": published_at,
            "published_urls": published_urls,
        })
    except Exception:
        pass
```

Add the call in the `publish()` function, right after the `_send_email` call (around line 328):

```python
    if not dry_run:
        _send_email(session_dir, platforms, results, config)
        _update_registry(session_dir, platforms, results)
```

- [ ] **Step 4: Run all publish tests to verify they pass**

```bash
cd /Users/shivendrasoni/personal/content_creation && python3 -m pytest tests/test_publish.py -v
```

Expected: All tests PASS (existing + 2 new)

- [ ] **Step 5: Commit**

```bash
git add scripts/publish.py tests/test_publish.py
git commit -m "feat(registry): update registry entry after successful publish"
```

---

### Task 7: Skill Integration — /make-post, /make-carousel, /make-reel

**Files:**
- Modify: `.claude/commands/make-post.md:213-239`
- Modify: `.claude/commands/make-carousel.md:218-243`
- Modify: `.claude/commands/make-reel.md:262-281`

These are Claude Code skill files (markdown instructions), not Python. The integration adds a bash step after each pipeline-log step that calls the registry module.

- [ ] **Step 1: Add registry step to make-post.md**

After the existing Stage 8 (Log Pipeline Run) block, before Stage 9 (Publish), add a new stage:

```markdown
## 8.5. Register Content

```bash
python3 -c "
from scripts.registry import Registry, compute_virality_score
from datetime import datetime, timezone
import json

entry = {
    'id': '$(basename $SESSION_DIR)',
    'type': 'post',
    'topic': $(python3 -c "import json; print(json.dumps('$INPUT'))"),
    'source_url': $(python3 -c "
import json
inp = '$INPUT'
print(json.dumps(inp if inp.startswith('http') else None))
"),
    'platforms': '$PLATFORM'.replace('all', 'instagram,linkedin').split(','),
    'status': 'draft',
    'virality_score': None,
    'created_at': datetime.now(timezone.utc).isoformat(),
    'scheduled_at': None,
    'published_at': {},
    'published_urls': {},
    'session_dir': '$SESSION_DIR',
    'tags': [],
}

reg = Registry()
try:
    reg.add(entry)
    print('✓ Registered in content registry')
except ValueError:
    print('⚠ Already in registry — skipping')
"
```
```

- [ ] **Step 2: Add registry step to make-carousel.md**

After the existing Stage 5.5 (Log Pipeline Run) block, before Stage 5.7 (Publish), add:

```markdown
## 5.6. Register Content

```bash
python3 -c "
from scripts.registry import Registry, compute_virality_score
from datetime import datetime, timezone
import json

entry = {
    'id': '$(basename $SESSION_DIR)',
    'type': 'carousel',
    'topic': $(python3 -c "import json; print(json.dumps('$INPUT'))"),
    'source_url': $(python3 -c "
import json
inp = '$INPUT'
print(json.dumps(inp if inp.startswith('http') else None))
"),
    'platforms': ['$PLATFORM'],
    'status': 'draft',
    'virality_score': None,
    'created_at': datetime.now(timezone.utc).isoformat(),
    'scheduled_at': None,
    'published_at': {},
    'published_urls': {},
    'session_dir': '$SESSION_DIR',
    'tags': [],
}

reg = Registry()
try:
    reg.add(entry)
    print('✓ Registered in content registry')
except ValueError:
    print('⚠ Already in registry — skipping')
"
```
```

- [ ] **Step 3: Add registry step to make-reel.md**

After the existing Stage 6.5 (Log Pipeline Run) block, before Stage 6.7 (Publish), add:

```markdown
## 6.6. Register Content

```bash
python3 -c "
from scripts.registry import Registry, compute_virality_score
from datetime import datetime, timezone
import json

entry = {
    'id': '$(basename $SESSION_DIR)',
    'type': 'reel',
    'topic': $(python3 -c "import json; print(json.dumps('$TOPIC'))"),
    'source_url': $(python3 -c "
import json
inp = '$TOPIC'
print(json.dumps(inp if inp.startswith('http') else None))
"),
    'platforms': ['instagram'],
    'status': 'draft',
    'virality_score': None,
    'created_at': datetime.now(timezone.utc).isoformat(),
    'scheduled_at': None,
    'published_at': {},
    'published_urls': {},
    'session_dir': '$SESSION_DIR',
    'tags': [],
}

reg = Registry()
try:
    reg.add(entry)
    print('✓ Registered in content registry')
except ValueError:
    print('⚠ Already in registry — skipping')
"
```
```

- [ ] **Step 4: Verify no syntax errors in the skill files**

```bash
cd /Users/shivendrasoni/personal/content_creation && python3 -c "from scripts.registry import Registry, compute_virality_score; print('import ok')"
```

Expected: `import ok`

- [ ] **Step 5: Commit**

```bash
git add .claude/commands/make-post.md .claude/commands/make-carousel.md .claude/commands/make-reel.md
git commit -m "feat(registry): integrate registry.add() into make-post, make-carousel, make-reel skills"
```

---

### Task 8: Update /publish skill to search registry

**Files:**
- Modify: `.claude/commands/publish.md`

- [ ] **Step 1: Add registry query option to publish.md**

Add a new section after the header, before the existing "1. Resolve Session Directory":

```markdown
## 0. List Unpublished (if no arguments)

If `$ARGUMENTS` is empty or `--list`:

```bash
python3 scripts/registry.py list --status draft
```

Display the result as a numbered list:
```
Unpublished content:
1) 2026-05-05-stop-trying-to-be-creative-just-see-what (carousel, instagram)
2) 2026-05-05-url (carousel, instagram)
3) 2026-05-06-openai-age-predictor (post, instagram, linkedin)
```

Ask: "Enter the number of the session to publish, and the platform (instagram/linkedin/all):"
Use the selected entry's `session_dir` as `SESSION_DIR` and proceed to Step 2.

If the user provided arguments, skip this step and proceed to Step 1 as before.
```

- [ ] **Step 2: Commit**

```bash
git add .claude/commands/publish.md
git commit -m "feat(registry): add unpublished content picker to /publish skill"
```

---

### Task 9: Run Full Test Suite

- [ ] **Step 1: Run all tests**

```bash
cd /Users/shivendrasoni/personal/content_creation && python3 -m pytest tests/ -v
```

Expected: All tests PASS — no regressions in existing tests, all new registry tests green.

- [ ] **Step 2: Verify CLI works end-to-end**

```bash
cd /Users/shivendrasoni/personal/content_creation && python3 scripts/registry.py list --status draft
```

Expected: JSON array with 3 draft entries

```bash
cd /Users/shivendrasoni/personal/content_creation && python3 scripts/registry.py get --id 2026-05-06-openai-age-predictor
```

Expected: JSON object for the post entry

- [ ] **Step 3: Final commit if any cleanup needed**

```bash
git log --oneline -8
```

Verify commit history is clean and each task has its own commit.
