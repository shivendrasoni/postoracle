# Content Registry — Design Spec

## Problem

Generated content has no central tracking. Each `/make-*` command creates a session folder, and `pipeline-log.md` records a line, but there is no structured way to:

- Find unpublished content
- See publish status per platform
- Score content for virality
- Feed a future content calendar

## Solution

A master content registry (`vault/content-registry.json`) backed by an importable Python module (`scripts/registry.py`) that every pipeline writes to at generation time and `/publish` updates after publishing.

## Schema

Each entry in the JSON array:

```json
{
  "id": "2026-05-06-openai-age-predictor",
  "type": "post | carousel | reel",
  "topic": "OpenAI age predictor",
  "source_url": "https://... | null",
  "platforms": ["instagram", "linkedin"],
  "status": "draft | scheduled | published",
  "virality_score": 7.2,
  "created_at": "2026-05-06T17:28:00Z",
  "scheduled_at": null,
  "published_at": {"instagram": "2026-05-06T18:00:00Z"},
  "published_urls": {"instagram": "https://..."},
  "session_dir": "vault/outputs/posts/2026-05-06-openai-age-predictor",
  "tags": []
}
```

### Status lifecycle

```
draft → scheduled → published
draft → published  (direct publish, no scheduling)
```

## Components

### 1. `scripts/registry.py` — Module + CLI

**Class: `Registry`**

```python
Registry(path: str = "vault/content-registry.json")
  .add(entry: dict) -> None          # append new record
  .update(id: str, fields: dict) -> None  # partial update by ID
  .get(id: str) -> dict | None       # lookup by session ID
  .list(**filters) -> list[dict]     # filter by status, type, platform, date
```

**Function: `compute_virality_score`**

```python
def compute_virality_score(
    entry: dict,
    hook_text: str = "",
    brand_loaded: bool = False,
) -> float:
```

Weighted heuristic (0–10 scale):

| Signal              | Weight | Logic                                                        |
|---------------------|--------|--------------------------------------------------------------|
| Hook strength       | 3.0    | Pattern-match against proven hook formulas (contrast, curiosity gap, bold claim) |
| Topic trending      | 2.0    | Source URL from recent/trending topic (< 7 days)             |
| Content type        | 1.5    | Reel: 1.5x, Carousel: 1.2x, Post: 1.0x                     |
| Brand voice loaded  | 1.0    | +1.0 if brand modules applied                                |
| Has CTA             | 0.5    | +0.5 if caption contains call-to-action                      |
| Multi-platform      | 0.5    | +0.5 if targeting 2+ platforms                               |

Normalized to 0–10. Deliberately simple and tunable.

**CLI interface:**

```
python3 scripts/registry.py add --id <id> --type <type> --topic <topic> ...
python3 scripts/registry.py update --id <id> --status published ...
python3 scripts/registry.py list [--status draft] [--type carousel]
python3 scripts/registry.py get --id <id>
```

### 2. `vault/content-registry.json` — Data file

Plain JSON array. Read-modify-write on each operation. At the scale of hundreds of entries this is fine.

Seeded with 3 existing sessions using known data from `pipeline-log.md`. Unknown fields set to `null`.

### 3. `vault/content-dashboard.md` — Obsidian view

Dataview JS block that reads the registry JSON and renders a sortable table:

```js
const registry = JSON.parse(await dv.io.load("content-registry.json"))
dv.table(
  ["ID", "Type", "Status", "Score", "Platforms", "Created"],
  registry.map(r => [
    r.id, r.type, r.status,
    r.virality_score ?? "—",
    r.platforms.join(", "),
    r.created_at?.slice(0, 10) ?? "—"
  ])
)
```

## Integration

### `/make-post`, `/make-carousel`, `/make-reel`

At the end of each generation pipeline, after session folder is created:

1. Compute virality score from available signals
2. Call `registry.add(entry)` with full metadata

### `/publish`

After successful platform publish:

1. Call `registry.update(id, { status, published_at, published_urls })` with per-platform results

### Future: `/schedule`

Would call `registry.update(id, { status: "scheduled", scheduled_at: "..." })`. Calendar reads from the same registry.

## Seed Data

Three existing sessions, populated from `pipeline-log.md` and filesystem. Non-derivable fields set to `null`:

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

## Non-goals

- Database or external storage — JSON file is sufficient
- Real-time analytics pull — future enhancement
- Backward compatibility with `pipeline-log.md` — keep it for now, deprecate later
