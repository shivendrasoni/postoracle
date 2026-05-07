# PostOracle

AI-powered content creation pipeline. Turns any URL, topic, or idea into publish-ready social media content using Claude Code as the orchestrator.

## Quick Start

```bash
pip install -r requirements.txt
cp .env.example .env   # fill in API keys
```

Then run `/brand-voice` to set up your creator identity, and `/heygen-avatar` to create your digital presenter.

## Commands

| Command | What it does |
|---------|-------------|
| `/make-reel <topic>` | Full video pipeline: research → script → HeyGen → b-roll → edit |
| `/make-carousel <topic>` | 5–6 branded slide images + caption |
| `/make-post <topic>` | Single-image post per platform |
| `/viral-angle <topic>` | Generate scored content angles (Contrast Formula) |
| `/viral-script --angle <path> --mode <mode>` | Hooks + production script from an angle |
| `/brand-voice` | Interactive brand identity builder (11 modules) |
| `/heygen-avatar` | Create HeyGen digital twin |
| `/heygen-video <topic>` | Standalone HeyGen presenter video |
| `/publish` | Push content to Instagram, LinkedIn, X |
| `/add-platform <name>` | Scaffold a new publishing platform |

## Architecture

```
User → Slash Command → Pipeline Stages → Output
                          │
              ┌───────────┼───────────┐
              │           │           │
          Research    Generation   Publishing
          (WebFetch)  (Scripts/)   (Composio)
```

**Scripts** (`scripts/`) — Python backend for rendering, parsing, publishing, and brand management. Every script has a corresponding test in `tests/`.

**Vault** (`vault/`) — Gitignored content store: brand profiles, generated angles/scripts, rendered outputs, content registry. Obsidian-compatible.

**Skills** (`.claude/skills/`) — Third-party skill packs (HeyGen, viral-reel-generator, video-use, stop-slop).

**Commands** (`.claude/commands/`) — Claude Code slash command definitions that orchestrate the pipeline.

## Key Files

| Path | Purpose |
|------|---------|
| `scripts/publish.py` | Multi-platform publisher via Composio CLI |
| `scripts/generate_carousel.py` | Pillow + OpenAI slide renderer |
| `scripts/generate_post.py` | Single-image post generator (GPT-image-2) |
| `scripts/brand_voice.py` | Brand module read/write/compile/status CLI |
| `scripts/registry.py` | Content registry (JSON-backed tracking) |
| `scripts/parse_angle.py` | Angle file parser (YAML frontmatter) |
| `scripts/parse_script.py` | Script file → beats JSON parser |
| `scripts/fetch_broll.py` | Pexels video/photo fetcher for b-roll |
| `scripts/fetch_images.py` | Stock image fetcher (Pexels/Pixabay) |
| `scripts/fetch_sfx.py` | Sound effects fetcher |
| `scripts/watermark.py` | Branded watermark overlay |
| `scripts/create_session.py` | Session directory scaffolding |
| `scripts/build_manifest.py` | Asset manifest builder |
| `scripts/check_env.py` | Environment variable validator |
| `AVATAR-USER.md` | Active HeyGen avatar config (symlink) |
| `.mcp.json` | MCP server config (HeyGen) |
| `vault/content-registry.json` | Content tracking database |
| `vault/publish-config.md` | Publish notification config |

## Environment Variables

Required in `.env`:

| Key | Used by |
|-----|---------|
| `OPENAI_API_KEY` | Image generation (GPT-image-2), carousel rendering |
| `HEYGEN_API_KEY` | Presenter video generation |
| `PEXELS_API_KEY` | B-roll and stock image fetching |
| `PIXABAY_API_KEY` | Fallback stock images |
| `ELEVENLABS_API_KEY` | Voice synthesis (video-use skill) |

## External Dependencies

- **[Composio CLI](https://composio.dev)** — Publishing to Instagram, LinkedIn, X. Install: `npm install -g @composio/cli`. Connect accounts: `composio link instagram`.
- **[HeyGen](https://heygen.com)** — AI presenter video generation via MCP server (`.mcp.json`).
- **[Pexels](https://pexels.com/api)** — B-roll video and stock photos.
- **[OpenAI](https://platform.openai.com)** — Image generation (GPT-image-2) for posts and carousels.

## Vault Structure

The `vault/` directory is gitignored. It's created by `/brand-voice` on first run:

```
vault/
├── brand/
│   ├── brand-voice.md          # Compiled brand profile
│   └── modules/                # 11 individual brand modules
├── library/
│   ├── angles/                 # Generated content angles
│   └── scripts/                # Generated scripts
├── outputs/
│   ├── reels/                  # Rendered video sessions
│   ├── carousels/              # Rendered carousel sessions
│   └── posts/                  # Rendered post sessions
├── imports/                    # Platform export files for style analysis
├── assets/                     # Logo, photos, brand assets
├── logs/                       # Pipeline run logs
├── content-registry.json       # Content tracking
└── content-dashboard.md        # Obsidian dataview dashboard
```

## Content Registry

Every generated piece of content is tracked in `vault/content-registry.json`:
- Type (reel, carousel, post), status (draft/published), virality score
- Target platforms, publish timestamps, published URLs
- Session directory path

View in Obsidian via `vault/content-dashboard.md`.

## Testing

```bash
pytest tests/ -v
```

## Conventions

- Pipeline commands produce output in `vault/outputs/<type>/YYYY-MM-DD-<slug>/`
- Angles are saved to `vault/library/angles/YYYY-MM-DD-<slug>-<format>-NN.md`
- Scripts are saved to `vault/library/scripts/YYYY-MM-DD-<slug>-<mode>-NN.md`
- Brand modules live in `vault/brand/modules/<name>.md` with YAML frontmatter
- All Python scripts are in `scripts/` with matching tests in `tests/`
- Publishing uses Composio CLI — platform handlers are in `scripts/publish.py` `PLATFORM_REGISTRY`
- Content type detection is automatic from session directory contents (final.mp4 → reel, 1.png → carousel, image.png → post)
