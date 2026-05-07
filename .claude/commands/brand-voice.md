---
description: Build and maintain creator brand identity — modular deep-dive interview that writes vault/brand/modules/*.md files consumed by /make-reel and /make-carousel.
argument-hint: "[--module <name>] [--list]"
allowed-tools: Bash, Read, Write
---

# /brand-voice

## 0. Parse Arguments

Parse `$ARGUMENTS`:
- *(empty)* → full first-run interview (all 11 modules in sequence)
- `--module <name>` → re-run a single module; valid names: `niche style competitors goals cta watermark brand pillars audience strategy photo`
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
mkdir -p "$(pwd)/vault/outputs/posts"
mkdir -p "$(pwd)/vault/library/angles"
mkdir -p "$(pwd)/vault/library/scripts"
mkdir -p "$(pwd)/vault/imports"
mkdir -p "$(pwd)/vault/assets"
mkdir -p "$(pwd)/vault/logs"

# Scaffold template files if they don't exist
[ ! -f "$(pwd)/vault/content-dashboard.md" ] && cp "$(pwd)/templates/content-dashboard.md" "$(pwd)/vault/content-dashboard.md"
[ ! -f "$(pwd)/vault/publish-config.md" ] && cp "$(pwd)/templates/publish-config.md" "$(pwd)/vault/publish-config.md"
[ ! -f "$(pwd)/vault/content-registry.json" ] && echo "[]" > "$(pwd)/vault/content-registry.json"
```

Run all 11 modules in sequence. **Do not proceed to the next module until the current one is written and confirmed.**

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

### Module 8: pillars

Ask the user (one question at a time, probing based on answers):
- "What are your 3–5 recurring content themes or pillars?"
- For each pillar: "What subtopics fall under [pillar name]?"
- For each pillar: "Does this pillar primarily build trust, demonstrate capability, or drive action?"

After enough detail, write `vault/brand/modules/pillars.md`:

~~~
---
module: pillars
last_updated: <YYYY-MM-DD>
pillars:
  - name: "<pillar name>"
    subtopics:
      - "<subtopic>"
    content_job: build_trust
  - name: "<pillar name>"
    subtopics:
      - "<subtopic>"
    content_job: demonstrate_capability
---

## Pillar Philosophy

<2-3 paragraph narrative: why these pillars, how they rotate, what each content job means>
~~~

Run: `python3 scripts/brand_voice.py --vault "$(pwd)/vault" write --module pillars`

---

### Module 9: audience

Ask the user (one question at a time, probing based on answers):
- "Beyond demographics, describe your ideal viewer — what are they feeling, thinking, struggling with?"
- "What do they believe that's wrong? What misconceptions hold them back?"
- "For each belief: what content would break that belief?"
- "Is there a secondary audience you also serve?"

After enough detail, write `vault/brand/modules/audience.md`:

~~~
---
module: audience
last_updated: <YYYY-MM-DD>
icp:
  primary: "<description>"
  secondary: "<description>"
  psychographics:
    - "<trait>"
blockers:
  - belief: "<what they wrongly believe>"
    counter: "<content strategy to break it>"
---

## Audience Context

<2-3 paragraph narrative: who they are, what transformation they want, what lies they believe, how content breaks those lies>
~~~

Run: `python3 scripts/brand_voice.py --vault "$(pwd)/vault" write --module audience`

---

### Module 10: strategy

Ask the user (one question at a time, probing based on answers):
- "Which hook styles do you gravitate toward?" Show the 7-pattern list:
  1. Contradiction — "Everyone says X. Here's why that's wrong."
  2. Specificity — "I mass-produced 847 images in 12 minutes"
  3. Timeframe tension — "In 6 months, this won't exist anymore"
  4. Curiosity gap — "There's a feature nobody talks about"
  5. Vulnerable confession — "I wasted 3 months on this"
  6. Pattern interrupt — visual/tonal disruption
  7. POV as advice — "If I were starting today..."
- "Rate each 0–2 (0 = never use, 1 = normal, 2 = use heavily). Or just tell me your top 3 and I'll set weights."
- "What type of content drives the most business results for you?"
- "Do you have a content funnel? Where does each content job fit?"
  - build_trust → what funnel stage? (top/middle/bottom) what CTA type? (follow/lead_magnet/product)
  - demonstrate_capability → same
  - drive_action → same

After enough detail, write `vault/brand/modules/strategy.md`:

~~~
---
module: strategy
last_updated: <YYYY-MM-DD>
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

<Narrative: which hooks the creator gravitates toward, how content jobs map to business goals>
~~~

Run: `python3 scripts/brand_voice.py --vault "$(pwd)/vault" write --module strategy`

---

### Module 8: photo

Ask the user:
- "Do you want to include your photo in AI-generated post images? This helps create personalized visuals where you appear in the scene."

**If yes:**
- "Please copy a clear, well-lit headshot or full-body photo to `vault/assets/` and tell me the filename."

Check the file exists:
```bash
ls "$(pwd)/vault/assets/<filename>" 2>/dev/null
```

If not found, prompt: "File not found. Please copy it to `vault/assets/<filename>` and press Enter."

**When file is confirmed:** Read the image using the Read tool to see the person's appearance. Write a detailed physical description (build, skin tone, hair, distinguishing features) suitable for use in GPT-image-2 prompts.

Write `vault/brand/modules/photo.md`:

```
---
module: photo
photo_path: vault/assets/<filename>
description: "<physical description of the person for GPT-image-2 prompts>"
last_updated: <YYYY-MM-DD>
---

## Photo Notes

<Any notes about preferred visual styles, poses, or contexts for AI-generated images>
```

Run: `python3 scripts/brand_voice.py --vault "$(pwd)/vault" write --module photo`

**If no:**
- Skip this module. Print: `[SKIP] Photo module skipped — /make-post will use description-only image generation.`

---

### Final: Compile master

After all 11 modules are written:

```bash
python3 scripts/brand_voice.py --vault "$(pwd)/vault" compile
```

Report to user:
```
✓ /brand-voice complete
Brand profile saved to vault/brand/brand-voice.md (Obsidian-ready)

Module status:
<paste output of: python3 scripts/brand_voice.py --vault vault/ status>

Run /make-reel, /make-carousel, or /viral-angle to use your brand automatically.
```
