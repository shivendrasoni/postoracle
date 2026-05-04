# Brand Voice — Design Spec

**Date:** 2026-05-05  
**Status:** Approved  
**Scope:** `/brand-voice` command, vault structure, downstream integration with `/make-reel` and `/make-carousel`

---

## 1. Overview

`/brand-voice` is a modular deep-dive interview command that builds and maintains a creator's brand identity profile. It produces structured Markdown files in `vault/brand/modules/` — one per topic — that downstream content commands (`/make-reel`, `/make-carousel`) consume to produce on-brand output.

`/carousel-brand` is deprecated and removed. All brand configuration lives in the vault.

---

## 2. Vault Structure

`vault/` lives inside the repo at `content_creation/vault/` and is gitignored by default. The user can opt in to committing it at any time.

```
vault/
  brand/
    brand-voice.md              ← compiled master (auto-regenerated, Obsidian home base)
    modules/
      niche.md
      style.md
      competitors.md
      goals.md
      cta.md
      watermark.md
      brand.md                  ← colors, font, logo (replaces CAROUSEL-BRAND.json)
  outputs/
    reels/
      YYYY-MM-DD-slug/
        script.md
        final.mp4
    carousels/
      YYYY-MM-DD-slug/
        slides/
        caption.md
  imports/                      ← drop platform export files here
  assets/                       ← logo, avatar image, other brand assets
  logs/
    pipeline-log.md             ← append-only log of every pipeline run
```

**Obsidian:** Point Obsidian vault root at `content_creation/vault/`. All brand modules, outputs, and logs are navigable as notes.

---

## 3. Module File Format

Every module file uses YAML frontmatter for structured fields (consumed by scripts and Claude) and a Markdown body for rich context (consumed by Claude as LLM prompt context).

Example — `cta.md`:
```markdown
---
module: cta
last_updated: 2026-05-05
platforms:
  instagram:
    primary: "Comment GUIDE to get the full breakdown"
    follow: "Follow for more like this"
  linkedin:
    primary: "Link in bio"
    follow: "Follow for weekly insights"
  default: "Follow for more"
---

## CTA Philosophy

I want low-friction engagement first. Comments over follows over clicks.
DM-based CTAs work best for lead gen posts...
```

Scripts read frontmatter via a Python YAML parser. Claude reads the full file for nuanced context injection.

---

## 4. `/brand-voice` Command

**File:** `.claude/commands/brand-voice.md`

### Entry Modes

```
/brand-voice                    → full first-run interview (all 7 modules in sequence)
/brand-voice --module <name>    → re-run a single module (e.g. --module cta)
/brand-voice --list             → show all modules with status: complete / incomplete / stale
```

### Module Sequence (Full Run)

| # | Module | Key questions |
|---|--------|---------------|
| 1 | `niche` | Creator name, space, subniches, target audience persona |
| 2 | `style` | Tone, pace, vocabulary, file import from platform exports |
| 3 | `competitors` | Who to watch, who inspires, what to avoid sounding like |
| 4 | `goals` | Per-post success metric (likes, comments, DMs, clicks, purchases) |
| 5 | `cta` | Action per platform per goal, CTA text variants |
| 6 | `watermark` | Elements (handle, logo, URL, avatar+handle), position via 3×3 grid |
| 7 | `brand` | Colors (5 roles), font, logo file path |

### Interview Style

Each module is a conversational deep-dive. Claude asks an opening question, the user answers, Claude probes follow-ups based on the answer. The module ends when Claude has enough to write a complete, accurate module file. Claude does not move to the next module until the current one is written and confirmed.

### Module Re-run

`/brand-voice --module style`:
1. Load and display current `style.md` (frontmatter summary + body preview)
2. Ask: "What do you want to update?"
3. Run focused interview on that delta only
4. Rewrite `style.md` with updated content
5. Regenerate `brand-voice.md`

### Status Check

`/brand-voice --list` reads each module file and outputs:

```
niche        ✓  last updated 2026-05-05
style        ✓  last updated 2026-05-05
competitors  ✗  not started
goals        ~  last updated 2026-04-01  (stale — >30 days)
cta          ✓  last updated 2026-05-05
watermark    ✗  not started
brand        ✓  last updated 2026-05-05
```

Status legend: `✓` complete, `✗` not started, `~` stale (last updated > 30 days ago).

---

## 5. File Import (Style Module)

### Drop Folder

User drops platform export files into `vault/imports/` before or during the style module interview. Claude scans this folder automatically when the style module runs.

Supported files (detected by name/extension):

