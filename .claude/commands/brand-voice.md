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
