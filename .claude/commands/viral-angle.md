---
description: Generate format-specific content angles using the Contrast Formula — scored and persisted to vault/library/angles/.
argument-hint: "<topic-or-url> [--format shortform|longform|linkedin|carousel|post|all] [--count 5]"
allowed-tools: Bash, Read, Write, WebFetch, WebSearch
---

# /viral-angle — Contrast Formula Angle Engine

Generate high-contrast content angles from a topic or URL. Each angle contains a common belief → surprising truth contrast, mapped to a content pillar, scored, and saved as an Obsidian-friendly markdown file.

## 0. Parse Arguments

Parse `$ARGUMENTS`:
- `<topic-or-url>` — everything before any `--` flags (required)
- `--format` — one of: `shortform`, `longform`, `linkedin`, `carousel`, `post`, `all`. Default: from config
- `--count N` — angles per format. Default: from config

If `--format all`, set FORMAT_LIST to `["shortform", "longform", "linkedin", "carousel", "post"]`.
Otherwise, set FORMAT_LIST to a single-element list with the specified format.

**Load config:**
```bash
python3 -c "
from scripts.config import load_config
import json
config = load_config('viral_angle')
print(json.dumps(config))
"
```

Use config values as defaults:
- `--format` overrides `config.format` (default from config)
- `--count` overrides `config.count` (default from config)

## 1. Load Vault Context

Read these vault modules. For each missing file, print a warning and continue — never block.

```bash
VAULT_DIR="$(pwd)/vault"
for MODULE in niche pillars audience competitors strategy; do
  MODULE_PATH="$VAULT_DIR/brand/modules/${MODULE}.md"
  if [ -f "$MODULE_PATH" ]; then
    echo "✓ Loaded: $MODULE"
  else
    echo "[WARN] $MODULE not found — scoring will use defaults"
  fi
done
```

**Defaults when modules are absent:**
- No `pillars.md` → `pillar_relevance` = 0.5 (neutral)
- No `audience.md` → `blocker_match` = 0.0 (no boost)
- No `strategy.md` → all hook preference weights = 1.0 (uniform)
- No `competitors.md` or empty arrays → competitor differentiation skipped

## 2. Research

**If input starts with `http`:**
- Use `WebFetch` to fetch the URL
- Extract key claims, stats, mechanisms, visual ideas
- Hold research context in memory (do not write a file)

**If input is a topic string:**
- Use `WebSearch` for top 3–5 results
- Use `WebFetch` on the 2 most relevant URLs
- Synthesize into research context

## 3. Generate Angles

For each format in FORMAT_LIST, generate `--count` angles. Each angle MUST contain:

| Field | Required | Description |
|-------|----------|-------------|
| `topic` | yes | The input topic |
| `format` | yes | shortform / longform / linkedin / carousel / post |
| `pillar` | yes | Which content pillar this maps to (from pillars.md, or "General" if no pillars) |
| `contrast.common_belief` | yes | What most people think (the A) |
| `contrast.surprising_truth` | yes | The reframe (the B) |
| `contrast.strength` | yes | mild / moderate / strong / extreme |
| `hook_pattern` | yes | One of: contradiction, specificity, timeframe_tension, curiosity_gap, vulnerable_confession, pattern_interrupt, pov_as_advice |
| `content_job` | yes | build_trust / demonstrate_capability / drive_action |
| `blocker_targeted` | no | Which audience blocker this addresses (null if none) |
| `cta_direction` | yes | follow / lead_magnet / comment_keyword / dm / link |
| `one_liner` | yes | The angle as a single compelling sentence |
| `talking_points` | yes | 3–5 bullet points expanding the angle |
| `image_concept` | post only | Description of the ideal image (for GPT-image-2) |

**Format-specific rules:**
- `shortform`: compressible to 15–60s; visual-first, one core insight
- `longform`: supports 8–15 min; needs a mechanism to explain, not just a claim
- `linkedin`: text-native; story arc or contrarian take; professional framing
- `carousel`: decompose into 5–6 sequential beats (hook → value → CTA); each beat = one slide
- `post`: one striking visual concept + one key message; MUST include `image_concept`

**Aim for `moderate` to `strong` contrast.** Use `extreme` sparingly — max 1 per format batch.

**Distribute hook patterns** — use at least 3 distinct patterns per format batch. Favor patterns with higher weights in strategy.md.

## 4. Score & Rank

Score each angle:

```
angle_score = contrast_strength_score × 0.35
            + pillar_relevance × 0.25
            + blocker_match × 0.20
            + hook_preference_weight × 0.20
```

Where:
- contrast_strength_score: mild=0.4, moderate=0.7, strong=0.9, extreme=1.0
- pillar_relevance: 1.0 if topic matches a pillar, 0.5 if adjacent, 0.2 if no match
- blocker_match: 1.0 if angle targets an audience blocker, 0.0 if not
- hook_preference_weight: from strategy.md `hook_preferences.<pattern>` value for this angle's hook_pattern. Normalize: divide the raw weight (0.0–2.0) by 2.0 to get a 0–1 value. If strategy.md is missing, use 0.5 (= 1.0 / 2.0)

Mark the top angle per format as `recommended: true`.

## 5. Persist

Create the library directory:

```bash
mkdir -p "$(pwd)/vault/library/angles"
```

Write each angle as a separate markdown file:

```
vault/library/angles/<YYYY-MM-DD>-<topic-slug>-<format>-<NN>.md
```

Slug rules: lowercase input, replace non-alphanumeric with hyphens, truncate to 40 chars. NN is zero-padded (01, 02, ...).

**Angle file format:**

```markdown
---
type: angle
topic: "<topic>"
format: <format>
pillar: "<pillar name>"
contrast:
  common_belief: "<A>"
  surprising_truth: "<B>"
  strength: <mild|moderate|strong|extreme>
hook_pattern: <pattern>
content_job: <build_trust|demonstrate_capability|drive_action>
blocker_targeted: "<blocker text or null>"
cta_direction: <follow|lead_magnet|comment_keyword|dm|link>
score: <0.00-1.00>
status: draft
created: <YYYY-MM-DD>
---

## Angle

<The angle as a compelling 2-4 sentence paragraph>

## Talking Points

- <point 1>
- <point 2>
- <point 3>
- <point 4>
- <point 5>
```

For `post` format, add `image_concept: "<description>"` to the frontmatter.

## 6. Display

Present all angles to the user, grouped by format, ranked by score:

```
## shortform (5 angles)

⭐ #1 — contradiction | strong | 0.87
   "AI will replace junior developers — except it's doing the opposite"
   Pillar: Myth Busting | Job: build_trust
   → vault/library/angles/2026-05-06-ai-agents-shortform-01.md

#2 — specificity | moderate | 0.74
   "I mass-produced 847 images in 12 minutes with this one tool"
   ...
```

## 7. Done

```
✓ /viral-angle complete
Topic: <topic>
Formats: <format list>
Angles generated: <total count>
Saved to: vault/library/angles/
```
