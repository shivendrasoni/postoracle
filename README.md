# PostOracle

AI-powered content creation pipeline that turns any URL, topic, or idea into publish-ready social media content — reels, carousels, single-image posts, and LinkedIn text — using [Claude Code](https://docs.anthropic.com/en/docs/claude-code) as the orchestrator.

Built for creators who want to go from "I have an idea" to "it's live on Instagram" in a single command.

## What It Does

PostOracle is a **Claude Code project** — a set of slash commands and Python scripts that form an end-to-end content pipeline:

1. **Research** — Scrape a URL or research a topic via web search
2. **Angle** — Generate high-contrast viral angles scored against your brand
3. **Script** — Write production-ready scripts with hooks, beats, and CTAs
4. **Create** — Render carousels (Pillow), generate presenter videos (HeyGen), or compose image posts (GPT-image-2)
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

- **[Claude Code](https://docs.anthropic.com/en/docs/claude-code)** — CLI, desktop app, or IDE extension
- **Python 3.11+**
- **[Composio CLI](https://composio.dev)** — for publishing (`npm install -g @composio/cli`)
- **[HeyGen](https://heygen.com)** account — for video generation

### Setup

```bash
# Clone the project
git clone git@github.com:shivendrasoni/postoracle.git
cd postoracle

# Install Python dependencies
pip install -r requirements.txt

# Configure API keys
cp .env.example .env
# Edit .env and fill in: OPENAI_API_KEY, HEYGEN_API_KEY, PEXELS_API_KEY

# Connect social platforms (for publishing)
composio link instagram
composio link linkedin
```

### First Run

Open the project in Claude Code, then:

```
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
/make-reel "Why most AI agents fail" --auto-publish instagram
```

**`/make-carousel <url-or-topic>`** — Branded slide deck with caption, ready for Instagram or LinkedIn.

```
/make-carousel https://github.com/openai/openai-python --platform linkedin --slides 6 --auto
/make-carousel "5 things senior devs know about AI" --platform instagram
```

**`/make-post <url-or-topic>`** — Single-image post tailored per platform (visual or text-card mode).

```
/make-post "The hidden cost of microservices" --platform all --mode visual
/make-post https://example.com/article --auto-publish instagram
```

### Pre-Production

**`/viral-angle <topic-or-url>`** — Generate scored content angles using the Contrast Formula (common belief vs. surprising truth). Angles are saved to `vault/library/angles/` and can be fed into `/make-reel`, `/make-carousel`, or `/viral-script`.

```
/viral-angle "AI agents" --format shortform --count 5
/viral-angle https://example.com/article --format all
```

**`/viral-script --angle <path> --mode <mode>`** — Generate 10 scored hooks and a full production script from an angle or inline topic. Modes: `shortform` (HEIL beats, 15–60s), `longform` (3P's intro, 8–15 min), `linkedin` (text post).

```
/viral-script --angle vault/library/angles/2026-05-06-ai-agents-shortform-01.md --mode shortform
/viral-script --topic "AI agents are not replacing junior devs" --mode linkedin
```

### Identity & Brand

**`/brand-voice`** — Interactive interview that builds your creator profile across 11 modules: niche, style, competitors, goals, CTA, watermark, brand colors, content pillars, audience personas, strategy, and photo. Stored in `vault/brand/` and consumed by all creation commands.

```
/brand-voice                  # Full 11-module interview
/brand-voice --module cta     # Re-run a single module
/brand-voice --list           # Check module status
```

**`/heygen-avatar`** — Create a persistent HeyGen digital twin (face + voice) for presenter videos. Produces `AVATAR-USER.md` consumed by `/make-reel` and `/heygen-video`.

**`/heygen-video <topic>`** — Standalone HeyGen presenter video (without the full reel pipeline).

### Publishing

**`/publish`** — Push any generated session to Instagram, LinkedIn, X, or all platforms. With no arguments, shows unpublished content from the registry for selection.

```
/publish                                          # Pick from unpublished list
/publish "microservices" --platform instagram      # Fuzzy match session name
/publish vault/outputs/carousels/2026-05-06-ai --platform all  # Direct path
```

All creation commands also support `--auto-publish <platform>` to publish immediately after generation.

**`/add-platform <name>`** — Scaffold a new platform handler in the publisher by discovering Composio tool slugs.

## Project Structure

```
postoracle/
├── CLAUDE.md                 # Project instructions for Claude Code
├── .claude/
│   ├── commands/             # Slash command definitions
│   │   ├── make-reel.md
│   │   ├── make-carousel.md
│   │   ├── make-post.md
│   │   ├── viral-angle.md
│   │   ├── viral-script.md
│   │   ├── brand-voice.md
│   │   ├── publish.md
│   │   ├── heygen-avatar.md
│   │   ├── heygen-video.md
│   │   └── add-platform.md
│   └── skills/               # Third-party skill packs
│       ├── heygen-skills/    # HeyGen avatar & video skills
│       ├── viral-reel-generator/  # Script generation engine
│       ├── stop-slop.md      # Anti-AI-writing-patterns rules
│       └── video-use.md      # Video editing orchestrator
├── scripts/                  # Python backend
│   ├── brand_voice.py        # Brand module read/write/compile
│   ├── generate_carousel.py  # Slide renderer (Pillow + OpenAI)
│   ├── generate_post.py      # Single-image post generator
│   ├── publish.py            # Multi-platform publisher (Composio)
│   ├── registry.py           # Content registry (JSON-backed)
│   ├── fetch_broll.py        # B-roll video/photo fetcher
│   ├── fetch_images.py       # Stock image fetcher
│   ├── fetch_sfx.py          # Sound effects fetcher
│   ├── watermark.py          # Branded watermark overlay
│   ├── parse_angle.py        # Angle file parser
│   ├── parse_script.py       # Script → beats JSON parser
│   ├── create_session.py     # Session directory scaffolding
│   ├── build_manifest.py     # Asset manifest builder
│   ├── check_env.py          # Environment variable validator
│   └── import_platform.py    # Platform export file importer
├── tests/                    # Test suite (mirrors scripts/)
├── vault/                    # Content vault (gitignored)
│   ├── brand/                # Brand identity profiles
│   │   ├── brand-voice.md    # Compiled brand voice
│   │   └── modules/          # 11 individual brand modules
│   ├── library/
│   │   ├── angles/           # Generated content angles
│   │   └── scripts/          # Generated scripts
│   ├── outputs/
│   │   ├── reels/            # Rendered video sessions
│   │   ├── carousels/        # Rendered carousel sessions
│   │   └── posts/            # Rendered post sessions
│   ├── imports/              # Platform exports for style analysis
│   ├── assets/               # Logo, photos, brand assets
│   ├── logs/                 # Pipeline run logs
│   ├── content-registry.json # Content tracking database
│   └── content-dashboard.md  # Obsidian dataview dashboard
├── .mcp.json                 # MCP server config (HeyGen)
├── .env.example              # API key template
├── .env                      # API keys (gitignored)
├── AVATAR-USER.md            # Active HeyGen avatar config
└── requirements.txt          # Python dependencies
```

## How It Works

PostOracle is a **Claude Code project**. The slash commands in `.claude/commands/` define multi-stage pipelines that Claude executes by orchestrating Python scripts, web research, API calls, and AI generation.

```
Topic/URL → Research → Angle → Script → Asset Generation → Publishing
                                              │
                              ┌────────────────┼────────────────┐
                              │                │                │
                          HeyGen Video    Pillow Slides    AI Image
                          (/make-reel)   (/make-carousel)  (/make-post)
```

**Key integrations:**

- **HeyGen** — AI presenter video generation with custom avatars, connected via MCP server
- **OpenAI** — Image generation (GPT-image-2) for posts and carousel slides
- **Composio** — Unified publishing API for Instagram, LinkedIn, and X
- **Pexels** — B-roll video and stock photo sourcing
- **Obsidian** — The vault is Obsidian-compatible with a dataview dashboard

## Brand System

The brand voice system (`/brand-voice`) captures 11 modules that inform all content generation:

| Module | Purpose |
|--------|---------|
| `niche` | Your space, sub-niches, target audience, transformation |
| `style` | Tone, pace, vocabulary (can import from Instagram/LinkedIn/X exports) |
| `competitors` | Who you watch, who inspires you, what to avoid |
| `goals` | Per-post success metrics by platform |
| `cta` | Call-to-action templates per platform and goal |
| `watermark` | Handle, logo, 3x3 position grid, opacity |
| `brand` | Colors (5 roles: primary/secondary/accent/background/text), font, logo |
| `pillars` | Content themes with subtopics and content jobs |
| `audience` | Deep-dive personas, psychographics, belief blockers |
| `strategy` | Hook pattern preferences (7 types, weighted), content funnel mapping |
| `photo` | Your photo + physical description for AI image generation |

Brand modules are stored as YAML-frontmatter markdown files in `vault/brand/modules/` and compiled into a single `vault/brand/brand-voice.md`. All creation commands auto-load relevant modules.

## Content Registry

Every generated piece is tracked in `vault/content-registry.json`:

- Content type, status (`draft` / `published`), virality score
- Target platforms and publish timestamps with URLs
- Session directory path for asset retrieval

View it in Obsidian via `vault/content-dashboard.md` (dataview query).

## Viral Angle System

The Contrast Formula engine (`/viral-angle`) generates content angles structured as **common belief vs. surprising truth**. Each angle is:

- Mapped to a content pillar from your brand
- Scored using contrast strength, pillar relevance, audience blocker match, and hook preference weights
- Saved as Obsidian-friendly markdown with YAML frontmatter
- Consumable by `/make-reel --from-angle`, `/make-carousel --from-angle`, and `/viral-script --angle`

## Testing

```bash
pytest tests/ -v
```

Every script in `scripts/` has a corresponding test file in `tests/`.

## API Keys

| Key | Required | Used by |
|-----|----------|---------|
| `OPENAI_API_KEY` | Yes | Image generation, carousel rendering |
| `HEYGEN_API_KEY` | Yes | Presenter video generation |
| `PEXELS_API_KEY` | Yes | B-roll and stock images |
| `PIXABAY_API_KEY` | No | Fallback stock images |
| `ELEVENLABS_API_KEY` | No | Voice synthesis (video editing) |

## License

MIT
