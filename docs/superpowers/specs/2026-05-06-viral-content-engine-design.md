# Viral Content Engine — Design Spec

**Date:** 2026-05-06  
**Status:** Draft (pending user review)  
**Scope:** `/viral-angle` command, `/viral-script` command, 3 new vault modules, library storage, pipeline integration with `/make-reel` and `/make-carousel`, `/brand-voice` extension

---

## 1. Overview

This spec adds a viral content strategy layer to the existing content creation system. Two new commands (`/viral-angle`, `/viral-script`) generate high-contrast angles and production-ready scripts. Three new vault modules (`pillars`, `audience`, `strategy`) extend the brand voice to cover content strategy — what to say and why — alongside the existing brand/visual modules that cover how it looks and sounds.

Everything stays in the vault. No separate JSON brain. YAML frontmatter for structured data, markdown body for LLM context. Obsidian-native throughout.

### Design Principles

- **Vault is canonical.** All brand, strategy, and content data lives in `vault/` as markdown with YAML frontmatter.
- **Obsidian-first.** Every file is readable and editable in Obsidian. No binary formats, no opaque JSON.
- **Contrast Formula is the creative engine.** Every angle is built on common_belief → surprising_truth. This drives hooks, scripts, and content differentiation.
- **Pipelines stay backward-compatible.** `/make-reel` and `/make-carousel` work exactly as before when no `--from-angle` or `--from-script` flag is passed.
- **Self-sufficient system.** Commands are native to this project's vault architecture, not ports of an external system.

---

## 2. Vault Structure (Extended)

```
vault/
  brand/
    brand-voice.md                  ← compiled master (auto-regenerated)
    modules/
      niche.md                      ← existing
      style.md                      ← existing
      competitors.md                ← existing
      goals.md                      ← existing
      cta.md                        ← existing
      watermark.md                  ← existing
      brand.md                      ← existing
      pillars.md                    ← NEW — content pillars + topics
      audience.md                   ← NEW — ICP deep-dive + audience blockers
      strategy.md                   ← NEW — hook preferences + content jobs
  library/                          ← NEW — persistent content library
    angles/
      2026-05-06-ai-agents-shortform-01.md
      2026-05-06-ai-agents-carousel-03.md
    scripts/
      2026-05-06-ai-agents-heil-01.md
  outputs/
    reels/                          ← existing
    carousels/                      ← existing
  imports/                          ← existing
  assets/                           ← existing
  logs/
    pipeline-log.md                 ← existing
```

---

## 3. New Vault Modules

### 3.1 `pillars.md` — Content Pillars

Content pillars define the 3–5 recurring themes the creator builds around. Each pillar has subtopics and maps to a content job (what the content does for the audience/business).

```yaml
---
module: pillars
last_updated: 2026-05-06
pillars:
  - name: "AI News & Tools"
    subtopics:
      - "New tool launches"
      - "Open-source AI products"
      - "Tool comparisons"
    content_job: build_trust
  - name: "How-To & Builds"
    subtopics:
      - "Workflow automation"
      - "AI coding tutorials"
      - "Build X with AI"
    content_job: demonstrate_capability
  - name: "Myth Busting"
    subtopics:
      - "AI misconceptions"
      - "Overhyped tools debunked"
    content_job: drive_action
  - name: "Deep Dives & Series"
    subtopics:
      - "Concept explainers"
      - "Multi-part builds"
    content_job: build_trust
---

## Pillar Philosophy

<Narrative: why these pillars, how they rotate, what each content job means for the creator's goals>
```

**Content jobs:**
- `build_trust` — positions the creator as knowledgeable and reliable
- `demonstrate_capability` — shows viewers concrete skills and outcomes
- `drive_action` — motivates viewers to change behavior, buy, or engage

### 3.2 `audience.md` — ICP & Audience Blockers

Goes deeper than `niche.md`'s one-line persona. Captures who the audience is, what they believe, and what mental barriers the content needs to break.

