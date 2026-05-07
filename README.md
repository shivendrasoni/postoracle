# PostOracle

AI-powered content creation pipeline that turns any URL, topic, or idea into publish-ready social media content — reels, carousels, single-image posts, and LinkedIn text — using Claude Code as the orchestrator.

Built for creators who want to go from "I have an idea" to "it's live on Instagram" in a single command.

## What It Does

PostOracle is a collection of Claude Code skills and Python scripts that form an end-to-end content pipeline:

1. **Research** — Scrape a URL or research a topic via web search
2. **Angle** — Generate high-contrast viral angles scored against your brand
3. **Script** — Write production-ready scripts with hooks, beats, and CTAs
4. **Create** — Render carousels (Pillow), generate presenter videos (HeyGen), or compose image posts
5. **Publish** — Push to Instagram, LinkedIn, and X via Composio
6. **Track** — Log everything in a content registry with an Obsidian dashboard

## Content Types

| Type | Command | Output |
|------|---------|--------|
| Short-form video (Reels/Shorts) | `/make-reel` | Portrait MP4 with HeyGen presenter + b-roll |
| Carousel (Instagram/LinkedIn) | `/make-carousel` | 5–6 branded slide PNGs + caption |
| Single-image post | `/make-post` | Platform-tailored image + caption per platform |
| LinkedIn text post | `/viral-script --mode linkedin` | Long-form text post |

## Quick Start

### Prerequisites

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) CLI installed
- Python 3.11+
- [Composio CLI](https://composio.dev) for publishing (`npm install -g @composio/cli`)
- HeyGen account (for video generation)

### Setup

```bash
git clone git@github.com:shivendrasoni/postoracle.git
cd postoracle

# Install Python dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Fill in API keys: OPENAI_API_KEY, HEYGEN_API_KEY, etc.

# Connect social platforms for publishing
composio link instagram
composio link linkedin
```

### First Run

```bash
# 1. Set up your brand identity (interactive interview)
/brand-voice

# 2. Create your HeyGen avatar (for video content)
/heygen-avatar "Your Name — professional tech educator"

# 3. Generate your first piece of content
/make-post "AI agents are the new junior devs" --platform instagram
```

## Commands

### Content Creation

**`/make-reel <url-or-topic>`** — Full video pipeline: research, script, HeyGen recording, b-roll overlay, final edit.

```
/make-reel https://martinfowler.com/articles/microservices.html --style punchy --duration 45
```

**`/make-carousel <url-or-topic>`** — Branded slide deck with caption, ready for Instagram or LinkedIn.

```
/make-carousel https://github.com/openai/openai-python --platform linkedin --slides 6 --auto
```

**`/make-post <url-or-topic>`** — Single-image post tailored per platform (visual or text-card mode).

```
/make-post "The hidden cost of microservices" --platform all --mode visual
```

### Pre-Production

**`/viral-angle <topic-or-url>`** — Generate scored content angles using the Contrast Formula (common belief vs. surprising truth).

```
/viral-angle "AI agents" --format shortform --count 5
```

**`/viral-script --angle <path> --mode <mode>`** — Generate hooks and a production script from an angle file.

```
/viral-script --angle vault/library/angles/2026-05-06-ai-agents-shortform-01.md --mode shortform
```

### Identity & Brand

**`/brand-voice`** — Modular interview that builds your creator profile: niche, tone, colors, fonts, CTAs, audience personas, and content strategy. Stored in `vault/brand/` and consumed by all creation commands.

```
/brand-voice                  # Full 11-module interview
/brand-voice --module cta     # Re-run a single module
/brand-voice --list           # Check module status
```

**`/heygen-avatar`** — Create a persistent HeyGen digital twin (face + voice) for presenter videos.

### Publishing

**`/publish --session-dir <path> --platform <platform>`** — Push any generated session to Instagram, LinkedIn, X, or all platforms. Sends email notification and updates the content registry.

All creation commands also support `--auto-publish <platform>` to publish immediately after generation.

## Project Structure

```
postoracle/
├── scripts/              # Python backend
│   ├── brand_voice.py    # Brand profile read/write/compile
│   ├── generate_carousel.py  # Slide renderer (Pillow + OpenAI)
│   ├── generate_post.py  # Single-image post generator
│   ├── publish.py        # Multi-platform publisher via Composio
│   ├── registry.py       # Content registry (JSON-backed)
│   ├── fetch_broll.py    # B-roll video fetcher
│   ├── fetch_images.py   # Stock image fetcher
│   ├── fetch_sfx.py      # Sound effects fetcher
│   ├── watermark.py      # Branded watermark overlay
│   ├── parse_angle.py    # Angle file parser
│   ├── parse_script.py   # Script file parser
│   ├── create_session.py # Session directory scaffolding
│   └── build_manifest.py # Build manifest generator
├── tests/                # Test suite (mirrors scripts/)
├── vault/                # Content vault (gitignored)
│   ├── brand/            # Brand identity profiles
│   │   ├── brand-voice.md        # Compiled brand voice
│   │   └── modules/              # Individual brand modules
│   ├── library/
│   │   ├── angles/       # Generated content angles
│   │   └── scripts/      # Generated scripts
│   ├── outputs/          # Generated content (reels, carousels, posts)
│   ├── content-registry.json     # Content tracking database
│   └── content-dashboard.md      # Obsidian dataview dashboard
├── .claude/skills/       # Claude Code skill definitions
├── AVATAR-USER.md        # Active HeyGen avatar config
├── .mcp.json             # MCP server config (HeyGen)
└── .env                  # API keys (not committed)
```

## How It Works

PostOracle runs as a set of **Claude Code skills** — slash commands that orchestrate Python scripts, API calls, and AI generation into cohesive pipelines.

**The content pipeline:**

```
Topic/URL → Research → Angle → Script → Asset Generation → Publishing
                                              │
                              ┌────────────────┼────────────────┐
                              │                │                │
                          HeyGen Video    Pillow Slides    AI Image
                          (make-reel)   (make-carousel)   (make-post)
```

**Key integrations:**

- **HeyGen** — AI presenter video generation with custom avatars via MCP server
- **OpenAI** — Image generation (DALL-E) for posts and carousel slides
- **Composio** — Unified publishing to Instagram, LinkedIn, and X
- **Obsidian** — Content vault with dataview dashboard for tracking

## Brand System

The brand voice system (`/brand-voice`) captures 11 modules that inform all content generation:

| Module | Purpose |
|--------|---------|
| Niche | Your space, sub-niches, target audience |
| Style | Tone, pace, vocabulary (can import from platform exports) |
| Competitors | Who you watch, what to avoid |
| Goals | Per-post success metrics |
| CTA | Call-to-action templates per platform |
| Watermark | Handle, logo, positioning |
| Brand | Colors (5 roles), fonts, logo |
| Pillars | Content themes and topics |
| Audience | Deep-dive personas |
| Strategy | Posting cadence and approach |
| Photo | Your photo + description for AI image generation |

## Content Registry

Every piece of generated content is tracked in `vault/content-registry.json` with:

- Content type, status (draft/published), virality score
- Target platforms and publish timestamps
- Session directory path for asset retrieval

View it all in Obsidian via the `vault/content-dashboard.md` dataview dashboard.

## Testing

```bash
pytest tests/ -v
```

Every script in `scripts/` has a corresponding test file in `tests/`.

## License

Private project.
