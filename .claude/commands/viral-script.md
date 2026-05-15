---
description: Generate hooks and production-ready scripts from angles or topics — shortform (HEIL), longform (3P's), or LinkedIn.
argument-hint: "--angle <path> --mode shortform|longform|linkedin OR --topic '<text>' --mode shortform|longform|linkedin"
allowed-tools: Bash, Read, Write, WebFetch, WebSearch
---

# /viral-script — Hook & Script Generator

Generate scored hooks and a full production-ready script from a pre-generated angle or inline topic.

## 0. Parse Arguments

Parse `$ARGUMENTS`:
- `--angle <path>` — path to an angle file in vault/library/angles/ (mutually exclusive with --topic)
- `--topic "<text>"` — inline topic string (mutually exclusive with --angle)
- `--mode` — default from config; required if not in config. One of: `shortform`, `longform`, `linkedin`

Exactly one of `--angle` or `--topic` must be provided. If neither or both, stop:
> `[ERROR] Provide exactly one of --angle <path> or --topic "<text>"`

**Load config:**
```bash
python3 -c "
from scripts.config import load_config
import json
config = load_config('viral_script')
print(json.dumps(config))
"
```

If `--mode` was not provided as a flag, use `config.mode` as the default. Only error if neither flag nor config provides a value:
> `[ERROR] --mode is required. Choose: shortform, longform, or linkedin`

## 1. Load Context

Read vault modules (warn and continue if missing):

```bash
VAULT_DIR="$(pwd)/vault"
for MODULE in style cta strategy niche audience; do
  MODULE_PATH="$VAULT_DIR/brand/modules/${MODULE}.md"
  if [ -f "$MODULE_PATH" ]; then
    echo "✓ Loaded: $MODULE"
  else
    echo "[WARN] $MODULE not found — continuing without it"
  fi
done
```

**If `--angle` was provided:**
- Read the angle file using: `python3 -c "from scripts.parse_angle import read_angle; import json, yaml; fm, body = read_angle('$ANGLE_PATH'); print(yaml.dump(fm)); print('---'); print(body)"`
- Extract: topic, contrast (A→B), hook_pattern, talking_points, content_job, cta_direction

**If `--topic` was provided:**
- Generate a single angle inline (same logic as `/viral-angle` Phase 3, for the single format matching `--mode`)
- Use `shortform` angles for `--mode shortform`, `longform` for `--mode longform`, `linkedin` for `--mode linkedin`

## 2. Generate Hooks

Generate **10 hooks** for the angle:

**Rules:**
- All 10 hooks use vault context: style.md opener patterns + strategy.md hook preferences
- Each hook uses one of the 7 patterns: contradiction, specificity, timeframe_tension, curiosity_gap, vulnerable_confession, pattern_interrupt, pov_as_advice
- At least 5 distinct patterns must be represented across the 10 hooks
- Favor patterns with higher weights in strategy.md (if loaded)
- Every hook must be under 15 words
- Every hook must surface the angle's A→B contrast

**Score each hook:**

```
hook_score = contrast_fit × 0.40  +  pattern_strength × 0.35  +  platform_fit × 0.25
```

- contrast_fit: how well the hook surfaces the A→B contrast (0–1). Score 1.0 if both A and B are present; 0.7 if the B (surprising truth) is implied; 0.4 if only one side is present.
- pattern_strength: how cleanly the hook executes its pattern (0–1). Score 1.0 if it follows the pattern's formula exactly (e.g., "Everyone says X. Here's why that's wrong." for contradiction); 0.5 if loosely matches.
- platform_fit: how well it matches the target platform norms (0–1). Scoring by mode:
  - `shortform`: 1.0 if ≤10 words and visually verifiable; 0.7 if ≤15 words; 0.4 if longer
  - `longform`: 1.0 if sets up a mechanism/story; 0.7 if bold claim; 0.4 if too simple for 8+ min
  - `linkedin`: 1.0 if professional and text-native; 0.7 if slightly casual; 0.4 if too visual/video-oriented

**Present top 3 hooks to the user:**

```
## Top 3 Hooks

#1 (0.91) — contradiction
   "Everyone says AI replaces junior devs. The data says the opposite."

#2 (0.85) — specificity
   "Junior devs using copilots ship 40% faster with fewer bugs."

#3 (0.79) — vulnerable_confession
   "I told my junior dev to stop using AI. Worst decision I made."
```

Use #1 unless the user picks a different one.

## 3. Generate Script

### Anti-Slop Rules (apply to ALL modes — non-negotiable)

Check EVERY script line against these. If a forbidden pattern appears, rewrite it.

| Rule | Forbidden Pattern |
|------|------------------|
| No 3-word loops | "It's fast. It's easy. It's effective." |
| No rhetorical lists | "Price? High. Quality? Low." |
| No meta-commentary | "Let's dive in," "In this video," "But there's a twist." |
| No hype adjectives | "Mind-blowing," "Insane," "Game-changing" (unless technically justified) |
| No fake scenarios | "Imagine you are walking down the street..." |
| No throat-clearing | "Hey guys, welcome back," "So..." |

### Required Flow Patterns

- **The Connector:** Use "See," "Meaning," or "Therefore" to glue sentences
- **The Contrast:** "Most [X] do Y. But [This] does Z."
- **The Mechanism:** Explain *how* it works, don't just say it works

### Mode A: `--mode shortform` (HEIL Beats)

HEIL = Hook / Explain / Illustrate / Lesson

Write the script with this structure:

```markdown
## Script: [Title]

**Hook Pattern:** [pattern name]
**Duration:** [15–60s]
**Format:** shortform

### Hook (0:00–0:03)
[Selected hook — under 15 words, visually verifiable]
[Visual: description of what appears on screen]

### Beat Table

| Beat | Timecode | Type | Script | Visual Cue |
|------|----------|------|--------|------------|
| 1 | 0:00–0:03 | Hook | "..." | [Visual: ...] |
| 2 | 0:03–0:08 | Explain | "..." | [Visual: ...] |
| 3 | 0:08–0:15 | Illustrate | "..." | [Visual: ...] |
| ... | ... | ... | ... | ... |
| N | X:XX–X:XX | Lesson + CTA | "..." | [Visual: ...] |

### CTA
[From cta.md — use the platform-appropriate CTA. Fall back to default if no platform match.]

### Cross-Post Notes
- **Reels:** [adjustments]
- **Shorts:** [adjustments]
- **TikTok:** [adjustments]
```

Beat count: 5–8 beats. Each beat has type (Hook/Explain/Illustrate/Lesson), timecode, script, visual cue.

### Mode B: `--mode longform` (3P's Intro + Filming Cards)

3P's = Proof / Promise / Plan

Write the script with this structure:

```markdown
## Script: [Title]

**Hook Pattern:** [pattern name]
**Duration:** [8–15 min target]
**Format:** longform

### Opening Hook (0:00–0:15)
[Hook line — bold claim or pattern interrupt]
[Visual: what appears on screen]

### 3P's Intro (0:15–0:45)
**Proof:** [Why should they trust you — credential, result, experience]
**Promise:** [What they'll walk away with]
**Plan:** [How the video is structured — "First... then... finally..."]

### Retention Hook (0:45–1:00)
[Mid-hook to keep viewers past the 1-minute mark]

### Body Sections

#### Section 1: [Title] (1:00–3:00)
[Script with [Visual: ...] cues]

#### Section 2: [Title] (3:00–6:00)
[Script with visual cues]

#### Section 3: [Title] (6:00–9:00)
[Script with visual cues]

### Mid-Video CTA (~50% mark)
[Soft CTA — subscribe, like, or save]

### Closing (final 60s)
**Summary:** [Key takeaway in 1 sentence]
**CTA:** [From cta.md]
**Outro:** [Sign-off]

### Filming Cards

| Card | Section | Key Visual | Props/Setup | Notes |
|------|---------|-----------|-------------|-------|
| 1 | Hook | ... | ... | ... |
| 2 | 3P's | ... | ... | ... |
```

3–5 body sections depending on depth. Filming cards summarize what to prepare per segment.

### Mode C: `--mode linkedin` (Text Post)

```markdown
## LinkedIn Post: [Title]

**Hook Pattern:** [pattern name]
**Format:** linkedin

### Hook Line
[First line — this is what shows before "see more"]

### Body
[150–300 words, line breaks for readability, includes the A→B contrast]

### CTA
[From cta.md — linkedin CTA]

### Hashtags
[5–10 relevant hashtags]
```

## 4. Update Angle Status (if --angle was used)

If `--angle` was provided, update the angle file's status to `scripted`:

```bash
python3 -c "
from pathlib import Path
import re
p = Path('$ANGLE_PATH')
content = p.read_text()
content = re.sub(r'^status: \w+', 'status: scripted', content, count=1, flags=re.MULTILINE)
p.write_text(content)
print('Updated angle status → scripted')
"
```

## 5. Persist Script

Create the library directory:

```bash
mkdir -p "$(pwd)/vault/library/scripts"
```

Write the script to:

```
vault/library/scripts/<YYYY-MM-DD>-<topic-slug>-<mode>-<NN>.md
```

**Script file format:**

```markdown
---
type: script
topic: "<topic>"
mode: <shortform|longform|linkedin>
angle_ref: "<path to angle file, or null if --topic was used>"
hook_pattern: <pattern used>
hook_score: <score of selected hook>
duration_target: <seconds for shortform, minutes for longform, null for linkedin>
status: draft
created: <YYYY-MM-DD>
---

<full script content from Step 3>
```

## 6. Done

```
✓ /viral-script complete
Mode: <mode>
Hook: <selected hook text> (<pattern>, score: <score>)
Script: vault/library/scripts/<filename>.md
[if --angle was used] Angle status updated → scripted
```