```yaml
---
module: audience
last_updated: 2026-05-06
icp:
  primary: "Developers and product managers curious about AI tools"
  secondary: "Non-technical professionals who want AI productivity gains"
  psychographics:
    - "Overwhelmed by the pace of AI launches"
    - "Skeptical of hype, want proof before adopting"
    - "Time-poor, outcome-oriented"
blockers:
  - belief: "AI is just a fad / hype cycle"
    counter: "Show concrete, repeatable workflows that save hours"
  - belief: "I need to learn to code to use AI"
    counter: "Demonstrate no-code AI tools with real results"
  - belief: "AI output is too generic to be useful"
    counter: "Show prompt engineering + customization that produces specific, quality output"
---

## Audience Context

<Narrative: who they are, what transformation they want, what lies they believe, how content breaks those lies>
```

**Audience blockers** are the lies or misconceptions the audience holds that prevent them from engaging with the creator's core value proposition. Each blocker maps to a content counter-strategy — a type of content that destroys that belief. Angles that target blockers get a relevance boost during scoring.

### 3.3 `strategy.md` — Hook Preferences & Content Jobs

Captures the creator's preferred hook patterns (with tunable weights) and defines how content jobs map to funnel stages and CTAs.

```yaml
---
module: strategy
last_updated: 2026-05-06
hook_preferences:
  contradiction: 1.0
  specificity: 1.0
  timeframe_tension: 1.0
  curiosity_gap: 1.0
  vulnerable_confession: 1.0
  pattern_interrupt: 1.0
  pov_as_advice: 1.0
content_jobs:
  build_trust:
    funnel_stage: top
    cta_type: follow
  demonstrate_capability:
    funnel_stage: middle
    cta_type: lead_magnet
  drive_action:
    funnel_stage: bottom
    cta_type: product
---

## Strategy Notes

<Narrative: which hooks the creator gravitates toward, how content jobs map to business goals, notes on what's working>
```

Hook preference weights range 0.0–2.0 (default 1.0). The creator can manually adjust these via `/brand-voice --module strategy` based on what performs. Higher weight = that hook pattern is used more often in generation.

---

## 4. Unified Hook Taxonomy

Seven patterns, merged and deduplicated from both systems:

| # | Pattern | Description | Example |
|---|---------|-------------|---------|
| 1 | `contradiction` | Challenges a widely held belief head-on | "Everyone says X. Here's why that's wrong." |
| 2 | `specificity` | Leads with a hyper-specific number or result | "I mass-produced 847 images in 12 minutes" |
| 3 | `timeframe_tension` | Creates urgency with a time window | "In 6 months, this won't exist anymore" |
| 4 | `curiosity_gap` | Opens an information gap the viewer must close | "There's a feature in ChatGPT nobody's talking about" |
| 5 | `vulnerable_confession` | Admits a mistake or failure to build trust | "I wasted 3 months on this approach" |
| 6 | `pattern_interrupt` | Visual or tonal disruption that stops the scroll | Bold text overlay, unexpected camera angle, mid-action start |
| 7 | `pov_as_advice` | Reframes personal experience as actionable guidance | "If I were starting today, I'd do this differently" |

These patterns are used by both `/viral-script` (hook generation) and the `viral-reel-generator` skill (inline script generation). Weights from `strategy.md` influence selection.

---

## 5. Contrast Formula

The core creative mechanism behind angle generation. Every strong content angle contains:

```
Common Belief (A)  →  Surprising Truth (B)
```

**Contrast strength levels:**

| Level | Definition | Example |
|-------|-----------|---------|
| `mild` | Slight reframe of conventional wisdom | "AI saves time" → "AI saves time, but only if you spend time learning it first" |
| `moderate` | Challenges a common assumption | "You need to learn Python for AI" → "No-code AI tools outperform most scripts" |
| `strong` | Directly contradicts popular belief | "AI will replace developers" → "AI makes average developers 10x, doesn't replace anyone" |
| `extreme` | Provocative, polarizing, high-engagement risk | "Prompt engineering is a skill" → "Prompt engineering is dead — agents do it for you now" |

Default target: `moderate` to `strong`. The `extreme` level is available but should be used sparingly — it generates engagement but can erode trust if overused.

---

## 6. `/viral-angle` Command

### Purpose

Generates format-specific content angles using the Contrast Formula. Reads vault modules for creator context, produces angles as individual Obsidian-friendly markdown files.

### Interface

```
/viral-angle <topic-or-url> [--format shortform|longform|linkedin|carousel|all] [--count 5]
```

- `<topic-or-url>` — required; plain text topic or HTTP URL for research
- `--format` — default `all` (generates angles for every format)
- `--count` — angles per format; default `5`