| Platform | Expected filename | Format |
|----------|------------------|--------|
| Instagram | `posts_1.json` | JSON — `data[].media[].title` fields |
| LinkedIn | `shares.csv` | CSV — `ShareCommentary` column |
| Twitter/X | `tweets.js` | JS file — `window.YTD.tweets.part0[].tweet.full_text` |

### Fallback

If `vault/imports/` is empty, Claude prompts:
> "Drop your export files into `vault/imports/` and press Enter — or paste a file path."

### Processing

1. Extract text content only (no images, no metadata beyond text)
2. For Instagram: separate caption body from hashtags
3. Filter retweets/shares (Twitter) and reposts
4. Claude analyzes: sentence length patterns, opener styles, recurring phrases, tone markers
5. Findings written into `style.md` body as examples + frontmatter keys (`avg_sentence_length`, `tone`, `opener_patterns`)
6. Raw import files stay in `vault/imports/` — never modified

---

## 6. Watermark Configuration (Watermark Module)

### Configurable Elements (pick any combination)

- Instagram handle (e.g. `@shivendra`)
- LinkedIn handle / URL
- Logo image (path relative to `vault/assets/`)
- Website URL
- Avatar image + handle combo (path + text)

### Position Grid

User picks position using a 3×3 grid:

```
1  2  3
4     5
6  7  8
```

Positions: 1=top-left, 2=top-center, 3=top-right, 4=middle-left, 5=middle-right, 6=bottom-left, 7=bottom-center, 8=bottom-right.

### Module Frontmatter

```yaml
---
module: watermark
last_updated: 2026-05-05
elements:
  - type: handle
    value: "@shivendra"
  - type: logo
    path: "assets/logo.png"
position: 6
opacity: 0.85
---
```

---

## 7. Brand Module (Replaces `/carousel-brand`)

`vault/brand/modules/brand.md` is the single source of truth for visual brand identity.

```yaml
---
module: brand
last_updated: 2026-05-05
colors:
  primary: "#1A1A2E"
  secondary: "#16213E"
  accent: "#E94560"
  background: "#0F3460"
  text: "#FFFFFF"
font: "Inter"
logo_path: "assets/logo.png"
---
```

`/carousel-brand` command and `scripts/carousel_brand.py` are deleted. `/make-carousel` reads colors directly from `vault/brand/modules/brand.md`.

Logo and avatar files are stored in `vault/assets/`. The brand module interview asks the user to name files and validates they exist there.

---

## 8. Downstream Integration

### `/make-reel`

Before the script stage, loads:
- `vault/brand/modules/style.md` — tone, vocabulary, anti-patterns
- `vault/brand/modules/cta.md` — platform-appropriate CTA to append to script
- `vault/brand/modules/niche.md` — audience context for relevance filtering
- `vault/brand/modules/watermark.md` — watermark spec passed to video renderer

If a module file is missing: warn per missing module and continue without that module's context (don't block the pipeline).

### `/make-carousel`

Before slide generation, loads:
- `vault/brand/modules/brand.md` — colors and font (replaces CAROUSEL-BRAND.json)
- `vault/brand/modules/style.md` — caption voice and tone
- `vault/brand/modules/cta.md` — last-slide CTA text
- `vault/brand/modules/watermark.md` — watermark spec applied to each slide

### Output Logging

Every `/make-reel` and `/make-carousel` run appends a structured entry to `vault/logs/pipeline-log.md`:

```markdown
## 2026-05-05 14:32 — make-carousel
- topic: OpenAI Python SDK
- slides: 6
- platform: linkedin
- brand: loaded (brand-voice v2026-05-05)
- output: vault/outputs/carousels/2026-05-05-openai-python/
```

---

## 9. Compiled Master: `brand-voice.md`

Auto-generated after every module write. Pulls frontmatter + body from all 7 modules into one Obsidian-readable document. Serves as the at-a-glance identity card.

Structure:
```
# Brand Voice — [Creator Name]
Last updated: YYYY-MM-DD

## Niche
## Style
## Competitors & Inspiration
## Goals
## CTA
## Watermark
## Brand Identity
```

Not edited manually — always regenerated from module files.

---

## 10. New Scripts Required

| Script | Purpose |
|--------|---------|
| `scripts/brand_voice.py` | CLI for read/write/compile vault brand modules — subcommands: `read`, `write`, `compile`, `status` |
| `scripts/import_platform.py` | Parse Instagram JSON, LinkedIn CSV, Twitter JS exports into text lists |
| `scripts/watermark.py` | Apply watermark spec to images/video frames |

---

## 11. Files to Delete

- `.claude/commands/carousel-brand.md`
- `scripts/carousel_brand.py`
- `tests/test_carousel_brand.py`

---

## 12. `.gitignore` Addition

```
vault/
```

User commits vault manually when ready.
