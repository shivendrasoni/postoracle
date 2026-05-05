# Viral Content Engine — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `/viral-angle` and `/viral-script` commands, extend brand-voice with 3 new vault modules, create a library storage system, and wire `--from-angle`/`--from-script` flags into existing pipelines.

**Architecture:** Vault-canonical, Obsidian-native. All new data (angles, scripts, strategy) stored as markdown + YAML frontmatter. Two new LLM-orchestrated commands (slash command `.md` files) consume vault modules and persist to `vault/library/`. Two new Python scripts provide frontmatter parsing. Existing `brand_voice.py` extended for 3 new modules.

**Tech Stack:** Python 3, PyYAML, pytest. Claude Code slash commands (markdown). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-05-06-viral-content-engine-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `scripts/brand_voice.py` | Modify | Add pillars, audience, strategy to MODULES list + SECTION_NAMES |
| `tests/test_brand_voice.py` | Modify | Tests for new module support |
| `scripts/parse_angle.py` | Create | Parse angle markdown files → YAML frontmatter dict |
| `tests/test_parse_angle.py` | Create | Tests for angle parser |
| `scripts/parse_script_library.py` | Create | Parse script library files → frontmatter + body sections |
| `tests/test_parse_script_library.py` | Create | Tests for script parser |
| `.claude/commands/brand-voice.md` | Modify | Add modules 9–11 (pillars, audience, strategy) to interview + vault dirs |
| `.claude/commands/viral-angle.md` | Create | `/viral-angle` slash command |
| `.claude/commands/viral-script.md` | Create | `/viral-script` slash command |
| `.claude/commands/make-reel.md` | Modify | Add `--from-angle` and `--from-script` flag parsing + stage-skip logic |
| `.claude/commands/make-carousel.md` | Modify | Add `--from-angle` flag parsing + stage-skip logic |
| `.claude/commands/make-post.md` | Create then modify | Add `--from-angle` flag parsing + stage-skip logic (file may not exist yet — create if needed, modify if it does) |
| `.claude/skills/viral-reel-generator/SKILL.md` | Modify | Update to 7-pattern hook taxonomy + contrast formula |
| `.claude/skills/viral-reel-generator/references/hook-patterns.md` | Modify | Replace 5 patterns with 7-pattern reference |

---

## Task 1: Extend `brand_voice.py` with 3 New Modules

**Files:**
- Modify: `scripts/brand_voice.py:19-33`
- Modify: `tests/test_brand_voice.py`

This task adds `pillars`, `audience`, and `strategy` to the module registry so that `brand_voice.py read/write/compile/status` commands work with them.

- [ ] **Step 1: Write failing test — new modules appear in MODULES list**

Add to `tests/test_brand_voice.py`:

```python
def test_modules_list_includes_strategy_modules():
    from scripts.brand_voice import MODULES
    assert "pillars" in MODULES
    assert "audience" in MODULES
    assert "strategy" in MODULES
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python3 -m pytest tests/test_brand_voice.py::test_modules_list_includes_strategy_modules -v`
Expected: FAIL — `assert "pillars" in MODULES`

- [ ] **Step 3: Write failing test — new modules have section names**

Add to `tests/test_brand_voice.py`:

```python
def test_section_names_includes_strategy_modules():
    from scripts.brand_voice import SECTION_NAMES
    assert "pillars" in SECTION_NAMES
    assert "audience" in SECTION_NAMES
    assert "strategy" in SECTION_NAMES
```

- [ ] **Step 4: Write failing test — compile_master includes new sections**

Add to `tests/test_brand_voice.py`:

```python
def test_compile_master_includes_new_strategy_sections(tmp_path):
    today = date.today().isoformat()
    for mod in MODULES:
        write_module(tmp_path, mod, f"---\nmodule: {mod}\nlast_updated: {today}\n---\n\n{mod} body.")
    master = compile_master(tmp_path)
    text = master.read_text(encoding="utf-8")
    assert "## Content Pillars" in text
    assert "## Audience Deep-Dive" in text
    assert "## Content Strategy" in text
```

- [ ] **Step 5: Write failing test — status includes new modules**

Add to `tests/test_brand_voice.py`:

```python
def test_status_includes_new_modules(tmp_path, capsys):
    from scripts.brand_voice import print_status
    print_status(tmp_path)
    output = capsys.readouterr().out
    assert "pillars" in output
    assert "audience" in output
    assert "strategy" in output
```

