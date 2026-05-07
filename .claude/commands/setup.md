---
description: First-time setup wizard — checks dependencies, API keys, platform connections, brand voice, and avatar config.
argument-hint: "[--check]"
allowed-tools: Bash, Read, Write
---

# /setup — First-Time Setup Wizard

Walk the user through everything needed to use PostOracle. Check each requirement, report status, and guide through fixing anything missing. Be conversational — this is their first experience with the project.

## 0. Welcome

Display:

```
 ____           _    ___                  _
|  _ \ ___  ___| |_ / _ \ _ __ __ _  ___| | ___
| |_) / _ \/ __| __| | | | '__/ _` |/ __| |/ _ \
|  __/ (_) \__ \ |_| |_| | | | (_| | (__| |  __/
|_|   \___/|___/\__|\___/|_|  \__,_|\___|_|\___|

  Welcome to PostOracle setup!
  Let's get everything configured.
```

If `$ARGUMENTS` is `--check`, run all checks silently and just print the status report (Step 7). Skip interactive guidance.

## 1. Python Dependencies

```bash
python3 --version 2>&1
```

Check Python 3.11+. If version is too old or missing, stop:
> "Python 3.11+ is required. Install it from python.org or via your package manager."

Check if dependencies are installed:

```bash
python3 -c "import requests, openai, PIL, colorthief, yaml, pytest" 2>&1
```

If any import fails:
> "Some Python dependencies are missing. Install them?"

If the user agrees (or in non-interactive mode):
```bash
pip install -r requirements.txt
```

Mark: `PYTHON_DEPS=ok` or `PYTHON_DEPS=missing`

## 2. Environment File & API Keys

Check if `.env` exists:

```bash
[ -f .env ] && echo "exists" || echo "missing"
```

**If `.env` is missing:**
> "No `.env` file found. Let me create one from the template."

```bash
cp .env.example .env
```

**Check each key:**

```bash
set -a && source .env && set +a
python3 scripts/check_env.py
```

Parse the output. For each missing required key, ask the user one at a time:

**OPENAI_API_KEY** (required):
> "I need your OpenAI API key for image generation (carousels and posts)."
> "Get one at: https://platform.openai.com/api-keys"
> "Paste your key:"

**HEYGEN_API_KEY** (required):
> "I need your HeyGen API key for video generation."
> "Get one at: https://app.heygen.com/settings — under API"
> "Paste your key:"

**PEXELS_API_KEY** (required):
> "I need your Pexels API key for b-roll and stock images."
> "Get one at: https://www.pexels.com/api/new/"
> "Paste your key:"

For each key the user provides, write it to `.env`:

```bash
# Replace the empty value for the key in .env
sed -i '' "s/^OPENAI_API_KEY=.*/OPENAI_API_KEY=$USER_VALUE/" .env
```

**Optional keys** — mention but don't block:
> "Optional: PIXABAY_API_KEY (fallback images) and ELEVENLABS_API_KEY (voice synthesis). You can add these later to `.env` if needed."

After all required keys are set, verify:

```bash
set -a && source .env && set +a
python3 scripts/check_env.py
```

Mark: `API_KEYS=ok` or `API_KEYS=partial`

## 3. Composio CLI (Publishing)

```bash
which composio 2>/dev/null || ls ~/.composio/composio 2>/dev/null
```

**If not found:**
> "Composio CLI is needed for publishing to Instagram/LinkedIn/X."
> "Install it with: `npm install -g @composio/cli`"
> "You can skip this for now — everything except `/publish` will work without it."

**If found, check connections:**

```bash
composio whoami 2>&1
```

If authenticated, check platform connections:

```bash
composio apps 2>&1 | grep -iE "instagram|linkedin|twitter" || echo "no platforms connected"
```

> "To connect platforms for publishing, run these when ready:"
> "  `composio link instagram`"
> "  `composio link linkedin`"

Mark: `COMPOSIO=ok`, `COMPOSIO=installed` (no platforms), or `COMPOSIO=missing`

## 4. Vault Directory

```bash
[ -d vault/brand/modules ] && echo "exists" || echo "missing"
```

**If missing:**
> "Creating the vault directory structure..."

```bash
mkdir -p vault/brand/modules
mkdir -p vault/outputs/reels
mkdir -p vault/outputs/carousels
mkdir -p vault/outputs/posts
mkdir -p vault/library/angles
mkdir -p vault/library/scripts
mkdir -p vault/imports
mkdir -p vault/assets
mkdir -p vault/logs
```

Mark: `VAULT=ok`

## 5. Brand Voice

```bash
python3 scripts/brand_voice.py --vault vault status 2>&1
```

**If no modules are complete:**
> "Your brand voice isn't set up yet. This is what makes your content sound like YOU."
> "Run `/brand-voice` after setup to configure it — takes about 10 minutes."

**If some modules are complete:**
> "Brand voice partially configured. Run `/brand-voice --list` to see what's done."

Mark: `BRAND=complete`, `BRAND=partial`, or `BRAND=not started`

## 6. HeyGen Avatar

```bash
[ -f AVATAR-USER.md ] && echo "exists" || echo "missing"
```

**If missing:**
> "No HeyGen avatar configured. This is your digital presenter for video content."
> "Run `/heygen-avatar` after setup to create one."

**If exists:**
> "HeyGen avatar configured."

Read `AVATAR-USER.md` and show the avatar name/group from the file.

Mark: `AVATAR=ok` or `AVATAR=missing`

## 7. Status Report

Display the final status:

```
  ┌─────────────────────────────────────────┐
  │         PostOracle Setup Status          │
  ├─────────────────────────────────────────┤
  │                                         │
  │  Python deps     ✓ installed            │
  │  API keys        ✓ all set              │
  │  Composio        ⚠ not installed        │
  │  Vault           ✓ ready                │
  │  Brand voice     ○ not started          │
  │  HeyGen avatar   ○ not configured       │
  │                                         │
  ├─────────────────────────────────────────┤
  │  Legend: ✓ ready  ⚠ optional  ○ todo    │
  └─────────────────────────────────────────┘
```

Use these symbols:
- `✓` — ready to go
- `⚠` — optional or partially done (won't block content creation)
- `✗` — required but missing (blocks content creation)
- `○` — not started yet (recommended next step)

## 8. Next Steps

Based on status, recommend the logical next action:

**If API keys are missing:**
> "Add your API keys to `.env` first, then re-run `/setup --check`."

**If everything required is set but no brand voice:**
> "You're ready to create content! Start with `/brand-voice` to set up your brand identity — it makes everything you create sound like you."

**If brand voice is done but no avatar:**
> "Try `/heygen-avatar` to create your digital presenter, or jump straight to `/make-post` or `/make-carousel`."

**If everything is configured:**
> "You're all set! Try one of these:"
> "  `/make-post \"your topic here\"` — quickest way to create content"
> "  `/make-carousel \"your topic\"` — branded slide deck"
> "  `/viral-angle \"your topic\"` — generate content angles first, then create from them"