### Phases

#### Phase 1: Load Context

Read vault modules:
- `niche.md` — creator space and transformation
- `pillars.md` — match topic to pillar(s)
- `audience.md` — ICP psychographics + blockers for relevance
- `competitors.md` — differentiation context (if populated)
- `strategy.md` — hook preferences for later scoring

**Missing-module behavior:** If any vault module is absent, warn and continue. Scoring degrades gracefully:
- No `pillars.md` → `pillar_relevance` defaults to 0.5 (neutral)
- No `audience.md` → `blocker_match` defaults to 0.0 (no boost)
- No `strategy.md` → all `hook_preference_weight` values default to 1.0 (uniform)
- No `competitors.md` or empty arrays → competitor differentiation is skipped (no-op)

This means `/viral-angle` works immediately after basic brand-voice setup (niche + style). The strategy modules make it better, but aren't required.

#### Phase 2: Research

**If input is a URL:**
- Fetch the URL via `WebFetch`
- Extract key claims, stats, mechanisms, hooks
- Write research summary to working context

**If input is a topic string:**
- Use `WebSearch` for top 3–5 results
- Fetch the 2 most relevant URLs
- Synthesize into research context

#### Phase 3: Generate Angles

For each format in the `--format` set, generate `--count` angles. Each angle contains:

| Field | Description |
|-------|-------------|
| `topic` | The input topic |
| `format` | `shortform`, `longform`, `linkedin`, or `carousel` |
| `pillar` | Which content pillar this maps to |
| `contrast.common_belief` | What most people think (the A) |
| `contrast.surprising_truth` | The reframe (the B) |
| `contrast.strength` | `mild`, `moderate`, `strong`, or `extreme` |
| `hook_pattern` | Which of the 7 hook patterns fits best |
| `content_job` | `build_trust`, `demonstrate_capability`, or `drive_action` |
| `blocker_targeted` | Which audience blocker this addresses (if any) |
| `cta_direction` | CTA type: `follow`, `lead_magnet`, `comment_keyword`, `dm`, `link` |
| `one_liner` | The angle as a single compelling sentence |
| `talking_points` | 3–5 bullet points expanding the angle |

**Format-specific rules:**
- `shortform`: angles must be compressible to 15–60 seconds; visual-first, one core insight
- `longform`: angles should support 8–15 minutes; need a mechanism to explain, not just a claim
- `linkedin`: angles should be text-native; story arc or contrarian take; professional framing
- `carousel`: angles should decompose into 5–6 sequential beats (hook → value → CTA); each beat = one slide

#### Phase 4: Score & Rank

Score each angle (note: this formula is for **angles**; hooks have a separate formula in Section 7):

```
angle_score = contrast_strength_score * 0.35
            + pillar_relevance * 0.25
            + blocker_match * 0.20
            + hook_preference_weight * 0.20
```

Where:
- `contrast_strength_score`: mild=0.4, moderate=0.7, strong=0.9, extreme=1.0
- `pillar_relevance`: 1.0 if topic matches a pillar, 0.5 if adjacent, 0.2 if no match
- `blocker_match`: 1.0 if angle targets an audience blocker, 0.0 if not
- `hook_preference_weight`: from `strategy.md`, normalized to 0–1

Present angles ranked by score. Top angle per format is marked as `recommended`.

#### Phase 5: Persist

Write each angle as a separate markdown file:

```
vault/library/angles/<date>-<topic-slug>-<format>-<NN>.md
```

Example: `vault/library/angles/2026-05-06-ai-agents-shortform-01.md`

**Angle file format:**

```yaml
---
type: angle
topic: "AI agents replacing junior devs"
format: shortform
pillar: "Myth Busting"
contrast:
  common_belief: "AI will replace junior developers"
  surprising_truth: "AI makes junior developers ship like seniors — it's a multiplier, not a replacement"
  strength: strong
hook_pattern: contradiction
content_job: build_trust
blocker_targeted: "AI is coming for my job"
cta_direction: comment_keyword
score: 0.82
status: draft
created: 2026-05-06
---

## Angle

AI will replace junior developers — that's what every LinkedIn thought leader is saying. But the data tells a different story. Junior devs using AI copilots are shipping features 40% faster and with fewer bugs. AI isn't replacing them. It's removing the gap between junior and senior.

## Talking Points

- Junior devs + AI copilot = senior-level output velocity
- The real risk isn't replacement — it's juniors who refuse to learn AI tools
- Companies hiring AI-native juniors over traditional seniors
- "10x developer" was always about tools, not talent
- Counter: some tasks genuinely going away (boilerplate, CRUD scaffolding)
```