- [ ] **Step 6: Run all new tests to verify they fail**

Run: `python3 -m pytest tests/test_brand_voice.py -k "strategy_modules or new_strategy_sections or new_modules" -v`
Expected: 4 FAILs

- [ ] **Step 7: Implement — update MODULES and SECTION_NAMES**

In `scripts/brand_voice.py`, change line 19:

```python
MODULES = ["niche", "style", "competitors", "goals", "cta", "watermark", "brand", "pillars", "audience", "strategy"]
```

And update `SECTION_NAMES` (line 25–33) to add:

```python
SECTION_NAMES = {
    "niche": "Niche",
    "style": "Style",
    "competitors": "Competitors & Inspiration",
    "goals": "Goals",
    "cta": "CTA",
    "watermark": "Watermark",
    "brand": "Brand Identity",
    "pillars": "Content Pillars",
    "audience": "Audience Deep-Dive",
    "strategy": "Content Strategy",
}
```

- [ ] **Step 8: Run all tests**

Run: `python3 -m pytest tests/test_brand_voice.py -v`
Expected: ALL PASS

- [ ] **Step 9: Verify existing tests still pass**

Run: `python3 -m pytest tests/test_brand_voice.py -v`
Expected: ALL PASS (including `test_compile_master_creates_brand_voice_md` which iterates MODULES)

- [ ] **Step 10: Commit**

```bash
git add scripts/brand_voice.py tests/test_brand_voice.py
git commit -m "feat: add pillars, audience, strategy modules to brand_voice.py"
```

---

## Task 2: Create `parse_angle.py` — Angle File Parser

**Files:**
- Create: `scripts/parse_angle.py`
- Create: `tests/test_parse_angle.py`

A thin parser that reads a vault angle markdown file and returns its YAML frontmatter as a dict plus the markdown body. Used by pipeline commands when `--from-angle` is passed.

- [ ] **Step 1: Write failing test — parse angle file with full frontmatter**

Create `tests/test_parse_angle.py`:

```python
"""Tests for scripts/parse_angle.py"""
import textwrap
from pathlib import Path

import pytest

from scripts.parse_angle import parse_angle_file, read_angle


def test_parse_angle_file_returns_frontmatter_and_body():
    content = textwrap.dedent("""\
        ---
        type: angle
        topic: "AI agents"
        format: shortform
        pillar: "Myth Busting"
        contrast:
          common_belief: "AI will replace junior developers"
          surprising_truth: "AI makes junior devs ship like seniors"
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

        AI will replace junior developers — that's what everyone says.

        ## Talking Points

        - Junior devs + AI copilot = senior-level output
        - The real risk is refusal to learn AI tools
    """)
    fm, body = parse_angle_file(content)
    assert fm["type"] == "angle"
    assert fm["topic"] == "AI agents"
    assert fm["format"] == "shortform"
    assert fm["contrast"]["common_belief"] == "AI will replace junior developers"
    assert fm["contrast"]["strength"] == "strong"
    assert fm["hook_pattern"] == "contradiction"
    assert fm["score"] == 0.82
    assert fm["status"] == "draft"
    assert "## Angle" in body
    assert "Talking Points" in body


def test_parse_angle_file_no_frontmatter():
    content = "Just plain text with no frontmatter."
    fm, body = parse_angle_file(content)
    assert fm == {}
    assert body == content


def test_parse_angle_file_with_image_concept():
    content = textwrap.dedent("""\
        ---
        type: angle
        format: post
        image_concept: "Creator in superhero pose with AI emblem"
        ---

        ## Angle

        Post body here.
    """)
    fm, body = parse_angle_file(content)
    assert fm["format"] == "post"
    assert fm["image_concept"] == "Creator in superhero pose with AI emblem"
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python3 -m pytest tests/test_parse_angle.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'scripts.parse_angle'`

- [ ] **Step 3: Write failing test — read_angle from file path**

Add to `tests/test_parse_angle.py`:

