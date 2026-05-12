# PostOracle Web Dashboard — Design Spec

**Date:** 2026-05-12
**Status:** Draft
**Scope:** Phase 1 — Read-only local dashboard over the existing vault

## Problem

PostOracle's content pipeline runs via Claude Code slash commands, with output stored in a gitignored `vault/` directory. An Obsidian vault provides some browsing, but a purpose-built web dashboard would give better visibility into content state, analytics, and brand profile without leaving the browser.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Scope | Read-only dashboard (phase 1) | Command execution via Claude Code SDK deferred to phase 2 |
| Architecture | Monorepo — `dashboard/` inside this project | Single repo, vault paths are relative, easy phase 2 SDK addition |
| Stack | Next.js (React) + Tailwind CSS | Full-stack framework, dark theme easy, good DX |
| Data source | Direct file reads via `fs` | No database, no sync layer, always fresh vault state |
| Layout | Fixed left sidebar navigation | 4 pages — classic dashboard pattern, room for future expansion |
| Theme | Dark only | Matches CLI aesthetic, single audience |
| Auth | None | Localhost-only personal tool |

## Architecture

```
Browser (localhost:3000)
    │
    ▼
Next.js App (dashboard/)
    │
    ├── Pages: /, /analytics, /brand, /vault/[...path]
    │
    ├── API Routes (app/api/)
    │   ├── /api/registry   → reads content-registry.json
    │   ├── /api/analytics  → reads vault/analytics/
    │   ├── /api/brand      → reads vault/brand/
    │   └── /api/vault      → reads vault/ tree + files
    │
    └── fs.readFile / fs.readdir (relative: ../vault/)
            │
            ▼
        vault/ (local files)
```

All data flows are read-only. API routes resolve vault paths relative to the monorepo root via a shared `lib/vault.ts` helper. No writes in phase 1.

## Pages

### 1. Content Registry (`/` — home)

The primary view. Shows all generated content from `content-registry.json`.

**Features:**
- Table/list view of all content entries
- Filter by type (reel, carousel, post), status (draft, published), platform (instagram, linkedin)
- Sort by date, virality score
- Click a row → detail panel showing session directory contents (rendered images, video thumbnail, script excerpt)
- Summary stat cards at top: total count, drafts, published

**Data source:** `vault/content-registry.json` — array of objects with fields: `id`, `type`, `topic`, `source_url`, `platforms`, `status`, `virality_score`, `created_at`, `published_at`, `published_urls`, `session_dir`, `tags`.

### 2. Analytics (`/analytics`)

Visual performance dashboard over IG + LinkedIn metrics.

**Features:**
- Platform-level summary cards: followers, engagement rate, impressions
- Per-post performance table with engagement metrics
- Line/bar charts for engagement trends over time (recharts)
- Reads whatever the `/analytics` CLI command last wrote

**Data source:** `vault/analytics/` directory — markdown files with YAML frontmatter produced by `scripts/analytics.py`. Files: `overview.md`, `performance-leaderboard.md`, `platform-comparison.md`, `content-type-analysis.md`.

### 3. Brand Profile (`/brand`)

Rendered view of the brand identity built by `/brand-voice`.

**Features:**
- Rendered markdown of compiled brand voice (`vault/brand/brand-voice.md`)
- 11 module cards showing completion status
- Click a module → full rendered markdown content
- Visual indication of which modules are complete vs. empty

**Data source:** `vault/brand/brand-voice.md` (compiled), `vault/brand/modules/*.md` (individual modules with YAML frontmatter).

### 4. Vault Explorer (`/vault`)

General-purpose file browser over the vault directory.

**Features:**
- File tree with expand/collapse
- Breadcrumb navigation
- Renders `.md` files as formatted markdown
- Displays images inline
- Video files show thumbnail or filename
- Catch-all route: `/vault/library/angles/some-file.md` maps to `vault/library/angles/some-file.md`

**Data source:** `vault/` directory tree via `fs.readdir` (recursive) and `fs.readFile`.

## Project Structure

```
dashboard/
├── app/
│   ├── layout.tsx              # Root layout — sidebar + main area
│   ├── page.tsx                # Content Registry (home)
│   ├── analytics/
│   │   └── page.tsx
│   ├── brand/
│   │   └── page.tsx
│   ├── vault/
│   │   └── [[...path]]/
│   │       └── page.tsx        # Catch-all vault explorer
│   └── api/
│       ├── registry/
│       │   └── route.ts
│       ├── analytics/
│       │   └── route.ts
│       ├── brand/
│       │   └── route.ts
│       └── vault/
│           └── route.ts        # GET ?path= → tree or file content
├── components/
│   ├── sidebar.tsx
│   ├── content-table.tsx
│   ├── status-badge.tsx
│   ├── markdown-viewer.tsx
│   ├── file-tree.tsx
│   └── stat-card.tsx
├── lib/
│   └── vault.ts                # Vault path resolution + fs helpers
├── package.json
├── next.config.ts
└── tailwind.config.ts
```

## Technical Details

### Dependencies

| Package | Purpose |
|---------|---------|
| next | Framework |
| react, react-dom | UI |
| tailwindcss | Styling (dark theme) |
| recharts | Charts on analytics page |
| react-markdown + remark-gfm | Render vault markdown files |
| gray-matter | Parse YAML frontmatter from brand modules and angle files |

### Vault Path Resolution

`lib/vault.ts` exports a single `resolveVaultPath(...segments)` that joins against `path.resolve(process.cwd(), '../vault')`. All API routes use this — no hardcoded paths elsewhere.

Path traversal prevention: the resolved path must start with the vault root. Requests for paths outside vault return 403.

### Static Asset Serving

`next.config.ts` adds a rewrite rule so `/vault-assets/*` maps to the `vault/outputs/` directory. This lets the frontend render carousel images, post images, and video thumbnails directly.

### Empty States

If vault files don't exist (pre-setup user):
- Content Registry → "No content yet. Run `/setup` then `/make-reel` in Claude Code to get started."
- Analytics → "No analytics data. Run `/analytics` in Claude Code to pull metrics."
- Brand → "No brand profile. Run `/brand-voice` in Claude Code to build your identity."
- Vault → shows empty tree

### Error Handling

- File not found → API returns `{ error: "not_found", message: "..." }`, UI shows 404 state
- Parse errors (malformed JSON/YAML) → API returns `{ error: "parse_error", message: "..." }`, UI shows error with file path
- No silent error swallowing — all errors surface to the UI with actionable context

## Phase 2 (Deferred)

Command execution via `@anthropic-ai/claude-code` SDK. The Next.js backend would import the SDK and expose API routes like `POST /api/commands/make-reel` that run Claude Code programmatically. Streaming output back to the UI via Server-Sent Events.

Not designed in this spec — will be a separate brainstorm when phase 1 is stable.

## Dev Workflow

```bash
cd dashboard && npm run dev    # starts on localhost:3000
```

Content pipelines continue to run via Claude Code CLI as before. The dashboard is a passive viewer — run a command in Claude Code, refresh the dashboard to see the result.