#### Phase 6: Display

Present all angles to the user, grouped by format, ranked by score. For each angle show:
- One-liner
- Contrast (A → B) with strength
- Hook pattern
- Score
- File path

---

## 7. `/viral-script` Command

### Purpose

Generates hooks and production-ready scripts from angles or topics. Supports three output modes: shortform (HEIL beats), longform (3P's intro + filming cards), and linkedin (text post).

### Interface

```
/viral-script --angle <path> [--mode shortform|longform|linkedin]
/viral-script --topic "<text>" [--mode shortform|longform|linkedin]
```

- `--angle <path>` — path to an angle file in `vault/library/angles/`; skips research
- `--topic "<text>"` — inline topic; will generate a single angle first, then script it
- `--mode` — required; determines script structure

### Phases

#### Phase 1: Load Context

Read vault modules:
- `style.md` — tone, vocabulary, anti-patterns, opener patterns
- `cta.md` — platform-specific CTA copy
- `strategy.md` — hook preference weights
- `niche.md` — audience context
- `audience.md` — blockers for relevance

If `--angle` was provided, read the angle file. If `--topic` was provided, generate a single angle inline (same logic as `/viral-angle` Phase 3, single format matching `--mode`).

#### Phase 2: Generate Hooks

Generate 10 hooks for the angle:

- All 10 hooks are vault-informed (using style.md opener patterns + strategy.md hook preferences)
- Each hook uses one of the 7 hook patterns
- Distribution: favor patterns with higher weights in `strategy.md`, but ensure at least 5 distinct patterns are represented

**Hook scoring:**

```
hook_score = contrast_fit * 0.40
           + pattern_strength * 0.35
           + platform_fit * 0.25
```

Where:
- `contrast_fit`: how well the hook surfaces the angle's A→B contrast (0–1)
- `pattern_strength`: how cleanly the hook executes its pattern (0–1)
- `platform_fit`: how well it matches the target platform's norms (0–1)

Rank hooks by score. Present the top 3 to the user with reasoning. Use the #1 hook for the script unless the user picks a different one.

#### Phase 3: Generate Script

**Anti-slop rules (apply to ALL modes):**

These rules are non-negotiable. Every script is checked against them before output.

| Rule | Forbidden Pattern |
|------|------------------|
| No 3-word loops | "It's fast. It's easy. It's effective." |
| No rhetorical lists | "Price? High. Quality? Low." |
| No meta-commentary | "Let's dive in," "In this video," "But there's a twist." |
| No hype adjectives | "Mind-blowing," "Insane," "Game-changing" (unless technically justified) |
| No fake scenarios | "Imagine you are walking down the street..." |
| No throat-clearing | "Hey guys, welcome back," "So..." (new addition to existing anti-slop set) |

**Required flow patterns:**
- **The Connector:** Use "See," "Meaning," or "Therefore" to glue sentences
- **The Contrast:** "Most [X] do Y. But [This] does Z."
- **The Mechanism:** Explain *how* it works, don't just say it works

---

#### Mode A: `--mode shortform` (HEIL Beats)

**HEIL framework:** Hook / Explain / Illustrate / Lesson

Output structure:

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
[From cta.md — platform-appropriate]

### Cross-Post Notes
- **Reels:** [any Reels-specific adjustments]
- **Shorts:** [any Shorts-specific adjustments]
- **TikTok:** [any TikTok-specific adjustments]
```

Beat count: 5–8 beats for 15–60s target. Each beat has a type (Hook, Explain, Illustrate, Lesson), timecode, spoken script, and visual cue.

---

#### Mode B: `--mode longform` (3P's Intro + Filming Cards)

**3P's intro framework:** Proof / Promise / Plan

Output structure:

```markdown
## Script: [Title]

**Hook Pattern:** [pattern name]
**Duration:** [8–15 min target]
**Format:** longform

### Opening Hook (0:00–0:15)
[Hook line — bold claim or pattern interrupt]
[Visual: what appears on screen]

### 3P's Intro (0:15–0:45)
**Proof:** [Why should they trust you on this topic — credential, result, experience]
**Promise:** [What they'll walk away with]
**Plan:** [How the video is structured — "First... then... finally..."]

### Retention Hook (0:45–1:00)
[Mid-hook to keep viewers past the 1-minute mark]

### Body Sections

#### Section 1: [Title] (1:00–3:00)
[Script with visual cues]

#### Section 2: [Title] (3:00–6:00)
[Script with visual cues]

#### Section 3: [Title] (6:00–9:00)
[Script with visual cues]

[3–5 sections depending on depth]

### Mid-Video CTA (~50% mark)
[Soft CTA — subscribe, like, or save]

### Closing (final 60s)
**Summary:** [Key takeaway in 1 sentence]
**CTA:** [From cta.md]
**Outro:** [Sign-off]

### Filming Cards

| Card | Section | Key Visual | Props/Setup | Notes |
|------|---------|-----------|-------------|-------|
| 1 | Hook | Face-to-camera, bold text overlay | None | Deliver in under 5 seconds |
| 2 | 3P's | Talking head, credentials on screen | None | Confident, not braggy |
| ... | ... | ... | ... | ... |
```

Filming cards are a production aid — they tell the creator what to prepare for each segment without re-reading the full script.

---

#### Mode C: `--mode linkedin` (Text Post)

Output structure:

```markdown
## LinkedIn Post: [Title]

**Hook Pattern:** [pattern name]
**Format:** linkedin

### Hook Line
[First line — this is what shows before "see more"]

### Body
[Post body — 150–300 words]
[Uses line breaks for readability]
[Includes the contrast: A → B]

### CTA
[From cta.md — linkedin platform CTA]

### Hashtags
[5–10 relevant hashtags]
```

LinkedIn posts follow the same contrast formula but are adapted for text-native consumption: shorter paragraphs, strategic line breaks, no visual cues needed.

---

#### Phase 4: Persist

Write the script to:

```
vault/library/scripts/<date>-<topic-slug>-<mode>-<NN>.md
```

**Script file frontmatter:**

```yaml
---
type: script
topic: "AI agents replacing junior devs"
mode: shortform
angle_ref: "vault/library/angles/2026-05-06-ai-agents-shortform-01.md"
hook_pattern: contradiction
hook_score: 0.88
duration_target: 45
status: draft
created: 2026-05-06
---
```

The `angle_ref` field is an Obsidian wiki-link-compatible path. In Obsidian, scripts link back to their source angles.

---

## 8. Pipeline Integration

### 8.1 `/make-reel` — New Flags

Two new optional flags:

**`--from-angle <path>`**
- Skips Stage 1 (Research). The angle file's `contrast`, `talking_points`, and `hook_pattern` replace research output.
- Stage 2 (Script) still runs but uses the angle as input instead of raw research.
- Example: `/make-reel --from-angle vault/library/angles/2026-05-06-ai-agents-shortform-01.md`

**`--from-script <path>`**
- Skips Stage 1 (Research) and Stage 2 (Script). The script file is used directly.
- Pipeline starts at Stage 3 (HeyGen Video).
- The script file must contain timecodes and visual cues (shortform HEIL beat table format).
- Example: `/make-reel --from-script vault/library/scripts/2026-05-06-ai-agents-heil-01.md`

**No flag:** Pipeline works exactly as today. The `viral-reel-generator` skill is updated with the unified hook taxonomy and anti-slop rules, but the flow is unchanged.

### 8.2 `/make-carousel` — New Flags

**`--from-angle <path>`**
- Skips Stage 1 (Research). The angle's `talking_points` seed the slide plan.
- Carousel angles (format: `carousel`) include beat suggestions that map naturally to slides.
- Non-carousel angles (e.g., `linkedin`) are adapted: talking points become slide content beats.
- Example: `/make-carousel --from-angle vault/library/angles/2026-05-06-ai-agents-carousel-03.md`

**No flag:** Pipeline works exactly as today.

### 8.3 Enhanced `viral-reel-generator` Skill

The existing skill at `.claude/skills/viral-reel-generator/` is updated:

- **Hook patterns:** Replace the 5 existing patterns with the unified 7-pattern taxonomy
- **Anti-slop rules:** Preserved as-is (already strong)
- **Contrast awareness:** When vault modules are loaded, apply contrast formula thinking to script generation
- **Strategy module:** Read `strategy.md` hook preference weights to influence pattern selection
- **No breaking changes:** The skill still works for inline `/make-reel` script generation; it just gets better hooks and vault-informed context

---

## 9. `/brand-voice` Extension

### Three New Modules

The brand-voice interview grows from 7 → 10 modules. New modules are added at the end of the sequence:

| # | Module | Key Questions |
|---|--------|---------------|
| 8 | `pillars` | "What are your 3–5 recurring content themes?", "What subtopics under each?", "Which pillar builds trust vs drives action?" |
| 9 | `audience` | "Describe your ideal viewer beyond demographics", "What do they believe that's wrong?", "What's the #1 objection to your content?" |
| 10 | `strategy` | "Which hook styles do you gravitate toward?", "What content type drives the most business results?", "Do you have a funnel — and where does content fit?" |

### Module Re-run

All three support `--module <name>`:
```
/brand-voice --module pillars
/brand-voice --module audience
/brand-voice --module strategy
```

### Status Check

`/brand-voice --list` includes the new modules:

```
niche        ✓  last updated 2026-05-05
style        ✓  last updated 2026-05-05
competitors  ✗  not started
goals        ✓  last updated 2026-05-05
cta          ✓  last updated 2026-05-05
watermark    ✗  not started
brand        ✓  last updated 2026-05-05
pillars      ✗  not started
audience     ✗  not started
strategy     ✗  not started
```

### Compiled Master

`brand-voice.md` is updated to include 3 new sections:

```
# Brand Voice — [Creator Name]

## Niche
## Style
## Competitors & Inspiration
## Goals
## CTA
## Watermark
## Brand Identity
## Content Pillars          ← NEW
## Audience Deep-Dive       ← NEW
## Content Strategy         ← NEW
```

---

## 10. Library Management

### File Lifecycle

Every angle and script file has a `status` field:

```
draft → approved → scripted → published
```

| Status | Meaning |
|--------|---------|
| `draft` | Generated, not yet reviewed |
| `approved` | Creator reviewed and approved |
| `scripted` | Script has been generated from this angle |
| `published` | Content has been published from this script |

Status is updated manually by the creator in Obsidian (edit the frontmatter) or automatically when a downstream command consumes the file:
- `/viral-script --angle <path>` sets the angle's status to `scripted`
- `/make-reel --from-script <path>` + successful publish sets script status to `published`

**Note:** Commands that update status will mutate the vault file's frontmatter. Since the creator may also edit these files in Obsidian, commands always read the file fresh before updating and only touch the `status` field — never overwrite other frontmatter or the body.

### Obsidian Integration

Library files are plain markdown with YAML frontmatter. In Obsidian:
- **Tags:** `type: angle`, `format: shortform`, `pillar: "Myth Busting"` — all searchable
- **Graph view:** Scripts link back to angles via `angle_ref`
- **Status filtering:** Dataview queries can filter by `status: draft` to find unscripted angles
- **Manual editing:** Creators can edit any field — the system treats vault files as source of truth

### Directory Naming

```
vault/library/angles/<YYYY-MM-DD>-<topic-slug>-<format>-<NN>.md
vault/library/scripts/<YYYY-MM-DD>-<topic-slug>-<mode>-<NN>.md
```

Slugs are derived from the topic: lowercase, non-alphanumeric replaced with hyphens, truncated to 40 characters. `<NN>` is a zero-padded sequence number (01, 02, ...) per format per topic per day.

---

## 11. Content Workflows

### Workflow A: Planned Content (Viral-First)

For creators who batch-plan content:

```
1. /viral-angle "AI agents replacing junior devs"
   → Generates 20 angles (5 per format × 4 formats)
   → Saved to vault/library/angles/

2. Review angles in Obsidian, mark favorites as status: approved

3. /viral-script --angle vault/library/angles/...-shortform-02.md --mode shortform
   → Generates 10 hooks, picks best, writes HEIL script
   → Saved to vault/library/scripts/

4. Review script, approve

5. /make-reel --from-script vault/library/scripts/...-heil-01.md
   → Skips research + script stages
   → Straight to HeyGen → b-roll → edit → final.mp4
```

### Workflow B: Quick Content (Pipeline-First)

For quick-turn content:

```
1. /make-reel "AI agents are replacing junior devs"
   → Normal pipeline (research → enhanced script via viral-reel-generator → video)
   → Script generation now uses unified hooks + contrast formula + vault strategy
```

### Workflow C: Carousel from Angle

```
1. /viral-angle "AI agents" --format carousel --count 3
   → 3 carousel-specific angles with slide-beat suggestions

2. /make-carousel --from-angle vault/library/angles/...-carousel-01.md
   → Angle's talking points seed the slide plan
   → Normal carousel pipeline from Stage 2 onward
```

### Workflow D: LinkedIn Post

```
1. /viral-angle "AI agents" --format linkedin --count 5
   → 5 linkedin-optimized angles

2. /viral-script --angle vault/library/angles/...-linkedin-03.md --mode linkedin
   → Full linkedin text post with hook, body, CTA, hashtags
   → Saved to vault/library/scripts/
```

---

## 12. New Commands — File Locations

| Command | File Path |
|---------|-----------|
| `/viral-angle` | `.claude/commands/viral-angle.md` |
| `/viral-script` | `.claude/commands/viral-script.md` |

These are new Claude Code slash commands. No Python scripts are required for the commands themselves — they are LLM-orchestrated (same as `/make-reel` and `/make-carousel`).

---

## 13. Scripts Required

| Script | Purpose | Status |
|--------|---------|--------|
| `scripts/brand_voice.py` | Extended to handle 3 new modules (pillars, audience, strategy) in read/write/compile/status | Modify existing |
| `scripts/parse_angle.py` | Read angle markdown file, return YAML frontmatter as dict | New |
| `scripts/parse_script_library.py` | Read script library file, return frontmatter + body sections | New |

Both new scripts are thin YAML-frontmatter parsers. The heavy lifting (angle generation, hook scoring, script writing) is done by the LLM via the command files.

---

## 14. Skill Updates

| Skill | Change |
|-------|--------|
| `viral-reel-generator` | Replace 5 hook patterns with 7-pattern taxonomy. Add contrast formula awareness. Read `strategy.md` for hook weights. Anti-slop rules unchanged. |

The skill's `references/hook-patterns.md` is updated to document all 7 patterns.

---

## 15. What's NOT Included

- **No feedback loop / auto-updates.** `strategy.md` hook weights are manually adjusted by the creator via `/brand-voice --module strategy`. There is no automatic performance analysis or brain evolution.
- **No onboarding flow.** The existing `/brand-voice` interview handles all setup.
- **No swipe file dependency.** All hooks are vault-informed. No external swipe database.
- **No JSONL or JSON data stores.** Everything is markdown + YAML frontmatter.
- **No analytics ingestion.** No `/viral-analyze` or performance data pipeline.

---

## 16. Migration Notes

### From Existing System

No migration needed. All existing commands, vault modules, and pipelines continue working. The new commands and modules are purely additive.

### From goviralbro (if user has data)

If the creator has existing angle data in goviralbro's `data/angles.jsonl`, a one-time manual migration can convert JSONL entries to vault library markdown files. This is not automated — the creator copies relevant angles manually or requests a one-off conversion.

---

## 17. Files Changed / Created Summary

**New files:**
- `.claude/commands/viral-angle.md`
- `.claude/commands/viral-script.md`
- `vault/brand/modules/pillars.md` (created via brand-voice interview)
- `vault/brand/modules/audience.md` (created via brand-voice interview)
- `vault/brand/modules/strategy.md` (created via brand-voice interview)
- `vault/library/` directory structure
- `scripts/parse_angle.py`
- `scripts/parse_script_library.py`

**Modified files:**
- `.claude/commands/brand-voice.md` — add 3 new modules to interview sequence
- `.claude/commands/make-reel.md` — add `--from-angle` and `--from-script` flags
- `.claude/commands/make-carousel.md` — add `--from-angle` flag
- `.claude/skills/viral-reel-generator/SKILL.md` — update hook patterns to 7-pattern taxonomy
- `.claude/skills/viral-reel-generator/references/hook-patterns.md` — document all 7 patterns
- `scripts/brand_voice.py` — handle 3 new modules in read/write/compile/status