```python
def test_read_angle_from_file(tmp_path):
    angle_dir = tmp_path / "vault" / "library" / "angles"
    angle_dir.mkdir(parents=True)
    angle_file = angle_dir / "2026-05-06-ai-agents-shortform-01.md"
    angle_file.write_text(textwrap.dedent("""\
        ---
        type: angle
        topic: "AI agents"
        format: shortform
        contrast:
          common_belief: "A"
          surprising_truth: "B"
          strength: strong
        hook_pattern: contradiction
        score: 0.82
        status: draft
        ---

        ## Angle

        Body text.
    """), encoding="utf-8")
    fm, body = read_angle(angle_file)
    assert fm["topic"] == "AI agents"
    assert "Body text" in body


def test_read_angle_file_not_found(tmp_path):
    with pytest.raises(FileNotFoundError):
        read_angle(tmp_path / "nonexistent.md")
```

- [ ] **Step 4: Implement parse_angle.py**

Create `scripts/parse_angle.py`:

```python
#!/usr/bin/env python3
"""parse_angle.py — Parse vault angle markdown files into frontmatter + body."""
from pathlib import Path

import yaml


def parse_angle_file(content: str) -> tuple[dict, str]:
    """Split angle markdown into (frontmatter_dict, body_str).

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


def read_angle(path: Path) -> tuple[dict, str]:
    """Read and parse an angle file. Raises FileNotFoundError if missing."""
    content = Path(path).read_text(encoding="utf-8")
    return parse_angle_file(content)
```

- [ ] **Step 5: Run tests**

Run: `python3 -m pytest tests/test_parse_angle.py -v`
Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add scripts/parse_angle.py tests/test_parse_angle.py
git commit -m "feat: add parse_angle.py for vault angle file parsing"
```

---

## Task 3: Create `parse_script_library.py` — Script Library Parser

**Files:**
- Create: `scripts/parse_script_library.py`
- Create: `tests/test_parse_script_library.py`

Parses script library markdown files. Returns frontmatter and body. Used by `--from-script` flag in make-reel.

- [ ] **Step 1: Write failing tests**

Create `tests/test_parse_script_library.py`:

```python
"""Tests for scripts/parse_script_library.py"""
import textwrap
from pathlib import Path

import pytest

from scripts.parse_script_library import parse_script_file, read_script


def test_parse_script_file_returns_frontmatter_and_body():
    content = textwrap.dedent("""\
        ---
        type: script
        topic: "AI agents"
        mode: shortform
        angle_ref: "vault/library/angles/2026-05-06-ai-agents-shortform-01.md"
        hook_pattern: contradiction
        hook_score: 0.88
        duration_target: 45
        status: draft
        created: 2026-05-06
        ---

        ## Script: AI Agents Are Not Replacing You

        **Hook Pattern:** contradiction
        **Duration:** 45s
        **Format:** shortform

        ### Beat Table

        | Beat | Timecode | Type | Script | Visual Cue |
        |------|----------|------|--------|------------|
        | 1 | 0:00–0:03 | Hook | "Everyone says AI will replace junior devs" | [Visual: news headlines] |
    """)
    fm, body = parse_script_file(content)
    assert fm["type"] == "script"
    assert fm["mode"] == "shortform"
    assert fm["hook_score"] == 0.88
    assert fm["duration_target"] == 45
    assert fm["angle_ref"] == "vault/library/angles/2026-05-06-ai-agents-shortform-01.md"
    assert "Beat Table" in body
    assert "0:00–0:03" in body


def test_parse_script_file_no_frontmatter():
    content = "Just plain text."
    fm, body = parse_script_file(content)
    assert fm == {}
    assert body == content


def test_read_script_from_file(tmp_path):
    script_dir = tmp_path / "vault" / "library" / "scripts"
    script_dir.mkdir(parents=True)
    script_file = script_dir / "2026-05-06-ai-agents-heil-01.md"
    script_file.write_text(textwrap.dedent("""\
        ---
        type: script
        mode: shortform
        status: draft
        ---

        ## Script: Test

        Body content.
    """), encoding="utf-8")
    fm, body = read_script(script_file)
    assert fm["mode"] == "shortform"
    assert "Body content" in body


def test_read_script_file_not_found(tmp_path):
    with pytest.raises(FileNotFoundError):
        read_script(tmp_path / "nonexistent.md")
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python3 -m pytest tests/test_parse_script_library.py -v`
Expected: FAIL — `ModuleNotFoundError`

- [ ] **Step 3: Implement parse_script_library.py**

Create `scripts/parse_script_library.py`:

```python
#!/usr/bin/env python3
"""parse_script_library.py — Parse vault script library markdown files."""
from pathlib import Path

import yaml


def parse_script_file(content: str) -> tuple[dict, str]:
    """Split script markdown into (frontmatter_dict, body_str).

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


def read_script(path: Path) -> tuple[dict, str]:
    """Read and parse a script library file. Raises FileNotFoundError if missing."""
    content = Path(path).read_text(encoding="utf-8")
    return parse_script_file(content)
```

- [ ] **Step 4: Run tests**

Run: `python3 -m pytest tests/test_parse_script_library.py -v`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/parse_script_library.py tests/test_parse_script_library.py
git commit -m "feat: add parse_script_library.py for vault script file parsing"
```

---

## Task 4: Update Hook Patterns Reference to 7-Pattern Taxonomy

**Files:**
- Modify: `.claude/skills/viral-reel-generator/references/hook-patterns.md`

Replace the existing 5-pattern reference with the unified 7-pattern taxonomy from the spec (Section 4).

- [ ] **Step 1: Replace hook-patterns.md**

Overwrite `.claude/skills/viral-reel-generator/references/hook-patterns.md` with:

```markdown
# Viral Hook Patterns — Unified Taxonomy

The first 3 seconds determine if a viewer stays or scrolls. Seven patterns, each grounded in a specific psychological trigger.

## 1. Contradiction
*Psychology: Challenges a widely held belief head-on. Triggers cognitive dissonance — the viewer must resolve the conflict.*
- "Everyone says X. Here's why that's wrong."
- "Everything you know about [Topic] is wrong."
- "Why [Good Thing] is actually ruining your progress."
- "Stop [doing common thing]. It's destroying your [result]."

## 2. Specificity
*Psychology: Specific numbers = credibility. Concrete details bypass skepticism.*
- "I mass-produced 847 images in 12 minutes."
- "How I turned $40 into $4,000 in 12 days."
- "This 3-step routine saves me exactly 14 hours a week."

## 3. Timeframe Tension
*Psychology: Creates urgency with a closing time window. Loss aversion kicks in.*
- "In 6 months, this won't exist anymore."
- "You have 30 days before this changes everything."
- "This worked yesterday. It won't work next month."

## 4. Curiosity Gap
*Psychology: Opens an information gap the viewer must close. The mental loop stays open until resolved.*
- "There's a feature in ChatGPT nobody's talking about."
- "I found a glitch in [System] that allows you to [Result]."
- "The secret feature [Company] doesn't want you to know."

## 5. Vulnerable Confession
*Psychology: Admission of failure builds trust instantly. Viewers lean in because they relate to the struggle.*
- "I wasted 3 months on this approach."
- "I lost $10,000 because I ignored this one thing."
- "I was doing this wrong for 2 years. Here's what I changed."

## 6. Pattern Interrupt
*Psychology: Visual or tonal disruption that breaks the scroll pattern. Visuals process faster than audio.*
- **Visual:** Person looking shocked. **Audio:** "This is the worst advice I've ever heard."
- **Visual:** Shredding money/document. **Audio:** "Stop paying for this."
- **Visual:** Bold text overlay mid-action. **Audio:** Starts mid-sentence, no intro.
- Start mid-action. No "Hey guys." No "So." First frame must be jarring or unexpected.

## 7. POV as Advice
*Psychology: Reframes personal experience as actionable guidance. The "if I were you" frame makes advice feel personal, not preachy.*
- "If I were starting today, I'd do this differently."
- "If I had to rebuild my business from scratch, here's what I'd do first."
- "One thing I would never do again."

## Platform Nuances

### TikTok
- **Speed:** 0.5s tolerance. Hook must land in first frame.
- **Style:** Raw, face-to-camera or chaos.
- **Text:** Must have text on screen in the first frame matching the audio.

### Instagram Reels
- **Speed:** 1–2s tolerance.
- **Style:** Aesthetic, polished, lifestyle integration.
- **Text:** Clean typography, centered in the safe zone.

### YouTube Shorts
- **Speed:** 1–3s tolerance.
- **Style:** Story-driven, loopable.
- **Logic:** Often connects the end sentence to the start for an infinite loop.

## Hook Preference Weights

Hook selection can be influenced by weights in `vault/brand/modules/strategy.md`. Each pattern has a weight (0.0–2.0, default 1.0). Higher weight = that pattern is used more often in generation. Weights are set by the creator and can be tuned over time.
```

- [ ] **Step 2: Commit**

```bash
git add .claude/skills/viral-reel-generator/references/hook-patterns.md
git commit -m "docs: update hook-patterns.md to unified 7-pattern taxonomy"
```

---

## Task 5: Update `viral-reel-generator` Skill with Contrast Formula + New Hooks

**Files:**
- Modify: `.claude/skills/viral-reel-generator/SKILL.md`

Update the skill to reference the 7-pattern taxonomy, add contrast formula awareness, and read `strategy.md` for hook weights. Anti-slop rules stay unchanged.

- [ ] **Step 1: Update hook reference in Step 2**

In `.claude/skills/viral-reel-generator/SKILL.md`, find the "Step 2: Engineer the Hook" section and replace it:

```markdown
### Step 2: Engineer the Hook
Consult `references/hook-patterns.md` to select a hook from the 7-pattern taxonomy:
1. Contradiction  2. Specificity  3. Timeframe Tension  4. Curiosity Gap
5. Vulnerable Confession  6. Pattern Interrupt  7. POV as Advice

If `vault/brand/modules/strategy.md` exists, read its YAML frontmatter to get `hook_preferences` (a dict of pattern → weight). To load it:
1. Read the file with the Read tool
2. Parse the YAML frontmatter between `---` delimiters
3. Extract `hook_preferences` — each key is a pattern name, each value is a weight (0.0–2.0, default 1.0)
4. Favor patterns with higher weights when selecting the hook. Normalize weights to 0–1 by dividing by the max weight in the set.

If `strategy.md` is missing, treat all 7 patterns as equally weighted (1.0).

*   *Requirement:* The hook must be < 15 words and visually verifiable.
*   *Requirement:* No "Hey guys" or intros. Start mid-action.
*   *Requirement:* Apply the Contrast Formula — frame the hook as **common belief → surprising truth** when the topic supports it.
```

- [ ] **Step 2: Add contrast formula to Step 1**

In the "Step 1: Select the Angle & Style" section, add after the style selection:

```markdown
If research context is available, identify the **Contrast Formula** angle:
*   **Common Belief (A):** What most people think about this topic.
*   **Surprising Truth (B):** The reframe — what's actually true.
*   Contrast strength: mild / moderate / strong / extreme. Aim for moderate–strong.
```

- [ ] **Step 3: Add vault module loading to Workflow section**

In the "When Users Ask for a Script" section, add as the first sub-step:

```markdown
    **Load Brand Context (if available):** Read `vault/brand/modules/style.md` for tone/vocabulary, `vault/brand/modules/strategy.md` for hook preference weights, and `vault/brand/modules/niche.md` for audience context. Missing modules are fine — continue without them.
```

- [ ] **Step 4: Commit**

```bash
git add .claude/skills/viral-reel-generator/SKILL.md
git commit -m "feat: update viral-reel-generator with 7-pattern hooks and contrast formula"
```

---

## Task 6: Extend `/brand-voice` Command with 3 New Modules

**Files:**
- Modify: `.claude/commands/brand-voice.md`

Add modules 9–11 (pillars, audience, strategy) to the interview sequence. Update first-run mode, module re-run support, and final compile.

- [ ] **Step 1: Update the `--module` valid names in Section 2**

In `.claude/commands/brand-voice.md`, the `--module <name>` parse section currently only mentions 7 valid names. Update to:

```markdown
- `--module <name>` → re-run a single module; valid names: `niche style competitors goals cta watermark brand pillars audience strategy`
```

- [ ] **Step 2: Add vault/library directory creation to first-run setup**

In Section 3 ("Full First-Run Mode"), add to the `mkdir` block:

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
```

- [ ] **Step 3: Update module count reference**

Change "Run all 7 modules in sequence" to "Run all 10 modules in sequence" (photo is handled separately by `/make-post`).

- [ ] **Step 4: Add Module 8: pillars — after Module 7 (brand), before Final**

Insert after the Module 7 (brand) section and before "### Final: Compile master":

```markdown
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
```

- [ ] **Step 5: Update "Final: Compile master" section**

Change "After all 7 modules are written:" to "After all 10 modules are written:"

Update the closing report:

```markdown
Report to user:
~~~
✓ /brand-voice complete
Brand profile saved to vault/brand/brand-voice.md (Obsidian-ready)

Module status:
<paste output of: python3 scripts/brand_voice.py --vault vault/ status>

Run /make-reel, /make-carousel, or /viral-angle to use your brand automatically.
~~~
```

- [ ] **Step 6: Commit**

```bash
git add .claude/commands/brand-voice.md
git commit -m "feat: add pillars, audience, strategy modules to brand-voice interview"
```

---

## Task 7: Create `/viral-angle` Command

**Files:**
- Create: `.claude/commands/viral-angle.md`

This is the main angle generation command. It's an LLM-orchestrated slash command (no Python script — Claude executes the phases directly).

- [ ] **Step 1: Create the command file**

Create `.claude/commands/viral-angle.md`:

```markdown
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
- `--format` — one of: `shortform`, `longform`, `linkedin`, `carousel`, `post`, `all`. Default: `all`
- `--count N` — angles per format. Default: `5`

If `--format all`, set FORMAT_LIST to `["shortform", "longform", "linkedin", "carousel", "post"]`.
Otherwise, set FORMAT_LIST to a single-element list with the specified format.

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
```

- [ ] **Step 2: Commit**

```bash
git add .claude/commands/viral-angle.md
git commit -m "feat: add /viral-angle command for contrast formula angle generation"
```

---

## Task 8: Create `/viral-script` Command

**Files:**
- Create: `.claude/commands/viral-script.md`

LLM-orchestrated command that generates hooks and scripts from angles or topics. Three modes: shortform (HEIL), longform (3P's), linkedin.

- [ ] **Step 1: Create the command file**

Create `.claude/commands/viral-script.md`:

```markdown
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
- `--mode` — REQUIRED. One of: `shortform`, `longform`, `linkedin`

Exactly one of `--angle` or `--topic` must be provided. If neither or both, stop:
> `[ERROR] Provide exactly one of --angle <path> or --topic "<text>"`

If `--mode` is missing, stop:
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
```

- [ ] **Step 2: Commit**

```bash
git add .claude/commands/viral-script.md
git commit -m "feat: add /viral-script command for hook and script generation"
```

---

## Task 9: Add `--from-angle` and `--from-script` Flags to `/make-reel`

**Files:**
- Modify: `.claude/commands/make-reel.md`

Add two new optional flags. When present, they skip early pipeline stages.

- [ ] **Step 1: Update the argument parsing section (Section 0)**

In `.claude/commands/make-reel.md`, find the "Parse `$ARGUMENTS`:" block and add two new flags:

```markdown
Parse `$ARGUMENTS`:
- `url-or-topic` — everything before any `--` flags (required UNLESS --from-angle or --from-script is set)
- `--duration N` — default `45` (seconds)
- `--style punchy|deep-dive` — default `punchy`
- `--auto-publish instagram|linkedin|all` — optional; if present, publish after pipeline completes. Store in `$AUTO_PUBLISH`.
- `--from-angle <path>` — optional; path to a vault angle file. Skips Stage 1 (Research). The angle's contrast, talking_points, and hook_pattern replace research context.
- `--from-script <path>` — optional; path to a vault script file. Skips Stage 1 (Research) AND Stage 2 (Script). Pipeline starts at Stage 3 (HeyGen Video). Script must contain timecodes and `[Visual: ...]` cues.

If `--from-angle` is set, `url-or-topic` is not required (topic comes from the angle file).
If `--from-script` is set, `url-or-topic`, `--duration`, and `--style` are ignored.
`--from-angle` and `--from-script` are mutually exclusive. If both are present, stop: `[ERROR] Use --from-angle OR --from-script, not both.`
```

- [ ] **Step 2: Add angle/script loading between Section 1 and Stage 1**

After the "## 1. Create Session Folder" section and before "## 2. Stage 1 — Research", add:

```markdown
## 1.3. Load Angle or Script (conditional)

**If `--from-angle` is set:**

```bash
python3 -c "
from scripts.parse_angle import read_angle
import yaml
fm, body = read_angle('$FROM_ANGLE_PATH')
print(yaml.dump(fm, default_flow_style=False))
print('---')
print(body)
"
```

Read the output. Extract `topic`, `contrast`, `hook_pattern`, `talking_points` from the frontmatter, and the angle body. These replace the research output in Stage 2.

Set `$TOPIC` from the angle's `topic` field if not already set from arguments.

**Skip to Stage 2.**

**If `--from-script` is set:**

```bash
python3 -c "
from scripts.parse_script_library import read_script
import yaml
fm, body = read_script('$FROM_SCRIPT_PATH')
print(yaml.dump(fm, default_flow_style=False))
print('---')
print(body)
"
```

Read the output. The body IS the script. Write it to `$SESSION_DIR/script.md`.

Set `$TOPIC` from the script's `topic` field.

Validate: script body must contain at least one `(M:SS)` timecode and at least one `[Visual: ...]` line. If validation fails, stop: `[ERROR] Script file missing timecodes or visual cues — cannot use with make-reel.`

**Skip to Stage 3.**
```

- [ ] **Step 3: Add skip guard to Stage 1 (Research)**

At the top of "## 2. Stage 1 — Research", add:

```markdown
**Skip this stage if `--from-angle` or `--from-script` is set.**
```

- [ ] **Step 4: Add skip guard to Stage 2 (Script)**

At the top of "## 3. Stage 2 — Script", add:

```markdown
**Skip this stage if `--from-script` is set.**

**If `--from-angle` is set:** Pass the angle's contrast, talking_points, and hook_pattern to the viral-reel-generator skill as research context instead of `$SESSION_DIR/research.md`.
```

- [ ] **Step 5: Commit**

```bash
git add .claude/commands/make-reel.md
git commit -m "feat: add --from-angle and --from-script flags to make-reel"
```

---

## Task 10: Add `--from-angle` Flag to `/make-carousel`

**Files:**
- Modify: `.claude/commands/make-carousel.md`

- [ ] **Step 1: Update argument parsing (Section 0)**

In `.claude/commands/make-carousel.md`, add to the "Parse `$ARGUMENTS`:" block:

```markdown
- `--from-angle <path>` — optional; path to a vault angle file. Skips Stage 1 (Research). The angle's talking_points seed the slide plan.
```

Add after the mode flag parsing:

```markdown
If `--from-angle` is set, `<input>` is not required (topic comes from the angle file).
```

- [ ] **Step 2: Add angle loading section**

After "## 1. Create Session Folder" and before "## 2. Stage 1 — Research", add:

```markdown
## 1.3. Load Angle (conditional)

**If `--from-angle` is set:**

```bash
python3 -c "
from scripts.parse_angle import read_angle
import yaml
fm, body = read_angle('$FROM_ANGLE_PATH')
print(yaml.dump(fm, default_flow_style=False))
print('---')
print(body)
"
```

Extract `topic`, `contrast`, `talking_points`, and `hook_pattern`. Write the angle body + talking points to `$SESSION_DIR/research.md` as the research output.

Set `$INPUT` from the angle's `topic` field if not already set.

**Skip to Stage 2 (Plan Slides).**
```

- [ ] **Step 3: Add skip guard to Stage 1**

At the top of "## 2. Stage 1 — Research", add:

```markdown
**Skip this stage if `--from-angle` is set.**
```

- [ ] **Step 4: Commit**

```bash
git add .claude/commands/make-carousel.md
git commit -m "feat: add --from-angle flag to make-carousel"
```

---

## Task 11: Add `--from-angle` Flag to `/make-post`

**Files:**
- Create or Modify: `.claude/commands/make-post.md`

Note: This file may not exist yet (it's part of the make-post spec which may not be implemented). If the file exists, modify it. If it doesn't exist, skip this task and note it as a dependency on the make-post implementation.

- [ ] **Step 1: Check if make-post.md exists**

```bash
ls -la .claude/commands/make-post.md 2>/dev/null || echo "FILE NOT FOUND"
```

If the file does not exist, **skip this task entirely**. Add a note:

```
[SKIPPED] make-post.md does not exist yet. The --from-angle flag will be added when /make-post is implemented per its own spec.
```

If the file exists, proceed to Step 2.

- [ ] **Step 2: Update argument parsing**

Add to the command's argument parsing section:

```markdown
- `--from-angle <path>` — optional; path to a vault angle file. Skips research stage. The angle's contrast, one_liner, and image_concept (if present) replace research context.
```

Add:

```markdown
If `--from-angle` is set, `<url-or-topic>` is not required.
```

- [ ] **Step 3: Add angle loading section**

After session creation and before the research stage, add:

```markdown
## Load Angle (conditional)

**If `--from-angle` is set:**

```bash
python3 -c "
from scripts.parse_angle import read_angle
import yaml
fm, body = read_angle('$FROM_ANGLE_PATH')
print(yaml.dump(fm, default_flow_style=False))
print('---')
print(body)
"
```

Extract `topic`, `contrast`, `one_liner`, `talking_points`, and `image_concept` (if present — only on `post` format angles).

- For content analysis (Stage 5): use the angle's contrast and talking_points to decide photo approach
- For caption generation: use contrast and hook_pattern for a punchier opening line
- If `image_concept` is present: pass it directly to the GPT-image-2 prompt
- If no `image_concept`: derive a visual concept from `one_liner` + `talking_points[0]`

**Skip the research stage.**
```

- [ ] **Step 4: Add skip guard to research stage**

At the top of the research stage, add:

```markdown
**Skip this stage if `--from-angle` is set.**
```

- [ ] **Step 5: Commit (only if file was modified)**

```bash
git add .claude/commands/make-post.md
git commit -m "feat: add --from-angle flag to make-post"
```

---

## Task 12: Create `vault/library/` Directory Structure

**Files:**
- Create: `vault/library/angles/.gitkeep`
- Create: `vault/library/scripts/.gitkeep`

- [ ] **Step 1: Create directories with .gitkeep files**

```bash
mkdir -p vault/library/angles vault/library/scripts
touch vault/library/angles/.gitkeep vault/library/scripts/.gitkeep
```

- [ ] **Step 2: Commit**

```bash
git add vault/library/
git commit -m "feat: add vault/library/ directory structure for angles and scripts"
```

---

## Task 13: Run Full Test Suite and Verify

- [ ] **Step 1: Run all tests**

```bash
python3 -m pytest tests/ -v
```

Expected: ALL PASS

- [ ] **Step 2: Verify new module support end-to-end**

```bash
python3 -c "
from scripts.brand_voice import MODULES, SECTION_NAMES, module_status
from pathlib import Path
print('Modules:', MODULES)
print('Section names:', list(SECTION_NAMES.keys()))
# Verify all modules have section names
for m in MODULES:
    assert m in SECTION_NAMES, f'{m} missing from SECTION_NAMES'
print('All modules have section names ✓')
"
```

- [ ] **Step 3: Verify parsers work**

```bash
python3 -c "
from scripts.parse_angle import parse_angle_file
from scripts.parse_script_library import parse_script_file
# Quick smoke test
fm, body = parse_angle_file('---\ntype: angle\ntopic: test\n---\nBody')
assert fm['type'] == 'angle'
fm2, body2 = parse_script_file('---\ntype: script\nmode: shortform\n---\nBody')
assert fm2['mode'] == 'shortform'
print('Parsers work ✓')
"
```

- [ ] **Step 4: Commit any fixes if tests failed**

If any test failed, fix the issue and commit with an appropriate message.

---

## Summary of Commits

| # | Commit Message | Files |
|---|---------------|-------|
| 1 | `feat: add pillars, audience, strategy modules to brand_voice.py` | `scripts/brand_voice.py`, `tests/test_brand_voice.py` |
| 2 | `feat: add parse_angle.py for vault angle file parsing` | `scripts/parse_angle.py`, `tests/test_parse_angle.py` |
| 3 | `feat: add parse_script_library.py for vault script file parsing` | `scripts/parse_script_library.py`, `tests/test_parse_script_library.py` |
| 4 | `docs: update hook-patterns.md to unified 7-pattern taxonomy` | `.claude/skills/.../hook-patterns.md` |
| 5 | `feat: update viral-reel-generator with 7-pattern hooks and contrast formula` | `.claude/skills/.../SKILL.md` |
| 6 | `feat: add pillars, audience, strategy modules to brand-voice interview` | `.claude/commands/brand-voice.md` |
| 7 | `feat: add /viral-angle command for contrast formula angle generation` | `.claude/commands/viral-angle.md` |
| 8 | `feat: add /viral-script command for hook and script generation` | `.claude/commands/viral-script.md` |
| 9 | `feat: add --from-angle and --from-script flags to make-reel` | `.claude/commands/make-reel.md` |
| 10 | `feat: add --from-angle flag to make-carousel` | `.claude/commands/make-carousel.md` |
| 11 | `feat: add --from-angle flag to make-post` (conditional) | `.claude/commands/make-post.md` |
| 12 | `feat: add vault/library/ directory structure for angles and scripts` | `vault/library/` |
| 13 | verification pass — fix any issues | varies |
